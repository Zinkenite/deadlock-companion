use std::{sync::atomic::Ordering,time::Duration};
use serde::{Deserialize,Serialize};
use tauri::{Manager,WebviewWindow,WebviewWindowBuilder,WebviewUrl,PhysicalSize,PhysicalPosition};
#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
pub struct OverlayConfig{enabled:bool,editing:bool,#[serde(default)]previewing:bool,#[serde(default="default_hide_on_focus_loss")]hide_on_focus_loss:bool,monitor:usize,x:f64,y:f64,width:f64,max_visible:usize}
fn default_hide_on_focus_loss()->bool{true}
#[derive(Serialize)]pub struct Placement{monitor:usize,x:f64,y:f64}
#[tauri::command]
pub async fn configure_notifications(app:tauri::AppHandle,window:WebviewWindow,config:OverlayConfig)->Result<(),String>{
 if window.label()!="main"{return Err("Notifications settings are controlled from the main app.".into());}
 if ![config.x,config.y,config.width].iter().all(|v|v.is_finite())||!(0.0..=100.0).contains(&config.x)||!(0.0..=100.0).contains(&config.y)||!(300.0..=600.0).contains(&config.width)||!(1..=6).contains(&config.max_visible){return Err("Invalid notifications placement.".into());}
 // Window creation dispatches to the UI thread. Never hold the settings lock here:
 // the synchronous configure command also runs on that thread.
 let state=app.state::<crate::NativeState>();let _guard=state.notifications_lock.lock().await;
 
 state.notifications_enabled.store(config.enabled,Ordering::Relaxed);state.notifications_previewing.store(config.previewing,Ordering::Relaxed);state.notifications_editing.store(config.editing,Ordering::Relaxed);state.notifications_hide_on_focus_loss.store(config.hide_on_focus_loss,Ordering::Relaxed);
 if !config.enabled{if let Some(overlay)=app.get_webview_window("notifications"){overlay.hide().map_err(|e|e.to_string())?;}return Ok(());}
 let monitors=window.available_monitors().map_err(|e|e.to_string())?;let monitor=monitors.get(config.monitor).or_else(||monitors.first()).ok_or("No display available")?;let scale=monitor.scale_factor();let width=config.width.min(monitor.size().width as f64/scale-20.0).max(200.0);let height=(config.max_visible as f64*108.0+36.0).min(monitor.size().height as f64/scale-20.0).max(140.0);
 let overlay=if let Some(overlay)=app.get_webview_window("notifications"){overlay}else{WebviewWindowBuilder::new(&app,"notifications",WebviewUrl::App("index.html#notifications".into())).title("Deadlock notifications").transparent(true).decorations(false).shadow(false).always_on_top(true).skip_taskbar(true).resizable(false).focused(false).focusable(false).visible(false).inner_size(width,height).build().map_err(|e|e.to_string())?};
 overlay.set_focusable(config.editing).map_err(|e|e.to_string())?;overlay.set_ignore_cursor_events(!config.editing).map_err(|e|e.to_string())?;overlay.set_always_on_top(true).map_err(|e|e.to_string())?;
 let size=overlay.inner_size().map_err(|e|e.to_string())?;if (size.width as f64-width*scale).abs()>1.0||(size.height as f64-height*scale).abs()>1.0{overlay.set_size(PhysicalSize::new((width*scale).round()as u32,(height*scale).round()as u32)).map_err(|e|e.to_string())?;}
 let x=monitor.position().x as f64+(monitor.size().width as f64-width*scale).max(0.0)*config.x/100.0;let y=monitor.position().y as f64+(monitor.size().height as f64-height*scale).max(0.0)*config.y/100.0;let next=PhysicalPosition::new(x.round()as i32,y.round()as i32);if overlay.outer_position().map_err(|e|e.to_string())?!=next{overlay.set_position(next).map_err(|e|e.to_string())?;}
 if should_display(&app){overlay.show().map_err(|e|e.to_string())?;}else{overlay.hide().map_err(|e|e.to_string())?;}Ok(())
}
#[tauri::command]
pub fn notifications_placement(app:tauri::AppHandle,window:WebviewWindow)->Result<Placement,String>{
 if window.label()!="main"{return Err("Notifications settings are controlled from the main app.".into());}
 let overlay=app.get_webview_window("notifications").ok_or("Notifications is hidden")?;let position=overlay.outer_position().map_err(|e|e.to_string())?;let size=overlay.inner_size().map_err(|e|e.to_string())?;let current=overlay.current_monitor().map_err(|e|e.to_string())?.ok_or("Notifications display unavailable")?;let monitors=window.available_monitors().map_err(|e|e.to_string())?;let monitor=monitors.iter().position(|m|m.position()==current.position()).unwrap_or(0);let dx=(current.size().width.saturating_sub(size.width)).max(1)as f64;let dy=(current.size().height.saturating_sub(size.height)).max(1)as f64;
 Ok(Placement{monitor,x:((position.x-current.position().x)as f64/dx*100.0).clamp(0.0,100.0),y:((position.y-current.position().y)as f64/dy*100.0).clamp(0.0,100.0)})
}

fn should_display(app:&tauri::AppHandle)->bool{let state=app.state::<crate::NativeState>();if !state.notifications_enabled.load(Ordering::Relaxed){return false;}if state.notifications_editing.load(Ordering::Relaxed)||state.notifications_previewing.load(Ordering::Relaxed)||!state.notifications_hide_on_focus_loss.load(Ordering::Relaxed){return true;}#[cfg(target_os="windows")]{crate::capture::ensure_game().is_ok()}#[cfg(not(target_os="windows"))]{false}}
// Poll independently of the capture loop so Alt-Tab hides even when reading is paused.
pub fn start_visibility_monitor(app:tauri::AppHandle){let _=std::thread::Builder::new().name("notifications-focus".into()).spawn(move||loop{std::thread::sleep(Duration::from_millis(200));if let Some(overlay)=app.get_webview_window("notifications"){let wanted=should_display(&app);if wanted!=overlay.is_visible().unwrap_or(false){if wanted{let _=overlay.show();}else{let _=overlay.hide();}}}});}

#[tauri::command]
pub async fn notification_sound(window:WebviewWindow,volume:f64)->Result<(),String>{
 if window.label()!="main"{return Err("Notification sound is controlled from the main app.".into());}
 if !volume.is_finite()||!(0.0..=1.0).contains(&volume){return Err("Invalid notification volume.".into());}
 if volume==0.0{return Ok(());}
 tauri::async_runtime::spawn_blocking(move||{
  #[cfg(target_os="windows")]{
   #[link(name="winmm")]extern "system"{fn PlaySoundW(sound:*const u16,module:*mut core::ffi::c_void,flags:u32)->i32;}
   let mut bytes=include_bytes!("../assets/notification.wav").to_vec();
   for sample in bytes[44..].chunks_exact_mut(2){let value=(i16::from_le_bytes([sample[0],sample[1]])as f64*volume).round()as i16;sample.copy_from_slice(&value.to_le_bytes());}
   let played=unsafe{PlaySoundW(bytes.as_ptr().cast(),std::ptr::null_mut(),0x0004|0x0002)};
   if played==0{return Err("Could not play the notification sound.".to_string());}
  }
  Ok(())
 }).await.map_err(|e|e.to_string())?
}
