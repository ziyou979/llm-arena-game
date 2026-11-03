// v5.1 回归：keep、加点自动结束、点名范围、简报警告与价格
import fs from 'fs';
const T=JSON.parse(fs.readFileSync(new URL('../.arena-tokens.json',import.meta.url)));
const U='http://127.0.0.1:8799/mcp/'+T['4'];let i=0;
const c=async(n,a)=>{const r=await fetch(U,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++i,method:'tools/call',params:{name:n,arguments:a||{}}})});const j=await r.json();return (j.result.isError?'ERR ':'')+j.result.content[0].text};
const sleep=ms=>new Promise(z=>setTimeout(z,ms));
await sleep(1500);
await c('join',{name:'Probe'});await c('setup_character',{stats:[8,5,7,2,3,5],weapon:'sword'});
let t=await c('wait_for_event',{format:'report',timeout_seconds:40});console.log(t.split('\n').slice(0,2).join('\n'));
console.log('act no plan:',await c('act',{}));
console.log(await c('act',{plan:[{type:'hunt',p:16,n:6},{type:'capture',p:16}],thought:'练级'}));
let keeps=0,autos=0,warns=new Set(),price=false;
for(let k=0;k<14;k++){t=await c('wait_for_event',{format:'report',timeout_seconds:30});
 const head=t.split('\n')[0];if(t.includes('💰'))price=true;for(const l of t.split('\n'))if(l.startsWith('⚠ 目标'))warns.add(l);
 if(!head.startsWith('【需要你决策】'))continue;
 if(t.includes('结盟请求：')){console.log('pact ->',(await c('answer_pact',{accept:false,say:'不了'})).slice(0,120));continue}
 const pts=(t.match(/有 (\d+) 点没分配/)||[])[1];
 if(pts){const r=await c('allocate_points',{str:+pts});if(r.includes('turnEnded'))autos++;console.log('alloc ->',r.slice(0,140));continue}
 if(head.includes('计划还在跑')){const r=await c('act',{keep:true,thought:'不变'});keeps++;console.log('keep ->',r.slice(0,100))}
 else console.log(await c('act',{plan:[{type:'capture',p:17},{type:'hunt',p:17,n:4}],thought:'下一块'}));
 if(k==3)console.log('talk @1:',await c('talk',{text:'合作？',to:1}));
}
// 立刻再 wait：确认没有重复的「需要你决策」
console.log('keeps',keeps,'autoEnd',autos,'price line',price);console.log([...warns].join('\n'));
const s=await c('situation');console.log(s);
process.exit(0)
