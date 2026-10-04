// Reference-only rendering of the current reservation AppShell; not an application test.
// No Firebase app import, credentials, children, or external requests.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('C:/Users/koi06/treeproject/tree-branch/ツリー通信v2/node_modules/esbuild');
const { chromium } = require('C:/Users/koi06/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const source = 'C:/Users/koi06/treeproject/tree-kids-schedule/V2';
const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppShell } from './src/app/AppShell';
import './src/features/staff/treeCommunicationV2.css';
const membership = { uid: 'shell-reference', role: 'staff', status: 'active' };
createRoot(document.getElementById('root')).render(
  <AppShell membership={membership} email={null} onSignOut={() => {}} accountMenu={<details className="staff-account"><summary>アカウント <span>⌄</span></summary></details>}>
    <section className="tree-communication-launcher">
      <header className="tree-communication-launcher-heading"><div><h1>ツリー通信v2</h1><span>起動確認版</span></div><button type="button">画面を広げる</button></header>
      <p className="tree-communication-launcher-notice">入力内容は、このブラウザー内に仮保存されます。スタッフ間の共有・既存データの移行・保護者への公開は、まだ接続していません。</p>
      <div className="tree-communication-frame" aria-label="生成用の白紙の内容領域" />
    </section>
  </AppShell>
);
`;

(async () => {
  const result = await esbuild.build({ stdin: { contents: entry, resolveDir: source, sourcefile: 'reference-shell.tsx', loader: 'tsx' }, bundle: true, write: false, outdir: __dirname, entryNames: 'reference-shell', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, minify: false, logLevel: 'silent' });
  const js = result.outputFiles.find(file => file.path.endsWith('.js')).contents;
  const css = result.outputFiles.find(file => file.path.endsWith('.css')).contents;
  const builtCss = fs.readFileSync(path.join(source, 'dist/assets/index-DRhSgsvU.css'));
  const logo = fs.readFileSync('C:/Users/koi06/treeproject/docs/branding/tree-kids-school-official-logo.png');
  // This PNG copy is a source reference, not a generated logo.
  fs.writeFileSync(path.join(__dirname, 'tree-kids-school-official-logo.png'), logo);
  const html = '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/built.css"><link rel="stylesheet" href="/shell.css"></head><body><div id="root"></div><script src="/shell.js"></script></body></html>';
  const resources = { '/': ['text/html; charset=utf-8', html], '/built.css': ['text/css', builtCss], '/shell.css': ['text/css', css], '/shell.js': ['text/javascript', js], '/brand/tree-kids-school-official-logo.png': ['image/png', logo] };
  const server = http.createServer((req, res) => { const item = resources[req.url]; if (!item) { res.writeHead(404).end(); return; } res.writeHead(200, { 'Content-Type': item[0] }); res.end(item[1]); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    for (const view of [{ name: 'current-shell-pc', width: 1440, height: 900 }, { name: 'current-shell-mobile', width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: 1 });
      await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
      await page.goto(origin + '/#/communication/v2', { waitUntil: 'networkidle' });
      await page.screenshot({ path: path.join(__dirname, view.name + '.png'), fullPage: false });
      console.log(view.name + '.png');
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
