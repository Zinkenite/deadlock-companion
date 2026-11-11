import type {NotificationCard} from './notifications';
/** Own speech in the main window so overlay redraws cannot repeat it. */
export class NotificationSpeech {
 private queue: string[]=[];
 private current?: SpeechSynthesisUtterance;
 constructor(private synth:SpeechSynthesis|undefined,private utterance:()=>SpeechSynthesisUtterance,private onError:(message:string)=>void){}
 private volume=1;
 speak(cards:NotificationCard[],volume:number){
  if(!cards.length||volume<=0)return;
  if(!this.synth){this.onError('Spoken notifications are unavailable on this system.');return;}
  this.volume=Math.max(0,Math.min(1,volume));
  this.queue.push(...cards.map(c=>c.text.trim()).filter(Boolean));this.queue=this.queue.slice(-100);this.next();
 }
 private next(){
  if(this.current||!this.queue.length||!this.synth)return;
  const speech=this.utterance();speech.text=this.queue.shift()!;speech.volume=this.volume;this.current=speech;
  speech.onend=()=>{if(this.current!==speech)return;this.current=undefined;this.next();};
  speech.onerror=()=>{if(this.current!==speech)return;this.cancel();this.onError('Could not read the notification aloud. Check your system speech voice.');};
  try{this.synth.speak(speech);}catch{this.cancel();this.onError('Could not start spoken notifications.');}
 }
 cancel(){const busy=!!this.current;this.current=undefined;this.queue=[];if(busy)this.synth?.cancel();}
}
