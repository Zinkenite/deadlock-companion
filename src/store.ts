import releaseDefaults from './releaseDefaults';
import {defaultLoot,sanitizeLoot,type LootSettings} from './loot';
import {defaultGameReader,sanitizeGameReader,readerTimerSample,useGameReader,type GameReaderSettings} from './gameReader';
import type {MapSide} from './mapOrientation';
import {defaultNotifications,sanitizeNotifications,type NotificationSettings} from './notifications';
import {sanitizeCustomMarkers} from './customMarkerData';
import type {MapMarker} from './map';
import {defaultIconSettings,sanitizeIconSettings,type IconSettings} from './iconSettings';
import {defaultCompass,sanitizeCompass,type CompassSettings} from './compass';
import {create} from 'zustand';
import {defaultMapLayers,migrateMapLayers,defaultMapIconSizes,migrateMapIconSizes,type MapIconSizes,type MapLayers,type MapLevel} from './map';
import {persist} from 'zustand/middleware';
import {ScreenReader,defaultCapture,defaultAlignment,type CaptureSettings} from './screen';
import {validate,type Snapshot,type Status} from './readings';
export type Settings={loot:LootSettings;gameReader:GameReaderSettings;mapSide:MapSide;notifications:NotificationSettings;customMarkers:MapMarker[];iconSettings:IconSettings;compass:CompassSettings;readingEnabled:boolean;capture:CaptureSettings;alwaysOnTop:boolean;autostart:boolean;startMinimized:boolean;tray:boolean;markerSize:number;followOnMatchStart:boolean;matchStartZoom:number;uiScale:number;performance:boolean;animations:boolean;objectives:boolean;mapLayers:MapLayers;mapLevel:MapLevel;mapIconSize:number;mapIconSizes:MapIconSizes};
const defaults:Settings={loot:defaultLoot,gameReader:defaultGameReader,mapSide:'hiddenKing',notifications:defaultNotifications,customMarkers:[],iconSettings:defaultIconSettings(),compass:defaultCompass,readingEnabled:false,capture:defaultCapture,alwaysOnTop:false,autostart:false,startMinimized:false,tray:true,markerSize:22,followOnMatchStart:false,matchStartZoom:2,uiScale:1,performance:false,animations:true,objectives:true,mapLayers:defaultMapLayers,mapLevel:'street',mapIconSize:20,mapIconSizes:defaultMapIconSizes};
export function migrateSettings(raw:any):Settings{
 const old=raw?.settings??{};const result={...defaults};for(const key of Object.keys(defaults))if(key!=='capture'&&key!=='readingEnabled'&&old[key]!==undefined)(result as any)[key]=old[key];
 for (const key of ['alwaysOnTop','autostart','startMinimized','tray','performance','animations','objectives'] as const) {
  result[key]=typeof old[key]==='boolean'?old[key]:defaults[key];
 }
 for (const [key,min,max] of [['markerSize',14,40],['uiScale',.8,1.3]] as const) {
  result[key]=typeof old[key]==='number'&&Number.isFinite(old[key])?Math.max(min,Math.min(max,old[key])):defaults[key];
 }
 result.followOnMatchStart=old.followOnMatchStart===true;
 result.matchStartZoom=typeof old.matchStartZoom==='number'&&Number.isFinite(old.matchStartZoom)?Math.max(.5,Math.min(8,old.matchStartZoom)):defaults.matchStartZoom;
 result.gameReader=sanitizeGameReader(old.gameReader);
 result.mapSide=old.mapSide==='archMother'?'archMother':'hiddenKing';
 result.loot=sanitizeLoot(old.loot,old.mapSide==='archMother'?'archMother':'hiddenKing');
 result.notifications=sanitizeNotifications(old.notifications);
 result.customMarkers=sanitizeCustomMarkers(old.customMarkers);
 result.compass=sanitizeCompass(old.compass);
 result.iconSettings=sanitizeIconSettings(old.iconSettings,old.compass);
 result.mapLayers=migrateMapLayers(old.mapLayers);
 result.mapLevel=['street','mid_tunnels','rat_tunnels'].includes(old.mapLevel)?old.mapLevel:'street';
 result.mapIconSize=typeof old.mapIconSize==='number'&&Number.isFinite(old.mapIconSize)?Math.max(12,Math.min(32,old.mapIconSize)):20;
 result.mapIconSizes=migrateMapIconSizes(old.mapIconSizes,result.mapIconSize);
 const savedTemplate=old.capture?.markerTemplate;
 const markerTemplate=savedTemplate?{...savedTemplate,initialHeading:Number.isFinite(savedTemplate.initialHeading)?((savedTemplate.initialHeading%360)+360)%360:0,centerX:Math.max(0,Math.min(1,Number.isFinite(savedTemplate.centerX)?savedTemplate.centerX:.5)),centerY:Math.max(0,Math.min(1,Number.isFinite(savedTemplate.centerY)?savedTemplate.centerY:.5))}:undefined;
 result.capture={...defaultCapture,...old.capture,alignment:{...defaultAlignment,...old.capture?.alignment},markerTemplate,anchor:old.capture?.anchor??defaultCapture.anchor,matchMode:'color',ocrInterval:typeof old.capture?.ocrInterval==='number'&&Number.isFinite(old.capture.ocrInterval)?Math.max(500,Math.min(3000,old.capture.ocrInterval)):1000,textRegions:old.capture?.textRegions?.timer?.region?{timer:{region:old.capture.textRegions.timer.region}}:{}};
 result.readingEnabled=typeof old.readingEnabled==='boolean'?old.readingEnabled:false;return result;
}
export const useSettings=create<{settings:Settings;set:(patch:Partial<Settings>)=>void}>()(persist(set=>({settings:migrateSettings({settings:releaseDefaults}),set:patch=>set(s=>({settings:{...s.settings,...patch}}))}),{name:'deadlock-settings-v1',version:7,migrate:(raw)=>({settings:migrateSettings(raw)}) as any,merge:(saved,current)=>({...current,settings:saved===undefined?current.settings:migrateSettings(saved)})}));
export const useMatch=create<{data:Snapshot;previousMapPosition?:Snapshot['mapPosition'];status:Status;timestamps:number[];ingest:(s:Snapshot)=>void;clear:()=>void}>(set=>({data:{},status:'idle',timestamps:[],clear:()=>set({data:{},previousMapPosition:undefined,status:'idle',timestamps:[]}),ingest:raw=>set(s=>{
 const data=validate(raw),now=Date.now(),accepted:Snapshot={};for(const[k,v]of Object.entries(data))if(v.at>=((s.data as any)[k]?.at??0))(accepted as any)[k]=v;
 return{data:{...s.data,...accepted},previousMapPosition:accepted.mapPosition?s.data.mapPosition:s.previousMapPosition,timestamps:Object.keys(accepted).length?[...s.timestamps.filter(t=>now-t<5000),now]:s.timestamps};
})}));
export const startScreenReading=()=>new ScreenReader(()=>useSettings.getState().settings.capture,()=>useSettings.getState().settings.performance,()=>{const s=useSettings.getState().settings;if(!s.gameReader.enabled||!s.gameReader.useTimer)return;const reader=useGameReader.getState();if(reader.enabled&&reader.inMatch===false)return'inactive';return readerTimerSample();}).start(useMatch.getState().ingest,status=>useMatch.setState({status}));


