import {rotateMapPoint,sideRotation} from './mapOrientation';
import {createIconCache,desaturatedColor} from './iconArt';
import {iconStyle} from './iconSettings';
import {useEffect,useRef,useState} from 'react';
import {LocateFixed,Maximize,Plus,Minus,Layers,RotateCw} from 'lucide-react';
import {useMatch,useSettings,type Settings} from './store';
import {fresh,type MapPoint} from './readings';
import {alignPoint,markerFacing,useCapture,type CaptureSettings} from './screen';
import {newView,zoomAt,easeView,screenPoint} from './view';
import {mapLayerInfo,markerColor,markerDetail,markerTitle,markerSpawnSeconds,formatMapTime,readMapCatalog,type MapCatalog,type MapMarker} from './map';
import MapLayersPanel from './MapLayersPanel';

type Meta={radius:number;zipline_paths:{origin:number[];color:string;P0_points:number[][]}[]};
type Hit={marker:MapMarker;x:number;y:number;radius:number};
type Tip={marker:MapMarker;x:number;y:number};
export type MapCalibration={config:CaptureSettings;raw:MapPoint};
export default function MapRenderer({calibration,onPin}:{calibration?:MapCalibration;onPin?:(target:MapPoint)=>void}){
 const canvas=useRef<HTMLCanvasElement>(null),view=useRef(newView()),follow=useRef(false),drag=useRef<{x:number;y:number;pin:boolean}|undefined>(undefined),space=useRef(false),props=useRef({calibration,onPin});props.current={calibration,onPin};
 const hits=useRef<Hit[]>([]),hover=useRef<MapMarker|undefined>(undefined),menu=useRef<HTMLDivElement>(null),layerButton=useRef<HTMLButtonElement>(null);
 const [zoom,setZoom]=useState(1),[catalog,setCatalog]=useState<MapCatalog>(),[layersOpen,showLayers]=useState(false),[tip,setTip]=useState<Tip>(),[mapError,setMapError]=useState('');
 const [placing,setPlacing]=useState<string>();
 const customMarkers=useSettings(s=>s.settings.customMarkers);
 const level=useSettings(s=>s.settings.mapLevel),side=useSettings(s=>s.settings.mapSide),turn=useRef({angle:sideRotation(side),from:sideRotation(side),to:sideRotation(side),started:0});
 const base=(w:number,h:number)=>Math.max(20,Math.min(w-36,h-30));
 const clearTip=()=>{hover.current=undefined;setTip(undefined);};
 const changeZoom=(z:number,px?:number,py?:number)=>{const r=canvas.current!.getBoundingClientRect();follow.current=false;clearTip();zoomAt(view.current,z,px??r.width/2,py??r.height/2,r.width,r.height,base(r.width,r.height),.5,8);setZoom(view.current.targetZoom);};
 const closeLayers=()=>{showLayers(false);layerButton.current?.focus();};
 useEffect(()=>{if(!layersOpen)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setPlacing(undefined);showLayers(false);layerButton.current?.focus();}};document.addEventListener('keydown',key);return()=>document.removeEventListener('keydown',key);},[layersOpen]); useEffect(()=>{
  const el=canvas.current!,prevent=(e:WheelEvent)=>e.preventDefault();el.addEventListener('wheel',prevent,{passive:false});view.current=newView(useSettings.getState().settings.zoom);setZoom(view.current.zoom);
  const key=(e:KeyboardEvent)=>{if(e.code==='Space'&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLSelectElement)&&!(e.target instanceof HTMLButtonElement)&&!(e.target instanceof HTMLTextAreaElement)){space.current=e.type==='keydown';if(space.current)e.preventDefault();}};
  const blur=()=>{space.current=false;drag.current=undefined;};window.addEventListener('keydown',key);window.addEventListener('keyup',key);window.addEventListener('blur',blur);
  return()=>{el.removeEventListener('wheel',prevent);window.removeEventListener('keydown',key);window.removeEventListener('keyup',key);window.removeEventListener('blur',blur);};
 },[]);
 useEffect(()=>{
  const el=canvas.current!,output=el.getContext('2d')!,images=new Map<string,HTMLImageElement>(),controller=new AbortController();let meta:Meta|undefined,data:MapCatalog|undefined,frame=0,lastPaint=0,lastFrame=performance.now(),active=true,assetVersion=0,layer:HTMLCanvasElement|undefined,layerKey='',lastKeys:unknown[]=[],displayedFacing:number|undefined;
  let ctx=output,scene:HTMLCanvasElement|undefined,sceneKeys:unknown[]=[],sceneHits:Hit[]=[],thresholds:number[]=[],customSource:unknown,dataSource:unknown;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const icons=createIconCache(()=>{assetVersion++;});
  const image=(src:string)=>{let img=images.get(src);if(!img){img=new Image();img.onload=()=>{assetVersion++;};img.onerror=()=>{assetVersion++;};img.src=src;images.set(src,img);}return img;};
  image('/map-assets/map-mid.png');image('/map-assets/map-mid_tunnels.png');image('/map-assets/map-rat_tunnels.png');
  const load=async()=>{try{const fetchJson=async(url:string)=>{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw Error('Map file unavailable');return r.json();};const [raw,geometry]=await Promise.all([fetchJson('/map-markers.json'),fetchJson('/map-metadata.json')]);const parsed=readMapCatalog(raw);if(!active)return;data=parsed;meta=geometry;data.markers.sort((a,b)=>priority(a)-priority(b));for(const m of data.markers)if(m.icon)image(m.icon);setCatalog(data);assetVersion++;}catch(e){if(active)setMapError('Map references could not load. Restart the app to retry.');}};
  const priority=(m:MapMarker)=>({loot:0,movement:1,events:2,camps:3,objectives:4,custom:5})[mapLayerInfo[m.category].group];
  void load();
  const staticLayer=(s:Settings)=>{
   const key=s.mapLevel+':'+s.mapLayers.ziplines+':'+assetVersion;if(layer&&layerKey===key)return layer;
   const c=document.createElement('canvas');c.width=c.height=1024;const g=c.getContext('2d')!;
   const street=image('/map-assets/map-mid.png');g.filter='brightness(3.6)';if(street.naturalWidth)g.drawImage(street,0,0,1024,1024);
   if(s.mapLevel!=='street'){const tunnel=image('/map-assets/map-'+s.mapLevel+'.png');if(tunnel.naturalWidth){g.globalAlpha=.8;g.drawImage(tunnel,0,0,1024,1024);g.globalAlpha=1;}}g.filter='none';
   if(meta&&s.mapLayers.ziplines){for(const lane of meta.zipline_paths){g.strokeStyle=lane.color+'80';g.lineWidth=2;g.beginPath();lane.P0_points.forEach((p,i)=>{const x=(.5+(p[0]+lane.origin[0])/(2*meta!.radius))*1024,y=(.5-(p[1]+lane.origin[1])/(2*meta!.radius))*1024;i?g.lineTo(x,y):g.moveTo(x,y);});g.stroke();}}
   layer=c;layerKey=key;return c;
  };
  const draw=(now:number)=>{
   if(!active)return;frame=requestAnimationFrame(draw);if(!el.clientWidth||!el.clientHeight)return;const s=useSettings.getState().settings,state=useMatch.getState(),current=props.current,p=state.data.mapPosition,observed=useCapture.getState();
   let point=current.calibration?alignPoint(current.calibration.raw,current.calibration.config):p&&observed.rawPoint&&observed.rawAt===p.at?alignPoint(observed.rawPoint,s.capture):p?.value;
   const isFresh=fresh(p),isLive=!!current.calibration||isFresh&&state.status==='tracking',timerSample=state.data.timer,timerValue=timerSample?.value,directionConfig=current.calibration?.config??s.capture,targetFacing=markerFacing(observed.facing??0,directionConfig);
   if(!current.calibration&&point&&p&&state.previousMapPosition&&s.animations&&isFresh&&state.status==='tracking'){const a=state.previousMapPosition.value,t=Math.max(0,Math.min(1,(Date.now()-p.at)/200));point={x:a.x+(point.x-a.x)*t,y:a.y+(point.y-a.y)*t};}
   const target=sideRotation(s.mapSide),rotation=turn.current;if(rotation.to!==target){rotation.from=rotation.angle;rotation.to=target;rotation.started=now;}const progress=Math.min(1,(now-rotation.started)/550),turning=progress<1&&rotation.angle!==target;rotation.angle=s.animations&&!reducedMotion.matches?rotation.from+(rotation.to-rotation.from)*(1-Math.pow(1-progress,3)):target;const angle=rotation.angle;
   // Keep the observed player steady while the world rotates beneath it.
   if(point)point=rotateMapPoint(point,-angle);
   const r=el.getBoundingClientRect(),w=r.width,h=r.height,fit=base(w,h),v=view.current,dt=now-lastFrame;lastFrame=now;
   if(targetFacing===undefined)displayedFacing=undefined;
   else if(displayedFacing===undefined||!s.animations)displayedFacing=targetFacing;
   else{const delta=((targetFacing-displayedFacing+540)%360)-180;displayedFacing=Math.abs(delta)<.1?targetFacing:((displayedFacing+delta*(1-Math.exp(-Math.min(dt,100)/95)))%360+360)%360;}
   const facing=displayedFacing;
   if(follow.current&&point&&!current.calibration){const shown=rotateMapPoint(point,angle);v.targetX=(.5-shown.x)*fit*v.targetZoom;v.targetY=(.5-shown.y)*fit*v.targetZoom;}
   const moving=easeView(v,dt);if(now-lastPaint<(moving||turning?15:s.performance?66:32))return;
   const dpr=Math.min(devicePixelRatio,2),keys=[w,h,dpr,angle,v.x,v.y,v.zoom,point?.x,point?.y,facing,isLive,timerValue,timerSample?.at,current.calibration,s,assetVersion,hover.current?.id];
   if(keys.length===lastKeys.length&&keys.every((key,i)=>key===lastKeys[i]))return;lastKeys=keys;lastPaint=now;
   if(el.width!==Math.round(w*dpr)||el.height!==Math.round(h*dpr)){el.width=Math.round(w*dpr);el.height=Math.round(h*dpr);}
   if(dataSource!==data||customSource!==s.customMarkers){dataSource=data;customSource=s.customMarkers;thresholds=[...new Set([...(data?.markers??[]),...s.customMarkers].map(markerSpawnSeconds).filter((t):t is number=>t!==undefined))].sort((a,b)=>a-b);}
   const spawnPhase=timerValue===undefined?'unknown':thresholds.findIndex(t=>timerValue<t),worldKeys=[w,h,dpr,angle,v.x,v.y,v.zoom,s.mapLevel,s.mapLayers,s.mapIconSizes,s.iconSettings,s.objectives,s.customMarkers,assetVersion,hover.current?.id,spawnPhase];
   if(!scene||worldKeys.some((key,i)=>key!==sceneKeys[i])){
   if(!scene)scene=document.createElement('canvas');if(scene.width!==el.width||scene.height!==el.height){scene.width=el.width;scene.height=el.height;}ctx=scene.getContext('2d')!;
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#101615';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#ffffff05';ctx.lineWidth=1;for(let x=0;x<w;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
   const size=fit*v.zoom,ox=(w-size)/2+v.x,oy=(h-size)/2+v.y;ctx.save();ctx.translate(ox+size/2,oy+size/2);ctx.rotate(angle*Math.PI/180);ctx.drawImage(staticLayer(s),-size/2,-size/2,size,size);ctx.restore();const visible:Hit[]=[];
   for(const m of [...(data?.markers??[]),...s.customMarkers]){const style=iconStyle(s.iconSettings,m);if(!s.mapLayers[m.category]||style.mapVisible===false||mapLayerInfo[m.category].group==='objectives'&&!s.objectives)continue;const shown=rotateMapPoint(m,angle),x=ox+shown.x*size,y=oy+shown.y*size,groupSize=s.mapIconSizes[mapLayerInfo[m.category].group],iconSize=style.mapSize??(m.category==='patron'?groupSize*1.3:groupSize),radius=m.icon||style.mapSize!==undefined?iconSize/2:Math.max(3,groupSize*.2);if(x+radius<0||y+radius<0||x-radius>w||y-radius>h)continue;
    const selected=hover.current?.id===m.id,spawn=markerSpawnSeconds(m),desaturated=spawn!==undefined&&timerValue!==undefined&&timerValue<spawn,color=desaturated?desaturatedColor(style.tint??markerColor(m)):style.tint??markerColor(m);ctx.save();
    if(selected){ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,Math.max(radius,8)+4,0,Math.PI*2);ctx.stroke();if(m.target){ctx.strokeStyle=color+'aa';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,y);const destination=rotateMapPoint(m.target,angle);ctx.lineTo(ox+destination.x*size,oy+destination.y*size);ctx.stroke();}}
    const glyph=m.icon?icons(m.icon,style.tint,desaturated):undefined;
    if(glyph){ctx.shadowColor='#000';ctx.shadowBlur=3;const factor=iconSize/Math.max(glyph.width,glyph.height);ctx.drawImage(glyph.source,x-glyph.width*factor/2,y-glyph.height*factor/2,glyph.width*factor,glyph.height*factor);ctx.shadowBlur=0;}
    else{ctx.fillStyle=color;ctx.strokeStyle=desaturated?'#141414':'#101615';ctx.lineWidth=1.5;ctx.beginPath();if(m.category==='base_spawn_area')ctx.rect(x-radius,y-radius,radius*2,radius*2);else ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();}
    ctx.restore();visible.push({marker:m,x,y,radius:Math.max(radius,7)});
   }sceneHits=visible;sceneKeys=worldKeys;
   }hits.current=sceneHits;ctx=output;ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(scene,0,0);ctx.setTransform(dpr,0,0,dpr,0,0);
   const size=fit*v.zoom,ox=(w-size)/2+v.x,oy=(h-size)/2+v.y;
   if(point){const shown=rotateMapPoint(point,angle),x=ox+shown.x*size,y=oy+shown.y*size,radius=s.markerSize/2;ctx.strokeStyle=isLive?'#f2cc80':'#788678';ctx.fillStyle='#171c18';ctx.lineWidth=current.calibration?3:2;ctx.shadowColor='#e5bf70';ctx.shadowBlur=isLive?14:0;ctx.beginPath();ctx.arc(x,y,radius+5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle=isLive?'#f2cc80':'#788678';ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();if(facing!==undefined){ctx.save();ctx.translate(x,y);ctx.rotate(facing*Math.PI/180);ctx.fillStyle=isLive?'#f2cc80':'#788678';ctx.strokeStyle='#101615';ctx.lineWidth=1.5;ctx.shadowColor='#000';ctx.shadowBlur=3;ctx.beginPath();ctx.moveTo(0,-radius-11);ctx.lineTo(-5,-radius-2);ctx.lineTo(0,-radius-5);ctx.lineTo(5,-radius-2);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}}
  };
  frame=requestAnimationFrame(draw);return()=>{active=false;controller.abort();cancelAnimationFrame(frame);hits.current=[];};
 },[]);
 const pin=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect(),p=screenPoint(view.current,e.clientX-r.left,e.clientY-r.top,r.width,r.height,base(r.width,r.height));if(p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)props.current.onPin?.(p);};
 const showTip=(marker:MapMarker,x:number,y:number)=>{const r=canvas.current!.getBoundingClientRect();hover.current=marker;setTip({marker,x:Math.max(8,Math.min(r.width-250,x+15)),y:Math.max(8,Math.min(r.height-125,y+15))});};
 const inspect=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let nearest:Hit|undefined,distance=Infinity;for(let i=hits.current.length-1;i>=0;i--){const hit=hits.current[i],d=Math.hypot(x-hit.x,y-hit.y);if(d<=hit.radius+3&&d<distance){nearest=hit;distance=d;}}if(nearest)showTip(nearest.marker,x,y);else if(hover.current)clearTip();};
 const locate=(marker:MapMarker)=>{const s=useSettings.getState().settings;useSettings.getState().set({mapLayers:{...s.mapLayers,[marker.category]:true},...(mapLayerInfo[marker.category].group==='objectives'?{objectives:true}:{})});const r=canvas.current!.getBoundingClientRect(),v=view.current;follow.current=false;v.targetZoom=Math.max(v.targetZoom,2);const shown=rotateMapPoint(marker,sideRotation(s.mapSide));v.targetX=(.5-shown.x)*base(r.width,r.height)*v.targetZoom;v.targetY=(.5-shown.y)*base(r.width,r.height)*v.targetZoom;setZoom(v.targetZoom);showTip(marker,r.width/2,r.height/2);};
 return <div className="tactical-map-layout"><div className={`map-frame ${calibration?'map-calibrating':''}`}><canvas ref={canvas} aria-label={calibration?'Main map position calibration: drag the player marker':'Interactive tactical map: drag to pan, wheel to zoom. Find reference locations in Map layers.'} onContextMenu={e=>e.preventDefault()} onPointerLeave={()=>{if(!drag.current)clearTip();}} onWheel={e=>{const r=e.currentTarget.getBoundingClientRect(),delta=e.deltaY*(e.deltaMode===1?16:1);changeZoom(view.current.targetZoom*Math.exp(-delta*.0017),e.clientX-r.left,e.clientY-r.top);}} onPointerDown={e=>{if(placing&&e.button===0&&!calibration){const r=e.currentTarget.getBoundingClientRect(),p=rotateMapPoint(screenPoint(view.current,e.clientX-r.left,e.clientY-r.top,r.width,r.height,base(r.width,r.height)),-turn.current.angle);if(p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1){const s=useSettings.getState().settings;useSettings.getState().set({customMarkers:s.customMarkers.map(m=>m.id===placing?{...m,...p}:m),mapLayers:{...s.mapLayers,custom:true}});setPlacing(undefined);}return;}if(e.button!==0&&e.button!==1&&e.button!==2)return;clearTip();e.currentTarget.setPointerCapture(e.pointerId);follow.current=false;const isPin=!!props.current.calibration&&e.button===0&&!space.current;drag.current={x:e.clientX,y:e.clientY,pin:isPin};if(isPin)pin(e);}} onPointerMove={e=>{const d=drag.current;if(!d){if(!calibration)inspect(e);return;}if(d.pin)pin(e);else{const v=view.current;v.x+=e.clientX-d.x;v.y+=e.clientY-d.y;v.targetX=v.x;v.targetY=v.y;d.x=e.clientX;d.y=e.clientY;}}} onPointerUp={()=>drag.current=undefined} onPointerCancel={()=>drag.current=undefined}/>
 {placing&&<div className="custom-placement">Click the map to place your marker <button onClick={()=>setPlacing(undefined)}>Cancel</button></div>}
 <div className="map-layer-menu" ref={menu}><button ref={layerButton} className="map-layer-trigger" aria-label="Map layers" aria-expanded={layersOpen} onClick={()=>{clearTip();showLayers(v=>!v);}}><Layers size={16}/>Layers</button></div>
 {tip&&!layersOpen&&<div className="map-marker-tip" role="tooltip" style={{left:tip.x,top:tip.y}}><strong>{markerTitle(tip.marker)}{markerSpawnSeconds(tip.marker)!==undefined?' · '+formatMapTime(markerSpawnSeconds(tip.marker)!):''}</strong><span>{markerDetail(tip.marker)}</span></div>}
 <div className="map-controls"><button className="map-side-switch" aria-label={side==='hiddenKing'?'Switch to Arch Mother side':'Switch to Hidden King side'} aria-pressed={side==='archMother'} title={'Playing as '+(side==='hiddenKing'?'Hidden King':'Arch Mother')+' · click to switch sides'} onClick={()=>{clearTip();useSettings.getState().set({mapSide:side==='hiddenKing'?'archMother':'hiddenKing'});}}><RotateCw size={15}/><span>{side==='hiddenKing'?'Hidden King':'Arch Mother'}</span></button><i/><button aria-label="Zoom in" onClick={()=>changeZoom(view.current.targetZoom*1.3)}><Plus size={17}/></button><span>{Math.round(zoom*100)}%</span><button aria-label="Zoom out" onClick={()=>changeZoom(view.current.targetZoom/1.3)}><Minus size={17}/></button><i/><button aria-label="Follow player" disabled={!!calibration} onClick={()=>{clearTip();follow.current=true;}}><LocateFixed size={17}/></button><button aria-label="Fit entire map" onClick={()=>{clearTip();follow.current=false;view.current.targetZoom=1;view.current.targetX=0;view.current.targetY=0;setZoom(1);}}><Maximize size={16}/></button></div>
 <div className="map-bottom"><span><Layers size={13}/>{mapError||'Map references · 27 OCT 2026'}</span><span>{calibration?'CALIBRATION · NOT SAVED':'Static locations'}</span></div></div>{layersOpen&&<MapLayersPanel catalog={catalog?{...catalog,markers:[...catalog.markers,...customMarkers]}:undefined} close={closeLayers} onLocate={locate} onPlace={setPlacing}/>}</div>;
}





