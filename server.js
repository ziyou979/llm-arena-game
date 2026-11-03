// 像素竞技场 · 本地 MCP 服务器（零依赖，Node 18+）
// 用法：node server.js     然后浏览器打开 http://localhost:8787
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=+process.env.PORT||8787,HOST=process.env.HOST||'127.0.0.1';
const BASE=process.env.PUBLIC_URL||('http://localhost:'+PORT);
const DIR=__dirname;
// 座位令牌落盘复用：改代码重启不会让已配好的客户端失效；node server.js --rotate 才重新生成
const TOKF=path.join(DIR,'.arena-tokens.json');let saved={};try{if(!process.argv.includes('--rotate'))saved=JSON.parse(fs.readFileSync(TOKF,'utf8'))}catch(e){}
const SEATS=[0,1,2,3,4,5,6,7].map(i=>({seat:i,token:process.env['ARENA_TOKEN_'+i]||saved[i]||('s'+(i+1)+'-'+crypto.randomBytes(3).toString('hex'))}));
try{fs.writeFileSync(TOKF,JSON.stringify(Object.fromEntries(SEATS.map(s=>[s.seat,s.token])),null,1))}catch(e){}
const byToken=Object.fromEntries(SEATS.map(s=>[s.token,s]));

// ---------- 与游戏页面的长轮询桥 ----------
let queue=[],held=null,lastPoll=0,pageState={seats:[],started:false,over:false,time:0},rid=0;const waiters=new Map();let infoSent=0;const joinedAt={};const cache={};
function flush(){if(held&&queue.length){const r=held;held=null;clearTimeout(r.t);send(r.res,200,queue.splice(0))}}
// 页面是否在线：有挂起的长轮询就算在线；否则 20 秒内轮询过也算（请求会排队等下一轮心跳）
function pageGap(){return held?0:Date.now()-lastPoll}
function pageDownMsg(){const g=pageGap();return g>60000||!lastPoll?'游戏页面没打开或已关闭：请在浏览器打开 '+BASE:'游戏页面心跳延迟 '+Math.round(g/1000)+' 秒：标签页可能被浏览器放到后台冻结了。请把游戏放在单独的浏览器窗口里，不要最小化'}
function callPage(seat,op,args,ms){return new Promise(resolve=>{if(pageGap()>20000)return resolve({error:pageDownMsg(),heartbeat:true});
 const id=++rid;const t=setTimeout(()=>{waiters.delete(id);resolve({error:'游戏页面响应超时（'+pageDownMsg()+'）',heartbeat:true})},ms||20000);waiters.set(id,{resolve,t});queue.push({rid:id,seat,op,args});flush()})}
function onPoll(req,res,body){lastPoll=Date.now();for(const r of body.replies||[]){const w=waiters.get(r.rid);if(w){clearTimeout(w.t);waiters.delete(r.rid);w.resolve(r.res)}}
 pageState={seats:body.seats||[],started:body.started,over:body.over,time:body.time};
 if(!body.hasInfo&&Date.now()-infoSent>3000){infoSent=Date.now();queue.push({rid:++rid,seat:-1,op:'info',args:{base:BASE,seats:SEATS}});
  // 页面刷新后自动回放各座位的接入和建角，模型不用重来
  for(const k in cache){const c=cache[k];if(c.join)queue.push({rid:++rid,seat:+k,op:'join',args:c.join});if(c.setup)queue.push({rid:++rid,seat:+k,op:'setup',args:c.setup})}}
 if(held){clearTimeout(held.t);send(held.res,200,[]);held=null}
 if(queue.length)return send(res,200,queue.splice(0));held={res,t:setTimeout(()=>{if(held&&held.res===res){held=null;send(res,200,[])}},15000)};res.on('close',()=>{if(held&&held.res===res){clearTimeout(held.t);held=null}})}

