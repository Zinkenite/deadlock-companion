//! Small appearance templates, coarse search followed by pixel-level centre refinement.
use serde::Deserialize;
use crate::tracking::Candidate;
#[derive(Clone,Deserialize)]
#[serde(rename_all="camelCase")]
pub struct MarkerTemplate{pub width:usize,pub height:usize,pub rgba:Vec<u8>,pub span_x:f64,pub span_y:f64,pub center_x:f64,pub center_y:f64,#[serde(default="threshold")]pub threshold:f64,#[serde(default)]pub rotate:bool,#[serde(default)]pub initial_heading:f64}
fn threshold()->f64{0.8}
#[derive(Clone,Copy,Deserialize)]pub struct Hint{pub x:f64,pub y:f64}
#[derive(Clone)]struct Feature{dx:i32,dy:i32,r:f64,g:f64,b:f64,l:f64,weight:f64}
struct Pattern{features:Vec<Feature>,sum:f64,variance:f64,weight:f64}
impl MarkerTemplate{pub fn valid(&self)->bool{self.width>=4&&self.height>=4&&self.width<=64&&self.height<=64&&self.rgba.len()==self.width*self.height*4&&[self.span_x,self.span_y,self.center_x,self.center_y,self.threshold,self.initial_heading].iter().all(|v|v.is_finite())&&self.span_x>=0.005&&self.span_x<=0.2&&self.span_y>=0.005&&self.span_y<=0.2&&self.center_x>=0.0&&self.center_x<=1.0&&self.center_y>=0.0&&self.center_y<=1.0&&self.threshold>=0.5&&self.threshold<=0.99}}
fn pattern(t:&MarkerTemplate,w:usize,h:usize,angle:f64,grid:usize,body:bool)->Pattern{
 let mut features=Vec::new();let(mut sum,mut square,mut weight)=(0.0,0.0,0.0);let(c,s)=(angle.cos(),angle.sin());
 let border=(0..t.width).map(|x|{let i=x*4;let j=((t.height-1)*t.width+x)*4;((t.rgba[i]as f64+t.rgba[i+1]as f64+t.rgba[i+2]as f64)+(t.rgba[j]as f64+t.rgba[j+1]as f64+t.rgba[j+2]as f64))/6.0}).sum::<f64>()/t.width as f64;
 for y in 0..grid{for x in 0..grid{let mut u=(x as f64+0.5)/grid as f64;let mut v=(y as f64+0.5)/grid as f64;
 if body{let nx=2.0*u-1.0;let ny=2.0*v-1.0;if nx*nx+ny*ny>1.0{continue;}let rx=t.span_x*w as f64;let ry=t.span_y*h as f64;let radius=(t.center_x.min(1.0-t.center_x)*rx).min(t.center_y.min(1.0-t.center_y)*ry)*0.85;u=t.center_x+nx*radius/rx;v=t.center_y+ny*radius/ry;}
 let tx=(u*t.width as f64).floor().min((t.width-1)as f64)as usize;let ty=(v*t.height as f64).floor().min((t.height-1)as f64)as usize;let i=(ty*t.width+tx)*4;let(r,g,b)=(t.rgba[i]as f64,t.rgba[i+1]as f64,t.rgba[i+2]as f64);let l=r*0.299+g*0.587+b*0.114;let wt=if(l-border).abs()>25.0{2.5}else{1.0};let dx=((if body{tx as f64/t.width as f64}else{u})-t.center_x)*t.span_x*w as f64;let dy=((if body{ty as f64/t.height as f64}else{v})-t.center_y)*t.span_y*h as f64;features.push(Feature{dx:(dx*c-dy*s).round()as i32,dy:(dx*s+dy*c).round()as i32,r,g,b,l,weight:wt});sum+=l*wt;square+=l*l*wt;weight+=wt;}}
 Pattern{features,sum,variance:(square-sum*sum/weight).max(0.0),weight}
}
fn score(image:&[u8],w:usize,h:usize,x:i32,y:i32,p:&Pattern)->f64{
 if p.variance<100.0{return -1.0;}let(mut sum,mut square,mut cross,mut error)=(0.0,0.0,0.0,0.0);
 for f in &p.features{let px=x+f.dx;let py=y+f.dy;if px<0||py<0||px>=w as i32||py>=h as i32{return -1.0;}let i=(py as usize*w+px as usize)*4;let(r,g,b)=(image[i]as f64,image[i+1]as f64,image[i+2]as f64);let l=r*0.299+g*0.587+b*0.114;sum+=l*f.weight;square+=l*l*f.weight;cross+=l*f.l*f.weight;error+=((r-f.r).abs()+(g-f.g).abs()+(b-f.b).abs())*f.weight;}
 let variance=square-sum*sum/p.weight;if variance<100.0{return -1.0;}let correlation=((cross-sum*p.sum/p.weight)/(variance*p.variance).sqrt()).clamp(0.0,1.0);0.75*correlation+0.25*(1.0-error/(p.weight*765.0))
}
// Learn only the foreground arrow wedge; the portrait and map background must not rotate.
struct ArrowPixel{dx:f64,dy:f64,color:[f64;3],weight:f64}
fn arrow_pixels(t:&MarkerTemplate,w:usize,h:usize)->Vec<ArrowPixel>{
 let mut border=[Vec::new(),Vec::new(),Vec::new()];for y in 0..t.height{for x in 0..t.width{if x==0||y==0||x+1==t.width||y+1==t.height{let i=(y*t.width+x)*4;for c in 0..3{border[c].push(t.rgba[i+c]);}}}}
 let mut bg=[0.0;3];for c in 0..3{border[c].sort_unstable();bg[c]=border[c][border[c].len()/2]as f64;}
 let cx=t.center_x*t.width as f64;let cy=t.center_y*t.height as f64;let body=cx.min(t.width as f64-cx).min(cy.min(t.height as f64-cy))*0.75;
 let a=t.initial_heading.to_radians();let mut out=Vec::new();
 for y in 0..t.height{for x in 0..t.width{let dx=x as f64-cx;let dy=y as f64-cy;let radius=dx.hypot(dy);let forward=dx*a.sin()-dy*a.cos();let side=dx*a.cos()+dy*a.sin();if radius<body.max(2.0)||forward<=0.0||side.abs()>forward*0.65+0.5{continue;}let i=(y*t.width+x)*4;let color=[t.rgba[i]as f64,t.rgba[i+1]as f64,t.rgba[i+2]as f64];let contrast=(0..3).map(|c|(color[c]-bg[c]).abs()).sum::<f64>()/3.0;if contrast<32.0{continue;}out.push(ArrowPixel{dx:dx*t.span_x*w as f64/t.width as f64,dy:dy*t.span_y*h as f64/t.height as f64,color,weight:(radius/body.max(1.0)).powi(2).clamp(1.0,16.0)});}}
 if out.len()>96{let count=out.len();out=out.into_iter().enumerate().filter_map(|(i,p)|if i*96/count!=(i+1)*96/count{Some(p)}else{None}).collect();}out
}
fn arrow_fit(image:&[u8],w:usize,h:usize,x:f64,y:f64,angle:f64,pixels:&[ArrowPixel])->f64{
 let(c,s)=(angle.to_radians().cos(),angle.to_radians().sin());let(mut fit,mut weight)=(0.0,0.0);
 for p in pixels{let px=x+p.dx*c-p.dy*s;let py=y+p.dx*s+p.dy*c;if px<0.0||py<0.0||px>=w as f64-1.0||py>=h as f64-1.0{return 0.0;}let ix=px.floor()as usize;let iy=py.floor()as usize;let fx=px-ix as f64;let fy=py-iy as f64;let mut error=0.0;for channel in 0..3{let sample=|xx,yy|image[(yy*w+xx)*4+channel]as f64;let top=sample(ix,iy)*(1.0-fx)+sample(ix+1,iy)*fx;let bottom=sample(ix,iy+1)*(1.0-fx)+sample(ix+1,iy+1)*fx;error+=(top*(1.0-fy)+bottom*fy-p.color[channel]).abs();}fit+=(1.0-error/360.0).clamp(0.0,1.0)*p.weight;weight+=p.weight;}
 if weight>0.0{fit/weight}else{0.0}
}
fn facing_angle(image:&[u8],w:usize,h:usize,t:&MarkerTemplate,x:i32,y:i32,_k:usize)->Option<f64>{
 let pixels=arrow_pixels(t,w,h);if pixels.len()<3{return None;}let mut accepted:Option<(f64,f64)>=None;
 // Cropping and resampling can shift an arrow's origin by one pixel.
 for(ox,oy)in[(0,0),(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,-1),(-1,1),(1,1)]{
 let cx=(x+ox)as f64;let cy=(y+oy)as f64;let mut coarse=Vec::new();let(mut best,mut angle)=(0.0,0.0);
 for k in 0..72{let a=k as f64*5.0;let value=arrow_fit(image,w,h,cx,cy,a,&pixels);coarse.push((a,value));if value>best{best=value;angle=a;}}
 let base=angle;for offset in -4..=4{let a=base+offset as f64;let value=arrow_fit(image,w,h,cx,cy,a,&pixels);if value>best{best=value;angle=a;}}
 let competitor=coarse.iter().filter(|(a,_)|((a-angle+540.0)%360.0-180.0).abs()>35.0).map(|(_,v)|*v).fold(0.0_f64,f64::max);
 if best>=0.62&&best-competitor>=0.035&&accepted.map_or(true,|(_,value)|best>value){accepted=Some((angle.rem_euclid(360.0),best));}
 }
 accepted.map(|(angle,_)|angle)
}
pub fn direction_at(image:&[u8],w:usize,h:usize,t:&MarkerTemplate,x:f64,y:f64)->Option<f64>{
 if !t.valid()||w<8||h<8||image.len()!=w*h*4||!x.is_finite()||!y.is_finite(){return None;}
 let(mut cx,mut cy)=((x*w as f64-0.5).round()as i32,(y*h as f64-0.5).round()as i32);
 // A color component can sit off center. Refine only the heading origin, never its position output.
 let body=pattern(t,w,h,0.0,10,true);let mut best=score(image,w,h,cx,cy,&body);let radius=((t.span_x*w as f64).min(t.span_y*h as f64)*0.35).round().clamp(2.0,10.0)as i32;let origin=(cx,cy);
 for dy in -radius..=radius{for dx in -radius..=radius{let value=score(image,w,h,origin.0+dx,origin.1+dy,&body);if value>best&&value>=t.threshold{best=value;cx=origin.0+dx;cy=origin.1+dy;}}}
 facing_angle(image,w,h,t,cx,cy,0)
}
fn search(image:&[u8],w:usize,h:usize,t:&MarkerTemplate,hint:Option<Hint>,body:bool)->Vec<Candidate>{
 let rotations=if t.rotate{8}else{1};let mut coarse=Vec::new();let mut fine=Vec::new();for i in 0..rotations{let a=i as f64*std::f64::consts::TAU/rotations as f64;coarse.push(pattern(t,w,h,a,6,body));fine.push(pattern(t,w,h,a,10,body));}
 let(x0,y0,x1,y1,stride)=if let Some(p)=hint.filter(|p|p.x.is_finite()&&p.y.is_finite()&&p.x>=0.0&&p.x<=1.0&&p.y>=0.0&&p.y<=1.0){let x=(p.x*w as f64)as i32;let y=(p.y*h as f64)as i32;((x-40).max(0),(y-40).max(0),(x+41).min(w as i32),(y+41).min(h as i32),2)}else{(0,0,w as i32,h as i32,3)};
 let mut peaks:Vec<(f64,i32,i32,usize)>=Vec::new();for y in(y0..y1).step_by(stride){for x in(x0..x1).step_by(stride){for(k,p)in coarse.iter().enumerate(){let value=score(image,w,h,x,y,p);if value>0.35&&(peaks.len()<32||value>peaks.last().unwrap().0){if let Some(i)=peaks.iter().position(|p|p.3==k&&(p.1-x).abs()<=3&&(p.2-y).abs()<=3){if value<=peaks[i].0{continue;}peaks.remove(i);}peaks.push((value,x,y,k));peaks.sort_unstable_by(|a,b|b.0.total_cmp(&a.0));peaks.truncate(32);}}}}
 let mut refined:Vec<(f64,i32,i32,usize)>=Vec::new();for(_,x,y,k)in peaks{let mut best=(-1.0,x,y);for dy in -3..=3{for dx in -3..=3{let value=score(image,w,h,x+dx,y+dy,&fine[k]);if value>best.0{best=(value,x+dx,y+dy);}}}if best.0>=t.threshold{refined.push((best.0,best.1,best.2,k));}}
 refined.sort_unstable_by(|a,b|b.0.total_cmp(&a.0));let mut out:Vec<Candidate>=Vec::new();let radius=(t.span_x*w as f64).min(t.span_y*h as f64)*0.6;let best=refined.first().map(|v|v.0).unwrap_or(0.0);
 for(value,x,y,k)in refined{if value<best-0.06{continue;}if out.iter().any(|p|((p.x*w as f64-x as f64).powi(2)+(p.y*h as f64-y as f64).powi(2)).sqrt()<radius.max(3.0)){continue;}out.push(Candidate{x:(x as f64+0.5)/w as f64,y:(y as f64+0.5)/h as f64,pixels:(t.span_x*w as f64*t.span_y*h as f64)as usize,quality:value,angle:facing_angle(image,w,h,t,x,y,k)});if out.len()==8{break;}}
 out
}
pub fn detect(image:&[u8],w:usize,h:usize,t:&MarkerTemplate,hint:Option<Hint>)->Vec<Candidate>{if !t.valid()||w<8||h<8||w>384||h>384||image.len()!=w*h*4{return vec![];}let mut found=search(image,w,h,t,hint,true);if found.is_empty(){found=search(image,w,h,t,hint,false);}if found.is_empty()&&hint.is_some(){found=search(image,w,h,t,None,true);if found.is_empty(){found=search(image,w,h,t,None,false);}}found}
#[cfg(test)]mod tests{
 use super::*;
 fn fixture(w:usize,h:usize,center:(f64,f64))->(Vec<u8>,MarkerTemplate){let mut patch=vec![0u8;16*16*4];for y in 0..16{for x in 0..16{let c=if x>=3&&x<=12&&y>=3&&y<=12{if x>9&&y<7{[255,220,50,255]}else if(x+y)%3==0{[140,210,240,255]}else{[50,110,210,255]}}else{[18,25,30,255]};patch[(y*16+x)*4..(y*16+x+1)*4].copy_from_slice(&c);}}let t=MarkerTemplate{width:16,height:16,rgba:patch,span_x:16.0/w as f64,span_y:16.0/h as f64,center_x:center.0,center_y:center.1,threshold:0.8,rotate:false,initial_heading:45.0};let mut image=vec![0u8;w*h*4];for p in image.chunks_mut(4){p.copy_from_slice(&[18,25,30,255]);}(image,t)}
 fn stamp(image:&mut[u8],w:usize,t:&MarkerTemplate,x:usize,y:usize){for yy in 0..16{let i=((y+yy)*w+x)*4;image[i..i+64].copy_from_slice(&t.rgba[yy*64..(yy+1)*64]);}}
 fn near(c:&Candidate,x:f64,y:f64,w:usize,h:usize){assert!((c.x*w as f64-x).abs()<=1.6,"x {} vs {x}",c.x*w as f64);assert!((c.y*h as f64-y).abs()<=1.6,"y {} vs {y}",c.y*h as f64);}
 #[test]fn whole_appearance_finds_geometric_center_not_bright_accent(){let(mut image,t)=fixture(192,160,(0.5,0.5));stamp(&mut image,192,&t,78,55);let out=detect(&image,192,160,&t,None);assert_eq!(out.len(),1,"{out:?}");near(&out[0],86.0,63.0,192,160);}
 #[test]fn custom_center_and_competing_copies(){let(mut image,t)=fixture(192,160,(0.375,0.625));stamp(&mut image,192,&t,35,40);stamp(&mut image,192,&t,130,105);let out=detect(&image,192,160,&t,None);assert_eq!(out.len(),2,"{out:?}");assert!(out.iter().any(|p|(p.x*192.0-41.0).abs()<1.6));assert!(out.iter().any(|p|(p.x*192.0-136.0).abs()<1.6));}
 #[test]fn rejects_flat_absent_and_invalid_templates(){let(image,mut t)=fixture(192,160,(0.5,0.5));assert!(detect(&image,192,160,&t,None).is_empty());t.rgba.fill(100);assert!(detect(&image,192,160,&t,None).is_empty());t.span_x=f64::NAN;assert!(detect(&image,192,160,&t,None).is_empty());}
 #[test]fn reacquires_after_bad_hint(){let(mut image,t)=fixture(384,384,(0.5,0.5));stamp(&mut image,384,&t,290,240);let out=detect(&image,384,384,&t,Some(Hint{x:0.1,y:0.1}));assert_eq!(out.len(),1);near(&out[0],298.0,248.0,384,384);}
 #[test]fn resizes_template_and_matches_quarter_turn(){let(mut image,mut t)=fixture(192,160,(0.5,0.5));let original=t.rgba.clone();let mut big=vec![0;32*32*4];for y in 0..32{for x in 0..32{let src=((y/2)*16+x/2)*4;big[(y*32+x)*4..(y*32+x+1)*4].copy_from_slice(&original[src..src+4]);}}t.width=32;t.height=32;t.rgba=big;for y in 0..16{for x in 0..16{let src=((15-x)*16+y)*4;let dst=((60+y)*192+80+x)*4;image[dst..dst+4].copy_from_slice(&original[src..src+4]);}}t.rotate=true;let out=detect(&image,192,160,&t,None);assert!(!out.is_empty(),"{out:?}");assert_eq!(out[0].angle,Some(90.0),"{out:?}");near(&out[0],88.0,68.0,192,160);}
 #[test]fn position_moves_when_outer_arrow_region_is_unreadable(){
 let(_,t)=fixture(192,160,(0.5,0.5));let mut obscured=t.clone();for y in 0..16{for x in 0..16{if ((x as f64-8.0).powi(2)+(y as f64-8.0).powi(2)).sqrt()>6.9{let i=(y*16+x)*4;obscured.rgba[i..i+4].copy_from_slice(&[210,10,130,255]);}}}
 for(x,y)in[(40,45),(65,60)]{let(mut image,_)=fixture(192,160,(0.5,0.5));stamp(&mut image,192,&obscured,x,y);let out=detect(&image,192,160,&t,None);let point=out.iter().find(|p|(p.x*192.0-(x+8)as f64).abs()<1.6&&(p.y*160.0-(y+8)as f64).abs()<1.6).expect("Position must remain detectable");assert!(point.angle.is_none(),"{point:?}");}
 }
 fn arrow_fixture(heading:f64)->Vec<u8>{let mut image=vec![0;192*160*4];let a=heading.to_radians();for y in 0..160{for x in 0..192{let dx=x as f64-90.0;let dy=y as f64-80.0;let forward=dx*a.sin()-dy*a.cos();let side=dx*a.cos()+dy*a.sin();let color=if dx.hypot(dy)<=7.0{if (x+y)%3==0{[90,140,220,255]}else{[40,100,170,255]}}else if forward>=8.0&&forward<=15.0&&side.abs()<=(15.0-forward)*0.5+0.3{[245,220,80,255]}else{[18,25,30,255]};let i=(y*192+x)*4;image[i..i+4].copy_from_slice(&color);}}image}
 #[test]fn arrow_turns_independently_of_upright_portrait(){let reference=arrow_fixture(90.0);let mut rgba=Vec::new();for y in 64..96{for x in 74..106{let i=(y*192+x)*4;rgba.extend_from_slice(&reference[i..i+4]);}}let t=MarkerTemplate{width:32,height:32,rgba,span_x:32.0/192.0,span_y:32.0/160.0,center_x:0.5,center_y:0.5,threshold:0.8,rotate:true,initial_heading:90.0};for heading in [90.0,135.0,180.0,270.0,359.0]{let image=arrow_fixture(heading);let detected=facing_angle(&image,192,160,&t,90,80,0).expect("Arrow should be readable with upright portrait");let expected=(heading-90.0).rem_euclid(360.0);assert!(((detected-expected+540.0)%360.0-180.0).abs()<=12.0,"heading={heading} detected={detected}");}}
 #[test]fn both_position_modes_report_independent_arrow_turns(){let reference=arrow_fixture(90.0);let mut rgba=Vec::new();for y in 71..89{for x in 80..106{let i=(y*192+x)*4;rgba.extend_from_slice(&reference[i..i+4]);}}let t=MarkerTemplate{width:26,height:18,rgba,span_x:26.0/192.0,span_y:18.0/160.0,center_x:10.0/26.0,center_y:0.5,threshold:0.8,rotate:true,initial_heading:90.0};for heading in [135.0,270.0]{let image=arrow_fixture(heading);let complex=detect(&image,192,160,&t,Some(Hint{x:90.5/192.0,y:80.5/160.0}));let config=crate::tracking::DetectionConfig{region:crate::tracking::Region{x:0.0,y:0.0,width:1.0,height:1.0},color:[40,100,170],tolerance:5,min_pixels:3,max_pixels:200,marker_template:None,direction_template:Some(t.clone()),hint:Some(Hint{x:90.5/192.0,y:80.5/160.0})};let simple=crate::tracking::detect(&image,192,160,&config);for(mode,points)in[("Complex",complex),("Simple",simple)]{let point=points.iter().find(|p|(p.x*192.0-90.0).abs()<2.0&&(p.y*160.0-80.0).abs()<2.0).expect("Position must be preserved");let actual=point.angle.unwrap_or_else(||panic!("{mode}: missing heading {heading}, {point:?}"));let expected=(heading-90.0).rem_euclid(360.0);assert!(((actual-expected+540.0)%360.0-180.0).abs()<=12.0,"{mode} expected {expected}, got {actual}");}}}
 #[test]fn bounded_workload(){let(mut image,t)=fixture(384,384,(0.5,0.5));stamp(&mut image,384,&t,180,210);let start=std::time::Instant::now();for _ in 0..20{assert_eq!(detect(&image,384,384,&t,None).len(),1);}println!("Appearance global search 384x384 mean: {:.3} ms",start.elapsed().as_secs_f64()*50.0);}
}
