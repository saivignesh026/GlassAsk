// Run with: electron scripts/smoke-windows.mjs (uses isolated, disposable settings).
import {app,BrowserWindow} from 'electron';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
import {browserHandoff} from '../src/window-behavior.mjs';
const output=path.resolve('artifacts');
mkdirSync(output,{recursive:true});
app.setPath('userData',path.resolve('.build-tools/smoke-userdata-'+Date.now()));
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const timeout=setTimeout(()=>{console.error('Smoke test timed out');app.exit(1);},30000);
async function smoke(){try{
  await import('../src/main.mjs');
  await app.whenReady();
  let win;
  for(let i=0;i<100;i++){
    win=BrowserWindow.getAllWindows()[0];
    if(win&&!win.webContents.isLoading())break;
    await delay(100);
  }
  assert.ok(win,'app opens');
  // The terminal running this test can take focus. Check blur dismissal once,
  // then keep the test window visible so Chromium can schedule layout frames.
  await delay(300);
  win.show();win.emit('blur');assert.equal(win.isVisible(),false,'clicking away dismisses the panel');
  win.removeAllListeners('blur');win.show();win.focus();
  const run=code=>win.webContents.executeJavaScript(code);
  await delay(600);
  assert.equal(await run('state.settings.gestures'),true,'gestures enabled for new profiles');
  await run('render({...state,connected:true});viewSettings(false);fit()');
  await delay(350);
  const compact=win.getBounds().height;
  assert.ok(compact<400,`composer should be compact, got ${compact}`);
  const captured=await win.webContents.capturePage();
  const pixels=captured.toBitmap();
  assert.equal(pixels[3],0,'outer margin should be transparent');
  writeFileSync(path.join(output,'composer.png'),captured.toPNG());
  win.hide();
  app.emit('second-instance');
  await delay(350);
  assert.equal(win.getBounds().height,compact,'reopening preserves fitted height');
  await run('viewSettings(true)');await delay(350);
  assert.ok(win.getBounds().height>compact,'settings grows');
  await run('viewSettings(false)');await delay(350);
  assert.equal(win.getBounds().height,compact,'returning to composer shrinks');
  assert.equal((await win.webContents.capturePage()).toBitmap()[3],0,'margins remain transparent after resizing');
  await browserHandoff(win,async()=>{
    assert.equal(win.isVisible(),false);assert.equal(win.isAlwaysOnTop(),false);
  },async open=>{await open('https://example.com');await delay(100);});
  assert.equal(win.isVisible(),true);assert.equal(win.isAlwaysOnTop(),true);
  console.log('Windows smoke checks passed: sizing, transparency, reopen, settings, browser handoff.');
  clearTimeout(timeout);app.quit();
}catch(error){console.error(error);clearTimeout(timeout);app.exit(1);}}
smoke();
