import {useEffect,useRef,useState} from 'react';
import {LocateFixed,Maximize,Plus,Minus,Layers,Navigation} from 'lucide-react';
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
 const level=useSettings(s=>s.settings.mapLevel);
 const base=(w:number,h:number)=>Math.max(20,Math.min(w-36,h-30));
 const clearTip=()=>{hover.current=undefined;setTip(undefined);};
 const changeZoom=(z:number,px?:number,py?:number)=>{const r=canvas.current!.getBoundingClientRect();follow.current=false;clearTip();zoomAt(view.current,z,px??r.width/2,py??r.height/2,r.width,r.height,base(r.width,r.height),.5,8);setZoom(view.current.targetZoom);};
 const closeLayers=()=>{showLayers(false);layerButton.current?.focus();};
 useEffect(()=>{if(!layersOpen)return;const outside=(e:PointerEvent)=>{if(!menu.current?.contains(e.target as Node))showLayers(false);};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){showLayers(false);layerButton.current?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);};},[layersOpen]);
 useEffect(()=>{
  const el=canvas.current!,prevent=(e:WheelEvent)=>e.preventDefault();el.addEventListener('wheel',prevent,{passive:false});view.current=newView(useSettings.getState().settings.zoom);setZoom(view.current.zoom);
  const key=(e:KeyboardEvent)=>{if(e.code==='Space'&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLSelectElement)&&!(e.target instanceof HTMLButtonElement)&&!(e.target instanceof HTMLTextAreaElement)){space.current=e.type==='keydown';if(space.current)e.preventDefault();}};
  const blur=()=>{space.current=false;drag.current=undefined;};window.addEventListener('keydown',key);window.addEventListener('keyup',key);window.addEventListener('blur',blur);
  return()=>{el.removeEventListener('wheel',prevent);window.removeEventListener('keydown',key);window.removeEventListener('keyup',key);window.removeEventListener('blur',blur);};
 },[]);
 useEffect(()=>{
  const el=canvas.current!,ctx=el.getContext('2d')!,images=new Map<string,HTMLImageElement>(),controller=new AbortController();let meta:Meta|undefined,data:MapCatalog|undefined,frame=0,lastPaint=0,lastFrame=performance.now(),active=true,assetVersion=0,layer:HTMLCanvasElement|undefined,layerKey='',lastKeys:unknown[]=[],displayedFacing:number|undefined;
  const image=(src:string)=>{let img=images.get(src);if(!img){img=new Image();img.onload=()=>{assetVersion++;};img.onerror=()=>{assetVersion++;};img.src=src;images.set(src,img);}return img;};
  image('/map-assets/map-mid.png');image('/map-assets/map-mid_tunnels.png');image('/map-assets/map-rat_tunnels.png');
  const load=async()=>{try{const fetchJson=async(url:string)=>{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw Error('Map file unavailable');return r.json();};const [raw,geometry]=await Promise.all([fetchJson('/map-markers.json'),fetchJson('/map-metadata.json')]);const parsed=readMapCatalog(raw);if(!active)return;data=parsed;meta=geometry;data.markers.sort((a,b)=>priority(a)-priority(b));for(const m of data.markers)if(m.icon)image(m.icon);setCatalog(data);assetVersion++;}catch(e){if(active)setMapError('Map references could not load. Restart the app to retry.');}};
  const priority=(m:MapMarker)=>({loot:0,movement:1,events:2,camps:3,objectives:4})[mapLayerInfo[m.category].group];
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
   if(!active)return;frame=requestAnimationFrame(draw);const s=useSettings.getState().settings,state=useMatch.getState(),current=props.current,p=state.data.mapPosition,observed=useCapture.getState();
   let point=current.calibration?alignPoint(current.calibration.raw,current.calibration.config):p&&observed.rawPoint&&observed.rawAt===p.at?alignPoint(observed.rawPoint,s.capture):p?.value;
   const isFresh=fresh(p),isLive=!!current.calibration||isFresh&&state.status==='tracking',timerSample=state.data.timer,timerValue=timerSample?.value,directionConfig=current.calibration?.config??s.capture,targetFacing=markerFacing(observed.facing??0,directionConfig);
   if(!current.calibration&&point&&p&&state.previousMapPosition&&s.animations&&isFresh&&state.status==='tracking'){const a=state.previousMapPosition.value,t=Math.max(0,Math.min(1,(Date.now()-p.at)/200));point={x:a.x+(point.x-a.x)*t,y:a.y+(point.y-a.y)*t};}
   const r=el.getBoundingClientRect(),w=r.width,h=r.height,fit=base(w,h),v=view.current,dt=now-lastFrame;lastFrame=now;
   if(targetFacing===undefined)displayedFacing=undefined;
   else if(displayedFacing===undefined||!s.animations)displayedFacing=targetFacing;
   else{const delta=((targetFacing-displayedFacing+540)%360)-180;displayedFacing=Math.abs(delta)<.1?targetFacing:((displayedFacing+delta*(1-Math.exp(-Math.min(dt,100)/95)))%360+360)%360;}
   const facing=displayedFacing;
   if(follow.current&&point&&!current.calibration){v.targetX=(.5-point.x)*fit*v.targetZoom;v.targetY=(.5-point.y)*fit*v.targetZoom;}
   const moving=easeView(v,dt);if(now-lastPaint<(moving?15:s.performance?66:32))return;
   const dpr=Math.min(devicePixelRatio,2),keys=[w,h,dpr,v.x,v.y,v.zoom,point?.x,point?.y,facing,isLive,timerValue,timerSample?.at,current.calibration,s,assetVersion,hover.current?.id];
   if(keys.length===lastKeys.length&&keys.every((key,i)=>key===lastKeys[i]))return;lastKeys=keys;lastPaint=now;
   if(el.width!==Math.round(w*dpr)||el.height!==Math.round(h*dpr)){el.width=Math.round(w*dpr);el.height=Math.round(h*dpr);}
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#101615';ctx.fillRect(0,0,w,h);ctx.strokeStyle='#ffffff05';ctx.lineWidth=1;for(let x=0;x<w;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}for(let y=0;y<h;y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
   const size=fit*v.zoom,ox=(w-size)/2+v.x,oy=(h-size)/2+v.y;ctx.drawImage(staticLayer(s),ox,oy,size,size);const visible:Hit[]=[];
   for(const m of data?.markers??[]){if(!s.mapLayers[m.category]||mapLayerInfo[m.category].group==='objectives'&&!s.objectives)continue;const x=ox+m.x*size,y=oy+m.y*size,groupSize=s.mapIconSizes[mapLayerInfo[m.category].group],iconSize=m.category==='patron'?groupSize*1.3:groupSize,radius=m.icon?iconSize/2:Math.max(3,groupSize*.2);if(x+radius<0||y+radius<0||x-radius>w||y-radius>h)continue;
    const selected=hover.current?.id===m.id,color=markerColor(m),spawn=markerSpawnSeconds(m);ctx.save();if(spawn!==undefined&&timerValue!==undefined&&timerValue<spawn)ctx.globalAlpha=.26;
    if(selected){ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,Math.max(radius,8)+4,0,Math.PI*2);ctx.stroke();if(m.target){ctx.strokeStyle=color+'aa';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ox+m.target.x*size,oy+m.target.y*size);ctx.stroke();}}
    const glyph=m.icon?image(m.icon):undefined;
    if(glyph?.naturalWidth){ctx.shadowColor='#000';ctx.shadowBlur=3;ctx.drawImage(glyph,x-iconSize/2,y-iconSize/2,iconSize,iconSize);ctx.shadowBlur=0;}
    else{ctx.fillStyle=color;ctx.strokeStyle='#101615';ctx.lineWidth=1.5;ctx.beginPath();if(m.category==='base_spawn_area')ctx.rect(x-radius,y-radius,radius*2,radius*2);else ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();ctx.stroke();}
    ctx.restore();visible.push({marker:m,x,y,radius:Math.max(radius,7)});
   }hits.current=visible;
   if(point){const x=ox+point.x*size,y=oy+point.y*size,radius=s.markerSize/2;ctx.strokeStyle=isLive?'#f2cc80':'#788678';ctx.fillStyle='#171c18';ctx.lineWidth=current.calibration?3:2;ctx.shadowColor='#e5bf70';ctx.shadowBlur=isLive?14:0;ctx.beginPath();ctx.arc(x,y,radius+5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle=isLive?'#f2cc80':'#788678';ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();if(facing!==undefined){ctx.save();ctx.translate(x,y);ctx.rotate(facing*Math.PI/180);ctx.fillStyle=isLive?'#f2cc80':'#788678';ctx.strokeStyle='#101615';ctx.lineWidth=1.5;ctx.shadowColor='#000';ctx.shadowBlur=3;ctx.beginPath();ctx.moveTo(0,-radius-11);ctx.lineTo(-5,-radius-2);ctx.lineTo(0,-radius-5);ctx.lineTo(5,-radius-2);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();}}
  };
  frame=requestAnimationFrame(draw);return()=>{active=false;controller.abort();cancelAnimationFrame(frame);hits.current=[];};
 },[]);
 const pin=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect(),p=screenPoint(view.current,e.clientX-r.left,e.clientY-r.top,r.width,r.height,base(r.width,r.height));if(p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1)props.current.onPin?.(p);};
 const showTip=(marker:MapMarker,x:number,y:number)=>{const r=canvas.current!.getBoundingClientRect();hover.current=marker;setTip({marker,x:Math.max(8,Math.min(r.width-250,x+15)),y:Math.max(8,Math.min(r.height-125,y+15))});};
 const inspect=(e:React.PointerEvent<HTMLCanvasElement>)=>{const r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;let nearest:Hit|undefined,distance=Infinity;for(let i=hits.current.length-1;i>=0;i--){const hit=hits.current[i],d=Math.hypot(x-hit.x,y-hit.y);if(d<=hit.radius+3&&d<distance){nearest=hit;distance=d;}}if(nearest)showTip(nearest.marker,x,y);else if(hover.current)clearTip();};
 const locate=(marker:MapMarker)=>{const s=useSettings.getState().settings;useSettings.getState().set({mapLayers:{...s.mapLayers,[marker.category]:true},...(mapLayerInfo[marker.category].group==='objectives'?{objectives:true}:{})});const r=canvas.current!.getBoundingClientRect(),v=view.current;follow.current=false;v.targetZoom=Math.max(v.targetZoom,2);v.targetX=(.5-marker.x)*base(r.width,r.height)*v.targetZoom;v.targetY=(.5-marker.y)*base(r.width,r.height)*v.targetZoom;setZoom(v.targetZoom);showLayers(false);showTip(marker,r.width/2,r.height/2);};
 return <div className={`map-frame ${calibration?'map-calibrating':''}`}><canvas ref={canvas} aria-label={calibration?'Main map position calibration: drag the player marker':'Interactive tactical map: drag to pan, wheel to zoom. Find reference locations in Map layers.'} onContextMenu={e=>e.preventDefault()} onPointerLeave={()=>{if(!drag.current)clearTip();}} onWheel={e=>{const r=e.currentTarget.getBoundingClientRect(),delta=e.deltaY*(e.deltaMode===1?16:1);changeZoom(view.current.targetZoom*Math.exp(-delta*.0017),e.clientX-r.left,e.clientY-r.top);}} onPointerDown={e=>{if(e.button!==0&&e.button!==1&&e.button!==2)return;clearTip();e.currentTarget.setPointerCapture(e.pointerId);follow.current=false;const isPin=!!props.current.calibration&&e.button===0&&!space.current;drag.current={x:e.clientX,y:e.clientY,pin:isPin};if(isPin)pin(e);}} onPointerMove={e=>{const d=drag.current;if(!d){if(!calibration)inspect(e);return;}if(d.pin)pin(e);else{const v=view.current;v.x+=e.clientX-d.x;v.y+=e.clientY-d.y;v.targetX=v.x;v.targetY=v.y;d.x=e.clientX;d.y=e.clientY;}}} onPointerUp={()=>drag.current=undefined} onPointerCancel={()=>drag.current=undefined}/>
 <div className="map-corner"><span className="tiny">NEW YORK CITY</span><strong>MIDTOWN</strong><span>{calibration?'Drag marker · Space + drag pans':level==='street'?'Street · north up':level==='mid_tunnels'?'Mid tunnels · north up':'Rat tunnels · north up'}</span></div><div className="compass"><Navigation size={17}/><span>N</span></div>
 <div className="map-layer-menu" ref={menu}><button ref={layerButton} className="map-layer-trigger" aria-label="Map layers" aria-expanded={layersOpen} onClick={()=>{clearTip();showLayers(v=>!v);}}><Layers size={16}/>Layers</button>{layersOpen&&<MapLayersPanel catalog={catalog} close={closeLayers} onLocate={locate}/>}</div>
 {tip&&!layersOpen&&<div className="map-marker-tip" role="tooltip" style={{left:tip.x,top:tip.y}}><strong>{markerTitle(tip.marker)}{markerSpawnSeconds(tip.marker)!==undefined?' · '+formatMapTime(markerSpawnSeconds(tip.marker)!):''}</strong><span>{markerDetail(tip.marker)}</span></div>}
 <div className="map-controls"><button aria-label="Zoom in" onClick={()=>changeZoom(view.current.targetZoom*1.3)}><Plus size={17}/></button><span>{Math.round(zoom*100)}%</span><button aria-label="Zoom out" onClick={()=>changeZoom(view.current.targetZoom/1.3)}><Minus size={17}/></button><i/><button aria-label="Follow player" disabled={!!calibration} onClick={()=>{clearTip();follow.current=true;}}><LocateFixed size={17}/></button><button aria-label="Fit entire map" onClick={()=>{clearTip();follow.current=false;view.current.targetZoom=1;view.current.targetX=0;view.current.targetY=0;setZoom(1);}}><Maximize size={16}/></button></div>
 <div className="map-bottom"><span><Layers size={13}/>{mapError||'Map references · 27 OCT 2026'}</span><span>{calibration?'CALIBRATION · NOT SAVED':'Static locations'}</span></div></div>;
}





