import { readFile, writeFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import LandingPage from '../src/LandingPage';

// Public product evidence is readable without JS or a healthy account API.
// React replaces this static markup on startup; no private session is rendered.
const page = renderToString(createElement(LandingPage, { onSignIn: () => {}, onSignUp: () => {} }));
const html = await readFile('dist/index.html', 'utf8');
if (!html.includes('<div id="root"></div>')) throw new Error('Prerender root missing');
await writeFile('dist/index.html', html.replace('<div id="root"></div>', `<div id="root">${page}</div>`));
console.log('Prerendered the public Portion landing page.');
