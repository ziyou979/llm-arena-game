// 野怪来袭 × 守卫：守卫会迎战来袭野怪；守卫全灭后才累计收地；收地后来袭野怪离开、不变成守卫
const fs=require('fs');
const html=fs.readFileSync(__dirname+'/../arena.html','utf8');
const sprites=html.match(/<script[^>]*id="spritesJSON"[^>]*>([\s\S]*?)<\/script>/)[1];
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const Hh=fs.readFileSync('/workspace/work/arena-demo/harness.js','utf8').split('\n');(0,eval)(Hh[4]);
global.els={};
global.document={getElementById:id=>id=='spritesJSON'?{textContent:sprites}:(els[id]||(els[id]=stub())),createElement:()=>stub(),querySelectorAll:()=>[],querySelector:()=>stub(),addEventListener(){},body:stub()};
global.window=global;global.addEventListener=()=>{};global.requestAnimationFrame=()=>0;global.innerWidth=400;global.innerHeight=800;global.devicePixelRatio=1;global.localStorage={getItem:()=>null,setItem(){}};global.matchMedia=()=>({matches:false,addEventListener(){}});global.Image=function(){return stub()};
let s0=1;Math.random=()=>{s0=(s0*1664525+1013904223)>>>0;return s0/4294967296};
(0,eval)(scripts.join('\n')+'\n;globalThis.E={init:()=>init(),go:()=>go(),step:s=>step(s),get time(){return time},agents:()=>agents,plots:()=>plots,mons:()=>mons,hires,plotGuards,raidMons,spawnMon,logs:()=>logs,RAID_TAKE};');
function scenario(name,nHire,seed){s0=seed;E.init();E.go();const ag=E.agents(),o=ag[0];
 // 让所有人原地站在城里，排除干扰
 for(const a of ag){a.plan=[];a.pi=0;a.thinking=false;a.x=a.y=0;a.ext=true;a.wait=1e9}
 const p=E.plots().find(p=>p.lv==2&&p.owner<0);p.owner=o.id;p.idle=59.9;
 for(let k=0;k<nHire;k++){E.spawnMon(3,Math.round(p.cx),Math.round(p.cy),p.id);const m=E.mons().at(-1);m.hire=1;m.owner=o.id}
 let firstRaid=null,lost=null,maxG=0;const before=E.mons().filter(m=>m.guard==p.id).length;
 for(let i=0;i<3000;i++){for(const a of ag){a.x=a.y=0}E.step(.1);const rm=E.raidMons(p).length;if(rm&&firstRaid==null)firstRaid=E.time;if(p.owner<0&&lost==null){lost=E.time;break}}
 const left=E.mons().filter(m=>m.raid!=null&&!m.gone).length,asGuard=E.mons().filter(m=>m.guard==p.id).length;
 const L=E.logs?E.logs():[];
 console.log(name,'| 守卫', nHire,'| 失守', lost==null?'没有（5 分钟内）':('第 '+lost.toFixed(1)+' 秒'),'| 来袭野怪残留',left,'| 地里守卫数 前/后',before,asGuard,'| 剩余雇佣守卫',E.hires(p).length)}
scenario('A 无雇佣守卫',0,11);scenario('B 1 名雇佣守卫',1,12);scenario('C 3 名雇佣守卫',3,13);
// D：来袭进行中，原生守卫被打死后才开始累计；记录过程
s0=21;E.init();E.go();{const ag=E.agents(),o=ag[0];for(const a of ag){a.plan=[];a.thinking=false;a.ext=true;a.wait=1e9}
 const p=E.plots().find(p=>p.lv==1&&p.owner<0);p.owner=o.id;p.idle=59.9;let t0=null,tl=null,gDeadAt=null;
 for(let i=0;i<4000;i++){for(const a of ag){a.x=a.y=0}E.step(.1);if(E.raidMons(p).length&&t0==null)t0=E.time;if(t0!=null&&gDeadAt==null&&!E.plotGuards(p).length)gDeadAt=E.time;if(p.owner<0){tl=E.time;break}}
 console.log('D 1 级地无雇佣守卫 | 来袭',t0&&t0.toFixed(1),'| 原生守卫首次阵亡',gDeadAt&&gDeadAt.toFixed(1),'| 失守',tl&&tl.toFixed(1),'| 来袭野怪残留',E.mons().filter(m=>m.raid!=null&&!m.gone).length,'| 地里守卫(含复活中)',E.mons().filter(m=>m.guard==p.id).length)}
// E：来袭开始后才雇 2 名守卫：守卫应迎战，期间不累计收地
s0=31;E.init();E.go();{const ag=E.agents(),o=ag[0];for(const a of ag){a.plan=[];a.thinking=false;a.ext=true;a.wait=1e9}
 const p=E.plots().find(p=>p.lv==2&&p.owner<0);p.owner=o.id;p.idle=59.9;let hired=false,maxT=0,end=null;
 for(let i=0;i<4000;i++){for(const a of ag){a.x=a.y=0}E.step(.1);if(E.raidMons(p).length&&!hired){hired=true;for(let k=0;k<2;k++){E.spawnMon(3,Math.round(p.cx),Math.round(p.cy),p.id);const m=E.mons().at(-1);m.hire=1;m.owner=o.id}}
  if(E.plotGuards(p).length)maxT=Math.max(maxT,0);if(hired&&!E.raidMons(p).length&&end==null)end=E.time;if(p.owner<0||end)break}
 console.log('E 来袭后雇 2 名 | 结果',p.owner<0?'失守 '+E.time.toFixed(1):'打退 '+(end&&end.toFixed(1)),'| 剩余雇佣守卫',E.hires(p).length,'| raidT',p.raidT)}
