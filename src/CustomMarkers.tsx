import {useState} from 'react';
import {Plus,Settings} from 'lucide-react';
import {useSettings} from './store';
import type {MapMarker} from './map';
import IconSwatch from './IconSwatch';
import {iconStyle} from './iconSettings';
import CustomMarkerDialog from './CustomMarkerDialog';
export default function CustomMarkers({onPlace,onLocate,onSettings}:{onPlace:(id:string)=>void;onLocate:(m:MapMarker)=>void;onSettings:(m:MapMarker)=>void}){
 const{settings:s,set}=useSettings(),[creating,create]=useState(false),[open,expand]=useState(true);
 const toggle=(m:MapMarker,key:'mapVisible'|'compassVisible',on:boolean)=>set({...(key==='mapVisible'&&on?{mapLayers:{...s.mapLayers,custom:true}}:{}),iconSettings:{...s.iconSettings,markers:{...s.iconSettings.markers,[m.id]:{...s.iconSettings.markers[m.id],[key]:on}}}});
 return <section className="layer-group custom-markers-group"><div className="custom-group-heading"><button className="custom-group-title" aria-expanded={open} onClick={()=>expand(!open)}><span className={open?'group-chevron is-open':'group-chevron'}>›</span>Custom markers <small>{s.customMarkers.length}</small></button><button className="add-marker-button" aria-label="Add custom marker" title="Add custom marker" disabled={s.customMarkers.length>=100} onClick={()=>create(true)}><Plus size={16}/></button></div>{open&&<div className="custom-marker-list">{!s.customMarkers.length&&<p className="custom-empty">Your places, your icons.<br/><span>Use + to add a marker.</span></p>}{s.customMarkers.map(m=>{const style=iconStyle(s.iconSettings,m);return <div className="layer-icon-row" key={m.id}><IconSwatch src={m.icon} tint={style.tint}/><button className="layer-name" title={'Locate '+m.label} onClick={()=>onLocate(m)}>{m.label}</button><input type="checkbox" aria-label={'Map visibility '+m.label} checked={s.mapLayers.custom&&style.mapVisible!==false} onChange={e=>toggle(m,'mapVisible',e.target.checked)}/><input type="checkbox" aria-label={'Compass visibility '+m.label} checked={!!style.compassVisible} onChange={e=>toggle(m,'compassVisible',e.target.checked)}/><button aria-label={'Settings for '+m.label} onClick={()=>onSettings(m)}><Settings size={15}/></button></div>;})}</div>}{creating&&<CustomMarkerDialog close={()=>create(false)} onCreate={id=>{create(false);expand(true);onPlace(id);}}/>}</section>;
}
