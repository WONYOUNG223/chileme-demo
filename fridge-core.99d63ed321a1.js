/* Pure inventory accounting. No DOM, network or persistence side effects. */
(function(root){
 'use strict';
 const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
 function days(date,now=today()) { if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return null; const n=(Date.parse(now+'T00:00:00Z')-Date.parse(date+'T00:00:00Z'))/86400000;return Number.isFinite(n)&&n>=0?Math.floor(n):null; }
 const unit=(a,b)=>a===b?1:({克:1,千克:1000}[a]&&{克:1,千克:1000}[b]?{克:1,千克:1000}[a]/{克:1,千克:1000}[b]:{毫升:1,升:1000}[a]&&{毫升:1,升:1000}[b]?{毫升:1,升:1000}[a]/{毫升:1,升:1000}[b]:null);
 const condimentNames=['食用油','盐','醋','酱油','生抽','老抽','料酒','蚝油','白糖','芝麻油','米醋','白胡椒粉','黑胡椒粉','豆瓣酱','番茄酱','甜面酱','蒸鱼豉油','橄榄油','咖喱粉','干辣椒','花椒','椒盐粉','孜然粉','芝麻酱'];
 const isCondiment=name=>condimentNames.includes(name);
 function migrateCondiments(state,canonical=n=>n){
  state.condiments=Array.isArray(state.condiments)?[...new Set(state.condiments.map(canonical).filter(isCondiment))]:[];
  if(state.condimentsVersion!==1){const old=state.inventory.filter(x=>isCondiment(canonical(x.name)));state.legacyCondimentInventory=[...(state.legacyCondimentInventory||[]),...old];for(const x of old)if(x.qty>0&&!state.condiments.includes(canonical(x.name)))state.condiments.push(canonical(x.name));state.inventory=state.inventory.filter(x=>!isCondiment(canonical(x.name)));state.condimentsVersion=1;}
 }
 function allocate(inventory,recipes,people,sources=n=>[n],condiments=null) {
  if(!Number.isInteger(people)||people<1||people>12)throw Error('人数无效');
  const stock=inventory.map(x=>({...x})),needs=new Map(),used=[];
  for(const r of recipes)for(const [rawName,q,u] of r.ingredients){const name=sources(rawName)[0]||rawName;if(name==='水')continue;if(!Number.isFinite(q)||q<=0)throw Error('菜谱用量无效');const k=name+'|'+u;const n=needs.get(k)||{name,unit:u,qty:0};n.qty+=q*people;needs.set(k,n);}
  const missing=[];
  for(const n of [...needs.values()].sort((a,b)=>sources(a.name).length-sources(b.name).length)){
   if(condiments!==null&&isCondiment(n.name)){n.presenceOnly=true;if(!condiments.includes(n.name))missing.push({...n,qty:1,unit:'种（未勾选拥有）'});continue;}
   let left=n.qty;
   for(const name of sources(n.name)){
    const batches=stock.filter(x=>x.name===name).sort((a,b)=>(a.storedOn||'9999').localeCompare(b.storedOn||'9999'));
    for(const b of batches){const f=unit(b.unit,n.unit);if(!f||b.qty<=0)continue;const take=Math.min(left,b.qty*f);if(take>1e-8){b.qty=Math.max(0,b.qty-take/f);used.push({batchId:b.batchId,name:b.name,qty:take/f,unit:b.unit});left-=take;}if(left<=1e-8)break;}
    if(left<=1e-8)break;
   }
   if(left>1e-8)missing.push({...n,qty:left});
  }
  return {ok:!missing.length,missing,used,inventory:stock.filter(x=>x.qty>1e-8),needs:[...needs.values()]};
 }
 function finish(state,recipes,feedback,sources,token){
  if(!recipes.length||new Set(recipes.map(r=>r.name)).size!==recipes.length)throw Error('请选择本次做完的菜');
  if((state.mealRecords||[]).some(x=>x.id===token))throw Error('这顿饭已经记录过了');
  if(recipes.some(r=>!state.plan.includes(r.name)))throw Error('计划已变化，请重新选择');
  if(!['好复刻','难复刻','一般'].includes(feedback.reproduce)||!['味道好','一般','不好吃'].includes(feedback.taste))throw Error('请填写复刻难度和口味评价');
  const a=allocate(state.inventory,recipes,state.people,sources,state.condiments??null);
  if(!a.ok)throw Error('库存不足，请先修正实际库存或菜谱用量，再确认完成');
  const record={id:token,at:new Date().toISOString(),people:state.people,dishes:recipes.map(r=>({id:r.id,name:r.name})),feedback,used:a.used};
  return {...state,inventory:a.inventory,plan:state.plan.filter(n=>!recipes.some(r=>r.name===n)),bought:{},mealRecords:[record,...(state.mealRecords||[])]};
 }
 const api={today,days,unit,allocate,finish,condimentNames,isCondiment,migrateCondiments};root.FridgeCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
