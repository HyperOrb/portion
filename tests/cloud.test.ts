import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';
import { CloudConflict, mergeDeviceJournal, readJournal, writeJournal } from '../src/cloud.ts';
import { freshData } from '../src/domain.ts';

const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';

test('the actual migration isolates journals by owner, enforces revisions, and protects the durable budget', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  // Supabase supplies these roles and auth.uid(). Use real PostgreSQL RLS, with test claims.
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
    insert into auth.users values ('${userA}'),('${userB}');`);
  await db.exec(await readFile(new URL('../supabase/migrations/202610020001_portion.sql', import.meta.url), 'utf8'));
  await db.exec('set role anon;');
  await assert.rejects(db.query('select * from public.journals'), { code: '42501' });
  await assert.rejects(db.query("select public.reserve_parse(20,3,'33333333-3333-4333-8333-333333333333')"), { code: '42501' });
  await db.exec('reset role; set role authenticated;');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userA]);
  await db.query('insert into public.journals(user_id,data,revision) values($1,$2,999)', [userA, JSON.stringify(freshData())]);
  assert.equal((await db.query<{ revision: number }>('select revision from public.journals')).rows[0].revision, 1);
  await assert.rejects(db.query('insert into public.journals(user_id,data) values($1,$2)', [userB, JSON.stringify(freshData())]), { code: '42501' });
  await assert.rejects(db.query('update public.journals set user_id=$1', [userB]), { code: '42501' });
  await assert.rejects(db.query("select public.reserve_parse(20,3,'33333333-3333-4333-8333-333333333333')"), { code: '42501' });
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userB]);
  assert.equal((await db.query('select * from public.journals')).rows.length, 0);
  assert.equal((await db.query('update public.journals set data=$1 returning user_id', [JSON.stringify(freshData())])).rows.length, 0);
  assert.equal((await db.query('delete from public.journals returning user_id')).rows.length, 0);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userA]);
  assert.equal((await db.query('update public.journals set data=$1 where revision=1 returning revision', [JSON.stringify(freshData())])).rows.length, 1);
  assert.equal((await db.query('update public.journals set data=$1 where revision=1 returning revision', [JSON.stringify(freshData())])).rows.length, 0);
  assert.equal((await db.query<{ revision: number }>('select revision from public.journals')).rows[0].revision, 2);

  await db.exec('reset role; set role service_role;');
  const reserve = async (lease: string) => (await db.query<{ budget: { allowed: boolean; reason?: string; remaining?: number } }>('select public.reserve_parse(2,0,$1) as budget', [lease])).rows[0].budget;
  const leaseA = '33333333-3333-4333-8333-333333333333'; const leaseB = '44444444-4444-4444-8444-444444444444';
  assert.deepEqual(await reserve(leaseA), { allowed: true, remaining: 1 });
  assert.equal((await reserve(leaseB)).reason, 'pacing');
  await db.query('select public.release_parse($1)', [leaseB]);
  assert.equal((await reserve(leaseB)).reason, 'pacing'); // A stale release cannot unlock another attempt.
  await db.query('select public.release_parse($1)', [leaseA]);
  assert.deepEqual(await reserve(leaseB), { allowed: true, remaining: 0 });
  await db.query('select public.release_parse($1)', [leaseB]);
  assert.equal((await reserve(leaseA)).reason, 'daily');
  await db.exec("reset role; update portion_private.parse_budget set day=((now() at time zone 'UTC')::date - 1); set role service_role;");
  assert.deepEqual(await reserve(leaseA), { allowed: true, remaining: 1 });
  await db.query('select public.release_parse($1)', [leaseA]);
  const paced = (await db.query<{ budget: { reason: string } }>('select public.reserve_parse(20,3,$1) as budget', [leaseA])).rows[0].budget;
  assert.equal(paced.reason, 'pacing');
});

test('cloud writes carry the authenticated owner and expected revision; conflicts and invalid data never become successful saves', async () => {
  const requests: { url: URL; method: string; body: Record<string, unknown> }[] = [];
  let reply: unknown = { revision: 2 }; let status = 200;
  const client = createClient('https://portion-test.supabase.co', 'sb_publishable_test', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (url, options) => {
      requests.push({ url: new URL(String(url)), method: options?.method || 'GET', body: options?.body ? JSON.parse(String(options.body)) : {} });
      return new Response(JSON.stringify(reply), { status, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  assert.equal(await writeJournal(client, userA, freshData(), 1), 2);
  assert.equal(requests[0].method, 'PATCH');
  assert.equal(requests[0].url.searchParams.get('user_id'), `eq.${userA}`);
  assert.equal(requests[0].url.searchParams.get('revision'), 'eq.1');
  assert.equal(Object.hasOwn(requests[0].body, 'revision'), false);
  reply = [];
  await assert.rejects(writeJournal(client, userA, freshData(), 1), CloudConflict);
  reply = { code: '23505', message: 'duplicate' }; status = 409;
  await assert.rejects(writeJournal(client, userA, freshData(), 0), CloudConflict);
  const count = requests.length;
  const invalid = { ...freshData(), rawDescription: 'private' };
  await assert.rejects(writeJournal(client, userA, invalid, 2), /unknown|unexpected|unsupported/i);
  assert.equal(requests.length, count);
  reply = { data: { ...freshData(), rawDescription: 'private' }, revision: 2 }; status = 200;
  await assert.rejects(readJournal(client, userA), /unknown|unexpected|unsupported/i);
  reply = [];
  assert.equal((await readJournal(client, userA)).revision, 0);
});

test('device import preserves account copies, deduplicates reimports, and does not mutate device backups', () => {
  const account = freshData(); const device = freshData();
  const label = { id: 'label-one', name: 'Whey label', cookingState: 'as_sold', per100g: { calories: 400, protein: 80, carbs: 10, fat: 5 }, source: { name: 'Package label', id: 'package-one', url: '', description: 'Per 100 g from package', dataType: 'label' } };
  device.labels.push(label); device.targets = { protein: 200 };
  const imported = mergeDeviceJournal(account, device);
  assert.deepEqual(imported.targets, device.targets);
  imported.labels[0].name = 'Updated account label';
  const reimported = mergeDeviceJournal(imported, device);
  assert.equal(reimported.labels.length, 1);
  assert.equal(reimported.labels[0].name, 'Updated account label');
  assert.equal(device.labels[0].name, 'Whey label');
});
