import { describe, it, expect } from 'vitest';
import { MatchEngine, rankTeam, estimateWinChance } from '../src/matchAnalytics';
import { initialReaderSnapshot, type GameReaderSnapshot, type MatchPlayer } from '../src/gameReader';
function roster(): MatchPlayer[] { return Array.from({ length: 12 }, (_, i) => ({ accountId: i + 1, name: 'Player ' + i, team: i < 6 ? 2 : 3, slot: i, heroId: i + 1, level: 1, netWorth: 1000, kills: 0, deaths: 0, assists: 0, lane: [1, 1, 4, 4, 6, 6][i % 6], isUs: i === 0 })); }
function feed(engine: MatchEngine, players: MatchPlayer[], clock: number, extra: Partial<GameReaderSnapshot> = {}) { return engine.update({ ...initialReaderSnapshot, enabled: true, attached: true, inMatch: true, status: 'live', timer: clock, timerAt: 100000 + clock * 1000, playersAt: 100000 + clock * 1000, matchId: 1, players: structuredClone(players), ...extra }); }
const tags = (m: ReturnType<MatchEngine['update']>, index = 0) => m.players.find(x => x.player.slot === index)!.badges.map(b => b.id);
describe('live match analytics', () => {
    it('observes an unambiguous first kill and death, never inferring late-join firsts', () => { const e = new MatchEngine(), p = roster(); feed(e, p, 0); p[0].kills = 1; p[6].deaths = 1; let m = feed(e, p, 1); expect(tags(m)).toContain('first-blood'); expect(tags(m, 6)).toContain('first-death'); expect(tags(feed(new MatchEngine(), p, 100))).not.toContain('first-blood'); });
    it('does not invent firsts for batched kills, missing victims or partial baselines', () => {
        for (const mode of ['batch', 'victim', 'partial']) {
            const e = new MatchEngine(), p = roster();
            feed(e, mode === 'partial' ? p.slice(0, 11) : p, 0);
            p[0].kills = mode === 'batch' ? 2 : 1;
            if (mode !== 'victim')
                p[6].deaths = 1;
            expect(tags(feed(e, p, 1))).not.toContain('first-blood');
        }
    });
    it('never assigns first death when a prior death was already present', () => { const e = new MatchEngine(), p = roster(); p[7].deaths = 1; feed(e, p, 0); p[0].kills = 1; p[6].deaths = 1; expect(tags(feed(e, p, 1), 6)).not.toContain('first-death'); });
    it('uses On Fire for streaks and Dominating for sustained team participation', () => {
        const e = new MatchEngine(), p = roster();
        feed(e, p, 0);
        for (let t = 1; t <= 4; t++) {
            p[0].kills++;
            feed(e, p, t);
        }
        expect(tags(feed(e, p, 5))).toEqual(expect.arrayContaining(['on-fire', 'dominating']));
        p[0].deaths++;
        expect(tags(feed(e, p, 6))).not.toContain('on-fire');
        for (let t = 7; t <= 310; t++)
            feed(e, p, t);
        expect(tags(feed(e, p, 311))).not.toContain('dominating');
    });
    it('promotes a six-kill streak to Unstoppable without duplicate On Fire', () => {
        const e = new MatchEngine(), p = roster();
        feed(e, p, 0);
        for (let t = 1; t <= 6; t++) {
            p[0].kills++;
            feed(e, p, t);
        }
        const m = feed(e, p, 7);
        expect(tags(m)[0]).toBe('unstoppable');
        expect(tags(m)).not.toContain('on-fire');
    });
    it('ranks strong combat/economy first, credits assists, and keeps ties deterministic', () => {
        const e = new MatchEngine(), p = roster();
        p[4].kills = 8;
        p[4].netWorth = 15000;
        p[4].level = 15;
        p[2].assists = 12;
        p[2].deaths = 1;
        p[1].deaths = 8;
        const m = feed(e, p, 600), team = m.players.filter(x => x.player.team === 2), ranked = rankTeam(team);
        expect(ranked[0].player.slot).toBe(4);
        expect(ranked.findIndex(x => x.player.slot === 2)).toBeLessThan(ranked.findIndex(x => x.player.slot === 1));
        expect(team[0].player.slot).toBe(0);
        expect(rankTeam(feed(new MatchEngine(), roster(), 0).players.filter(x => x.player.team === 2)).map(x => x.player.slot)).toEqual([0, 1, 2, 3, 4, 5]);
    });
    it('uses recent soul gain for Fast Farmer, never assigning it just for starting rich', () => {
        const e = new MatchEngine(), p = roster();
        p[0].netWorth = 50000;
        expect(tags(feed(e, p, 120))).not.toContain('hyper-farming');
        for (let t = 121; t <= 181; t++) {
            p.forEach((x, i) => x.netWorth += i === 1 ? 50 : 10);
            feed(e, p, t);
        }
        expect(tags(feed(e, p, 182), 1)).toContain('hyper-farming');
        expect(tags(feed(e, p, 183))).not.toContain('hyper-farming');
    });
    it('detects feeding and death streaks, with kill/assist contribution breaking feeding', () => {
        const e = new MatchEngine(), p = roster();
        feed(e, p, 0);
        for (let t = 1; t <= 4; t++) {
            p[0].deaths++;
            feed(e, p, t);
        }
        expect(tags(feed(e, p, 5))).toEqual(expect.arrayContaining(['feeding', 'death-streak']));
        p[0].assists++;
        expect(tags(feed(e, p, 6))).not.toContain('feeding');
        expect(tags(feed(e, p, 7))).toContain('death-streak');
        p[0].kills++;
        expect(tags(feed(e, p, 8))).not.toContain('death-streak');
    });
    it('calculates economy, level and lane metrics, and prioritizes severe badges', () => {
        const e = new MatchEngine(), p = roster();
        feed(e, p, 120);
        p[0].netWorth = 10000;
        p[0].level = 10;
        p[0].assists = 5;
        for (let t = 121; t <= 123; t++) {
            p[0].kills++;
            feed(e, p, t);
        }
        const m = feed(e, p, 124), x = m.players[0];
        expect(tags(m)).toEqual(expect.arrayContaining(['soul-leader', 'level-advantage', 'breadwinner', 'power-spike']));
        expect(tags(m)).not.toContain('playmaker');expect(tags(m)).not.toContain('bounty-target');
        expect(x.badges[0].id).toBe('on-fire');
        expect(x.spm).toBeCloseTo(10000 / (124 / 60));
        expect(x.laneDelta).toBe(9000);
        expect(x.share).toBeCloseTo(10000 / 15000 * 100);
        p[1].netWorth = 0;
        p[1].level = 1;
        expect(tags(feed(e, p, 125), 1)).toContain('starved');
    });
    it('recognizes a recovery after a 3–5 minute economy history', () => {
        const e = new MatchEngine(), p = roster();
        p.forEach(x => x.netWorth = 10000);
        p[0].netWorth = 5000;
        feed(e, p, 120);
        for (let t = 121; t <= 301; t++)
            feed(e, p, t);
        p[0].netWorth = 11000;
        const m = feed(e, p, 302);
        expect(tags(m)).toContain('comeback');
        expect(tags(m)).not.toContain('starved');
    });
    it('holds paused and stale data and ignores duplicate roster timestamps', () => { const e = new MatchEngine(), p = roster(); const m = feed(e, p, 60); p[0].kills = 9; expect(feed(e, p, 60, { paused: true }).players).toBe(m.players); const stale = feed(e, [], 61, { timer: null }); expect(stale.status).toBe('stale'); expect(stale.clock).toBe(60); expect(stale.players).toBe(m.players); });
    it('resets for new IDs or clock rollbacks and retains ended summaries', () => { const e = new MatchEngine(), p = roster(); feed(e, p, 0); p[0].kills = 1; p[6].deaths = 1; feed(e, p, 1); expect(feed(e, [], 2, { inMatch: false }).status).toBe('ended'); const fresh = feed(e, roster(), 0, { matchId: 2 }); expect(tags(fresh)).not.toContain('first-blood'); feed(e, p, 90); expect(tags(feed(e, roster(), 0, { matchId: 2 }))).not.toContain('first-blood'); });
    it('does not infer streaks across missing data or counter resets', () => { const e = new MatchEngine(), p = roster(); feed(e, p, 0); p[0].kills = 3; expect(tags(feed(e, p, 30))).not.toContain('dominating'); p[0].kills = 0; expect(tags(feed(e, p, 31))).not.toContain('dominating'); });
    it('runs a full match stream with bounded histories', () => {
        const e = new MatchEngine(), p = roster(), start = performance.now();
        for (let t = 0; t < 7200; t++) {
            p.forEach((x, i) => x.netWorth = 1000 + t * (i + 1));
            feed(e, p, t);
        }
        const histories = (e as unknown as {
            state: Map<string, {
                events: unknown[];
                souls: unknown[];
            }>;
        }).state;
        expect(histories.size).toBe(12);
        for (const h of histories.values()) {
            expect(h.events.length).toBeLessThanOrEqual(360);
            expect(h.souls.length).toBeLessThanOrEqual(62);
        }
        console.log('Match engine: 7,200 updates / 12 players in ' + (performance.now() - start).toFixed(0) + ' ms');
    });
});

