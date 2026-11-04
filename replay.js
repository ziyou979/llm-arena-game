// 像素竞技场 · 回放（页面端）
// 比赛进行时每 0.2 秒（游戏时间）存一份全局状态，只拷数字，不录像，不影响直播。
// 赛后进入回放：任选导播或任一选手的视角（带该选手的视野迷雾）重新渲染，
// 可以只录当前画面，也可以把勾选的多个视角同时导出成多个视频文件。
(function(){
const VER='pixel-arena-replay/1',EVERY=2,NEAR=28;
// 选手：只存画面和选手卡用到的字段；名字、颜色、形象等不变的存一次在 roster 里
const AK=['x','y','hp','maxhp','lvl','xp','gold','kills','wt','dead','thinking','thinkLeft','betrayer','betrays','face','bob','hit','swing','swingDur','crits','chests','rescues','quests','deaths','moving','pts','bountyKills','blessed','knowShady','lost','stabbed','decisions'];
// NPC：动态字段每帧存，其余首次出现时存一次
const NK=['x','y','face','hp','dead','sos','exposed','stab','hit','scared'];const NP_SKIP=new Set(['path','b','tgt','dest','stall','bub'].concat(NK));
const KEY=25; // 野怪每 25 帧（5 秒）存一次全量，其间只存变化
const prim=v=>v===null||typeof v=='number'||typeof v=='string'||typeof v=='boolean';
const pick=(o,skip)=>{const r={};for(const k in o){if(skip&&skip.has(k))continue;const v=o[k];if(prim(v))r[k]=v}return r};
const q2=v=>Math.round(v*100)/100;
let IDS=new WeakMap(),nid=1;const idOf=o=>{let i=IDS.get(o);if(!i){i=nid++;IDS.set(o,i)}return i};
const REC={cur:null,last:null,k:0,cost:0,n:0};
window.__replay=REC;

// ---------- 录制 ----------
function begin(){IDS=new WeakMap();nid=1;REC.k=0;REC.cost=0;REC.n=0;
 REC.prevM=new Map();
 REC.cur={v:VER,seed,match:MATCH,made:new Date().toISOString(),roster:agents.map(a=>({id:a.id,name:a.name,col:a.col,seat:a.seat,ext:!!a.ext,m:JSON.parse(JSON.stringify(a.m)),spec:a.spec})),npc:{},snaps:[],logs:[]}}
// 野怪行打包成 Float32Array，省内存（一局约 4500 帧 × 每帧上百只）
const MW=17,pack=rows=>{const f=new Float32Array(rows.length*MW);rows.forEach((r,j)=>f.set(r,j*MW));return f},rowsOf=f=>{const o=[];for(let j=0;j<f.length;j+=MW)o.push(f.subarray(j,j+MW));return o};
const qv=v=>typeof v=='number'?q2(v):typeof v=='boolean'?(v?1:0):v==null?0:v;
function camLabel(){const sel=agents[selId];return focus&&focus.t>0&&DIRECTOR?'导播：'+focus.label:FOLLOW&&sel?'跟随：'+sel.name:'自由视角'}
function snap(){const t0=performance.now();
 const live=agents.filter(a=>!a.dead),cc={x:cam.x+VW/2,y:cam.y+VH/2};
 const near=e=>{if(Math.abs(e.x-cc.x)<NEAR&&Math.abs(e.y-cc.y)<NEAR)return true;for(const a of live)if(Math.abs(e.x-a.x)<NEAR&&Math.abs(e.y-a.y)<NEAR)return true;return false};
 const s={t:q2(time),
  A:agents.map(a=>({p:AK.map(k=>qv(a[k])),al:[...a.allies],bub:a.bub?Object.assign({},a.bub):null,st:a.st.slice(),it:Object.assign({},a.items),sk:Object.keys(a.skills||{}).join(',')})),
  N:[],P:plots.map(p=>[p.owner,q2(p.prog),p.capBy,p.lv]),
  C:chests.map(c=>pick(c)),Me:meteors.filter(m=>!m.done).map(m=>pick(m)),
  J:projs.map(p=>({id:idOf(p),x:q2(p.x),y:q2(p.y),ang:p.ang||0,kind:p.kind,col:p.src&&p.src.col||null,tr:(p.trail||[]).map(q=>[q2(q.x),q2(q.y)])})),
  F:fx.map(f=>{const o=pick(f);for(const k in o)if(typeof o[k]=='number')o[k]=q2(o[k]);return o}),
  Z:{cx:zone.cx,cy:zone.cy,r:q2(zone.r),t0:zone.t0},E:event?{k:event.k,n:event.n,t:q2(event.t)}:null,
  B:[bounty,bountyAmt],Bn:bannerT>0?[banner,q2(bannerT)]:null,cam:[q2(cam.x),q2(cam.y),camLabel()]};
 const key=REC.cur.snaps.length%KEY==0,cur=new Map();
 for(const m of mons){if(m.dead)continue;if(!m.hire&&!near(m))continue;
  const r=[idOf(m),q2(m.x),q2(m.y),Math.round(m.hp),m.maxhp,m.lv,m.face||1,q2(Math.max(0,m.atk||0)),q2(Math.max(0,m.hit||0)),0,m.hire?1:0,m.elite?1:0,m.owner==null?-1:m.owner,m.guard==null?-1:m.guard,m.angry==null?-2:m.angry,m.msg?1:0,m.gone?1:0];cur.set(r[0],r)}
 if(key)s.M=pack([...cur.values()]);else{const P=REC.prevM,d=[],x=[];for(const[id,r]of cur){const o=P.get(id);if(!o||o.some((v,j)=>v!==r[j]))d.push(r)}for(const id of P.keys())if(!cur.has(id))x.push(id);s.Md=pack(d);if(x.length)s.Mx=x}
 REC.prevM=cur;
 for(const n of npcs){if(n.dead&&n.kind!='merchant')continue;const id=idOf(n);if(!REC.cur.npc[id])REC.cur.npc[id]=pick(n,NP_SKIP);s.N.push([id].concat(NK.map(k=>qv(n[k])),[n.bub?Object.assign({},n.bub):0]))}
 REC.cur.snaps.push(s);REC.cost+=performance.now()-t0;REC.n++}
const _step=step;
step=function(dt){if(RP)return;_step(dt);if(window.ARENA_NOREC)return;
 if(started&&agents&&agents.length){if(!over){if(!REC.cur||REC.cur.seed!==seed)begin();if(REC.k++%EVERY==0)snap()}
  else if(REC.cur&&REC.cur.seed===seed){snap();REC.last=REC.cur;REC.cur=null;showEndBtn()}}};
const _log=log;
log=function(cls,txt){_log(cls,txt);if(REC.cur&&!over&&!RP&&logs[0])REC.cur.logs.push([q2(time),cls,logs[0].txt])};

// ---------- 回放 ----------
let RP=null;window.__rp=()=>RP;
const DI=AK.indexOf('dead'),LI=['x','y','bob','swing','hit','thinkLeft'].map(k=>AK.indexOf(k));
function bs(S,t){let lo=0,hi=S.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(S[mid].t<=t)lo=mid;else hi=mid-1}return lo}
const L=(a,b,k)=>a+(b-a)*k;
// 还原某一帧的野怪：从最近的全量帧往后叠加变化；顺序播放时增量推进
let MC=null;function monsAt(i){const S=RP.d.snaps;if(!MC||i<MC.i||Math.floor(i/KEY)!=Math.floor(MC.i/KEY)){const k=i-i%KEY;MC={i:k,m:new Map(rowsOf(S[k].M).map(r=>[r[0],r]))}}
 while(MC.i<i){MC.i++;const s=S[MC.i];if(s.M){MC.m=new Map(rowsOf(s.M).map(r=>[r[0],r]));continue}for(const r of rowsOf(s.Md))MC.m.set(r[0],r);if(s.Mx)for(const id of s.Mx)MC.m.delete(id)}return MC.m}
function enter(data){if(!data||data.v!==VER||!data.snaps||data.snaps.length<2)throw new Error('回放文件无效');
 if(started&&!over)throw new Error('比赛进行中，结束后才能看回放');
 for(const s of data.snaps){if(s.M&&!(s.M instanceof Float32Array))s.M=Float32Array.from(s.M);if(s.Md&&!(s.Md instanceof Float32Array))s.Md=Float32Array.from(s.Md)}MC=null;
 seed=data.seed;R=rng(seed);genMap();SEAT_N=data.roster.length;
 agents=data.roster.map((r,j)=>{const a=newAgent(r.m,j);a.name=r.name;a.col=r.col;a.seat=r.seat;a.ext=r.ext;if(r.spec)a.spec=r.spec;composeSprite(a);a._rk='';return a});
 mons=[];npcs=[];fx=[];parts=[];projs=[];chests=[];meteors=[];MER=[];
 started=true;over=true;paused=true;selId=0;
 ['intro','endOv'].forEach(i=>{const e=document.getElementById(i);if(e&&e.style)e.style.display='none'});
 try{buildCards()}catch(e){}
 RP={d:data,t:data.snaps[0].t,end:data.snaps[data.snaps.length-1].t,play:true,speed:1,pov:-1,fog:true,last:performance.now(),li:-1,rec:null,multi:null};
 bar(true);apply(RP.t);setPov(-1)}
function apply(t){const S=RP.d.snaps,i=bs(S,t),s=S[i],n=S[Math.min(i+1,S.length-1)],k=n.t>s.t?Math.max(0,Math.min(1,(t-s.t)/(n.t-s.t))):0;
 time=t;
 agents.forEach((a,j)=>{const d=s.A[j],e=n.A[j];AK.forEach((k2,q)=>a[k2]=d.p[q]);a.dead=d.p[AK.indexOf('dead')];a.allies=new Set(d.al);a.bub=d.bub?Object.assign({},d.bub):null;a.st=d.st.slice();a.items=Object.assign({},d.it);a.skills={};if(d.sk)for(const k2 of d.sk.split(','))a.skills[k2]=1;
  const rk=(a.items.armor?1:0)+','+(a.items.helmet?1:0);if(a._rk!==rk){a._rk=rk;try{composeSprite(a)}catch(_){}}
  if(e&&!d.p[DI]&&!e.p[DI]&&Math.hypot(e.p[0]-d.p[0],e.p[1]-d.p[1])<3)for(const q of LI)a[AK[q]]=L(d.p[q],e.p[q],k)});
 const cm=new Map(monsAt(i)),nm=i+1<S.length?monsAt(i+1):cm;
 mons=[...cm.values()].map(r=>{const e=nm.get(r[0]),m={x:r[1],y:r[2],hp:r[3],maxhp:r[4],lv:r[5],face:r[6],atk:r[7],hit:r[8],t:(r[0]*1.37)%9,hire:!!r[10],elite:!!r[11],owner:r[12],guard:r[13],angry:r[14]==-2?null:r[14],msg:r[15]?{}:null,gone:!!r[16],dead:0};
  if(e&&Math.hypot(e[1]-r[1],e[2]-r[2])<3){m.x=L(r[1],e[1],k);m.y=L(r[2],e[2],k)}if(m.msg)m.msg=null;return m});
 const nn=new Map(n.N.map(o=>[o[0],o])),NS=RP.d.npc;
 npcs=s.N.map(o=>{const c=Object.assign({},NS[o[0]]);NK.forEach((k2,q)=>c[k2]=o[q+1]);c.bub=o[NK.length+1]?Object.assign({},o[NK.length+1]):null;const e=nn.get(o[0]);if(e&&Math.hypot(e[1]-o[1],e[2]-o[2])<3){c.x=L(o[1],e[1],k);c.y=L(o[2],e[2],k)}return c});
 MER=npcs.filter(x=>x.kind=='merchant');
 s.P.forEach((r,j)=>{const p=plots[j];if(p){p.owner=r[0];p.prog=r[1];p.capBy=r[2];p.lv=r[3]}});
 chests=s.C.map(c=>Object.assign({},c));meteors=s.Me.map(m=>Object.assign({},m));
 const nj=new Map(n.J.map(p=>[p.id,p]));
 projs=s.J.map(p=>{const e=nj.get(p.id);return{x:e?L(p.x,e.x,k):p.x,y:e?L(p.y,e.y,k):p.y,ang:p.ang,kind:p.kind,src:{col:p.col},trail:p.tr.map(q=>({x:q[0],y:q[1]}))}});
 fx=s.F.map(f=>Object.assign({},f));parts=[];
 zone=Object.assign({},zone||{},s.Z);event=s.E?Object.assign({},s.E):null;bounty=s.B[0];bountyAmt=s.B[1];
 if(s.Bn){banner=s.Bn[0];bannerT=s.Bn[1]}else bannerT=0;
 RP.cam={x:L(s.cam[0],n.cam[0],k),y:L(s.cam[1],n.cam[1],k),lab:s.cam[2]};
 const lg=RP.d.logs;let hi=lg.length;{let lo=0,h=lg.length;while(lo<h){const md=(lo+h)>>1;if(lg[md][0]<=t)lo=md+1;else h=md}hi=lo}
 if(hi!==RP.li){RP.li=hi;logs=lg.slice(Math.max(0,hi-100),hi).reverse().map(r=>({cls:r[1],txt:r[2]}));logDirty=true}}
function setPov(p){RP.pov=p;focus=null;DIRECTOR=false;if(p<0){FOLLOW=false;FOG=false}else{selId=p;FOLLOW=true;FOG=RP.fog;const a=agents[p];cam.x=a.x-VW/2;cam.y=a.y-VH/2}
 const s=document.getElementById('rpPov');if(s)s.value=String(p);try{ui()}catch(e){}}
function overlay(g,c,label){g.setTransform(1,0,0,1,0,0);const W=c.width,H=c.height;g.font='bold 22px sans-serif';g.textBaseline='top';
 const L2=[label,'剩余 '+mmss(RP.d.match-time)+(event?' · '+event.n:'')];let y=12;
 for(const s of L2){const w=g.measureText(s).width;g.fillStyle='rgba(0,0,0,.55)';g.fillRect(10,y-4,w+16,30);g.fillStyle='#fff';g.fillText(s,18,y);y+=34}
 if(bannerT>0&&banner){const tx=String(banner).replace(/<[^>]+>/g,'');g.font='bold 26px sans-serif';const w=g.measureText(tx).width;g.fillStyle='rgba(0,0,0,.6)';g.fillRect(W/2-w/2-14,H-58,w+28,40);g.fillStyle='#ffd166';g.fillText(tx,W/2-w/2,H-52)}
 g.textBaseline='alphabetic'}
const mmss=s=>{s=Math.max(0,s);return String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0')};
function povLabel(p){if(p<0)return RP.cam.lab||'导播';const a=agents[p];return a.name+(a.dead?'（阵亡）':'')}
function camFor(p){if(p<0){cam.x=RP.cam.x;cam.y=RP.cam.y}}
const _render=render;
render=function(){if(!RP)return _render();
 const now=performance.now(),dt=Math.max(0,Math.min(.1,(now-RP.last)/1000));RP.last=now;
 if(RP.play){RP.t=Math.min(RP.end,RP.t+dt*RP.speed);if(RP.t>=RP.end){RP.play=false;stopAll()}}
 apply(RP.t);
 if(RP.multi&&RP.multi.on){const M=RP.multi;if(now-M.lastF>=1000/30-1){M.lastF=now;
  const sv={cv,cx,mc,mx,cam,selId,FOG,FOLLOW,trauma};
  for(const o of M.outs){cv=o.c;cx=o.g;mc=M.dm;mx=M.dmx;cam=o.cam;FOLLOW=o.p>=0;FOG=o.p>=0&&RP.fog;if(o.p>=0)selId=o.p;else{cam.x=RP.cam.x;cam.y=RP.cam.y}trauma=0;_render();overlay(cx,cv,povLabel(o.p))}
  cv=sv.cv;cx=sv.cx;mc=sv.mc;mx=sv.mx;cam=sv.cam;selId=sv.selId;FOG=sv.FOG;FOLLOW=sv.FOLLOW;trauma=sv.trauma}}
 // 同时导出时主画面降到每秒约 6 帧，把算力留给导出
 if(RP.multi&&RP.multi.on&&(RP.fc=(RP.fc||0)+1)%10)return tick();
 camFor(RP.pov);_render();if(RP.rec)overlay(cx,cv,povLabel(RP.pov));tick()};
function tick(){
 const sc=document.getElementById('rpSeek');if(sc&&!sc._drag){sc.value=String(RP.t)}const tl=document.getElementById('rpTime');if(tl)tl.textContent=mmss(RP.t)+' / '+mmss(RP.end)};

// ---------- 导出视频（仅回放时） ----------
function mime(){const M=window.MediaRecorder;if(!M)return null;for(const m of['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'])if(M.isTypeSupported&&M.isTypeSupported(m))return m;return''}
function recorder(c,name){const mt=mime();if(mt===null)throw new Error('这个浏览器不支持录制（MediaRecorder），请用 Chrome 或 Edge');
 const st=c.captureStream(30),r=new MediaRecorder(st,mt?{mimeType:mt,videoBitsPerSecond:6e6}:{videoBitsPerSecond:6e6}),ch=[];
 r.ondataavailable=e=>{if(e.data&&e.data.size)ch.push(e.data)};r.onstop=()=>{const ext=(r.mimeType||mt||'').includes('mp4')?'mp4':'webm';dl(new Blob(ch,{type:r.mimeType||'video/webm'}),name+'.'+ext)};r.start(1000);return r}
function safe(s){return String(s).replace(/[\\/:*?"<>|\s]+/g,'_').slice(0,40)}
function base(){return 'arena_'+RP.d.seed}
function recOne(){if(RP.rec){RP.rec.stop();RP.rec=null;btn('rpRec','录制当前视角');return}
 RP.rec=recorder(cv,base()+'_'+safe(RP.pov<0?'导播':agents[RP.pov].name));RP.play=true;btn('rpRec','停止录制')}
function recMulti(pre){if(RP.multi&&RP.multi.on){stopMulti();return}
 const sel=pre||[...document.querySelectorAll('#rpPick input:checked')].map(i=>+i.value);if(!sel.length){alert('先勾选要导出的视角');return}
 const dm=document.createElement('canvas');dm.width=dm.height=2;
 const outs=sel.map(p=>{const c=document.createElement('canvas');c.width=cv.width;c.height=cv.height;const g=c.getContext('2d');const cm={x:0,y:0};if(p>=0){cm.x=agents[p].x-VW/2;cm.y=agents[p].y-VH/2}
  return{p,c,g,cam:cm,r:null}});
 RP.multi={on:true,outs,dm,dmx:dm.getContext('2d'),lastF:0};
 for(const o of outs)o.r=recorder(o.c,base()+'_'+safe(o.p<0?'导播':agents[o.p].name));
 RP.play=true;btn('rpMulti','停止导出')}
function stopMulti(){if(!RP.multi)return;RP.multi.on=false;for(const o of RP.multi.outs)try{o.r.stop()}catch(e){}RP.multi=null;btn('rpMulti','同时导出勾选视角')}
function stopAll(){if(RP.rec){RP.rec.stop();RP.rec=null;btn('rpRec','录制当前视角')}stopMulti()}
function dl(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove()},4000)}

// ---------- 存取回放文件 ----------
const toJSON=d=>JSON.stringify(d,(k,v)=>v instanceof Float32Array?Array.from(v,x=>Math.round(x*100)/100):v);
async function save(d){d=d||(RP&&RP.d)||REC.last;if(!d){alert('还没有可保存的回放');return}
 const txt=toJSON(d);let blob=new Blob([txt],{type:'application/json'}),name='arena_'+d.seed+'.replay.json';
 if(window.CompressionStream){blob=await new Response(blob.stream().pipeThrough(new CompressionStream('gzip'))).blob();name+='.gz'}dl(blob,name)}
async function load(file){let b=file;const head=new Uint8Array(await file.slice(0,2).arrayBuffer());
 if(head[0]==0x1f&&head[1]==0x8b){if(!window.DecompressionStream)throw new Error('浏览器不支持解压 .gz');b=await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).blob()}
 const t=await b.text();try{return JSON.parse(t)}catch(e){throw new Error('读不出回放：请选 .replay.json.gz 或解压后的 .replay.json 文件')}}

// ---------- 界面 ----------
const $=id=>document.getElementById(id);
function btn(id,t){const b=$(id);if(b)b.textContent=t}
function bar(on){let d=$('rpBar');if(!on){if(d)d.style.display='none';return}
 if(!d){d=document.createElement('div');d.id='rpBar';d.style.cssText='display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0;padding:10px;border:1px solid var(--line);border-radius:var(--r-lg);background:var(--sunk)';
  const w=$('wrap');w.parentNode.insertBefore(d,w.nextSibling)}
 d.style.display='flex';const ro=agents.map(a=>'<option value="'+a.id+'">'+a.name+'</option>').join('');
 d.innerHTML='<b style="margin-right:4px">回放</b><button id="rpPlay">暂停</button><select id="rpSpd"><option value="0.5">0.5x</option><option value="1" selected>1x</option><option value="2">2x</option><option value="4">4x</option><option value="8">8x</option></select>'+
  '<input type="range" id="rpSeek" min="'+RP.t+'" max="'+RP.end+'" step="0.1" value="'+RP.t+'" style="flex:1 1 220px"><span id="rpTime" class="mini"></span>'+
  '<span style="flex-basis:100%"></span>视角 <select id="rpPov"><option value="-1">导播</option>'+ro+'</select><label class="mini"><input type="checkbox" id="rpFog" checked> 选手视野迷雾</label>'+
  '<button id="rpRec">录制当前视角</button><button id="rpSave">保存回放文件</button><button id="rpExit" class="ghost">退出回放</button>'+
  '<span style="flex-basis:100%"></span><span class="mini">同时导出：</span><span id="rpPick" class="mini"><label><input type="checkbox" value="-1" checked> 导播</label> '+agents.map(a=>'<label><input type="checkbox" value="'+a.id+'" checked> '+a.name+'</label>').join(' ')+'</span><button id="rpMulti">同时导出勾选视角</button>'+
  '<span class="mini" style="flex-basis:100%">导出按真实时间录制（1x 时 15 分钟一局要录 15 分钟），每个视角各存一个视频文件。导出期间别切走这个标签页，否则浏览器会暂停绘制。</span>';
 $('rpPlay').onclick=()=>{RP.play=!RP.play;if(RP.t>=RP.end){RP.t=RP.d.snaps[0].t;RP.play=true}btn('rpPlay',RP.play?'暂停':'播放')};
 $('rpSpd').onchange=e=>RP.speed=+e.target.value;
 const sk=$('rpSeek');sk.oninput=e=>{sk._drag=true;RP.t=+e.target.value;RP.li=-1};sk.onchange=()=>{sk._drag=false;RP.li=-1};
 $('rpPov').onchange=e=>setPov(+e.target.value);$('rpFog').onchange=e=>{RP.fog=e.target.checked;if(RP.pov>=0)FOG=RP.fog};
 $('rpRec').onclick=()=>{try{recOne()}catch(e){alert(e.message)}};$('rpMulti').onclick=()=>{try{recMulti(null)}catch(e){alert(e.message)}};
 $('rpSave').onclick=()=>save();$('rpExit').onclick=exit}
function exit(){stopAll();RP=null;bar(false);FOG=false;DIRECTOR=true;FOLLOW=true;started=false;over=false;init()}
function showEndBtn(){const e=$('endOv');if(!e||!e.querySelector)return;const p=$('bAgain')&&$('bAgain').parentNode;if(!p||$('bRpEnd'))return;
 const b=document.createElement('button');b.id='bRpEnd';b.className='secondary';b.textContent='看回放';b.style.marginRight='8px';b.onclick=()=>{try{enter(REC.last)}catch(er){alert(er.message)}};
 const s=document.createElement('button');s.id='bRpSave';s.className='secondary';s.textContent='保存回放';s.style.marginRight='8px';s.onclick=()=>save(REC.last);p.insertBefore(s,p.firstChild);p.insertBefore(b,p.firstChild)}
try{const top=$('bRe');if(top&&top.parentNode&&top.insertAdjacentElement){const b=document.createElement('button');b.id='bRpLoad';b.textContent='回放';b.title='看上一局回放，或载入回放文件';
 const f=document.createElement('input');f.type='file';f.style.display='none';
 f.onchange=async()=>{const x=f.files&&f.files[0];f.value='';if(!x)return;try{enter(await load(x))}catch(e){alert(e.message)}};
 b.onclick=()=>{if(started&&!over){alert('比赛进行中，结束后才能看回放');return}if(REC.last&&!RP&&confirm('看上一局的回放？（取消 = 载入回放文件）')){try{enter(REC.last)}catch(e){alert(e.message)}return}f.click()};
 top.insertAdjacentElement('afterend',b);document.body.appendChild(f)}}catch(e){}
// 建角大厅（开局遮罩）里也能载入回放：「载入回放文件」按钮 + 整页拖放
try{const f2=document.createElement('input');f2.type='file';f2.style.display='none';document.body.appendChild(f2);
 const open=async x=>{if(!x)return;if(started&&!over){alert('比赛进行中，结束后才能看回放');return}try{enter(await load(x))}catch(e){alert(e.message)}};
 f2.onchange=()=>{const x=f2.files&&f2.files[0];f2.value='';open(x)};
 const go=$('bGo');if(go&&go.parentNode&&!$('bRpIntro')){const b=document.createElement('button');b.id='bRpIntro';b.className='secondary';b.textContent='载入回放文件';b.style.marginLeft='8px';b.title='选 .replay.json.gz 或 .replay.json，不用解压；也可以直接把文件拖进页面';b.onclick=()=>f2.click();go.parentNode.appendChild(b)}
 window.addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy'}});
 window.addEventListener('drop',e=>{const x=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];if(!x)return;e.preventDefault();open(x)})}catch(e){}
window.__replayApi={recMulti,stopAll,toJSON,enter,apply,setPov,save,stats:()=>({snaps:REC.cur?REC.cur.snaps.length:REC.last?REC.last.snaps.length:0,avgMs:REC.n?REC.cost/REC.n:0})};
})();
