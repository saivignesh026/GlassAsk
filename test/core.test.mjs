import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {defaults,validateSettings,registerShortcuts} from '../src/settings.mjs';
import {ShakeDetector} from '../src/gestures.mjs';
import {makeAttempt,validateCallback,tokenRecord} from '../src/oauth.mjs';
import {parseSSE,complete} from '../src/responses.mjs';
import {Vault,atomicWrite} from '../src/storage.mjs';
function shake(axis,count=10,interval=180){const d=new ShakeDetector();const result=[];d.sample(0,0,0);for(let i=0;i<count;i++){const v=i%2?0:80;result.push(d.sample(axis==='y'?0:v,axis==='x'?0:v,(i+1)*interval));}return result.filter(Boolean);}
test('ten alternating strokes trigger only the intended action',()=>{assert.deepEqual(shake('x'),['screen']);assert.deepEqual(shake('y'),['text']);});
test('nine strokes, slow movement, and diagonal shaking do not trigger',()=>{assert.deepEqual(shake('x',9),[]);assert.deepEqual(shake('y',10,250),[]);assert.deepEqual(shake('diagonal'),[]);});
test('cooldown prevents repeated popups',()=>assert.deepEqual(shake('x',20),['screen']));
test('shortcut validation normalizes modifiers and rejects duplicates/injection',()=>{
 assert.equal(validateSettings({...defaults,textShortcut:'Alt+Control+Q'}).textShortcut,'Control+Alt+Q');
 assert.throws(()=>validateSettings({...defaults,textShortcut:defaults.screenShortcut}));
 assert.throws(()=>validateSettings({...defaults,textShortcut:'Control+Q; calc.exe'}));
 assert.throws(()=>validateSettings({...defaults,shakeCount:0}));
});
test('shortcut conflict restores old bindings',()=>{const held=new Set();const api={unregisterAll(){held.clear();},register(k){if(k==='Control+X')return false;held.add(k);return true;}};assert.throws(()=>registerShortcuts(api,{textShortcut:'Control+X',screenShortcut:'Alt+S'},defaults,{text(){},screen(){}}));assert.deepEqual([...held],[defaults.textShortcut,defaults.screenShortcut]);});
test('PKCE uses unique entropy and S256',()=>{const a=makeAttempt(),b=makeAttempt();assert.notEqual(a.state,b.state);assert.notEqual(a.nonce,a.state);assert.equal(a.challenge,createHash('sha256').update(a.verifier).digest('base64url'));});
test('OAuth rejects missing/wrong state, declined consent, and substituted client ID',()=>{
 const a=makeAttempt();const url=new URL(`http://127.0.0.1/auth/callback?code=c&client_id=oaiapp_a&state=${a.state}`);
 assert.deepEqual(validateCallback(url,a),{clientId:'oaiapp_a',code:'c'});
 assert.throws(()=>validateCallback(url,a,'oaiapp_b'));
 url.searchParams.set('state','bad');assert.throws(()=>validateCallback(url,a));
 url.searchParams.set('state',a.state);url.searchParams.set('error','access_denied');assert.throws(()=>validateCallback(url,a));
});
test('returning OAuth callback can omit client ID but new registrations cannot',()=>{const a=makeAttempt();const u=new URL(`http://127.0.0.1/auth/callback?code=c&state=${a.state}`);assert.throws(()=>validateCallback(u,a));assert.equal(validateCallback(u,a,'saved').clientId,'saved');});
test('token records require plan scopes and preserve rotating refresh tokens',()=>{
 const t={access_token:'new',refresh_token:'rotated',token_type:'Bearer',expires_in:3600,scope:'chatgpt.tokens.use.direct resource.invoke'};
 assert.equal(tokenRecord(t,{refresh_token:'old'}).refresh_token,'rotated');
 assert.throws(()=>tokenRecord({...t,scope:'openid'}));assert.throws(()=>tokenRecord({...t,expires_in:-1}));
});
test('SSE tolerates split UTF-8 and CRLF frames',async()=>{
 const bytes=new TextEncoder().encode('data: {"type":"delta","delta":"🌟"}\r\n\r\ndata: [DONE]\n\n');
 async function* chunks(){for(const b of bytes)yield new Uint8Array([b]);}
 const values=[];for await(const event of parseSSE(chunks()))values.push(event);assert.deepEqual(values,[{type:'delta',delta:'🌟'}]);
});
test('responses require completion and use stateless, tool-free requests',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 let body;globalThis.fetch=async(_url,options)=>{body=JSON.parse(options.body);return new Response('data: {"type":"response.output_text.delta","delta":"Hello"}\n\ndata: {"type":"response.completed"}\n\n');};
 let streamed='';const result=await complete({token:'test',model:'test-model',history:[],question:'Hello',image:'data:image/png;base64,AA',onDelta:d=>streamed+=d});
 assert.equal(streamed,'Hello');assert.equal(result.text,'Hello');assert.equal(body.store,false);assert.equal(body.stream,true);assert.equal(body.tools,undefined);assert.equal(body.input[0].content[1].type,'input_image');
 globalThis.fetch=async()=>new Response('data: {"type":"response.output_text.delta","delta":"Partial"}\n\n');
 await assert.rejects(complete({token:'test',model:'x',history:[],question:'x',onDelta(){}}),/interrupted/);
});
test('mid-stream usage errors are failures',async t=>{const old=globalThis.fetch;t.after(()=>globalThis.fetch=old);globalThis.fetch=async()=>new Response('data: {"type":"response.failed","response":{"error":{"code":"subscription_sharing_usage_limit_exceeded"}}}\n\n');await assert.rejects(complete({token:'x',model:'x',history:[],question:'x',onDelta(){}}),/limit/);});
test('credential vault fails closed without encryption',()=>{const dir=mkdtempSync(path.join(tmpdir(),'glass-test-'));try{const v=new Vault(dir,{isEncryptionAvailable:()=>false});assert.throws(()=>v.save({access_token:'secret'}),/unavailable/);}finally{rmSync(dir,{recursive:true,force:true});}});
test('atomic writes replace content completely',()=>{const dir=mkdtempSync(path.join(tmpdir(),'glass-test-'));try{const f=path.join(dir,'settings.json');atomicWrite(f,'old');atomicWrite(f,'new');assert.equal(readFileSync(f,'utf8'),'new');}finally{rmSync(dir,{recursive:true,force:true});}});
