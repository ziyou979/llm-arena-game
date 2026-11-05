// 无头测试：系统通知是否送到模型、日志是否按收件人过滤、叫醒原因/收件箱确认制（不需要启动服务器）
// 用法：node test/notify_test.js
const fs=require('fs'),path=require('path');const R=path.join(__dirname,'..')+'/';
const html=fs.readFileSync(R+'arena.html','utf8');
const sprites=html.match(/<script[^>]*id="spritesJSON"[^>]*>([\s\S]*?)<\/script>/)[1];
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
function stub(){const f=function(){return stub()};return new Proxy(f,{get(t,k){if(k===Symbol.toPrimitive)return()=>0;if(k==='then')return undefined;if(k==='length')return 0;if(['width','height','clientWidth','clientHeight','offsetWidth'].includes(k))return 100;return stub()},set(){return true}})}
global.document={getElementById:id=>id=='spritesJSON'?{textContent:sprites}:stub(),createElement:()=>stub(),querySelectorAll:()=>[],querySelector:()=>stub(),addEventListener(){},body:stub()};
global.window=global;global.addEventListener=()=>{};global.requestAnimationFrame=()=>0;global.innerWidth=400;global.innerHeight=800;global.devicePixelRatio=1;global.localStorage={getItem:()=>null,setItem(){}};global.matchMedia=()=>({matches:false,addEventListener(){}});global.Image=function(){return stub()};
global.fetch=()=>new Promise(()=>{});window.ARENA_BRIDGE='http://x';window.ARENA_BRIDGE_KEY='';const _si=setInterval;global.setInterval=()=>0;
const code=scripts.join('\n')+'\n'+fs.readFileSync(R+'bridge.js','utf8').replace(/pump\(\);\n\}\)\(\);\s*$/,'pump();window.__bridge={OPS,obs,endTurn,deliver,report};})();')
 +'\n;globalThis.__T={na:(...x)=>notifyAgent(...x),st:()=>started,agents:()=>agents,go:()=>go(),plots:()=>plots,plotAttacked,tryThink,killAgent,step:d=>step(d),logs:()=>logs,mons:()=>mons,setBounty:()=>{},answerPact,...window.__bridge};';
(0,eval)(code);
const T=__T;let fail=0;const ok=(c,n,x)=>{console.log((c?'✓ ':'✗ ')+n+(x!==undefined?'  '+JSON.stringify(x):''));if(!c)fail++};
[0,2,3,5].forEach((s,k)=>addSim(s,s,''));T.OPS.join(null,{seat:1,name:'ExtA'});T.OPS.join(null,{seat:4,name:'ExtB'});T.go();
const ag=T.agents();const a=ag.find(x=>x.seat==1),b=ag.find(x=>x.seat==4);ok(T.st()&&a.ext&&b.ext,'开局，两名 MCP 选手就位');
const npc=(x,type)=>T.obs(x).inbox.filter(m=>m.channel=='npc'&&(!type||m.type==type));
const clear=x=>{x.inbox=[];x.inboxPending=null;x.events=[];x.shownEvents=null;x.turnEvents=null};

// 1 收件箱确认制
clear(b);b.thinking=true;b.turnEvents=[];
T.deliver(b,a,'msg1',{channel:'direct',toYou:true});
ok(T.obs(b).inbox.some(m=>m.text=='msg1'),'消息第一次观察可见');
ok(T.obs(b).inbox.some(m=>m.text=='msg1'),'未确认前再次观察仍可见');
T.deliver(b,a,'msg2',{channel:'direct',toYou:true});T.endTurn(b);
const ib=T.obs(b).inbox.map(m=>m.text);ok(!ib.includes('msg1')&&ib.includes('msg2'),'endTurn 只确认已展示的消息',ib);

// 2 叫醒原因：展示过的清掉，没展示过的保留
clear(b);b.thinking=false;b.lastTurnEnd=null;b.plan=[];b.events=['开局'];T.tryThink(b);
b.events.push('被攻击');T.obs(b);b.events.push('领地失守');T.endTurn(b);
ok(JSON.stringify(b.events)=='["领地失守"]','endTurn 清掉已展示的叫醒原因、保留之后才到的',b.events);
clear(b);b.thinking=false;b.events=['计划完成'];T.obs(b);T.endTurn(b);
ok(b.events.length==0,'不在思考中调 act 也能清掉已展示的原因',b.events);

// 3 阵亡通知：死后也送到
clear(b);clear(a);b.dead=0;b.hp=10;T.killAgent(b,a);
const dn=npc(b,'阵亡');ok(dn.length==1&&dn[0].text.includes(a.name),'阵亡通知送到（含击杀者）',dn.map(m=>m.text));
const rlA=T.obs(a).recentLog,rlB=T.obs(b).recentLog;
ok(rlA.some(t=>t.includes('击杀 '+b.name)),'击杀日志给击杀者');ok(rlB.some(t=>t.includes('击杀 '+b.name)),'击杀日志给被杀者');
const c=ag.find(x=>x!=a&&x!=b);ok(!T.obs(a).recentLog.some(t=>t.includes(c.name+' 击杀')),'无关的人看不到');
b.dead=0;b.hp=b.maxhp;

