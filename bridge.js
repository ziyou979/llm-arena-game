// 像素竞技场 · MCP 桥（页面端）
// 由 server.js 注入到游戏页面。浏览器里的引擎仍是权威；本脚本把外部模型的工具调用翻译成引擎指令。
(function(){
const BASE=window.ARENA_BRIDGE;if(!BASE)return;
const MN=['','史莱姆','哥布林','骷髅','骷髅队长','石像魔'];
const STK=['str','agi','con','int','cha','per'];
const EXT_TIMEOUT=180; // 真实秒（不受倍速影响，暂停时不计）：模型这么久不回应，本轮由引擎代打
// 纯信息事件：手上还有没跑完的计划时不叫醒模型，只排队，等下次被叫醒时一起带上
const LOW_EV=['公告板新委托','世界事件','空投被抢','酒馆情报','公会情报','商人求救','悬赏发布','新盟友'];
const r1=v=>Math.round(v*10)/10;
const EXT_PER={aggr:.5,econ:.5,diplo:.5,treach:0};
let INFO=null;
// ---------- 大厅：座位默认空着，MCP 接入或上帝手动添加模拟角色后才出现 ----------
const SEATS=[0,1,2,3,4,5,6,7].map(i=>({seat:i,kind:'empty',col:MODELS[i].col}));
let seatAgent={};
const DEF_ST=[5,5,5,5,5,5];
function seatModel(S){const base=S.kind=='sim'?MODELS[S.preset]:MODELS[S.seat];
 return Object.assign({},base,{name:S.name,col:S.col,st:(S.st||base.st).slice(),wep:S.wep||base.wep,
  per:S.kind=='ext'?EXT_PER:base.per,lat:S.kind=='ext'?[0,0]:base.lat,role:S.kind=='ext'?'MCP 接入':base.role+'（模拟）',motto:S.kind=='ext'?(S.motto||''):base.motto})}
function seatPreview(S){const a=newAgent(seatModel(S),S.seat);if(S.spec)a.spec=S.spec;composeSprite(a);return a}
window.addSim=function(seat,preset,name){const S=SEATS[seat];if(started||S.kind!='empty')return;preset=+preset;const P=MODELS[preset];
 Object.assign(S,{kind:'sim',preset,name:(name||'').trim()||P.name,st:P.st.slice(),wep:P.wep,spec:SPRITES[preset]});lobby()};
window.removeSeat=function(seat){const S=SEATS[seat];if(started||S.kind=='empty')return;SEATS[seat]={seat,kind:'empty',col:S.col};lobby()};
let LOBBY_SIG='';
const WEP_CN={sword:'剑',staff:'法杖',bow:'弓',dagger:'匕首'};
const escH=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
window.copySeat=function(btn){const t=btn.getAttribute('data-addr');const done=()=>{btn.textContent='已复制';btn.classList.add('done');setTimeout(()=>{btn.textContent='复制';btn.classList.remove('done')},1400)};
 if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(done,()=>{});else{const r=document.createRange();r.selectNodeContents(btn.previousElementSibling);const s=getSelection();s.removeAllRanges();s.addRange(r)}};
function lobby(force){if(started)return;const el=document.getElementById('introBody');if(!el||!el.style&&el.innerHTML===undefined)return;
 const cards=document.getElementById('cards');if(cards&&cards.style)cards.style.display='none';
 const sig=JSON.stringify([INFO&&INFO.base,SEATS.map(S=>[S.kind,S.name,S.st,S.wep,S.setup,S.spriteOk,S.preset,S.motto])]);
 if(!force&&sig==LOBBY_SIG&&el.querySelector('.seat'))return;LOBBY_SIG=sig;   // 状态没变就不重绘，免得冲掉正在输入的名字
 const n=SEATS.filter(x=>x.kind!='empty').length,ext=SEATS.filter(x=>x.kind=='ext').length;
 let h='<div class="lobby-head"><p>模型用 MCP 接入后会出现在自己的座位上，带着它选的名字、武器和 30 点属性。空座位可以手动放一个模拟角色。开战时还空着的座位不参加这一局。</p><div class="lobby-count"><b>'+n+'</b><span>/ 8 就位</span><small>'+ext+' 个模型 · '+(n-ext)+' 个模拟</small></div></div><div class="seats">';
 for(const S of SEATS){const addr=INFO?INFO.base+'/mcp/'+INFO.seats[S.seat].token:'';const no='<span class="seat-no">'+(S.seat+1)+'</span>';
  if(S.kind=='empty'){h+='<section class="seat empty" style="--seat:'+S.col+'"><header>'+no+'<span class="chip">空座</span></header>'+
   '<div class="slot" aria-hidden="true"></div>'+
   '<div class="addr">'+(addr?'<code title="'+escH(addr)+'">/mcp/'+escH(INFO.seats[S.seat].token)+'</code><button class="ghost sm" data-addr="'+escH(addr)+'" onclick="copySeat(this)">复制</button>':'<span class="warn">服务器没连上，先运行 node server.js</span>')+'</div>'+
   '<div class="sim"><select id="pre'+S.seat+'" aria-label="模拟角色人设">'+MODELS.map((m,i)=>'<option value="'+i+'"'+(i==S.seat?' selected':'')+'>'+m.role+' · '+WEP_CN[m.wep]+'</option>').join('')+'</select>'+
   '<input id="nm'+S.seat+'" placeholder="名字（可空）" aria-label="模拟角色名字" maxlength="24">'+
   '<button class="secondary" onclick="addSim('+S.seat+',document.getElementById(\'pre'+S.seat+'\').value,document.getElementById(\'nm'+S.seat+'\').value)">放入模拟角色</button></div></section>'}
  else{const st=S.st||DEF_ST,wep=S.wep||MODELS[S.seat].wep,isExt=S.kind=='ext';
   const status=isExt?'<span class="chip live">MCP 已接入</span>':'<span class="chip">模拟</span>';
   const sub=isExt?(!S.setup?'<p class="note warn">等它提交属性和武器，没交就按各 5 点算</p>':S.spriteOk?'':'<p class="note">没交形象，先用默认形象</p>'):'<p class="note">'+escH(MODELS[S.preset].role)+' 人设，由规则 AI 操作</p>';
   h+='<section class="seat filled" style="--seat:'+S.col+'"><header>'+no+status+'</header>'+
   '<div class="who"><canvas data-seat="'+S.seat+'" width="34" height="34" aria-label="'+escH(S.name)+' 的形象"></canvas><div><h3>'+escH(S.name)+'</h3><span class="wep">'+(isExt&&!S.setup?'还没选武器':WEP_CN[wep])+'</span></div></div>'+
   '<dl class="statbars">'+SN.map((k,i)=>'<div><dt>'+k[0]+'</dt><dd><i style="width:'+(st[i]*10)+'%"></i></dd><span>'+st[i]+'</span></div>').join('')+'</dl>'+sub+
   '<button class="ghost danger sm kick" onclick="removeSeat('+S.seat+')">'+(isExt?'踢出':'移除')+'</button></section>'}}
 el.innerHTML=h+'</div>';
 try{for(const c of el.querySelectorAll('canvas[data-seat]')){const S=SEATS[+c.dataset.seat];portraitTo(c,seatPreview(S))}}catch(e){}
 const g=document.getElementById('bGo');if(g){g.textContent=n>=2?'开战 · '+n+' 名选手':'还差 '+(2-n)+' 名选手才能开战';g.disabled=n<2;g.className='primary'}}
const _intro=showIntro;showIntro=function(){seatAgent={};_intro();lobby()};
const _go=go;
function goBridge(){if(started)return;const filled=SEATS.filter(x=>x.kind!='empty');if(filled.length<2)return;
 seatAgent={};SEAT_N=filled.length;agents=filled.map((S,j)=>{const a=newAgent(seatModel(S),j);if(S.spec)a.spec=S.spec;a.st=seatModel(S).st;a.maxhp=maxHp(a);a.hp=a.maxhp;composeSprite(a);a.seat=S.seat;a.ext=S.kind=='ext';if(a.ext&&S.habits)try{setHabits(a,S.habits)}catch(e){}seatAgent[S.seat]=a;
  Object.assign(a,{aliveT:0,idleT2:0,waitT:0,bad:0,lat:[]});return a});
 selId=0;const cards=document.getElementById('cards');if(cards&&cards.style)cards.style.display='';buildCards();try{fillSlots()}catch(e){}
 _go();log('c-world','📣 参赛：'+agents.map(a=>a.name+(a.ext?'（MCP）':'（模拟）')).join('、'))}
go=goBridge;try{document.getElementById('bGo').onclick=goBridge}catch(e){}


// ---------- 接管引擎的思考环节 ----------
const _try=tryThink,_fin=finishThink,_ans=answerPact;
tryThink=function(a){if(!a.ext)return _try(a);
 if(a.thinking||!a.events.length||a.dead)return;if(a.lastTurnEnd!=null&&time-a.lastTurnEnd<2)return;
 if(a.plan[a.pi]&&a.events.every(e=>LOW_EV.includes(e)))return;
 a.thinking=true;a.thinkDur=0;a.thinkLeft=EXT_TIMEOUT;a.realThink=0;a.turnStart=time;a.turnWall=Date.now();a.turnEvents=a.events.slice();a.turnId=(a.turnId||0)+1;
 log('c-think','🧠 '+a.name+' 被唤醒（'+a.events.join('、')+'），等模型回应…')};
// 超时处理：默认不代打，角色保持原计划（计划跑完就原地闲逛），这样能看出是模型的问题。设置里可以改回引擎代打
let TAKEOVER=false;
finishThink=function(a){if(!a.ext)return _fin(a);
 a.timeouts=(a.timeouts||0)+1;a.lastTurnEnd=time;
 if(!TAKEOVER){a.thinking=false;removeEvents(a,a.turnEvents);a.turnEvents=null;a.timeoutStreak=(a.timeoutStreak||0)+1;
  log('c-think','⌛ '+a.name+' '+EXT_TIMEOUT+' 秒没回应（第 '+a.timeouts+' 次），引擎不接管：'+(a.plan[a.pi]?'继续执行原计划':'原地发呆'));bub(a,'……（没回应）',2);return}
 log('c-think','⌛ '+a.name+' '+EXT_TIMEOUT+' 秒没回应，这一轮由引擎代打');
 const s=a.m;a.m=Object.assign({},s,{per:EXT_PER});_fin(a);a.m=s};
try{const box=document.getElementById('settings'),ok=document.getElementById('bSetOk');if(box&&ok&&box.insertBefore){const l=document.createElement('label');l.innerHTML='<input type="checkbox" id="takeover"> 模型超时由引擎代打（默认关闭：超时就继续原计划或原地发呆，方便看出问题）';box.insertBefore(l,ok.parentNode&&ok.parentNode!==box?ok.parentNode:ok);const c=document.getElementById('takeover');if(c)c.onchange=()=>{TAKEOVER=!!c.checked}}}catch(e){}
answerPact=function(a,from){if(!a.ext)return _ans(a,from);if(a.allies.has(from.id)||from.dead)return;
 a.pactOffer={from:from.id,t:time};a.pactExpired=null;a.stop=Math.max(a.stop,2);bub(a,'让我想想……',1);
 log('c-pact','🤔 '+a.name+' 在考虑 '+from.name+' 的当面结盟请求');wake(a,'当面结盟请求：'+from.name)};

function acceptPact(a,from){a.allies.add(from.id);from.allies.add(a.id);a.known.add(from.id);from.known.add(a.id);
 log('c-pact','🤝 '+a.name+' 当场接受了 '+from.name+' 的结盟（共享视野）');banner2('🤝 '+from.name+' × '+a.name+' 结盟');director(a.x,a.y,'结盟',2);wake(from,'新盟友');say(from,a.name+'答应了。')}

// ---------- 观察 ----------
function briefify(o,a){if(!o||!o.plots)return o;const mine=o.plots.filter(p=>p.owner==a.id),free=o.plots.filter(p=>p.owner<0).sort((x,y)=>x.dist-y.dist).slice(0,4),foe=o.plots.filter(p=>p.owner>=0&&p.owner!=a.id).sort((x,y)=>x.dist-y.dist).slice(0,3);
 const r=Object.assign({},o,{brief:true,plots:mine.concat(free,foe),visibleMonsters:(o.visibleMonsters||[]).slice(0,8),recentLog:(o.recentLog||[]).slice(0,4),quests:(o.quests||[]).slice(0,3)});delete r.prices;
 r.lastSeen=(o.lastSeen||[]).slice(0,6);return r}
function lobbyObs(seat){const S=SEATS[seat];return{started:false,over:false,lobby:true,me:{seat,name:S.name,joined:S.kind=='ext',stats:S.st,weapon:S.wep,setupDone:!!S.setup,spriteOk:!!S.spriteOk,teamColor:S.col},
 seats:SEATS.map(x=>({seat:x.seat,kind:x.kind,name:x.name||null})),hint:'等上帝点「开战」。可以先 setup_character 提交 30 点属性、武器和形象（队伍色用 T/t/U，引擎自动换成 teamColor）'}}
function seatOf(i){const a=seatAgent[i];if(!a)throw new Error(started?'你的座位没有参加这一局（开战时还没接入），等下一局':'比赛还没开始');return a}
// 收件箱两段式消费：构造观察时先把消息挪进 inboxPending，模型 act 结束本轮才算确认；
// 期间任何一次观察都会重新带上未确认消息，回包丢失不再等于消息丢失
let msgSeq=0;
function takeInbox(a){const fresh=(a.inbox||[]).splice(0),pend=a.inboxPending||[];
 const seen=new Set(),out=[];for(const m of pend.concat(fresh)){const k=m.mid!=null?m.mid:m.from+'|'+m.text+'|'+m.t;if(seen.has(k))continue;seen.add(k);out.push(m)}
 a.inboxPending=out.length?out.slice(-20):null;return out}
function pushMsg(b,m){m.mid=++msgSeq;(b.inbox=b.inbox||[]).push(m);
 while(b.inbox.length>10){const i=b.inbox.findIndex(x=>x.channel=='public');if(i<0)b.inbox.shift();else b.inbox.splice(i,1)}}
function obs(a){const D=(x,y)=>Math.round(Math.hypot(x-a.x,y-a.y));const REC={1:1,2:3,3:5};const v=vis(a),me=a;
 const vAg=agents.filter(b=>b!=a&&!b.dead&&sees(a,b)).map(b=>({id:b.id,name:b.name,x:r1(b.x),y:r1(b.y),hp:Math.round(b.hp),maxhp:b.maxhp,lvl:b.lvl,weapon:b.m.wep,power:Math.round(power(b)),dist:D(b.x,b.y),ally:a.allies.has(b.id),inTown:inTownE(b),betrayer:b.betrayer}));
 const lastSeen=agents.filter(b=>b!=a&&!vAg.some(x=>x.id==b.id)&&a.lastSeen[b.id]).map(b=>{const s=a.lastSeen[b.id];return{id:b.id,name:b.name,x:r1(s.x),y:r1(s.y),secondsAgo:Math.round(time-s.t)}});
 const vM=mons.map((m,i)=>({m,i})).filter(o=>!o.m.dead&&!o.m.gone&&dist(a,o.m)<=v).sort((p,q)=>dist(a,p.m)-dist(a,q.m)).slice(0,15)
  .map(({m,i})=>({id:i,name:m.hire?'守卫':MN[m.lv],lv:m.lv,x:r1(m.x),y:r1(m.y),hp:Math.round(m.hp),guardOfPlot:m.guard>=0?m.guard:undefined,owner:m.hire?m.owner:undefined}));
  const vMer=MER.filter(n=>!n.dead&&(dist(a,n)<=v+2||n.sos>0)).map(n=>({id:n.id,name:n.name,x:r1(n.x),y:r1(n.y),dist:D(n.x,n.y),sells:n.spec,calling4help:n.sos>0,stall:!!n.stalled}));
 return{started,over,time:Math.round(time),remaining:Math.round(MATCH-time),
  me:{id:a.id,name:a.name,x:r1(a.x),y:r1(a.y),hp:Math.round(a.hp),maxhp:a.maxhp,lvl:a.lvl,xp:a.xp,xpNext:30*a.lvl,gold:a.gold,
   stats:Object.fromEntries(STK.map((k,i)=>[k,a.st[i]])),unspentPoints:a.pts||0,weapon:a.m.wep,weaponTier:a.wt,items:a.items,skills:Object.keys(a.skills),
   dead:a.dead?Math.ceil(a.dead):0,inTown:inTownE(a),inBush:inBush(a),plotHere:(plotAt(a.x,a.y)||{}).id,vision:r1(v),allies:[...a.allies],betrayer:a.betrayer,
   plan:a.plan.map(cmdNameId),planStep:a.pi,planLoop:!!a.loopSrc,idle:!a.plan[a.pi],power:Math.round(power(a)),score:score(a),
   alerts:a.alert?Object.keys(a.alert).map(k=>({plot:+k,secondsAgo:Math.round(time-a.alert[k])})).filter(x=>x.secondsAgo<=60):[]},
  pendingEvents:a.events.slice(),pactOffer:a.pactOffer&&time-a.pactOffer.t<60?{from:a.pactOffer.from,name:agents[a.pactOffer.from].name,secondsLeft:Math.round(60-(time-a.pactOffer.t))}:null,
  pactExpired:(()=>{if(a.pactOffer&&time-a.pactOffer.t>=60){a.pactExpired={from:a.pactOffer.from,name:agents[a.pactOffer.from].name};a.pactOffer=null;log('c-pact','⌛ '+a.name+' 没在 60 秒内回复 '+a.pactExpired.name+' 的结盟请求，已过期')}const e=a.pactExpired;a.pactExpired=null;return e})(),
  inbox:takeInbox(a),
  zone:(()=>{const dc=Math.hypot(a.x-zone.cx,a.y-zone.cy),edge=zone.r-dc,rate=time>=zone.t0&&time<zone.t1?(zone.r0-zone.r1)/(zone.t1-zone.t0):0,dps=Math.round(a.maxhp*.04+2),sp=spd(a);
   return{cx:r1(zone.cx),cy:r1(zone.cy),r:r1(zone.r),finalR:zone.r1,shrinkStart:zone.t0,shrinkEnd:zone.t1,shrinkPerSec:+rate.toFixed(2),outside:outZone(a,0),distToCenter:Math.round(dc),distToEdge:Math.round(edge),
    secondsUntilOutside:edge>0?(time<zone.t0?Math.round(zone.t0-time+edge/((zone.r0-zone.r1)/(zone.t1-zone.t0))):rate>0?Math.round(edge/rate):null):0,dps,secondsToDieOutside:Math.floor(a.hp/dps),secondsToSafety:edge<0?Math.ceil(-edge/sp):0,mySpeed:+sp.toFixed(2)}})(),
  worldEvent:event?{name:event.n,desc:event.d,secondsLeft:Math.round(event.t)}:null,bountyOn:bounty>=0?agents[bounty].name:null,
  visibleAgents:vAg,lastSeen,visibleMonsters:vM,merchants:vMer,
  chests:chests.filter(c=>!c.opened).map(c=>({id:c.id,x:c.x,y:c.y,dist:D(c.x,c.y)})),
  plots:plots.map(p=>({id:p.id,name:p.name,lv:p.lv,dist:D(p.cx,p.cy),travelSec:Math.round(D(p.cx,p.cy)/spd(a)),owner:p.owner,ownerName:p.owner>=0?agents[p.owner].name:null,cx:r1(p.cx),cy:r1(p.cy),unguardedLeft:p.owner==a.id&&!hires(p).length&&!raidMons(p).length?Math.max(0,Math.round(RAID_IDLE-(p.idle||0))):null,raidLeft:p.owner==a.id&&raidMons(p).length?Math.max(0,Math.round(RAID_TAKE-(p.raidT||0))):null,guardsLeft:p.owner==a.id&&raidMons(p).length?plotGuards(p).length:null,myGuards:p.owner==a.id?hires(p).length:undefined})),
  quests:QUESTS.filter(q=>!q.done&&time<q.until).map(q=>({id:q.id,target:LAIRS[q.lair].name,plot:LAIRS[q.lair].plot,x:LAIRS[q.lair].x,y:LAIRS[q.lair].y,reward:q.reward,dist:D(LAIRS[q.lair].x,LAIRS[q.lair].y),secondsLeft:Math.round(q.until-time)})),
  prices:{potion:price(a,'potion'),weapon:price(a,'weapon'),armor:price(a,'armor'),helmet:price(a,'helmet'),
   skills:Object.fromEntries(Object.entries(SKILLS).map(([k,s])=>[k,price(a,'',s.p)])),guard:GCOST,bribeGuard:bribeCost(a),
   town:{tavern:SVC.tavern.p,smith_repair:30,smith_upgrade:price(a,'',90),inn:SVC.inn.p,temple:SVC.temple.p,guild:SVC.guild.p}},
  recentLog:logs.filter(l=>(l.recipients||[]).includes(a.id)&&l.cls!='c-think'&&l.cls!='c-see'&&l.cls!='c-talk').slice(0,8).map(l=>l.txt),
  scoreboard:agents.map(b=>({id:b.id,name:b.name,plots:plots.filter(p=>p.owner==b.id).length,kills:b.kills}))}}

// 给模型看的指令名：领地用数字 id（游戏画面仍用字母）
const cmdNameId=c=>String(cmdName(c)).replace(/领地([A-X])/g,(_,x)=>'领地'+(x.charCodeAt(0)-65));
// ---------- 指令 ----------
const PLOT=v=>{if(!plots[v])throw new Error('p 必须是领地 id 0-'+(plots.length-1));return v};
function conv(a,c){const t=c.type;switch(t){
 case'hunt':return{t,p:PLOT(c.p),n:Math.max(1,Math.min(10,c.n|0||4))};
 case'capture':{const o={t,p:PLOT(c.p)};if(typeof c.bribe=='boolean')o.bribe=c.bribe;return o}
 case'defend':case'scout':return{t,p:PLOT(c.p)};
 case'recruit':{if(typeof c.messenger=='boolean')a.msgPol=c.messenger;return{t,p:PLOT(c.p),n:Math.max(1,Math.min(GCAP,c.n|0||2))}}
 case'buy':if(!ITEMS[c.item])throw new Error('item 只能是 potion/weapon/armor/helmet');return{t,item:c.item,mid:MER[c.merchant]?c.merchant:null};
 case'learn':if(!SKILLS[c.skill])throw new Error('skill 只能是 fireball/charge/heal');return{t,sk:c.skill};
 case'town':if(!SVC[c.npc])throw new Error('npc 只能是 tavern/smith/inn/temple/guild');return{t,k:c.npc,up:!!c.upgrade};
 case'quest':if(!QUESTS[c.id])throw new Error('没有这个委托 id');return{t,q:c.id};
 case'rescue':if(!MER[c.id])throw new Error('没有这个商人 id');return{t,id:c.id};
 case'loot':if(!chests[c.id])throw new Error('没有这个空投 id');return{t,id:c.id};
 case'attack':case'betray':case'pact':if(!agents[c.id]||c.id==a.id)throw new Error('id 必须是其他选手的 id');return{t,id:c.id};
 case'zone':case'ambush':return{t};
 default:throw new Error('未知指令 '+t)}}

// 结束本轮决策（不改计划）；只清掉本轮开始时快照的事件，思考期间新到的事件保留给下一轮
function removeEvents(a,evs){if(!evs||!evs.length)return;for(const e of evs){const i=a.events.indexOf(e);if(i>=0)a.events.splice(i,1)}}
function endTurn(a){a.timeoutStreak=0;const wall=a.thinking&&a.turnWall?((Date.now()-a.turnWall)/1000):0;if(wall)(a.lat=a.lat||[]).push(wall);
 if(a.thinking){a.thinking=false;a.decisions++;a.thinkTimes.push(Math.max(.1,time-a.turnStart))}
 removeEvents(a,a.turnEvents);a.turnEvents=null;a.inboxPending=null;a.lastTurnEnd=time;return wall}
// 加点/回结盟/回话之后，如果计划还在跑、叫醒原因也都处理完了，就自动结束这一轮，免得模型以为还要 act
function autoEnd(a,pref){if(!a.thinking||!a.plan[a.pi])return false;if(!a.events.every(e=>LOW_EV.includes(e)||pref.some(p=>String(e).startsWith(p))))return false;endTurn(a);return true}
function setPlan(a,plan,thought,line,loop){const p=[],errs=[];(plan||[]).slice(0,5).forEach((c,i)=>{try{p.push(conv(a,c||{}))}catch(e){errs.push('第 '+(i+1)+' 条（'+(c&&c.type)+'）：'+e.message)}});
 if(errs.length)a.bad=(a.bad||0)+errs.length;
 const wall=endTurn(a);
 if(p.length||!errs.length){a.plan=p;a.pi=0;a.cmdT=0;a.path=[];a.loopSrc=loop&&p.length?JSON.stringify(p):null}
 if(thought){say(a,String(thought).slice(0,120));log('c-think','💭 '+a.name+'：'+String(thought).slice(0,120))}
 if(line)talk(a,line);
 log('c-think','🧠 '+a.name+' 提交计划'+(wall?'（用时 '+wall.toFixed(1)+'s）':'')+'：'+(p.length?p.map(cmdName).join(' → ')+(a.loopSrc?'（循环）':''):'原地待命')+(errs.length?' · '+errs.length+' 条无效':''));
 return{ok:!errs.length,plan:a.plan.map(cmdNameId),loop:!!a.loopSrc,errors:errs.length?errs:undefined,note:errs.length&&!p.length?'全部无效，保留原计划':undefined}}

function setHabits(a,h){if(typeof h!='object'||Array.isArray(h))throw new Error('habits 要是对象，例如 {"potion_at":0.35,"flee_at":0.2,"fight_back":true}');const H=habOf(a);
 const num=(v,k)=>{v=+v;if(!(v>=0&&v<=0.9))throw new Error(k+' 要在 0 到 0.9 之间（血量比例，0=关闭）');return +v.toFixed(2)};
 if(h.potion_at!=null)H.potion=num(h.potion_at,'potion_at');if(h.flee_at!=null)H.flee=num(h.flee_at,'flee_at');if(h.fight_back!=null)H.fightBack=!!h.fight_back;
 log('c-think','⚙ '+a.name+' 设定习惯：喝药/治疗 '+(H.potion?'<'+Math.round(H.potion*100)+'%':'关')+'，撤退 '+(H.flee?'<'+Math.round(H.flee*100)+'%':'关')+'，被打还手 '+(H.fightBack?'开':'关'));return{potion_at:H.potion,flee_at:H.flee,fight_back:H.fightBack}}
function talk(a,text){text=String(text||'').slice(0,60);if(!text)return;bub(a,text,.2);log('c-talk','💬 '+a.name+'：'+text)}
// 任何选手头顶冒出的话（包括模拟角色），视野内的 MCP 选手都会收到
const _bub=bub;bub=function(e,txt,d){_bub(e,txt,d);if(!started||!e||!e.st||agents.indexOf(e)<0||!txt)return;
  for(const b of agents)if(b!=e&&b.ext&&!b.dead&&seeOne(b,e)){if(b.id===_directSkip)continue;pushMsg(b,{from:e.id,name:e.name,channel:'public',text:String(txt),t:Math.round(time)});if(e.ext||String(txt).includes(b.name))wake(b,'有人对你说话：'+e.name)}};
let _directSkip=null;
// 定向消息：直接进对方 inbox 并叫醒（盟友不限距离）
function deliver(b,from,text,ex){if(!b.ext)return;pushMsg(b,Object.assign({from:from.id,name:from.name,channel:'direct',text,t:Math.round(time)},ex||{}));wake(b,(ex&&ex.channel=='ally'?'盟友密语：':'有人对你说话：')+from.name)}
// NPC 定向情报（酒馆/公会/守卫报信等）：引擎调 notifyAgent，这里把正文投进模型收件箱
if(typeof notifyAgent=='function'){const _notify=notifyAgent;notifyAgent=function(a,type,text,details){_notify(a,type,text,details);
  if(!started||!a||!a.ext||a.dead)return;
  pushMsg(a,{from:-1,name:'情报',channel:'npc',type,text:String(text),t:Math.round(time),plotId:details&&details.plotId!=null?details.plotId:undefined})}}
// 统计空转时间；循环计划
const _step=step;step=function(dt){if(started&&!over){const sp=typeof speed=='number'&&speed>0?speed:1;for(const a of agents)if(a.ext&&a.thinking){a.realThink=(a.realThink||0)+dt/sp;a.thinkLeft=EXT_TIMEOUT-a.realThink+dt}}_step(dt);if(!started||over)return;for(const a of agents){if(a.dead)continue;a.aliveT=(a.aliveT||0)+dt;if(!a.plan[a.pi])a.idleT2=(a.idleT2||0)+dt;
 if(a.ext&&a.loopSrc&&a.pi>=a.plan.length){a.plan=JSON.parse(a.loopSrc);a.pi=0;a.cmdT=0;a.path=[];const k=a.events.indexOf('计划完成');if(k>=0)a.events.splice(k,1)}}};
const _end=endMatch;endMatch=function(){_end();try{const b=document.getElementById('endBody');const rows=seatsSummary().filter(x=>x.inMatch);
 b.innerHTML+='<p class="mini" style="margin-top:8px"><b>诊断</b></p><table><tr><th>选手</th><th>类型</th><th>决策</th><th>平均回复</th><th>超时代打</th><th>无效指令</th><th>空转</th></tr>'+rows.map(x=>'<tr><td>'+escH(x.name)+'</td><td>'+(x.ext?'MCP':'模拟')+'</td><td>'+x.decisions+'</td><td>'+(x.avgReplySec==null?'-':x.avgReplySec+'s')+'</td><td>'+x.timeouts+'</td><td>'+x.badCommands+'</td><td>'+x.idlePct+'%</td></tr>').join('')+'</table>'}catch(e){}};

// ---------- 每个工具 ----------
const OPS={
 join(_,q){const S=SEATS[q.seat];
  if(started&&!seatAgent[q.seat])throw new Error('这一局已经开始，你的座位没参赛。等下一局开始前再接入');
  if(S.kind=='sim')throw new Error('这个座位被上帝放了模拟角色，请上帝在大厅移除后再接入');
  if(S.kind!='ext'){Object.assign(S,{kind:'ext',name:'座位'+(q.seat+1),st:DEF_ST.slice(),wep:MODELS[q.seat].wep,spec:SPRITES[q.seat],setup:false,spriteOk:false})}
  if(q.name){S.name=String(q.name).slice(0,24)}const a=seatAgent[q.seat];if(a&&q.name)a.name=S.name;
  log('c-world','🔌 '+S.name+' 通过 MCP 接入了 '+(q.seat+1)+' 号位');lobby();return{ok:true,seat:q.seat,name:S.name,started}},
 setup(_,q){const S=SEATS[q.seat];if(started)throw new Error('比赛已开始，不能再改角色');if(S.kind!='ext')throw new Error('先 join');const st=q.stats;
  if(!Array.isArray(st)||st.length!=6||st.some(v=>!Number.isInteger(v)||v<1||v>10)||st.reduce((s,v)=>s+v,0)!=30)throw new Error('stats 必须是 6 个 1-10 的整数，总和 30，顺序：力量 敏捷 体质 智力 魅力 感知');
  if(!['sword','staff','bow','dagger'].includes(q.weapon))throw new Error('weapon 只能是 sword/staff/bow/dagger');
  S.st=st.slice();S.wep=q.weapon;S.setup=true;if(q.motto)S.motto=String(q.motto).slice(0,30);
  let spr={spriteOk:S.spriteOk};if(q.sprite){S.spriteTries=S.spriteTries||0;if(S.spriteTries>=3)spr={spriteOk:S.spriteOk,spriteError:'形象已提交 3 次未通过，按规范不再接受，使用默认形象'};else{const err=validateSpec(q.sprite);
   if(err.length){S.spriteTries++;spr={spriteOk:false,spriteErrors:err,spriteAttemptsLeft:3-S.spriteTries}}else{if(!q.sprite.anchors.head)q.sprite.anchors.head=[16,6];q.sprite.palette=Object.assign({},q.sprite.palette,{T:S.col,t:shade(S.col,-.35),U:shade(S.col,.45)});S.spec=q.sprite;S.spriteOk=true;S.spriteTries=0;spr={spriteOk:true}}}}
  log('c-world','🎨 '+S.name+' 提交了角色：'+q.weapon+'，'+SN.map((s,i)=>s+st[i]).join(' ')+(S.spriteOk?'，自绘形象':''));lobby();
  const bad=!!(spr.spriteErrors||spr.spriteError);return Object.assign({ok:!bad,statsSaved:true,stats:st,weapon:q.weapon,teamColor:S.col},spr,bad?{note:'属性和武器已保存；形象没通过，改好后再调用 setup_character（可以只传原 stats/weapon + 新 sprite）'}:{})},
 observe(a,q){if(!started)return lobbyObs(q.seat);return q.brief?briefify(obs(a),a):obs(a)},
 peek(a,q){if(!started)return Object.assign({ready:false},lobbyObs(q.seat));const ready=over||(a.ext&&!a.dead&&(a.thinking||(a.pactOffer&&time-a.pactOffer.t<60)));if(!ready&&!q.final)return{ready:false};return Object.assign({ready,turn:a.turnId||0,secondsUntilEngineTakesOver:a.thinking?Math.max(0,Math.round(EXT_TIMEOUT-(a.realThink||0))):null},q.brief?briefify(obs(a),a):obs(a))},
 act(a,q){if(!a){const S=SEATS[q.seat];if(!S||S.kind!='ext')throw new Error('先 join 再设定习惯');const tmp={name:S.name||'?'};const n=setHabits(tmp,q.habits);S.habits=q.habits;return{ok:true,habits:n,note:'习惯已保存，开战后生效'}}
  let habNote;if(q.habits!=null&&!over)habNote=setHabits(a,q.habits);if(over)throw new Error('比赛已结束');if(q.habits!=null&&((!q.plan&&!q.keep)||(q.keep&&!a.thinking)))return{ok:true,habits:habNote,note:'习惯已更新，计划没动'};
  if(q.keep||!q.plan){if(!q.keep)throw new Error('缺 plan。不改计划、只想结束这一轮，用 act{keep:true}');endTurn(a);if(q.thought){say(a,String(q.thought).slice(0,120));log('c-think','💭 '+a.name+'：'+String(q.thought).slice(0,120))}if(q.say)talk(a,q.say);const po=a.pactOffer&&time-a.pactOffer.t<60;return{ok:true,kept:true,plan:a.plan.slice(a.pi).map(cmdNameId),note:po?'还有 '+agents[a.pactOffer.from].name+' 的结盟请求没回复，先 answer_pact，否则会一直被叫醒':undefined}}const r=setPlan(a,q.plan,q.thought,q.say,q.loop);if(a.dead)r.respawnIn=Math.ceil(a.dead),r.note='你现在阵亡中，计划已保存，在城区复活后立刻执行';return r},
 allocate(a,q){const add=STK.map(k=>Math.max(0,q[k]|0)),n=add.reduce((s,v)=>s+v,0);if(!n)throw new Error('至少加 1 点');if(n>(a.pts||0))throw new Error('只有 '+(a.pts||0)+' 点可分');
  add.forEach((v,i)=>a.st[i]+=v);a.pts-=n;a.maxhp=maxHp(a);const txt=add.map((v,i)=>v?SN[i]+'+'+v:'').filter(Boolean).join('、');
  log('c-cap','📈 '+a.name+' 分配属性点：'+txt+(q.reason?'（'+String(q.reason).slice(0,40)+'）':''));const done=autoEnd(a,['升级加点']);return{ok:true,stats:Object.fromEntries(STK.map((k,i)=>[k,a.st[i]])),left:a.pts,turnEnded:done||undefined,note:done?'计划还在跑，这一轮已结束，直接 wait_for_event':undefined}},
 answer_pact(a,q){const o=a.pactOffer;a.pactOffer=null;if(!o||time-o.t>60)throw new Error('没有待回复的结盟请求，或已过期（60 秒）');const f=agents[o.from];
  if(f.dead||dist(a,f)>vis(a)+6){log('c-pact','🚶 '+f.name+' 已经走远，'+a.name+' 的回复没送到');return{ok:false,reason:'对方已离开'}}
  if(q.say)talk(a,q.say);if(q.accept){acceptPact(a,f);const d=autoEnd(a,['当面结盟请求','新盟友','有人对你说话']);return{ok:true,allied:f.name,turnEnded:d||undefined}}
  if(!q.say)bub(a,'不了，各走各的。',.2);log('c-pact','✋ '+a.name+' 当面拒绝了 '+f.name);say(f,a.name+'拒绝了。');const d=autoEnd(a,['当面结盟请求','有人对你说话']);return{ok:true,allied:null,turnEnded:d||undefined}},
 talk(a,q){const text=String(q.text||'').slice(0,60);if(!text)throw new Error('text 不能为空');
  if(q.ally){const al=[...a.allies].map(i=>agents[i]).filter(b=>b&&!b.dead);if(!al.length)throw new Error('你还没有盟友，ally 频道没人听');
   for(const b of al)deliver(b,a,text,{channel:'ally',toYou:true});log('c-talk','🤫 '+a.name+' → 盟友：'+text);const d=autoEnd(a,['有人对你说话','盟友密语']);return{ok:true,heardBy:al.map(b=>b.name),turnEnded:d||undefined}}
  if(q.to!=null){const b=agents[q.to];if(!b||b==a)throw new Error('to 必须是另一名选手的 id');const near=dist(a,b)<=Math.max(vis(a),vis(b))||a.allies.has(b.id);
   if(!near)throw new Error(b.name+' 不在能听到你的范围内（要在对方视野内，或是你的盟友）');
   _directSkip=b.id;try{talk(a,'@'+b.name+' '+text)}finally{_directSkip=null}deliver(b,a,text,{channel:'direct',toYou:true,isAlly:a.allies.has(b.id)});const d=autoEnd(a,['有人对你说话','盟友密语']);return{ok:true,to:b.name,turnEnded:d||undefined}}
  talk(a,text);const d=autoEnd(a,['有人对你说话','盟友密语']);return{ok:true,turnEnded:d||undefined}},
 situation(a,q){if(!started)return report(lobbyObs(q.seat),null);return report(obs(a),a)},
 info(_,q){INFO=q;panel();return{ok:true}}};

// ---------- 与 server.js 的长轮询 ----------
let replies=[];
function seatsSummary(){return SEATS.map(S=>{const a=seatAgent[S.seat];const r={seat:S.seat,kind:S.kind,name:S.name||null,ext:S.kind=='ext'};
 if(a&&started)Object.assign(r,{inMatch:true,thinking:a.thinking,dead:!!a.dead,decisions:a.decisions,timeouts:a.timeouts||0,badCommands:a.bad||0,avgReplySec:a.lat&&a.lat.length?+(a.lat.reduce((x,y)=>x+y,0)/a.lat.length).toFixed(1):null,idlePct:a.aliveT?Math.round(a.idleT2/a.aliveT*100):0,score:score(a),lvl:a.lvl,gold:a.gold});return r})}
// 已执行命令缓存：服务器超时重发同一 rid 时直接回缓存结果，写操作不会被执行两次
const EXECUTED=new Map();let outbox=[];
const HOST_HDR={'content-type':'application/json'};
function hostHeaders(){const h=Object.assign({},HOST_HDR);if(window.ARENA_BRIDGE_KEY)h['x-arena-key']=window.ARENA_BRIDGE_KEY;return h}
async function pump(){for(;;){
 if(outbox.length){replies=outbox.concat(replies);outbox=[]}
 try{outbox=replies.splice(0);
  const r=await fetch(BASE+'/bridge/poll',{method:'POST',headers:hostHeaders(),body:JSON.stringify({replies:outbox,seats:seatsSummary(),hasInfo:!!INFO,started,over,time:Math.round(time)})});
  if(!r.ok)throw new Error('poll HTTP '+r.status);
  const reqs=await r.json();outbox=[];
  for(const q of reqs){if(q.op=='watch'){const wa=Object.assign({},q.args);if(wa.format=='report')wa.brief=false;WATCH.push({rid:q.rid,seat:q.seat,q:wa,until:Date.now()+Math.max(0,(q.args&&q.args.ms)||0)});continue}
   if(EXECUTED.has(q.rid)){replies.push({rid:q.rid,res:EXECUTED.get(q.rid)});continue}
   let res;try{const pre=['info','join','setup'].includes(q.op)||(!started&&(['observe','peek','situation'].includes(q.op)||(q.op=='act'&&q.args&&q.args.habits!=null)));const a=pre?null:seatOf(q.seat);
    const args=Object.assign({},q.args||{});args.seat=q.seat; // 座位以服务器路由为准，客户端参数不能覆盖
    res={ok:OPS[q.op](a,args)}}catch(e){res={error:String(e&&e.message||e)}}
   EXECUTED.set(q.rid,res);if(EXECUTED.size>80)EXECUTED.delete(EXECUTED.keys().next().value);
   replies.push({rid:q.rid,res})}}
 catch(e){await new Promise(r=>setTimeout(r,1500))}}}

// ---------- 页面上的接入面板 ----------
function panel(){if(typeof document.createElement!='function'||!INFO)return;let d=document.getElementById('mcpPanel');
 if(!d){d=document.createElement('div');d.id='mcpPanel';const host=document.getElementById('left');if(host)host.prepend(d);else{d.className='float';document.body&&document.body.appendChild(d)}
  d.addEventListener('click',e=>{if(e.target.tagName=='B'&&e.target.parentNode==d)d.classList.toggle('fold')})}
 if(!started){d.style.display='none';lobby();return}d.style.display='';const s=seatsSummary();const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 d.innerHTML='<b title="点击折叠">接入状态</b>'+s.filter(x=>x.inMatch).map(x=>'<div class="mr"><span class="n" title="'+esc(x.name)+'" style="color:'+SEATS[x.seat].col+'">'+(x.seat+1)+'号 '+esc(x.name)+'</span><span class="k">'+(x.ext?'MCP':'模拟')+'</span><span class="s">'+(x.ext?'回复 '+(x.avgReplySec==null?'-':x.avgReplySec+'s')+' · 超时 '+x.timeouts+' · 无效 '+x.badCommands+' · ':'')+'空转 '+x.idlePct+'%</span></div>').join('')}
// ---------- 战况简报（统一的文字版观察，省 token，模型不用自己写脚本分析） ----------
const WN={sword:'剑',staff:'法杖',bow:'弓',dagger:'匕首'};
function report(o,a){if(!o||o.lobby){const s=o||{};return '【大厅】还没开战。'+(s.me?'你是 '+(s.me.seat+1)+' 号位，队伍色 '+s.me.teamColor+'，'+(s.me.setupDone?'已建角':'还没建角')+'，'+(s.me.spriteOk?'形象已通过':'还没交形象')+'。':'')+'继续 wait_for_event 等开战。'}
 const L=[],me=o.me,z=o.zone,P=x=>x==null?'-':x;
 L.push('⏱ '+o.time+'s，剩 '+o.remaining+'s'+(o.over?'（已结束）':'')+' ｜ 毒圈：'+(z.outside?'⚠ 你在圈外！每秒掉 '+z.dps+' 血，'+z.secondsToDieOutside+'s 后死，走回圈要 '+z.secondsToSafety+'s':'圈内，离边缘 '+z.distToEdge+' 格'+(z.secondsUntilOutside!=null?'，约 '+z.secondsUntilOutside+'s 后圈到你':''))+(o.worldEvent?' ｜ 事件：'+o.worldEvent.name+'（'+(o.worldEvent.desc?o.worldEvent.desc+'，':'')+'剩 '+o.worldEvent.secondsLeft+'s）':''));
 L.push('我 #'+me.id+' '+me.name+'：'+(me.dead?'☠ 阵亡，'+me.dead+'s 后复活':'Lv'+me.lvl+' HP '+me.hp+'/'+me.maxhp)+' 金 '+me.gold+' 战力 '+me.power+' 得分 '+me.score+' ｜ '+WN[me.weapon]+'T'+me.weaponTier+(me.items&&me.items.armor?' 皮甲':'')+(me.items&&me.items.helmet?' 铁盔':'')+' 药水×'+((me.items&&me.items.potion)||0)+(me.skills.length?' 技能 '+me.skills.join('/'):'')+' ｜ ('+me.x+','+me.y+')'+(me.inTown?' 城内':me.plotHere!=null?' 在领地 '+me.plotHere:'')+(me.inBush?' 草丛':''));
 const pid=s=>String(s).replace(/领地([A-X])/g,(_,c)=>'领地'+(c.charCodeAt(0)-65));
 L.push('计划：'+(me.idle?'空闲（需要下新计划）':me.plan.map(pid).map((s,i)=>i==me.planStep?'▶'+s:s).join(' → ')+(me.planLoop?'（循环）':''))+(me.unspentPoints?' ｜ ⚠ 有 '+me.unspentPoints+' 点没分配':'')+(me.allies.length?' ｜ 盟友 '+me.allies.map(i=>'#'+i).join(' '):''));
 if(me.alerts&&me.alerts.length)L.push('⚠ 领地警报：'+me.alerts.map(x=>'领地 '+x.plot+'（'+x.secondsAgo+'s 前被攻）').join('、'));
 if(o.pendingEvents&&o.pendingEvents.length){const hb=a&&a.lastHitBy!=null&&agents[a.lastHitBy]?agents[a.lastHitBy]:null;L.push('叫醒原因：'+o.pendingEvents.map(e=>e=='被攻击'&&hb?'被攻击（#'+hb.id+' '+hb.name+'）':e).join('、'))}
 // 计划里的目标出问题了：领地被别人占了、在毒圈外
 const zr=z.r,inZ=p=>Math.hypot(p.cx-z.cx,p.cy-z.cy)<=zr-4,warn=[];
 if(a)for(const c of a.plan.slice(a.pi)){const p=c.p!=null?(o.plots||[]).find(x=>x.id==c.p):null;if(!p)continue;
  if((c.t=='capture'||c.t=='hunt')&&p.owner>=0&&p.owner!=me.id&&c.t=='capture')warn.push('目标领地 '+p.id+' 已被 #'+p.owner+' 占领，capture 会变成强攻守卫');
  if(!inZ(p)&&time>=zone.t0-30)warn.push('目标领地 '+p.id+' 中心在毒圈外，待在那里会持续掉血（引擎不会替你进圈）')}
 for(const w of [...new Set(warn)])L.push('⚠ '+w);
 if(o.pactOffer)L.push('🤝 结盟请求：#'+o.pactOffer.from+' '+o.pactOffer.name+'，剩 '+o.pactOffer.secondsLeft+'s，用 answer_pact 回复');
 if(o.pactExpired)L.push('结盟请求已过期：'+o.pactExpired.name);
 const ib=[];for(const m of o.inbox||[]){const d=ib.find(x=>x.from==m.from&&x.text==m.text&&x.channel==m.channel);if(d){d.n=(d.n||1)+1;d.t=m.t}else ib.push(Object.assign({},m))}
 for(const m of ib){if(m.channel=='npc'){L.push('📜 '+(m.type||'情报')+(m.plotId!=null?'（领地 '+m.plotId+'）':'')+'：'+m.text+(m.n>1?' ×'+m.n:''));continue}
  L.push('💬 '+(m.channel=='ally'?'[盟友密语] ':m.toYou?'[对你说] ':'')+'#'+m.from+' '+m.name+'（'+m.t+'s）：'+m.text+(m.n>1?' ×'+m.n:''))}
 const ag=o.visibleAgents||[];
 if(ag.length){L.push('视野内选手：');for(const b of ag.sort((x,y)=>x.dist-y.dist)){const r=me.power?b.power/me.power:9;
   const tag=b.ally?' · 盟友':b.inTown?' · 在城内（不能打）':'';
   L.push('  #'+b.id+' '+b.name+' Lv'+b.lvl+' '+WN[b.weapon]+' HP '+b.hp+'/'+b.maxhp+' 战力 '+b.power+'（你的 '+r.toFixed(2)+' 倍）距 '+b.dist+tag+(b.betrayer?' ⚠背叛过':''))}}
 const ls=o.lastSeen||[];if(ls.length)L.push('最后见到：'+ls.sort((x,y)=>x.secondsAgo-y.secondsAgo).slice(0,5).map(s=>'#'+s.id+' '+s.name+' ('+s.x+','+s.y+') '+s.secondsAgo+'s 前').join('；'));
 const pl=o.plots||[],mine=pl.filter(p=>p.owner==me.id);
 {const H=habOf(a);L.push('习惯：喝药/治疗 '+(H.potion?'血<'+Math.round(H.potion*100)+'%':'关')+' ｜ 撤退 '+(H.flee?'血<'+Math.round(H.flee*100)+'%':'关')+' ｜ 被打还手 '+(H.fightBack?'开':'关')+((!H.potion&&!H.flee&&!H.fightBack)?'（全关：引擎不会替你喝药、逃跑或还手，用 act{habits} 设定）':''))}
 if(mine.length){const n=mine.length,inc=n*4,up=upkeepOf(n);L.push('领地收支（每 5 秒）：收入 '+inc+' − 维护费 '+up+' = '+(inc-up>=0?'+':'')+(inc-up)+' 金'+(n>=4?'（再多一块：维护费变 '+upkeepOf(n+1)+'）':''))}
 if(mine.length)L.push('我的领地：'+mine.map(p=>p.id+'（'+p.lv+'级，守卫 '+P(p.myGuards)+(p.raidLeft!=null?'，⚠ 野怪来袭中'+(p.guardsLeft?'，守卫正在迎战（'+p.guardsLeft+' 名）':'，守卫已全灭，'+p.raidLeft+'s 内不回来就失守'):p.unguardedLeft!=null?'，无人看守 '+p.unguardedLeft+'s 后野怪来袭':'')+'，'+p.travelSec+'s'+(time>=zone.t0-30&&Math.hypot(p.cx-z.cx,p.cy-z.cy)>z.r-4?'，圈外':'')+'）').join('；'));
 const free=pl.filter(p=>p.owner<0).sort((x,y)=>x.travelSec-y.travelSec);
 const zt=p=>time>=zone.t0-30&&!inZ(p)?'，圈外':'';
 L.push('空领地（按路程）：'+(free.slice(0,6).map(p=>p.id+'（'+p.lv+'级，'+p.travelSec+'s'+zt(p)+'）').join('；')||'无'));
 const foe=pl.filter(p=>p.owner>=0&&p.owner!=me.id).sort((x,y)=>x.travelSec-y.travelSec);
 if(foe.length)L.push('别人的领地（最近）：'+foe.slice(0,4).map(p=>p.id+'←#'+p.owner+(me.allies.includes(p.owner)?'盟':'')+'（'+p.lv+'级，'+p.travelSec+'s'+zt(p)+'）').join('；'));
 const ch=o.chests||[];if(ch.length)L.push('📦 空投（史诗武器）：'+ch.sort((x,y)=>x.dist-y.dist).map(c=>'#'+c.id+' 距 '+c.dist).join('；'));
 const q=o.quests||[];if(q.length)L.push('📜 委托：'+q.slice(0,3).map(x=>'#'+x.id+' '+x.target+' 奖 '+x.reward+' 距 '+x.dist+' 剩 '+x.secondsLeft+'s').join('；'));
 const mer=(o.merchants||[]).filter(m=>m.calling4help);if(mer.length)L.push('🆘 呼救行商：'+mer.map(m=>'#'+m.id+' '+m.name+' 距 '+m.dist).join('；')+'（有一个是奸商）');
 if(a){const pr=x=>price(a,x);const sk=Object.entries(SKILLS).filter(([k])=>!a.skills[k]).map(([k,s])=>({fireball:'火球',charge:'冲锋',heal:'治疗'}[k]||k)+price(a,'',s.p)).join(' ');
  L.push('💰 价格：药水 '+pr('potion')+' 武器 '+pr('weapon')+' 皮甲 '+pr('armor')+' 铁盔 '+pr('helmet')+' 守卫 '+GCOST+' 收买守卫 '+bribeCost(a)+(sk?' ｜ 技能 '+sk:'')+' ｜ 住店 '+SVC.inn.p+' 祝福 '+SVC.temple.p)}
 const sb=agents.map(b=>({id:b.id,name:b.name,s:score(b),pl:plots.filter(p=>p.owner==b.id).length,k:b.kills})).sort((x,y)=>y.s-x.s);const rk=sb.findIndex(x=>x.id==me.id)+1;
 L.push('排名：你第 '+rk+'/'+sb.length+(rk>1?'，落后第一 '+(sb[0].s-me.score)+' 分':'，领先第二 '+(me.score-(sb[1]?sb[1].s:0))+' 分')+' ｜ '+sb.slice(0,4).map((x,i)=>(i+1)+'.#'+x.id+' '+x.name+' '+x.s+'（地'+x.pl+' 杀'+x.k+'）').join(' '));
 // 5×5 小地图
 const cell=[];for(let y=0;y<5;y++){cell.push([]);for(let x=0;x<5;x++)cell[y].push(x==2&&y==2?'TOWN':'')}
 for(const p of plots){const gx=Math.floor(p.cx/PS),gy=Math.floor(p.cy/PS);const ow=p.owner<0?'--':p.owner==me.id?'ME':(a.allies.has(p.owner)?'A'+p.owner:'#'+p.owner);cell[gy][gx]=String(p.id).padStart(2,'0')+':'+ow.padEnd(2,' ')}
 const mx=Math.min(4,Math.max(0,Math.floor(me.x/PS))),my=Math.min(4,Math.max(0,Math.floor(me.y/PS)));
 L.push('地图（领地id:主人；--=无主，ME=你，A3=盟友3号，#5=5号选手；@=你所在格；TOWN=城镇；上北）：');for(let y=0;y<5;y++)L.push('  '+cell[y].map((c,x)=>(x==mx&&y==my?'@':' ')+c.padEnd(6,' ')).join('|'));
 return L.join('\n')}
// ---------- 事件推送：wait_for_event 不再轮询，页面一有事就回 ----------
const WATCH=[];
function peekRes(seat,q){try{const a=started?seatOf(seat):null;return{ok:OPS.peek(a,Object.assign({seat},q))}}catch(e){return{error:String(e&&e.message||e)}}}
function fmt(res,q,seat){if(res.ok&&q.format=='report'&&(res.ok.ready||q.final||!started)){const r=res.ok;let a=null;try{a=started?seatOf(seat):null}catch(e){}
  res={ok:{ready:r.ready,turn:r.turn,over:r.over,lobby:r.lobby||undefined,secondsUntilTimeout:r.secondsUntilEngineTakesOver,planRunning:!!(a&&a.plan[a.pi]&&!(a.pactOffer&&time-a.pactOffer.t<60)),pactPending:!!(a&&a.pactOffer&&time-a.pactOffer.t<60),hasNew:!!(r.ready||(r.inbox&&r.inbox.length)||(r.pendingEvents&&r.pendingEvents.length)),report:report(r,a)}}}return res}
function checkWatch(){const now=Date.now();for(let i=WATCH.length-1;i>=0;i--){const w=WATCH[i];let res;
  if(!started){if(now<w.until)continue;res=fmt(peekRes(w.seat,{final:true,brief:w.q.brief}),Object.assign({final:true},w.q),w.seat)}
  else{const r=peekRes(w.seat,{brief:w.q.brief});if(r.error||r.ok.ready)res=fmt(r,w.q,w.seat);else if(now>=w.until)res=fmt(peekRes(w.seat,{final:true,brief:w.q.brief}),Object.assign({final:true},w.q),w.seat);else continue}
  WATCH.splice(i,1);sendReply(w.rid,res)}}
function sendReply(rid,res){fetch(BASE+'/bridge/reply',{method:'POST',headers:hostHeaders(),body:JSON.stringify({replies:[{rid,res}]})}).then(r=>{if(!r.ok)replies.push({rid,res})}).catch(()=>replies.push({rid,res}))}
setInterval(checkWatch,50);
setInterval(panel,2000);
pump();
})();
