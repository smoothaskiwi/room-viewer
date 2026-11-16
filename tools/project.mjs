import fs from 'node:fs/promises';
import path from 'node:path';
export const repo=new URL('../',import.meta.url).pathname;
export const project=process.env.ROOM_PROJECT_DIR||await fs.readFile(path.join(repo,'.project-dir'),'utf8').then(s=>s.trim()).catch(()=>{throw Error('Set ROOM_PROJECT_DIR or create an untracked .project-dir containing the owning project path.');});
export const source=process.env.SCENE_SPEC||path.join(project,'prototype/scene-spec.json');
