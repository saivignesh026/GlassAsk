import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
export function atomicWrite(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});const temp=file+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(temp,data,{mode:0o600});fs.renameSync(temp,file);}finally{fs.rmSync(temp,{force:true});}}
export function readJSON(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw Error('A saved settings file could not be read. Back it up and reset it.');}}
export class Vault {
  constructor(directory,safeStorage){this.file=path.join(directory,'accounts.enc');this.safe=safeStorage;}
  available(){return this.safe.isEncryptionAvailable() && this.safe.getSelectedStorageBackend?.()!=='basic_text';}
  load(){if(!fs.existsSync(this.file))return {accounts:[],active:null};if(!this.available())throw Error('Secure credential storage is unavailable.');return JSON.parse(this.safe.decryptString(fs.readFileSync(this.file)));}
  save(value){if(!this.available())throw Error('Secure credential storage is unavailable. Sign-in was not saved.');atomicWrite(this.file,this.safe.encryptString(JSON.stringify(value)));}
}
