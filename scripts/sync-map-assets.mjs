import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd(),research=path.join(root,'docs/map-research');
const catalog=JSON.parse(fs.readFileSync(path.join(research,'marker-catalog.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(research,'asset-manifest.json'),'utf8'));
const out=path.join(root,'public/map-assets');fs.mkdirSync(out,{recursive:true});
const used=new Set(catalog.markers.map(m=>m.icon).filter(Boolean));
for(const file of ['assets/map-mid.png','assets/map-mid_tunnels.png','assets/map-rat_tunnels.png'])used.add(file);
const saved=[];
for(const file of used){const a=manifest.assets.find(a=>a.file===file&&a.status==='saved');if(!a)throw Error('Unverified asset '+file);const bytes=fs.readFileSync(path.join(research,file));const hash=crypto.createHash('sha256').update(bytes).digest('hex');if(hash!==a.sha256)throw Error('Asset hash mismatch '+file);const name=path.basename(file);fs.writeFileSync(path.join(out,name),bytes);saved.push({file:'/map-assets/'+name,source:a.url,sha256:hash});}
const markers=catalog.markers.map(m=>({id:m.id,category:m.category,label:m.label,x:m.x,y:m.y,height:m.world[2],team:m.team,kind:m.kind,target:m.target,icon:m.icon?'/map-assets/'+path.basename(m.icon):null,note:m.placementNote}));
if(markers.length!==913||new Set(markers.map(m=>m.id)).size!==markers.length)throw Error('Catalog coverage changed; review before updating');
for(const m of markers)if(!Number.isFinite(m.x)||!Number.isFinite(m.y)||m.x<0||m.x>1||m.y<0||m.y>1)throw Error('Invalid point '+m.id);
fs.writeFileSync(path.join(root,'public/map-markers.json'),JSON.stringify({checkedAt:catalog.checkedAt,radius:catalog.radius,build:'6821',markers}));
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({checkedAt:catalog.checkedAt,sourceRevisions:JSON.parse(fs.readFileSync(path.join(research,'source-revisions.json'),'utf8')),assets:saved,limitations:catalog.limitations},null,2));
console.log('Integrated '+markers.length+' checked reference points and '+saved.length+' verified map/icon files.');
