import {create} from 'zustand';
import type {MapSide} from './mapOrientation';
import type {Sample} from './readings';
export type GameReaderSettings={enabled:boolean;useTimer:boolean;autoSide:boolean;hideOutsideMatch:boolean;speed:'slow'|'balanced'|'fast';account:string};
export const defaultGameReader:GameReaderSettings={enabled:false,useTimer:true,autoSide:true,hideOutsideMatch:true,speed:'slow',account:''};
export function sanitizeGameReader(raw:unknown):GameReaderSettings{const s=raw&&typeof raw==='object'?raw as Record<string,unknown>:{},out={...defaultGameReader};for(const key of ['enabled','useTimer','autoSide','hideOutsideMatch']as const)if(typeof s[key]==='boolean')out[key]=s[key];if(s.speed==='slow'||s.speed==='balanced'||s.speed==='fast')out.speed=s.speed;if(typeof s.account==='string'&&/^\d{0,17}$/.test(s.account))out.account=s.account;return out;}
export type MatchPlayer={heroDamage?:number|null;accountId:number;name:string;team:number;slot:number;heroId:number;level:number;netWorth:number;kills:number;deaths:number;assists:number;lane:number|null;isUs:boolean;partyId?:string|null};
export type GameReaderSnapshot={enabled:boolean;attached:boolean;status:'disabled'|'waiting'|'account_missing'|'discovering'|'live'|'menu'|'stale';inMatch:boolean|null;side:MapSide|null;timer:number|null;timerAt:number;paused:boolean;pregame:boolean;matchId:number|null;accountDetected:boolean;lastScanMs:number|null;version:string;players:MatchPlayer[];playersAt:number};
export const initialReaderSnapshot:GameReaderSnapshot={enabled:false,attached:false,status:'disabled',inMatch:null,side:null,timer:null,timerAt:0,paused:false,pregame:false,matchId:null,accountDetected:false,lastScanMs:null,version:'1.0.13',players:[],playersAt:0};
export const useGameReader=create<GameReaderSnapshot>(()=>initialReaderSnapshot);
export function readerTimerSample(now=Date.now()):Sample<'timer'>|undefined{const s=useGameReader.getState();return s.enabled&&s.attached&&s.inMatch===true&&s.timer!==null&&Number.isFinite(s.timer)&&s.timer>=0&&s.timer<=43200&&s.timerAt<=now+1000&&now-s.timerAt<=2500?{value:s.timer,at:s.timerAt}:undefined;}

// A roster needs six distinct, populated seats on each side.
export function countRosterSeats(players: MatchPlayer[]): number {
 const hiddenKing = new Set<number>();
 const archMother = new Set<number>();
 for (const player of players) {
  if (!Number.isInteger(player.slot) || player.slot < 0 || player.heroId <= 0) continue;
  if (player.team === 2) hiddenKing.add(player.slot);
  if (player.team === 3) archMother.add(player.slot);
 }
 return Math.min(6, hiddenKing.size) + Math.min(6, archMother.size);
}
