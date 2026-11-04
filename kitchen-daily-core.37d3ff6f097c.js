/* Daily kitchen suggestions. Pure helpers: no storage, DOM, network or inventory writes. */
(function(root){
 'use strict';
 const C=root.FridgeCore||(typeof require==='function'?require('./fridge-core.js'):null);
 const identity=name=>name;
 const cap=(limit,fallback)=>Number.isInteger(limit)&&limit>=0?Math.min(limit,50):fallback;

 // A recent entry is only an editable draft. Dates, batch IDs and stock are never copied.
 function normalizeRecent(entries,canonical=identity,limit=8){
  const result=[],seen=new Set(),max=cap(limit,8);
  for(const item of Array.isArray(entries)?entries:[]){
   if(result.length>=max)break;
   if(!item||typeof item.name!=='string'||typeof item.unit!=='string')continue;
   const name=canonical(item.name.trim()),unit=item.unit.trim(),qty=Number(item.qty);
   if(typeof name!=='string'||!name.trim()||!unit||!Number.isFinite(qty)||qty<=0||qty>100000||C.isCondiment(name)||name==='水')continue;
   const key=JSON.stringify([name,unit]);if(seen.has(key))continue;
   seen.add(key);result.push({name,qty,unit});
  }
  return result;
 }
 function rememberRecent(entries,successfulBatch,canonical=identity,limit=8){
  return normalizeRecent([successfulBatch,...(Array.isArray(entries)?entries:[])],canonical,limit);
 }

 function resolveRecipe(dish,recipes){
  if(!dish||typeof dish!=='object')return null;
  return (dish.id!=null?recipes.find(r=>r.id===dish.id):null)||recipes.find(r=>r.name===dish.name)||null;
 }
 // Feedback belongs to a meal. The most recent meal containing this dish decides its status.
 function bestDishes(records,recipes,limit=8){
  recipes=Array.isArray(recipes)?recipes:[];
  const rows=(Array.isArray(records)?records:[]).map((record,index)=>({record,index,time:Date.parse(record?.at)||0}))
   .filter(x=>x.record&&Array.isArray(x.record.dishes)).sort((a,b)=>b.time-a.time||a.index-b.index);
  const byDish=new Map();
  for(const {record} of rows){
   const mealSeen=new Set();
   for(const dish of record.dishes){
    if(!dish||typeof dish.name!=='string'||!dish.name.trim())continue;
    const recipe=resolveRecipe(dish,recipes),key=recipe?'recipe:'+String(recipe.id??recipe.name):'missing:'+String(dish.id??dish.name);
    if(mealSeen.has(key))continue;mealSeen.add(key);
    const existing=byDish.get(key);if(existing){existing.count++;continue;}
    const f=record.feedback||{};
    byDish.set(key,{recipe,id:recipe?.id??dish.id??null,name:recipe?.name||dish.name,note:typeof f.note==='string'?f.note:'',at:record.at,people:record.people,count:1,available:Boolean(recipe),mealWide:record.dishes.length>1,qualified:f.taste==='味道好'&&Array.isArray(f.tags)&&f.tags.includes('愿意再做')});
   }
  }
  return [...byDish.values()].filter(x=>x.qualified).slice(0,cap(limit,8)).map(({qualified,...row})=>row);
 }

 function ageOf(date,today){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return null;
  const time=Date.parse(date+'T00:00:00Z');
  if(!Number.isFinite(time)||new Date(time).toISOString().slice(0,10)!==date)return null;
  return C.days(date,today);
 }
 function defaultMissingTools(recipe,state){
  const tools=Array.isArray(state.tools)?state.tools:[];
  return (recipe.tools||[]).filter(group=>!Array.isArray(group)||!group.some(tool=>tools.includes(tool)||(tool==='炖锅'&&tools.includes('汤锅'))));
 }
 function dueSuggestions({state,recipes,sources=name=>[name],missingTools,preferenceCompare=()=>0,today=C.today(),limit=3}={}){
  if(!state||!Array.isArray(state.inventory)||!Array.isArray(recipes)||!Number.isInteger(state.people)||state.people<1||state.people>12)return [];
  const inventory=state.inventory,planNames=Array.isArray(state.plan)?state.plan:[],planned=planNames.map(name=>recipes.find(r=>r.name===name));
  const toolsMissing=missingTools||(recipe=>defaultMissingTools(recipe,state));
  if(new Set(planNames).size!==planNames.length||planned.some(r=>!r||toolsMissing(r).length))return [];
  const condiments=Array.isArray(state.condiments)?state.condiments:[];
  let reserved;try{reserved=C.allocate(inventory,planned,state.people,sources,condiments);}catch{return [];}
  if(!reserved.ok)return [];
  const batches=new Map(reserved.inventory.map(b=>[b.batchId,b])),suggestions=[];
  for(const recipe of recipes){
   if(!recipe||planNames.includes(recipe.name)||toolsMissing(recipe).length||!Array.isArray(recipe.ingredients)||!recipe.ingredients.length)continue;
   try{
    // Each card is an alternative on top of the selected menu, never a promise about all cards together.
    if(!C.allocate(inventory,[...planned,recipe],state.people,sources,condiments).ok)continue;
    const allocation=C.allocate(reserved.inventory,[recipe],state.people,sources,condiments);
    if(!allocation.ok)continue;
    const used=allocation.used.map(item=>{const batch=batches.get(item.batchId);return {...item,storedOn:batch?.storedOn||null,age:ageOf(batch?.storedOn,today),remindDays:Number.isInteger(batch?.remindDays)&&batch.remindDays>0?batch.remindDays:3};});
    const dueUsed=used.filter(item=>item.age!==null&&item.age>=item.remindDays);
    if(!dueUsed.length)continue;
    suggestions.push({recipe,used,dueUsed,oldestDays:Math.max(...dueUsed.map(x=>x.age)),overdueDays:Math.max(...dueUsed.map(x=>x.age-x.remindDays)),batchShare:dueUsed.reduce((sum,x)=>sum+x.qty/batches.get(x.batchId).qty,0)});
   }catch{/* A malformed recipe cannot make a stock recommendation. */}
  }
  suggestions.sort((a,b)=>b.oldestDays-a.oldestDays||b.overdueDays-a.overdueDays||b.batchShare-a.batchShare||preferenceCompare(a.recipe,b.recipe)||(Number(a.recipe.minutes)||Infinity)-(Number(b.recipe.minutes)||Infinity)||String(a.recipe.name).localeCompare(String(b.recipe.name),'zh-CN'));
  return suggestions.slice(0,cap(limit,3)).map(({overdueDays,batchShare,...row})=>row);
 }
 const api={normalizeRecent,rememberRecent,resolveRecipe,bestDishes,dueSuggestions};
 root.KitchenDailyCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
