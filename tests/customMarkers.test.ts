import {it,expect} from 'vitest';
import {sanitizeCustomMarkers} from '../src/customMarkerData';
import {markerSpawnSeconds} from '../src/map';
import {compassPois,defaultCompass} from '../src/compass';
const marker={id:'custom-test',category:'custom' as const,label:'My marker',icon:'data:image/png;base64,AAAA',x:.5,y:.48,spawnSeconds:120};
it('retains uploaded marker data and rejects invalid saved markers',()=>{expect(sanitizeCustomMarkers([marker])).toEqual([marker]);expect(sanitizeCustomMarkers([marker,marker,{...marker,id:'custom-invalid',x:2},{...marker,id:'custom-url',icon:'https://example.com/a.png'}])).toEqual([marker]);expect(markerSpawnSeconds(marker)).toBe(120);});
it('desaturates custom markers before spawn without reducing opacity',()=>{const c={radius:10000,checkedAt:'test',build:'test',markers:[]},p={settings:defaultCompass,customMarkers:[marker],positionAt:0,tracking:true,performance:false},position={x:.5,y:.5};const poi=(timer?:number)=>compassPois(c,{...p,timer},position,0)[0];expect(poi(119).alpha).toBe(poi(120).alpha);expect(poi(119).desaturated).toBe(true);expect(poi(120).desaturated).toBe(false);expect(poi().desaturated).toBe(false);});
