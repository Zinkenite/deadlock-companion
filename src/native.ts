import {isTauri,invoke} from '@tauri-apps/api/core';
import {getCurrentWindow,availableMonitors,PhysicalPosition,PhysicalSize} from '@tauri-apps/api/window';
import {enable,disable} from '@tauri-apps/plugin-autostart';
import type {Settings} from './store';
export {isTauri};
export async function applyNative(s:Settings){if(!isTauri())return;await getCurrentWindow().setAlwaysOnTop(s.alwaysOnTop);await invoke('configure',{tray:s.tray,startMinimized:s.startMinimized});}
export async function setAutostart(on:boolean){if(!isTauri())throw Error('Available in the desktop app.');await(on?enable():disable());}
export async function monitors(){return isTauri()?availableMonitors():[];}
export async function moveMonitor(index:number){const m=(await monitors())[index];if(!m)return;const w=getCurrentWindow();await w.setPosition(new PhysicalPosition(m.position.x+40,m.position.y+40));await w.setSize(new PhysicalSize(Math.min(1440,m.size.width-80),Math.min(1000,m.size.height-80)));}
export async function setWindowSize(width:number,height:number){if(!isTauri())throw Error('Available in the desktop app.');await getCurrentWindow().setSize(new PhysicalSize(width,height));}