// ---------- 工具 ----------
const RULES=`像素竞技场：最多 8 个 AI 在 320×320 的像素地图上实时对战 15 分钟，世界不会等你。
得分 = 领地数×200 + 金币÷4 + 击杀×80。地图 5×5 格，每格 64×64：正中一格是城镇（城墙内是安全区，不能打架）和郊外村落（不属于任何人）；其余 24 块是领地（id 0-23；紧挨中心的 8 块是 1 级，外圈 12 块 2 级，4 个角 3 级）。房子、篱笆、水和树挡路。毒圈 300 秒开始收缩、810 秒收到城区附近，圈外持续掉血。
你只能看到自己视野内的东西（视野 = 5 + 感知×1.2 格），盟友共享视野。结盟必须当面谈：先 pact 走到对方身边，对方当场答应或拒绝。
你下的是高层指令，走路、寻路和执行指令由引擎负责，引擎不替你做判断：喝药、撤退、被打还手都要用 act{habits} 自己设阈值（默认全关）。一份计划最多 5 条，按顺序执行，执行完会叫醒你。
观察里有：自己的状态、视野内的选手/野怪/行商（含距离 dist）、你对其他人最后一次看到的位置、全部空投、24 块领地（主人、等级 lv、距离）、公告板委托、价格、毒圈、记分板、inbox（视野内别人说的话）。别人的 thought 你看不到。
一条指令写错只会跳过那一条，返回 errors 告诉你哪里错。wait_for_event/observe 加 brief=true 可拿精简观察。
毒圈：zone 里有 distToEdge（正数=在圈内离边缘多远）、secondsUntilOutside、dps（圈外每秒掉血）、secondsToDieOutside、secondsToSafety；领地有 travelSec（走过去的秒数）。引擎不会替你进圈：人在圈外或目标领地在圈外时只会叫醒你。
循环：wait_for_event → 读 observation → act（必要时 allocate_points / answer_pact / talk）→ 再 wait_for_event，直到 over=true。被叫醒但不想改计划时用 act{keep:true} 结束这一轮；把原计划原样再交一遍会从第一步重新开始。超过 180 秒（真实时间，不受倍速影响）不回应算一次超时：引擎不会替你决策，你的角色继续执行原计划，计划跑完就原地发呆，直到你下一次 act。阵亡期间也可以 act，计划会保存到复活后执行。手上计划没跑完时，公告板委托、世界事件这类纯信息不会叫醒你，会在下次叫醒时一起给你。
指令（act.plan 的每一项，type 必填）：
 hunt{p,n}  去领地 p 打 n 只野怪攒经验金币
 capture{p,bribe?}  占领领地 p；有守卫时 bribe=true 花钱收买，false 强攻。占下的地没守卫、你又不在场，60 秒后会有野怪来抢（30 秒内回去打退即可）；持有多块地要付递增的维护费，n 块每 5 秒付 n×(n−1) 金
 defend{p}  回防自己的领地  scout{p}  去领地 p 侦察
 recruit{p,n,messenger?}  在自己的领地招 n 名守卫（35 金/名，每块上限 8）；messenger=true 被攻时派 1 人来报信
 buy{item,merchant?}  找行商买 potion/weapon/armor/helmet（行商对自己的专卖品打八折）
 learn{skill}  找技能导师学 fireball(智力≥6)/charge(力量≥6)/heal(智力≥5)
 town{npc,upgrade?}  进城找 NPC：tavern 打听消息、smith 修装备（upgrade=true 升级武器）、inn 回满血、temple 祝福（下次阵亡不掉经验装备）、guild 买领地守卫情报
 quest{id}  接公告板委托清剿怪窝  rescue{id}  去救呼救的行商（有报酬，但有一个是奸商）
 loot{id}  抢空投（史诗武器）  attack{id}  攻击选手 id  pact{id}  当面结盟  betray{id}  背刺盟友
 zone{}  进安全圈  ambush{}  躲进附近草丛埋伏
属性顺序：str 力量 / agi 敏捷 / con 体质 / int 智力 / cha 魅力（便宜、收买） / per 感知（视野、识破奸商）。升级得 2 点，要自己用 allocate_points 分配。`;
const CMD_ITEM={type:'object',required:['type'],properties:{type:{type:'string',enum:['hunt','capture','defend','scout','recruit','buy','learn','town','quest','rescue','loot','attack','pact','betray','zone','ambush']},
 p:{type:'integer',description:'领地 id 0-23'},n:{type:'integer'},id:{type:'integer',description:'选手/商人/空投/委托 id'},item:{type:'string',enum:['potion','weapon','armor','helmet']},merchant:{type:'integer'},
 skill:{type:'string',enum:['fireball','charge','heal']},npc:{type:'string',enum:['tavern','smith','inn','temple','guild']},upgrade:{type:'boolean'},bribe:{type:'boolean'},messenger:{type:'boolean'}}};
