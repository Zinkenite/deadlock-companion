import { create } from 'zustand';
import type { GameReaderSnapshot, MatchPlayer } from './gameReader';
export type Badge = {
    id: string;
    label: string;
    detail: string;
    reason?: string;
    tone: 'gold' | 'good' | 'danger' | 'neutral' | 'fire' | 'epic' | 'violet' | 'teal' | 'blue';
    priority: number;
    since: number;
};
export type PlayerMetrics = {
    player: MatchPlayer;
    key: string;
    badges: Badge[];
    spm: number | null;
    recentDpm?: number|null;
    share: number;
    laneDelta: number | null;
};
export type MatchAnalysis = {
    players: PlayerMetrics[];
    clock: number | null;
    paused: boolean;
    status: 'waiting' | 'disabled' | 'live' | 'paused' | 'stale' | 'ended';
    matchId: number | null;
    localTeam: number | null;
    lateJoin: boolean;
};
const empty = (): MatchAnalysis => ({ players: [], clock: null, paused: false, status: 'disabled', matchId: null, localTeam: null, lateJoin: false });
export const useMatchAnalysis = create<MatchAnalysis>(empty);
export const playerKey = (p: MatchPlayer) => p.team + ':' + p.slot;
type Event = {
    time: number;
    k: number;
    d: number;
    a: number;
};
type State = {
    damage: {time:number;value:number}[];
    last: MatchPlayer;
    events: Event[];
    souls: {
        time: number;
        value: number;
    }[];
    kills: number;
    deaths: number;
    starvedAt: number | null;
    starvedWorth: number;
    comebackUntil: number;
    badges: Map<string, Badge>;
};
/** Runs once per new roster, not per render. At most 12 histories and five minutes retained. */
export class MatchEngine {
    private state = new Map<string, State>();
    private result = empty();
    private lastAt = 0;
    private lastClock: number | null = null;
    private firstArmed = false;
    private firstResolved = false;
    private firstKill: string | null = null;
    private firstDeath: string | null = null;
    private thresholds = new Set<string>();
    private spikes = new Map<string, number>();
    private lastLocal: number | null = null;
    reset() { this.state.clear(); this.result = empty(); this.lastAt = 0; this.lastClock = null; this.firstArmed = false; this.firstResolved = false; this.firstKill = null; this.firstDeath = null; this.thresholds.clear(); this.spikes.clear(); this.lastLocal = null; }
    update(s: GameReaderSnapshot): MatchAnalysis {
        const clock = s.timer, local = s.players?.find(p => p.isUs)?.accountId ?? null;
        if (s.inMatch === true && ((s.matchId !== null && this.result.matchId !== null && s.matchId !== this.result.matchId) || (clock !== null && this.lastClock !== null && clock < this.lastClock - 15) || (local !== null && this.lastLocal !== null && local !== this.lastLocal) || (this.result.status === 'ended' && clock !== null && this.lastClock !== null && clock < this.lastClock)))
            this.reset();
        if (local !== null)
            this.lastLocal = local;
        const status: MatchAnalysis['status'] = !s.enabled ? 'disabled' : s.inMatch === false && this.result.players.length ? 'ended' : s.inMatch !== true ? 'waiting' : clock === null || !s.players?.length ? 'stale' : s.paused ? 'paused' : 'live';
        const matchId = s.inMatch === true ? s.matchId ?? this.result.matchId : this.result.matchId;
        if (this.result.status !== status || this.result.paused !== s.paused || this.result.matchId !== matchId)
            this.result = { ...this.result, status, paused: s.paused, matchId };
        if (!s.enabled || s.inMatch !== true || clock === null || !s.players?.length || s.playersAt <= this.lastAt)
            return this.result;
        const players = s.players.filter(p => (p.team === 2 || p.team === 3) && [p.netWorth, p.level, p.kills, p.deaths, p.assists].every(n => Number.isFinite(n) && n >= 0)).slice(0, 12);
        if (!players.length)
            return this.result;
        const continuous = this.lastClock !== null && clock - this.lastClock <= 10 && s.playersAt - this.lastAt <= 10000;
        const totalKills = players.reduce((n, p) => n + p.kills, 0), complete = players.length === 12 && [2, 3].every(team => players.filter(p => p.team === team).length === 6);
        if (!this.state.size) {
            this.result.lateJoin = totalKills > 0 || clock > 15;
            this.firstArmed = complete && totalKills === 0;
        }
        const changes = players.map(p => { const prev = this.state.get(playerKey(p))?.last; return { p, key: playerKey(p), k: prev ? Math.max(0, p.kills - prev.kills) : 0, d: prev ? Math.max(0, p.deaths - prev.deaths) : 0, a: prev ? Math.max(0, p.assists - prev.assists) : 0 }; });
        if (this.firstArmed && !this.firstResolved && totalKills > 0) {
            this.firstResolved = true;
            const killers = changes.filter(c => c.k === 1), victims = changes.filter(c => c.d === 1);
            if (complete && continuous && totalKills === 1 && players.reduce((n, p) => n + p.deaths, 0) === 1 && killers.length === 1 && victims.length === 1 && killers[0].p.team !== victims[0].p.team) {
                this.firstKill = killers[0].key;
                this.firstDeath = victims[0].key;
            }
        }
        if (!complete || (!continuous && this.lastClock !== null))
            this.firstArmed = false;
        const worth = players.reduce((n, p) => n + p.netWorth, 0) / players.length, level = players.reduce((n, p) => n + p.level, 0) / players.length, maxWorth = Math.max(...players.map(p => p.netWorth));
        for (const c of changes) {
            let h = this.state.get(c.key);
            const identityChanged = h && (h.last.accountId !== c.p.accountId || h.last.heroId !== c.p.heroId), resetCounters = h && (c.p.kills < h.last.kills || c.p.deaths < h.last.deaths || c.p.assists < h.last.assists);
            if (identityChanged) {
                if (this.firstKill === c.key)
                    this.firstKill = null;
                if (this.firstDeath === c.key)
                    this.firstDeath = null;
                this.spikes.delete(c.key);
            }
            if (!h || identityChanged || resetCounters) {
                h = { last: c.p, damage: [], events: [], souls: [], kills: 0, deaths: 0, starvedAt: null, starvedWorth: 0, comebackUntil: 0, badges: new Map() };
                this.state.set(c.key, h);
            }
            else if (continuous) {
                if (c.k || c.d || c.a)
                    h.events.push({ time: clock, k: c.k, d: c.d, a: c.a });
                if (c.d)
                    h.kills = 0;
                else
                    h.kills += c.k;
                if (c.k)
                    h.deaths = 0;
                else
                    h.deaths += c.d;
            }
            else {
                h.damage = [];
                h.events = [];
                h.souls = [];
                h.kills = 0;
                h.deaths = 0;
                h.starvedAt = null;
                h.comebackUntil = 0;
            }
            h.events = h.events.filter(e => e.time > clock - 300).slice(-360);
            h.souls = h.souls.filter(e => e.time >= clock - 300).slice(-61);
            if (!h.souls.length || clock - h.souls[h.souls.length - 1].time >= 5)
                h.souls.push({ time: clock, value: c.p.netWorth });
            // A late-join baseline records crossed thresholds without claiming a first.
            for (const threshold of [10, 20]) {
                for (const side of [0, c.p.team]) {
                    const token = side + ':' + threshold;
                    if (c.p.level >= threshold && !this.thresholds.has(token)) {
                        this.thresholds.add(token);
                        if (continuous && h.last.level < threshold)
                            this.spikes.set(c.key, clock + 45);
                    }
                }
            }
            const observedDamage=heroDamage(c.p);
            if(observedDamage===null)h.damage=[];
            else{if(h.damage.length&&observedDamage<h.damage[h.damage.length-1].value)h.damage=[];h.damage=h.damage.filter(x=>x.time>=clock-300).slice(-61);if(!h.damage.length||clock-h.damage[h.damage.length-1].time>=5)h.damage.push({time:clock,value:observedDamage});}
            h.last = c.p;
        }
        const teamRecent = new Map<number, number>();
        for (const p of players) {
            const sum = this.state.get(playerKey(p))!.events.reduce((n, e) => n + e.k, 0);
            teamRecent.set(p.team, (teamRecent.get(p.team) ?? 0) + sum);
        }
        const pace = (state: State) => { const sample = state.souls[0]; return sample && clock - sample.time >= 60 ? Math.max(0, state.last.netWorth - sample.value) / ((clock - sample.time) / 60) : null; };
        const rates = players.map(x => pace(this.state.get(playerKey(x))!));
        const observedRates = rates.filter((x): x is number => x !== null);
        const averageRate = observedRates.reduce((n, x) => n + x, 0) / Math.max(1, observedRates.length);
        const recentDamage=(player:MatchPlayer)=>{const history=this.state.get(playerKey(player))!.damage,first=history[0],damage=heroDamage(player);return first&&damage!==null&&clock-first.time>=60?{gain:Math.max(0,damage-first.value),seconds:clock-first.time,dpm:Math.max(0,damage-first.value)*60/(clock-first.time)}:null;};
        const allDamage=players.every(p=>heroDamage(p)!==null),damageAverage=players.reduce((n,p)=>n+(heroDamage(p)??0),0)/players.length,maxDamage=Math.max(...players.map(p=>heroDamage(p)??0));
        const recentDamageSamples=players.map(recentDamage),allRecent=recentDamageSamples.every(x=>x!==null),recentDamageAverage=recentDamageSamples.reduce((n,x)=>n+(x?.dpm??0),0)/players.length;
        const efficiencyAverage=players.reduce((n,p)=>n+(heroDamage(p)??0)/Math.max(1,p.netWorth)*1000,0)/players.length;
        const metrics = players.map(p => {
            const key = playerKey(p), h = this.state.get(key)!, team = players.filter(x => x.team === p.team), opponents = players.filter(x => x.team !== p.team && p.lane !== null && x.lane === p.lane), peers = players.filter(x => p.lane !== null && x.lane === p.lane), baseline = (peers.length >= 2 ? peers : players).reduce((n, x) => n + x.netWorth, 0) / (peers.length >= 2 ? peers.length : players.length), teamWorth = team.reduce((n, x) => n + x.netWorth, 0), recent = h.events.reduce((n, e) => n + e.k, 0), participation = h.events.reduce((n, e) => n + e.k + e.a, 0), recentTeam = teamRecent.get(p.team) ?? 0;
            const damage=heroDamage(p),damageWindow=recentDamage(p),teamDamageKnown=team.length===6&&team.every(x=>heroDamage(x)!==null),teamDamage=team.reduce((n,x)=>n+(heroDamage(x)??0),0),damageEfficiency=damage===null?0:damage/Math.max(1,p.netWorth)*1000;
            const active: Badge[] = [];
            const add = (id: string, label: string, detail: string, priority: number, tone: Badge['tone']) => active.push({ ...h.badges.get(id), id, label, detail, priority, tone, since: h.badges.get(id)?.since ?? clock });
            if (clock >= 300 && players.length === 12 && allDamage && damage !== null && damageAverage >= 5000 && damage < damageAverage * (h.badges.has('low-damage') ? .5 : .4))
                add('low-damage', 'PEA SHOOTER', 'Hero damage below 40% of the full lobby average after 5 minutes; clears at 50%. Requires all 12 damage readings and at least 5,000 average damage.', 97, 'danger');
            if (key === this.firstKill)
                add('first-blood', 'FIRST BLOOD', 'Observed first kill of the match.', clock < 600 ? 90 : 35, 'gold');
            if (key === this.firstDeath)
                add('first-death', 'FIRST TO DROP', 'Observed first death of the match.', clock < 600 ? 85 : 30, 'neutral');
            if (h.kills >= 6)
                add('unstoppable', 'UNSTOPPABLE', '6 or more observed kills without dying. Replaces On Fire.', 120, 'epic');
            else if (h.kills >= 3 || recent >= 5)
                add('on-fire', 'ON FIRE', '3 observed kills without dying, or 5 kills in the last 5 minutes.', 105, 'fire');
            if (recentTeam >= 4 && participation >= 4 && participation / recentTeam > .75)
                add('dominating', 'DOMINATING', 'Over 75% participation in observed team kills over 5 minutes; at least 4 team kills and 4 contributions.', 100, 'violet');
            const four = h.events.filter(e => e.time > clock - 240), lastContribution = Math.max(-Infinity, ...four.filter(e => e.k || e.a).map(e => e.time));
            if (p.deaths >= 20 || (p.deaths >= 8 && p.deaths > (p.kills + p.assists) * 1.5) || four.filter(e => e.time > lastContribution).reduce((n, e) => n + e.d, 0) >= 3)
                add('feeding', 'FEEDING', '20+ total deaths, or 8+ deaths exceeding kills and assists combined by 50%, or 3 observed deaths in 4 minutes since the last contribution.', 95, 'danger');
            if (h.deaths >= 4)
                add('death-streak', 'ENEMY ATM', '4 consecutive observed deaths without a kill.', 94, 'danger');
            if (p.assists >= Math.max(4, clock / 60 * .6) && (p.kills + p.assists) / Math.max(1, team.reduce((n, x) => n + x.kills, 0)) >= .5)
                add('playmaker', 'PLAYMAKER', 'At least 4 assists, 0.6 assists per match minute, and participation in at least half of team kills.', 68, 'teal');
            if (clock >= 60 && players.length >= 10 && p.netWorth >= worth * 1.05 && p.netWorth === maxWorth)
                add('soul-leader', 'SOUL LEADER', 'Highest net worth in the observed lobby, at least 5% above average. Requires 10 observed players and 1 minute elapsed.', 55, 'gold');
            const rate = pace(h);
            if (clock >= 120 && observedRates.length === players.length && averageRate > 0 && rate !== null && rate > averageRate * (h.badges.has('hyper-farming') ? 1.15 : 1.25))
                add('hyper-farming', 'FARM MACHINE', 'Soul gain per minute over the observed last 1–5 minutes is over 25% above lobby average (held until below +15%). Requires at least 60 seconds of history for every observed player.', 65, 'good');
            const starved = clock >= 120 && baseline > 0 && p.netWorth < baseline * (h.badges.has('starved') ? .8 : .75);
            if (starved) {
                if (h.starvedAt === null) {
                    h.starvedAt = clock;
                    h.starvedWorth = p.netWorth;
                }
                h.comebackUntil = 0;
                add('starved', 'BROKE', peers.length >= 2 ? 'Net worth fell over 25% below assigned-lane average; clears after recovering to 80%.' : 'Net worth fell over 25% below lobby average; clears at 80%. Lane unavailable.', 96, 'danger');
            }
            else if (h.starvedAt !== null) {
                const sample = h.souls[0], gain = p.netWorth - (sample?.value ?? h.starvedWorth);
                if (clock - h.starvedAt <= 300 && sample && clock - sample.time >= 180 && p.netWorth >= baseline * .9 && gain >= Math.max(1500, baseline * .2)) {
                    h.comebackUntil = clock + 60;
                    h.starvedAt = null;
                }
                else if (clock - h.starvedAt > 300)
                    h.starvedAt = null;
            }
            if (h.comebackUntil > clock)
                add('comeback', 'COMEBACK', 'Recovered to 90% of peer average with a significant gain over 3–5 minutes.', 108, 'teal');
            if ((this.spikes.get(key) ?? 0) > clock)
                add('power-spike', 'POWER SPIKE', 'First observed on a side to reach level 10 or 20; shown for 45 match seconds.', 92, 'violet');
            const comparison = opponents.length ? opponents : team.filter(x => playerKey(x) !== key), compLevel = comparison.reduce((n, x) => n + x.level, 0) / Math.max(1, comparison.length);
            if (comparison.length && p.level >= compLevel + (h.badges.has('level-advantage') ? 1.5 : 2))
                add('level-advantage', 'LEVEL LEAD', opponents.length ? 'At least 2 levels ahead of opposing lane average.' : 'At least 2 levels ahead of teammates average.', 70, 'blue');
            if (p.level <= level - 2)
                add('underleveled', 'DEAD WEIGHT', 'At least 2 levels below lobby average.', 75, 'danger');
            if (h.kills >= 3 && worth > 0 && p.netWorth >= worth * 1.2)
                add('bounty-target', 'BOUNTY TARGET', 'Observed 3+ kill streak and net worth at least 20% above lobby average. Heuristic, not a game bounty value.', 88, 'fire');
            if (team.length >= 5 && teamWorth > 0 && p.netWorth / teamWorth > .3)
                add('breadwinner', 'SOLO PROVIDER', 'More than 30% of team net worth.', 72, 'gold');
            if(clock>=120&&damage!==null){
                if(allDamage&&players.length>=10&&damage>=5000&&damage===maxDamage&&damage>=damageAverage*1.25)add('damage-leader','DAMAGE LEADER','Highest observed lobby hero damage, at least 5,000 total and 25% above lobby average. Requires 2 match minutes and damage readings for the lobby.',79,'gold');
                if(allRecent&&players.length===12&&damageWindow&&damageWindow.dpm>=800&&damageWindow.dpm>recentDamageAverage*(h.badges.has('heavy-hitter')?1.2:1.35))add('heavy-hitter','HEAVY HITTER','Recent hero damage per minute over 1–5 minutes exceeds 800 and is over 35% above lobby average; held until below +20%. Requires 60 seconds of continuous history for every player.',103,'fire');
                if(teamDamageKnown&&teamDamage>=10000&&damage>=4000&&damage/teamDamage>(h.badges.has('damage-carry')?.28:.30))add('damage-carry','DAMAGE CARRY','Over 30% of team hero damage, at least 4,000 personal and 10,000 team damage. Held until below 28% team share.',87,'violet');
                if(allDamage&&players.length===12&&damage>=5000&&p.netWorth>=3000&&damageEfficiency>efficiencyAverage*(h.badges.has('damage-efficient')?1.15:1.3))add('damage-efficient','HITS LIKE A TRUCK','Hero damage per 1,000 net worth is over 30% above lobby average. Requires 5,000 damage and 3,000 net worth; held until below +15%.',67,'teal');
            }
            const fmt=(n:number)=>Math.round(n).toLocaleString('en-US');
            const pct=(n:number)=>n.toFixed(1)+'%';
            const duration=(n:number)=>Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');
            const oldest=h.souls[0],elapsed=oldest?clock-oldest.time:0,gain=oldest?Math.max(0,p.netWorth-oldest.value):0;
            const teamKills=team.reduce((n,x)=>n+x.kills,0);
            const reasons:Record<string,string>={
                'first-blood':'First kill observed at '+duration(h.badges.get('first-blood')?.since??clock)+'. Current total: '+p.kills+' kills.',
                'first-death':'First death observed at '+duration(h.badges.get('first-death')?.since??clock)+'. Current total: '+p.deaths+' deaths.',
                'unstoppable':h.kills+' observed kills without dying.',
                'on-fire':h.kills+' observed kills without dying; '+recent+' kills in the observed last 5 minutes.',
                'dominating':participation+' kills + assists across '+recentTeam+' observed team kills in the last 5 minutes ('+pct(participation/Math.max(1,recentTeam)*100)+').',
                'feeding':four.filter(e=>e.time>lastContribution).reduce((n,e)=>n+e.d,0)+' deaths in the last 4 minutes since the last observed kill or assist.',
                'death-streak':h.deaths+' consecutive observed deaths without a kill.',
                'playmaker':p.assists+' assists ('+(clock?p.assists/(clock/60):0).toFixed(2)+'/min); '+pct((p.kills+p.assists)/Math.max(1,teamKills)*100)+' team kill participation.',
                'soul-leader':fmt(p.netWorth)+' net worth; lobby average '+fmt(worth)+' ('+pct((p.netWorth/Math.max(1,worth)-1)*100)+' ahead). '+players.length+' players observed.',
                'hyper-farming':fmt(gain)+' net worth gained over '+duration(elapsed)+' — '+fmt(rate??0)+'/min versus lobby '+fmt(averageRate)+'/min ('+pct(((rate??0)/Math.max(1,averageRate)-1)*100)+' ahead).',
                'starved':fmt(p.netWorth)+' net worth versus '+fmt(baseline)+' '+(peers.length>=2?'lane':'lobby')+' average ('+pct(p.netWorth/Math.max(1,baseline)*100)+' of average).',
                'comeback':'Current net worth '+fmt(p.netWorth)+' ('+pct(p.netWorth/Math.max(1,baseline)*100)+' of peer average). Observed gain '+fmt(gain)+' over '+duration(elapsed)+'. Tag holds for '+Math.max(0,Math.ceil(h.comebackUntil-clock))+' more match seconds.',
                'power-spike':'First observed level '+(p.level>=20?20:10)+' threshold on the side. Current level '+p.level+'; '+Math.max(0,Math.ceil((this.spikes.get(key)??clock)-clock))+' seconds remaining.',
                'level-advantage':'Level '+p.level+' versus '+compLevel.toFixed(1)+' '+(opponents.length?'opposing lane':'teammate')+' average (+'+(p.level-compLevel).toFixed(1)+'). Held until below +1.5 levels.',
                'underleveled':'Level '+p.level+' versus '+level.toFixed(1)+' lobby average ('+(level-p.level).toFixed(1)+' behind).',
                'bounty-target':h.kills+' observed kills without dying; '+fmt(p.netWorth)+' net worth versus '+fmt(worth)+' lobby average ('+pct((p.netWorth/Math.max(1,worth)-1)*100)+' ahead).',
                'breadwinner':fmt(p.netWorth)+' of '+fmt(teamWorth)+' observed team net worth ('+pct(p.netWorth/Math.max(1,teamWorth)*100)+').'
            };
            reasons['damage-leader']=fmt(damage??0)+' total hero damage ('+fmt(clock?(damage??0)*60/clock:0)+' DPM); lobby average '+fmt(damageAverage)+'.';
            reasons['heavy-hitter']=fmt(damageWindow?.gain??0)+' hero damage over '+duration(damageWindow?.seconds??0)+' — '+fmt(damageWindow?.dpm??0)+' DPM versus '+fmt(recentDamageAverage)+' lobby recent DPM.';
            reasons['damage-carry']=fmt(damage??0)+' of '+fmt(teamDamage)+' team hero damage ('+pct((damage??0)/Math.max(1,teamDamage)*100)+').';
            reasons['damage-efficient']=fmt(damageEfficiency)+' hero damage per 1,000 net worth versus '+fmt(efficiencyAverage)+' lobby average; '+fmt(damage??0)+' damage / '+fmt(p.netWorth)+' souls.';
            for(const badge of active)badge.reason=reasons[badge.id];
            active.sort((a, b) => b.priority - a.priority || b.since - a.since || a.id.localeCompare(b.id));
            h.badges = new Map(active.map(b => [b.id, b]));
            return { player: p, key, badges: active, recentDpm:damageWindow?.dpm??null, spm: clock >= 1 ? p.netWorth / (clock / 60) : null, share: teamWorth ? p.netWorth / teamWorth * 100 : 0, laneDelta: opponents.length ? p.netWorth - opponents.reduce((n, x) => n + x.netWorth, 0) / opponents.length : null };
        });
        // Missing seats never accumulate unbounded history.
        for (const key of this.state.keys())
            if (!players.some(p => playerKey(p) === key))
                this.state.delete(key);
        this.lastAt = s.playersAt;
        this.lastClock = clock;
        this.result = { ...this.result, players: metrics, clock, localTeam: players.find(p => p.isUs)?.team ?? this.result.localTeam };
        return this.result;
    }
}
export const matchEngine = new MatchEngine();
/** Damage is optional; missing readings retain the original ranking weights. */
export function heroDamage(p:MatchPlayer):number|null{return typeof p.heroDamage==='number'&&Number.isFinite(p.heroDamage)&&p.heroDamage>=0&&p.heroDamage<=5000000?p.heroDamage:null;}
export function rankTeam(players: PlayerMetrics[]): PlayerMetrics[] {
    const count = Math.max(1, players.length);
    const impact = (p: MatchPlayer) => (p.kills + p.assists * .65) / (p.deaths + 1);
    const averageImpact = players.reduce((n, x) => n + impact(x.player), 0) / count;
    const averageWorth = players.reduce((n, x) => n + x.player.netWorth, 0) / count;
    const averageLevel = players.reduce((n, x) => n + x.player.level, 0) / count;
    const damageReady=players.length===6&&players.every(x=>heroDamage(x.player)!==null)&&players.some(x=>(heroDamage(x.player)??0)>0),averageDamage=players.reduce((n,x)=>n+(heroDamage(x.player)??0),0)/count;
    const scores = new Map(players.map(x => [x.key, Math.round(10 * ((damageReady?35:45) * Math.min(2.5, (impact(x.player) + 1) / (averageImpact + 1)) + (damageReady?35:40) * Math.min(2.5, averageWorth ? x.player.netWorth / averageWorth : 1) + 15 * (averageLevel ? x.player.level / averageLevel : 1)+(damageReady?15*Math.min(2,averageDamage?(heroDamage(x.player)??0)/averageDamage:1):0))) / 10]));
    return [...players].sort((a, b) => scores.get(b.key)! - scores.get(a.key)! || b.player.netWorth - a.player.netWorth || b.player.kills - a.player.kills || a.player.slot - b.player.slot);
}

