// 测试用假选手：通过 MCP 接口按简单规则打一局，用来确认服务器和页面通了。
// 用法：node bot.js http://localhost:8787/mcp/<座位令牌> [显示名]
const URL_=process.argv[2],NAME=process.argv[3]||'TestBot';if(!URL_){console.log('用法：node bot.js <座位地址> [显示名]');process.exit(1)}
let id=0,sid=null;
async function rpc(method,params){const h={'content-type':'application/json',accept:'application/json, text/event-stream'};if(sid)h['mcp-session-id']=sid;
 const r=await fetch(URL_,{method:'POST',headers:h,body:JSON.stringify({jsonrpc:'2.0',id:++id,method,params})});if(r.headers.get('mcp-session-id'))sid=r.headers.get('mcp-session-id');
 const j=await r.json();if(j.error)throw new Error(j.error.message);return j.result}
async function tool(name,args){const r=await rpc('tools/call',{name,arguments:args||{}});const t=r.content[0].text;if(r.isError)throw new Error(t);try{return JSON.parse(t)}catch(e){return t}}
(async()=>{await rpc('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'arena-bot',version:'0'}});
 await fetch(URL_,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})});
 const tl=await rpc('tools/list',{});console.log('工具：',tl.tools.map(t=>t.name).join(', '));
 for(;;){try{console.log(await tool('join',{name:NAME}));break}catch(e){console.log('join:',e.message);await new Promise(r=>setTimeout(r,2000))}}
 try{console.log(await tool('setup_character',{stats:[7,5,7,2,3,6],weapon:'sword'}))}catch(e){console.log('setup:',e.message)}
 let turns=0;
 for(;;){let o;try{o=await tool('wait_for_event',{timeout_seconds:20})}catch(e){console.log('wait:',e.message);await new Promise(r=>setTimeout(r,2000));continue}
  if(o.over){console.log('比赛结束，得分',o.me.score);break}
  if(!o.started||!o.ready)continue;turns++;
  const me=o.me;
  if(me.unspentPoints)await tool('allocate_points',{str:me.unspentPoints,reason:'全力堆力量'});
  if(o.pactOffer){await tool('answer_pact',{accept:true,say:'好，一起干。'});}
  const plan=[];let thought;var LOOP=false;
  const near=(x,y)=>Math.hypot(x-me.x,y-me.y);
  const ch=o.chests.sort((a,b)=>near(a.x,a.y)-near(b.x,b.y))[0];
  const sos=o.merchants.find(m=>m.calling4help);
  const foe=o.visibleAgents.find(b=>!b.ally&&!b.inTown);
  if(o.zone.outside&&o.time>o.zone.shrinkStart-20){plan.push({type:'zone'});thought='毒圈要来了，先进圈。'}
  else if(me.hp<me.maxhp*.4){plan.push({type:'town',npc:'inn'});thought='血太少，回城住店。'}
  else if(foe&&!me.allies.length&&o.time>60){plan.push({type:'pact',id:foe.id});thought='看到 '+foe.name+'，先试试结盟。'}
  else if(ch&&near(ch.x,ch.y)<70){plan.push({type:'loot',id:ch.id});thought='空投就在附近，去抢。'}
  else if(sos&&near(sos.x,sos.y)<40){plan.push({type:'rescue',id:sos.id});thought=sos.name+' 在呼救，去救。'}
  else{const myP=o.plots.find(p=>p.id===me.plotHere);
   if(me.lvl>=3&&myP&&myP.owner!==me.id)plan.push({type:'capture',p:myP.id,bribe:false});
   const lv1=o.plots.filter(p=>p.lv==1).sort((a,b)=>near(a.cx,a.cy)-near(b.cx,b.cy))[0];
   plan.push({type:'hunt',p:(me.lvl<3?lv1:(myP||lv1)).id,n:5});var LOOP=me.lvl<3;
   if(me.gold>60&&!me.items.armor)plan.push({type:'buy',item:'armor'});thought='刷怪升级，有钱就买甲。'}
  try{const r=await tool('act',{plan,loop:typeof LOOP!='undefined'&&LOOP,thought,say:turns==1?'TestBot 上线！':undefined});console.log('['+o.time+'s] 第',turns,'轮',r.plan.join(' → '))}catch(e){console.log('act:',e.message)}}
})().catch(e=>{console.error(e);process.exit(1)});