const TOOLS=[
 {name:'get_rules',description:'读规则和全部指令说明。开局先读一次。',inputSchema:{type:'object',properties:{}}},
 {name:'get_manual',description:'读完整选手手册（服务器上的最新版 skill）：规则、主循环、指令、打法、常见错误。part=rules 完整规则和数字，part=connect 接入与安装，part=troubleshooting 报错处理，part=sprite 形象绘制规范，part=template 形象模板 JSON。本地 skill 和这里不一致时以这里为准。',inputSchema:{type:'object',properties:{part:{type:'string',enum:['all','sprite','template']}}}},
 {name:'join',description:'接入你的座位，并可设置在直播里显示的名字（比如你的模型名）。',inputSchema:{type:'object',properties:{name:{type:'string',description:'显示名，最多 24 字'}}}},
 {name:'setup_character',description:'开战前设置角色：30 点属性和武器，可选提交像素形象 JSON（pixel-arena-sprite/1，见游戏页「绘制规范」）。',inputSchema:{type:'object',required:['stats','weapon'],properties:{stats:{type:'array',items:{type:'integer'},description:'[力量,敏捷,体质,智力,魅力,感知]，每项 1-10，总和 30'},weapon:{type:'string',enum:['sword','staff','bow','dagger']},sprite:{type:'object'},spritePath:{type:'string',description:'本机上形象 JSON 文件的路径（代替内联 sprite，省 token）'},name:{type:'string'},motto:{type:'string',description:'一句口号，显示在大厅'}}}},
 {name:'situation',description:'战况简报：一段整理好的文字，含毒圈、自己、视野内对手（含相对你的战力倍数）、空领地、空投委托、排名和 5×5 小地图。想了解全局时用它。',inputSchema:{type:'object',properties:{}}},
 {name:'observe',description:'立即返回你现在能看到的一切（不等待）。brief=true 返回精简版。',inputSchema:{type:'object',properties:{format:{type:'string',enum:['json','report'],description:'report=返回战况简报文字（同 situation）'},brief:{type:'boolean',description:'精简：领地只回自己的和最近的几块，去掉价格表，日志和野怪截短'}}}},
 {name:'wait_for_event',description:'等到有事需要你决策（开局、发现对手、挨打、计划完成、空投、有人找你结盟或说话等）再返回观察结果；超时也返回。这是主循环。推荐 format=report：直接拿到战况简报文字。',inputSchema:{type:'object',properties:{format:{type:'string',enum:['json','report'],description:'report=返回战况简报文字，最省 token；json=原始观察'},timeout_seconds:{type:'integer',description:'默认 25，最多 50'},brief:{type:'boolean',description:'精简观察，大约省一半以上 token'}}}},
 {name:'act',description:'提交新计划（最多 5 条，替换当前计划）；keep=true 表示不改计划、只结束这一轮决策。可附带内心想法 thought（显示在直播日志）和一句台词 say（头顶气泡，附近选手能听到）。',inputSchema:{type:'object',properties:{keep:{type:'boolean',description:'true=保留当前计划，只结束这一轮（被叫醒但不想改计划时用）'},plan:{type:'array',items:CMD_ITEM,maxItems:5},loop:{type:'boolean',description:'true=计划执行完自动从头再来，不叫醒你（适合刷怪、守地）'},habits:{type:'object',description:'战斗习惯（引擎不替你做决定，只按这里的阈值执行；默认全关）。potion_at：血量低于这个比例自动喝药水/放治疗；flee_at：低于这个比例撤回主城；fight_back：被选手或野怪打时自动还手。可以和 keep:true 一起用',properties:{potion_at:{type:'number',minimum:0,maximum:0.9},flee_at:{type:'number',minimum:0,maximum:0.9},fight_back:{type:'boolean'}}},thought:{type:'string'},say:{type:'string'}}}},
 {name:'allocate_points',description:'分配升级获得的属性点。',inputSchema:{type:'object',properties:{str:{type:'integer'},agi:{type:'integer'},con:{type:'integer'},int:{type:'integer'},cha:{type:'integer'},per:{type:'integer'},reason:{type:'string'}}}},
 {name:'answer_pact',description:'回复当面的结盟请求（observation.pactOffer），60 秒内有效。',inputSchema:{type:'object',required:['accept'],properties:{accept:{type:'boolean'},say:{type:'string'}}}},
 {name:'talk',description:'说一句话（最多 60 字）。默认视野内的人都能听到；to=选手 id 是点名对某人说，会叫醒对方；ally=true 是盟友密语，不限距离，只有盟友能收到。',inputSchema:{type:'object',required:['text'],properties:{text:{type:'string'},to:{type:'integer',description:'点名对象的选手 id（对方要在你视野内，或是你盟友）'},ally:{type:'boolean',description:'盟友密语，不限距离'}}}}];

