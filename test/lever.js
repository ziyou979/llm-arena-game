// 决策杠杆实验：同一引擎下，把部分座位的决策换成"不动脑"策略，看分差。分差小 = 引擎替人做了决定。
const fs=require('fs');
const html=fs.readFileSync(__dirname+'/../arena.html','utf8');
const sprites=html.match(/<script[^>]*id="spritesJSON"[^>]*>([\s\S]*?)<\/script>/)[1];
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const Hh=fs.readFileSync('/workspace/work/arena-demo/harness.js','utf8').split('\n');(0,eval)(Hh[4]);
global.els={};
global.document={getElementById:id=>id=='spritesJSON'?{textContent:sprites}:(els[id]||(els[id]=stub())),createElement:()=>stub(),querySelectorAll:()=>[],querySelector:()=>stub(),addEventListener(){},body:stub()};
global.window=global;global.addEventListener=()=>{};global.requestAnimationFrame=()=>0;global.innerWidth=400;global.innerHeight=800;global.devicePixelRatio=1;global.localStorage={getItem:()=>null,setItem(){}};global.matchMedia=()=>({matches:false,addEventListener(){}});global.Image=function(){return stub()};
let s0=1;const seeded=()=>{s0=(s0*1664525+1013904223)>>>0;return s0/4294967296};Math.random=seeded;
const POLS=fs.readFileSync(__dirname+'/policies.js','utf8');
(0,eval)(scripts.join('\n')+'\n'+POLS+'\n;globalThis.__E={init:()=>init(),go:()=>go(),step:s=>step(s),st:()=>({time,over}),agents:()=>agents,score:a=>score(a),plots:()=>plots,setPol:(id,p)=>{POL[id]=p}};');
const N=+process.env.N||12, MIX=(process.env.MIX||'smart,dumb').split(',');
const tot={},cnt={},det={};
for(let g=0;g<N;g++){s0=1000+g*7919;__E.init();
 // 轮换：每局把策略按座位轮转，抵消角色属性差异
 const ag=__E.agents();ag.forEach((a,i)=>{const p=MIX[(i+g)%MIX.length];a.__pol=p;__E.setPol(a.id,p)});
 __E.go();while(!__E.st().over)__E.step(.1);
 for(const a of ag){const p=a.__pol,sc=__E.score(a);tot[p]=(tot[p]||0)+sc;cnt[p]=(cnt[p]||0)+1;
  const d=det[p]||(det[p]={plots:0,gold:0,kills:0,deaths:0,lvl:0});d.plots+=__E.plots().filter(q=>q.owner==a.id).length;d.gold+=a.gold;d.kills+=a.kills;d.deaths+=a.deaths||0;d.lvl+=a.lvl}}
for(const p of Object.keys(tot)){const c=cnt[p],d=det[p];console.log(p.padEnd(8),'均分',Math.round(tot[p]/c),'领地',(d.plots/c).toFixed(1),'金',Math.round(d.gold/c),'击杀',(d.kills/c).toFixed(1),'死亡',(d.deaths/c).toFixed(1),'等级',(d.lvl/c).toFixed(1))}
