import assert from 'node:assert/strict';
export async function planCheck(page,label){
 const result=await page.evaluate(()=>{
  const a=[...document.querySelectorAll('#plan-host text,#fallback text')].filter(e=>e.checkVisibility()),overlaps=[];
  for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){const b=a[i].getBoundingClientRect(),c=a[j].getBoundingClientRect();if(Math.min(b.right,c.right)-Math.max(b.left,c.left)>.5&&Math.min(b.bottom,c.bottom)-Math.max(b.top,c.top)>.5)overlaps.push([a[i].textContent,a[j].textContent]);}
  const lineOverlaps=[];
  for(const e of a){const b=e.getBoundingClientRect();for(const line of e.ownerSVGElement.querySelectorAll('.dim,.swing,.tick,.obstacle')){
   const length=line.getTotalLength(),ctm=line.getScreenCTM();
   for(let t=0;t<=length;t+=.2){const p=line.getPointAtLength(t),q=new DOMPoint(p.x,p.y).matrixTransform(ctm);if(q.x>b.left+.5&&q.x<b.right-.5&&q.y>b.top+.5&&q.y<b.bottom-.5){lineOverlaps.push({text:e.textContent,line:line.outerHTML});break;}}
  }}
  return {texts:a.length,overlaps,lineOverlaps};
 });assert.deepEqual(result.overlaps,[],`${label}: SVG text bounding boxes intersect`);assert.deepEqual(result.lineOverlaps,[],`${label}: SVG text crosses dimensions or door arcs`);return result;
}
export async function fontCheck(page,label){
 const rows=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.checkVisibility()&&!e.classList.contains('sr-only')&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())).map(e=>{const svg=e instanceof SVGElement,c=svg?e.getScreenCTM():null,scale=c?Math.min(Math.hypot(c.a,c.b),Math.hypot(c.c,c.d)):1;return {text:e.textContent.slice(0,100),px:parseFloat(getComputedStyle(e).fontSize)*scale,minimum:svg?12:14};}));
 const issues=rows.filter(r=>r.px<r.minimum-.01);assert.deepEqual(issues,[],`${label}: computed font size`);return {label,texts:rows.length,minHtml:Math.min(...rows.filter(r=>r.minimum===14).map(r=>r.px)),minSvg:Math.min(...rows.filter(r=>r.minimum===12).map(r=>r.px)),issues};
}
export const launchOptions={executablePath:'/usr/sbin/google-chrome-stable',headless:true,args:['--headless=new','--enable-unsafe-swiftshader','--use-angle=swiftshader','--no-sandbox','--disable-dev-shm-usage']};
