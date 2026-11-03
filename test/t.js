const U=process.argv[2];let i=0;
async function c(name,args){const r=await fetch(U,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++i,method:'tools/call',params:{name,arguments:args||{}}})});const j=await r.json();return j.result}
(async()=>{const t0=Date.now();
 let fails=0,n=0;
 const r0=await c('setup_character',{name:'Probe',stats:[5,5,5,5,5,5],weapon:'sword',sprite:{spec:'bad'}});console.log('bad sprite isError=',r0.isError,r0.content[0].text.slice(0,220));
 const r1=await c('setup_character',{stats:[6,6,6,4,4,4],weapon:'bow',spritePath:'/nonexist.json'});console.log('spritePath missing:',r1.isError,r1.content[0].text.slice(0,80));
 while(Date.now()-t0<35000){const r=await c('observe',{brief:true});n++;if(r.isError){fails++;console.log('ERR',r.content[0].text.slice(0,80))}await new Promise(z=>setTimeout(z,1300))}
 console.log('observe calls',n,'fails',fails);
 const w=await c('wait_for_event',{timeout_seconds:20,brief:true});const o=JSON.parse(w.content[0].text);console.log('wait lobby?',o.lobby,'started',o.started,'name',o.me&&o.me.name,'stats',o.me&&JSON.stringify(o.me.stats));
 if(o.zone)console.log('zone',JSON.stringify(o.zone),'plots',o.plots.length,'travel',o.plots[0].travelSec);
})();
