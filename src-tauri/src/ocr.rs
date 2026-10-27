use crate::tracking::{Frame,Region};
use serde::{Deserialize,Serialize};
fn scale()->f64{3.0}fn retry()->bool{true}
#[derive(Clone,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct TextRegion {pub key:String,pub region:Region,pub mode:String,pub threshold:u8,#[serde(default)]pub angle:f64,#[serde(default)]pub slant:f64,#[serde(default="scale")]pub scale:f64,#[serde(default="retry")]pub retry:bool}
impl TextRegion{#[cfg(test)]pub fn test(key:&str)->Self{Self{key:key.into(),region:Region{x:0.0,y:0.0,width:1.0,height:1.0},mode:"original".into(),threshold:160,angle:0.0,slant:0.0,scale:3.0,retry:true}}}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct TextReading {pub key:String,pub text:String,pub error:Option<String>,pub at:u64,pub method:String,pub alternatives:Vec<String>,#[serde(skip_serializing_if="Option::is_none")]pub preview:Option<Frame>}
pub fn now_ms()->u64{std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis()as u64}
fn usable(key:&str,text:&str)->bool{let value=text.replace(' ',"");key=="timer"&&value.contains(':')&&value.chars().any(|c|c.is_ascii_digit())&&value.chars().all(|c|c.is_ascii_digit()||":OoIl".contains(c))}
#[cfg(target_os="windows")]
fn recognize(engine:&windows::Media::Ocr::OcrEngine,frame:&Frame)->Result<String,String>{
 use windows::{Graphics::Imaging::{SoftwareBitmap,BitmapPixelFormat,BitmapAlphaMode},Storage::Streams::DataWriter};
 let writer=DataWriter::new().map_err(|e|e.to_string())?;writer.WriteBytes(&frame.rgba).map_err(|e|e.to_string())?;let buffer=writer.DetachBuffer().map_err(|e|e.to_string())?;
 let bitmap=SoftwareBitmap::CreateCopyWithAlphaFromBuffer(&buffer,BitmapPixelFormat::Bgra8,frame.width as i32,frame.height as i32,BitmapAlphaMode::Ignore).map_err(|e|e.to_string())?;
 engine.RecognizeAsync(&bitmap).map_err(|e|e.to_string())?.join().map_err(|e|e.to_string())?.Text().map(|v|v.to_string()).map_err(|e|e.to_string())
}
#[cfg(target_os="windows")]
pub fn read_regions(regions:Vec<TextRegion>,preview_key:Option<String>)->Vec<TextReading>{
 use windows::{Media::Ocr::OcrEngine,Win32::System::WinRT::{RoInitialize,RoUninitialize,RO_INIT_MULTITHREADED}};
 struct Apartment(bool);impl Drop for Apartment{fn drop(&mut self){if self.0{unsafe{RoUninitialize();}}}}
 let apartment=Apartment(unsafe{RoInitialize(RO_INIT_MULTITHREADED)}.is_ok());let engine=OcrEngine::TryCreateFromUserProfileLanguages();let mut out=Vec::new();
 for r in regions.into_iter().filter(|r|r.key=="timer").take(1){let mut at=now_ms();let mut method=r.mode.clone();let mut alternatives=vec![];let mut preview=None;
 let result=(||->Result<String,String>{
  if r.key!="timer"{return Err("Unsupported screen field.".into());}
  if !r.angle.is_finite()||!r.slant.is_finite()||!r.scale.is_finite(){return Err("Invalid text correction settings.".into());}
  let engine=engine.as_ref().map_err(|e|format!("Windows OCR unavailable: {e}. Install an OCR language component in Windows language settings."))?;
  let frame=crate::capture::capture(Some(r.region),640)?;at=now_ms();let max=OcrEngine::MaxImageDimension().map_err(|e|e.to_string())?as usize;
  let mut prepared=crate::preprocess::prepare(&frame,&r,max,&r.mode);let mut text=recognize(engine,&prepared)?;alternatives.push(text.clone());
  if r.retry&&!usable(&r.key,&text){let fallback=if r.mode=="adaptive"{"original"}else{"adaptive"};let other=crate::preprocess::prepare(&frame,&r,max,fallback);let candidate=recognize(engine,&other)?;alternatives.push(candidate.clone());if usable(&r.key,&candidate)||text.trim().is_empty(){text=candidate;prepared=other;method=fallback.into();}}
  if preview_key.as_deref()==Some(r.key.as_str()){preview=Some(prepared);}Ok(text)
 })();out.push(match result{Ok(text)=>TextReading{key:r.key,text,error:None,at,method,alternatives,preview},Err(error)=>TextReading{key:r.key,text:String::new(),error:Some(error),at,method,alternatives,preview}});
 }drop(engine);drop(apartment);out
}
#[cfg(test)]mod tests{
 use super::*;
 #[test]fn numeric_retry_is_bounded_by_format(){assert!(!usable("timer","07.09"));assert!(usable("timer","O7:O9"));assert!(!usable("souls","SOULS 500"));assert!(!usable("souls","12.5k"));}
 #[cfg(target_os="windows")]
 #[test]#[ignore="Requires an installed Windows OCR language"]
 fn native_ocr_fixture(){
  use windows::{Media::Ocr::OcrEngine,Win32::System::WinRT::{RoInitialize,RoUninitialize,RO_INIT_MULTITHREADED}};
  unsafe{RoInitialize(RO_INIT_MULTITHREADED)}.unwrap();let engine=OcrEngine::TryCreateFromUserProfileLanguages().unwrap();let max=OcrEngine::MaxImageDimension().unwrap()as usize;
  for(bytes,w,h,expected)in[(include_bytes!("../../tests/fixtures/hud.rgba").as_slice(),320,100,"12.5k"),(include_bytes!("../../tests/fixtures/hud-values.rgba").as_slice(),640,100,"07:09")]{let frame=Frame{width:w,height:h,rgba:bytes.to_vec(),signature:vec![]};let r=TextRegion::test("timer");let prepared=crate::preprocess::prepare(&frame,&r,max,"original");let text=recognize(&engine,&prepared).unwrap();println!("Enhanced Windows OCR: {text}");assert!(text.replace(' ',"").to_lowercase().contains(expected));if w==640{assert!(text.replace(' ',"").contains("850/1200"));}}
  let angled=Frame{width:360,height:140,rgba:include_bytes!("../../tests/fixtures/hud-angled.rgba").to_vec(),signature:vec![]};let mut correction=TextRegion::test("timer");correction.angle=9.0;correction.slant=12.0;let input=crate::preprocess::prepare(&angled,&correction,max,"original");let corrected=recognize(&engine,&input).unwrap();println!("Angled italic fixture after correction: {corrected}");assert!(corrected.replace(' ',"").contains("07:09"));
  drop(engine);unsafe{RoUninitialize();}
 }
}
