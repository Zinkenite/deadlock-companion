import {create} from 'zustand';
import {invoke,isTauri} from '@tauri-apps/api/core';
import {ReadingGate,parseHud,type TextKey} from './ocr';
import {sample,type Snapshot,type Status,type MapPoint} from './readings';
export type Region={x:number;y:number;width:number;height:number};
export type Candidate={x:number;y:number;pixels:number;quality:number;angle?:number};
export type MarkerTemplate={width:number;height:number;rgba:number[];spanX:number;spanY:number;centerX:number;centerY:number;threshold:number;rotate:boolean;initialHeading?:number};
export type CaptureSettings={matchMode:'template'|'color';simpleDirection?:boolean;markerTemplate?:MarkerTemplate;configured:boolean;mapEnabled:boolean;alignment:Alignment;textRegions:Partial<Record<TextKey,HudRegion>>;ocrInterval:number;rotation:number;region:Region;color:string;tolerance:number;minPixels:number;maxPixels:number;hz:number;reference:number[];anchor:{x:number;y:number};sceneTolerance:number};
export type Alignment={offsetX:number;offsetY:number;scaleX:number;scaleY:number;rotation:number};
export type HudRegion={region:Region;mode:'original'|'adaptive'|'light'|'dark';threshold:number;angle?:number;slant?:number;scale?:number;retry?:boolean};
export const defaultAlignment:Alignment={offsetX:0,offsetY:0,scaleX:1,scaleY:1,rotation:0};
export const defaultCapture:CaptureSettings={matchMode:'template',simpleDirection:false,configured:false,mapEnabled:true,alignment:defaultAlignment,textRegions:{},ocrInterval:1000,rotation:0,region:{x:0,y:.65,width:.25,height:.35},color:'#f4df96',tolerance:25,minPixels:3,maxPixels:180,hz:5,reference:[],anchor:{x:.5,y:.5},sceneTolerance:22};
export type CaptureFrame={width:number;height:number;rgba:number[]|Uint8ClampedArray;signature:number[]};
export type Detection={candidates:Candidate[];signature:number[];processingMs:number;width:number;height:number};
export const useCapture=create<{message:string;confidence:number;processingMs:number;candidates:number;lastAttempt:number;acceptedAt:number;sceneDifference:number;facing?:number;rawPoint?:MapPoint;rawAt?:number;text:Partial<Record<TextKey,{text:string;error?:string;at:number;accepted:boolean}>>}>(()=>({message:'Screen reading is off.',confidence:0,processingMs:0,candidates:0,lastAttempt:0,acceptedAt:0,sceneDifference:0,text:{}}));
export function sceneDifference(a:number[],b:number[]){if(a.length!==144||b.length!==144||a.some(n=>!Number.isFinite(n))||b.some(n=>!Number.isFinite(n)))return Infinity;return a.reduce((sum,n,i)=>sum+Math.abs(n-b[i]),0)/144;}
export function orientMapPoint(p:{x:number;y:number},degrees:number){const a=(degrees||0)*Math.PI/180;return{x:Math.max(0,Math.min(1,.5+(p.x-.5)*Math.cos(a)-(p.y-.5)*Math.sin(a))),y:Math.max(0,Math.min(1,.5+(p.x-.5)*Math.sin(a)+(p.y-.5)*Math.cos(a)))};}
export function parseColor(hex:string):[number,number,number]{if(!/^#[0-9a-f]{6}$/i.test(hex))throw Error('Choose a valid marker colour.');return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)) as [number,number,number];}
/** Heading clockwise from up, corrected from the saved pose into the displayed map. */
export function markerFacing(rotation:number,config:CaptureSettings){const initial=(config.matchMode==='template'||config.simpleDirection)?(config.markerTemplate?.initialHeading??0):0;return((rotation+initial+config.rotation+(config.alignment?.rotation??0))%360+360)%360;}
export function markerRequest(config:CaptureSettings,hint?:MapPoint){
 if(config.matchMode==='template'&&!config.markerTemplate)throw Error('Select the whole player marker in screen setup.');
 return{region:config.region,color:parseColor(config.color),tolerance:config.tolerance,minPixels:config.minPixels,maxPixels:config.maxPixels,markerTemplate:config.matchMode==='template'&&config.markerTemplate?{...config.markerTemplate,rotate:true}:null,directionTemplate:config.matchMode==='color'&&config.simpleDirection&&config.markerTemplate?{...config.markerTemplate,rotate:true}:null,hint:hint??null};
}
/** Store at most 64x64 pixels; spans preserve its scale when capture resolution changes. */
export function learnMarker(frame:CaptureFrame,box:Region):MarkerTemplate{
 const x=Math.floor(box.x*frame.width),y=Math.floor(box.y*frame.height),w=Math.round(box.width*frame.width),h=Math.round(box.height*frame.height);
 if(![box.x,box.y,box.width,box.height].every(Number.isFinite)||x<0||y<0||w<4||h<4||x+w>frame.width||y+h>frame.height||box.width>.2||box.height>.2)throw Error('Select a marker at least 4 pixels across, up to one fifth of the minimap.');
 const scale=Math.min(1,64/Math.max(w,h)),width=Math.max(4,Math.round(w*scale)),height=Math.max(4,Math.round(h*scale)),rgba:number[]=[];let sum=0,square=0;
 for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++){const i=((y+Math.min(h-1,Math.floor((yy+.5)*h/height)))*frame.width+x+Math.min(w-1,Math.floor((xx+.5)*w/width)))*4;rgba.push(frame.rgba[i],frame.rgba[i+1],frame.rgba[i+2],255);const l=frame.rgba[i]*.299+frame.rgba[i+1]*.587+frame.rgba[i+2]*.114;sum+=l;square+=l*l;}
 if(square/(width*height)-(sum/(width*height))**2<100)throw Error('This selection has too little detail. Include the whole marker and a thin border.');
 return{width,height,rgba,spanX:w/frame.width,spanY:h/frame.height,centerX:.5,centerY:.5,threshold:.8,rotate:false,initialHeading:0};
}
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
/** Require three consistent frames. Reject competition and impossible frame-to-frame jumps. */
export class MarkerTracker {
 private last?:Candidate;private pending?:Candidate;private count=0;private acceptedAt=0;
 constructor(private anchor:{x:number;y:number}){}
 lose(){this.pending=undefined;this.count=0;}
 update(raw:Candidate[],now:number):{point?:Candidate;confidence:number;reason:string}{
  const candidates=raw.filter(c=>Number.isFinite(c.x)&&Number.isFinite(c.y)&&c.x>.01&&c.x<.99&&c.y>.01&&c.y<.99&&c.quality>=.35);
  if(!candidates.length){this.lose();return{confidence:0,reason:'Tracking lost · no matching marker'};}
  const recent=!!this.last&&now-this.acceptedAt<3000;const target=recent?this.last!:this.anchor;
  const ranked=candidates.map(c=>({c,d:distance(c,target)})).sort((a,b)=>a.d-b.d);
  const best=ranked[0];
  if((recent&&best.d>.18)||(!recent&&candidates.length>1&&best.d>.12)||(ranked[1]&&ranked[1].d-best.d<.055)){
   this.lose();return{confidence:0,reason:'Tracking lost · ambiguous marker or large jump'};
  }
  if(this.pending&&distance(best.c,this.pending)<.10)this.count++;else this.count=1;
  this.pending=best.c;
  if(this.count<3)return{confidence:0,reason:`Confirming marker · ${this.count}/3 frames`};
  this.last=best.c;this.acceptedAt=now;
  return{point:best.c,confidence:Math.min(.95,.6+best.c.quality*.3),reason:'Tracking visible marker · estimated map position'};
 }
}

export function alignPoint(raw:MapPoint,config:CaptureSettings):MapPoint|undefined{
 const r=orientMapPoint(raw,config.rotation),a=config.alignment??defaultAlignment,angle=a.rotation*Math.PI/180,x=(r.x-.5)*a.scaleX,y=(r.y-.5)*a.scaleY;
 const point={x:.5+x*Math.cos(angle)-y*Math.sin(angle)+a.offsetX,y:.5+x*Math.sin(angle)+y*Math.cos(angle)+a.offsetY};
 return Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x>=0&&point.x<=1&&point.y>=0&&point.y<=1?point:undefined;
}
export function pinPoint(raw:MapPoint,target:MapPoint,config:CaptureSettings):Alignment{
 const a={...(config.alignment??defaultAlignment),offsetX:0,offsetY:0};const r=orientMapPoint(raw,config.rotation),angle=a.rotation*Math.PI/180,x=(r.x-.5)*a.scaleX,y=(r.y-.5)*a.scaleY;
 return{...a,offsetX:target.x-(.5+x*Math.cos(angle)-y*Math.sin(angle)),offsetY:target.y-(.5+x*Math.sin(angle)+y*Math.cos(angle))};
}
export type ScreenBatch={marker?:Detection;mapAt:number;text:{key:TextKey;text:string;error?:string;at:number;method?:string;alternatives?:string[];preview?:CaptureFrame}[];processingMs:number};
export class ScreenReader{
 constructor(private options:()=>CaptureSettings,private lowPower:()=>boolean=()=>false){}
 start(emit:(data:Snapshot)=>void,status:(s:Status)=>void){
  let active=true,timeout:ReturnType<typeof setTimeout>|undefined,lastOcr=0,lastRead=0,previous:CaptureSettings|undefined,tracker=new MarkerTracker(this.options().anchor),gate=new ReadingGate();
  const tick=async()=>{
   if(!active)return;const start=performance.now(),config=this.options();let delay=1000/Math.max(0.5,Math.min(this.lowPower()?5:15,config.hz));
   try{
    if(!isTauri())throw Error('Screen reading requires the Windows desktop app.');
    const hasMap=config.mapEnabled&&config.configured&&config.reference.length===144;
    if(!hasMap&&!Object.keys(config.textRegions).length)throw Error('Set up at least one screen region.');
    if(config!==previous){tracker=new MarkerTracker(config.anchor);gate=new ReadingGate();previous=config;lastOcr=0;useCapture.setState({facing:undefined});}
    if(!hasMap)delay=Math.max(1000,config.ocrInterval);
    const due=Date.now()-lastOcr>=Math.max(1000,config.ocrInterval);const textRegions=due&&config.textRegions.timer?[{key:'timer',...config.textRegions.timer}]:[];
    if(due)lastOcr=Date.now();
    const last=useCapture.getState(),hint=last.rawAt&&Date.now()-last.rawAt<3000?last.rawPoint:config.anchor;
    const batch=await invoke<ScreenBatch>('read_screen',{request:{marker:hasMap?markerRequest(config,hint):null,textRegions}});
    if(!active)return;let tracking=false,message='Reading visible HUD';const values:Snapshot={};
    if(batch.marker){const data=batch.marker,difference=sceneDifference(config.reference,data.signature);let result:{point?:Candidate;confidence:number;reason:string};
     if(difference>config.sceneTolerance){tracker.lose();result={confidence:0,reason:'Minimap obscured or changed'};}else result=tracker.update(data.candidates,batch.mapAt);
     const point=result.point?alignPoint(result.point,config):undefined;
     if(point){values.mapPosition=sample(point,batch.mapAt);tracking=true;}
     message=result.point&&!point?'Map point outside calibrated bounds':result.reason;
     useCapture.setState({message,confidence:result.confidence,candidates:data.candidates.length,sceneDifference:difference,...result.point?{rawPoint:{x:result.point.x,y:result.point.y},rawAt:batch.mapAt,acceptedAt:batch.mapAt,facing:config.matchMode==='color'&&!config.simpleDirection?undefined:result.point.angle??useCapture.getState().facing}:{}});
    }
    const diagnostic={...useCapture.getState().text};
    for(const item of batch.text){const parsed=item.error?undefined:parseHud(item.key,item.text);const accepted=parsed?gate.accept(parsed,item.at):{};if(!parsed)gate.reject(item.key);
     for(const[key,value]of Object.entries(accepted))(values as any)[key]=sample(value,item.at);
     diagnostic[item.key]={text:item.text,error:item.error??(!parsed?'Unreadable or invalid text':Object.keys(accepted).length?undefined:'Confirming next reading'),at:item.at,accepted:Object.keys(accepted).length>0};
    }
    if(Object.keys(values).length){emit(values);lastRead=Date.now();}
    status(tracking?'tracking':Date.now()-lastRead<Math.max(3000,config.ocrInterval*2)?'reading':'waiting');
    useCapture.setState({message,processingMs:batch.processingMs,lastAttempt:Date.now(),text:diagnostic});
   }catch(error){if(!active)return;tracker.lose();delay=1000;status('waiting');useCapture.setState({message:String(error),confidence:0,lastAttempt:Date.now()});}
   if(active)timeout=setTimeout(tick,Math.max(0,delay-(performance.now()-start)));
  };status('waiting');void tick();return()=>{active=false;if(timeout)clearTimeout(timeout);useCapture.setState({message:'Screen reading stopped.',confidence:0});};
 }
}


export function decodeCapture(buffer:ArrayBuffer):CaptureFrame{
 if(buffer.byteLength<8)throw Error('Invalid capture response.');const header=new DataView(buffer),width=header.getUint32(0,true),height=header.getUint32(4,true);if(width<1||height<1||width>1920||height>1920||buffer.byteLength!==8+width*height*4)throw Error('Invalid capture dimensions.');return{width,height,rgba:new Uint8ClampedArray(buffer,8),signature:[]};
}
export async function capturePreview(region?:Region){return decodeCapture(await invoke<ArrayBuffer>('capture_preview',{region:region??null}));}
