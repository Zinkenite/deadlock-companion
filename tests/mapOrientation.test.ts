import {describe,it,expect} from 'vitest';
import {rotateMapPoint,sidePoint,sideFacing,sideRotation} from '../src/mapOrientation';
import {alignPoint,pinPoint,defaultCapture} from '../src/screen';
import {compassPois,defaultCompass} from '../src/compass';
import {migrateSettings} from '../src/store';
describe('map sides',()=>{
 it('keeps Hidden King unchanged and flips Arch Mother exactly 180 degrees',()=>{const p={x:.2,y:.7};expect(sidePoint(p,'hiddenKing')).toEqual(p);expect(sidePoint(p,'archMother').x).toBeCloseTo(.8);expect(sidePoint(p,'archMother').y).toBeCloseTo(.3);expect(sidePoint(sidePoint(p,'archMother'),'archMother').x).toBeCloseTo(p.x);expect(sideFacing(270,'archMother')).toBe(90);});
 it('projects and unprojects positions throughout the rotation animation',()=>{const p={x:.16,y:.83};for(const angle of [0,20,90,134,180]){const restored=rotateMapPoint(rotateMapPoint(p,angle),-angle);expect(restored.x).toBeCloseTo(p.x);expect(restored.y).toBeCloseTo(p.y);}});
 it('keeps the observed minimap position aligned with either displayed side',()=>{const raw={x:.3,y:.8};for(const side of ['hiddenKing','archMother']as const){const shown=rotateMapPoint(sidePoint(raw,side),sideRotation(side));expect(shown.x).toBeCloseTo(raw.x);expect(shown.y).toBeCloseTo(raw.y);}});
 it('calibrates a clicked location correctly on either side',()=>{const raw={x:.3,y:.4},target={x:.7,y:.6};for(const side of ['hiddenKing','archMother']as const){const config={...defaultCapture,alignment:pinPoint(raw,sidePoint(target,side),defaultCapture)};const canonical=sidePoint(alignPoint(raw,config)!,side);expect(canonical.x).toBeCloseTo(target.x);expect(canonical.y).toBeCloseTo(target.y);}});
 it('keeps compass distances and bearings identical for the same world pose',()=>{const point={x:.5,y:.6},heading=0,catalog={radius:10000,checkedAt:'test',build:'test',markers:[{id:'camp',category:'camp_medium' as const,label:'Camp',x:.5,y:.55,icon:null}]},packet={settings:defaultCompass,positionAt:0,tracking:true,performance:false};const expected=compassPois(catalog,packet,point,heading)[0];const actual=compassPois(catalog,packet,sidePoint(sidePoint(point,'archMother'),'archMother'),sideFacing(heading+180,'archMother'))[0];expect(actual.distance).toBeCloseTo(expected.distance);expect(actual.x).toBeCloseTo(expected.x);});
 it('defaults old settings to Hidden King and preserves a saved Arch Mother selection',()=>{expect(migrateSettings({settings:{}}).mapSide).toBe('hiddenKing');expect(migrateSettings({settings:{mapSide:'archMother'}}).mapSide).toBe('archMother');});
});
