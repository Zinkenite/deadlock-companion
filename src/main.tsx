import SettingsPanel from './AppSettings';
import {pinPoint,defaultAlignment,useCapture,markerFacing} from './screen';
import type {MapCalibration} from './MapRenderer';
import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Settings as SettingsIcon,ScanText,Crosshair,Clock,Play,Pause,RotateCcw} from 'lucide-react';
import CaptureSetup from './CaptureSetup';
import MapRenderer from './MapRenderer';
import {useMatch,useSettings,startScreenReading} from './store';
import {fresh} from './readings';
import {applyNative} from './native';
import './styles.css';
const clock=(v:number|undefined)=>v===undefined?'—:—':`${Math.floor(v/60).toString().padStart(2,'0')}:${Math.floor(v%60).toString().padStart(2,'0')}`;
function App(){
 const{settings:s,set}=useSettings(),match=useMatch(),capture=useCapture();const[now,time]=useState(Date.now()),[setup,showSetup]=useState(false),[settings,showSettings]=useState(false),[session,setSession]=useState(0),[error,setError]=useState(''),[calibration,setCalibration]=useState<MapCalibration>();
 useEffect(()=>{if(!s.readingEnabled){useMatch.setState({status:'idle'});return;}return startScreenReading();},[s.readingEnabled,s.capture,session]);
 useEffect(()=>{void applyNative(s).catch(e=>setError(String(e)));},[s.alwaysOnTop,s.tray,s.startMinimized]);
 useEffect(()=>{const t=setInterval(()=>time(Date.now()),500);return()=>clearInterval(t);},[]);
 const openSetup=()=>{setCalibration(undefined);showSetup(true);};
 const beginCalibration=(snapshot=false)=>{const config=useSettings.getState().settings.capture,observed=useCapture.getState();showSetup(false);setCalibration({config:{...config,alignment:{...config.alignment}},raw:!snapshot&&observed.rawPoint&&observed.rawAt&&Date.now()-observed.rawAt<30000?observed.rawPoint:config.anchor});};
 const updateAlignment=(key:keyof typeof defaultAlignment,value:number)=>setCalibration(c=>c?{...c,config:{...c.config,alignment:{...c.config.alignment,[key]:value}}}:c);
 const status=!s.readingEnabled?'Paused':match.status==='tracking'?'Tracking':match.status==='reading'?'Reading timer':'Waiting for game';
 const configured=s.capture.mapEnabled&&s.capture.configured||!!s.capture.textRegions.timer,timer=match.data.timer,timerFresh=fresh(timer,now,Math.max(3000,s.capture.ocrInterval*2.5));
 const newSession=()=>{useMatch.getState().clear();useCapture.setState({text:{},rawPoint:undefined,rawAt:undefined,confidence:0});setSession(v=>v+1);};
 return <div className={`app minimal-app ${calibration?'calibrating':''}`} style={{fontSize:14,zoom:s.uiScale,height:`${100/s.uiScale}dvh`,minHeight:0}}>
 <header><div className="brand"><div className="brand-mark">D<span>◈</span></div><div><strong>DEADLOCK</strong><span>SCREEN COMPANION</span></div></div><div className="header-right"><span className={`status-dot ${match.status==='idle'||match.status==='waiting'?'idle':''}`}/>{status}<button title="App settings" aria-label="Open app settings" onClick={()=>showSettings(true)}><SettingsIcon size={18}/></button></div></header>
 <div className="map-toolbar"><div className={`timer-display ${!timerFresh?'stale-value':''}`}><Clock size={18}/><strong>{clock(timer?.value)}</strong>{timer&&!timerFresh&&<small>Stale</small>}</div><div className="workspace-actions"><button onClick={openSetup}><ScanText size={15}/>Screen setup</button><button disabled={!configured} aria-label={s.readingEnabled?'Pause screen reading':'Start screen reading'} onClick={()=>set({readingEnabled:!s.readingEnabled})}>{s.readingEnabled?<Pause size={14}/>:<Play size={14}/>}</button><button title="Reset readings for a new match" aria-label="Reset readings" onClick={newSession}><RotateCcw size={14}/></button></div></div>
 {!configured&&<div className="welcome-card"><ScanText size={22}/><div><strong>Set up your game screen</strong><p>Select the minimap and match timer, then choose your marker.</p></div><button className="primary" onClick={openSetup}>Set up screen reading</button></div>}
 {error&&<p className="notice" role="alert">Desktop settings: {error}</p>}
 <main className="minimal-main"><section className="map-panel"><div className="panel-header"><div><Crosshair size={16}/><h2>Tactical map</h2></div><button disabled={!s.capture.mapEnabled||!s.capture.configured} onClick={()=>beginCalibration()}>Calibrate position</button></div>
 {calibration&&<div className="inline-calibration"><div><strong>Drag the marker to your true location</strong><span>Frozen observation · Space + drag pans · wheel zooms</span></div><div className="calibration-actions"><button onClick={()=>{set({capture:calibration.config});setCalibration(undefined);}}>Save alignment</button><button onClick={()=>setCalibration(undefined)}>Cancel</button></div><div className="calibration-tuning">{(['offsetX','offsetY','scaleX','scaleY','rotation']as const).map(key=><label key={key}><span>{({offsetX:'X offset',offsetY:'Y offset',scaleX:'X scale',scaleY:'Y scale',rotation:'Rotation'})[key]}</span><input aria-label={`Alignment ${key}`} type="number" step={key==='rotation'?.5:.001} min={key.startsWith('scale')?.1:undefined} value={Math.round(calibration.config.alignment[key]*10000)/10000} onChange={e=>{const v=+e.target.value;if(Number.isFinite(v)&&(!key.startsWith('scale')||v>0))updateAlignment(key,v);}}/></label>)}<label><span>Orientation</span><select aria-label="Map orientation" value={calibration.config.rotation} onChange={e=>setCalibration({...calibration,config:{...calibration.config,rotation:+e.target.value}})}>{[0,90,180,270].map(v=><option key={v} value={v}>{v}°</option>)}</select></label><button onClick={()=>setCalibration({...calibration,config:{...calibration.config,alignment:defaultAlignment,rotation:0}})}>Reset</button></div></div>}<MapRenderer calibration={calibration} onPin={target=>setCalibration(c=>c?{...c,config:{...c.config,alignment:pinPoint(c.raw,target,c.config)}}:c)}/>
 </section></main><footer><span>{capture.message}</span><span>{capture.processingMs.toFixed(1)} ms · {Math.round(capture.confidence*100)}% tracking confidence{capture.facing!==undefined?" · Facing "+Math.round(markerFacing(capture.facing,s.capture))+"°":(s.capture.matchMode==='template'||s.capture.simpleDirection)?" · Direction not detected":""}</span></footer>
 {settings&&<SettingsPanel close={()=>showSettings(false)}/>} {setup&&<CaptureSetup close={()=>showSetup(false)} onCalibrate={()=>beginCalibration(true)}/>}</div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
