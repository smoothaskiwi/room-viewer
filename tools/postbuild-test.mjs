// Run the existing test chain against an already-generated docs tree.
// Useful after standalone council ingestion; never substitutes a fictional build result.
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {repo} from './project.mjs';
const pkg=JSON.parse(await fs.readFile(new URL('../package.json',import.meta.url)));
const commands=pkg.scripts.test.split(/\s*&&\s*/);
if(commands.shift()!=='npm run build')throw Error('Expected the full suite to start with npm run build.');
console.log('Post-build continuation: '+commands.length+' serial test stages on the existing generated artifact.');
for(const command of commands){console.log('\nRUN '+command);const child=spawn(command,{cwd:repo,shell:true,stdio:'inherit'}),status=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});if(status!==0)process.exit(status??1);}
console.log('PASS all '+commands.length+' post-build test stages.');
