import {useEffect,useRef,useState} from 'react';
import {invoke,isTauri} from '@tauri-apps/api/core';
import {emitTo,listen} from '@tauri-apps/api/event';
import {useMatch,useSettings} from './store';
import {NotificationEngine,type NotificationCard,type NotificationRule} from './notifications';
export const testNotification=(rule?:NotificationRule)=>window.dispatchEvent(new CustomEvent('notifications-test',{detail:rule}));
export default function NotificationsBridge({onError}:{onError:(message:string)=>void}){
 const settings=useSettings(s=>s.settings.notifications),[items,setItems]=useState<NotificationCard[]>([]),queue=useRef(Promise.resolve()),latest=useRef({settings,items}),errors=useRef(onError);latest.current={settings,items};errors.current=onError;
 const previewing=items.some(i=>i.preview);
 useEffect(()=>{if(!isTauri())return;let active=true;queue.current=queue.current.catch(()=>{}).then(async()=>{await invoke('configure_notifications',{config:{...settings,enabled:settings.enabled||previewing,previewing}});if(active)await emitTo('notifications','notification-state',latest.current);}).catch(e=>errors.current(String(e)));return()=>{active=false;};},[settings,previewing]);
 useEffect(()=>{if(isTauri())void emitTo('notifications','notification-state',{settings,items}).catch(e=>errors.current(String(e)));window.dispatchEvent(new CustomEvent('notification-feed',{detail:items}));},[items,settings]);
 useEffect(()=>{const engine=new NotificationEngine();let previous=engine.step(useSettings.getState().settings.notifications,undefined,Date.now(),false).items;
  const tick=()=>{const s=useSettings.getState().settings,m=useMatch.getState(),result=engine.step(s.notifications,m.data.timer,Date.now(),s.readingEnabled,Math.max(3000,s.capture.ocrInterval*2.5));if(result.items!==previous){previous=result.items;setItems(result.items);}if(result.appeared.length&&s.notifications.sound&&s.notifications.volume>0){if(isTauri())void invoke('notification_sound',{volume:s.notifications.volume}).catch(e=>errors.current(String(e)));else{try{const audio=new AudioContext(),osc=audio.createOscillator(),gain=audio.createGain();osc.type='sine';osc.frequency.setValueAtTime(740,audio.currentTime);osc.frequency.setValueAtTime(988,audio.currentTime+.12);gain.gain.setValueAtTime(0,audio.currentTime);gain.gain.linearRampToValueAtTime(s.notifications.volume*.12,audio.currentTime+.02);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.45);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+.48);osc.onended=()=>void audio.close();}catch{}}}};
  const test=(e:Event)=>{engine.preview((e as CustomEvent<NotificationRule|undefined>).detail);tick();};window.addEventListener('notifications-test',test);
  const unsubscribe=useMatch.subscribe((next,old)=>{if(old.data.timer&&!next.data.timer){engine.reset();tick();}}),timer=setInterval(tick,150);
  const ready=isTauri()?listen('notifications-ready',()=>void emitTo('notifications','notification-state',latest.current)):undefined;
  const lock=isTauri()?listen('notifications-lock',()=>{const s=useSettings.getState().settings;useSettings.getState().set({notifications:{...s.notifications,editing:false}});}):undefined;
  const moved=isTauri()?listen('notifications-moved',async()=>{try{const placement=await invoke<{monitor:number;x:number;y:number}>('notifications_placement'),s=useSettings.getState().settings;if(s.notifications.editing&&(Math.abs(s.notifications.x-placement.x)>.1||Math.abs(s.notifications.y-placement.y)>.1||s.notifications.monitor!==placement.monitor))useSettings.getState().set({notifications:{...s.notifications,...placement}});}catch(e){errors.current(String(e));}}):undefined;
  return()=>{clearInterval(timer);unsubscribe();window.removeEventListener('notifications-test',test);for(const listener of [ready,lock,moved])if(listener)void listener.then(fn=>fn());};
 },[]);return null;
}
