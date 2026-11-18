// Product silhouettes are separate from conservative rectangular collision envelopes.
export function displayPiece(f){
 if(f.display_shape==='clipped')return {...f,polygon:[[f.x+4,f.y],[f.x+f.w-4,f.y],[f.x+f.w,f.y+4],[f.x+f.w,f.y+f.d-4],[f.x+f.w-4,f.y+f.d],[f.x+4,f.y+f.d],[f.x,f.y+f.d-4],[f.x,f.y+4]]};
 if(f.display_shape==='organic'){const V=[[0,.36],[.7,0],[1,1]],P=[];for(let i=0;i<3;i++){const a=V[(i+2)%3],b=V[i],c=V[(i+1)%3],s=b.map((v,k)=>v*.55+a[k]*.45),e=b.map((v,k)=>v*.55+c[k]*.45);for(let j=0;j<=16;j++){const t=j/16;P.push(s.map((v,k)=>(1-t)**2*v+2*(1-t)*t*b[k]+t*t*e[k]));}}const min=[0,1].map(k=>Math.min(...P.map(p=>p[k]))),max=[0,1].map(k=>Math.max(...P.map(p=>p[k])));return {...f,polygon:P.map(p=>[f.x+(p[0]-min[0])/(max[0]-min[0])*f.w,f.y+(p[1]-min[1])/(max[1]-min[1])*f.d])};}
 if(!f.display_shape)return f;return {...f,polygon:Array.from({length:48},(_,i)=>{const t=2*Math.PI*i/48;return [f.x+f.w/2+f.w/2*Math.cos(t),f.y+f.d/2+f.d/2*Math.sin(t)];})};
}
export function surfaceDistance(p,f){const P=displayPiece(f).polygon??[[f.x,f.y],[f.x+f.w,f.y],[f.x+f.w,f.y+f.d],[f.x,f.y+f.d]];return Math.min(...P.map((a,i)=>{const b=P[(i+1)%P.length],v=b.map((n,k)=>n-a[k]),u=Math.max(0,Math.min(1,((p[0]-a[0])*v[0]+(p[1]-a[1])*v[1])/(v[0]*v[0]+v[1]*v[1])));return Math.hypot(p[0]-a[0]-u*v[0],p[1]-a[1]-u*v[1]);}));}
