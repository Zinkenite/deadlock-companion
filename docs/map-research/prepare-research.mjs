import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),sources=path.join(root,'sources');
const read=n=>JSON.parse(fs.readFileSync(path.join(sources,n),'utf8').replace(/^\uFEFF/,''));
const urls=read('source-urls.json');
const headers={'User-Agent':'Deadlock-Companion-map-research'};
async function get(url){const r=await fetch(url,{headers});if(!r.ok)throw Error(url+' HTTP '+r.status);return Buffer.from(await r.arrayBuffer());}
const revisions={checkedAt:new Date().toISOString()};
for(const[alias,repo]of Object.entries({api:'deadlock-api/deadlock-api',game:'SteamTracking/GameTracking-Deadlock'})){
 const c=JSON.parse(await get('https://api.github.com/repos/'+repo+'/commits/master'));
 revisions[alias]={repo,sha:c.sha,date:c.commit.committer.date};
}
for(const[name,original]of Object.entries(urls)){
 const rev=original.includes('SteamTracking/')?revisions.game:original.includes('raw.githubusercontent.com/deadlock-api/')?revisions.api:null;
 const url=rev?original.replace('/master/','/'+rev.sha+'/'):original;
 fs.writeFileSync(path.join(sources,name),await get(url));urls[name]=url;
}
fs.writeFileSync(path.join(sources,'source-urls.json'),JSON.stringify(urls,null,2));
fs.writeFileSync(path.join(root,'source-revisions.json'),JSON.stringify(revisions,null,2));
const map=read('map-current.json'),icons=read('icons-current.json');
const assets=[];
function walk(obj,prefix){for(const[name,value]of Object.entries(obj)){if(typeof value==='string')assets.push({name:prefix+name,url:value,file:'assets/'+(prefix+name).replaceAll('/','__')});else if(value&&typeof value==='object')walk(value,prefix+name+'/');}}
walk(icons.minimap,'minimap/');
for(const name of ['mid','mid_tunnels','rat_tunnels'])assets.push({name:'map/'+name,url:map.images[name],file:'assets/map-'+name+'.png'});
fs.mkdirSync(path.join(root,'assets'),{recursive:true});
let cursor=0;
await Promise.all(Array.from({length:5},async()=>{while(cursor<assets.length){const a=assets[cursor++];try{const bytes=await get(a.url);fs.writeFileSync(path.join(root,a.file),bytes);Object.assign(a,{status:'saved',bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}catch(e){a.status='unavailable';a.error=String(e);}}}));
const localIcon=name=>assets.find(a=>a.name==='minimap/'+name&&a.status==='saved')?.file??null;
const point=p=>({x:.5+p[0]/(2*map.radius),y:.5-p[1]/(2*map.radius)});
const markers=[];
const source=fs.readFileSync(path.join(sources,'city-never-sleeps.rs'),'utf8');
const re=/ObjectiveSource\s*\{\s*key:\s*"([^"]+)",\s*source:\s*"([^"]+)",\s*name:\s*"([^"]*)",\s*position:\s*\[([^\]]+)\]/g;
for(const match of source.matchAll(re)){
 const[id,entityClass,entityName]=match.slice(1,4),world=match[4].split(',').map(Number);
 const category=id.includes('_core')?'base_spawn_area':id.includes('_titan')?'patron':id.includes('_tier2')?'walker':'guardian_reference';
 const glyph=category==='walker'?'objective_icon_t2.svg':category==='guardian_reference'?'objective_icon_t1.svg':category==='patron'?'boss_health_final_psd.png':null;
 markers.push({id,category,label:id.replaceAll('_',' '),...point(world),world,team:Number(id[4]),entityClass,entityName,icon:glyph?localIcon(glyph):null,source:'sources/city-never-sleeps.rs',apiTopLeft:map.objective_positions[id],placementNote:category==='base_spawn_area'?'Spawn centroid; not a separate building.':category==='guardian_reference'?'API source uses info_super_trooper_spawn as the lane-guardian reference; confirm against actual guardian entity before claiming exact building center.':'World-space entity reference.'});
}
for(const c of map.neutral_camps)markers.push({id:'camp/'+c.name,category:'camp_'+c.kind,label:c.name.replaceAll('_',' '),...point(c.position),world:c.position,icon:localIcon(path.basename(c.icon)),source:'sources/map-current.json#/neutral_camps'});
const glyphs={shops:'minimap_shop_psd.png',teleporters:'minimap_teleporter_go_right.svg',bridge_buffs:'gold_crate_marker_psd.png',soul_urn_spawns:'soul_jar_marker_psd.png',soul_urn_pads:'soul_jar_marker_return_psd.png',unstable_rifts:'minimap_icon_koth.png'};
for(const[category,list]of Object.entries(map.entities))list.forEach((e,i)=>markers.push({id:category+'/'+i,category,label:category.replaceAll('_',' ')+(e.kind?' · '+e.kind:''),...point(e.position),world:e.position,team:e.team,kind:e.kind,targetWorld:e.target,target:e.target?point(e.target):undefined,icon:glyphs[category]?localIcon(glyphs[category]):null,source:'sources/map-current.json#/entities/'+category}));
const counts=Object.fromEntries([...new Set(markers.map(m=>m.category))].map(c=>[c,markers.filter(m=>m.category===c).length]));
const unresolved=[{category:'Mid Boss',icon:localIcon('super_neutral_marker_psd.png'),reason:'Explicitly excluded from neutral_camps; endpoint supplies no position. Extract current map entity; do not assume exact image center.'},{category:'Shrines and base guardians',reason:'Separate structure positions are absent. API core means spawn centroid; it must not be renamed shrine or weakened Patron.'},{category:'Stairs and tunnel entrances',icons:[localIcon('icon_stairs.svg'),localIcon('icon_stairs_mid.svg')],reason:'Genuine icons are available; precise entrance locations and tunnel topology are absent.'},{category:'Broker and mode objectives',reason:'Current HUD includes Broker and escort glyphs; verify mode, state and position before displaying them.'},{category:'Heroes, troopers, summons, dropped souls, carried urn, Rejuvenator and pings',reason:'These have dynamic positions. Need current visible observations or manual input; fixed spawn references cannot supply them.'}];
const catalog={checkedAt:revisions.checkedAt,buildEvidence:fs.readFileSync(path.join(sources,'steam.inf'),'utf8').trim(),radius:map.radius,orientation:'north up; world +X right, world +Y up',formula:{x:'0.5 + worldX/(2*radius)',y:'0.5 - worldY/(2*radius)'},counts,markers,ziplinePaths:map.zipline_paths,unresolved,limitations:['API is an unversioned snapshot; tracked game build does not prove every API point was re-extracted for that build.','Every marker is a static reference; alive, available, cleared and respawn states are unknown.','Entity origins can differ from visual centers or trigger extents.','Z height is retained; height alone cannot reliably select a tunnel layer.','Six urn spawn points are possible locations, not six simultaneous urns.','Only one base-shop record exists in this response; a missing counterpart is unresolved.','API lane-guardian references come from super-trooper spawns, not an explicit guardian entity.']};
for(const m of markers){if(!Number.isFinite(m.x)||!Number.isFinite(m.y)||m.x<0||m.x>1||m.y<0||m.y>1)throw Error('Out-of-bounds '+m.id);if(m.icon&&!fs.existsSync(path.join(root,m.icon)))throw Error('Missing icon '+m.id);}
if(new Set(markers.map(m=>m.id)).size!==markers.length)throw Error('Duplicate ID');
if(markers.filter(m=>m.category.startsWith('camp_')).length!==map.neutral_camps.length)throw Error('Camp coverage mismatch');
for(const p of ['marker-catalog.json','asset-manifest.json'])fs.writeFileSync(path.join(root,p),JSON.stringify(p==='marker-catalog.json'?catalog:{checkedAt:revisions.checkedAt,assets},null,2));
const validation={checkedAt:new Date().toISOString(),markerCount:markers.length,counts,ziplineCount:map.zipline_paths.length,savedAssets:assets.filter(a=>a.status==='saved').length,failedAssets:assets.filter(a=>a.status!=='saved').map(a=>a.name),checks:['unique IDs','finite coordinates within map bounds','complete supplied camp coverage','all assigned icons exist locally'],mapMatchesApp:fs.readFileSync(path.join(root,'../../public/map-metadata.json')).equals(fs.readFileSync(path.join(sources,'map-current.json')))};
fs.writeFileSync(path.join(root,'validation.json'),JSON.stringify(validation,null,2));
console.log(JSON.stringify(validation));
