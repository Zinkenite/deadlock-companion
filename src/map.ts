export const mapGroups = [
 {id:'objectives',label:'Objectives'}, {id:'camps',label:'Camps'},
 {id:'events',label:'Shops & events'}, {id:'movement',label:'Movement'}, {id:'loot',label:'Loot'},
] as const;
export type MapGroup = typeof mapGroups[number]['id'];
export type MapIconSizes = Record<MapGroup,number>;
export const defaultMapIconSizes=Object.fromEntries(mapGroups.map(group=>[group.id,20])) as MapIconSizes;
export function migrateMapIconSizes(saved:unknown,fallback=20):MapIconSizes {
 const raw=saved&&typeof saved==='object'?saved as Record<string,unknown>:{};
 return Object.fromEntries(mapGroups.map(group=>{const value=raw[group.id];return [group.id,typeof value==='number'&&Number.isFinite(value)?Math.max(12,Math.min(32,value)):fallback];})) as MapIconSizes;
}
export const mapLayerInfo = {
 patron:{label:'Patrons',group:'objectives',on:true},walker:{label:'Walkers',group:'objectives',on:true},
 guardian_reference:{label:'Guardians',group:'objectives',on:true},base_sentries:{label:'Base sentries',group:'objectives',on:true},base_spawn_area:{label:'Base spawn areas',group:'objectives',on:false},
 camp_weak:{label:'Small camps',group:'camps',on:true},camp_medium:{label:'Medium camps',group:'camps',on:true},camp_strong:{label:'Large camps',group:'camps',on:true},camp_vault:{label:"Sinner's Sacrifice",group:'camps',on:true},
 shops:{label:'Shops',group:'events',on:true},bridge_buffs:{label:'Bridge buffs',group:'events',on:true},teleporters:{label:'Teleporters',group:'events',on:true},soul_urn_spawns:{label:'Possible urn spawns',group:'events',on:false},soul_urn_pads:{label:'Urn delivery pads',group:'events',on:true},unstable_rifts:{label:'Possible rift spawns',group:'events',on:true},
 ziplines:{label:'Ziplines',group:'movement',on:true},bounce_pads:{label:'Bounce pads',group:'movement',on:false},climb_ropes:{label:'Climb ropes',group:'movement',on:false},steam_vents:{label:'Steam vents',group:'movement',on:false},cosmic_veils:{label:'Cosmic veils',group:'movement',on:false},
 golden_statues:{label:'Golden statues',group:'loot',on:false},crates:{label:'Crates',group:'loot',on:false},tough_crates:{label:'Tough crates',group:'loot',on:false},healing_snacks:{label:'Healing snacks',group:'loot',on:false},bells:{label:'Bell Tower bells',group:'loot',on:false},
} as const satisfies Record<string,{label:string;group:MapGroup;on:boolean}>;
export type MapLayer = keyof typeof mapLayerInfo;
export type MapLayers = Record<MapLayer,boolean>;
export type MapLevel = 'street'|'mid_tunnels'|'rat_tunnels';
export const layerKeys=Object.keys(mapLayerInfo) as MapLayer[];
export const defaultMapLayers=Object.fromEntries(layerKeys.map(key=>[key,mapLayerInfo[key].on])) as MapLayers;
export function migrateMapLayers(saved:unknown):MapLayers {
 const raw=saved&&typeof saved==='object'?saved as Record<string,unknown>:{};
 return Object.fromEntries(layerKeys.map(key=>[key,typeof raw[key]==='boolean'?raw[key]:defaultMapLayers[key]])) as MapLayers;
}
export type MapMarker={id:string;category:Exclude<MapLayer,'ziplines'>;label:string;x:number;y:number;height?:number;team?:number;kind?:string;target?:{x:number;y:number};icon:string|null;note?:string};
export type MapCatalog={checkedAt:string;radius:number;build:string;markers:MapMarker[]};
export function readMapCatalog(raw:unknown):MapCatalog {
 const data=raw as MapCatalog;
 if(!data||!Array.isArray(data.markers)||!Number.isFinite(data.radius)||data.radius<=0||typeof data.checkedAt!=='string')throw Error('Invalid map catalog');
 const ids=new Set<string>();
 for(const m of data.markers){if(!m||typeof m.id!=='string'||ids.has(m.id)||!Object.hasOwn(mapLayerInfo,m.category)||String(m.category)==='ziplines'||typeof m.label!=='string'||!Number.isFinite(m.x)||!Number.isFinite(m.y)||m.x<0||m.x>1||m.y<0||m.y>1||(m.icon!==null&&(typeof m.icon!=='string'||!/^\/map-assets\/[\w.-]+\.(png|svg)$/.test(m.icon))))throw Error('Invalid map marker');ids.add(m.id);}
 return data;
}
export const layerTitle=(key:MapLayer)=>mapLayerInfo[key].label;
export function markerTitle(m:MapMarker){
 if(m.category==='shops')return m.kind==='secret'?'Secret shop':m.kind==='base'?'Base shop':'Lane shop';
 if(m.category==='camp_weak')return 'Small camp';
 if(m.category==='camp_medium')return 'Medium camp';
 if(m.category==='camp_strong')return 'Large camp';
 if(m.category==='camp_vault')return "Sinner's Sacrifice";
 return layerTitle(m.category);
}
const spawnTimes:Partial<Record<MapMarker['category'],number>>={camp_weak:120,camp_medium:300,camp_strong:480,camp_vault:480};
export function markerSpawnSeconds(m:MapMarker){return spawnTimes[m.category];}
export function formatMapTime(seconds:number){const whole=Math.floor(seconds);return Math.floor(whole/60)+':'+String(whole%60).padStart(2,'0');}
export const markerDetail=(m:MapMarker)=>m.category.startsWith('camp_')?m.label.replace(/\bcamp\b/g,'').replace(/\s+/g,' ').trim():m.category==='base_spawn_area'?'Base area · spawn reference':m.category==='guardian_reference'?'Lane reference · guardian position':m.target?'Destination shown on hover':m.icon?'Fixed map location':'Companion map symbol';
export function markerColor(m:MapMarker){
 if(m.team!==undefined)return m.team===0?'#dfc387':'#8bc2df';
 const group=mapLayerInfo[m.category].group;
 return group==='loot'?'#dec777':group==='movement'?'#85c4bc':group==='camps'?'#b8d99e':'#dbc9a0';
}



