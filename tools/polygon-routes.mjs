import {edt1} from './routes.mjs';
import {rectPolygon} from './shapes.mjs';
// Polygon scan conversion + the retained Euclidean distance transform. Opening
// corridors continue through the wall plane; a wall is never painted across an arch.
const pointIn=(x,y,p)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
class MaxHeap{a=[];push(n,v){let i=this.a.length;this.a.push([n,v]);while(i){let p=(i-1)>>1;if(this.a[p][1]>=v)break;this.a[i]=this.a[p];i=p;}this.a[i]=[n,v];}pop(){const a=this.a,t=a[0],v=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1][1]>a[c][1])c++;if(a[c][1]<=v[1])break;a[i]=a[c];i=c;}a[i]=v;}return t;}}
export function openingPort(room,o){const s=o.clear_floor_y||o.clear_floor_x||o.opening_y||o.opening_x;return {id:o.id,wall:o.wall,range:s,plane:['west','north'].includes(o.wall)?0:o.wall==='east'?room.width_x:room.depth_y};}
const corridor=(r,p,extension)=>p.wall==='west'?{x:p.plane-extension,y:p.range[0],w:extension,d:p.range[1]-p.range[0]}:p.wall==='east'?{x:p.plane,y:p.range[0],w:extension,d:p.range[1]-p.range[0]}:p.wall==='north'?{x:p.range[0],y:p.plane-extension,w:p.range[1]-p.range[0],d:extension}:{x:p.range[0],y:p.plane,w:p.range[1]-p.range[0],d:extension};
export function polygonWalk(room,obstacles,from,to,{grid=.5,extension=48}={}) {
 const r=room.room||room,poly=r.polygon||rectPolygon({x:0,y:0,w:r.width_x,d:r.depth_y}),ports=[from,to],corr=ports.map(p=>corridor(r,p,extension));
 const left=Math.min(0,...corr.map(c=>c.x))-grid,top=Math.min(0,...corr.map(c=>c.y))-grid,right=Math.max(r.width_x,...corr.map(c=>c.x+c.w))+grid,bottom=Math.max(r.depth_y,...corr.map(c=>c.y+c.d))+grid;
 const W=Math.ceil((right-left)/grid),H=Math.ceil((bottom-top)/grid),N=W*H,occ=new Uint8Array(N),inRect=(x,y,c)=>x>=c.x&&x<=c.x+c.w&&y>=c.y&&y<=c.y+c.d,allowed=(x,y)=>pointIn(x,y,poly)||corr.some(c=>inRect(x,y,c));
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const xx=left+x*grid,yy=top+y*grid;occ[y*W+x]=+[ [xx+1e-6,yy+1e-6],[xx+grid-1e-6,yy+1e-6],[xx+1e-6,yy+grid-1e-6],[xx+grid-1e-6,yy+grid-1e-6]].some(([a,b])=>!allowed(a,b));}
 // Fill polygon spans for each grid row. Taking the union at all vertex-y
 // events within the row, plus both row edges, conservatively paints the swept band.
 for(const o of obstacles){if(o.kind==='rug')continue;const p=o.polygon||rectPolygon(o),ys=p.map(v=>v[1]),lo=Math.max(0,Math.floor((Math.min(...ys)-top)/grid)),hi=Math.min(H-1,Math.floor((Math.max(...ys)-top)/grid));
  for(let y=lo;y<=hi;y++){const y0=top+y*grid,y1=y0+grid,samples=[y0+1e-7,y1-1e-7,...ys.filter(v=>v>y0&&v<y1).flatMap(v=>[v-1e-7,v+1e-7])];
   for(const sy of samples){const xs=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if((a[1]>sy)!==(b[1]>sy))xs.push(a[0]+(sy-a[1])*(b[0]-a[0])/(b[1]-a[1]));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)for(let x=Math.max(0,Math.floor((xs[i]-left)/grid));x<Math.min(W,Math.ceil((xs[i+1]-left)/grid));x++)occ[y*W+x]=1;}
  }
 }
 const tmp=new Float64Array(N),dist=new Float64Array(N);for(let y=0;y<H;y++){const f=new Float64Array(W);for(let x=0;x<W;x++)f[x]=occ[y*W+x]?0:1e10;tmp.set(edt1(f,W),y*W);}for(let x=0;x<W;x++){const f=new Float64Array(H);for(let y=0;y<H;y++)f[y]=tmp[y*W+x];const d=edt1(f,H);for(let y=0;y<H;y++)dist[y*W+x]=Math.max(0,Math.sqrt(d[y])*grid-grid*Math.SQRT2/2);}
 const point=n=>[left+(n%W+.5)*grid,top+(Math.floor(n/W)+.5)*grid],onPort=(xy,p,depth)=>{const [x,y]=xy,v=['west','east'].includes(p.wall)?y:x,normal=['west','east'].includes(p.wall)?x:y,dir=['west','north'].includes(p.wall)?-1:1;return v>=p.range[0]&&v<=p.range[1]&&Math.abs(normal-(p.plane+dir*depth))<grid*.51;};
 const cap=new Float64Array(N),prev=new Int32Array(N);prev.fill(-1);const heap=new MaxHeap();
 for(let n=0;n<N;n++)if(!occ[n]&&onPort(point(n),from,extension/2)){cap[n]=dist[n];heap.push(n,dist[n]);}
 let best=-1;const dirs=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
 while(heap.a.length){const [n,v]=heap.pop();if(v<cap[n])continue;if(onPort(point(n),to,extension/2)){best=n;break;}const x=n%W,y=(n/W)|0;for(const [dx,dy]of dirs){const xx=x+dx,yy=y+dy;if(xx<0||xx>=W||yy<0||yy>=H)continue;const j=yy*W+xx;if(occ[j]||(dx&&dy&&(occ[y*W+xx]||occ[yy*W+x])))continue;const c=Math.min(v,dist[j],dx&&dy?dist[y*W+xx]:Infinity,dx&&dy?dist[yy*W+x]:Infinity);if(c>cap[j]){cap[j]=c;prev[j]=n;heap.push(j,c);}}}
 const raw=[];let bottle=best,min=Infinity;for(let n=best;n>=0;n=prev[n]){raw.push(point(n));const [px,py]=point(n);if(pointIn(px,py,poly)&&dist[n]<min){min=dist[n];bottle=n;}}raw.reverse();const path=[];for(const p of raw){while(path.length>1){const a=path.at(-2),b=path.at(-1);if(Math.abs((b[0]-a[0])*(p[1]-b[1])-(b[1]-a[1])*(p[0]-b[0]))>1e-7)break;path.pop();}path.push(p);}
 return {width:best<0?0:Math.floor(2*cap[best]/grid)*grid,path:path.filter(([x,y])=>x>=0&&x<=r.width_x&&y>=0&&y<=r.depth_y),bottleneck:bottle<0?null:point(bottle),grid_resolution:grid,definition:'Widest moving-disk path between clear opening corridors; conservative polygon occupancy / EDT, no diagonal corner cutting. Not a table-to-wall gap.'};
}