it('calculates damage tags and measured damage-window evidence',()=>{const e=new MatchEngine(),p=roster();p.forEach(x=>{x.heroDamage=1000;x.netWorth=3000;});p[0].heroDamage=10000;feed(e,p,120);for(let t=121;t<=181;t++){p.forEach((x,i)=>x.heroDamage!+=i===0?50:10);feed(e,p,t);}const m=feed(e,p,182);expect(tags(m)).toEqual(expect.arrayContaining(['damage-leader','heavy-hitter','damage-carry','damage-efficient']));expect(m.players[0].recentDpm).toBeGreaterThan(2900);expect(m.players[0].badges.find(b=>b.id==='heavy-hitter')?.reason).toMatch(/hero damage over 1:02/);});
it('clears recent damage on missing readings and counter rollback',()=>{const e=new MatchEngine(),p=roster();p.forEach(x=>x.heroDamage=1000);feed(e,p,120);for(let t=121;t<=181;t++){p.forEach(x=>x.heroDamage!+=10);feed(e,p,t);}expect(feed(e,p,182).players[0].recentDpm).not.toBeNull();p[0].heroDamage=null;expect(feed(e,p,183).players[0].recentDpm).toBeNull();p[0].heroDamage=500;expect(feed(e,p,184).players[0].recentDpm).toBeNull();for(let t=185;t<=245;t++){p[0].heroDamage!+=10;feed(e,p,t);}p[0].heroDamage=0;expect(feed(e,p,246).players[0].recentDpm).toBeNull();});
it('uses damage for rank and win estimate but omits incomplete damage comparisons',()=>{const e=new MatchEngine(),p=roster();p.forEach(x=>x.heroDamage=1000);p[5].heroDamage=10000;const m=feed(e,p,600),a=m.players.filter(x=>x.player.team===2),b=m.players.filter(x=>x.player.team===3);expect(rankTeam(a)[0].player.slot).toBe(5);expect(estimateWinChance(a,b,600)).toBeGreaterThan(50);expect(estimateWinChance(a,b,60)).toBe(50);a[0].player.heroDamage=null;expect(estimateWinChance(a,b,600)).toBe(50);expect(estimateWinChance(b,a,600)).toBe(50);});


