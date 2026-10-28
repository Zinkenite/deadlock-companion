export type TextKey='timer';
export const fieldLabels:Record<TextKey,string>={timer:'Match timer'};
export function parseHud(key:TextKey,raw:string):Record<string,number>|undefined{
 if(key!=='timer')return;let text=raw.normalize('NFKC').replace(/[\u200b-\u200f]/g,'').trim();
 if(!/^[0-9OoIl\s:.;·]+$/.test(text))return;text=text.replace(/[Oo]/g,'0').replace(/[Il]/g,'1').replace(/\s/g,'').replace(/[.;·]/g,':');
 if(/^\d{3,5}$/.test(text))text=text.slice(0,-2)+':'+text.slice(-2);
 const m=text.match(/^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?$/);if(!m)return;
 const value=m[3]?Number(m[1])*3600+Number(m[2])*60+Number(m[3]):Number(m[1])*60+Number(m[2]);return value<=43200?{timer:value}:undefined;
}
/** Normal observations refresh immediately. Only discontinuities need confirmation. */
export class ReadingGate{
 private accepted?:{value:number;at:number};private pending?:{value:number;at:number};
 accept(values:Record<string,number|string>,at:number){const value=values.timer;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>43200||!Number.isFinite(at))return{};
  const last=this.accepted;if(last&&at<=last.at)return{};
  if(!last||value>=last.value&&value-last.value<=(at-last.at)/1000+3){this.accepted={value,at};this.pending=undefined;return{timer:value};}
  const pending=this.pending;this.pending={value,at};const compatible=pending&&at>pending.at&&at-pending.at<=10000&&value>=pending.value&&value-pending.value<=(at-pending.at)/1000+2;
  if(compatible&&(value<=30&&last.value>=60||at-last.at>=5000)){this.accepted={value,at};this.pending=undefined;return{timer:value};}return{};
 }
 reject(_key:TextKey){} // A missed frame must not discard the last trustworthy observation.
}