export function estimateWinChance(a:PlayerMetrics[],b:PlayerMetrics[],clock:number|null):number{
 const relative=(get:(x:PlayerMetrics)=>number)=>{const x=a.reduce((n,p)=>n+get(p),0),y=b.reduce((n,p)=>n+get(p),0);return(x-y)/Math.max(1,x+y);};
 const momentum=(ps:PlayerMetrics[])=>ps.reduce((n,x)=>n+x.badges.reduce((v,t)=>v+(({'unstoppable':3,'on-fire':2,'dominating':2,'comeback':1,'starved':-1,'death-streak':-2}as Record<string,number>)[t.id]??0),0),0);
 let advantage=relative(x=>x.player.netWorth)*3.2+relative(x=>x.player.level)*1.1+relative(x=>x.player.kills)*.65+relative(x=>x.player.assists)*.2+(momentum(a)-momentum(b))*.025;
 const all=[...a,...b],ready=a.length===6&&b.length===6&&(clock??0)>=120;
 if(ready&&all.every(x=>heroDamage(x.player)!==null))advantage+=relative(x=>heroDamage(x.player)??0)*.4;
 if(ready&&all.every(x=>typeof x.recentDpm==='number'&&Number.isFinite(x.recentDpm)&&x.recentDpm>=0))advantage+=relative(x=>x.recentDpm??0)*.3;
 return Math.round(Math.max(5,Math.min(95,100/(1+Math.exp(-advantage)))));
}

export function resetMatchAnalysis(){matchEngine.reset();useMatchAnalysis.setState(empty(),true);}
