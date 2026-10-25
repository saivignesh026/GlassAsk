const $=id=>document.getElementById(id);
let state=null,answer='',pending=false;
let fitQueued=false;
function fit(){if(fitQueued)return;fitQueued=true;queueMicrotask(()=>{fitQueued=false;const height=Math.min(690,document.querySelector('.glass').scrollHeight+42);call('resize',height).catch(error=>console.error('Resize failed:',error.message));});}
new MutationObserver(fit).observe(document.querySelector('.glass'),{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden']});
new ResizeObserver(fit).observe(document.querySelector('.glass'));
window.addEventListener('resize',fit);
document.fonts.ready.then(fit);
const notice=text=>{$('notice').textContent=text;$('notice').hidden=!text;};
async function call(name,...args){return window.glass.call(name,...args);}
function guarded(fn){return async(...args)=>{try{notice('');await fn(...args);}catch(error){notice(error.message);}};}
function render(s){
  state=s;document.documentElement.style.setProperty('--glass-alpha',String(s.settings.opacity/100));
  $('onboarding').hidden=s.connected;$('composer-area').hidden=!s.connected;
  $('account').replaceChildren(...s.accounts.map(a=>new Option(a.label+(a.connected?'':' (signed out)'),a.id)));
  if(!s.accounts.length)$('account').append(new Option('No account connected',''));
  $('account').value=s.active||'';
  $('model').replaceChildren(...s.models.map(m=>new Option(m.name,m.id)));
  $('model').value=s.settings.model;
  for(const key of ['textShortcut','screenShortcut','shakeCount','shakeWindow','opacity','gestureProfile'])$(key).value=s.settings[key];
  for(const key of ['gestures','startAtLogin'])$(key).checked=s.settings[key];
  $('attachment').hidden=!s.hasImage;
}
function setPending(value){pending=value;$('send').disabled=value;$('question').disabled=value;$('cancel').hidden=!value;document.body.classList.toggle('thinking',value);}
function reset(){answer='';$('answer').textContent='';$('asked').textContent='';$('result').hidden=true;$('copy').hidden=true;$('question').value='';notice('');$('status').textContent='Enter to ask · Shift+Enter for a new line';}
function viewSettings(show){$('chat').hidden=show;$('settings-panel').hidden=!show;if(!show)$('question').focus();}
$('close').onclick=()=>call('hide');
$('minimize').onclick=()=>call('minimize');
$('settings-toggle').onclick=()=>viewSettings($('settings-panel').hidden);
$('back').onclick=()=>viewSettings(false);
$('connect').onclick=guarded(()=>login(state.active));
$('add-account').onclick=guarded(()=>login(null));
$('reconnect').onclick=guarded(()=>login(state.active));
async function login(id){$('cancel').hidden=false;notice('Complete sign-in in your browser…');try{render(await call('signin',id));notice('');}finally{$('cancel').hidden=true;}}
$('account').onchange=guarded(async()=>{render(await call('switch',$('account').value));reset();});
$('signout').onclick=guarded(async()=>{const result=await call('signout');render(await call('state'));if(result&&!result.revoked)notice('Signed out locally. Remote revocation was not confirmed; disconnect Glass Ask in ChatGPT settings.');});
$('refresh-models').onclick=guarded(async()=>render(await call('models')));
for(const button of document.querySelectorAll('.usage'))button.onclick=()=>call('usage');
$('got-it').onclick=guarded(async()=>{await call('welcome');$('welcome').hidden=true;});
$('cancel').onclick=()=>call('cancel');
$('remove-image').onclick=guarded(()=>call('removeImage'));
$('copy').onclick=guarded(async()=>{await call('copy',answer);$('copy').textContent='Copied';});
$('save').onclick=guarded(async()=>{
  const next={...state.settings};
  next.gestureProfile=$('gestureProfile').value;
  for(const key of ['textShortcut','screenShortcut'])next[key]=$(key).value;
  for(const key of ['shakeCount','shakeWindow','opacity'])next[key]=Number($(key).value);
  for(const key of ['gestures','startAtLogin'])next[key]=$(key).checked;
  next.model=$('model').value||state.settings.model;
  render(await call('settings',next));notice('Preferences saved. Your shortcuts are active.');
});
$('trackpad-preset').onclick=guarded(async()=>{
  render(await call('settings',{...state.settings,gestures:true,gestureProfile:'trackpad',shakeCount:3,shakeWindow:3500}));
  notice('Trackpad gestures saved. Close the panel, then use one finger to move the pointer left-right or up-down three times within 3.5 seconds.');
});
for(const key of ['textShortcut','screenShortcut']){
  $(key).onkeydown=event=>{
    if(event.key==='Tab')return;event.preventDefault();
    const mods=[];if(event.ctrlKey)mods.push('Control');if(event.altKey)mods.push('Alt');if(event.shiftKey)mods.push('Shift');if(event.metaKey)mods.push('Super');
    if(!mods.length)return;
    let k=event.code.startsWith('Key')?event.code.slice(3):event.code.startsWith('Digit')?event.code.slice(5):event.code;
    if(!/^(Space|Enter|[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4]))$/.test(k))return;
    $(key).value=[...mods,k].join('+');
  };
}
$('opacity').oninput=()=>document.documentElement.style.setProperty('--glass-alpha',String(Number($('opacity').value)/100));
$('composer').onsubmit=guarded(async event=>{
  event.preventDefault();if(pending)return;const question=$('question').value.trim();if(!question)return;
  answer='';$('answer').textContent='';$('asked').textContent=question;$('result').hidden=false;$('copy').hidden=true;$('copy').textContent='Copy answer';$('status').textContent='Thinking…';setPending(true);
  try{await call('ask',question);}finally{setPending(false);$('question').focus();}
});
$('question').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('composer').requestSubmit();}};
document.addEventListener('keydown',e=>{if(e.key==='Escape')call('hide');});
window.glass.onEvent(e=>{
  if(e.type==='state')render(e.state);
  if(e.type==='open'){reset();viewSettings(false);$('mode').textContent=e.mode==='screen'?'Your screen, explained.':'A little clarity, on demand.';$('attachment').hidden=!e.hasImage;$('question').placeholder=e.hasImage?'Ask about your screen…':'What’s on your mind?';$('question').focus();}
  if(e.type==='settings')viewSettings(true);
  if(e.type==='reset')reset();
  if(e.type==='delta'){answer+=e.delta;$('answer').textContent=answer;}
  if(e.type==='complete'){answer=e.text;$('answer').textContent=answer;$('copy').hidden=false;$('question').value='';$('question').placeholder='Ask a follow-up…';$('status').textContent='Ask a follow-up · Esc to close';$('attachment').hidden=true;}
  if(e.type==='error'){notice(e.message);$('status').textContent='Ready when you are';}
  if(e.type==='connected'){$('welcome').hidden=!e.welcome;}
});
guarded(async()=>render(await call('state')))();
