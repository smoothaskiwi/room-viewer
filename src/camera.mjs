// Source coordinates (east, south, up) are left-handed. Render-world south is -Y.
// Use the delivered physical pose and FOV, not decomposition of its determinant -1 matrix.
export function applyPhotoCamera(THREE,camera,c){
 const intr=c.intrinsics||c,iw=intr.width||c.image_w||c.image_width||4080,ih=intr.height||c.image_h||c.image_height||3072;
 const array=p=>Array.isArray(p)?p:[p.x,p.y,p.z],p=array(c.position),target=array(c.target),up=array(c.up||[0,0,1]);
 if(![...p,...target,...up,c.fov_y_deg].every(Number.isFinite))throw Error('Photo camera lacks a valid position / target / up / FOV');
 camera.scale.set(1,1,1);camera.position.set(p[0],-p[1],p[2]);camera.up.set(up[0],-up[1],up[2]);camera.lookAt(target[0],-target[1],target[2]);
 camera.fov=c.fov_y_deg;camera.aspect=iw/ih;camera.clearViewOffset();
 const offset=c.three_view_offset||{fullWidth:iw,fullHeight:ih,x:iw/2-intr.cx,y:ih/2-intr.cy,width:iw,height:ih};
 camera.setViewOffset(offset.fullWidth,offset.fullHeight,offset.x,offset.y,offset.width,offset.height);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 return {width:iw,height:ih};
}
