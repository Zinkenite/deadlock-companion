import {describe,it,expect} from 'vitest';
import {parseHud,ReadingGate} from '../src/ocr';
import {validate,sample,fresh} from '../src/readings';
import {migrateSettings,useMatch} from '../src/store';
import {alignPoint,pinPoint,defaultCapture,defaultAlignment} from '../src/screen';
describe('HUD values',()=>{
 it('reads the clock exactly and rejects impossible times',()=>{expect(parseHud('timer','07:09')).toEqual({timer:429});expect(parseHud('timer','1:02:03')).toEqual({timer:3723});expect(parseHud('timer','07:99')).toBeUndefined();expect(parseHud('timer','7.09')).toEqual({timer:429});expect(parseHud('timer','0709')).toEqual({timer:429});});
 it('refreshes reliable readings immediately and confirms a new match clock',()=>{const gate=new ReadingGate();expect(gate.accept({timer:600},1000)).toEqual({timer:600});expect(gate.accept({timer:601},2000)).toEqual({timer:601});expect(gate.accept({timer:0},3000)).toEqual({});expect(gate.accept({timer:1},4000)).toEqual({timer:1});});
 it('recovers from missed OCR frames without consecutive confirmations',()=>{const gate=new ReadingGate();gate.accept({timer:600},1000);gate.reject('timer');expect(gate.accept({timer:602},3000)).toEqual({timer:602});gate.reject('timer');expect(gate.accept({timer:604},5000)).toEqual({timer:604});});
 it('rejects isolated jumps and old observations, but can recover from an incorrect initial read',()=>{const gate=new ReadingGate();gate.accept({timer:600},1000);expect(gate.accept({timer:1601},2000)).toEqual({});expect(gate.accept({timer:602},3000)).toEqual({timer:602});expect(gate.accept({timer:603},2000)).toEqual({});expect(gate.accept({timer:302},8500)).toEqual({});expect(gate.accept({timer:303},9500)).toEqual({timer:303});});
 it('rejects unsupported source fields and malformed samples',()=>{expect(validate(null)).toEqual({});expect(validate({position:{value:{x:0,y:0,z:0},at:Date.now()},alive:{value:true,at:Date.now()}})).toEqual({});expect(validate({souls:sample(-1)})).toEqual({});expect(fresh(sample(1,100),4000)).toBe(false);});
});
describe('manual position alignment',()=>{
 it('pins a known observation to the clicked map location',()=>{const raw={x:.25,y:.6},target={x:.4,y:.5};const config={...defaultCapture,alignment:{...defaultAlignment,scaleX:1.1,rotation:12}};const alignment=pinPoint(raw,target,config);const mapped=alignPoint(raw,{...config,alignment})!;expect(mapped.x).toBeCloseTo(target.x);expect(mapped.y).toBeCloseTo(target.y);});
 it('rejects out-of-map calibrated points instead of clipping them to an edge',()=>{expect(alignPoint({x:.9,y:.9},{...defaultCapture,alignment:{...defaultAlignment,offsetX:.3}})).toBeUndefined();});
});
describe('screen-only settings and recording',()=>{
 it('migrates a legacy profile without retaining provider or world bounds',()=>{const s=migrateSettings({settings:{provider:'demo',calibration:{minX:1},capture:{configured:true,color:'#ffcc00'}}});expect(s.readingEnabled).toBe(false);expect(s.capture.configured).toBe(true);expect(s.capture.alignment.scaleX).toBe(1);expect(s.capture.textRegions).toEqual({});expect(s).not.toHaveProperty('provider');expect(s).not.toHaveProperty('calibration');});
 it('preserves field timestamps on missing or older updates',()=>{useMatch.getState().clear();const now=Date.now();useMatch.getState().ingest({timer:sample(500,now),mapPosition:sample({x:.5,y:.5},now)});useMatch.getState().ingest({timer:sample(100,now-500)});expect(useMatch.getState().data.timer?.value).toBe(500);expect(useMatch.getState().data.mapPosition?.at).toBe(now);});
});