import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {imageEditorPlugin} from './scripts/image-editor.mjs';

export default defineConfig({
  plugins: [react(), imageEditorPlugin()],
  base: './',
  server: {
    watch: { ignored: ['**/.tools/**', '**/target/**', '**/artifacts/**', '**/native/vendor/**', '**/inputs/**', '**/Game Files/**', '**/public/data/generations/**'] },
  },
  build: { outDir: process.env.DOJO_WEB_BUILD ? 'dist-web' : process.env.DOJO_SANDBOX ? 'dist-sandbox' : 'dist', emptyOutDir: !process.env.DOJO_REUSE_DATA, copyPublicDir: !process.env.DOJO_REUSE_DATA && !process.env.DOJO_WEB_BUILD },
});
