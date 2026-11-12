import {useEffect, useState} from 'react';
import {isTauri} from '@tauri-apps/api/core';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {Copy, Minus, Square, X} from 'lucide-react';

export default function WindowControls({onError}: {onError: (message: string) => void}) {
 const [maximized, setMaximized] = useState(false);

 useEffect(() => {
  if (!isTauri()) return;
  const window = getCurrentWindow();
  let active = true;
  const refresh = () => void window.isMaximized().then(value => {
   if (active) setMaximized(value);
  }).catch(error => { if (active) onError(String(error)); });
  refresh();
  const listener = window.onResized(refresh);
  void listener.catch(error => { if (active) onError(String(error)); });
  return () => {
   active = false;
   void listener.then(unlisten => unlisten()).catch(() => {});
  };
 }, [onError]);

 if (!isTauri()) return null;
 const window = getCurrentWindow();
 const run = (action: Promise<void>) => void action.catch(error => onError(String(error)));
 const maximizeLabel = maximized ? 'Restore window' : 'Maximize window';

 return <div className="window-controls" role="group" aria-label="Window controls">
  <button type="button" aria-label="Minimize window" title="Minimize" onClick={() => run(window.minimize())}><Minus size={16}/></button>
  <button type="button" aria-label={maximizeLabel} title={maximizeLabel} onClick={() => run(window.toggleMaximize())}>{maximized ? <Copy size={13}/> : <Square size={13}/>}</button>
  <button type="button" className="window-close" aria-label="Close window" title="Close" onClick={() => run(window.close())}><X size={17}/></button>
 </div>;
}
