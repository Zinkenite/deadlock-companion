#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod compass_overlay;
mod notifications_overlay;
mod tracking;
mod template_match;
mod ocr;
mod preprocess;
#[cfg(target_os="windows")]mod capture;
use std::sync::{Mutex,atomic::{AtomicBool, Ordering}};
use tauri::{Manager,menu::{Menu,MenuItem},tray::TrayIconBuilder};
use serde::{Serialize,Deserialize};
#[derive(Default,Serialize,Deserialize)]
#[serde(rename_all="camelCase")]
struct Preferences {tray:bool,start_minimized:bool}
struct NativeState {tray:AtomicBool,config_lock:Mutex<()>,compass_lock:tauri::async_runtime::Mutex<()>,compass_enabled:AtomicBool,compass_editing:AtomicBool,compass_hide_on_focus_loss:AtomicBool,notifications_lock:tauri::async_runtime::Mutex<()>,notifications_enabled:AtomicBool,notifications_editing:AtomicBool,notifications_previewing:AtomicBool,notifications_hide_on_focus_loss:AtomicBool}
#[tauri::command]
fn configure(app:tauri::AppHandle,state:tauri::State<NativeState>,tray:bool,start_minimized:bool)->Result<(),String>{
 let _guard=state.config_lock.lock().map_err(|e|e.to_string())?;
 let path=app.path().app_config_dir().map_err(|e|e.to_string())?;
 std::fs::create_dir_all(&path).map_err(|e|e.to_string())?;
 let data=serde_json::to_vec(&Preferences{tray,start_minimized}).map_err(|e|e.to_string())?;
 std::fs::write(path.join("preferences.json"),data).map_err(|e|e.to_string())?;
 state.tray.store(tray,Ordering::Relaxed);Ok(())
}

#[tauri::command]
async fn capture_preview(region:Option<tracking::Region>)->Result<tauri::ipc::Response,String>{
 tauri::async_runtime::spawn_blocking(move||{
  #[cfg(target_os="windows")]{{let f=capture::capture(region,if region.is_some(){640}else{1920})?;let mut bytes=Vec::with_capacity(8+f.rgba.len());bytes.extend_from_slice(&(f.width as u32).to_le_bytes());bytes.extend_from_slice(&(f.height as u32).to_le_bytes());bytes.extend(f.rgba);Ok(tauri::ipc::Response::new(bytes))}}
  #[cfg(not(target_os="windows"))]{let _=region;Err("Screen tracking requires Windows.".into())}
 }).await.map_err(|e|e.to_string())?
}
#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
struct ScreenRequest {marker:Option<tracking::DetectionConfig>,text_regions:Vec<ocr::TextRegion>,#[serde(default)]preview_key:Option<String>}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
struct ScreenResult {marker:Option<tracking::Detection>,map_at:u64,text:Vec<ocr::TextReading>,processing_ms:f64}
#[tauri::command]
async fn read_screen(request:ScreenRequest)->Result<ScreenResult,String>{
 tauri::async_runtime::spawn_blocking(move||{
  if request.text_regions.len()>1||request.text_regions.iter().any(|r|r.key!="timer"){return Err("Only the match timer can be read.".into());}
  #[cfg(target_os="windows")]capture::ensure_game()?;
  let start=std::time::Instant::now();let mut map_at=ocr::now_ms();
  let marker=if let Some(config)=request.marker{
   #[cfg(target_os="windows")]{let frame=capture::capture(Some(config.region),384)?;map_at=ocr::now_ms();Some(tracking::Detection{candidates:tracking::detect(&frame.rgba,frame.width,frame.height,&config),signature:frame.signature,processing_ms:start.elapsed().as_secs_f64()*1000.0,width:frame.width,height:frame.height})}
   #[cfg(not(target_os="windows"))]{let _=config;return Err("Screen reading requires Windows.".to_string());}
  }else{None};
  #[cfg(target_os="windows")]let text=ocr::read_regions(request.text_regions,request.preview_key);
  #[cfg(not(target_os="windows"))]let text=Vec::new();
  Ok(ScreenResult{marker,map_at,text,processing_ms:start.elapsed().as_secs_f64()*1000.0})
 }).await.map_err(|e|e.to_string())?
}

fn main(){
 tauri::Builder::default()
 .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent,None))
 .plugin(tauri_plugin_window_state::Builder::default().with_denylist(&["compass","notifications"]).build())
 .manage(NativeState{tray:AtomicBool::new(true),config_lock:Mutex::new(()),compass_lock:tauri::async_runtime::Mutex::new(()),compass_enabled:AtomicBool::new(false),compass_editing:AtomicBool::new(false),compass_hide_on_focus_loss:AtomicBool::new(true),notifications_lock:tauri::async_runtime::Mutex::new(()),notifications_enabled:AtomicBool::new(false),notifications_editing:AtomicBool::new(false),notifications_previewing:AtomicBool::new(false),notifications_hide_on_focus_loss:AtomicBool::new(true)})
 .invoke_handler(tauri::generate_handler![configure,capture_preview,read_screen,compass_overlay::configure_compass,compass_overlay::compass_placement,notifications_overlay::configure_notifications,notifications_overlay::notifications_placement,notifications_overlay::notification_sound])
 .setup(|app|{
  let prefs=app.path().app_config_dir().ok().and_then(|p|std::fs::read(p.join("preferences.json")).ok()).and_then(|b|serde_json::from_slice::<Preferences>(&b).ok()).unwrap_or(Preferences{tray:true,start_minimized:false});
  app.state::<NativeState>().tray.store(prefs.tray,Ordering::Relaxed);
  if prefs.start_minimized {if let Some(w)=app.get_webview_window("main"){let _=w.minimize();}}
  let show=MenuItem::with_id(app,"show","Open companion",true,None::<&str>)?;
  let quit=MenuItem::with_id(app,"quit","Quit",true,None::<&str>)?;
  let menu=Menu::with_items(app,&[&show,&quit])?;
  let mut tray=TrayIconBuilder::new().tooltip("Deadlock Companion").menu(&menu).on_menu_event(|app,event|match event.id.as_ref(){"show"=>{if let Some(w)=app.get_webview_window("main"){let _=w.show();let _=w.unminimize();let _=w.set_focus();}},"quit"=>app.exit(0),_=>{}});
  if let Some(icon)=app.default_window_icon(){tray=tray.icon(icon.clone());}tray.build(app)?;
  compass_overlay::start_visibility_monitor(app.handle().clone());
  notifications_overlay::start_visibility_monitor(app.handle().clone());
  Ok(())
 })
 .on_window_event(|window,event|{if let tauri::WindowEvent::CloseRequested{api,..}=event{if window.label()=="main"{if window.state::<NativeState>().tray.load(Ordering::Relaxed){api.prevent_close();let _=window.hide();}else {for label in ["compass","notifications"]{if let Some(overlay)=window.app_handle().get_webview_window(label){let _=overlay.destroy();}}}}}})
 .run(tauri::generate_context!()).expect("Could not launch Deadlock Companion");
}
