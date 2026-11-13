import {useGameReader} from './gameReader';
import {useEffect,useState} from 'react';
import {getVersion} from '@tauri-apps/api/app';
import {invoke,isTauri} from '@tauri-apps/api/core';

const endpoint='https://api.github.com/repos/Zinkenite/deadlock-companion/releases/latest';
function versionParts(value:string):number[]|null {
 const match=/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z.-]+)?$/.exec(value);
 if(!match)return null;
 const parts=match.slice(1,4).map(Number);
 return parts.every(Number.isSafeInteger)?parts:null;
}
export function newerStable(candidate:string,current:string):boolean {
 const next=versionParts(candidate),installed=versionParts(current);
 if(!next||!installed)return false;
 for(let i=0;i<3;i++){if(next[i]!==installed[i])return next[i]>installed[i];}
 return false;
}
export default function Updates({startup=false}:{startup?:boolean}){
 const inMatch=useGameReader(s=>s.inMatch); const [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [installed,setInstalled]=useState(''),[release,setRelease]=useState<{tag:string;notes:string;date:string}|null>(null);
 async function check(){
  setBusy(true);
  try{
   const current=await getVersion();setInstalled(current);
   const response=await fetch(endpoint,{signal:AbortSignal.timeout(10000),headers:{Accept:'application/vnd.github+json'}});
   if(response.status===404){setMessage('No stable release has been published yet.');setRelease(null);return;}
   if(!response.ok)throw Error(response.status===403||response.status===429?'GitHub is limiting requests. Try again later.':'Could not check GitHub releases. Try again later.');
   const data=await response.json();
   if(typeof data.tag_name!=='string'||data.draft||data.prerelease||!versionParts(data.tag_name))throw Error('The latest release has an unsupported version.');
   if(newerStable(data.tag_name,current)){
    if(startup&&localStorage.getItem('spiritlocker-postponed-release')===data.tag_name){setMessage('');return;} setRelease({tag:data.tag_name,notes:typeof data.body==='string'?data.body.slice(0,12000):'',date:typeof data.published_at==='string'?data.published_at.slice(0,10):''});
    setMessage('An update is available.');
   }else{setRelease(null);setMessage('You have the latest published stable version.');}
  }catch(error){setMessage(error instanceof Error?error.message:'Unable to check updates. Check your connection.');}
  finally{setBusy(false);}
 }
 useEffect(()=>{if(isTauri()&&!import.meta.env.DEV)void check();},[]);
 if(startup&&(!release||inMatch===true))return null; if(startup&&release)return <div className="notice" role="status">SpiritLocker {release.tag} is available. <button onClick={()=>void invoke('open_release_page').catch(()=>setMessage('Could not open the release page.'))}>Open release</button><button onClick={()=>{try{localStorage.setItem('spiritlocker-postponed-release',release.tag);}catch{}setRelease(null);}}>Later</button>{message==='Could not open the release page.'&&<span>{message}</span>}</div>; if(!isTauri())return <p className="help">Update checks are available in the Windows app.</p>;
 return <section aria-label="App updates"><h2>SpiritLocker {installed}</h2><button disabled={busy||import.meta.env.DEV} onClick={()=>void check()}>{busy?'Checking…':'Check for updates'}</button><p role="status">{import.meta.env.DEV?'Update checks are disabled in development.':message}</p>{release&&<div><h3>{release.tag}</h3><p>{release.date}</p><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontFamily:'inherit'}}>{release.notes}</pre><button onClick={()=>void invoke('open_release_page').catch(()=>setMessage('Could not open your browser. Visit github.com/Zinkenite/deadlock-companion/releases.'))}>Open GitHub release</button><button onClick={()=>{try{localStorage.setItem('spiritlocker-postponed-release',release.tag);}catch{}setRelease(null);setMessage('Update postponed. Check manually to see it again.');}}>Later</button></div>}<p className="help">Download the Windows release, quit SpiritLocker from the tray, then replace the portable executable. Your saved settings stay on this PC.</p></section>;
}
