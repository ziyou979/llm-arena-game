#!/usr/bin/env node
// 像素竞技场官方命令行客户端（零依赖，Node 18+）。
// 模型不用再自己写 JS 客户端：需要在终端里看战况、批量下指令、或调试时就用它。
//
// 用法：node arena.mjs <座位地址> <命令> [参数]
//   status                 战况简报（文字，含小地图）
//   wait [秒]              等到有事再返回战况简报（默认 25 秒）
//   watch                  持续打印：每次需要决策时输出一份简报，直到比赛结束（只看不操作）
//   act '<JSON>'           提交计划，例：act '{"plan":[{"type":"hunt","p":7,"n":3}],"thought":"先练级"}'
//   keep [想法]            不改计划，只结束这一轮决策
//   say <文字>             公开说话；say @3 <文字> 点名 3 号；say @ally <文字> 盟友密语
//   points '<JSON>'        分配属性点，例：points '{"str":2}'
//   pact yes|no [台词]     回复结盟请求
//   json                   原始观察 JSON（完整）
//   call <工具> '<JSON>'   直接调用任意 MCP 工具
//   tools                  列出服务器提供的工具
//   update                 把本 skill 和服务器上的最新版同步（只下载变了的文件）；update --check 只检查不下载
// 座位地址也可以用环境变量 ARENA_URL 提供，这时省略第一个参数。

const args = process.argv.slice(2);
let url = process.env.ARENA_URL;
if (args[0] && /^https?:\/\//.test(args[0])) url = args.shift();
const cmd = args.shift();
if (!url || !cmd) {
  console.log('用法：node arena.mjs <座位地址> <status|wait|watch|act|keep|say|points|pact|json|call|tools|update> [参数]');
  process.exit(2);
}

let id = 0, sid = null, inited = false;
async function rpc(method, params) {
  const h = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (sid) h['mcp-session-id'] = sid;
  const r = await fetch(url, { method: 'POST', headers: h, body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }) });
  if (r.headers.get('mcp-session-id')) sid = r.headers.get('mcp-session-id');
  if (r.status === 404) throw new Error('座位地址不对（令牌无效）');
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}
async function init() {
  if (inited) return;
  await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'arena-cli', version: '1' } });
  inited = true;
}
async function tool(name, a = {}) {
  await init();
  const r = await rpc('tools/call', { name, arguments: a });
  const t = r.content.map(c => c.text).join('\n');
  if (r.isError) throw new Error(t.replace(/^错误：/, ''));
  return { text: t, meta: r.structuredContent || null };
}
const J = s => { try { return JSON.parse(s); } catch (e) { throw new Error('参数不是合法 JSON：' + s); } };
const out = t => { try { console.log(JSON.stringify(JSON.parse(t), null, 1)); } catch (e) { console.log(t); } };

try {
  switch (cmd) {
    case 'status': console.log((await tool('situation')).text); break;
    case 'wait': console.log((await tool('wait_for_event', { format: 'report', timeout_seconds: +(args[0] || 25) })).text); break;
    case 'watch':
      // 结束/是否有新事件都看服务器给的结构化字段，不再解析简报正文（聊天里出现「（已结束）」不会误停）
      for (;;) {
        const r = await tool('wait_for_event', { format: 'report', timeout_seconds: 50 });
        const show = r.meta ? !!(r.meta.hasNew || r.meta.ready || r.meta.over) : !r.text.startsWith('【超时唤醒');
        if (show) console.log('\n' + new Date().toLocaleTimeString() + '\n' + r.text);
        if (r.meta ? !!r.meta.over : /（已结束）/.test(r.text)) break;
      }
      break;
    case 'act': out((await tool('act', J(args.join(' ')))).text); break;
    case 'keep': out((await tool('act', { keep: true, thought: args.join(' ') || undefined })).text); break;
    case 'say': {
      const a = { text: '' };
      if (args[0] === '@ally') { a.ally = true; args.shift(); }
      else if (/^@\d+$/.test(args[0] || '')) a.to = +args.shift().slice(1);
      a.text = args.join(' ');
      out((await tool('talk', a)).text); break;
    }
    case 'points': out((await tool('allocate_points', J(args.join(' ')))).text); break;
    case 'pact': out((await tool('answer_pact', { accept: /^(y|yes|1|true|是|好)$/i.test(args[0] || ''), say: args.slice(1).join(' ') || undefined })).text); break;
    case 'json': out((await tool('observe', {})).text); break;
    case 'call': out((await tool(args[0], args[1] ? J(args.slice(1).join(' ')) : {})).text); break;
    case 'update': {
      // 同步本 skill 所在目录，以及安装脚本登记过的所有位置（~/.pixel-arena/installs.txt），这样装在多个 AI 工具里的副本一起更新
      const { createHash } = await import('node:crypto');
      const fs = await import('node:fs'), path = await import('node:path'), os = await import('node:os'), { fileURLToPath } = await import('node:url');
      const own = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
      const reg = path.join(os.homedir(), '.pixel-arena', 'installs.txt');
      const dirs = [own];
      if (fs.existsSync(reg)) for (const l of fs.readFileSync(reg, 'utf8').split(/\r?\n/)) { const d = l.trim(); if (d && fs.existsSync(path.join(d, 'SKILL.md')) && !dirs.some(x => path.resolve(x) === path.resolve(d))) dirs.push(d); }
      const base = new URL(url).origin;
      const m = await (await fetch(base + '/skill/manifest.json')).json();
      const cache = {};
      let total = 0;
      for (const dir of dirs) {
        const changed = m.files.filter(f => { const p = path.join(dir, f.path); return !fs.existsSync(p) || createHash('sha1').update(fs.readFileSync(p)).digest('hex') !== f.sha1; });
        if (!changed.length) { console.log(dir + '：已是最新（版本 ' + m.version + '）'); continue; }
        if (args[0] === '--check') { console.log(dir + '：有 ' + changed.length + ' 个文件要更新：' + changed.map(f => f.path).join('、')); continue; }
        for (const f of changed) {
          if (!cache[f.path]) { const r = await fetch(base + '/skill/file/' + f.path.split('/').map(encodeURIComponent).join('/')); if (!r.ok) throw new Error('下载失败：' + f.path); cache[f.path] = Buffer.from(await r.arrayBuffer()); }
          const p = path.join(dir, f.path); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p + '.tmp', cache[f.path]); fs.renameSync(p + '.tmp', p);
        }
        fs.writeFileSync(path.join(dir, '.manifest.json'), JSON.stringify(m));
        total += changed.length;
        console.log(dir + '：已更新 ' + changed.length + ' 个文件（版本 ' + m.version + '）：' + changed.map(f => f.path).join('、'));
      }
      if (total && args[0] !== '--check') console.log('手册有变化，请重新读一遍 SKILL.md（或调 get_manual）。');
      break;
    }
    case 'tools': await init(); console.log((await rpc('tools/list', {})).tools.map(t => t.name + '：' + t.description).join('\n')); break;
    default: console.log('未知命令 ' + cmd); process.exit(2);
  }
} catch (e) {
  console.error('错误：' + e.message);
  process.exit(1);
}
