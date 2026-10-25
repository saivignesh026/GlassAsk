import http from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
export const ISSUER='https://auth.openai.com';
export const RESOURCE='https://api.openai.com/v1';
const TOKEN=ISSUER+'/api/accounts/oauth/token';
const SCOPE='openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
export function makeAttempt(){const verifier=randomBytes(32).toString('base64url');return {state:randomBytes(32).toString('base64url'),nonce:randomBytes(32).toString('base64url'),verifier,challenge:createHash('sha256').update(verifier).digest('base64url')};}
export function validateCallback(url,attempt,clientId){
  const state=url.searchParams.get('state')||'';
  if(Buffer.byteLength(state)!==Buffer.byteLength(attempt.state)||!timingSafeEqual(Buffer.from(state),Buffer.from(attempt.state)))throw Error('Sign-in state did not match. Try again.');
  if(url.searchParams.has('error'))throw Error('Sign-in was declined or could not be completed.');
  const issued=url.searchParams.get('client_id')||clientId;
  if(!issued || issued==='dynamic_agent_client' || (clientId&&issued!==clientId))throw Error('Invalid account registration returned.');
  const code=url.searchParams.get('code'); if(!code)throw Error('No authorization code returned.');
  return {clientId:issued,code};
}
async function jsonRequest(url,options={}) {
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!response.ok)throw Error(`OpenAI sign-in request failed (${response.status}). Please reconnect your account.`);
  return response.json();
}
function trustedURL(value){const u=new URL(value);if(u.origin!==ISSUER)throw Error('Untrusted authentication endpoint.');return u;}
export async function discovery(){const d=await jsonRequest(ISSUER+'/.well-known/openid-configuration');if(d.issuer!==ISSUER)throw Error('Unexpected identity issuer.');trustedURL(d.jwks_uri);return d;}
export async function verifyIdentity(tokens,clientId,nonce,previous){
  if(!tokens.id_token || !tokens.access_token)throw Error('Sign-in did not return the required credentials.');
  const {jwtVerify,createRemoteJWKSet}=await import('jose');
  const d=await discovery();
  const {payload}=await jwtVerify(tokens.id_token,createRemoteJWKSet(trustedURL(d.jwks_uri)),{issuer:ISSUER,audience:clientId,algorithms:['RS256'],requiredClaims:['sub','exp','iat']});
  if(nonce && payload.nonce!==nonce)throw Error('Sign-in nonce did not match.');
  if(previous && payload.sub!==previous.subject)throw Error('The signed-in account does not match this saved registration.');
  return {subject:payload.sub,email:typeof payload.email==='string'?payload.email:'ChatGPT account'};
}
export function tokenRecord(tokens,previous={}){
  const scopes=typeof tokens.scope==='string'?tokens.scope.split(/\s+/):previous.scopes||[];
  if(!scopes.includes('chatgpt.tokens.use.direct')||!scopes.includes('resource.invoke'))throw Error('ChatGPT plan use was not authorized. Reconnect and enable plan access.');
  if(!tokens.access_token || String(tokens.token_type).toLowerCase()!=='bearer' || !Number.isFinite(tokens.expires_in) || tokens.expires_in<=0)throw Error('Invalid token response.');
  return {...previous,access_token:tokens.access_token,refresh_token:tokens.refresh_token||previous.refresh_token,id_token:tokens.id_token||previous.id_token,scopes,expiresAt:Date.now()+tokens.expires_in*1000};
}
export async function signIn({hostId,previous,openBrowser,signal}){
  const attempt=makeAttempt();
  let resolveCallback,rejectCallback,timer,consumed=false;
  const callback=new Promise((resolve,reject)=>{resolveCallback=resolve;rejectCallback=reject;});
  // Install a rejection handler immediately, including during browser launch.
  callback.catch(()=>{});
  const server=http.createServer((req,res)=>{
    res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Cache-Control','no-store');
    const url=new URL(req.url,'http://127.0.0.1');
    if(req.method!=='GET'||url.pathname!=='/auth/callback'){res.writeHead(404);res.end('Not found');return;}
    if(consumed){res.writeHead(409);res.end('Already received');return;}
    try{const value=validateCallback(url,attempt,previous?.clientId);consumed=true;res.end('Sign-in received. You can close this tab and return to Glass Ask.');resolveCallback(value);}
    catch(error){res.writeHead(400);res.end('Sign-in could not be validated. Return to Glass Ask.');if(url.searchParams.get('state')===attempt.state){consumed=true;rejectCallback(error);}}
  });
  const abort=()=>rejectCallback(Error('Sign-in cancelled.'));
  signal?.addEventListener('abort',abort,{once:true});
  try {
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    const redirect=`http://127.0.0.1:${server.address().port}/auth/callback`;
    const params=new URLSearchParams({client_id:previous?.clientId||'dynamic_agent_client',ext_agent_host_id:hostId,response_type:'code',redirect_uri:redirect,scope:SCOPE,resource:RESOURCE,state:attempt.state,nonce:attempt.nonce,code_challenge_method:'S256',code_challenge:attempt.challenge});
    if(!previous)params.set('agent_name_hint','Glass Ask');
    if(previous?.id_token)params.set('id_token_hint',previous.id_token);
    if(previous?.email)params.set('login_hint',previous.email);
    timer=setTimeout(()=>rejectCallback(Error('Sign-in timed out. Please try again.')),180000);
    if(signal?.aborted)throw Error('Sign-in cancelled.');
    await openBrowser(`${ISSUER}/api/accounts/authorize?${params}`);
    const {clientId,code}=await callback;
    const tokens=await jsonRequest(TOKEN,{method:'POST',body:new URLSearchParams({grant_type:'authorization_code',client_id:clientId,code,code_verifier:attempt.verifier,redirect_uri:redirect,resource:RESOURCE})});
    const identity=await verifyIdentity(tokens,clientId,attempt.nonce,previous);
    if(signal?.aborted)throw Error('Sign-in cancelled.');
    return {...tokenRecord(tokens),...identity,clientId};
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);server.close();server.closeAllConnections();}
}
export async function refresh(account){
  if(!account.refresh_token)throw Error('Reconnect your ChatGPT account.');
  const tokens=await jsonRequest(TOKEN,{method:'POST',body:new URLSearchParams({grant_type:'refresh_token',client_id:account.clientId,refresh_token:account.refresh_token,resource:RESOURCE})});
  if(tokens.id_token)await verifyIdentity(tokens,account.clientId,null,account);
  return tokenRecord(tokens,account);
}
export async function revoke(account){
  if(!account.refresh_token)return true;
  const d=await discovery();const endpoint=trustedURL(d.revocation_endpoint);
  for(let attempt=0;attempt<3;attempt++){
    try{const r=await fetch(endpoint,{method:'POST',body:new URLSearchParams({token:account.refresh_token,token_type_hint:'refresh_token',client_id:account.clientId}),signal:AbortSignal.timeout(10000),redirect:'error'});if(r.ok)return true;if(r.status<500)return false;}catch{}
    if(attempt<2)await new Promise(r=>setTimeout(r,500*2**attempt));
  }
  return false;
}