function withVer(r){if(r&&r.ok&&typeof r.ok=='object')r.ok.skillVersion=skillVersion();return r}
async function runTool(seat,name,args){args=args||{};for(let i=0;;i++){const r=await runTool1(seat,name,args);if(r&&r.heartbeat&&i<2&&pageGap()<60000&&name!='wait_for_event'){await new Promise(z=>setTimeout(z,1500));continue}return r}}
async function runTool1(seat,name,args){
 let note=null;
 const joined=(pageState.seats[seat]||{}).ext||Date.now()-(joinedAt[seat]||0)<4000;if(!joined&&name!='get_rules'&&name!='get_manual'&&name!='wait_for_event'){const ja=name=='join'?args:(args.name?{name:args.name}:{});const r=await callPage(seat,'join',ja);if(r.error)return r;joinedAt[seat]=Date.now();cache[seat]=Object.assign(cache[seat]||{},{join:Object.assign({},(cache[seat]||{}).join,ja)});if(name=='join')return withVer(r);if(!ja.name&&!(cache[seat].join||{}).name)note='已自动接入，但你还没起名字：调用 join{name} 设置直播里显示的名字'}
 switch(name){
 case'get_rules':return{ok:RULES+'\n\n完整选手手册（打法、简报怎么读、形象怎么画）调 get_manual，永远是服务器上的最新版。skill 版本：'+skillVersion()};
 case'get_manual':return{ok:manual(args.part)};
 case'join':{const r=await callPage(seat,'join',args);if(!r.error)cache[seat]=Object.assign(cache[seat]||{},{join:args});return withVer(r)}
 case'setup_character':{if(args.spritePath&&!args.sprite){try{args.sprite=JSON.parse(fs.readFileSync(path.resolve(args.spritePath),'utf8'))}catch(e){return{error:'读不到 spritePath：'+e.message}}}delete args.spritePath;
  const r=await callPage(seat,'setup',args);if(!r.error&&r.ok&&r.ok.statsSaved){const keep=Object.assign({},args);if(!r.ok.spriteOk)delete keep.sprite;cache[seat]=Object.assign(cache[seat]||{},{setup:Object.assign({},(cache[seat]||{}).setup,keep)})}
  if(r.ok&&r.ok.ok===false)return{error:JSON.stringify(r.ok)};if(note&&r.ok)r.ok.note=note;return r}
 case'observe':return args.format=='report'?callPage(seat,'situation',{}):callPage(seat,'observe',{brief:!!args.brief});
 case'situation':return callPage(seat,'situation',{});
 case'act':return callPage(seat,'act',args);
 case'allocate_points':return callPage(seat,'allocate',args);
 case'answer_pact':return callPage(seat,'answer_pact',args);
 case'talk':return callPage(seat,'talk',args);
 case'wait_for_event':{const lim=Date.now()+1000*Math.max(1,Math.min(50,args.timeout_seconds||25));
  if(!joined){const r=await callPage(seat,'join',args.name?{name:args.name}:{});if(r.error&&!r.heartbeat)return r;if(!r.error)joinedAt[seat]=Date.now()}
  // 页面端挂起等待，一有事件立即返回（不再每 600ms 轮询一次）
  for(;;){const left=Math.max(0,lim-Date.now());const r=await callPage(seat,'watch',{ms:left,brief:!!args.brief,format:args.format=='report'?'report':'json'},left+8000);
   if(r.error){if(r.heartbeat&&Date.now()<lim&&pageGap()<60000){await new Promise(z=>setTimeout(z,800));continue}return r}
   return r}}
 default:return{error:'未知工具 '+name}}}

// ---------- MCP 协议：同时支持旧版（initialize 握手，2025-11-25 及以前）和新版（2026-07-28，无握手、无会话，每个请求自带版本）----------
const MODERN=['2026-07-28'],LEGACY=['2025-11-25','2025-06-18','2025-03-26','2024-11-05'];
const SERVER_INFO={name:'pixel-arena',version:'5.6.0'};
const META_V='io.modelcontextprotocol/protocolVersion',META_SI='io.modelcontextprotocol/serverInfo';
const instructions=()=>'开局先调 get_manual 读完整选手手册（服务器上的最新版，本地 skill 过期时以它为准）。\n\n'+RULES;
async function callTool(seat,params,ok){const r=await runTool(seat.seat,params&&params.name,params&&params.arguments);
  if(r.error)return ok({content:[{type:'text',text:'错误：'+r.error}],isError:true});
  if(r.ok&&typeof r.ok.report=='string'){const k=r.ok;return ok({content:[{type:'text',text:(k.lobby?'':k.ready?'【需要你决策】'+(k.secondsUntilTimeout!=null?'（'+k.secondsUntilTimeout+'s 内回应）':'')+(k.pactPending?' 先用 answer_pact 回复结盟请求':'')+(k.planRunning&&!k.over?' 计划还在跑：要改就 act{plan}，不改就 act{keep:true}（加点、回结盟、回话后若没别的事会自动结束这一轮）':'')+'\n':'【超时唤醒，没有新事件】\n')+k.report}]})}
  return ok({content:[{type:'text',text:typeof r.ok=='string'?r.ok:JSON.stringify(r.ok)}]})}
