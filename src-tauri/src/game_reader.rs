//! Optional, pinned DeadChaps core integration. Exports a bounded local match snapshot.
use std::sync::{Mutex,Arc,mpsc::{self,SyncSender,Receiver},atomic::{AtomicBool,AtomicI8,Ordering}};
use serde::{Deserialize,Serialize};
use tauri::{Manager,Emitter,WebviewWindow};
use deadchaps_reader::{GameMemory,Hooks,MemoryView,protocol::Speed};
#[derive(Clone,Deserialize)]#[serde(rename_all="camelCase")]
pub struct Config{enabled:bool,hide_outside_match:bool,speed:String,account:String}
impl Default for Config{fn default()->Self{Self{enabled:false,hide_outside_match:true,speed:"slow".into(),account:String::new()}}}
#[derive(Clone,Debug,PartialEq,Serialize)]#[serde(rename_all="camelCase")]
pub struct Player{hero_damage:Option<u32>,account_id:u32,name:String,team:u8,slot:u8,hero_id:u32,level:u32,net_worth:u32,kills:u32,deaths:u32,assists:u32,lane:Option<u8>,is_us:bool}
#[derive(Clone,Debug,PartialEq,Serialize)]#[serde(rename_all="camelCase")]
pub struct Snapshot{enabled:bool,attached:bool,status:String,in_match:Option<bool>,side:Option<String>,timer:Option<f64>,timer_at:u64,paused:bool,pregame:bool,match_id:Option<u64>,account_detected:bool,last_scan_ms:Option<u64>,version:&'static str,players:Vec<Player>,players_at:u64}
impl Default for Snapshot{fn default()->Self{Self{enabled:false,attached:false,status:"disabled".into(),in_match:None,side:None,timer:None,timer_at:0,paused:false,pregame:false,match_id:None,account_detected:false,last_scan_ms:None,version:"1.0.13",players:Vec::new(),players_at:0}}}
pub struct Reader{memory:Mutex<Option<GameMemory>>,config:Arc<Mutex<Config>>,snapshot:Mutex<Snapshot>,wake:SyncSender<()>,receive:Mutex<Option<Receiver<()>>>,enabled:AtomicBool,hide_outside:AtomicBool,in_match:AtomicI8,running:AtomicBool}
impl Reader{
 pub fn new()->Self{let(tx,rx)=mpsc::sync_channel(1);Self{memory:Mutex::new(None),config:Arc::new(Mutex::new(Config::default())),snapshot:Mutex::new(Snapshot::default()),wake:tx,receive:Mutex::new(Some(rx)),enabled:AtomicBool::new(false),hide_outside:AtomicBool::new(true),in_match:AtomicI8::new(-1),running:AtomicBool::new(false)}}
 pub fn hides_compass(&self)->bool{self.enabled.load(Ordering::Relaxed)&&self.hide_outside.load(Ordering::Relaxed)&&self.in_match.load(Ordering::Relaxed)!=1}
}
fn normalize_account(value:&str)->Result<Option<String>,String>{if value.is_empty(){return Ok(None);}let parsed=value.parse::<u64>().map_err(|_|"Enter a Steam account ID or SteamID64 using digits only.")?;let account=if parsed>=76561197960265728{parsed-76561197960265728}else{parsed};if account==0||account>u32::MAX as u64{return Err("That Steam account ID is outside the valid range.".into());}Ok(Some(account.to_string()))}
#[cfg(target_os="windows")]
fn steam_account()->Option<String>{
 use std::ffi::c_void;#[link(name="advapi32")]extern "system"{fn RegGetValueA(key:*mut c_void,subkey:*const u8,value:*const u8,flags:u32,kind:*mut u32,data:*mut c_void,size:*mut u32)->i32;}
 let mut account=0u32;let mut size=4u32;let result=unsafe{RegGetValueA((-2147483647isize)as *mut c_void,b"Software\\Valve\\Steam\\ActiveProcess\0".as_ptr(),b"ActiveUser\0".as_ptr(),0x10,std::ptr::null_mut(),(&mut account as *mut u32).cast(),&mut size)};
 (result==0&&size==4&&account!=0).then(||account.to_string())
}
#[cfg(not(target_os="windows"))]fn steam_account()->Option<String>{None}
fn account(config:&Config)->Option<String>{normalize_account(&config.account).ok().flatten().or_else(steam_account)}
fn summarize(view:&MemoryView,config:&Config,detected:bool,now:u64)->Snapshot{
 let mut out=Snapshot{enabled:config.enabled,account_detected:detected,..Snapshot::default()};if !config.enabled{return out;}out.attached=view.attached;out.last_scan_ms=view.last_pass_ms;
 if !detected{out.status="account_missing".into();return out;}if !view.attached{out.in_match=Some(false);out.status="waiting".into();return out;}
 let ended=view.last_match_end.map(|m|m.match_id).max(view.game_end.map(|m|m.match_id));let named=view.match_started.filter(|m|ended.is_none_or(|id|m.match_id>id));let ended_current=view.game_end.is_some_and(|end|view.match_started.is_some_and(|m|m.match_id==end.match_id));let running=view.match_running&&!ended_current;
 let in_match=!view.in_hideout()&&!ended_current&&(running||named.is_some()||view.objectives.is_some());
 out.in_match=if in_match{Some(true)}else if view.last_pass_unix.is_some()||view.in_hideout()||ended.is_some(){Some(false)}else{None};out.match_id=named.map(|m|m.match_id);
 if in_match{if view.players_read_unix_ms<=now+1000&&now.saturating_sub(view.players_read_unix_ms)<=3500{out.players_at=view.players_read_unix_ms;out.players=view.match_players.iter().filter(|p|p.team==2||p.team==3).take(12).map(|p|Player{hero_damage:p.hero_damage,account_id:p.account_id,name:p.name.chars().take(80).collect(),team:p.team,slot:p.slot,hero_id:p.hero_id,level:p.level,net_worth:p.net_worth,kills:p.kills,deaths:p.deaths,assists:p.assists,lane:p.lane,is_us:p.is_us}).collect();}out.side=view.match_players.iter().find(|p|p.is_us).and_then(|p|match p.team{2=>Some("hiddenKing".into()),3=>Some("archMother".into()),_=>None});
  if let Some(objectives)=view.objectives{out.paused=objectives.paused;out.pregame=objectives.clock<0.0;if objectives.clock.is_finite()&&(-120.0..=43200.0).contains(&objectives.clock)&&objectives.read_unix_ms<=now+1000&&now.saturating_sub(objectives.read_unix_ms)<=2500{out.timer=Some((objectives.clock as f64).max(0.0));out.timer_at=objectives.read_unix_ms;}}
 }
 out.status=if out.timer.is_some(){"live"}else if out.in_match==Some(false){"menu"}else if view.objectives.is_some(){"stale"}else{"discovering"}.into();out
}
#[tauri::command]
pub async fn configure_game_reader(app:tauri::AppHandle,window:WebviewWindow,config:Config)->Result<(),String>{
 if window.label()!="main"{return Err("Game reader settings are controlled from the main app.".into());}if config.enabled{normalize_account(&config.account)?;}if !["slow","balanced","fast"].contains(&config.speed.as_str()){return Err("Choose a valid reader scan speed.".into());}
 let state=app.state::<crate::NativeState>();let reader=&state.reader;let previous=reader.config.lock().map_err(|e|e.to_string())?.clone();*reader.config.lock().map_err(|e|e.to_string())?=config.clone();reader.enabled.store(config.enabled,Ordering::Relaxed);reader.hide_outside.store(config.hide_outside_match,Ordering::Relaxed);
 let mut memory=reader.memory.lock().map_err(|e|e.to_string())?;let created=config.enabled&&memory.is_none();if created{
  let path=app.path().app_config_dir().map_err(|e|e.to_string())?;std::fs::create_dir_all(&path).map_err(|e|e.to_string())?;let settings=Arc::clone(&reader.config);let wake=reader.wake.clone();let hooks=Hooks{steam_account:Box::new(move||settings.lock().ok().and_then(|c|account(&c))),on_change:Box::new(move||{let _=wake.try_send(());}),on_salts:Box::new(|_|{}),valve_has:Box::new(|_|false)};
  *memory=Some(GameMemory::start(false,true,"deadlock.exe".into(),path.join("reader-ended.json"),hooks));
 }
 if let Some(memory)=memory.as_ref(){if created||previous.speed!=config.speed{memory.set_speed(match config.speed.as_str(){"fast"=>Speed::Fast,"balanced"=>Speed::Balanced,_=>Speed::Slow});}let enabled=config.enabled&&account(&config).is_some();if reader.running.swap(enabled,Ordering::Relaxed)!=enabled||created{memory.set_enabled(enabled);}}
 drop(memory);let _=reader.wake.try_send(());Ok(())
}
#[tauri::command]
pub fn game_reader_state(app:tauri::AppHandle,window:WebviewWindow)->Result<Snapshot,String>{if window.label()!="main"{return Err("Game reader status is available in the main app.".into());}let state=app.state::<crate::NativeState>();let snapshot=state.reader.snapshot.lock().map_err(|e|e.to_string())?.clone();Ok(snapshot)}
pub fn start(app:tauri::AppHandle){let receive=app.state::<crate::NativeState>().reader.receive.lock().ok().and_then(|mut r|r.take());let Some(receive)=receive else{return;};let _=std::thread::Builder::new().name("game-reader-state".into()).spawn(move||{let mut was_attached=false;let mut attached_at=0u64;loop{
 let state=app.state::<crate::NativeState>();let reader=&state.reader;let config=reader.config.lock().unwrap_or_else(|e|e.into_inner()).clone();let detected=account(&config).is_some();let view={let memory=reader.memory.lock().unwrap_or_else(|e|e.into_inner());if let Some(memory)=memory.as_ref(){let run=config.enabled&&detected;if reader.running.swap(run,Ordering::Relaxed)!=run{memory.set_enabled(run);}memory.view()}else{MemoryView::default()}};
 let now=crate::ocr::now_ms();if view.attached&&!was_attached{attached_at=now;}was_attached=view.attached;let mut snapshot=summarize(&view,&config,detected,now);if config.enabled&&view.attached&&detected&&!view.objectives.is_some_and(|o|o.read_unix_ms>=attached_at)&&!view.last_pass_unix.is_some_and(|at|at.saturating_mul(1000)+1000>=attached_at){snapshot.in_match=None;snapshot.players.clear();snapshot.players_at=0;snapshot.side=None;snapshot.timer=None;snapshot.timer_at=0;snapshot.status="discovering".into();}reader.in_match.store(match snapshot.in_match{Some(true)=>1,Some(false)=>0,None=>-1},Ordering::Relaxed);let mut current=reader.snapshot.lock().unwrap_or_else(|e|e.into_inner());if *current!=snapshot{*current=snapshot.clone();drop(current);let _=app.emit("game-reader-state",snapshot);}else{drop(current);}drop(state);
 if config.enabled{if receive.recv_timeout(std::time::Duration::from_secs(1)).is_err_and(|e|matches!(e,mpsc::RecvTimeoutError::Disconnected)){break;}}else if receive.recv().is_err(){break;}
 }});}
#[cfg(test)]mod tests{
 use super::*;use deadchaps_reader::Objectives;
 fn config()->Config{Config{enabled:true,..Config::default()}}
 #[test]fn account_ids(){assert_eq!(normalize_account("76561198076383646").unwrap(),Some("116117918".into()));assert_eq!(normalize_account("1234").unwrap(),Some("1234".into()));assert!(normalize_account("abc").is_err());assert!(normalize_account("0").is_err());}
 #[test]fn fresh_clock_and_pause(){let now=10000;let mut view=MemoryView{attached:true,match_running:true,objectives:Some(Objectives{clock:142.5,paused:true,read_unix_ms:now,..Objectives::default()}),..MemoryView::default()};let status=summarize(&view,&config(),true,now);assert_eq!(status.timer,Some(142.5));assert_eq!(status.in_match,Some(true));assert!(status.paused);view.objectives.as_mut().unwrap().clock=-30.0;assert!(summarize(&view,&config(),true,now).pregame);view.objectives.as_mut().unwrap().read_unix_ms=now-5000;assert_eq!(summarize(&view,&config(),true,now).timer,None);}
 #[test]fn no_game_or_completed_pass_hides_match(){let view=MemoryView::default();assert_eq!(summarize(&view,&config(),true,10000).in_match,Some(false));let view=MemoryView{attached:true,last_pass_unix:Some(10),..MemoryView::default()};assert_eq!(summarize(&view,&config(),true,10000).in_match,Some(false));}
 #[test]fn local_team_and_finished_match(){
  let player=serde_json::json!({"account_id":1,"name":"Local","team":2,"slot":1,"hero_id":1,"level":1,"net_worth":0,"kills":0,"deaths":0,"assists":0,"is_us":true});
  let mut view:MemoryView=serde_json::from_value(serde_json::json!({"attached":true,"match_running":true,"match_started":{"lobby_id":1,"match_id":1000001},"match_players":[player]})).unwrap();
  assert_eq!(summarize(&view,&config(),true,10000).side.as_deref(),Some("hiddenKing"));view.match_players[0].team=3;assert_eq!(summarize(&view,&config(),true,10000).side.as_deref(),Some("archMother"));view.game_end=Some(deadchaps_reader::GameEnd{match_id:1000001,winner:3});assert_eq!(summarize(&view,&config(),true,10000).in_match,Some(false));
 }

 #[test]fn roster_is_bounded_fresh_and_uses_camel_case(){
 let player=serde_json::json!({"account_id":1,"name":"Local","team":2,"slot":1,"hero_id":6,"level":10,"net_worth":12345,"kills":3,"deaths":1,"assists":5,"is_us":true,"lane":4});
 let mut view:MemoryView=serde_json::from_value(serde_json::json!({"attached":true,"match_running":true,"players_read_unix_ms":10000,"match_players":vec![player;20]})).unwrap();
 let snapshot=summarize(&view,&config(),true,10000);assert_eq!(snapshot.players.len(),12);assert_eq!(snapshot.players_at,10000);let json=serde_json::to_value(&snapshot).unwrap();assert_eq!(json["players"][0]["heroId"],6);assert_eq!(json["players"][0]["netWorth"],12345);assert_eq!(json["players"][0]["isUs"],true);
 view.players_read_unix_ms=1000;assert!(summarize(&view,&config(),true,10000).players.is_empty());view.attached=false;assert!(summarize(&view,&config(),true,10000).players.is_empty());
 }
 #[test]fn match_visibility_is_opt_in(){let reader=Reader::new();assert!(!reader.hides_compass());reader.enabled.store(true,Ordering::Relaxed);assert!(reader.hides_compass());reader.in_match.store(1,Ordering::Relaxed);assert!(!reader.hides_compass());reader.in_match.store(0,Ordering::Relaxed);assert!(reader.hides_compass());reader.hide_outside.store(false,Ordering::Relaxed);assert!(!reader.hides_compass());}

}
