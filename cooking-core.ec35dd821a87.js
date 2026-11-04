/* Timestamp-based cooking clock. Pure functions; no inventory writes. */
(function(root){
 'use strict';
 const duration=step=>Math.max(1,Math.round((step.end-step.start)*60000));
 function create(recipe,people,now,id){
  if(!recipe.timeline?.length||recipe.timeline.some(s=>!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.end<=s.start))throw Error('这道菜缺少有效步骤时间，暂不能计时');
  return {id,recipe:JSON.parse(JSON.stringify(recipe)),people,step:0,offset:0,anchor:now,running:true,createdAt:now,notified:[],theme:'default'};
 }
 const elapsed=(s,now)=>s.offset+(s.running?Math.max(0,now-s.anchor):0);
 const remaining=(s,now)=>Math.max(0,duration(s.recipe.timeline[s.step])+(s.extra||0)-elapsed(s,now));
 function pause(s,now){return {...s,offset:elapsed(s,now),anchor:now,running:false};}
 function resume(s,now){return {...s,anchor:now,running:true};}
 function extend(s){return {...s,extra:(s.extra||0)+60000,notified:s.notified.filter(x=>x!==s.step+':end')};}
 function next(s,now){if(s.step>=s.recipe.timeline.length-1)throw Error('已到最后一步');return {...s,step:s.step+1,offset:0,anchor:now,running:true,extra:0,lastAlert:''};}
 // Explicitly reviewed intermediate cues from the current source recipes.
 const braises=new Set(['REC021','REC022','REC024','REC025','REC029','REC030','REC054','REC062']);
 function cues(s){
  const step=s.recipe.timeline[s.step],items=[],end=duration(step);
  if(s.step===3&&braises.has(s.recipe.id)){
   for(let ms=900000;ms<end;ms+=900000)items.push({id:s.step+':liquid:'+ms,at:ms,text:'查看液面，按菜谱判断是否需要沿锅边补热水。'});
   if(['REC024','REC029','REC030','REC062'].includes(s.recipe.id))items.push({id:s.step+':potato',at:end-1200000,text:'按本次份量加入土豆；查看步骤中的用量。'});
   if(s.recipe.id==='REC029')items.push({id:s.step+':mushroom',at:end-900000,text:'按本次份量加入香菇。'});
  }
  items.push({id:s.step+':end',at:end+(s.extra||0),text:'建议时间已到，请检查当前步骤完成情况；确认后再继续。'});
  return items.sort((a,b)=>a.at-b.at);
 }
 const due=(s,now)=>cues(s).filter(c=>c.at<=elapsed(s,now)&&!s.notified.includes(c.id));
 const schedule=(s,now)=>s.running?cues(s).filter(c=>c.at>elapsed(s,now)).map(c=>({id:c.id,at:now+c.at-elapsed(s,now),text:c.text})):[];
 function shopping(state,recipes,allocate){
  const choices=state.shoppingChoices||[],ids=new Set(choices.map(x=>x.recipeId)),wanted=recipes.filter(r=>ids.has(r.id)||state.plan.includes(r.name));
  const requested=new Set(choices.map(x=>x.name));
  return allocate(wanted).missing.filter(x=>requested.has(x.name));
 }
 const api={duration,create,elapsed,remaining,pause,resume,extend,next,cues,due,schedule,shopping};
 root.CookingCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