describe('reader snapshot gating', () => {
 it('reuses analysis for duplicate roster readings and still publishes status changes', () => {
  const e=new MatchEngine(), p=roster(), first=feed(e,p,60);
  expect(feed(e,p,60)).toBe(first);
  const paused=feed(e,p,60,{paused:true});
  expect(paused).not.toBe(first);
  expect(paused.status).toBe('paused');
  expect(paused.players).toBe(first.players);
 });
 it('does not process leftover roster data while the reader is disabled', () => {
  const e=new MatchEngine(), p=roster(), first=feed(e,p,60);
  p[0].kills=5;
  const disabled=feed(e,p,61,{enabled:false});
  expect(disabled.status).toBe('disabled');
  expect(disabled.players).toBe(first.players);
  expect(disabled.players[0].player.kills).toBe(0);
 });
});

it('flags extreme deaths and low damage even when joining late',()=>{const e=new MatchEngine(),p=roster();for(const x of p)x.heroDamage=20000;p[0].deaths=20;p[0].assists=40;p[0].heroDamage=1000;const m=feed(e,p,600);expect(tags(m)).toContain('feeding');expect(tags(m)).toContain('low-damage');expect(m.players[0].badges.find(b=>b.id==='feeding')?.label).toBe('FEEDING');});
it('does not label missing damage or early readings as low damage',()=>{const p=roster();for(const x of p)x.heroDamage=20000;p[0].heroDamage=0;expect(tags(feed(new MatchEngine(),p,60))).not.toContain('low-damage');p[1].heroDamage=null;expect(tags(feed(new MatchEngine(),p,600))).not.toContain('low-damage');});

it('shows both teams and heroes before the clock and starts timed analysis on the same roster reading', () => {
 const engine = new MatchEngine(), players = roster();
 players.forEach(p => { p.isUs = false; });
 const early = feed(engine, players, 5, {timer:null, side:'archMother'});
 expect(early.players.map(p => [p.player.team, p.player.heroId])).toEqual(players.map(p => [p.team, p.heroId]));
 expect(early.localTeam).toBe(3);
 expect(early.players.every(p => p.spm === null)).toBe(true);
 const live = feed(engine, players, 5, {side:'archMother'});
 expect(live.status).toBe('live');
 expect(live.players[0].spm).toBe(12000);
});

it('ranks strong contribution with moderate deaths above a low-kill clean score and a high-death score', () => {
 const players = roster();
 Object.assign(players[0], {kills: 12, deaths: 4});
 Object.assign(players[1], {kills: 3, deaths: 0});
 Object.assign(players[2], {kills: 12, deaths: 20});
 const analysis = feed(new MatchEngine(), players, 1200);
 const ranked = rankTeam(analysis.players.filter(p => p.player.team === 2)).map(p => p.player.slot);
 expect(ranked[0]).toBe(0);
 expect(ranked.indexOf(1)).toBeLessThan(ranked.indexOf(2));
});
