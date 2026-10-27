export type TextKey='timer';
export const fieldLabels:Record<TextKey,string>={timer:'Match timer'};
export function parseHud(key:TextKey,raw:string):Record<string,number>|undefined{
 if(key!=='timer')return;let text=raw.normalize('NFKC').replace(/[\u200b-\u200f]/g,'').trim();
 if(/[0-9]/.test(text)&&/^[0-9OoIl\s:]+$/.test(text))text=text.replace(/[Oo]/g,'0').replace(/[Il]/g,'1');
 const m=text.replace(/\s/g,'').match(/^(\d{1,3}):([0-5]\d)(?::([0-5]\d))?$/);if(!m)return;
 const n=m[3]?Number(m[1])*3600+Number(m[2])*60+Number(m[3]):Number(m[1])*60+Number(m[2]);return n<=43200?{timer:n}:undefined;
}
/** Require independent compatible observations; never advance the timer between reads. */
export class ReadingGate{
 private pending?:{value:number;at:number};private accepted?:{value:number;at:number};
 accept(values:Record<string,number|string>,at:number){const value=values.timer,out:Record<string,number>={};if(typeof value!=='number'||!Number.isFinite(value))return out;
 const old=this.pending,accepted=this.accepted;this.pending={value,at};if(!old||at<=old.at||at-old.at>5000)return out;
 if(value<old.value-1||value-old.value>(at-old.at)/1000+3)return out;
 if(accepted&&(value<accepted.value-2||value-accepted.value>(at-accepted.at)/1000+5))return out;
 this.accepted={value,at};return{timer:value};}
 reject(_key:TextKey){this.pending=undefined;}
}
