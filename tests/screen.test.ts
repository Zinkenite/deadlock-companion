import {describe,it,expect} from 'vitest';
import {MarkerTracker,parseColor,sceneDifference,orientMapPoint} from '../src/screen';
import {validate,sample} from '../src/readings';
const candidate=(x:number,y:number)=>({x,y,pixels:9,quality:.9});
describe('screen tracker',()=>{
 it('corrects map orientation without inventing XYZ',()=>{const p=orientMapPoint({x:.2,y:.3},180);expect(p.x).toBeCloseTo(.8);expect(p.y).toBeCloseTo(.7);});
 it('requires three consistent frames before emitting a position',()=>{const t=new MarkerTracker({x:.5,y:.5});expect(t.update([candidate(.5,.5)],0).point).toBeUndefined();expect(t.update([candidate(.51,.5)],200).point).toBeUndefined();expect(t.update([candidate(.52,.5)],400).point?.x).toBe(.52);});
 it('refuses equal competing markers rather than choosing one',()=>{const t=new MarkerTracker({x:.5,y:.5});for(let now=0;now<2000;now+=200)expect(t.update([candidate(.45,.5),candidate(.55,.5)],now).point).toBeUndefined();});
 it('rejects a sudden large jump and can reacquire a unique marker after timeout',()=>{const t=new MarkerTracker({x:.2,y:.2});for(const now of [0,200,400])t.update([candidate(.2,.2)],now);expect(t.update([candidate(.9,.9)],600).point).toBeUndefined();expect(t.update([candidate(.9,.9)],4000).point).toBeUndefined();expect(t.update([candidate(.9,.9)],4200).point).toBeUndefined();expect(t.update([candidate(.9,.9)],4400).point?.x).toBe(.9);});
 it('requires confirmation again after tracking is lost',()=>{const t=new MarkerTracker({x:.5,y:.5});for(const now of [0,200,400])t.update([candidate(.5,.5)],now);t.lose();expect(t.update([candidate(.5,.5)],800).point).toBeUndefined();});
 it('rejects missing or malformed reference signatures',()=>{expect(sceneDifference([],[])).toBe(Infinity);expect(sceneDifference(Array(144).fill(10),Array(144).fill(20))).toBe(10);expect(sceneDifference(Array(144).fill(NaN),Array(144).fill(0))).toBe(Infinity);});
 it('validates colour and normalized map coordinates separately from XYZ',()=>{expect(parseColor('#f4df96')).toEqual([244,223,150]);expect(()=>parseColor('wrong')).toThrow();expect(validate({mapPosition:sample({x:1.2,y:.5})})).toEqual({});expect(validate({mapPosition:sample({x:.2,y:.3})}).mapPosition?.value).toEqual({x:.2,y:.3});});
});
