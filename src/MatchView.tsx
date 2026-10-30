import TagTooltip from './TagTooltip';
import { memo, useEffect, useState } from 'react';
import { Activity, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useMatchAnalysis, rankTeam, estimateWinChance, type Badge, type PlayerMetrics } from './matchAnalytics';
import heroes from './heroAssets.json';
import './match.css';
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const format = (n: number) => number.format(n);
const compactNumber = new Intl.NumberFormat('en-US', {notation:'compact',maximumFractionDigits:1});
const compact = (v:number|null) => v===null?'—':compactNumber.format(v);
const heroArt = heroes as Record<string, {
    name: string;
    portrait?: string;
}>;
function BadgeSlot({ badge }: {
    badge: Badge | undefined;
}) {
    const [shown, setShown] = useState(badge), [leaving, setLeaving] = useState(false);
    useEffect(() => { if (shown?.id === badge?.id)
        return; setLeaving(true); const id = setTimeout(() => { setShown(badge); setLeaving(false); }, 130); return () => clearTimeout(id); }, [badge?.id, shown?.id]);
    const current = shown?.id === badge?.id ? badge : shown;
    return current ? <TagTooltip badges={[current]}><span className={'match-badge ' + current.tone + ' tag-' + current.id + (leaving ? ' leaving' : '')} >{current.label}</span></TagTooltip> : null;
}
const PlayerCard = memo(function PlayerCard({ metric, party, rank, clock }: {
    metric: PlayerMetrics;
    party: boolean;
    rank: number;
    clock: number|null;
}) {
    const { player: p, badges, spm, share, laneDelta } = metric, art = heroArt[p.heroId];
    const [failed, setFailed] = useState(false);
    useEffect(() => setFailed(false), [p.heroId]);
    const damage=typeof p.heroDamage==='number'&&Number.isFinite(p.heroDamage)&&p.heroDamage>=0?p.heroDamage:null,dpm=damage!==null&&clock!==null&&clock>=1?damage/(clock/60):null;

    const standout = badges.find(b => ['unstoppable', 'on-fire', 'dominating', 'comeback'].includes(b.id));
    return <article className={'match-player' + (p.isUs ? ' is-you' : '') + (standout ? ' performance-' + standout.tone : '')} aria-description={(art?.name ?? 'Hero '+p.heroId)+' · '+(spm===null?'—':format(spm))+' SPM · '+(laneDelta===null?share.toFixed(1)+'% team share':(laneDelta>=0?'+':'−')+format(Math.abs(laneDelta))+' souls versus lane')} aria-label={p.name + (p.isUs ? ' (You)' : '')} data-rank={rank}>
  <div className="match-identity"><div className="match-portrait">{art?.portrait && !failed ? <img src={art.portrait} alt={art.name} width="32" height="32" onError={() => setFailed(true)}/> : <span title={'Hero ID ' + p.heroId}>{art?.name.slice(0, 2) ?? p.heroId}</span>}<b className="match-rank" title="Team performance rank: With complete team damage: 35% combat efficiency, 35% net worth, 15% levels, 15% hero damage. Without it: 45% combat, 40% net worth, 15% levels. Estimated from observed stats.">{rank}</b></div><div className="match-player-name"><strong title={p.name}>{p.name || 'Unknown player'}{p.isUs && <b className="match-you">YOU</b>}{party && <b className="match-party" title="Shared party ID reported by the reader">PARTY</b>}</strong><span>{art?.name ?? 'Hero ' + p.heroId}</span></div>
  <div className="match-inline-metrics"><strong title="Kills / deaths / assists">{p.kills}<i>/</i>{p.deaths}<i>/</i>{p.assists}</strong><span><span title="Net worth per match minute">{spm === null ? '—' : format(spm)} <small>SPM</small></span><span className={laneDelta === null ? '' : laneDelta >= 0 ? 'positive' : 'negative'} title={laneDelta === null ? 'Share of observed team net worth' : 'Soul difference versus opposing lane average'}>{laneDelta === null ? share.toFixed(0) + '%' : (laneDelta >= 0 ? '+' : '−') + format(Math.abs(laneDelta))}<small>{laneDelta === null ? ' share' : ' lane'}</small></span></span></div>
  <div className="match-damage" title={'Total hero damage: '+(damage===null?'unavailable':format(damage))+' · Damage per match minute: '+(dpm===null?'unavailable':format(dpm))}><span><b>{compact(damage)}</b><small>DMG</small></span><span><b>{compact(dpm)}</b><small>DPM</small></span></div><div className="match-worth"><strong title="Total net worth">{format(p.netWorth)}</strong><span>Lv {p.level}{p.lane !== null ? ' · L' + p.lane : ''}</span></div></div>
  <div className="match-badges" aria-label="Performance badges">{[0, 1, 2].map(i => <span key={i} className={i===2?"match-tag-slot third-tag":"match-tag-slot"}><BadgeSlot badge={badges[i]}/></span>)}{badges.length > 3 && <span className="overflow-three"><TagTooltip badges={badges.slice(3)}><span className="match-badge overflow" >+{badges.length - 3}</span></TagTooltip></span>}{badges.length > 2 && <span className="overflow-two"><TagTooltip badges={badges.slice(2)}><span className="match-badge overflow" >+{badges.length - 2}</span></TagTooltip></span>}</div>
 </article>;
});
export default function MatchView({ openSettings }: {
    openSettings: () => void;
}) {
    const m = useMatchAnalysis(), ours = m.localTeam ?? 2, theirs = ours === 2 ? 3 : 2;
    const team = (side: number) => rankTeam(m.players.filter(p => p.player.team === side)), a = team(ours), b = team(theirs);
    const sum = (ps: PlayerMetrics[], key: 'kills' | 'deaths' | 'assists' | 'netWorth' | 'level') => ps.reduce((n, p) => n + p.player[key], 0), delta = sum(a, 'netWorth') - sum(b, 'netWorth');
    const kda = (ps: PlayerMetrics[]) => format(sum(ps, 'kills')) + ' / ' + format(sum(ps, 'deaths')) + ' / ' + format(sum(ps, 'assists'));
    const labels = { waiting: 'Waiting', disabled: 'Reader disabled', live: 'Live', paused: 'Paused', stale: 'Last reading', ended: 'Last match' };
    const context = (m.status === 'stale' || m.status === 'waiting' || m.status === 'disabled' ? 'Showing the last observed stats. ' : m.status === 'ended' ? 'Last observed match summary. ' : '') + (m.lateJoin ? 'Joined in progress; earlier events are not inferred. ' : '') + 'Tags are estimates; hover for conditions. Party IDs and ultimate upgrades are unavailable in the reader.';
    const complete=a.length===6&&b.length===6&&m.localTeam!==null;
    const chance=complete?estimateWinChance(a,b,m.clock):50;
    return <div className="match-view" aria-label="Match performance"><div className="match-summary"><div className="match-souls" title={m.localTeam ? 'Team soul differential' : 'Hidden King soul differential'}>{delta >= 0 ? <ArrowUpRight size={15}/> : <ArrowDownRight size={15}/>}<strong className={delta >= 0 ? 'positive' : 'negative'}>{!m.players.length ? '—' : (delta >= 0 ? '+' : '−') + format(Math.abs(delta))}</strong><span>souls {delta >= 0 ? 'ahead' : 'behind'}</span></div><div className="match-team-kda" title="Your team versus enemy team · kills / deaths / assists"><span>K/D/A</span><strong>{m.players.length ? kda(a) : '—'}</strong><i>vs</i><strong>{m.players.length ? kda(b) : '—'}</strong></div><span className={'match-live-state ' + m.status} title={context}><span />{labels[m.status]}</span></div>
 <div className="win-estimate" title="Estimated win probability, not a calibrated prediction. Uses relative souls, levels, kills, assists, observed momentum and total/recent hero damage when available. Objectives, builds and unobserved events are unavailable. Held with the last reading when stale."><div className="win-caption"><span className={ours===2?'win-orange':'win-blue'}>{complete?chance+'%':'—'}</span><span className={theirs===2?'win-orange':'win-blue'}>{complete?(100-chance)+'%':'—'}</span></div><div className="win-track" role="img" aria-label={complete?'Estimated win chance: your team '+chance+'%, enemy '+(100-chance)+'%':'Win estimate requires both complete teams and your team identity'}><span className={ours===2?'patron-orange':'patron-blue'} style={{width:chance+'%'}}/><span className={theirs===2?'patron-orange':'patron-blue'} style={{width:(100-chance)+'%'}}/></div></div>
 {!m.players.length ? <div className="match-empty"><Activity size={28}/><h2>{m.status === 'disabled' ? 'Connect to your match' : 'Waiting for a live roster'}</h2><button onClick={openSettings}>Open settings</button></div> : <div className="match-teams">{[{ players: a, side: ours, title: m.localTeam ? 'YOUR TEAM' : 'HIDDEN KING' }, { players: b, side: theirs, title: m.localTeam ? 'ENEMY TEAM' : 'ARCH MOTHER' }].map(t => <section className="match-team" key={t.side}><div className="match-team-heading"><h2>{t.title}</h2><span title="Players ranked by combat efficiency, economy, levels and hero damage">{format(sum(t.players, 'netWorth'))} souls <small className={t.players.length < 6 ? 'partial' : ''}>{t.players.length}/6</small></span></div><div className="match-cards">{t.players.map((metric, i) => <PlayerCard key={metric.key} metric={metric} rank={i + 1} clock={m.clock} party={!!metric.player.partyId && m.players.filter(x => x.player.team === metric.player.team && x.player.partyId === metric.player.partyId).length > 1}/>)}{Array.from({ length: Math.max(0, 6 - t.players.length) }, (_, i) => <div className="match-player match-seat" key={'empty' + i}><Users size={15}/><span>Waiting for player</span></div>)}</div></section>)}</div>}
 </div>;
}
