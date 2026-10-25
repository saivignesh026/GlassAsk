import test from 'node:test';
import assert from 'node:assert/strict';
import {browserHandoff,panelBounds} from '../src/window-behavior.mjs';
import {ShakeDetector} from '../src/gestures.mjs';
import {defaults,validateSettings} from '../src/settings.mjs';

function windowMock(){return {visible:true,top:true,focused:false,setAlwaysOnTop(value){this.top=value;},hide(){this.visible=false;},show(){this.visible=true;},focus(){this.focused=true;},isDestroyed(){return false;}};}
test('panel retains a dragged position and stays on screen after display changes',()=>{
  const area={x:0,y:0,width:1440,height:900};
  assert.deepEqual(panelBounds(area,680,300,{x:100,y:150}),{width:680,height:300,x:100,y:150});
  assert.deepEqual(panelBounds(area,680,300,{x:-1920,y:1200}),{width:680,height:300,x:0,y:600});
  assert.equal(panelBounds({x:-1920,y:0,width:1920,height:1080},680,300,{x:-1800,y:80}).x,-1800);
});
test('browser handoff hides and lowers the panel before opening the browser, then restores it',async()=>{
  const win=windowMock();
  const result=await browserHandoff(win,async url=>{
    assert.equal(url,'https://example.com/login');
    assert.equal(win.visible,false);assert.equal(win.top,false);
  },async open=>{await open('https://example.com/login');assert.equal(win.visible,false);return 'connected';});
  assert.equal(result,'connected');assert.equal(win.visible,true);assert.equal(win.top,true);assert.equal(win.focused,true);
});

function trackpadShake(axis,{strokes=6,amplitude=18,interval=480}={}){
  const detector=new ShakeDetector(3,3500,12),events=[];
  detector.sample(0,0,0);
  for(let stroke=0;stroke<strokes;stroke++)for(let step=1;step<=6;step++){
    const along=stroke%2?amplitude*(1-step/6):amplitude*step/6;
    const across=stroke*2+step/3;
    const result=detector.sample(axis==='x'?along:across,axis==='y'?along:across,stroke*interval+step*interval/6);
    if(result)events.push(result);
  }
  return events;
}
test('trackpad recognizes short, gradual, drifting strokes in either direction',()=>{
  assert.deepEqual(trackpadShake('x'),['screen']);
  assert.deepEqual(trackpadShake('y'),['text']);
});
test('trackpad ignores tiny jitter, incomplete shakes, and movements outside the time window',()=>{
  assert.deepEqual(trackpadShake('x',{amplitude:6}),[]);
  assert.deepEqual(trackpadShake('x',{strokes:5}),[]);
  assert.deepEqual(trackpadShake('y',{interval:1000}),[]);
});
test('legacy settings receive the trackpad profile without overriding saved gesture preferences',()=>{
  const legacy={...defaults,gestures:false,shakeCount:5,shakeWindow:2000};delete legacy.gestureProfile;
  const migrated=validateSettings(legacy);
  assert.equal(migrated.gestureProfile,'trackpad');assert.equal(migrated.gestures,false);assert.equal(migrated.shakeCount,5);
  assert.throws(()=>validateSettings({...defaults,gestureProfile:'invalid'}));
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
