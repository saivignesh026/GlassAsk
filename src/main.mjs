import {app,BrowserWindow,ipcMain,globalShortcut,screen,desktopCapturer,Tray,Menu,nativeImage,shell,safeStorage,clipboard,powerMonitor} from 'electron';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {defaults,validateSettings,registerShortcuts} from './settings.mjs';
import {ShakeDetector} from './gestures.mjs';
import {Vault,readJSON,atomicWrite} from './storage.mjs';
import {signIn,refresh,revoke} from './oauth.mjs';
import {listModels,complete} from './responses.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const page=path.join(root,'ui','index.html');
let win,tray,settings,vault,accounts,settingsFile,hostId,detector,poll,locked=false,request=null,authRequest=null,refreshing=null,accountBusy=false,models=[],history=[],image=null,opening=false,quitting=false;
const message=(type,data={})=>win?.webContents.send('glass:event',{type,...data});
const persist=()=>atomicWrite(settingsFile,JSON.stringify({hostId,settings},null,2));
function saveAccounts(){vault.save(accounts);}
function active(){return accounts.accounts.find(a=>a.clientId===accounts.active);}
function publicState(){return {settings,accounts:accounts.accounts.map(a=>({id:a.clientId,label:`${a.email} · ${a.clientId.slice(-6)}`,connected:!!a.access_token})),active:accounts.active,connected:!!active()?.access_token,models,hasImage:!!image};}
function busy(){if(request||authRequest||refreshing||accountBusy)throw Error('Finish or cancel the current request first.');}
async function token(){
  let a=active();if(!a?.access_token)throw Error('Connect your ChatGPT account in Settings first.');
  if(Date.now()>a.expiresAt-60000){
    if(!refreshing)refreshing=refresh(a).then(next=>{accounts.accounts=accounts.accounts.map(x=>x.clientId===next.clientId?next:x);saveAccounts();return next;}).finally(()=>refreshing=null);
    a=await refreshing;
  }
  return a.access_token;
}
async function loadModels(){const id=accounts.active;const available=await listModels(await token());if(accounts.active!==id||!active()?.access_token)return;models=available;if(!models.length)throw Error('No eligible models were returned for this account.');if(!models.some(m=>m.id===settings.model)){settings.model=models[0].id;persist();}message('state',{state:publicState()});}
function position(){const {workArea}=screen.getDisplayNearestPoint(screen.getCursorScreenPoint());const width=Math.min(680,workArea.width-32);win.setBounds({width,height:Math.min(690,workArea.height-40),x:Math.round(workArea.x+(workArea.width-width)/2),y:Math.round(workArea.y+(workArea.height-Math.min(690,workArea.height-40))/2)});}
async function openPanel(mode='text'){
  if(opening||locked)return;
  if(request){win.show();win.focus();return;}
  opening=true;
  try{
    history=[];image=null;
    if(mode==='screen'){
      win.hide();await new Promise(r=>setTimeout(r,180));
      const display=screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      const sources=await desktopCapturer.getSources({types:['screen'],thumbnailSize:{width:Math.round(display.size.width*display.scaleFactor),height:Math.round(display.size.height*display.scaleFactor)}});
      const source=sources.find(s=>s.display_id===String(display.id));
      if(!source||source.thumbnail.isEmpty())throw Error('This display could not be captured. Check Windows screen-capture permissions.');
      let shot=source.thumbnail;
      if(shot.getSize().width>2560)shot=shot.resize({width:2560});
      image=shot.toDataURL();
    }
    position();win.show();win.focus();message('open',{mode,hasImage:!!image});
  }catch(error){position();win.show();message('error',{message:error.message});}
  finally{opening=false;}
}
function bind(next,previous){registerShortcuts(globalShortcut,next,previous,{text:()=>openPanel('text'),screen:()=>openPanel('screen')});}
function hide(){request?.abort();image=null;history=[];win.hide();message('reset');}
function secureWindow(){
  win=new BrowserWindow({width:680,height:690,show:false,frame:false,transparent:true,backgroundColor:'#00000000',resizable:false,alwaysOnTop:true,skipTaskbar:true,roundedCorners:true,webPreferences:{preload:path.join(root,'src','preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  // Acrylic is provided by the Windows compositor on Windows 11 22H2+.
  if(process.platform==='win32'){try{win.setBackgroundMaterial('acrylic');}catch{}}
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  win.on('close',event=>{if(!quitting){event.preventDefault();hide();}});
  return win.loadFile(page);
}
function handle(name,fn){ipcMain.handle('glass:'+name,async(event,...args)=>{
  if(event.sender!==win.webContents || event.senderFrame!==win.webContents.mainFrame)throw Error('Untrusted sender.');
  try{return {ok:true,value:await fn(...args)};}catch(error){return {ok:false,error:error.message||'Something went wrong.'};}
});}
function setupIPC(){
  handle('state',()=>publicState());
  handle('hide',hide);
  handle('resize',height=>{if(!Number.isFinite(height))return;const area=screen.getDisplayMatching(win.getBounds()).workArea;win.setSize(win.getBounds().width,Math.round(Math.max(220,Math.min(height,690,area.height-40))));});
  handle('settings',next=>{
    const valid=validateSettings(next);bind(valid,settings);
    const before=settings;settings=valid;
    try{persist();}catch(error){settings=before;bind(before,valid);throw error;}
    detector=new ShakeDetector(settings.shakeCount,settings.shakeWindow);
    if(process.platform==='win32'&&app.isPackaged)app.setLoginItemSettings({openAtLogin:settings.startAtLogin});
    message('state',{state:publicState()});return publicState();
  });
  handle('signin',async(id=null)=>{
    busy();if(!vault.available())throw Error('Windows secure storage is unavailable.');
    const previous=id?accounts.accounts.find(a=>a.clientId===id):undefined;
    if(id&&!previous)throw Error('Unknown account.');
    authRequest=new AbortController();
    try{
      const account=await signIn({hostId,previous,openBrowser:url=>shell.openExternal(url),signal:authRequest.signal});
      account.welcomed=previous?.welcomed||false;
      if(authRequest.signal.aborted)throw Error('Sign-in cancelled.');
      const index=accounts.accounts.findIndex(a=>a.clientId===account.clientId&&a.subject===account.subject);
      if(index<0)accounts.accounts.push(account);else accounts.accounts[index]=account;
      accounts.active=account.clientId;saveAccounts();history=[];image=null;
      const welcome=!account.welcomed;
      message('connected',{welcome});
      await loadModels();return publicState();
    }finally{authRequest=null;message('state',{state:publicState()});}
  });
  handle('welcome',()=>{const a=active();if(a){a.welcomed=true;saveAccounts();}});
  handle('switch',async id=>{busy();if(!accounts.accounts.some(a=>a.clientId===id))throw Error('Unknown account.');accountBusy=true;try{accounts.active=id;saveAccounts();history=[];image=null;models=[];message('reset');if(active().access_token)await loadModels();return publicState();}finally{accountBusy=false;message('state',{state:publicState()});}});
  handle('signout',async()=>{busy();const a=active();if(!a)return;accountBusy=true;try{const revoked=await revoke(a);for(const key of ['access_token','refresh_token','id_token','expiresAt'])delete a[key];saveAccounts();history=[];image=null;models=[];message('reset');message('state',{state:publicState()});return {revoked};}finally{accountBusy=false;}});
  handle('models',async()=>{await loadModels();return publicState();});
  handle('usage',()=>shell.openExternal('https://chatgpt.com/#settings/Usage'));
  handle('cancel',()=>{request?.abort();authRequest?.abort();});
  handle('removeImage',()=>{busy();image=null;history=[];message('state',{state:publicState()});});
  handle('copy',text=>{if(typeof text!=='string'||text.length>1000000)throw Error('Invalid text.');clipboard.writeText(text);});
  handle('ask',async question=>{
    busy();if(typeof question!=='string'||!question.trim()||question.length>20000)throw Error('Enter a question under 20,000 characters.');
    request=new AbortController();const current=request;
    const timer=setTimeout(()=>current.abort(),180000);
    try{
      const access=await token();if(!models.length)await loadModels();
      if(!models.some(m=>m.id===settings.model))throw Error('Choose an available model in Settings.');
      const result=await complete({token:access,model:settings.model,history,question:question.trim(),image,signal:current.signal,onDelta:delta=>message('delta',{delta})});
      history=result.history;image=null;message('complete',{text:result.text});return true;
    }catch(error){message('error',{message:current.signal.aborted?'Request cancelled or timed out.':error.message});return false;}
    finally{clearTimeout(timer);request=null;}
  });
}
if(!app.requestSingleInstanceLock())app.quit();else {
  app.on('second-instance',()=>openPanel('text'));
  app.whenReady().then(async()=>{
    app.setAppUserModelId('io.glassask.desktop');
    settingsFile=path.join(app.getPath('userData'),'settings.json');
    const saved=readJSON(settingsFile,null);hostId=saved?.hostId||'urn:uuid:'+randomUUID();
    settings=saved?validateSettings(saved.settings):{...defaults};persist();
    vault=new Vault(app.getPath('userData'),safeStorage);accounts=vault.load();detector=new ShakeDetector(settings.shakeCount,settings.shakeWindow);
    setupIPC();await secureWindow();
    tray=new Tray(nativeImage.createFromPath(path.join(root,'ui','icon.png')).resize({width:32,height:32}));
    tray.setToolTip('Glass Ask');tray.setContextMenu(Menu.buildFromTemplate([{label:'Ask a question',click:()=>openPanel('text')},{label:'Ask about screen',click:()=>openPanel('screen')},{label:'Settings',click:()=>{win.show();win.focus();message('settings');}},{type:'separator'},{label:'Quit Glass Ask',click:()=>app.quit()}]));
    tray.on('click',()=>openPanel('text'));
    let shortcutError;
    try{bind(settings,null);}catch(error){shortcutError=error.message;}
    powerMonitor.on('lock-screen',()=>{locked=true;hide();detector.reset();});
    powerMonitor.on('unlock-screen',()=>{locked=false;detector.reset();});
    poll=setInterval(()=>{if(!settings.gestures||locked||win.isVisible()||opening){detector.reset();return;}const p=screen.getCursorScreenPoint();const mode=detector.sample(p.x,p.y,performance.now());if(mode)openPanel(mode);},40);
    await openPanel('text');
    if(shortcutError)message('error',{message:shortcutError});
    if(active()?.access_token)loadModels().catch(error=>message('error',{message:error.message}));
  }).catch(error=>{console.error(error.message);app.quit();});
  app.on('window-all-closed',()=>{});
  app.on('before-quit',()=>{quitting=true;request?.abort();authRequest?.abort();clearInterval(poll);globalShortcut.unregisterAll();});
}
