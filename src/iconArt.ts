export type IconArt={source:CanvasImageSource;width:number;height:number};
const grayColors=new Map<string,string>();
export function desaturatedColor(color:string){let cached=grayColors.get(color);if(cached)return cached;const value=parseInt(color.slice(1),16),gray=Math.round(((value>>16)&255)*.2126+((value>>8)&255)*.7152+(value&255)*.0722).toString(16).padStart(2,'0');cached='#'+gray.repeat(3);if(grayColors.size>=128)grayColors.clear();grayColors.set(color,cached);return cached;}
export function createIconCache(onLoad:()=>void=()=>{}){
 const sources=new Map<string,{image:HTMLImageElement;art?:IconArt}>(),variants=new Map<string,IconArt>();
 return(url:string,tint?:string|null,desaturated=false):IconArt|undefined=>{
  let entry=sources.get(url);
  if(!entry){const image=new Image(),next:{image:HTMLImageElement;art?:IconArt}={image};image.onload=()=>{try{
   const probe=document.createElement('canvas'),scale=Math.min(1,512/Math.max(image.naturalWidth,image.naturalHeight));probe.width=Math.max(1,Math.round(image.naturalWidth*scale));probe.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=probe.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(image,0,0,probe.width,probe.height);const data=ctx.getImageData(0,0,probe.width,probe.height).data;let left=probe.width,top=probe.height,right=-1,bottom=-1;
   for(let y=0;y<probe.height;y++)for(let x=0;x<probe.width;x++)if(data[(y*probe.width+x)*4+3]>16){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
   if(right<left||bottom<top){onLoad();return;}const crop=document.createElement('canvas');crop.width=right-left+1;crop.height=bottom-top+1;crop.getContext('2d')!.drawImage(probe,left,top,crop.width,crop.height,0,0,crop.width,crop.height);next.art={source:crop,width:crop.width,height:crop.height};
  }catch{next.art={source:image,width:image.naturalWidth,height:image.naturalHeight};}onLoad();};image.onerror=onLoad;image.src=url;entry=next;sources.set(url,entry);}
  if(!entry.art)return;if(!tint&&!desaturated)return entry.art;
  const key=url+'|'+(tint??'')+'|'+desaturated;let art=variants.get(key);if(art)return art;
  const c=document.createElement('canvas');c.width=entry.art.width;c.height=entry.art.height;const ctx=c.getContext('2d',{willReadFrequently:desaturated})!;ctx.drawImage(entry.art.source,0,0);
  if(tint){ctx.globalCompositeOperation='source-in';ctx.fillStyle=tint;ctx.fillRect(0,0,c.width,c.height);ctx.globalCompositeOperation='source-over';}
  if(desaturated){const pixels=ctx.getImageData(0,0,c.width,c.height);for(let i=0;i<pixels.data.length;i+=4){const gray=Math.round(pixels.data[i]*.2126+pixels.data[i+1]*.7152+pixels.data[i+2]*.0722);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=gray;}ctx.putImageData(pixels,0,0);}
  art={source:c,width:c.width,height:c.height};if(variants.size>=256)variants.delete(variants.keys().next().value!);variants.set(key,art);return art;
 };
}
