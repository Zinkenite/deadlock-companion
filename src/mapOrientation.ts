import type {MapPoint} from './readings';
export type MapSide='hiddenKing'|'archMother';
export const sideRotation=(side:MapSide)=>side==='archMother'?180:0;
export function sidePoint(point:MapPoint,side:MapSide):MapPoint{return side==='archMother'?{x:1-point.x,y:1-point.y}:point;}
export const sideFacing=(heading:number,side:MapSide)=>(heading+sideRotation(side)+360)%360;
export function rotateMapPoint(point:MapPoint,degrees:number):MapPoint{const angle=((degrees%360)+360)%360;if(angle===0)return point;if(angle===180)return{x:1-point.x,y:1-point.y};const radians=angle*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians),x=point.x-.5,y=point.y-.5;return{x:.5+x*c-y*s,y:.5+x*s+y*c};}