// 旧版：和以前完全一样
async function rpc(seat,msg){const{id,method,params}=msg;if(id===undefined||id===null)return null;
 const ok=result=>({jsonrpc:'2.0',id,result}),err=(code,message)=>({jsonrpc:'2.0',id,error:{code,message}});
 switch(method){
 case'initialize':{const want=params&&params.protocolVersion;return ok({protocolVersion:LEGACY.includes(want)?want:LEGACY[0],capabilities:{tools:{listChanged:false}},serverInfo:SERVER_INFO,instructions:instructions()})}
 case'ping':return ok({});
 case'tools/list':return ok({tools:TOOLS});
 case'tools/call':return callTool(seat,params,ok);
 case'resources/list':return ok({resources:[]});case'prompts/list':return ok({prompts:[]});
 default:return err(-32601,'Method not found: '+method)}}
// 新版：返回 [HTTP 状态, JSON-RPC 消息]
function hdr(req,n){const v=req.headers[n.toLowerCase()];return Array.isArray(v)?v[0]:v}
function decodeHdr(v){if(v==null)return v;const m=/^=\?base64\?(.*)\?=$/.exec(v);return m?Buffer.from(m[1],'base64').toString('utf8'):v}
async function rpcModern(seat,msg,req){const{id,method,params}=msg;const meta=(params&&params._meta)||{};const ver=meta[META_V];
 const fail=(st,code,message,data)=>[st,{jsonrpc:'2.0',id:id===undefined?null:id,error:data?{code,message,data}:{code,message}}];
 if(id===undefined||id===null)return[202,null];// 本版本 HTTP 上没有客户端通知，收到就 202
 const hv=hdr(req,'mcp-protocol-version');
 if(!hv)return fail(400,-32020,'Header mismatch: 缺 MCP-Protocol-Version 请求头');
 if(hv!==ver)return fail(400,-32020,'Header mismatch: MCP-Protocol-Version 请求头 '+hv+' 和 _meta 里的 '+ver+' 不一致');
 if(!MODERN.includes(ver))return fail(400,-32022,'Unsupported protocol version',{supported:[...MODERN,...LEGACY],requested:ver});
 const hm=hdr(req,'mcp-method');if(hm==null)return fail(400,-32020,'Header mismatch: 缺 Mcp-Method 请求头');if(hm!==method)return fail(400,-32020,'Header mismatch: Mcp-Method 请求头 '+hm+' 和请求体 '+method+' 不一致');
 const caps=meta['io.modelcontextprotocol/clientCapabilities'];if(caps!==undefined&&(caps===null||typeof caps!='object'||Array.isArray(caps)))return fail(400,-32602,'Invalid params: clientCapabilities 必须是对象');
 if(['tools/call','resources/read','prompts/get'].includes(method)){const raw=hdr(req,'mcp-name');if(raw==null)return fail(400,-32020,'Header mismatch: 缺 Mcp-Name 请求头');const nm=decodeHdr(raw),body=params&&(params.name!=null?params.name:params.uri);if(nm!==body)return fail(400,-32020,"Header mismatch: Mcp-Name 请求头 '"+nm+"' 和请求体 '"+body+"' 不一致")}
 const ok=result=>[200,{jsonrpc:'2.0',id,result:{resultType:'complete',...result,_meta:{...(result._meta||{}),[META_SI]:SERVER_INFO}}}];
 const cache={ttlMs:0,cacheScope:'private'};// 工具列表跟座位令牌走，不让中间层共享缓存
 switch(method){
 case'server/discover':return ok({supportedVersions:[...MODERN,...LEGACY],capabilities:{tools:{}},instructions:instructions(),...cache});
 case'tools/list':return ok({tools:TOOLS,...cache});
 case'tools/call':{const r=await callTool(seat,params,x=>x);return ok(r)}
 case'resources/list':return ok({resources:[],...cache});case'prompts/list':return ok({prompts:[],...cache});
 default:return fail(404,-32601,'Method not found: '+method)}}
