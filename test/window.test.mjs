import test from 'node:test';
import assert from 'node:assert/strict';
import {browserHandoff} from '../src/window-behavior.mjs';
import {ShakeDetector} from '../src/gestures.mjs';

function windowMock(){return {visible:true,top:true,focused:false,setAlwaysOnTop(value){this.top=value;},hide(){this.visible=false;},show(){this.visible=true;},focus(){this.focused=true;},isDestroyed(){return false;}};}
test('browser handoff hides and lowers the panel before opening the browser, then restores it',async()=>{
  const win=windowMock();
  const result=await browserHandoff(win,async url=>{
    assert.equal(url,'https://example.com/login');
    assert.equal(win.visible,false);assert.equal(win.top,false);
  },async open=>{await open('https://example.com/login');assert.equal(win.visible,false);return 'connected';});
  assert.equal(result,'connected');assert.equal(win.visible,true);assert.equal(win.top,true);assert.equal(win.focused,true);
});
test('browser handoff restores the panel after cancellation or browser-launch failure',async()=>{
  for(const browserFails of [false,true]){
    const win=windowMock();
    await assert.rejects(browserHandoff(win,async()=>{if(browserFails)throw Error('launch failed');},async open=>{await open('https://example.com');throw Error('cancelled');}));
    assert.equal(win.visible,true);assert.equal(win.top,true);
  }
});
test('small diagonal pointer jitter does not erase alternating horizontal or vertical shakes',()=>{
  for(const axis of ['x','y']){
    const detector=new ShakeDetector();let result;
    detector.sample(0,0,0);
    for(let i=0;i<10;i++){
      const start=i%2?80:0,end=i%2?0:80;
      const point=(along,across)=>axis==='x'?[along,across]:[across,along];
      assert.equal(detector.sample(...point(start+(i%2?-30:30),30),i*160+40),null);
      result=detector.sample(...point(end,0),i*160+100);
    }
    assert.equal(result,axis==='x'?'screen':'text');
  }
});
