use crate::tracking::{Frame,Region};
use serde::{Deserialize,Serialize};
#[derive(Clone,Deserialize)]#[serde(rename_all="camelCase")]
pub struct TextRegion{pub key:String,pub region:Region}
#[derive(Serialize)]#[serde(rename_all="camelCase")]
pub struct TextReading{pub key:String,pub text:String,pub error:Option<String>,pub at:u64,pub method:String,pub alternatives:Vec<String>,#[serde(skip_serializing_if="Option::is_none")]pub preview:Option<Frame>}
pub fn now_ms()->u64{std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis()as u64}
fn usable(text:&str)->bool{
 let mut value=String::new();for c in text.chars(){if c.is_whitespace(){continue;}value.push(match c{'O'|'o'=>'0','I'|'l'=>'1','.'|';'|'·'=>':',c if c.is_ascii_digit()||c==':'=>c,_=>return false});}
 if value.chars().all(|c|c.is_ascii_digit())&&(3..=5).contains(&value.len()){value.insert(value.len()-2,':');}
 let parts=value.split(':').collect::<Vec<_>>();if !(2..=3).contains(&parts.len())||parts[0].is_empty()||parts[0].len()>3||parts[1..].iter().any(|s|s.len()!=2){return false;}
 let values=parts.iter().map(|p|p.parse::<u32>()).collect::<Result<Vec<_>,_>>();let Ok(v)=values else{return false;};if v[1..].iter().any(|n|*n>=60){return false;}let seconds=if v.len()==3{v[0]*3600+v[1]*60+v[2]}else{v[0]*60+v[1]};seconds<=43200
}
#[cfg(target_os="windows")]
fn recognize(engine:&windows::Media::Ocr::OcrEngine,frame:&Frame)->Result<String,String>{
 use windows::{Graphics::Imaging::{SoftwareBitmap,BitmapPixelFormat,BitmapAlphaMode},Storage::Streams::DataWriter};
 let writer=DataWriter::new().map_err(|e|e.to_string())?;writer.WriteBytes(&frame.rgba).map_err(|e|e.to_string())?;let buffer=writer.DetachBuffer().map_err(|e|e.to_string())?;
 let bitmap=SoftwareBitmap::CreateCopyWithAlphaFromBuffer(&buffer,BitmapPixelFormat::Bgra8,frame.width as i32,frame.height as i32,BitmapAlphaMode::Ignore).map_err(|e|e.to_string())?;
 engine.RecognizeAsync(&bitmap).map_err(|e|e.to_string())?.join().map_err(|e|e.to_string())?.Text().map(|v|v.to_string()).map_err(|e|e.to_string())
}
#[cfg(target_os="windows")]struct TimerJob{region:TextRegion,preview:bool,done:std::sync::mpsc::SyncSender<TextReading>}
fn failed(error:String)->TextReading{TextReading{key:"timer".into(),text:String::new(),error:Some(error),at:now_ms(),method:"Timer OCR".into(),alternatives:vec![],preview:None}}
#[cfg(target_os="windows")]
fn worker()->Result<&'static std::sync::mpsc::SyncSender<TimerJob>,String>{
 use std::sync::{OnceLock,mpsc::{sync_channel,SyncSender}};
 static WORKER:OnceLock<Result<SyncSender<TimerJob>,String>>=OnceLock::new();
 WORKER.get_or_init(||{let(tx,rx)=sync_channel::<TimerJob>(2);std::thread::Builder::new().name("timer-ocr".into()).spawn(move||{
  use windows::{Media::Ocr::OcrEngine,Win32::System::WinRT::{RoInitialize,RoUninitialize,RO_INIT_MULTITHREADED}};
  let initialized=unsafe{RoInitialize(RO_INIT_MULTITHREADED)}.is_ok();let engine=OcrEngine::TryCreateFromUserProfileLanguages().map_err(|e|format!("Windows timer OCR unavailable: {e}. Check Windows OCR language support."));let max=OcrEngine::MaxImageDimension().unwrap_or(2600)as usize;
  let mut cached:Option<(u64,u64,String,Frame)>=None;
  for job in rx{
   let mut at=now_ms();let mut method="Timer OCR".to_string();let mut preview=None;
   let result=(||->Result<String,String>{let engine=engine.as_ref().map_err(Clone::clone)?;let frame=crate::capture::capture_timer(job.region.region,640)?;at=now_ms();let mut hash=14695981039346656037u64;for byte in &frame.rgba{hash=(hash^*byte as u64).wrapping_mul(1099511628211);}hash^=(frame.width as u64)<<32|frame.height as u64;
    if let Some((last_hash,verified,text,prepared))=&cached{if hash==*last_hash&&at.saturating_sub(*verified)<3000{if job.preview{preview=Some(Frame{width:prepared.width,height:prepared.height,rgba:prepared.rgba.clone(),signature:vec![]});}method="Unchanged clock".into();return Ok(text.clone());}}
    let prepared=crate::preprocess::prepare_timer(&frame,max);let text=recognize(engine,&prepared)?;
    if job.preview{preview=Some(Frame{width:prepared.width,height:prepared.height,rgba:prepared.rgba.clone(),signature:vec![]});}
    if usable(&text){cached=Some((hash,at,text.clone(),prepared));}else{cached=None;}Ok(text)
   })();let reading=match result{Ok(text)=>TextReading{key:"timer".into(),alternatives:vec![text.clone()],text,error:None,at,method,preview},Err(error)=>failed(error)};let _=job.done.send(reading);
  }
  drop(engine);if initialized{unsafe{RoUninitialize();}}
 }).map_err(|e|e.to_string())?;Ok(tx)}).as_ref().map_err(Clone::clone)
}
#[cfg(target_os="windows")]
pub fn read_regions(regions:Vec<TextRegion>,preview_key:Option<String>)->Vec<TextReading>{
 let Some(region)=regions.into_iter().find(|r|r.key=="timer")else{return vec![];};
 let(tx,rx)=std::sync::mpsc::sync_channel(1);let request=worker().and_then(|worker|worker.try_send(TimerJob{preview:preview_key.as_deref()==Some("timer"),region,done:tx}).map_err(|_|"Timer reader is busy; the next reading will retry.".to_string()));
 match request{Ok(())=>vec![rx.recv_timeout(std::time::Duration::from_secs(3)).unwrap_or_else(|_|failed("Timer OCR timed out; the next reading will retry.".into()))],Err(error)=>vec![failed(error)]}
}
#[cfg(test)]mod tests{use super::*;#[test]fn clock_format(){assert!(usable("07:09"));assert!(usable("O7:O9"));assert!(usable("07.09"));assert!(usable("0709"));assert!(!usable("07:99"));assert!(!usable("850 / 1200"));}}
#[cfg(all(test,target_os="windows"))]mod pipeline_profile{
 use super::*;
 fn fixture()->Frame{let bytes=include_bytes!("../../tests/fixtures/hud-values.rgba");let mut rgba=Vec::new();for y in 0..70{rgba.extend_from_slice(&bytes[y*640*4..(y*640+150)*4]);}Frame{width:150,height:70,rgba,signature:vec![]}}
 #[test]#[ignore="Explicit native OCR performance measurement"]fn timer_pipeline_profile(){
 use windows::{Media::Ocr::OcrEngine,Win32::System::WinRT::{RoInitialize,RoUninitialize,RO_INIT_MULTITHREADED}};
 unsafe{RoInitialize(RO_INIT_MULTITHREADED)}.unwrap();let frame=fixture();let max=OcrEngine::MaxImageDimension().unwrap()as usize;
 let start=std::time::Instant::now();for _ in 0..100{std::hint::black_box(crate::preprocess::prepare_timer(&frame,max));}let prep=start.elapsed().as_secs_f64()*10.0;
 let start=std::time::Instant::now();for _ in 0..8{let engine=OcrEngine::TryCreateFromUserProfileLanguages().unwrap();let prepared=crate::preprocess::prepare_timer(&frame,max);let text=recognize(&engine,&prepared).unwrap();assert!(text.replace(' ',"").contains("07:09"),"{text}");}let cold=start.elapsed().as_secs_f64()*125.0;
 let engine=OcrEngine::TryCreateFromUserProfileLanguages().unwrap();let start=std::time::Instant::now();for _ in 0..8{let prepared=crate::preprocess::prepare_timer(&frame,max);let text=recognize(&engine,&prepared).unwrap();assert!(text.replace(' ',"").contains("07:09"),"{text}");}let warm=start.elapsed().as_secs_f64()*125.0;
 println!("TIMER_PROFILE prepare_ms={prep:.3} new_engine_read_ms={cold:.3} reused_engine_read_ms={warm:.3}");drop(engine);unsafe{RoUninitialize();}
 }
}
