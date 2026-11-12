import {useEffect, useState} from 'react';
import {Check, Radio, Users} from 'lucide-react';
import {countRosterSeats, useGameReader} from './gameReader';
import type {MapSide} from './mapOrientation';
import './matchConnection.css';

type Stage = 'connecting' | 'patron' | 'roster' | 'ready' | 'leaving' | 'done';

const patrons: Record<MapSide, {name: string; image: string}> = {
 hiddenKing: {name: 'Hidden King', image: '/map-assets/patron-hidden-king.png'},
 archMother: {name: 'Arch Mother', image: '/map-assets/patron-arch-mother.png'},
};

function ConnectionSequence() {
 const side = useGameReader(s => s.side);
 const rosterSeats = useGameReader(s => countRosterSeats(s.players));
 const hasRoster = useGameReader(s => s.inMatch === true && countRosterSeats(s.players) === 12);
 const matchId = useGameReader(s => s.matchId);
 const [stage, setStage] = useState<Stage>('connecting');
 const [patronSide, setPatronSide] = useState<MapSide>();
 const [knownMatch, setKnownMatch] = useState(matchId);

 useEffect(() => {
  if (matchId === null || matchId === knownMatch) return;
  if (knownMatch !== null) {
   setStage('connecting');
   setPatronSide(undefined);
  }
  setKnownMatch(matchId);
 }, [matchId, knownMatch]);

 useEffect(() => {
  if (stage !== 'connecting') return;
  if (side) {
   const timer = setTimeout(() => {
    setPatronSide(side);
    setStage('patron');
   }, 500);
   return () => clearTimeout(timer);
  }
  if (hasRoster) {
   const timer = setTimeout(() => setStage('ready'), 1500);
   return () => clearTimeout(timer);
  }
 }, [stage, side, hasRoster]);

 useEffect(() => {
  const transitions: Partial<Record<Stage, [Stage, number]>> = {
   patron: ['roster', 1050],
   roster: hasRoster ? ['ready', 650] : undefined,
   ready: ['leaving', 1450],
   leaving: ['done', 240],
  };
  const transition = transitions[stage];
  if (!transition) return;
  const timer = setTimeout(() => setStage(transition[0]), transition[1]);
  return () => clearTimeout(timer);
 }, [stage, hasRoster]);

 if (stage === 'done') return null;

 const patron = patronSide && patrons[patronSide];
 const ready = stage === 'ready' || stage === 'leaving';
 const title = ready ? 'Roster found' : patron ? 'Match found on ' + patron.name : 'Connecting to match';
 const caption = ready ? 'Your match view is ready.' : stage === 'roster' ? 'Waiting for roster… ' + rosterSeats + '/12' : patron ? 'Side confirmed' : 'Waiting for side detection…';

 return <section className="match-connection" data-stage={stage} data-side={patronSide} aria-label="Match connection">
  <div className="match-connection-emblem" key={'emblem-' + (patronSide ?? 'connecting')}>
   {patron ? <img src={patron.image} alt="" /> : <Radio size={38} aria-hidden="true"/>}
  </div>
  <div className="match-connection-copy" key={'copy-' + (ready ? 'ready' : stage)} role="status" aria-atomic="true">
   <h2>{title}</h2>
   <p>{ready ? <Check size={17} aria-hidden="true"/> : stage === 'roster' ? <Users size={16} aria-hidden="true"/> : null}{caption}</p>
  </div>
  <div className="match-connection-progress" aria-hidden="true"><i/><i/><i/></div>
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
