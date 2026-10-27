//! Bounded image preparation for small, stylized HUD crops.
use crate::{tracking::Frame,ocr::TextRegion};
pub fn prepare(frame:&Frame,r:&TextRegion,max:usize,mode:&str)->Frame{
 let w=frame.width;let h=frame.height;let mut hist=[0usize;256];let mut gray=Vec::with_capacity(w*h);
 for p in frame.rgba.chunks_exact(4){let v=((p[0]as u32*77+p[1]as u32*150+p[2]as u32*29)/256)as u8;gray.push(v);hist[v as usize]+=1;}
 let percentile=|fraction:f64|{let target=(w*h)as f64*fraction;let mut total=0;for(i,n)in hist.iter().enumerate(){total+=n;if total as f64>=target{return i as f64;}}255.0};
 let low=percentile(0.01);let high=percentile(0.99).max(low+24.0);let contrast=|v:f64|((v-low)*255.0/(high-low)).clamp(0.0,255.0);
 let border=(0..w).map(|x|gray[x]as f64+gray[(h-1)*w+x]as f64).sum::<f64>()/(w*2)as f64;let bright=contrast(border)<128.0;
 let angle=r.angle.clamp(-35.0,35.0).to_radians();let shear=r.slant.clamp(-30.0,30.0).to_radians().tan();let(cos,sin)=(angle.cos(),angle.sin());
 let mut minx=f64::MAX;let mut miny=f64::MAX;let mut maxx=f64::MIN;let mut maxy=f64::MIN;
 for(x,y)in[(-(w as f64)/2.0,-(h as f64)/2.0),(w as f64/2.0,-(h as f64)/2.0),(-(w as f64)/2.0,h as f64/2.0),(w as f64/2.0,h as f64/2.0)]{let sx=x+shear*y;let px=sx*cos-y*sin;let py=sx*sin+y*cos;minx=minx.min(px);miny=miny.min(py);maxx=maxx.max(px);maxy=maxy.max(py);}
 let factor=r.scale.clamp(1.0,4.0).min(1600.0/(maxx-minx+32.0)).min(512.0/(maxy-miny+32.0)).max(0.5);let pad=12usize;
 let ow=(((maxx-minx)*factor).ceil()as usize+pad*2).min(max).max(1);let oh=(((maxy-miny)*factor).ceil()as usize+pad*2).min(max).max(1);let mut luminance=vec![255.0;ow*oh];
 for y in pad..oh.saturating_sub(pad){for x in pad..ow.saturating_sub(pad){let dx=(x-pad)as f64/factor+minx;let dy=(y-pad)as f64/factor+miny;let ry=-sin*dx+cos*dy;let rx=cos*dx+sin*dy-shear*ry;let sx=rx+w as f64/2.0;let sy=ry+h as f64/2.0;
 if sx<0.0||sy<0.0||sx>w as f64-1.0||sy>h as f64-1.0{continue;}let x0=sx.floor()as usize;let y0=sy.floor()as usize;let x1=(x0+1).min(w-1);let y1=(y0+1).min(h-1);let fx=sx-x0 as f64;let fy=sy-y0 as f64;let value=(gray[y0*w+x0]as f64*(1.0-fx)+gray[y0*w+x1]as f64*fx)*(1.0-fy)+(gray[y1*w+x0]as f64*(1.0-fx)+gray[y1*w+x1]as f64*fx)*fy;let value=contrast(value);luminance[y*ow+x]=if mode=="dark"{value}else if mode=="light"||bright{255.0-value}else{value};
 }}
 let mut out=vec![255u8;ow*oh*4];let mut integral=vec![0.0;(ow+1)*(oh+1)];if mode=="adaptive"{for y in 0..oh{let mut row=0.0;for x in 0..ow{row+=luminance[y*ow+x];integral[(y+1)*(ow+1)+x+1]=integral[y*(ow+1)+x+1]+row;}}}
 for y in 0..oh{for x in 0..ow{let i=y*ow+x;let v=luminance[i];let value=if mode=="adaptive"{let radius=12usize;let left=x.saturating_sub(radius);let top=y.saturating_sub(radius);let right=(x+radius+1).min(ow);let bottom=(y+radius+1).min(oh);let mean=(integral[bottom*(ow+1)+right]-integral[top*(ow+1)+right]-integral[bottom*(ow+1)+left]+integral[top*(ow+1)+left])/((right-left)*(bottom-top))as f64;if v<mean-8.0{0}else{255}}else if mode=="light"||mode=="dark"{if v<(255-r.threshold)as f64{0}else{255}}else{v.round()as u8};out[i*4..i*4+3].fill(value);}}
 Frame{width:ow,height:oh,rgba:out,signature:vec![]}
}
#[cfg(test)]mod tests{use super::*;#[test]fn pads_and_bounds_geometry(){let f=Frame{width:30,height:12,rgba:vec![100;30*12*4],signature:vec![]};let r=TextRegion::test("timer");let p=prepare(&f,&r,2600,"adaptive");assert!(p.width>=84);assert!(p.height>=48);assert_eq!(p.rgba[0],255);assert!(p.width<=1600&&p.height<=512);}}
