// Manual asset refresh only. No network work runs in the desktop application.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const endpoint='https://api.deadlock-api.com/v1/assets/heroes';
const response=await fetch(endpoint);if(!response.ok)throw Error('Hero catalogue: '+response.status);
const raw=await response.text(),heroes=JSON.parse(raw);
if(!Array.isArray(heroes)||heroes.length<30)throw Error('Unexpected hero catalogue');
const extractedResponse=await fetch('https://deadlock-data-api.iainfox.dev/heroes');
if(!extractedResponse.ok)throw Error('Game extraction: '+extractedResponse.status);
const extracted=await extractedResponse.json(),canonical=new Map(Object.values(extracted.heroes).map(h=>[h.hero_id,h.display_name]));
await fs.mkdir('public/heroes',{recursive:true});
const result={},sources={},missing=[],failures=[];let cursor=0;
await Promise.all(Array.from({length:4},async()=>{while(cursor<heroes.length){const hero=heroes[cursor++];if(!Number.isInteger(hero.id)||hero.id<=0||typeof hero.name!=='string')continue;
const name=canonical.get(hero.id)||hero.name;result[hero.id]={name};
const candidates=[hero.images?.icon_image_small_webp,hero.images?.icon_image_small,hero.images?.icon_hero_card_webp,hero.images?.icon_hero_card].filter(Boolean);
for(const url of [...new Set(candidates)]){if(new URL(url).hostname!=='assets-bucket.deadlock-api.com')throw Error('Unexpected art host');try{const r=await fetch(url);if(!r.ok)continue;const bytes=Buffer.from(await r.arrayBuffer());const webp=bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP',png=bytes[0]===137&&bytes.subarray(1,4).toString()==='PNG';if(!webp&&!png)continue;const ext=webp?'webp':'png',file=hero.id+'.'+ext;await fs.writeFile('public/heroes/'+file,bytes);result[hero.id].portrait='/heroes/'+file;sources[hero.id]={name,url,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};break;}catch{}}
if(!result[hero.id].portrait){missing.push(hero.id);if(hero.player_selectable)failures.push(hero.id+': '+name);}
}}));
if(failures.length)throw Error('Playable portraits unavailable: '+failures.join(', '));
const ordered=Object.fromEntries(Object.entries(result).sort(([a],[b])=>Number(a)-Number(b)));
await fs.writeFile('src/heroAssets.json',JSON.stringify(ordered,null,2)+'\n');
await fs.writeFile('public/heroes/catalogue-source.json',JSON.stringify({endpoint,retrievedAt:new Date().toISOString(),catalogueSha256:crypto.createHash('sha256').update(raw).digest('hex'),extractedMetadata:extracted._metadata,portraits:sources,missing},null,2)+'\n');
await fs.writeFile('public/heroes/SOURCE.txt','Valve Deadlock artwork, bundled from the community Deadlock API. Artwork belongs to Valve.\nNames and numeric IDs: '+endpoint+'\nCross-checked with https://deadlock-data-api.iainfox.dev/heroes (extracted game data).\nSee catalogue-source.json for capture date, build metadata and image URLs/hashes.\nRefresh manually: node scripts/update-hero-assets.mjs\nNo runtime network requests. Unknown heroes use an ID fallback.\n');
// Remove only superseded hero images from this dedicated generated asset folder.
const keep=new Set(Object.values(ordered).map(h=>h.portrait?.split('/').pop()).filter(Boolean));
for(const name of await fs.readdir('public/heroes'))if(/^\d+\.(png|webp)$/.test(name)&&!keep.has(name))await fs.unlink('public/heroes/'+name);
console.log(Object.keys(ordered).length+' hero names, '+Object.keys(sources).length+' portraits. Missing development-only IDs: '+missing.join(', '));
