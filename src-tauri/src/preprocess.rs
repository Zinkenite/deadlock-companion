//! Small, fixed-size timer preparation. No angle correction, histograms, or retry passes.
use crate::tracking::Frame;
pub fn prepare_timer(frame:&Frame,max:usize)->Frame{
 let w=frame.width;let h=frame.height;let pad=8usize;let factor=(48.0/h.max(1)as f64).clamp(1.0,3.0).min((max.saturating_sub(pad*2))as f64/w.max(h).max(1)as f64);let ow=((w as f64*factor).round()as usize+pad*2).max(1);let oh=((h as f64*factor).round()as usize+pad*2).max(1);
 let mut border=0u64;let mut count=0u64;for x in 0..w{for y in [0,h.saturating_sub(1)]{let i=(y*w+x)*4;border+=frame.rgba[i]as u64+frame.rgba[i+1]as u64+frame.rgba[i+2]as u64;count+=3;}}
 let invert=border/count.max(1)<128;let mut rgba=vec![255;ow*oh*4];
 for y in pad..oh.saturating_sub(pad){let sy=(((y-pad)as f64/factor)as usize).min(h-1);for x in pad..ow.saturating_sub(pad){let sx=(((x-pad)as f64/factor)as usize).min(w-1);let src=(sy*w+sx)*4;let value=((frame.rgba[src]as u32*77+frame.rgba[src+1]as u32*150+frame.rgba[src+2]as u32*29)>>8)as u8;let value=if invert{255-value}else{value};let dst=(y*ow+x)*4;rgba[dst..dst+3].fill(value);}}
 Frame{width:ow,height:oh,rgba,signature:vec![]}
}
#[cfg(test)]mod tests{use super::*;#[test]fn bounded_timer_preparation(){let f=Frame{width:150,height:20,rgba:vec![100;150*20*4],signature:vec![]};let p=prepare_timer(&f,2600);assert_eq!(p.width,376);assert_eq!(p.height,64);assert_eq!(p.rgba[0],255);assert_eq!(p.rgba.len(),p.width*p.height*4);}}
