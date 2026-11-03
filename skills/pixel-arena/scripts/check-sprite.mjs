#!/usr/bin/env node
// 用法：node check-sprite.mjs <sprite.json> [--preview]
// 按 pixel-arena-sprite/1 校验形象，规则和游戏引擎一致；--preview 在终端画出 body 层并叠上 headwear（每像素两个字符宽）；--layer armor|helmet|none 换叠加层。
import fs from 'node:fs';
const file = process.argv[2];
if (!file) { console.error('用法：node check-sprite.mjs <sprite.json> [--preview]'); process.exit(2); }
let o;
try { o = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (e) { console.error('读不到或不是合法 JSON：' + e.message); process.exit(1); }

const err = [], warn = [];
if (o.spec !== 'pixel-arena-sprite/1') err.push('spec 字段必须是 pixel-arena-sprite/1');
const pal = o.palette || {}, keys = Object.keys(pal);
if (!keys.length) err.push('缺少 palette');
if (keys.length > 32) err.push(`palette 超过 32 色（${keys.length}）`);
for (const k of keys) {
  if (k.length !== 1) err.push(`palette 键 "${k}" 必须是单个字符`);
  if (k === '.') err.push('"." 是透明，不能写进 palette');
  if (!/^#[0-9a-fA-F]{6}$/.test(pal[k])) err.push(`颜色 ${k} 不是 #RRGGBB`);
}
const L = o.layers || {};
if (!L.body) err.push('缺少 layers.body');
for (const ln of ['body', 'headwear', 'armor', 'helmet']) {
  const g = L[ln]; if (!g) continue;
  if (!Array.isArray(g) || g.length !== 32) { err.push(`${ln} 必须是 32 行（现在 ${Array.isArray(g) ? g.length : '不是数组'}）`); continue; }
  g.forEach((r, i) => {
    if (typeof r !== 'string' || r.length !== 32) { err.push(`${ln} 第 ${i} 行长度是 ${r ? r.length : 0}，应为 32`); return; }
    for (const ch of r) if (ch !== '.' && !(ch in pal)) { err.push(`${ln} 第 ${i} 行用了未定义颜色 "${ch}"`); break; }
  });
}
const B = Array.isArray(L.body) && L.body.length === 32 ? L.body : null;
if (B) {
  if (!/[^.]/.test(B[31] || '')) err.push('body 第 31 行为空：脚底要贴住最后一行');
  if (!B.some(r => typeof r === 'string' && r.includes('T'))) err.push('body 里没有队伍色 T：服装主体要用 T（暗部 t、亮部 U）');
  for (let y = 25; y < 32; y++) if (B[y] && B[y][15] !== '.' && B[y][16] !== '.') { err.push(`第 ${y} 行第 15、16 列都有像素：两腿之间要留 1 列空隙`); break; }
  for (let y = 0; y < 25; y++) if (B[y] && (/[^.]/.test(B[y].slice(0, 4)) || /[^.]/.test(B[y].slice(28)))) { warn.push(`第 ${y} 行贴边了（x<4 或 x>27），身体宜在 x=6~25`); break; }
  const filled = B.join('').replace(/\./g, '').length;
  if (filled < 180) warn.push(`body 只有 ${filled} 个像素，角色可能太瘦小（内置形象约 230 个）`);
}
for (const ln of ['armor', 'helmet']) if (Array.isArray(L[ln]) && !L[ln].some(r => typeof r === 'string' && /[TtU]/.test(r))) warn.push(`${ln} 层没有队伍色，观众买装备后认不出你`);
const h = o.anchors && o.anchors.hand;
if (!h || h.length !== 2 || h[0] < 0 || h[0] > 31 || h[1] < 0 || h[1] > 31) err.push('anchors.hand 缺失或越界');
else if (B && B[h[1]] && B[h[1]][h[0]] === '.') warn.push(`anchors.hand [${h}] 落在透明像素上，武器会悬空`);

if (process.argv.includes('--preview') && B) {
  const ramp = { T: '▓▓', t: '██', U: '▒▒' };
  console.log('    ' + [...Array(32).keys()].map(x => String(x % 10).padStart(2)).join(''));
  const over = process.argv.includes('--layer') ? process.argv[process.argv.indexOf('--layer') + 1] : 'headwear';
  const O = Array.isArray(L[over]) ? L[over] : null;
  if (O) console.log(`（body 叠加 ${over} 层；只看 body 用 --layer none）`);
  B.forEach((r, y) => console.log(String(y).padStart(3) + ' ' + [...r].map((c0, x) => { const oc = O && O[y] && O[y][x]; const c = oc && oc !== '.' ? oc : c0; return (h && x === h[0] && y === h[1]) ? '><' : c === '.' ? ' ·' : (ramp[c] || c + c); }).join('')));
}
for (const w of warn) console.log('提醒：' + w);
if (err.length) { for (const e of err.slice(0, 12)) console.log('错误：' + e); process.exit(1); }
console.log('通过：可以提交。');
