export type MapPoint={x:number;y:number};
export type Fields={mapPosition:MapPoint;timer:number};
export type Key=keyof Fields;
export type Sample<K extends Key=Key>={value:Fields[K];at:number};
export type Snapshot=Partial<{[K in Key]:Sample<K>}>;
export type Status='idle'|'waiting'|'tracking'|'reading';
export const sample=<K extends Key>(value:Fields[K],at=Date.now()):Sample<K>=>({value,at});
export const fresh=(s:Sample|undefined,now=Date.now(),ttl=3000)=>!!s&&now>=s.at-1000&&now-s.at<=ttl;
export function validate(raw:unknown):Snapshot{
 if(!raw||typeof raw!=='object')return{};const result:Snapshot={};
 for(const[k,s]of Object.entries(raw)){if(!s||typeof s!=='object'||!Number.isFinite(s.at)||s.at>Date.now()+1000||s.at<0)continue;const v=s.value;
 const valid=k==='mapPosition'?v&&typeof v==='object'&&['x','y'].every(axis=>Number.isFinite(v[axis])&&v[axis]>=0&&v[axis]<=1):k==='timer'&&typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=43200;
 if(valid)(result as any)[k]=s;
 }return result;
}
