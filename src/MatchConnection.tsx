import {useEffect, useState} from 'react';
import {Check} from 'lucide-react';
import {useGameReader, type GameReaderSnapshot} from './gameReader';
import type {MapSide} from './mapOrientation';
import './matchConnection.css';

type MatchPresentation = {active: boolean; started: boolean; id: number | null; side: MapSide | null};
const idle: MatchPresentation = {active: false, started: false, id: null, side: null};

export function useMatchPresentation() {
 const [match, setMatch] = useState(idle);
 useEffect(() => {
  let exit: ReturnType<typeof setTimeout> | undefined;
  const accept = (snapshot: GameReaderSnapshot) => {
   if (!snapshot.enabled || !snapshot.attached) {
    clearTimeout(exit);
    exit = undefined;
    setMatch(idle);
    return;
   }
   if (snapshot.inMatch === false) {
    exit ??= setTimeout(() => setMatch(idle), 2500);
    return;
   }
   clearTimeout(exit);
   exit = undefined;
   if (snapshot.inMatch !== true) return;
   const clockStarted = !snapshot.pregame && snapshot.timer !== null
    && Number.isFinite(snapshot.timer) && snapshot.timer >= 0;
   setMatch(previous => {
    const newMatch = previous.id !== null && snapshot.matchId !== null && previous.id !== snapshot.matchId;
    const id = snapshot.matchId ?? previous.id;
    const side = snapshot.side ?? (newMatch ? null : previous.side);
    const started = clockStarted || (!newMatch && previous.started);
    if (previous.active && previous.id === id && previous.side === side && previous.started === started) return previous;
    return {active: true, id, side, started};
   });
  };
  const unsubscribe = useGameReader.subscribe(accept);
  accept(useGameReader.getState());
  return () => { clearTimeout(exit); unsubscribe(); };
 }, []);
 return match;
}

const patrons: Record<MapSide, {name: string; image: string}> = {
 hiddenKing: {name: 'Hidden King', image: '/map-assets/patron-hidden-king.png'},
 archMother: {name: 'Arch Mother', image: '/map-assets/patron-arch-mother.png'},
};

export default function MatchConnection({match}: {match: MatchPresentation}) {
 const [dismissed, setDismissed] = useState(false);
 useEffect(() => {
  if (!match.active || !match.started) {
   setDismissed(false);
   return;
  }
  const timeout = setTimeout(() => setDismissed(true), 240);
  return () => clearTimeout(timeout);
 }, [match.active, match.started, match.id]);

 if (!match.active || dismissed) return null;
 const patron = match.side && patrons[match.side];
 return <section className="match-connection" data-stage={match.started ? 'leaving' : 'found'} data-side={match.side ?? undefined} aria-label="Match connection">
  <div className="match-connection-emblem" key={match.side ?? 'unknown'}>
   {patron ? <img src={patron.image} alt="" /> : <Check size={38} aria-hidden="true"/>}
  </div>
  <div className="match-connection-copy" role="status" aria-atomic="true">
   <h2>Match found</h2>
   {patron && <p>{patron.name}</p>}
  </div>
 </section>;
}
