// Build-time photographs of the real live scene; never a synthetic stand-in.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {repo} from './project.mjs';
import {startBrowserSession} from './browser-test-session.mjs';
export async function buildListingImages(rooms){
 const cache=path.join(repo,'data/listing-images');await fs.mkdir(cache,{recursive:true});
 const manifestFile=path.join(cache,'manifest.json');let manifest={};try{manifest=JSON.parse(await fs.readFile(manifestFile));}catch(e){if(e.code!=='ENOENT')throw e;}
 const source=(await Promise.all(['home-3d.mjs','rental-styling.mjs','rental-view.mjs','rental-shapes.mjs','rental-scene.mjs','rental-labels.mjs'].map(f=>fs.readFile(path.join(repo,'src',f),'utf8')))).join('\n');
 let session,page,rendered=0;const entries={};
 try{for(const room of rooms){const out=path.join(repo,'docs',room.slug),p=JSON.parse(await fs.readFile(path.join(out,'rentals.json')));let ready=false;const valid=new Set(p.layouts.map(l=>'listing-'+l.id+'.jpg'));for(const file of await fs.readdir(out))if(file.startsWith('listing-')&&file.endsWith('.jpg')&&!valid.has(file))await fs.rm(path.join(out,file));
  for(const l of p.layouts){const key=room.slug+'/'+l.id,file=path.join(cache,key+'.jpg'),hash=createHash('sha256').update('480x270-q60-v1'+source+JSON.stringify([p.render_spec,l])).digest('hex');
   let exists=false;try{exists=(await fs.stat(file)).size>0;}catch{}
   if(!exists||manifest[key]!==hash){
    if(!session){session=await startBrowserSession();page=await session.browser.newPage();await page.setViewport({width:480,height:270,deviceScaleFactor:1});}
    if(!ready){await page.goto(`http://127.0.0.1:${session.port}/${room.slug}/`);await page.waitForFunction(()=>window.__rental?.ready);await page.evaluate(async()=>{document.body.innerHTML='<div id="build-photo" style="position:fixed;inset:0;width:480px;height:270px"></div>';const T=await import('three');window.__textureLoads=0;const start=T.DefaultLoadingManager.itemStart.bind(T.DefaultLoadingManager),end=T.DefaultLoadingManager.itemEnd.bind(T.DefaultLoadingManager);T.DefaultLoadingManager.itemStart=u=>{window.__textureLoads++;start(u);};T.DefaultLoadingManager.itemEnd=u=>{end(u);window.__textureLoads--;};const {start3D}=await import('./home-3d.mjs');window.__photo=await start3D(document.querySelector('#build-photo'),window.__rental.payload.render_spec);});ready=true;}
    await page.evaluate(async l=>{const {rentalScene}=await import('./rental-scene.mjs');await window.__photo.show(rentalScene(l));window.__photo.setClearance(null,false);window.__photo.listingPhoto(l.hero_camera);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));},l);
    // Wait for actual product textures, not an arbitrary sleep or unloaded placeholders.
    await page.waitForFunction(()=>window.__textureLoads===0);
    await page.evaluate(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    await fs.mkdir(path.dirname(file),{recursive:true});await page.screenshot({path:file,type:'jpeg',quality:60});rendered++;
   }
   const bytes=(await fs.stat(file)).size;if(bytes>=120000)throw Error('Listing image exceeds 120 KB: '+key);await fs.copyFile(file,path.join(out,'listing-'+l.id+'.jpg'));entries[key]=hash;
  }
 }}finally{await session?.close();}
 await fs.writeFile(manifestFile,JSON.stringify(entries,null,2)+'\n');console.log('Listing images: '+Object.keys(entries).length+' real 480×270 JPEGs; '+rendered+' regenerated.');
}
