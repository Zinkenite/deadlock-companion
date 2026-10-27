//! Windows GDI capture of the foreground Deadlock client. Handles never leave this module.
use crate::tracking::{Region,Frame,signature};
use std::{ffi::c_void,ptr::null_mut};
type Handle=*mut c_void;
static CAPTURE_LOCK:std::sync::Mutex<()>=std::sync::Mutex::new(());
#[repr(C)]#[derive(Default)]struct Rect{left:i32,top:i32,right:i32,bottom:i32}
#[repr(C)]#[derive(Default)]struct Point{x:i32,y:i32}
#[repr(C)]struct BitmapInfo{size:u32,width:i32,height:i32,planes:u16,bit_count:u16,compression:u32,size_image:u32,xppm:i32,yppm:i32,clr_used:u32,clr_important:u32,color:u32}
#[link(name="user32")]extern "system"{fn GetForegroundWindow()->Handle;fn GetWindowThreadProcessId(hwnd:Handle,pid:*mut u32)->u32;fn IsIconic(hwnd:Handle)->i32;fn GetClientRect(hwnd:Handle,rect:*mut Rect)->i32;fn ClientToScreen(hwnd:Handle,point:*mut Point)->i32;fn GetDC(hwnd:Handle)->Handle;fn ReleaseDC(hwnd:Handle,dc:Handle)->i32;}
#[link(name="kernel32")]extern "system"{fn OpenProcess(access:u32,inherit:i32,pid:u32)->Handle;fn QueryFullProcessImageNameW(process:Handle,flags:u32,path:*mut u16,size:*mut u32)->i32;fn CloseHandle(handle:Handle)->i32;}
#[link(name="gdi32")]extern "system"{fn CreateCompatibleDC(dc:Handle)->Handle;fn CreateDIBSection(dc:Handle,info:*const BitmapInfo,usage:u32,bits:*mut *mut c_void,section:Handle,offset:u32)->Handle;fn SelectObject(dc:Handle,obj:Handle)->Handle;fn DeleteObject(obj:Handle)->i32;fn DeleteDC(dc:Handle)->i32;fn SetStretchBltMode(dc:Handle,mode:i32)->i32;fn StretchBlt(dest:Handle,x:i32,y:i32,w:i32,h:i32,src:Handle,sx:i32,sy:i32,sw:i32,sh:i32,rop:u32)->i32;fn GdiFlush()->i32;}
struct Resources{screen:Handle,memory:Handle,bitmap:Handle,old:Handle}
impl Drop for Resources{fn drop(&mut self){unsafe{if !self.old.is_null(){SelectObject(self.memory,self.old);}if !self.bitmap.is_null(){DeleteObject(self.bitmap);}if !self.memory.is_null(){DeleteDC(self.memory);}if !self.screen.is_null(){ReleaseDC(null_mut(),self.screen);}}}}
unsafe fn foreground_game()->Result<Handle,String>{
 let hwnd=GetForegroundWindow();if hwnd.is_null()||IsIconic(hwnd)!=0{return Err("Focus Deadlock to capture its visible minimap.".into());}
 let mut pid=0;GetWindowThreadProcessId(hwnd,&mut pid);
 // PROCESS_QUERY_LIMITED_INFORMATION only. No process memory access.
 let process=OpenProcess(0x1000,0,pid);if process.is_null(){return Err("Cannot identify the foreground application.".into());}
 let mut path=[0u16;32768];let mut len=path.len() as u32;let ok=QueryFullProcessImageNameW(process,0,path.as_mut_ptr(),&mut len);CloseHandle(process);
 let name=String::from_utf16_lossy(&path[..len.min(32768) as usize]);if ok==0||!matches!(name.rsplit('\\').next().unwrap_or("").to_ascii_lowercase().as_str(),"deadlock.exe"|"project8.exe"){return Err("Paused: Deadlock is not the foreground application.".into());}Ok(hwnd)
}
pub fn capture(region:Option<Region>,limit:usize)->Result<Frame,String>{let _guard=CAPTURE_LOCK.lock().map_err(|_|"Capture is unavailable.".to_string())?;unsafe{
 let hwnd=foreground_game()?;let mut rect=Rect::default();let mut origin=Point::default();
 if GetClientRect(hwnd,&mut rect)==0||ClientToScreen(hwnd,&mut origin)==0{return Err("Cannot read the game window bounds.".into());}
 let cw=rect.right-rect.left;let ch=rect.bottom-rect.top;if cw<320||ch<240||cw>16384||ch>16384{return Err("Game window size is unsupported.".into());}
 let region=region.unwrap_or(Region{x:0.0,y:0.0,width:1.0,height:1.0});if !region.valid(){return Err("Select a valid minimap rectangle inside the game.".into());}
 let sx=origin.x+(region.x*cw as f64).round() as i32;let sy=origin.y+(region.y*ch as f64).round() as i32;
 let sw=(region.width*cw as f64).round().max(1.0) as i32;let sh=(region.height*ch as f64).round().max(1.0) as i32;
 let scale=(limit.clamp(64,1920) as f64/sw.max(sh) as f64).min(1.0);let w=(sw as f64*scale).round().max(1.0) as usize;let h=(sh as f64*scale).round().max(1.0) as usize;
 let mut r=Resources{screen:GetDC(null_mut()),memory:null_mut(),bitmap:null_mut(),old:null_mut()};if r.screen.is_null(){return Err("Windows screen capture is unavailable.".into());}r.memory=CreateCompatibleDC(r.screen);if r.memory.is_null(){return Err("Cannot create capture surface.".into());}
 let info=BitmapInfo{size:40,width:w as i32,height:-(h as i32),planes:1,bit_count:32,compression:0,size_image:0,xppm:0,yppm:0,clr_used:0,clr_important:0,color:0};let mut bits=null_mut();r.bitmap=CreateDIBSection(r.screen,&info,0,&mut bits,null_mut(),0);if r.bitmap.is_null()||bits.is_null(){return Err("Cannot allocate capture pixels.".into());}r.old=SelectObject(r.memory,r.bitmap);if r.old.is_null()||r.old as isize == -1{r.old=null_mut();return Err("Cannot select capture bitmap.".into());}
 SetStretchBltMode(r.memory,3);if StretchBlt(r.memory,0,0,w as i32,h as i32,r.screen,sx,sy,sw,sh,0x00CC0020)==0{return Err("Capture failed. Try borderless windowed mode.".into());}GdiFlush();
 if foreground_game()?!=hwnd{return Err("Capture discarded because focus changed.".into());}
 let mut rgba=std::slice::from_raw_parts(bits as *const u8,w*h*4).to_vec();for p in rgba.chunks_exact_mut(4){p.swap(0,2);p[3]=255;}
 if rgba.chunks_exact(4).all(|p|p[0].max(p[1]).max(p[2])<16){return Err("Capture is black. Use borderless windowed mode; exclusive fullscreen/HDR capture may be unsupported.".into());}
 let reference=signature(&rgba,w,h);Ok(Frame{width:w,height:h,rgba,signature:reference})
}}

pub fn ensure_game()->Result<(),String>{unsafe{foreground_game().map(|_|())}}
