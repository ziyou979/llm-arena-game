const {createCanvas,GlobalFonts}=require('/tmp/cv/node_modules/@napi-rs/canvas');GlobalFonts.registerFromPath('/tmp/NotoSC.otf','sans-serif');GlobalFonts.registerFromPath('/tmp/NotoSC.otf','monospace');

const fs=require('fs');const file=process.argv[2],out=process.argv[3],secs=+process.argv[4]||200;
const html=fs.readFileSync(file,'utf8');
const sprites=html.match(/<script[^>]*id="spritesJSON"[^>]*>([\s\S]*?)<\/script>/)[1];
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
function stub(){const f=function(){return stub()};return new Proxy(f,{get(t,k){if(k===Symbol.toPrimitive)return()=>0;if(k==='then')return undefined;if(['width','height','clientWidth','clientHeight','offsetWidth'].includes(k))return 300;if(k==='length')return 0;if(k in t)return t[k];const v=stub();t[k]=v;return v},set(t,k,v){t[k]=v;return true}})}
const real={cv:createCanvas(48*16*2,52*16*2),mini:createCanvas(640,640)};
const els={};
global.document={getElementById:id=>id=='spritesJSON'?{textContent:sprites}:real[id]?Object.assign(real[id],{addEventListener(){},style:{},getBoundingClientRect:()=>({left:0,top:0,width:480,height:544})}):(els[id]||(els[id]=stub())),createElement:t=>t=='canvas'?createCanvas(1,1):stub(),querySelectorAll:()=>[],querySelector:()=>stub(),addEventListener(){},body:stub()};
global.window=global;global.addEventListener=()=>{};global.requestAnimationFrame=()=>0;global.innerWidth=480;global.innerHeight=900;global.devicePixelRatio=1;global.localStorage={getItem:()=>null,setItem(){}};global.matchMedia=()=>({matches:false,addEventListener(){}});global.setTimeout=()=>0;global.setInterval=()=>0;
let code=scripts.join('\n')+`\n;globalThis.__shot=function(secs,mode){init();if(typeof go=='function')go();for(let i=0;i<secs*10;i++)step(.1);FOLLOW=false;DIRECTOR=false;focus=null;
 if(mode=='city'){setZoom(2)}else if(mode=='far'){setZoom(3)}else setZoom(0);
 const t=agents.find(a=>!a.dead&&inTownE(a))||npcs.find(n=>n.kind=='tavern');const cxp=mode=='city'?H:mode=='far'?+process.env.FX:t.x,cyp=mode=='city'?H:mode=='far'?+process.env.FY:t.y;cam.x=cxp-VW/2;cam.y=cyp-VH/2;if(mode!='city'){for(const n of npcs)if(n.town&&dist(n,t)<9&&!n.bub)bub(n,townLine(n))}render();return [VW,VH,cv.width,cv.height]}`;
(0,eval)(code);
console.log(__shot(secs,process.argv[5]||''));
fs.writeFileSync(out,real.cv.toBuffer('image/png'));
if(process.argv[6]){const m=real.mini;fs.writeFileSync(process.argv[6],m.toBuffer('image/png'))}
