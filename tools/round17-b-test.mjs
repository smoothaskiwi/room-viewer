import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {repo} from './project.mjs';
import {round17Shopping} from './round17-shopping.mjs';
const products=JSON.parse(await fs.readFile(repo+'/data/round17-b-products.json'));let checks=0;const ok=(x,s)=>{assert(x,s);checks++;};
for(const [id,price]of [['art_frame',34.99],['large_frame',87.99]]){ok(products[id].price_usd===price,id+' verified price');ok(products[id].purchase_url.includes('craigframes.com/products/')&&products[id].selected_variant,id+' exact direct variant');ok(!/do not order/.test(products[id].source_status),id+' no gate');}
const bulb=products['r17-e26-bulbs'];ok(/2700 K/.test(bulb.label)&&bulb.purchase_url.startsWith('https://'),'warm linked bulb');
for(const r of JSON.parse(await fs.readFile(repo+'/data/rooms.json'))){const p=JSON.parse(await fs.readFile(repo+'/docs/'+r.slug+'/rentals.json'));for(const l of p.layouts){const n=l.styling.filter(s=>!s.owned&&/lamp|sconce|pendant|chandelier/.test(s.category)&&!/LED|bulb|SOLHETTA/i.test(s.name)).reduce((n,s)=>n+(s.qty??1),0);if(n)ok(l.shop.items.some(i=>/bulb|SOLHETTA/i.test(i.name)&&/2700/.test(i.name)&&i.purchase_url),l.id+' every new replaceable lamp gets linked warm bulbs');}if(r.room==='kitchen')ok(p.layouts[0].hero_camera.position.join(',')==='38,5,54','nook camera corrected in pipeline');}
const fake={'r17-e26-bulbs':bulb,lamp:{kind:'lamp',label:'test E26 lamp'}};for(const n of [1,2,3]){const [p]=round17Shopping('test',[{placements:[],styling:[{id:'lamp',category:'lamp',qty:n}]}],fake);ok(p.styling.at(-1).qty===Math.ceil(n/2),'bulb pack arithmetic '+n);}
console.log('PASS Round17 B artifact: '+checks+' checks.');
