import {matchEngine,useMatchAnalysis} from './matchAnalytics';
import {useEffect,useRef} from 'react';
import {invoke,isTauri} from '@tauri-apps/api/core';
import {listen} from '@tauri-apps/api/event';
import {useSettings,useMatch} from './store';
import {useCapture} from './screen';
import {useGameReader,readerTimerSample,type GameReaderSnapshot} from './gameReader';
export default function GameReaderBridge({onError}:{onError:(message:string)=>void}){
 const config=useSettings(s=>s.settings.gameReader),queue=useRef(Promise.resolve()),errors=useRef(onError);errors.current=onError;
 useEffect(()=>{if(!isTauri())return;queue.current=queue.current.catch(()=>{}).then(()=>invoke<void>('configure_game_reader',{config})).catch(e=>errors.current(String(e)));},[config]);
 useEffect(()=>{if(!isTauri())return;let active=true,lastMatchId:number|null=null;const accept=(snapshot:GameReaderSnapshot)=>{if(!active)return;const previous=useGameReader.getState(),s=useSettings.getState().settings;useGameReader.setState(snapshot);useMatchAnalysis.setState(matchEngine.update(snapshot),true);
  if(!s.gameReader.enabled)return;const newMatch=snapshot.inMatch===true&&snapshot.matchId!==null&&lastMatchId!==null&&lastMatchId!==snapshot.matchId;if(snapshot.matchId!==null&&snapshot.inMatch===true)lastMatchId=snapshot.matchId;
  if(newMatch||previous.inMatch===true&&snapshot.inMatch===false){useMatch.setState(state=>({data:{...state.data,timer:undefined}}));}
  if(s.gameReader.autoSide&&snapshot.inMatch===true&&snapshot.side&&snapshot.side!==s.mapSide)useSettings.getState().set({mapSide:snapshot.side});
  if(s.gameReader.useTimer){const timer=readerTimerSample();if(timer){const old=useMatch.getState().data.timer;if(!old||timer.at>old.at)useMatch.getState().ingest({timer});useCapture.setState({text:{...useCapture.getState().text,timer:{text:Math.floor(timer.value/60)+':'+String(Math.floor(timer.value%60)).padStart(2,'0'),at:timer.at,accepted:true}},...!s.capture.mapEnabled||!s.capture.configured?{message:snapshot.paused?'Match timer paused · game reader':'Reading match timer · game reader'}:{}});if(s.readingEnabled&&useMatch.getState().status!=='tracking')useMatch.setState({status:'reading'});}}
 };const listener=listen<GameReaderSnapshot>('game-reader-state',e=>accept(e.payload));void listener.then(()=>invoke<GameReaderSnapshot>('game_reader_state')).then(accept).catch(e=>errors.current(String(e)));return()=>{active=false;void listener.then(fn=>fn());};},[]);return null;
}