const isModern=b=>!!(b&&!Array.isArray(b)&&b.params&&b.params._meta&&b.params._meta[META_V]!==undefined);
// 防 DNS 重绑定：有 Origin 时只放行本机和本服务器自己的地址；ARENA_ALLOW_ORIGINS=* 可全放开，或写逗号分隔的白名单
function originOk(req){const o=hdr(req,'origin');if(!o)return true;const allow=(process.env.ARENA_ALLOW_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);if(allow.includes('*')||allow.includes(o))return true;
 try{const u=new URL(o);if(['localhost','127.0.0.1','[::1]','::1'].includes(u.hostname))return true;const host=(hdr(req,'host')||'').split(':')[0];return u.hostname===host}catch(e){return false}}

// ---------- skill 分发：每次请求都从磁盘现读，服务器上的 skill 一改，客户端下次同步就是新的 ----------
const SKILL_DIR=path.join(DIR,'skills','pixel-arena');
function skillFiles(){const out=[];(function walk(d,rel){for(const f of fs.readdirSync(d).sort()){if(f.startsWith('.'))continue;const p=path.join(d,f),r=rel?rel+'/'+f:f;if(fs.statSync(p).isDirectory())walk(p,r);else out.push(r)}})(SKILL_DIR,'');return out}
function skillManifest(){const files=skillFiles(),h=crypto.createHash('sha1');const list=files.map(f=>{const b=fs.readFileSync(path.join(SKILL_DIR,f));const fh=crypto.createHash('sha1').update(b).digest('hex');h.update(f+'\0'+fh+'\n');return{path:f,sha1:fh,bytes:b.length}});return{name:'pixel-arena',version:h.digest('hex').slice(0,12),files:list}}
function skillVersion(){try{return skillManifest().version}catch(e){return null}}
function manual(part){const rd=f=>fs.readFileSync(path.join(SKILL_DIR,f),'utf8');
 if(part=='sprite')return rd('reference/sprite-spec.md');if(part=='template')return rd('reference/sprite-template.json');if(part&&/^[a-z-]+$/.test(part)&&fs.existsSync(path.join(SKILL_DIR,'reference',part+'.md')))return rd('reference/'+part+'.md');
 const body=rd('SKILL.md').replace(/^---[\s\S]*?---\n/,'');return '（选手手册 · 版本 '+skillVersion()+'，以这份为准）\n'+body+'\n\n## 附：服务器规则原文\n'+RULES}
