// 无头测试：跑一整局 6 个模拟角色，测快照耗时与体积，再进入回放逐段渲染各视角
const fs=require('fs'),zlib=require('zlib');
const html=fs.readFileSync(__dirname+'/../arena.html','utf8');
const sprites=html.match(/<script[^>]*id="spritesJSON"[^>]*>([\s\S]*?)<\/script>/)[1];
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
const H=fs.readFileSync('/workspace/work/arena-demo/harness.js','utf8').split('\n');(0,eval)(H[4]);
global.els={};
global.document={getElementById:id=>id=='spritesJSON'?{textContent:sprites}:(els[id]||(els[id]=stub())),createElement:()=>stub(),querySelectorAll:()=>[],querySelector:()=>stub(),addEventListener(){},body:stub()};
global.window=global;global.addEventListener=()=>{};global.requestAnimationFrame=()=>0;global.innerWidth=400;global.innerHeight=800;global.devicePixelRatio=1;global.localStorage={getItem:()=>null,setItem(){}};global.matchMedia=()=>({matches:false,addEventListener(){}});global.Image=function(){return stub()};
global.alert=m=>console.log('ALERT',m);global.confirm=()=>true;
window.ARENA_BRIDGE='http://127.0.0.1:1';window.ARENA_BRIDGE_KEY=process.env.ARENA_BRIDGE_KEY||(()=>{try{return require('fs').readFileSync(require('path').join(__dirname,'..','.arena-hostkey'),'utf8').trim()}catch(e){return ''}})();
const code=scripts.join('\n')+'\n'+fs.readFileSync(__dirname+'/../bridge.js','utf8')+'\n'+fs.readFileSync(__dirname+'/../replay.js','utf8')+'\n;globalThis.__E={step:s=>step(s),go:()=>go(),st:()=>({time,over,started}),agents:()=>agents,mons:()=>mons,render:()=>render(),ui:()=>ui(),setT:t=>{}};';
(0,eval)(code);
window.ARENA_NOREC=!!process.env.NOREC;[0,2,3,5,6,7].forEach((s,k)=>addSim(s,[0,2,3,5,6,7][k],''));__E.go();
const t0=Date.now();let steps=0;const mem0=process.memoryUsage().heapUsed;
while(!__E.st().over&&steps<20000){__E.step(.1);steps++}
global.gc&&gc();console.log('heap after match MB',((process.memoryUsage().heapUsed-mem0)/1e6).toFixed(0));if(process.env.NOREC)process.exit(0);const R=__replay,d=R.last;const api=__replayApi;
console.log('steps',steps,'game time',__E.st().time.toFixed(1),'wall',(Date.now()-t0)+'ms');
console.log('snaps',d.snaps.length,'avg snap ms',(R.cost/R.n).toFixed(3),'max-ish total ms',R.cost.toFixed(0),'logs',d.logs.length);
const avgM=d.snaps.reduce((s,x)=>s+(x.M||x.Md).length,0)/d.snaps.length;console.log('avg mons/snap',avgM.toFixed(1),'total mons now',__E.mons().length);
const js=__replayApi.toJSON(d);const gz=zlib.gzipSync(js);console.log('json MB',(js.length/1e6).toFixed(1),'gz MB',(gz.length/1e6).toFixed(2));
global.gc&&gc();console.log('heap delta MB',((process.memoryUsage().heapUsed-mem0)/1e6).toFixed(0));
// 回放
const d2=JSON.parse(zlib.gunzipSync(gz).toString());
api.enter(d2);let err=0,n=0;const rp=__rp();
for(const pov of[-1,0,1,2,3,4,5]){api.setPov(pov);try{__E.ui()}catch(e){console.log("UIERR",e.message)}for(let t=d2.snaps[0].t;t<rp.end;t+=7.3){rp.t=t;rp.play=false;try{__E.render();__E.ui();n++}catch(e){err++;if(err<5)console.log('ERR',pov,t,e.stack.split('\n').slice(0,3).join(' | '))}}}
console.log('renders',n,'errors',err);
global.MediaRecorder=class{constructor(st,o){this.o=o;this.mimeType=o.mimeType}static isTypeSupported(m){return m.includes('vp9')}start(){MRn++}stop(){MRs++;this.onstop&&this.onstop()}};global.MRn=0;global.MRs=0;global.URL={createObjectURL:()=>'u',revokeObjectURL(){}};global.Blob=class{constructor(a,o){}};
api.setPov(2);rp.t=100;rp.play=true;api.recMulti([-1,0,3]);let e2=0;const pn=global.performance.now;let fake=0;global.performance.now=()=>(fake+=40);for(let i=0;i<200;i++){try{__E.render()}catch(e){e2++;if(e2<3)console.log('MERR',e.stack.split('\n').slice(0,3).join(' | '))}}api.stopAll();global.performance.now=pn;console.log('multi recorders',MRn,'stopped',MRs,'errors',e2,'t now',rp.t.toFixed(1));
// 回放中 step 应为空操作
const tb=__E.st().time;__E.step(.1);console.log('step frozen',__E.st().time===tb);
// 校验：回放还原的选手位置与快照一致
rp.t=400;rp.play=false;api.apply(400);const s=d2.snaps.find(x=>x.t>=400);console.log('agent0 at',s.t,__E.agents()[0].x.toFixed(2),s.A[0].p[0]);rp.t=s.t;api.apply(s.t);console.log('exact',__E.agents()[0].x,s.A[0].p[0],'mons',__E.mons().length);
process.exit(0);
