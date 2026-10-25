const {contextBridge,ipcRenderer}=require('electron');
const allowed=new Set(['state','hide','resize','settings','signin','welcome','switch','signout','models','usage','cancel','removeImage','copy','ask']);
contextBridge.exposeInMainWorld('glass',{
  call:async(name,...args)=>{if(!allowed.has(name))throw Error('Unknown action.');const r=await ipcRenderer.invoke('glass:'+name,...args);if(!r.ok)throw Error(r.error);return r.value;},
  onEvent:callback=>{const listener=(_event,data)=>callback(data);ipcRenderer.on('glass:event',listener);return()=>ipcRenderer.removeListener('glass:event',listener);}
});
