use std::{sync::atomic::Ordering,time::Duration};
use serde::{Deserialize,Serialize};
use tauri::{Manager,WebviewWindow,WebviewWindowBuilder,WebviewUrl,PhysicalSize,PhysicalPosition};
#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
pub struct OverlayConfig{enabled:bool,editing:bool,#[serde(default="default_hide_on_focus_loss")]hide_on_focus_loss:bool,monitor:usize,x:f64,y:f64,width:f64,#[serde(default="default_height_scale")]height_scale:f64,#[serde(default)]canvas_height:Option<f64>}
fn default_hide_on_focus_loss()->bool{true}
fn default_height_scale()->f64{1.0}
#[derive(Serialize)]pub struct Placement{monitor:usize,x:f64,y:f64}
#[tauri::command]
pub async fn configure_compass(app:tauri::AppHandle,window:WebviewWindow,config:OverlayConfig)->Result<(),String>{
 if window.label()!="main"{return Err("Compass settings are controlled from the main app.".into());}
 if ![config.x,config.y,config.width,config.height_scale].iter().all(|v|v.is_finite())||!(0.0..=100.0).contains(&config.x)||!(0.0..=100.0).contains(&config.y)||!(360.0..=1200.0).contains(&config.width)||!(0.5..=2.0).contains(&config.height_scale){return Err("Invalid compass placement.".into());}
 // Window creation dispatches to the UI thread. Never hold the settings lock here:
 // the synchronous configure command also runs on that thread.
 let state=app.state::<crate::NativeState>();let _guard=state.compass_lock.lock().await;
 if config.canvas_height.is_some_and(|h|!h.is_finite()||!(16.0..=600.0).contains(&h)){return Err("Invalid compass height.".into());}
 state.compass_enabled.store(config.enabled,Ordering::Relaxed);state.compass_editing.store(config.editing,Ordering::Relaxed);state.compass_hide_on_focus_loss.store(config.hide_on_focus_loss,Ordering::Relaxed);
 if !config.enabled{if let Some(overlay)=app.get_webview_window("compass"){overlay.hide().map_err(|e|e.to_string())?;}return Ok(());}
 let monitors=window.available_monitors().map_err(|e|e.to_string())?;let monitor=monitors.get(config.monitor).or_else(||monitors.first()).ok_or("No display available")?;let scale=monitor.scale_factor();let width=config.width.min(monitor.size().width as f64/scale-20.0).max(200.0);let height=config.canvas_height.unwrap_or(104.0*config.height_scale)+28.0;
 let overlay=if let Some(overlay)=app.get_webview_window("compass"){overlay}else{WebviewWindowBuilder::new(&app,"compass",WebviewUrl::App("index.html#compass".into())).title("Deadlock compass").transparent(true).decorations(false).shadow(false).always_on_top(true).skip_taskbar(true).resizable(false).focused(false).focusable(false).visible(false).inner_size(width,height).build().map_err(|e|e.to_string())?};
 overlay.set_focusable(config.editing).map_err(|e|e.to_string())?;overlay.set_ignore_cursor_events(!config.editing).map_err(|e|e.to_string())?;overlay.set_always_on_top(true).map_err(|e|e.to_string())?;
 let size=overlay.inner_size().map_err(|e|e.to_string())?;if (size.width as f64-width*scale).abs()>1.0||(size.height as f64-height*scale).abs()>1.0{overlay.set_size(PhysicalSize::new((width*scale).round()as u32,(height*scale).round()as u32)).map_err(|e|e.to_string())?;}
 let x=monitor.position().x as f64+(monitor.size().width as f64-width*scale).max(0.0)*config.x/100.0;let y=monitor.position().y as f64+(monitor.size().height as f64-height*scale).max(0.0)*config.y/100.0;let next=PhysicalPosition::new(x.round()as i32,y.round()as i32);if overlay.outer_position().map_err(|e|e.to_string())?!=next{overlay.set_position(next).map_err(|e|e.to_string())?;}
 if should_display(&app){overlay.show().map_err(|e|e.to_string())?;}else{overlay.hide().map_err(|e|e.to_string())?;}Ok(())
}
#[tauri::command]
pub fn compass_placement(app:tauri::AppHandle,window:WebviewWindow)->Result<Placement,String>{
 if window.label()!="main"{return Err("Compass settings are controlled from the main app.".into());}
 let overlay=app.get_webview_window("compass").ok_or("Compass is hidden")?;let position=overlay.outer_position().map_err(|e|e.to_string())?;let size=overlay.inner_size().map_err(|e|e.to_string())?;let current=overlay.current_monitor().map_err(|e|e.to_string())?.ok_or("Compass display unavailable")?;let monitors=window.available_monitors().map_err(|e|e.to_string())?;let monitor=monitors.iter().position(|m|m.position()==current.position()).unwrap_or(0);let dx=(current.size().width.saturating_sub(size.width)).max(1)as f64;let dy=(current.size().height.saturating_sub(size.height)).max(1)as f64;
 Ok(Placement{monitor,x:((position.x-current.position().x)as f64/dx*100.0).clamp(0.0,100.0),y:((position.y-current.position().y)as f64/dy*100.0).clamp(0.0,100.0)})
}

fn should_display(app:&tauri::AppHandle)->bool{let state=app.state::<crate::NativeState>();if !state.compass_enabled.load(Ordering::Relaxed){return false;}if state.compass_editing.load(Ordering::Relaxed)||!state.compass_hide_on_focus_loss.load(Ordering::Relaxed){return true;}#[cfg(target_os="windows")]{crate::capture::ensure_game().is_ok()}#[cfg(not(target_os="windows"))]{false}}
// Poll independently of the capture loop so Alt-Tab hides even when reading is paused.
pub fn start_visibility_monitor(app:tauri::AppHandle){let _=std::thread::Builder::new().name("compass-focus".into()).spawn(move||loop{std::thread::sleep(Duration::from_millis(200));if let Some(overlay)=app.get_webview_window("compass"){let wanted=should_display(&app);if wanted!=overlay.is_visible().unwrap_or(false){if wanted{let _=overlay.show();}else{let _=overlay.hide();}}}});}
