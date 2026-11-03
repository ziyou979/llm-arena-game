var POL={};
(function(){const orig=brain;
 const nearestPlot=(a,f)=>plots.filter(f).sort((p,q)=>dist(a,{x:p.cx,y:p.cy})-dist(a,{x:q.cx,y:q.cy}))[0];
 const P={
  smart:orig,
  heur:(a,ev)=>brainHeur(a,ev),
  // 不动脑：只刷离自己最近的同级怪，从不占地、不买东西、不结盟
  dumb:(a,ev)=>{allocate(a);a.pending.length=0;const p=nearestPlot(a,p=>p.lv<=Math.max(1,a.lvl))||plots.find(p=>p.lv==1);a.plan=[{t:'hunt',p:p.id,n:6}]},
  // 一句话策略：刷到 2 级后见地就占最近的，钱够买武器
  simple:(a,ev)=>{allocate(a);a.pending.length=0;const plan=[];if(a.wt<1&&a.gold>=price(a,'weapon'))plan.push({t:'buy',item:'weapon'});
   if(a.lvl>=2){const p=nearestPlot(a,p=>p.owner!=a.id&&p.lv<=a.lvl+1&&!outZone({x:p.cx,y:p.cy},4));if(p)plan.push({t:'capture',p:p.id})}
   const h=nearestPlot(a,p=>p.lv<=Math.max(1,a.lvl)&&!outZone({x:p.cx,y:p.cy},3))||plots.find(p=>p.lv==1);plan.push({t:'hunt',p:h.id,n:4});a.plan=plan},
  // 一句话策略 + 守家：同上，但自己的地没守卫且有钱就招 2 个
  simpleG:(a,ev)=>{P.simple(a,ev);const mine=plots.filter(p=>p.owner==a.id&&hires(p).length<2);if(mine.length&&a.gold>=GCOST*2+10)a.plan.unshift({t:'recruit',p:mine[0].id,n:2})},
  // 随机：从合法指令里乱选
  rand:(a,ev)=>{allocate(a);a.pending.length=0;const ps=plots.filter(p=>!outZone({x:p.cx,y:p.cy},2));const pk=()=>ps[Math.floor(R()*ps.length)]||plots[0];const opts=[()=>({t:'hunt',p:pk().id,n:4}),()=>({t:'capture',p:pk().id}),()=>({t:'buy',item:pick(['weapon','armor','potion','helmet'])}),()=>({t:'town',k:pick(['inn','tavern','smith'])})];a.plan=[0,1,2].map(()=>pick(opts)())}
 };
 brain=function(a,ev){const f=P[POL[a.id]]||orig;return f(a,ev)}})();
