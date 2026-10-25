import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
for(const dir of ['src','ui','scripts','test'])for(const file of readdirSync(dir))if(/\.(mjs|cjs|js)$/.test(file)){const r=spawnSync(process.execPath,['--check',`${dir}/${file}`],{stdio:'inherit'});if(r.status)process.exit(r.status);}
console.log('JavaScript syntax checks passed.');
