// Round 10: build-time appearance defaults for the 3D/plan renderers.
//
// applyRoomAppearance(room, roomId) returns a deep copy of the room file with
// `room.room.appearance_palette` added. It never edits the source file and never
// changes geometry that rules, routes or clearances read: everything it adds is
// display-only (colours, fixture styling, arch rise, context solids drawn outside
// the measured room shell) and every guessed value is flagged `assumed: true`.
//
// The palette starts from the room file's own free-text `room.appearance`
// (keyword parse, so a new room with the same words gets the same materials) and
// is then refined by per-room defaults taken from the surveys and video frames.

const COLOR={
 warmWhite:'#f3efe6',cream:'#efe6d2',whiteTrim:'#f7f5ef',
 shakerWhite:'#f4f3ee',quartz:'#eceae4',
 greyPlank:'#9c9a94',greyPlankSeam:'#7f7d78',
 oakStrip:'#c79a63',oakStripSeam:'#a87b47',
 greige:'#a29d95',greigeBack:'#928d85',
 brushedSilver:'#d3d5d7',black:'#1f1f1f',
 ceiling:'#f6f4ee',
};

const clone=v=>JSON.parse(JSON.stringify(v));

// Keyword parse of the free-text appearance sentence. Exported for tests.
export function paletteFromText(text=''){
 const t=String(text).toLowerCase(),p={text:String(text),walls:COLOR.cream,trim:COLOR.whiteTrim,ceiling:COLOR.ceiling,floor:null,cabinets:null,upholstery:null,fixture_style:null,arch_style:null};
 if(/warm white/.test(t))p.walls=COLOR.warmWhite;
 else if(/cream/.test(t))p.walls=COLOR.cream;
 if(/grey wood-look|grey (vinyl )?plank|gray (vinyl )?plank/.test(t))p.floor={kind:'grey wood-look vinyl plank',color:COLOR.greyPlank,seam:COLOR.greyPlankSeam,plank_width:7,direction:'x'};
 else if(/oak strip|red-oak strip|strip hardwood/.test(t))p.floor={kind:'oak strip hardwood',color:COLOR.oakStrip,seam:COLOR.oakStripSeam,plank_width:2.25,direction:'y'};
 if(/white shaker/.test(t))p.cabinets={style:'shaker',color:COLOR.shakerWhite,frame:'#e6e4dd',counter:/quartz/.test(t)?COLOR.quartz:COLOR.shakerWhite};
 if(/greige|grey upholster|gray upholster/.test(t))p.upholstery={seat:COLOR.greige,back:COLOR.greigeBack,plinth:COLOR.shakerWhite};
 if(/dome pendant/.test(t))p.fixture_style={kind:'dome-pendant',finish:/silver/.test(t)?COLOR.brushedSilver:'#c0c0c0',metalness:.35,roughness:.38};
 else if(/candle chandelier|candle-style chandelier|5-arm candle/.test(t))p.fixture_style={kind:'candle-chandelier',finish:/black/.test(t)?COLOR.black:'#3b3b3b',arms:5};
 else if(/ceiling fan/.test(t))p.fixture_style={kind:'ceiling-fan',finish:/black/.test(t)?COLOR.black:'#ffffff',blades:/5-blade/.test(t)?5:4};
 if(/round-top|arch/.test(t))p.arch_style='round-top';
 return p;
}

