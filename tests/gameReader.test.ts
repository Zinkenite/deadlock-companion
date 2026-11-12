import {countRosterSeats, type MatchPlayer} from '../src/gameReader';
import {it,expect,afterEach} from 'vitest';
import {defaultGameReader,sanitizeGameReader,useGameReader,initialReaderSnapshot,readerTimerSample} from '../src/gameReader';
afterEach(()=>useGameReader.setState(initialReaderSnapshot,true));
it('keeps process reading opt-in and defaults to low-impact scans',()=>{expect(defaultGameReader.enabled).toBe(false);expect(sanitizeGameReader({enabled:true,speed:'wrong',account:'not-an-id'})).toMatchObject({enabled:true,speed:'slow',account:''});});
it('accepts only a fresh observed match clock, including a paused or pre-game zero clock',()=>{const now=Date.now();useGameReader.setState({...initialReaderSnapshot,enabled:true,attached:true,inMatch:true,timer:0,timerAt:now,paused:true});expect(readerTimerSample(now)).toEqual({value:0,at:now});expect(readerTimerSample(now+5000)).toBeUndefined();useGameReader.setState({inMatch:false});expect(readerTimerSample(now)).toBeUndefined();useGameReader.setState({inMatch:true,attached:false});expect(readerTimerSample(now)).toBeUndefined();});

it('requires six populated and distinct seats on each team for a complete roster', () => {
 const players = Array.from({length:12}, (_, slot) => ({slot, team:slot < 6 ? 2 : 3, heroId:slot+1} as MatchPlayer));
 expect(countRosterSeats(players.slice(0, 11))).toBe(11);
 expect(countRosterSeats([...players.slice(0, 11), players[10]])).toBe(11);
 expect(countRosterSeats([...players.slice(0, 11), {...players[11], heroId:0}])).toBe(11);
 expect(countRosterSeats([...players.slice(0, 11), {...players[11], team:2}])).toBe(11);
 expect(countRosterSeats(players)).toBe(12);
});
