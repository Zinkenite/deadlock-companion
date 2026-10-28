import {sideFacing} from './mapOrientation';
import NotificationsBridge from './NotificationsBridge';
import NotificationsOverlay from './NotificationsOverlay';
import './notifications.css';
import CompassBridge from './CompassBridge';
import CompassOverlay from './CompassOverlay';
import './compass.css';
import SettingsPanel from './AppSettings';
import {pinPoint,defaultAlignment,useCapture,markerFacing} from './screen';
import type {MapCalibration} from './MapRenderer';
import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Settings as SettingsIcon,Map as MapIcon,ScanText,Crosshair,Clock,Play,Pause,RotateCcw} from 'lucide-react';
import CaptureSetup from './CaptureSetup';
import MapRenderer from './MapRenderer';
import {useMatch,useSettings,startScreenReading} from './store';
import {fresh} from './readings';
import {applyNative} from './native';
import './styles.css';
import './workspace.css';
const clock=(v:number|undefined)=>v===undefined?'—:—':`${Math.floor(v/60).toString().padStart(2,'0')}:${Math.floor(v%60).toString().padStart(2,'0')}`;
function TimerDisplay(){const timer=useMatch(state=>state.data.timer),interval=useSettings(state=>state.settings.capture.ocrInterval),[now,time]=useState(Date.now());useEffect(()=>{const id=setInterval(()=>time(Date.now()),500);return()=>clearInterval(id);},[]);const timerFresh=fresh(timer,now,Math.max(3000,interval*2.5));return <div className={`timer-display ${!timerFresh?'stale-value':''}`}><Clock size={18}/><strong>{clock(timer?.value)}</strong>{timer&&!timerFresh&&<small>Stale</small>}</div>;}
function CaptureFooter(){const capture=useCapture(),config=useSettings(s=>s.settings.capture),side=useSettings(s=>s.settings.mapSide);return <footer><span>{capture.message}</span><span>{capture.processingMs.toFixed(1)} ms · {Math.round(capture.confidence*100)}% tracking confidence{capture.facing!==undefined?" · Facing "+Math.round(sideFacing(markerFacing(capture.facing,config),side))+"°":(config.matchMode==='template'||config.simpleDirection)?" · Direction not detected":""}</span></footer>;}
function App(){
 const{settings:s,set}=useSettings(),matchStatus=useMatch(state=>state.status);const[tab,setTab]=useState<'map'|'settings'|'setup'>('map'),[setupVisited,visitSetup]=useState(false),[session,setSession]=useState(0),[error,setError]=useState(''),[calibration,setCalibration]=useState<MapCalibration>();
 useEffect(()=>{if(!s.readingEnabled){useMatch.setState({status:'idle'});return;}return startScreenReading();},[s.readingEnabled,s.capture,session]);
 useEffect(()=>{void applyNative(s).catch(e=>setError(String(e)));},[s.alwaysOnTop,s.tray,s.startMinimized]);
 const switchTab=(next:'map'|'settings'|'setup')=>{if(next==='setup')visitSetup(true);if(next!=='settings'&&(s.compass.editing||s.notifications.editing))set({compass:{...s.compass,editing:false},notifications:{...s.notifications,editing:false}});setTab(next);};
 const openSetup=()=>{setCalibration(undefined);switchTab('setup');};
 const beginCalibration=(snapshot=false)=>{const config=useSettings.getState().settings.capture,observed=useCapture.getState();setTab('map');setCalibration({config:{...config,alignment:{...config.alignment}},raw:!snapshot&&observed.rawPoint&&observed.rawAt&&Date.now()-observed.rawAt<30000?observed.rawPoint:config.anchor});};
 const updateAlignment=(key:keyof typeof defaultAlignment,value:number)=>setCalibration(c=>c?{...c,config:{...c.config,alignment:{...c.config.alignment,[key]:value}}}:c);
 const status=!s.readingEnabled?'Paused':matchStatus==='tracking'?'Tracking':matchStatus==='reading'?'Reading timer':'Waiting for game';
 const configured=s.capture.mapEnabled&&s.capture.configured||!!s.capture.textRegions.timer;
 const newSession=()=>{useMatch.getState().clear();useCapture.setState({text:{},rawPoint:undefined,rawAt:undefined,confidence:0});setSession(v=>v+1);};
 return <div className={`app minimal-app ${calibration?'calibrating':''}`} data-motion={s.animations?'on':'off'} style={{fontSize:14,zoom:s.uiScale,height:`${100/s.uiScale}dvh`,minHeight:0}}>
 <CompassBridge onError={setError}/><NotificationsBridge onError={setError}/><header><div className="brand"><div className="brand-mark">D<span>◈</span></div><div><strong>DEADLOCK</strong><span>SCREEN COMPANION</span></div></div><div className="header-right"><span className={`status-dot ${matchStatus==='idle'||matchStatus==='waiting'?'idle':''}`}/>{status}</div></header>
 <div className="map-toolbar workspace-toolbar"><nav className="workspace-tabs" role="tablist" aria-label="Workspace">{([{id:'map',label:'Map',icon:MapIcon},{id:'settings',label:'Settings',icon:SettingsIcon},{id:'setup',label:'Screen setup',icon:ScanText}]as const).map(({id,label,icon:Icon},i)=><button role="tab" id={'tab-'+id} aria-controls={'view-'+id} aria-selected={tab===id} tabIndex={tab===id?0:-1} className={tab===id?'active':''} key={id} onClick={()=>switchTab(id)} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const ids=['map','settings','setup']as const,next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;switchTab(ids[next]);document.getElementById('tab-'+ids[next])?.focus();}}}><Icon size={15}/>{label}</button>)}</nav><TimerDisplay/><div className="workspace-actions"><button disabled={!configured} aria-label={s.readingEnabled?'Pause screen reading':'Start screen reading'} onClick={()=>set({readingEnabled:!s.readingEnabled})}>{s.readingEnabled?<Pause size={14}/>:<Play size={14}/>}</button><button title="Reset readings for a new match" aria-label="Reset readings" onClick={newSession}><RotateCcw size={14}/></button></div></div>
 {!configured&&tab==='map'&&<div className="welcome-card"><ScanText size={22}/><div><strong>Set up your game screen</strong><p>Select the minimap and match timer, then choose your marker.</p></div><button className="primary" onClick={openSetup}>Set up screen reading</button></div>}
 {error&&<p className="notice" role="alert">Desktop settings: {error}</p>}
 <main className="minimal-main workspace-content"><section id="view-map" role="tabpanel" aria-labelledby="tab-map" hidden={tab!=='map'} className="map-panel workspace-page"><div className="panel-header"><div><Crosshair size={16}/><h2>Tactical map</h2></div><button disabled={!s.capture.mapEnabled||!s.capture.configured} onClick={()=>beginCalibration()}>Calibrate position</button></div>
 {calibration&&<div className="inline-calibration"><div><strong>Drag the marker to your true location</strong><span>Frozen observation · Space + drag pans · wheel zooms</span></div><div className="calibration-actions"><button onClick={()=>{set({capture:calibration.config});setCalibration(undefined);}}>Save alignment</button><button onClick={()=>setCalibration(undefined)}>Cancel</button></div><div className="calibration-tuning">{(['offsetX','offsetY','scaleX','scaleY','rotation']as const).map(key=><label key={key}><span>{({offsetX:'X offset',offsetY:'Y offset',scaleX:'X scale',scaleY:'Y scale',rotation:'Rotation'})[key]}</span><input aria-label={`Alignment ${key}`} type="number" step={key==='rotation'?.5:.001} min={key.startsWith('scale')?.1:undefined} value={Math.round(calibration.config.alignment[key]*10000)/10000} onChange={e=>{const v=+e.target.value;if(Number.isFinite(v)&&(!key.startsWith('scale')||v>0))updateAlignment(key,v);}}/></label>)}<label><span>Orientation</span><select aria-label="Map orientation" value={calibration.config.rotation} onChange={e=>setCalibration({...calibration,config:{...calibration.config,rotation:+e.target.value}})}>{[0,90,180,270].map(v=><option key={v} value={v}>{v}°</option>)}</select></label><button onClick={()=>setCalibration({...calibration,config:{...calibration.config,alignment:defaultAlignment,rotation:0}})}>Reset</button></div></div>}<MapRenderer calibration={calibration} onPin={target=>setCalibration(c=>c?{...c,config:{...c.config,alignment:pinPoint(c.raw,target,c.config)}}:c)}/>
 </section><section hidden={tab!=='settings'} id="view-settings" role="tabpanel" aria-labelledby="tab-settings" className="workspace-page"><SettingsPanel close={()=>switchTab('map')}/></section><section hidden={tab!=='setup'} id="view-setup" role="tabpanel" aria-labelledby="tab-setup" className="workspace-page">{setupVisited&&<CaptureSetup embedded close={()=>switchTab('map')} onCalibrate={()=>beginCalibration(true)}/>}</section></main><CaptureFooter/>
</div>;
}
const overlay=location.hash==='#compass',notifications=location.hash==='#notifications';if(overlay)document.documentElement.classList.add('compass-window');if(notifications)document.documentElement.classList.add('notifications-window');
createRoot(document.getElementById('root')!).render(overlay?<CompassOverlay/>:notifications?<NotificationsOverlay/>:<App/>);
