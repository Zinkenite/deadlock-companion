export type View={zoom:number;targetZoom:number;x:number;y:number;targetX:number;targetY:number};
export const newView=(zoom=1):View=>({zoom,targetZoom:zoom,x:0,y:0,targetX:0,targetY:0});
export function zoomAt(v:View,z:number,px:number,py:number,w:number,h:number,base:number,min=.5,max=8){const next=Math.max(min,Math.min(max,z)),u=(px-w/2-v.x)/(base*v.zoom),t=(py-h/2-v.y)/(base*v.zoom);v.targetZoom=next;v.targetX=px-w/2-u*base*next;v.targetY=py-h/2-t*base*next;}
export function easeView(v:View,dt:number){const alpha=1-Math.exp(-Math.min(dt,100)/90);v.zoom+=(v.targetZoom-v.zoom)*alpha;v.x+=(v.targetX-v.x)*alpha;v.y+=(v.targetY-v.y)*alpha;const moving=Math.abs(v.zoom-v.targetZoom)>.0005||Math.abs(v.x-v.targetX)>.15||Math.abs(v.y-v.targetY)>.15;if(!moving){v.zoom=v.targetZoom;v.x=v.targetX;v.y=v.targetY;}return moving;}
export function screenPoint(v:View,px:number,py:number,w:number,h:number,base:number){return{x:.5+(px-w/2-v.x)/(base*v.zoom),y:.5+(py-h/2-v.y)/(base*v.zoom)};}
