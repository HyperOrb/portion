import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export function assertPublicEnvironment(env: Record<string, string>) {
  for (const [name, value] of Object.entries(env)) {
    if (!value || !name.startsWith('VITE_')) continue;
    if (name === 'VITE_SUPABASE_PUBLISHABLE_KEY') {
      if (!value.startsWith('sb_publishable_')) throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable key. A secret key must never be included in the browser build.');
    } else if (/KEY|SECRET|TOKEN|PASSWORD/i.test(name)) throw new Error('Server secrets cannot use a VITE_ environment variable. Remove the prefix before building.');
  }
}

export default defineConfig({
  plugins: [{ name: 'public-environment-guard', config(_config, { mode }) { assertPublicEnvironment(loadEnv(mode, process.cwd(), 'VITE_')); } }, react()],
  server: { proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } } },
});
