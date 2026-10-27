import {describe,it,expect} from 'vitest';
import {newView,zoomAt,easeView,screenPoint} from '../src/view';
import {decodeCapture} from '../src/screen';
import {parseHud} from '../src/ocr';
describe('smooth camera',()=>{
 it('keeps the cursor map point fixed during zoom easing',()=>{const v=newView(),before=screenPoint(v,200,130,800,500,450);zoomAt(v,3,200,130,800,500,450);expect(v.zoom).toBe(1);expect(v.targetZoom).toBe(3);for(let i=0;i<12;i++){easeView(v,16);const p=screenPoint(v,200,130,800,500,450);expect(p.x).toBeCloseTo(before.x,8);expect(p.y).toBeCloseTo(before.y,8);}expect(v.zoom).toBeGreaterThan(1);expect(v.zoom).toBeLessThan(3);});
 it('converges and clamps target zoom',()=>{const v=newView();zoomAt(v,100,400,250,800,500,450,.5,8);for(let i=0;i<100;i++)easeView(v,16);expect(v.zoom).toBe(8);expect(easeView(v,16)).toBe(false);});
});
describe('preview transport',()=>{
 it('decodes binary pixels without a large JSON pixel array',()=>{const bytes=new ArrayBuffer(16),header=new DataView(bytes);header.setUint32(0,2,true);header.setUint32(4,1,true);new Uint8Array(bytes,8).set([1,2,3,255,4,5,6,255]);const f=decodeCapture(bytes);expect(f.width).toBe(2);expect(f.height).toBe(1);expect(Array.from(f.rgba)).toEqual([1,2,3,255,4,5,6,255]);});
 it('rejects invalid or truncated captures',()=>{expect(()=>decodeCapture(new ArrayBuffer(1))).toThrow();const b=new ArrayBuffer(8);new DataView(b).setUint32(0,90000,true);expect(()=>decodeCapture(b)).toThrow();});
});
describe('ambiguous timer glyphs',()=>{
 it('normalizes O/I/l within clock text',()=>{expect(parseHud('timer','O7:O9')).toEqual({timer:429});expect(parseHud('timer','TIME 07:09')).toBeUndefined();});
});