// 4 领地被攻：领主不在附近、守卫全员死守 → 领主不该知道
clear(b);const p=T.plots().find(p=>Math.hypot(p.cx-b.x,p.cy-b.y)>120);p.owner=b.id;p.alT=0;b.msgPol=false;
T.plotAttacked(p,a);
ok(!T.logs().some(l=>(l.recipients||[]).includes(b.id)&&l.txt.includes('不派人报信')),'「不派人报信」不发给领主');
ok(npc(b).length==0&&!b.events.includes('看到领地被攻'),'领主看不到也没收到通知',b.events);
// 领主就在旁边 → 应该收到
clear(b);const p2=T.plots().find(p=>Math.hypot(p.cx-b.x,p.cy-b.y)<20)||T.plots()[0];if(Math.hypot(p2.cx-b.x,p2.cy-b.y)>=20){b.x=p2.cx;b.y=p2.cy}p2.owner=b.id;p2.alT=0;
T.plotAttacked(p2,a);ok(npc(b,'看到领地被攻').length==1,'领主在附近：收到「看到领地被攻」含正文',npc(b).map(m=>m.text));

// 5 领地被占：旧领主收到含占领者和领地 id 的通知
clear(b);p2.owner=b.id;
const before=T.logs().length;
// 直接走占领逻辑：模拟完成占领
(()=>{const old=p2.owner;p2.owner=a.id;T.na(ag[old],'领地失守','#'+a.id+' '+a.name+' 占领了你的'+p2.name+'（领地 '+p2.id+'）',{plotId:p2.id})})();
const lost=npc(b,'领地失守');ok(lost.length==1&&lost[0].plotId==p2.id,'领地失守通知带 plotId',lost);

// 6 结盟：模拟角色拒绝 → MCP 发起者收到；超时过期 → 发起者收到
clear(a);const sim=ag.find(x=>!x.ext);
let tries=0;while(tries++<200){sim.allies.delete(a.id);a.allies.delete(sim.id);const r0=Math.random;Math.random=()=>0.999;try{T.answerPact(sim,a)}finally{Math.random=r0}if(!sim.allies.has(a.id))break}
ok(npc(a,'结盟被拒').length>=1,'模拟角色拒绝结盟，MCP 发起者收到通知',npc(a).map(m=>m.text));
clear(a);clear(b);b.allies.delete(a.id);a.allies.delete(b.id);T.answerPact(b,a);ok(!!b.pactOffer,'MCP 选手收到结盟请求');
const t0=b.pactOffer.t;for(let i=0;i<620;i++)T.step(.1);
ok(!b.pactOffer,'60 秒后请求自动过期（不依赖被请求方观察）');ok(npc(a,'结盟请求过期').length==1,'发起者收到过期通知',npc(a).map(m=>m.text));

// 7 整局跑一遍：没有异常；日志里「观众视角」不发给任何人；模型收到的叫醒原因都有正文或观察字段可查
clear(a);clear(b);a.thinking=b.thinking=false;
const seenEv={},npcTypes={};const covered={'开局':1,'计划完成':1,'发现新对手':1,'升级加点':1,'世界事件':1,'空投出现':1,'毒圈收缩':1,'城区复活':1,'在毒圈外掉血':1,'血量危险':1,'残血撤退':1,'目标领地在圈外':1,'公告板新委托':1,'被攻击':1};
let err=null;try{for(let i=0;i<6000;i++){T.step(.1);for(const x of [a,b]){for(const e of x.events)seenEv[e]=1;if(x.thinking&&Math.random()<.05){for(const m of T.obs(x).inbox)if(m.channel=='npc')npcTypes[m.type]=1;T.endTurn(x)}}}}catch(e){err=e}
ok(!err,'跑 600 秒没有异常',err&&String(err.stack).slice(0,300));
ok(!T.logs().some(l=>l.txt.includes('观众视角')&&(l.recipients||[]).length),'「观众视角」日志不发给选手');
const miss=Object.keys(seenEv).filter(e=>!covered[e]&&!npcTypes[e]&&!/^当面结盟请求|^有人对你说话|^盟友密语/.test(e));
ok(miss.length==0,'每个叫醒原因都有正文（npc 消息）或观察字段',{events:Object.keys(seenEv),npc:Object.keys(npcTypes),miss});
console.log(fail?('\n失败 '+fail+' 项'):'\n全部通过');process.exit(fail?1:0);
