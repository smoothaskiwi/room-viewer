import fs from 'node:fs/promises';
import {z} from 'zod';
const positive = z.number().positive();
const nonnegative = z.number().nonnegative();
const string = z.string().min(1);
const pair = z.tuple([z.number(), z.number()]).refine(([a,b]) => b >= a, 'range end must be >= start');
const object = shape => z.object(shape).passthrough();
export const dimensionsSchema = z.object({w: positive.nullable(), d: positive.nullable(), h: positive.nullable()});
const openingSchema = object({id: string, wall: z.enum(['north','east','south','west']), type: z.enum(['window','door']), opening_x: pair.optional(), opening_y: pair.optional(), slab_x: pair.optional(), width: positive.optional(), stool_projection: nonnegative.optional(), stool_top_z: positive.optional()});
export const roomSchema = object({
  meta: object({version: string, room: string, units: z.literal('inches')}),
  room: object({width_x: positive, depth_y: positive, width_x_unc: nonnegative, depth_y_unc: nonnegative, ceiling_z: positive, baseboard_projection: nonnegative}),
  openings: z.array(openingSchema).min(1),
  owned: z.record(string, object({label: string, x: pair, y: pair, h: positive.optional(), top_z: positive.optional(), mattress_top_z: positive.optional()})),
  free_spans: z.record(string, object({x: pair.optional(), y: pair.optional()})),
  wall_items: z.array(z.unknown()), measurements_requested: z.array(string), guides: z.record(string,z.unknown()),
}).superRefine((r, ctx) => {
  const ids = r.openings.map(o => o.id);
  if (new Set(ids).size !== ids.length) ctx.addIssue({code:'custom',path:['openings'],message:'opening ids must be unique'});
  for (const [i,o] of r.openings.entries()) {
    if (o.type === 'window' && (o.stool_projection===undefined || !o.stool_top_z || !(o.opening_x || o.opening_y))) ctx.addIssue({code:'custom',path:['openings',i],message:'window requires opening range, stool top and projection'});
    if (o.type === 'door' && !o.width) ctx.addIssue({code:'custom',path:['openings',i,'width'],message:'door requires width'});
  }
});
export const briefSchema = object({
  meta: object({version: string, room: string}), pinned: object({bed: string}),
  candidate_items: z.array(string).min(1), excluded: z.record(string,string),
  required: object({bed: z.literal(1)}),
  passage: object({main_route: object({hard_min: positive}), bed_side_strip: object({hard_min: positive}), drawer_standing: object({hard_min: nonnegative})}),
  doors: object({everyday_state: z.record(string,string)}), ranking: string,
  style: object({direction: string,catalog_tags:string,ranking:string}), placement_sanity: string,
});
export const productSchema = object({name:string, dims_in:dimensionsSchema, category:string.optional(), price_usd:nonnegative.nullable().optional(), images:z.array(z.unknown()).optional()});
export const productFileSchema = object({products:z.record(string,productSchema)});
export const outletFileSchema = object({access_date:string,items:z.array(object({id:string,official_name:string,overall_inches:z.object({width:positive,depth_or_length_including_headboard:positive,height:positive}),outlet_usd:nonnegative}))});
export const ownedFileSchema = productFileSchema.extend({candidate_products:z.record(string,productSchema).optional(),related_collection:object({variants:z.record(string,productSchema)}).optional()});
export const catalogItemSchema = object({
  id:string,label:string,category:string,kind:string,dims_in:dimensionsSchema,
  w:positive.nullable(),d:positive.nullable(),h:positive.nullable(),
  extra_dims:z.unknown(),price:nonnegative.nullable(),price_date:string.nullable(),
  finish:string.nullable(),images:z.array(z.unknown()),sources:z.array(z.unknown()),owned:z.boolean(),
  style_fit:z.enum(['strong','partial','weak']),style_reason:string,style_basis:string,
  tier:z.enum(['budget','mid','premium','quality','value','mixed']),tier_basis:string,dimension_basis:string,
});
export const catalogSchema = object({meta:z.record(string,z.unknown()),items:z.record(string,catalogItemSchema)}).superRefine((c,ctx) => {
  for(const [id,f] of Object.entries(c.items)) if(id!==f.id) ctx.addIssue({code:'custom',path:['items',id,'id'],message:'catalog key and id must agree'});
});
// Activity rooms retain source provenance but validate the deciding geometry.
const xy=z.tuple([z.number().finite(),z.number().finite()]);
const optionalRange=pair.optional();
export const activityRoomSchema=object({
 meta:object({version:string,room:string,units:z.literal('inches')}),
 room:object({width_x:positive,depth_y:positive,width_x_unc:nonnegative,depth_y_unc:nonnegative,ceiling_z:positive,shape:z.enum(['polygon','rectangle']).optional(),polygon:z.array(xy).min(3).optional(),open_sides:z.union([string,z.array(string)]).optional()}),
 openings:z.array(object({id:string,wall:z.enum(['north','east','south','west']),type:string,opening_x:optionalRange,opening_y:optionalRange,clear_floor_y:optionalRange,width:positive.optional(),head_height:positive.optional()})),
 fixed:object({banquette:object({west_leg:object({x:pair,y:pair,seat_front_y:pair}),south_leg:object({x:pair,y:pair,seat_front_x:pair}),seat_top_z:positive,back_top_z:positive,back_cushion_thickness:positive,usable_seat_depth_est:positive,usable_seat_depth_unc:nonnegative}) .optional()}).optional(),
 owned:z.record(string,object({label:string,x:optionalRange,y:optionalRange,centre:xy.optional(),diameter:positive.optional(),approx:z.boolean().optional()})),
 wall_items:z.array(object({id:string})),measurements_requested:z.array(string),guides:z.record(string,z.unknown())
}).superRefine((r,c)=>{if(new Set(r.openings.map(o=>o.id)).size!==r.openings.length)c.addIssue({code:'custom',path:['openings'],message:'duplicate opening ids'});for(const [i,o]of r.openings.entries())if(!(o.opening_x||o.opening_y))c.addIssue({code:'custom',path:['openings',i],message:'opening requires its wall range'});});
export const activityBriefSchema=object({meta:object({version:string,room:string}),plain_policy:string,pinned:z.record(string,z.unknown()),activities:z.record(string,z.unknown()),candidate_items:z.record(string,z.union([z.array(string),string])),required:z.record(string,z.unknown()),passage:object({main_route:object({hard_min:positive}),chair_pull_out:object({hard_min:positive}).optional()}),hard_rules:z.array(string),classes:object({invalid:string,conditional:string}),measure_first:z.array(object({what:string,why:string})),pinned_layouts:z.array(object({id:string,label:string,items:string})),ranking:string,plain_text:object({layout_sentence:string,verdict:string})});
export const councilSchema=object({room:z.enum(['kitchen','dining-room','living-room','guest-bedroom']),designer:z.enum(['A','B','C']),layouts:z.array(object({id:string,title:string,summary:string,placements:z.array(object({catalog_id:string,x:z.number().finite(),y:z.number().finite(),rotation:z.union([z.literal(0),z.literal(90),z.literal(180),z.literal(270)]),footprint_w:positive,footprint_d:positive,faces:z.enum(['south','west','north','east']).optional(),shape:string.optional()}))}))});
export function validate(schema,value,file) {
  const result=schema.safeParse(value);
  if(!result.success) throw Error('Invalid '+file+':\n'+result.error.issues.map(e => '  '+(e.path.join('.') || '(root)')+': '+e.message).join('\n'));
  return result.data;
}
export async function loadJSON(file,schema) {
  let value;
  try {value=JSON.parse(await fs.readFile(file,'utf8'));}
  catch(e){throw Error('Cannot load '+file+': '+e.message);}
  return validate(schema,value,file);
}
