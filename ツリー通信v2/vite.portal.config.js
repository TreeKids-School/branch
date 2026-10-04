import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const portal = name => resolve(root, 'src/portal', name);
export default defineConfig({
  base: '/tree-communication-v2/',
  plugins: [react(), {
    name: 'portal-local-isolation',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').includes('/src/') || id.replaceAll('\\', '/').includes('/src/portal/') || !/\.(jsx|js)$/.test(id)) return null;
      let source = code.replaceAll("'/logo.png'", "'/tree-communication-v2/logo.png'").replaceAll('"/logo.png"', '"/tree-communication-v2/logo.png"').replaceAll('/version.json', '/tree-communication-v2/version.json');
      if (/\blocalStorage\b/.test(source)) {
        source = source.replaceAll('window.localStorage', 'localStorage').replace(/\blocalStorage\b/g, 'workspaceStorage');
        source = `import { workspaceStorage } from '@portal-storage';\n${source}`;
      }
      return {code: source, map: null};
    },
    generateBundle(_options, bundle) {
      for (const output of Object.values(bundle)) {
        if (output.type === 'chunk' && /identitytoolkit\.googleapis|firestore\.googleapis|test-octopus|signInWithPassword/.test(output.code)) throw new Error('公開用バンドルに不要なクラウド接続処理があります。');
      }
    },
  }],
  resolve: {alias: [
    {find: 'firebase/firestore', replacement: portal('browserFirestore.js')},
    {find: 'firebase/auth', replacement: portal('browserAuth.js')},
    {find: /^(?:\.\/|(?:\.\.\/)+)firebase$/, replacement: portal('browserFirebase.js')},
    {find: '@portal-storage', replacement: portal('workspaceStorage.js')},
  ]},
  build: {outDir: 'dist-portal', sourcemap: false, rollupOptions: {input: resolve(root, 'portal.html')}},
});
