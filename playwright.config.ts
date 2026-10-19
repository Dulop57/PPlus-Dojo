import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',timeout:30_000,fullyParallel:false,
  use:{baseURL:'http://127.0.0.1:4173',channel:process.platform==='win32'?'msedge':undefined,trace:'retain-on-failure'},
  projects:[{name:'desktop',use:{...devices['Desktop Chrome'],channel:process.platform==='win32'?'msedge':undefined}},{name:'mobile',use:{viewport:{width:390,height:844},isMobile:true,hasTouch:true,channel:process.platform==='win32'?'msedge':undefined}}],
  webServer:{command:'npm run dev -- --port 4173 --strictPort',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI,env:{DOJO_IMAGE_EDITOR_DEFAULTS_FILE:'artifacts/image-editor-test-defaults.json',DOJO_ROSTER_EDITOR_DEFAULTS_FILE:'artifacts/roster-editor-test-defaults.json'}},
});
