import fs from 'fs';
const T=JSON.parse(fs.readFileSync(new URL('../.arena-tokens.json',import.meta.url)));
const U='http://127.0.0.1:8799/mcp/'+T['4'];let i=0;
const c=async(n,a)=>{const r=await fetch(U,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++i,method:'tools/call',params:{name:n,arguments:a||{}}})});const j=await r.json();return j.result.content[0].text};
await new Promise(z=>setTimeout(z,1500));
console.log(await c('join',{name:'Probe'}));
await c('setup_character',{stats:[8,5,7,2,3,5],weapon:'sword'});
for(let k=0;k<6;k++){const t0=Date.now();const t=await c('wait_for_event',{format:'report',timeout_seconds:40});const dt=Date.now()-t0;
 console.log('--- wait',dt,'ms'); if(k==1||k==5)console.log(t); else console.log(t.split('\n').slice(0,4).join('\n'));
 if(t.includes('结盟请求'))console.log('pact:',await c('answer_pact',{accept:true}));
 const t1=Date.now();console.log((await c('act',{plan:[{type:'hunt',p:16,n:2},{type:'capture',p:16}],thought:'练级占地'})).slice(0,100),'act',Date.now()-t1,'ms');
 if(k>=3)console.log('ally:',await c('talk',{text:'我去16，你守北边',ally:true}));}
process.exit(0)