// Per-room refinements. Keys accept page room ids and room-file meta.room names.
const ROOM_DEFAULTS={
 kitchen:{
  basis:'room.appearance text; kitchen video frame (white Shaker doors, grey upholstered L banquette on a white plinth, brushed-silver dome pendant hung low over the table, white-cased windows); supplier layout for cabinet codes',
  camera:{from:'north-east',reason:'the nook is open on the north; this view shows both windows, the banquette corner and the pendant'},
  fixtures:{pendant:{kind:'dome-pendant',finish:COLOR.brushedSilver,metalness:.35,roughness:.38,diameter:20,height:11,bottom_z:62,assumed:true,assumed_note:'diameter, shade height and hang height read from the video frame, not measured'}},
  context:[
   {id:'east-run-end',label:'Kitchen east cabinet run end (3DB24 + back panel)',kind:'cabinet',front:'west',x:[72,96],y:[-30.6,0],z:[0,36],counter:true,assumed:false,basis:'room fixed.east_cabinet_run + dining_opening.blocked_y'},
   {id:'microwave-wall-cabinet',label:'Microwave wall cabinet above the bar unit (MW274012)',kind:'cabinet',x:[66,93],y:[90.4,102.4],z:[54,94],counter:false,assumed:true,basis:'supplier code 27 W × 40 H × 12 D; hang height assumed'},
  ],
  table_today:{top:'#f2f0ea',edge:'#a27a4f',base:'#f2f0ea',catalog_id:'kitchen-nook-table',basis:'room owned.nook_table: white laminate top, wood edge band, white column base'},
  pet:{mat:'#8f9598',bowl:'#e9e9e6'},
 },
 'dining-room':{
  basis:'room.appearance text; dining video frame (cream plaster walls, honey oak strip floor, round-top arch with a tight top curve and no casing); survey: black candle chandelier, position assumed',
  camera:{from:'north',reason:'looks toward the south window with both arches on the side walls'},
  cabinets:{style:'shaker',color:COLOR.shakerWhite,frame:'#e6e4dd',counter:COLOR.quartz,note:'kitchen cabinetry seen through the kitchen arch'},
  arches:{kitchen_arch:{rise:20,assumed:true,casing:false},living_arch:{rise:17,assumed:true,casing:false}},
  fixtures:{light_fixture:{kind:'candle-chandelier',finish:COLOR.black,arms:5,diameter:22,bottom_z:66,assumed:true,assumed_note:'position, size and drop not measured'}},
  context:[
   {id:'kitchen-cabinet-in-arch',label:'Kitchen cabinet end in the arch (north 30.6 in)',kind:'cabinet',front:'west',x:[-29.1,-5.1],y:[24,54.6],z:[0,36],counter:true,assumed:false,basis:'room openings.kitchen_arch.cabinet_in_opening'},
  ],
 },
 'living-room':{
  basis:'room.appearance text: cream walls, white trim, oak strip floor, white painted fireplace, black 5-blade ceiling fan',
  arches:{dining_arch:{rise:16,assumed:true,casing:false},entry_arch:{rise:12,assumed:true,casing:false}},
  fixtures:{ceiling_fan:{kind:'ceiling-fan',finish:COLOR.black,blades:5,diameter:52,bottom_z:86,assumed:true}},
 },
 'guest-bedroom':{
  basis:'room.appearance text: cream walls, white trim, oak strip floor, 5-arm candle chandelier',
  fixtures:{chandelier:{kind:'candle-chandelier',finish:COLOR.black,arms:5,diameter:22,bottom_z:72,assumed:true}},
 },
 'primary-bedroom':{basis:'room.appearance text; bedroom photos'},
};
const ALIASES={'kitchen-nook':'kitchen',nook:'kitchen',dining:'dining-room',living:'living-room',guest:'guest-bedroom',bedroom:'primary-bedroom'};

export const roomAppearanceKey=(room,roomId)=>{
 const id=String(roomId||room?.meta?.room||'').toLowerCase();
 return ROOM_DEFAULTS[id]?id:ALIASES[id]||null;
};

export function applyRoomAppearance(room,roomId){
 const out=clone(room),shell=out.room||out,key=roomAppearanceKey(room,roomId),d=key?ROOM_DEFAULTS[key]:{};
 const base=paletteFromText(shell.appearance);
 // An arch drawn only on the far side (kitchen: "round-top arch on the dining side") stays square here.
 const archIds=(out.openings||[]).filter(o=>/round-top|arch/i.test(`${o.type||''} ${o.id||''}`)&&!/arch on the \w+ side/i.test(o.type||'')&&!/window/i.test(o.type||'')).map(o=>o.id);
 const fixtures={};
 for(const [id,f] of Object.entries(d.fixtures||{}))fixtures[id]=clone(f);
 const palette={
  version:1,
  source:'room.room.appearance',
  text:base.text,
  basis:d.basis||'room.appearance text only',
  walls:base.walls,trim:base.trim,ceiling:base.ceiling,
  floor:base.floor||{kind:'unspecified floor',color:'#b99a72',seam:'#9e7f58',plank_width:4,direction:'x',assumed:true},
  cabinets:d.cabinets?clone(d.cabinets):base.cabinets,
  upholstery:base.upholstery,
  fixture_style:base.fixture_style,
  fixtures,
  arches:Object.fromEntries(archIds.map(id=>[id,{shape:'round-top',rise:d.arches?.[id]?.rise??14,casing:d.arches?.[id]?.casing??false,assumed:d.arches?.[id]?.assumed??true}])),
  context:clone(d.context||[]),
  camera:d.camera?clone(d.camera):null,
  table_today:d.table_today?clone(d.table_today):null,
  pet:d.pet?clone(d.pet):null,
  display_only:true,
 };
 shell.appearance_palette=palette;
 return out;
}

// Field list, kept in code so the handoff and tests agree.
export const APPEARANCE_FIELDS=['version','source','text','basis','walls','trim','ceiling','floor','cabinets','upholstery','fixture_style','fixtures','arches','context','camera','table_today','pet','display_only'];
