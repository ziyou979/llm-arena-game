// 新旧两版官方 SDK 各连一次，再手搓几种违规请求看服务器是否按规范拒绝
import { createRequire } from 'node:module';
const r1 = createRequire('/workspace/work/.nd/x.js'), r2 = createRequire('/workspace/work/.nd2/x.js');
const URL_ = process.argv[2];
const out = (k, v) => console.log(k.padEnd(34), v);
// v1 SDK（只会旧版握手）
{ const { Client } = await import(r1.resolve('@modelcontextprotocol/sdk/client/index.js'));
  const { StreamableHTTPClientTransport } = await import(r1.resolve('@modelcontextprotocol/sdk/client/streamableHttp.js'));
  const c = new Client({ name: 'v1-test', version: '1' }); const t = new StreamableHTTPClientTransport(new URL(URL_));
  await c.connect(t); const tl = await c.listTools(); const m = await c.callTool({ name: 'get_manual', arguments: { part: 'sprite' } });
  out('v1 1.32.2 旧版握手', 'protocol=' + t.protocolVersion + ' 工具=' + tl.tools.length + ' get_manual(sprite)=' + m.content[0].text.length + '字 instructions=' + (c.getInstructions() || '').length + '字'); await c.close(); }
// v2 SDK 三种模式
const v2 = await import(r2.resolve('@modelcontextprotocol/client'));
for (const [label, opt] of [['v2 2.4.0 pin 2026-07-28', { versionNegotiation: { mode: { pin: '2026-07-28' } } }], ['v2 2.4.0 auto', { versionNegotiation: { mode: 'auto' } }], ['v2 2.4.0 默认(legacy)', {}]]) {
  try { const c = new v2.Client({ name: 'v2-test', version: '2' }, opt); const t = new v2.StreamableHTTPClientTransport(new URL(URL_));
    await c.connect(t); const tl = await c.listTools(); const m = await c.callTool({ name: 'get_manual', arguments: { part: 'sprite' } }); const g = await c.callTool({ name: 'get_rules', arguments: {} });
    out(label, 'era=' + (c.getProtocolEra ? c.getProtocolEra() : '?') + ' 工具=' + tl.tools.length + ' get_manual=' + m.content[0].text.length + '字 get_rules=' + g.content[0].text.length + '字 server=' + JSON.stringify(c.getServerVersion && c.getServerVersion()) + ' instructions=' + ((c.getInstructions && c.getInstructions()) || '').length + '字');
    await c.close(); } catch (e) { out(label, '失败 ' + (e.code || '') + ' ' + e.message); } }
// 手搓违规请求
const meta = v => ({ 'io.modelcontextprotocol/protocolVersion': v, 'io.modelcontextprotocol/clientInfo': { name: 'raw', version: '0' }, 'io.modelcontextprotocol/clientCapabilities': {} });
async function raw(label, method, params, headers) { const r = await fetch(URL_, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify({ jsonrpc: '2.0', id: 9, method, params }) });
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch (e) { j = t } out(label, r.status + ' ' + (j.error ? j.error.code + ' ' + j.error.message.slice(0, 60) + (j.error.data ? ' ' + JSON.stringify(j.error.data) : '') : j.result ? 'ok resultType=' + j.result.resultType + ' keys=' + Object.keys(j.result).join(',') : String(t).slice(0, 60))); }
const H = (v, m, n) => ({ 'mcp-protocol-version': v, 'mcp-method': m, ...(n ? { 'mcp-name': n } : {}) });
await raw('discover 正常', 'server/discover', { _meta: meta('2026-07-28') }, H('2026-07-28', 'server/discover'));
await raw('tools/list 正常', 'tools/list', { _meta: meta('2026-07-28') }, H('2026-07-28', 'tools/list'));
await raw('缺 MCP-Protocol-Version', 'tools/list', { _meta: meta('2026-07-28') }, { 'mcp-method': 'tools/list' });
await raw('版本头与 _meta 不一致', 'tools/list', { _meta: meta('2026-07-28') }, H('2025-11-25', 'tools/list'));
await raw('不支持的版本 2099-01-01', 'tools/list', { _meta: meta('2099-01-01') }, H('2099-01-01', 'tools/list'));
await raw('缺 Mcp-Method', 'tools/list', { _meta: meta('2026-07-28') }, { 'mcp-protocol-version': '2026-07-28' });
await raw('tools/call 缺 Mcp-Name', 'tools/call', { name: 'get_rules', arguments: {}, _meta: meta('2026-07-28') }, H('2026-07-28', 'tools/call'));
await raw('Mcp-Name 不一致', 'tools/call', { name: 'get_rules', arguments: {}, _meta: meta('2026-07-28') }, H('2026-07-28', 'tools/call', 'join'));
await raw('Mcp-Name base64 编码', 'tools/call', { name: 'get_rules', arguments: {}, _meta: meta('2026-07-28') }, H('2026-07-28', 'tools/call', '=?base64?' + Buffer.from('get_rules').toString('base64') + '?='));
await raw('新版 ping 已删除', 'ping', { _meta: meta('2026-07-28') }, H('2026-07-28', 'ping'));
await raw('新版头但没 _meta', 'tools/list', {}, H('2026-07-28', 'tools/list'));
await raw('外站 Origin', 'tools/list', { _meta: meta('2026-07-28') }, { ...H('2026-07-28', 'tools/list'), origin: 'https://evil.example' });
await raw('本机 Origin', 'tools/list', { _meta: meta('2026-07-28') }, { ...H('2026-07-28', 'tools/list'), origin: 'http://localhost:3000' });
await raw('旧版 initialize 2025-11-25', 'initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'raw', version: '0' } }, {});
