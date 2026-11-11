import {it,expect,vi} from 'vitest';
import {NotificationSpeech} from '../src/notificationSpeech';
import type {NotificationCard} from '../src/notifications';
const card=(text:string)=>({text} as NotificationCard);
it('speaks newly appeared cards in order, applies volume and cancels pending speech',()=>{
 const spoken:SpeechSynthesisUtterance[]=[],cancel=vi.fn(),error=vi.fn();
 const speech=new NotificationSpeech({speak:(u:SpeechSynthesisUtterance)=>spoken.push(u),cancel} as unknown as SpeechSynthesis,()=>({} as SpeechSynthesisUtterance),error);
 speech.speak([card('First'),card('Second')],.6);expect(spoken.map(u=>u.text)).toEqual(['First']);expect(spoken[0].volume).toBe(.6);
 spoken[0].onend!(new Event('end') as SpeechSynthesisEvent);expect(spoken.map(u=>u.text)).toEqual(['First','Second']);
 speech.speak([card('Third')],.6);speech.cancel();spoken[1].onend!(new Event('end') as SpeechSynthesisEvent);expect(spoken).toHaveLength(2);expect(cancel).toHaveBeenCalledOnce();expect(error).not.toHaveBeenCalled();
});
it('ignores muted speech and reports unavailable speech',()=>{const error=vi.fn(),speech=new NotificationSpeech(undefined,()=>({} as SpeechSynthesisUtterance),error);speech.speak([card('Muted')],0);expect(error).not.toHaveBeenCalled();speech.speak([card('Test')],1);expect(error).toHaveBeenCalledOnce();});
