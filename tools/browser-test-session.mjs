// One dedicated loopback server/Chrome for a serial suite. Each stage gets an
// isolated browser context (no cookies, favourites or pages leak between stages).
import {spawn} from 'node:child_process';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import {repo} from './project.mjs';
export async function startBrowserSession() {
 const server=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1','--directory',path.join(repo,'docs')],{stdio:['ignore','pipe','pipe']});
 let browser;
 try {
  const port=await new Promise((resolve,reject)=>{
   let output='';const timer=setTimeout(()=>reject(Error('Test server startup timeout')),10000);
   server.stdout.on('data',b=>{output+=b;const m=output.match(/port (\d+)/);if(m){clearTimeout(timer);resolve(+m[1]);}});
   server.once('error',e=>{clearTimeout(timer);reject(e);});
   server.once('exit',code=>{clearTimeout(timer);reject(Error('Test server exited: '+code));});
  });
  browser=await puppeteer.launch({executablePath:'/usr/sbin/google-chrome-stable',headless:true,args:['--headless=new','--enable-unsafe-swiftshader','--use-angle=swiftshader','--no-sandbox']});
  return {port,browser,async close(){try{await browser.close();}finally{await stop(server);}}};
 } catch(e) {await browser?.close();await stop(server);throw e;}
}
async function stop(server){if(server.exitCode===null){const exited=new Promise(r=>server.once('exit',r));server.kill();await exited;}}
export async function browserTestSession() {
 if(!process.env.ROOM_TEST_BROWSER_WS)return startBrowserSession();
 const connection=await puppeteer.connect({browserWSEndpoint:process.env.ROOM_TEST_BROWSER_WS});
 const context=await connection.createBrowserContext();
 return {port:Number(process.env.ROOM_TEST_PORT),browser:{newPage:()=>context.newPage(),version:()=>connection.version()},async close(){try{await context.close();}finally{connection.disconnect();}}};
}
