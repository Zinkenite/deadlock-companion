import {useEffect, useState} from 'react';
import {Check} from 'lucide-react';
import {useGameReader, type GameReaderSnapshot} from './gameReader';
import type {MapSide} from './mapOrientation';
import './matchConnection.css';

type MatchPresentation = {active: boolean; started: boolean; id: number | null; sequence: number; side: MapSide | null};
const idle: MatchPresentation = {active: false, started: false, id: null, sequence: 0, side: null};

export function useMatchPresentation() {
 const [match, setMatch] = useState(idle);
 useEffect(() => {
  let exit: ReturnType<typeof setTimeout> | undefined;
  const accept = (snapshot: GameReaderSnapshot) => {
   if (!snapshot.enabled) {
    clearTimeout(exit);
    exit = undefined;
    setMatch(idle);
    return;
   }
   if (!snapshot.attached || snapshot.inMatch === false) {
    exit ??= setTimeout(() => setMatch(idle), 5000);
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
    return {active: true, id, side, started, sequence: previous.sequence + Number(newMatch)};
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

export default function MatchConnection({side, started}: {side: MapSide | null; started: boolean}) {
 const patron = side && patrons[side];
 return <section className="match-connection" data-side={side ?? undefined} aria-label="Match connection" role="status">
  <div className="match-connection-content">
   <div className="match-connection-emblem" key={side ?? 'unknown'}>
    {patron ? <img src={patron.image} alt="" /> : <Check size={38} aria-hidden="true"/>}
   </div>
   <h2>Match found</h2>
   {patron && <p className="match-connection-patron" key={side}>{patron.name}</p>}
   <div className="match-connection-status"><span aria-hidden="true"/>{started ? 'Waiting for player data' : 'Waiting for match timer'}</div>
  </div>
 </section>;
}
