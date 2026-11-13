import {describe,it,expect} from 'vitest';
import {newerStable} from '../src/Updates';
describe('stable release comparison',()=>{
 it('compares numeric components',()=>{
  expect(newerStable('v0.10.0','0.9.9')).toBe(true);
  expect(newerStable('1.0.0','0.99.99')).toBe(true);
  expect(newerStable('0.5.0','0.5.0')).toBe(false);
  expect(newerStable('0.4.9','0.5.0')).toBe(false);
 });
 it('ignores build metadata and rejects prereleases or malformed tags',()=>{
  expect(newerStable('1.0.0+build.2','1.0.0')).toBe(false);
  for(const tag of ['1.0.0-beta.1','banana','01.0.0','999999999999999999999.0.0'])
   expect(newerStable(tag,'0.5.0')).toBe(false);
 });
});