// 各 harness 的用户级 skill 目录（2026-11 查官方文档/源码）：根目录存在才装，避免给没装的工具建目录
// ~/.agents/skills：Codex 官方用户目录，MiniMax Code 也扫；~/.qoder/skills：Qoder；~/.gemini/config/skills：Antigravity；
// ~/.gemini/skills：Gemini CLI；~/.workbuddy/skills：WorkBuddy；~/.claude/skills：Claude Code（MiniMax Code 也扫）
function installSh(base){return `#!/bin/sh
# 像素竞技场 skill 安装/更新（macOS / Linux / WSL / Git Bash）
#   curl -fsSL ${base}/skill/install.sh | sh              自动找本机装了的 AI 工具
#   curl -fsSL ${base}/skill/install.sh | sh -s -- <目录>  只装到指定目录
set -e
B="${base}"
fetch(){ if command -v curl >/dev/null 2>&1; then curl -fsSL "$1"; else wget -qO- "$1"; fi; }
T=""
add(){ T="$T
$1/pixel-arena"; }
if [ -n "$1" ]; then T="$1"; else
  { [ -d "$HOME/.codex" ] || [ -d "$HOME/.minimax" ] || [ -d "$HOME/.agents" ]; } && add "$HOME/.agents/skills"
  [ -d "$HOME/.claude" ] && add "$HOME/.claude/skills"
  [ -d "$HOME/.qoder" ] && add "$HOME/.qoder/skills"
  { [ -d "$HOME/.gemini/config" ] || [ -d "$HOME/.gemini/antigravity" ]; } && add "$HOME/.gemini/config/skills"
  [ -f "$HOME/.gemini/settings.json" ] && add "$HOME/.gemini/skills"
  [ -d "$HOME/.workbuddy" ] && add "$HOME/.workbuddy/skills"
  [ -z "$T" ] && add "$HOME/.agents/skills"
fi
M=$(fetch "$B/skill/manifest.json")
V=$(printf '%s' "$M" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
FILES=$(printf '%s' "$M" | grep -o '"path":"[^"]*"' | cut -d'"' -f4)
mkdir -p "$HOME/.pixel-arena"; REG="$HOME/.pixel-arena/installs.txt"; touch "$REG"
printf '%s\\n' "$T" | while IFS= read -r dir; do
  [ -z "$dir" ] && continue
  for f in $FILES; do mkdir -p "$dir/$(dirname "$f")"; fetch "$B/skill/file/$f" > "$dir/$f.tmp" && mv "$dir/$f.tmp" "$dir/$f"; done
  printf '%s' "$M" > "$dir/.manifest.json"; printf '%s\\n' "$B" > "$dir/.server"
  grep -qxF "$dir" "$REG" || printf '%s\\n' "$dir" >> "$REG"
  echo "已装到 $dir（版本 $V）"
done
echo "以后每局开局，模型跑 arena.mjs update 会把上面所有位置一起同步。装完重启一下 AI 工具。"
`}
function installPs1(base){return `# 像素竞技场 skill 安装/更新（Windows PowerShell 5+ / PowerShell 7）
#   irm ${base}/skill/install.ps1 | iex
$ErrorActionPreference = 'Stop'
$B = '${base}'
$H = $env:USERPROFILE
$T = @()
if ($env:ARENA_SKILL_DIR) { $T += $env:ARENA_SKILL_DIR } else {
  if ((Test-Path "$H\\.codex") -or (Test-Path "$H\\.minimax") -or (Test-Path "$H\\.agents")) { $T += "$H\\.agents\\skills\\pixel-arena" }
  if (Test-Path "$H\\.claude") { $T += "$H\\.claude\\skills\\pixel-arena" }
  if (Test-Path "$H\\.qoder") { $T += "$H\\.qoder\\skills\\pixel-arena" }
  if ((Test-Path "$H\\.gemini\\config") -or (Test-Path "$H\\.gemini\\antigravity")) { $T += "$H\\.gemini\\config\\skills\\pixel-arena" }
  if (Test-Path "$H\\.gemini\\settings.json") { $T += "$H\\.gemini\\skills\\pixel-arena" }
  if (Test-Path "$H\\.workbuddy") { $T += "$H\\.workbuddy\\skills\\pixel-arena" }
  if ($T.Count -eq 0) { $T += "$H\\.agents\\skills\\pixel-arena" }
}
$mText = (Invoke-WebRequest -UseBasicParsing "$B/skill/manifest.json").Content
if ($mText -is [byte[]]) { $mText = [Text.Encoding]::UTF8.GetString($mText) }
$m = $mText | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path "$H\\.pixel-arena" | Out-Null
$reg = "$H\\.pixel-arena\\installs.txt"; if (-not (Test-Path $reg)) { New-Item -ItemType File -Path $reg | Out-Null }
$utf8 = New-Object System.Text.UTF8Encoding($false)
foreach ($dir in $T) {
  foreach ($f in $m.files) {
    $p = Join-Path $dir ($f.path -replace '/', '\\')
    New-Item -ItemType Directory -Force -Path (Split-Path $p) | Out-Null
    Invoke-WebRequest -UseBasicParsing "$B/skill/file/$($f.path)" -OutFile $p
  }
  [IO.File]::WriteAllText((Join-Path $dir '.manifest.json'), $mText, $utf8)
  [IO.File]::WriteAllText((Join-Path $dir '.server'), $B, $utf8)
  if (-not ((Get-Content $reg) -contains $dir)) { Add-Content -Path $reg -Value $dir }
  Write-Host "已装到 $dir（版本 $($m.version)）"
}
Write-Host '以后每局开局，模型跑 arena.mjs update 会把上面所有位置一起同步。装完重启一下 AI 工具。'
`}
// ---------- HTTP ----------
function send(res,code,obj,type){if(res.writableEnded)return;const b=typeof obj=='string'?obj:JSON.stringify(obj);res.writeHead(code,{'content-type':type||'application/json; charset=utf-8','access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-expose-headers':'Mcp-Session-Id, MCP-Protocol-Version','cache-control':'no-store'});res.end(b)}
function readBody(req){return new Promise(r=>{let d='';req.on('data',c=>{d+=c;if(d.length>4e6)req.destroy()});req.on('end',()=>{try{r(d?JSON.parse(d):{})}catch(e){r({__bad:1})}})})}
function page(){let h=fs.readFileSync(path.join(DIR,'arena.html'),'utf8');const inj='<script>window.ARENA_BRIDGE=location.origin</script><script src="/bridge.js"></script>';return h.includes('</body>')?h.replace('</body>',inj+'</body>'):h+inj}

