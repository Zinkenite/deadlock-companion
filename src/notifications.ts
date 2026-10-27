export type NotificationRule={id:string;enabled:boolean;text:string;icon:string|null;seconds:number};
export type NotificationSettings={enabled:boolean;editing:boolean;hideOnFocusLoss:boolean;monitor:number;x:number;y:number;width:number;duration:number;maxVisible:number;sound:boolean;volume:number;rules:NotificationRule[]};
export type NotificationCard={id:string;ruleId?:string;text:string;icon:string|null;seconds:number;createdAt:number;expiresAt:number;preview?:boolean};
export const defaultNotifications:NotificationSettings={enabled:false,editing:false,hideOnFocusLoss:true,monitor:0,x:98,y:18,width:370,duration:6,maxVisible:4,sound:true,volume:.6,rules:[]};
export const notificationTime=(seconds:number)=>Math.floor(seconds/60)+':'+String(Math.floor(seconds%60)).padStart(2,'0');
export function parseNotificationTime(value:string){const m=/^(\d{1,3}):([0-5]\d)$/.exec(value.trim());if(!m)return undefined;const seconds=Number(m[1])*60+Number(m[2]);return seconds<=43200?seconds:undefined;}
export function sanitizeNotifications(raw:unknown):NotificationSettings{const s=raw&&typeof raw==='object'?raw as Record<string,unknown>:{},out={...defaultNotifications,rules:[]as NotificationRule[]};for(const key of ['enabled','hideOnFocusLoss','sound']as const)if(typeof s[key]==='boolean')out[key]=s[key];for(const[key,min,max]of [['monitor',0,16],['x',0,100],['y',0,100],['width',300,600],['duration',3,20],['maxVisible',1,6],['volume',0,1]]as const){const v=s[key];if(typeof v==='number'&&Number.isFinite(v))out[key]=Math.max(min,Math.min(max,v));}out.monitor=Math.round(out.monitor);out.maxVisible=Math.round(out.maxVisible);const ids=new Set<string>();if(Array.isArray(s.rules))for(const r of s.rules){if(!r||typeof r.id!=='string'||r.id.length>100||ids.has(r.id)||typeof r.text!=='string'||!r.text.trim()||!Number.isFinite(r.seconds)||r.seconds<0||r.seconds>43200)continue;ids.add(r.id);out.rules.push({id:r.id,enabled:r.enabled!==false,text:r.text.trim().slice(0,140),seconds:Math.floor(r.seconds),icon:typeof r.icon==='string'&&r.icon.length<=400000&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(r.icon)?r.icon:null});if(out.rules.length===100)break;}return out;}
export class NotificationEngine{
 private fired=new Set<string>();private pending:Omit<NotificationCard,'createdAt'|'expiresAt'>[]=[];private visible:NotificationCard[]=[];private sequence=0;
 reset(){this.fired.clear();this.pending=[];this.visible=[];}
 preview(rule?:NotificationRule){this.pending.push({id:'preview-'+(++this.sequence),text:rule?.text??'Your next opportunity is ready.',icon:rule?.icon??null,seconds:rule?.seconds??120,preview:true});}
 step(settings:NotificationSettings,timer:{value:number;at:number}|undefined,now:number,canTrigger=true,ttl=5000){
  const allowed=new Set(settings.rules.filter(r=>r.enabled).map(r=>r.id));
  this.pending=this.pending.filter(r=>r.preview||settings.enabled&&allowed.has(r.ruleId!));
  let next=this.visible.filter(r=>r.expiresAt>now&&(r.preview||settings.enabled&&allowed.has(r.ruleId!)));
  if(settings.enabled&&canTrigger&&timer&&Number.isFinite(timer.value)&&timer.value>=0&&timer.at<=now+1000&&now-timer.at<=ttl){for(const rule of [...settings.rules].sort((a,b)=>a.seconds-b.seconds)){if(rule.enabled&&timer.value>=rule.seconds&&!this.fired.has(rule.id)){this.fired.add(rule.id);this.pending.push({id:rule.id+'-'+(++this.sequence),ruleId:rule.id,text:rule.text,icon:rule.icon,seconds:rule.seconds});}}}
  const appeared:NotificationCard[]=[];while(next.length<settings.maxVisible&&this.pending.length){const item={...this.pending.shift()!,createdAt:now,expiresAt:now+settings.duration*1000};next.push(item);appeared.push(item);}
  if(next.length!==this.visible.length||next.some((r,i)=>r!==this.visible[i]))this.visible=next;
  return{items:this.visible,appeared};
 }
}
