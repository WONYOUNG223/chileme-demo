/* Small daily shortcuts. Uses the existing stock ledger and recipe flow. */
(()=>{
 'use strict';
 const h=window.KitchenAccess,D=window.KitchenDailyCore,C=window.FridgeCore;
 if(!h||!D)return;
 const $=s=>document.querySelector(s),esc=h.escape;
 const recent=document.createElement('section');recent.id='recent-ingredients';recent.className='daily-recent';recent.setAttribute('aria-label','最近买过的食材');
 $('#ingredients .fresh-shortcuts').before(recent);
 const suggestions=document.createElement('section');suggestions.id='daily-fridge-picks';suggestions.className='daily-picks';suggestions.setAttribute('aria-label','今天先吃这些');
 $('.fridge-entry').append(suggestions);
 const best=document.createElement('details');best.id='my-best-dishes';best.className='daily-best';
 $('#plan .recipe-controls').before(best);
 let activeRepeat=null,queued=false,lastDay=C.today();

 function recentItems(){return D.normalizeRecent(h.state().recentIngredients??[...h.state().inventory].reverse(),h.canonical);}
 function renderRecent(){
  const items=recentItems();recent.hidden=!items.length;
  recent.innerHTML='<div class="daily-section-label"><strong>最近买过</strong><span>确认数量后，再放一批</span></div><div class="daily-recent-list">'+items.map((x,i)=>'<button type="button" data-recent="'+i+'"><span>'+esc(x.name)+'</span><small>上次 '+h.fmt(x.qty)+' '+esc(x.unit)+'</small><b aria-hidden="true">＋</b></button>').join('')+'</div>';
  recent.querySelectorAll('[data-recent]').forEach(button=>button.onclick=()=>{const item=items[Number(button.dataset.recent)];h.add(item.name,item.qty,item.unit);});
 }
 function recordNote(record){return typeof record?.feedback?.note==='string'?record.feedback.note:'';}
 function repeatRecipe(dish,record){
  const recipe=D.resolveRecipe(dish,h.recipes);
  if(!recipe){h.toast('这道菜暂时不在菜谱库，原来的用餐记录仍保留');return;}
  activeRepeat={id:recipe.id,name:recipe.name,note:recordNote(record),mealWide:(record?.dishes?.length||0)>1,people:record?.people};
  location.hash='plan';h.openRecipe(recipe);renderRepeatNote(recipe);
 }
 function renderRepeatNote(recipe){
  $('#daily-repeat-note')?.remove();
  if(!activeRepeat||recipe.id!==activeRepeat.id||recipe.name!==activeRepeat.name)return;
  const note=document.createElement('aside');note.id='daily-repeat-note';note.className='daily-repeat-note';
  note.innerHTML='<strong>再做一次，照顾好今天的胃口</strong><p>本次按 '+h.state().people+' 人份核对库存与已选菜单'+(activeRepeat.people?'；上次为 '+esc(activeRepeat.people)+' 人份':'')+'。</p>'+(activeRepeat.note?'<p class="daily-personal-note"><span>'+(activeRepeat.mealWide?'上次这顿饭的心得':'上次自己的心得')+'</span>'+esc(activeRepeat.note)+'</p>':'')+'<small>用量以当前菜谱为准；加入计划不会扣库存。</small>';
  $('#recipe-detail h2').after(note);
 }
 function renderBest(){
  const open=best.open,items=D.bestDishes(h.state().mealRecords,h.recipes);
  best.innerHTML='<summary><span>我的拿手菜 <small>'+items.length+' 道</small></span><span class="daily-disclosure" aria-hidden="true">⌄</span></summary><p class="daily-help">最近一次评价为「味道好」且「愿意再做」的菜，会收在这里。</p><div class="daily-best-list">'+(items.length?items.map((x,i)=>'<article><div><h3>'+esc(x.name)+'</h3><small>做过 '+x.count+' 次'+(x.people?' · 上次 '+esc(x.people)+' 人份':'')+'</small>'+(x.note?'<p>'+esc(x.note)+'</p>':'')+'</div><button type="button" data-best="'+i+'" '+(x.available?'':'disabled')+'>'+(x.available?'再做一次':'菜谱暂缺')+'</button></article>').join(''):'<div class="daily-best-empty">做好一顿饭后，记下你的感受。喜欢的菜，下次在这里找。</div>')+'</div>';
  best.open=open;
  best.querySelectorAll('[data-best]').forEach(button=>button.onclick=()=>{const item=items[Number(button.dataset.best)];repeatRecipe(item.recipe,{people:item.people,dishes:item.mealWide?[{},{}]:[{}],feedback:{note:item.note}});});
 }
 function pickCard(item,index){
  const r=item.recipe,first=[...item.dueUsed].sort((a,b)=>b.age-a.age)[0],other=item.dueUsed.length-1;
  return '<article class="daily-pick-card"><div class="daily-pick-copy"><span class="daily-pick-age">'+esc(first.name)+'已放 '+first.age+' 天</span><h3>'+esc(r.name)+'</h3><p>用掉这批 '+esc(first.name)+' '+h.fmt(first.qty)+' '+esc(first.unit)+(other?'，还用到 '+other+' 批到提醒时间的食材':'')+'</p><small>'+h.state().people+' 人份'+(r.time?' · '+esc(r.time):'')+'</small></div><div class="daily-pick-actions"><button type="button" data-pick-view="'+index+'">看做法</button><button type="button" data-pick-add="'+index+'">加入这顿饭</button></div></article>';
 }
 function renderPicks(){
  const state=h.state(),due=state.inventory.filter(x=>{const age=C.days(x.storedOn);return age!==null&&age>=(x.remindDays||3);});
  const items=D.dueSuggestions({state,recipes:h.recipes,sources:h.sources,missingTools:h.missingTools,preferenceCompare:(a,b)=>window.RecipePreferences.compare(a,b,state.recipePreferences)});
  suggestions.hidden=!due.length;
  if(!due.length){suggestions.replaceChildren();return;}
  const expanded=Boolean(suggestions.querySelector('details')?.open);
  suggestions.innerHTML='<div class="daily-picks-heading"><span class="daily-zao-face" aria-hidden="true"><img src="assets--brand--zaowang-mascot.webp" alt=""></span><div><h2>今天先吃这些</h2><p>灶王爷帮你用好冰箱里的食材</p></div></div>'+(items.length?pickCard(items[0],0)+(items.length>1?'<details '+(expanded?'open':'')+'><summary>换个做法看看 · '+(items.length-1)+' 道</summary>'+items.slice(1).map((x,i)=>pickCard(x,i+1)).join('')+'</details>':'')+'<p class="daily-help">已避开菜单预留的用量。每道是一个选项，加入后会重新推荐。</p>':'<p class="daily-picks-empty">有 '+due.length+' 批食材到了提醒时间。现有数量、厨具或已选菜单下，暂时没有可直接加入的新菜。</p><a class="daily-text-link" href="#plan">去食谱页查看缺项与计划 →</a>')+'<p class="daily-safety-note">按存放时间提醒，不代表食材仍可安全食用。</p>';
  suggestions.querySelectorAll('[data-pick-view]').forEach(button=>button.onclick=()=>{location.hash='plan';h.openRecipe(items[Number(button.dataset.pickView)].recipe);});
  suggestions.querySelectorAll('[data-pick-add]').forEach(button=>button.onclick=()=>{
   const recipe=items[Number(button.dataset.pickAdd)].recipe;
   try{
    if(h.state().plan.includes(recipe.name))throw Error('这道菜已经在开饭计划里');
    const planned=h.state().plan.map(n=>h.recipes.find(r=>r.name===n));
    if(planned.some(r=>!r)||[...planned,recipe].some(r=>h.missingTools(r).length)||!h.allocation([...planned,recipe]).ok)throw Error('库存或计划已变化，请重新选择');
    h.change(next=>{next.plan.push(recipe.name);});
    h.toast('已加入这顿饭，做完并记录后才扣库存');
    location.hash='plan';
   }catch(error){h.toast(error.message);queueRender();}
  });
 }
 function enhanceDiary(){
  $('#meal-diary').querySelectorAll('.meal-record').forEach(article=>{
   if(article.querySelector('.daily-repeat-actions'))return;
   const record=h.state().mealRecords?.find(x=>x.id===article.querySelector('[data-remove-record]')?.dataset.removeRecord);if(!record)return;
   const actions=document.createElement('div');actions.className='daily-repeat-actions';
   for(const dish of record.dishes){
    const recipe=D.resolveRecipe(dish,h.recipes),button=document.createElement('button');button.type='button';button.disabled=!recipe;button.textContent=(record.dishes.length>1?dish.name+' · ':'')+(recipe?'再做一次':'菜谱暂缺');button.onclick=()=>repeatRecipe(dish,record);actions.append(button);
   }
   article.querySelector('[data-remove-record]').before(actions);
  });
 }
 function render(){const day=C.today();if(day!==lastDay){lastDay=day;h.render();}renderRecent();renderBest();renderPicks();enhanceDiary();}
 function queueRender(){if(queued)return;queued=true;queueMicrotask(()=>{queued=false;render();});}
 new MutationObserver(enhanceDiary).observe($('#meal-diary'),{childList:true});
 for(const event of ['chileme:inventory-change','chileme:kitchen-render','focus','chileme:fridge-open'])window.addEventListener(event,queueRender);
 window.addEventListener('storage',e=>{if(e.key==='chileme-v1')queueRender();});
 window.addEventListener('hashchange',queueRender);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)queueRender();});
 window.addEventListener('chileme:recipe-open',e=>renderRepeatNote(e.detail.recipe));
 $('#recipe-dialog').addEventListener('close',()=>{activeRepeat=null;});
 render();
})();