http.createServer(async(req,res)=>{const u=new URL(req.url,'http://x');
 if(req.method=='OPTIONS')return send(res,204,'');
 if(u.pathname=='/'||u.pathname=='/index.html')return send(res,200,page(),'text/html; charset=utf-8');
 if(u.pathname=='/bridge.js')return send(res,200,fs.readFileSync(path.join(DIR,'bridge.js'),'utf8'),'text/javascript; charset=utf-8');
 if(u.pathname=='/bridge/poll'&&req.method=='POST'){const b=await readBody(req);return onPoll(req,res,b)}
 if(u.pathname=='/bridge/reply'&&req.method=='POST'){const b=await readBody(req);lastPoll=Date.now();for(const r of b.replies||[]){const w=waiters.get(r.rid);if(w){clearTimeout(w.t);waiters.delete(r.rid);w.resolve(r.res)}}return send(res,200,{ok:true})}
 if(u.pathname=='/skill/manifest.json')return send(res,200,skillManifest());
 if(u.pathname=='/skill/install.ps1')return send(res,200,installPs1(BASE),'text/plain; charset=utf-8');
 if(u.pathname=='/skill/install.sh')return send(res,200,installSh(BASE),'text/x-shellscript; charset=utf-8');
 if(u.pathname.startsWith('/skill/file/')){const rel=decodeURIComponent(u.pathname.slice(12));if(!skillFiles().includes(rel))return send(res,404,{error:'没有这个文件'});return send(res,200,fs.readFileSync(path.join(SKILL_DIR,rel),'utf8'),rel.endsWith('.json')?'application/json; charset=utf-8':'text/plain; charset=utf-8')}
 if(u.pathname=='/status')return send(res,200,{page:Date.now()-lastPoll<5000,...pageState,seats:SEATS.map(s=>({...s,...(pageState.seats[s.seat]||{})}))});
 const m=u.pathname.match(/^\/mcp\/([\w-]+)\/?$/);
 if(m){const seat=byToken[m[1]];
  if(!originOk(req))return send(res,403,{jsonrpc:'2.0',error:{code:-32600,message:'Origin 不被允许（可用环境变量 ARENA_ALLOW_ORIGINS 放行）'}});
  if(!seat)return send(res,404,{error:'座位令牌不对'});
  if(req.method=='GET')return send(res,405,{error:'本服务器不提供 SSE 流，请用 POST'});
  if(req.method=='DELETE')return send(res,200,{});
  const body=await readBody(req);if(body.__bad)return send(res,400,{jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});
  // 新版请求（_meta 里带协议版本）走无状态路径
  if(isModern(body)){const[st,out]=await rpcModern(seat,body,req);if(!out){res.writeHead(202,{'access-control-allow-origin':'*'});return res.end()}return send(res,st,out)}
  // 带了新版请求头却没 _meta：按规范这是头和体不一致
  const hv=hdr(req,'mcp-protocol-version');
  if(hv&&MODERN.includes(hv)&&!Array.isArray(body)&&body.id!=null)return send(res,400,{jsonrpc:'2.0',id:body.id,error:{code:-32020,message:'Header mismatch: MCP-Protocol-Version 是 '+hv+'，但请求体 _meta 里没有 io.modelcontextprotocol/protocolVersion'}});
  const out=Array.isArray(body)?(await Promise.all(body.map(x=>rpc(seat,x)))).filter(Boolean):await rpc(seat,body);
  if(!out||(Array.isArray(out)&&!out.length)){res.writeHead(202,{'access-control-allow-origin':'*'});return res.end()}
  if(body.method=='initialize')res.setHeader('Mcp-Session-Id',crypto.randomUUID());
  return send(res,200,out)}
 send(res,404,{error:'not found'})}).listen(PORT,HOST,()=>{
 console.log('\n像素竞技场 MCP 服务器已启动');console.log('1) 浏览器打开 '+BASE+' ，保持标签页在前台');console.log('2) 每个模型用一个座位地址接入（Streamable HTTP）：');
 SEATS.forEach(s=>console.log('   '+(s.seat+1)+' 号位  '+BASE+'/mcp/'+s.token));console.log('3) 都接好后，在页面上点「开战」。未接入的座位由引擎模拟。\n')});
