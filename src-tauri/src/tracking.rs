//! Small, deterministic colour-component detector. No model, OCR, or game memory access.
use serde::{Deserialize,Serialize};
#[derive(Clone,Copy,Deserialize,Serialize,Debug)]
pub struct Region {pub x:f64,pub y:f64,pub width:f64,pub height:f64}
impl Region {pub fn valid(&self)->bool {[self.x,self.y,self.width,self.height].iter().all(|n|n.is_finite())&&self.x>=0.0&&self.y>=0.0&&self.width>=0.002&&self.height>=0.002&&self.x+self.width<=1.00001&&self.y+self.height<=1.00001}}
#[derive(Deserialize)]
#[serde(rename_all="camelCase")]
pub struct DetectionConfig {pub region:Region,pub color:[u8;3],pub tolerance:u8,pub min_pixels:usize,pub max_pixels:usize,#[serde(default)]pub marker_template:Option<crate::template_match::MarkerTemplate>,#[serde(default)]pub direction_template:Option<crate::template_match::MarkerTemplate>,#[serde(default)]pub hint:Option<crate::template_match::Hint>}
#[derive(Serialize,Debug)]
pub struct Candidate {pub x:f64,pub y:f64,pub pixels:usize,pub quality:f64,#[serde(skip_serializing_if="Option::is_none")]pub angle:Option<f64>}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct Frame {pub width:usize,pub height:usize,pub rgba:Vec<u8>,pub signature:Vec<f64>}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
pub struct Detection {pub candidates:Vec<Candidate>,pub signature:Vec<f64>,pub processing_ms:f64,pub width:usize,pub height:usize}
pub fn signature(rgba:&[u8],w:usize,h:usize)->Vec<f64>{
 let mut sums=vec![0.0;144];let mut counts=[0u32;144];
 for y in 0..h{for x in 0..w{let i=(y*w+x)*4;let cell=(y*12/h)*12+x*12/w;sums[cell]+=(rgba[i] as f64*0.299)+(rgba[i+1] as f64*0.587)+(rgba[i+2] as f64*0.114);counts[cell]+=1;}}
 for(i,n)in counts.iter().enumerate(){sums[i]/=(*n).max(1) as f64;}sums
}
pub fn detect(rgba:&[u8],w:usize,h:usize,c:&DetectionConfig)->Vec<Candidate>{
 if let Some(template)=&c.marker_template{return crate::template_match::detect(rgba,w,h,template,c.hint);}
 if w<8||h<8||rgba.len()!=w*h*4{return vec![];}
 let tolerance=(c.tolerance.clamp(5,100) as i32).pow(2)*3;
 let mut mask=vec![false;w*h];
 for y in 1..h-1{for x in 1..w-1{let i=(y*w+x)*4;let distance=(0..3).map(|k|(rgba[i+k] as i32-c.color[k] as i32).pow(2)).sum::<i32>();mask[y*w+x]=distance<=tolerance;}}
 let mut out=vec![];let mut stack=Vec::new();
 for seed in 0..mask.len(){if !mask[seed]{continue;}mask[seed]=false;stack.push(seed);let(mut count,mut sx,mut sy,mut minx,mut maxx,mut miny,mut maxy)=(0,0usize,0usize,w,0,h,0);
  while let Some(p)=stack.pop(){let x=p%w;let y=p/w;count+=1;sx+=x;sy+=y;minx=minx.min(x);maxx=maxx.max(x);miny=miny.min(y);maxy=maxy.max(y);
   for dy in -1i32..=1{for dx in -1i32..=1{let nx=x as i32+dx;let ny=y as i32+dy;if nx>=0&&ny>=0&&nx<w as i32&&ny<h as i32{let next=ny as usize*w+nx as usize;if mask[next]{mask[next]=false;stack.push(next);}}}}
  }
  let bw=maxx-minx+1;let bh=maxy-miny+1;let fill=count as f64/(bw*bh) as f64;let aspect=bw.max(bh) as f64/bw.min(bh) as f64;
  if count>=c.min_pixels.max(1)&&count<=c.max_pixels.min(4096)&&fill>=0.22&&aspect<=3.5{out.push(Candidate{x:(sx as f64/count as f64+0.5)/w as f64,y:(sy as f64/count as f64+0.5)/h as f64,pixels:count,quality:(fill*0.6+0.4/aspect).min(1.0),angle:None});}
 }
 // Keep common-colour noise bounded while preserving candidates nearest the saved marker position.
 let mut found=if out.len()>64 {
  if let Some(hint)=c.hint.filter(|p|p.x.is_finite()&&p.y.is_finite()&&p.x>=0.0&&p.x<=1.0&&p.y>=0.0&&p.y<=1.0) {
   out.sort_unstable_by(|a,b|{let da=(a.x-hint.x).powi(2)+(a.y-hint.y).powi(2);let db=(b.x-hint.x).powi(2)+(b.y-hint.y).powi(2);da.total_cmp(&db)});
   out.truncate(64);
   out
  }else{vec![]}
 }else{out};
 if let Some(t)=&c.direction_template{if let Some(hint)=c.hint{found.sort_unstable_by(|a,b|((a.x-hint.x).powi(2)+(a.y-hint.y).powi(2)).total_cmp(&((b.x-hint.x).powi(2)+(b.y-hint.y).powi(2))));}for point in found.iter_mut().take(8){point.angle=crate::template_match::direction_at(rgba,w,h,t,point.x,point.y);}}
 found
}
#[cfg(test)]mod tests{
 use super::*;
 fn config()->DetectionConfig{DetectionConfig{region:Region{x:0.0,y:0.0,width:1.0,height:1.0},color:[255,210,40],tolerance:10,min_pixels:3,max_pixels:50,marker_template:None,direction_template:None,hint:None}}
 #[test]fn simple_position_moves_with_unreadable_direction(){let mut c=config();c.direction_template=Some(crate::template_match::MarkerTemplate{width:4,height:4,rgba:vec![100;64],span_x:0.125,span_y:0.125,center_x:0.5,center_y:0.5,threshold:0.8,rotate:true,initial_heading:0.0});for(cx,cy)in[(8,10),(18,20)]{let mut image=vec![0;32*32*4];for y in cy..cy+3{for x in cx..cx+3{let i=(y*32+x)*4;image[i..i+3].copy_from_slice(&[255,210,40]);}}let points=detect(&image,32,32,&c);assert_eq!(points.len(),1);assert!((points[0].x-(cx as f64+1.5)/32.0).abs()<1e-6);assert!(points[0].angle.is_none());}}
 #[test]fn centroid_and_competing_markers(){let mut image=vec![0;32*32*4];for(cx,cy)in[(8,10),(24,20)]{for y in cy..cy+3{for x in cx..cx+3{let i=(y*32+x)*4;image[i..i+3].copy_from_slice(&[255,210,40]);}}}let points=detect(&image,32,32,&config());assert_eq!(points.len(),2);assert!((points[0].x-9.5/32.0).abs()<1e-6);}
 #[test]fn common_legacy_colour_keeps_nearest_candidates(){let mut image=vec![0;128*128*4];for i in 0..80{let x=4+(i%10)*11;let y=4+(i/10)*11;for yy in y..y+2{for xx in x..x+2{let p=(yy*128+xx)*4;image[p..p+3].copy_from_slice(&[255,210,40]);}}}let mut c=config();c.hint=Some(crate::template_match::Hint{x:5.0/128.0,y:5.0/128.0});let points=detect(&image,128,128,&c);assert_eq!(points.len(),64);assert!((points[0].x-5.0/128.0).abs()<1e-6);assert!((points[0].y-5.0/128.0).abs()<1e-6);}
#[test]fn rejects_noise_and_large_regions(){let mut image=vec![0;32*32*4];image[12..15].copy_from_slice(&[255,210,40]);assert!(detect(&image,32,32,&config()).is_empty());for pixel in image.chunks_mut(4){pixel[..3].copy_from_slice(&[255,210,40]);}assert!(detect(&image,32,32,&config()).is_empty());}
 #[test]fn validates_region(){assert!(config().region.valid());assert!(!Region{x:f64::NAN,y:0.0,width:1.0,height:1.0}.valid());assert!(!Region{x:0.8,y:0.0,width:0.4,height:1.0}.valid());}
 #[test]fn reference_signature_has_fixed_size(){let image=vec![100;48*48*4];let s=signature(&image,48,48);assert_eq!(s.len(),144);assert!(s.iter().all(|v|(v-100.0).abs()<1e-6));}
 #[test]fn reference_detector_workload(){let mut image=vec![0u8;384*384*4];for y in 180..187{for x in 190..197{let i=(y*384+x)*4;image[i..i+3].copy_from_slice(&[255,210,40]);}}let start=std::time::Instant::now();for _ in 0..100{let result=detect(&image,384,384,&config());assert_eq!(result.len(),1);let _=signature(&image,384,384);}println!("Synthetic 384x384 detection + signature mean: {:.3} ms (excludes capture and UI)",start.elapsed().as_secs_f64()*10.0);}

}
