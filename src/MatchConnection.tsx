import {useEffect, useState} from 'react';
import {Check} from 'lucide-react';
import {useMatchAnalysis} from './matchAnalytics';
import {countRosterSeats, useGameReader} from './gameReader';
import type {MapSide} from './mapOrientation';
import './matchConnection.css';

type Stage = 'waiting' | 'found' | 'leaving' | 'done';

const patrons: Record<MapSide, {name: string; image: string}> = {
 hiddenKing: {name: 'Hidden King', image: '/map-assets/patron-hidden-king.png'},
 archMother: {name: 'Arch Mother', image: '/map-assets/patron-arch-mother.png'},
};

function ConnectionSequence() {
 const side = useGameReader(s => s.side);
 const matchId = useGameReader(s => s.matchId);
 const completeRoster = useMatchAnalysis(s => countRosterSeats(s.players.map(p => p.player)) === 12);
 const localTeam = useMatchAnalysis(s => s.localTeam);
 const currentRoster = useGameReader(s => s.inMatch === true && countRosterSeats(s.players) === 12);
 const [stage, setStage] = useState<Stage>('waiting');
 const [patronSide, setPatronSide] = useState<MapSide>();
 const [knownMatch, setKnownMatch] = useState(matchId);

 useEffect(() => {
  if (matchId === null || matchId === knownMatch) return;
  if (knownMatch !== null) {
   setStage('waiting');
   setPatronSide(undefined);
  }
  setKnownMatch(matchId);
 }, [matchId, knownMatch]);

 useEffect(() => {
  if (stage !== 'waiting' || !currentRoster || !completeRoster) return;
  setPatronSide(side ?? (localTeam === 2 ? 'hiddenKing' : localTeam === 3 ? 'archMother' : undefined));
  setStage('found');
 }, [stage, currentRoster, completeRoster, side, localTeam]);

 useEffect(() => {
  if (stage !== 'found' && stage !== 'leaving') return;
  const timer = setTimeout(() => setStage(stage === 'found' ? 'leaving' : 'done'), stage === 'found' ? 1450 : 240);
  return () => clearTimeout(timer);
 }, [stage]);

 if (stage === 'waiting' || stage === 'done') return null;
 const patron = patronSide && patrons[patronSide];

 return <section className="match-connection" data-stage={stage} data-side={patronSide} aria-label="Match connection">
  <div className="match-connection-emblem">
   {patron ? <img src={patron.image} alt="" /> : <Check size={38} aria-hidden="true"/>}
  </div>
  <div className="match-connection-copy" role="status" aria-atomic="true">
   <h2>Match found</h2>
   {patron && <p>{patron.name}</p>}
  </div>
 </section>;
}

export default function MatchConnection() {
 const enabled = useGameReader(s => s.enabled && s.attached);
 const inMatch = useGameReader(s => s.inMatch);
 const [active, setActive] = useState(false);

 useEffect(() => {
  if (!enabled) {
   setActive(false);
   return;
  }
  if (inMatch === true) {
   setActive(true);
   return;
  }
  if (inMatch === false) {
   // Give the reader a chance to recover from a brief loss of match data.
   const timer = setTimeout(() => setActive(false), 2500);
   return () => clearTimeout(timer);
  }
 }, [enabled, inMatch]);

 return enabled && active ? <ConnectionSequence/> : null;
}
