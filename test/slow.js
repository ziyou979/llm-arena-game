const U=process.argv[2];let i=0;
async function c(n,a){const r=await fetch(U,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++i,method:'tools/call',params:{name:n,arguments:a||{}}})});return (await r.json()).result}
(async()=>{await c('join',{name:'Sleepy'});await c('setup_character',{stats:[5,5,5,5,5,5],weapon:'sword'});
 const w=await c('wait_for_event',{timeout_seconds:30});console.log('got turn, now sleeping 100s');})();
