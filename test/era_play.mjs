// 真对局：新版(2026-07-28) 与旧版 SDK 各占一个座位，按 skill 的回合流程打几轮
import fs from 'fs'; import { createRequire } from 'node:module';
const r1 = createRequire('/workspace/work/.nd/x.js'), r2 = createRequire('/workspace/work/.nd2/x.js');
const T = JSON.parse(fs.readFileSync(new URL('../.arena-tokens.json', import.meta.url)));
const v2 = await import(r2.resolve('@modelcontextprotocol/client'));
const { Client: C1 } = await import(r1.resolve('@modelcontextprotocol/sdk/client/index.js'));
const { StreamableHTTPClientTransport: T1 } = await import(r1.resolve('@modelcontextprotocol/sdk/client/streamableHttp.js'));
async function player(label, c, t, stats, wep, plotPick) {
  await c.connect(t); const era = c.getProtocolEra ? c.getProtocolEra() : 'legacy(v1)';
  const call = async (n, a) => { const r = await c.callTool({ name: n, arguments: a || {} }, undefined, { timeout: 120000 }); return (r.isError ? 'ERR ' : '') + r.content[0].text };
  const log = []; log.push('join: ' + (await call('join', { name: label })).slice(0, 60).replace(/\n/g, ' '));
  log.push('setup: ' + (await call('setup_character', { stats, weapon: wep })).slice(0, 60).replace(/\n/g, ' '));
  log.push('habits(lobby): ' + (await call('act', { habits: { potion_at: 0.35, flee_at: 0.2, fight_back: true } })).replace(/\s+/g, ' ').slice(0, 120));
  let turns = 0, acts = 0, errs = 0, habLine = '';
  for (let k = 0; k < 10; k++) { const w = await call('wait_for_event', { format: 'report', timeout_seconds: 40 });
    if (w.startsWith('ERR')) { errs++; log.push('wait ERR ' + w.slice(0, 80)); continue }
    if (!habLine) { const l = w.split('\n').find(x => x.startsWith('习惯')); if (l) habLine = l } if (w.includes('比赛结束')) break; if (!w.includes('【需要你决策】')) continue; turns++;
    const p = plotPick(w); const a = await call('act', { plan: [{ type: 'hunt', p, n: 5 }, { type: 'capture', p }], thought: '刷怪后占地' });
    if (a.startsWith('ERR')) { errs++; log.push('act ERR ' + a.slice(0, 80)) } else acts++ }
  console.log(label.padEnd(10), 'era=' + era, '决策回合=' + turns, 'act成功=' + acts, '错误=' + errs); log.push('report: ' + habLine); log.forEach(l => console.log('   ', l)); await c.close() }
const pickPlot = w => { const m = w.match(/领地(\d+)/); return m ? +m[1] : 16 };
await new Promise(z => setTimeout(z, 1500));
await Promise.all([
  player('Modern', new v2.Client({ name: 'v2', version: '2' }, { versionNegotiation: { mode: { pin: '2026-07-28' } } }), new v2.StreamableHTTPClientTransport(new URL('http://127.0.0.1:8799/mcp/' + T['4'])), [8, 5, 7, 2, 3, 5], 'sword', pickPlot),
  player('Legacy', new C1({ name: 'v1', version: '1' }), new T1(new URL('http://127.0.0.1:8799/mcp/' + T['1'])), [3, 6, 6, 2, 3, 10], 'bow', pickPlot)]);
process.exit(0);
