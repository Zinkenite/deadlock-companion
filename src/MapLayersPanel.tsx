import {useState} from 'react';
import {RotateCcw,X} from 'lucide-react';
import {useSettings} from './store';
import {defaultMapLayers,defaultMapIconSizes,layerKeys,mapGroups,mapLayerInfo,markerTitle,type MapCatalog,type MapGroup,type MapLayer,type MapMarker} from './map';
export default function MapLayersPanel({catalog,close,onLocate}:{catalog?:MapCatalog;close:()=>void;onLocate:(marker:MapMarker)=>void}){
 const {settings:s,set}=useSettings(),[query,search]=useState('');
 const enabled=(key:MapLayer)=>s.mapLayers[key]&&(mapLayerInfo[key].group!=='objectives'||s.objectives);
 const counts=new Map<MapLayer,number>();for(const m of catalog?.markers??[])counts.set(m.category,(counts.get(m.category)??0)+1);counts.set('ziplines',3);
 const change=(keys:MapLayer[],on:boolean)=>set({mapLayers:{...s.mapLayers,...Object.fromEntries(keys.map(key=>[key,on]))},...(on&&keys.some(key=>mapLayerInfo[key].group==='objectives')?{objectives:true}:{})});
 const groupKeys=(group:MapGroup)=>layerKeys.filter(key=>mapLayerInfo[key].group===group);
 const results=query.trim()?catalog?.markers.filter(m=>(markerTitle(m)+' '+m.label).toLowerCase().includes(query.trim().toLowerCase())).slice(0,20):undefined;
 return <section className="map-layer-panel" aria-label="Map layers"><div className="map-layer-heading"><strong>Map layers</strong><button aria-label="Close map layers" onClick={close}><X size={16}/></button></div><div className="map-layer-body">
 <label className="map-level-label">Map artwork<select aria-label="Map artwork" value={s.mapLevel} onChange={e=>set({mapLevel:e.target.value as typeof s.mapLevel})}><option value="street">Street</option><option value="mid_tunnels">Street + mid tunnels</option><option value="rat_tunnels">Street + rat tunnels</option></select></label><p className="map-layer-help">Locations across all heights stay visible.</p>
 <label className="map-search-label">Find a location<input aria-label="Find a map location" type="search" value={query} onChange={e=>search(e.target.value)} placeholder="Shop, camp, teleporter…"/></label>
 {results&&<div className="map-search-results" aria-label="Location results">{results.length?results.map(m=><button key={m.id} onClick={()=>onLocate(m)}><strong>{markerTitle(m)}</strong><span>{m.label}</span></button>):<p>No matching locations.</p>}</div>}
 <div className="map-layer-actions"><button onClick={()=>change(layerKeys,true)}>Show all</button><button onClick={()=>change(layerKeys,false)}>Hide all</button><button aria-label="Restore default map layers" title="Restore default layers" onClick={()=>set({mapLayers:{...defaultMapLayers},objectives:true,mapLevel:'street',mapIconSize:20,mapIconSizes:{...defaultMapIconSizes}})}><RotateCcw size={14}/></button></div>
 {mapGroups.map(group=>{const keys=groupKeys(group.id),all=keys.every(enabled);return <div className="map-layer-group" key={group.id}><div className="map-layer-group-heading"><strong>{group.label}</strong><button onClick={()=>change(keys,!all)}>{all?'Hide':'Show'} group</button></div><label className="map-level-label"><span>Icon size · {s.mapIconSizes[group.id]} px</span><input aria-label={`${group.label} icon size`} type="range" min={12} max={32} value={s.mapIconSizes[group.id]} onChange={e=>set({mapIconSizes:{...s.mapIconSizes,[group.id]:+e.target.value}})}/></label>{keys.map(key=><label className="map-layer-option" key={key}><input type="checkbox" aria-label={mapLayerInfo[key].label} checked={enabled(key)} onChange={e=>change([key],e.target.checked)}/><span>{mapLayerInfo[key].label}</span><small>{counts.get(key)??'—'}</small></label>)}</div>;})}
 <p className="map-layer-help">Fixed references show possible locations. Availability is not tracked. Dots mark features without a verified game icon.</p><p className="map-layer-help">Mid Boss, shrines and stairs await confirmed positions.</p>
 </div></section>;
}


