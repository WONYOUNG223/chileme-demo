/* Speech is explicit, local to the device, and never changes cooking or stock state. */
(function(root){
 'use strict';
 function create({nativeHandler=null,synth=null,Utterance=null,canSpeak=()=>true,onChange=()=>{},setTimer=setTimeout,clearTimer=clearTimeout}){
  let active=null,serial=0,timer=null;
  const available=Boolean(nativeHandler||(synth&&Utterance));
  const publish=(busy,message)=>onChange({busy,message,available});
  const clear=()=>{if(timer!==null)clearTimer(timer);timer=null;};
  function stop(message='朗读已停止'){
   const hadSpeech=Boolean(active);active=null;clear();
   if(hadSpeech){try{if(nativeHandler)nativeHandler.postMessage({action:'stop'});else synth.cancel();}catch{}}
   publish(false,available?message:'当前环境不支持朗读，请查看文字步骤');
  }
  function receive(event){
   if(!active||event?.id!==active.id)return;
   if(event.status==='started'){clear();publish(true,'正在朗读 · 点击按钮可停止');return;}
   if(!['ended','cancelled','error'].includes(event.status))return;
   active=null;clear();publish(false,event.status==='error'?(event.message||'朗读未能开始，请检查系统语音后重试'):event.status==='ended'?'朗读完毕':'朗读已停止');
  }
  function speak(raw){
   if(!available){publish(false,'当前环境不支持朗读，请查看文字步骤');return false;}
   if(!canSpeak())return false;
   const text=String(raw||'').trim().slice(0,3000);if(!text)return false;
   stop('');const id='cook-speech-'+Date.now()+'-'+(++serial);active={id};publish(true,'正在准备朗读…');
   timer=setTimer(()=>{if(active?.id===id)stop('朗读未能开始，请检查设备声音与中文语音后重试');},10000);
   try{
    if(nativeHandler)nativeHandler.postMessage({action:'speak',id,text});
    else{
     const utterance=new Utterance(text);utterance.lang='zh-CN';utterance.rate=.92;
     const voice=synth.getVoices?.().find(v=>/^zh(-|_)/i.test(v.lang));if(voice)utterance.voice=voice;
     utterance.onstart=()=>receive({id,status:'started'});
     utterance.onend=()=>receive({id,status:'ended'});
     utterance.onerror=()=>receive({id,status:'error',message:'朗读暂不可用，请检查设备声音与中文语音后重试'});
     active.utterance=utterance;synth.speak(utterance);
    }
    return true;
   }catch{stop('朗读暂不可用，请稍后重试');return false;}
  }
  return {available,speak,stop,receive,isSpeaking:()=>Boolean(active)};
 }
 const api={create};root.CookingSpeech=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
/* Additive shopping and guided-cooking UI; inventory accounting stays in FridgeCore. */
if(typeof document!=='undefined')(()=>{
 'use strict';
 // Page and modal scrolling are independent; each receives its own accessible shortcut.
 function installScrollTop(target){
  if(target.querySelector(':scope > .scroll-to-top'))return;
  const button=document.createElement('button');button.type='button';button.className='scroll-to-top';button.textContent='↑';button.title='回到顶部';button.setAttribute('aria-label','回到顶部');button.hidden=true;
  target.prepend(button);
  const isPage=target===document.body,scroller=isPage?window:target;
  const update=()=>{const show=(isPage?window.scrollY:target.scrollTop)>=300;if(isPage){button.hidden=!show;}else{button.hidden=false;button.style.visibility=show?'visible':'hidden';button.tabIndex=show?0:-1;button.setAttribute('aria-hidden',String(!show));}};
  button.onclick=()=>{const behavior=matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth';scroller.scrollTo({top:0,behavior});};
  scroller.addEventListener('scroll',update,{passive:true});update();
 }
 installScrollTop(document.body);
 document.querySelectorAll('dialog').forEach(installScrollTop);
 new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.matches('dialog'))installScrollTop(n);n.querySelectorAll('dialog').forEach(installScrollTop);}}))).observe(document.body,{childList:true,subtree:true});
 const h=window.KitchenAccess,C=window.CookingCore,$=s=>document.querySelector(s),esc=h.escape;
 const key='chileme-cooking-v1';let session=null,detailRecipe=null,audio=null,notificationStatus='尚未开启锁屏提醒';
 let spokenReminders=false,speechState={busy:false,message:'点一下朗读，可随时停止。'},lastForegroundSpeechTick=null;
 try{spokenReminders=localStorage.getItem('chileme-cook-spoken-reminders')==='true';}catch{}
 const speaker=window.CookingSpeech.create({nativeHandler:window.webkit?.messageHandlers?.cookingSpeech,synth:window.speechSynthesis,Utterance:window.SpeechSynthesisUtterance,canSpeak:()=>Boolean(session)&&location.hash==='#cooking'&&!document.hidden,onChange:value=>{speechState=value;renderSpeechState();}});
 function renderSpeechState(){
  const button=$('#cook-read-step'),status=$('#cook-speech-status');
  if(button){button.textContent=speechState.busy?'停止朗读':'朗读这一步';button.setAttribute('aria-pressed',String(speechState.busy));button.disabled=!speaker.available;}
  if(status)status.textContent=speaker.available?speechState.message:'当前环境不支持朗读，请查看文字步骤';
 }
 function resetSpeech(){lastForegroundSpeechTick=null;speaker.stop('点一下朗读，可随时停止。');}
 window.addEventListener('chileme:speech-status',e=>speaker.receive(e.detail));
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&saved.recipe?.timeline?.length&&Number.isInteger(saved.step)&&saved.step>=0&&saved.step<saved.recipe.timeline.length&&Number.isFinite(saved.anchor)&&Number.isFinite(saved.offset)&&Array.isArray(saved.notified))session=saved;}catch{}
 const page=document.createElement('section');page.id='cooking';page.className='page workspace-page';page.hidden=true;$('#plan').after(page);
 // Keep the original button and handler, but place it next to the actual inventory.
 const generate=$('#generate-plan');generate.textContent='用这些食材生成食谱 →';$('.inventory-surface').append(generate);
 const purchase=document.createElement('details');purchase.id='purchase-panel';purchase.className='flow-panel';purchase.innerHTML='<summary>待买食材 <span id="purchase-count"></span></summary><p>只记录你明确选择“没有，要买”的缺项。按已选菜和待买菜合并需求，再扣除库存；不会重复计算同一道菜。</p><div id="purchase-items"></div><div id="purchase-recipes"></div>';
 $('#plan .recipe-controls').before(purchase);
 document.querySelectorAll('[data-nav="shopping"]').forEach(x=>x.remove());
 document.querySelectorAll('.workflow a[href="#shopping"]').forEach(x=>{x.href='#cooking';x.innerHTML='<span>3</span>跟着做饭';});
 const workflowMenu=document.createElement('a');workflowMenu.href='#cooking';workflowMenu.dataset.nav='cooking';workflowMenu.textContent='跟着做饭';$('.site-menu-nav a[href="#plan"]').after(workflowMenu);
 $('#plan .next-step').style.display='none';
 document.querySelectorAll('a[href="#shopping"]').forEach(x=>{x.href='#plan';x.addEventListener('click',()=>{purchase.open=true;setTimeout(()=>purchase.scrollIntoView({block:'start'}),0);});});
 const resumeBox=document.createElement('div');resumeBox.className='flow-resume';$('#selected-meal-plan').prepend(resumeBox);
 // A compact menu stays visible while the existing detailed cards remain available.
 const menuPreview=document.createElement('div');menuPreview.className='plan-menu-preview';menuPreview.setAttribute('aria-label','本次已选菜');
 const menuDetails=document.createElement('details');menuDetails.className='plan-menu-details';menuDetails.innerHTML='<summary>查看已选菜与调整</summary>';
 $('#meals').before(menuPreview,menuDetails);menuDetails.append($('#meals'));
 $('#selected-meal-plan > .fridge-actions').before(menuPreview);
 $('#finish-meal').classList.replace('primary','ghost');$('#finish-meal').textContent='已做好，直接记录';
 $('#view-diary').textContent='用餐记录';
 $('#plan .page-intro h1').textContent='今天吃什么';
 $('#plan .recipe-library-heading h2').textContent='从家里的食材开始选';
 const themes={default:['默认','default'],spicy:['香辣 · 暖橘','spicy'],sweet:['酸甜 · 杏黄','sweet'],light:['清淡 · 草绿','light'],fresh:['鲜香 · 青蓝','fresh'],rich:['浓郁 · 暖棕','rich']};
 const curated={'番茄炒蛋':'sweet','糖醋排骨':'sweet','红烧排骨':'rich','红烧肉':'rich','辣椒炒肉':'spicy','清蒸鲈鱼':'fresh'};
 function safe(fn){try{return fn();}catch(e){h.toast(e.message||'操作未完成，请重试');}}
 function bridge(action,events=[]){const handler=window.webkit?.messageHandlers?.cooking;if(handler)handler.postMessage({action,events:events.map((e,i)=>({id:'cook-'+i,at:e.at,title:session?.recipe.name||'做饭提醒',body:e.text}))});}
 function syncNative(){bridge('sync',session?C.schedule(session,Date.now()):[]);}
 function saveClock(next){if(!next||next.id!==session?.id||next.step!==session?.step||(!next.running&&session?.running))resetSpeech();if(next)localStorage.setItem(key,JSON.stringify(next));else localStorage.removeItem(key);session=next;syncNative();}
 function beep(){try{if(!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=740;g.gain.value=.12;o.start();o.stop(audio.currentTime+.3);}catch{}}
 function unlockAudio(){try{const A=window.AudioContext||window.webkitAudioContext;if(A){audio=audio||new A();audio.resume();}}catch{}}
 function format(ms){const secs=Math.max(0,Math.ceil(ms/1000));return String(Math.floor(secs/60)).padStart(2,'0')+':'+String(secs%60).padStart(2,'0');}
 function cleanChoices(){return (h.state().shoppingChoices||[]).filter(x=>h.recipes.some(r=>r.id===x.recipeId));}
 function buy(r,n){h.change(next=>{next.shoppingChoices=cleanChoices();if(!next.shoppingChoices.some(x=>x.recipeId===r.id&&x.name===n.name))next.shoppingChoices.push({recipeId:r.id,name:n.name});});purchase.open=true;h.toast('已加入待买清单，尚未增加库存');}
 function removeBuy(name){h.change(next=>{next.shoppingChoices=cleanChoices().filter(x=>x.name!==name);});}
 function refill(n){h.add(n.name,n.presenceOnly?1:n.qty,n.presenceOnly?'份':n.unit);}
 function shortageRows(box,items,recipe){
  box.innerHTML=items.length?items.map((n,i)=>'<article class="flow-shortage"><div><strong>'+esc(n.name)+'</strong><p>'+(n.presenceOnly?'常备调味品 · 未勾选拥有':'还缺 '+h.fmt(n.qty)+' '+esc(n.unit)+'（补录的是新增数量）')+'</p></div><div class="flow-actions"><button data-refill="'+i+'">'+(n.presenceOnly?'我有，直接勾选':'家里有，补录库存')+'</button>'+(recipe?'<button data-buy="'+i+'">'+(cleanChoices().some(x=>x.recipeId===recipe.id&&x.name===n.name)?'已加入待买清单':'没有，加入待买')+'</button>':'<button data-arrived="'+i+'">买到了，录入冰箱</button><button data-remove-buy="'+i+'">移出清单</button>')+'</div></article>').join(''):'<p>没有待补缺项。买到后仍需确认实际数量，才会进入库存。</p>';
  box.querySelectorAll('[data-refill],[data-arrived]').forEach(x=>x.onclick=()=>safe(()=>refill(items[Number(x.dataset.refill??x.dataset.arrived)])));
  box.querySelectorAll('[data-buy]').forEach(x=>{const n=items[Number(x.dataset.buy)];x.disabled=cleanChoices().some(c=>c.recipeId===recipe.id&&c.name===n.name);x.onclick=()=>safe(()=>buy(recipe,n));});
  box.querySelectorAll('[data-remove-buy]').forEach(x=>x.onclick=()=>safe(()=>removeBuy(items[Number(x.dataset.removeBuy)].name)));
 }
 function refreshPurchase(){
  const items=C.shopping(h.state(),h.recipes,h.allocation);$('#purchase-count').textContent='· '+items.length+' 项';
  shortageRows($('#purchase-items'),items);
  const ids=[...new Set(cleanChoices().map(x=>x.recipeId))];
  $('#purchase-recipes').innerHTML=ids.map(id=>{const r=h.recipes.find(x=>x.id===id);return '<div class="purchase-recipe"><button data-wanted="'+esc(id)+'">查看待做菜：'+esc(r.name)+'</button><button data-drop-wanted="'+esc(id)+'">不买这道菜的材料了</button></div>';}).join('');
  $('#purchase-recipes').querySelectorAll('[data-wanted]').forEach(x=>x.onclick=()=>h.openRecipe(h.recipes.find(r=>r.id===x.dataset.wanted)));
  $('#purchase-recipes').querySelectorAll('[data-drop-wanted]').forEach(x=>x.onclick=()=>safe(()=>h.change(next=>{next.shoppingChoices=cleanChoices().filter(c=>c.recipeId!==x.dataset.dropWanted);})));
 }
 function enhanceRecipe(r){
  detailRecipe=r;$('#flow-recipe-shortages')?.remove();
  const planned=h.state().plan.map(n=>h.recipes.find(x=>x.name===n)).filter(Boolean),combined=planned.some(x=>x.id===r.id)?planned:[...planned,r];
  const missing=h.allocation(combined).missing,section=document.createElement('section');section.id='flow-recipe-shortages';section.className='flow-panel';
  section.classList.toggle('flow-ready',!missing.length);
  section.innerHTML=missing.length?'<h3>还差这些食材</h3><p>已合并核对这道菜与已选菜单的用量。忘记录入的可以补录，没有的再加入待买。</p><div></div>':'<p>✓ 食材用量与常备调味品已齐'+(h.missingTools(r).length?' · 还需确认厨具':' · 已合并核对已选菜单')+'</p>';
  const recipeTitle=$('#recipe-detail h2');if(recipeTitle)recipeTitle.after(section);else $('#recipe-detail').prepend(section);
  if(missing.length)shortageRows(section.querySelector('div'),missing,r);
  if(h.state().plan.includes(r.name)&&h.allocation([r]).ok&&!h.missingTools(r).length){const start=document.createElement('button');start.className='button primary full';start.textContent='开始跟做这道菜';start.onclick=()=>safe(()=>startRecipe(r));section.prepend(start);}
 }
 function startRecipe(r){
  if(session){location.hash='cooking';renderCooking();h.toast('先完成或结束当前跟做，再开始另一道菜');return;}
  if(!h.state().plan.includes(r.name)||!h.allocation(h.state().plan.map(n=>h.recipes.find(x=>x.name===n)).filter(Boolean)).ok||h.missingTools(r).length)throw Error('请先补齐材料、数量和厨具，再加入开饭计划');
  unlockAudio();const recipe=JSON.parse(JSON.stringify(r));recipe.timeline=recipe.timeline.map(s=>({...s,text:h.stepText(r,s.text)}));
  const next=C.create(recipe,h.state().people,Date.now(),crypto.randomUUID());next.theme=curated[r.name]||'default';
  saveClock(next);$('#recipe-dialog').close();location.hash='cooking';renderCooking();renderResume();
 }
 function startFromPlan(){
  if(session){location.hash='cooking';renderCooking();return;}
  const selected=h.recipes.filter(r=>h.state().plan.includes(r.name));if(!selected.length)return;
  if(selected.length===1){safe(()=>startRecipe(selected[0]));return;}
  page.innerHTML='<div class="flow-panel"><h1>这次先做哪一道？</h1><p>一次专注一道菜，避免多个锅的提醒混在一起。</p>'+selected.map(r=>'<button class="cook-choice" data-cook-choice="'+esc(r.id)+'">'+esc(r.name)+'</button>').join('')+'</div>';
  page.querySelectorAll('[data-cook-choice]').forEach(x=>x.onclick=()=>safe(()=>startRecipe(selected.find(r=>r.id===x.dataset.cookChoice))));location.hash='cooking';
 }
 function renderResume(){resumeBox.innerHTML=session?'<a href="#cooking">继续跟做：'+esc(session.recipe.name)+' · 第 '+(session.step+1)+' 步 →</a>':'';$('#start-meal').textContent=session?'继续做饭':'开始做饭';$('#start-meal').onclick=startFromPlan;
  const selected=h.recipes.filter(r=>h.state().plan.includes(r.name));
  const toolbar=$('#selected-meal-plan .plan-toolbar');
  if(selected.length)menuDetails.querySelector('summary').after(toolbar);else menuPreview.before(toolbar);
  $('#selected-meal-plan > .fridge-actions').hidden=!selected.length;
  menuPreview.innerHTML=selected.length?selected.map(r=>'<button type="button" data-preview-recipe="'+esc(r.id)+'"><span>'+esc(r.name)+'</span><small>'+esc(r.time||'查看做法')+' ›</small></button>').join(''):'<p>从下面选一道菜，开始准备这一顿。</p>';
  menuPreview.querySelectorAll('[data-preview-recipe]').forEach(b=>b.onclick=()=>h.openRecipe(selected.find(r=>r.id===b.dataset.previewRecipe)));
  menuDetails.hidden=!selected.length;menuDetails.querySelector('summary').textContent='查看 '+selected.length+' 道菜的用量与调整';
 }
 function renderCooking(){
  if(!session){page.dataset.taste='default';page.innerHTML='<div class="flow-panel"><h1>跟着步骤，做好这一顿。</h1><p>先在食谱页选好菜，再点击“开始做饭”。</p><a class="button primary" href="#plan">去选择菜谱</a></div>';return;}
  const s=session,step=s.recipe.timeline[s.step],last=s.step===s.recipe.timeline.length-1;
  const settingsOpen=Boolean($('#cook-settings')?.open),focused=document.activeElement?.id;
  page.dataset.taste=s.theme||'default';
  page.innerHTML=`<div class="cook-header"><a href="#plan">‹ 返回选菜 · 计时保留</a><span>${s.people} 人份</span></div>
   <div class="cook-heading"><h1>${esc(s.recipe.name)}</h1><span>第 ${s.step+1} / ${s.recipe.timeline.length} 步</span></div>
   <progress class="cook-progress" max="${s.recipe.timeline.length}" value="${s.step+1}" aria-label="当前步骤进度"></progress>
   <section class="cook-main flow-panel">
    <p class="cook-step-label">现在做什么</p><h2 id="cook-step-title" tabindex="-1">${esc(step.title)}</h2>
    <p class="cook-instruction">${esc(step.text)}</p><p class="cook-heat">${esc(step.heat||'火候以步骤说明为准')}</p><div class="cook-step-actions"><button type="button" id="cook-read-step" aria-pressed="false" aria-describedby="cook-speech-status">朗读这一步</button><button type="button" id="ask-cook-step">问灶王爷这一步</button></div><p id="cook-speech-status" class="fridge-note" role="status" aria-live="polite"></p>
    <div class="cook-timer"><div><div id="cook-time" class="cook-clock" role="timer" aria-label="本步骤剩余时间"></div><p id="cook-status" role="status"></p></div><div class="cook-timer-actions"><button id="cook-pause">${s.running?'暂停':'继续'}</button><button id="cook-extend">＋ 1 分钟</button></div></div>
    <p id="cook-alert" role="alert"></p><p class="cook-next-preview">接下来 · ${last?'确认熟度，记录这一餐':esc(s.recipe.timeline[s.step+1].title)}</p>
    <p class="cook-warning">时间到了也请检查熟度，确认完成后再进入下一步。</p>
   </section>
   <details id="cook-settings" class="flow-panel cook-settings" ${settingsOpen?'open':''}><summary>主题与提醒设置 <span id="cook-notification-summary"></span></summary><label>口味主题<select id="cook-theme">${Object.entries(themes).map(([v,[label]])=>'<option value="'+v+'" '+(v===s.theme?'selected':'')+'>'+label+'</option>').join('')}</select></label><div class="cook-notifications"><button id="cook-enable-notifications">开启 iPhone 锁屏提醒</button><p id="cook-native-status"></p></div><label class="cook-speech-setting"><input id="cook-spoken-reminders" type="checkbox" ${spokenReminders?'checked':''} ${speaker.available?'':'disabled'}>计时到点时朗读提醒</label><p class="fridge-note">仅在跟做页面打开时朗读；锁屏仍使用系统通知。步骤需要你确认后继续。</p><p id="cook-elapsed"></p><button id="cook-stop">结束本次跟做（不扣库存）</button></details>
   <details class="flow-panel"><summary>查看完整步骤 · ${s.recipe.timeline.length} 步</summary><ol>${s.recipe.timeline.map((x,i)=>'<li'+(i===s.step?' aria-current="step"':'')+'><strong>'+esc(x.title)+' · '+esc(x.durationLabel||'')+'</strong><p>'+esc(x.text)+'</p></li>').join('')}</ol><p>参考时长不会判断食物是否熟透。炖煮请确认煮沸转小火后再按相应时长操作，必要时暂停或加时。</p></details>
   <div class="cook-controls"><span>步骤由你确认后继续</span><button id="cook-next" class="flow-primary">${last?'做好了，记录这一餐':'这步做好了，下一步 →'}</button></div>`;
  $('#cook-theme').onchange=e=>safe(()=>{saveClock({...session,theme:e.target.value});page.dataset.taste=e.target.value;});
  $('#cook-read-step').onclick=()=>{if(speaker.isSpeaking())speaker.stop();else speaker.speak('第 '+(session.step+1)+' 步，'+step.title+'。'+step.text+'。'+(step.heat||''));};
  $('#cook-spoken-reminders').onchange=e=>{spokenReminders=e.target.checked;try{localStorage.setItem('chileme-cook-spoken-reminders',String(spokenReminders));}catch{}if(!spokenReminders&&speaker.isSpeaking())speaker.stop();};
  renderSpeechState();
  $('#ask-cook-step').onclick=()=>window.KitchenAI?.openContext({recipeName:s.recipe.name,stepTitle:step.title,instruction:step.text});
  $('#cook-pause').onclick=()=>safe(()=>{unlockAudio();saveClock(session.running?C.pause(session,Date.now()):C.resume(session,Date.now()));renderCooking();});
  $('#cook-extend').onclick=()=>safe(()=>{saveClock(C.extend(session));renderCooking();});
  $('#cook-next').onclick=()=>safe(()=>{
   if(!last){saveClock(C.next(session,Date.now()));renderCooking();$('#cook-step-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});return;}
   saveClock(C.pause(session,Date.now()));renderCooking();
   if(h.state().people!==session.people)throw Error('用餐人数已变化，请先恢复为 '+session.people+' 人，再记录，避免扣错数量');
   if(!h.state().plan.includes(session.recipe.name))throw Error('这道菜已不在计划，请返回选菜检查');
   h.finish(session.recipe.id);
  });
  $('#cook-stop').onclick=()=>{const d=document.createElement('dialog');d.className='fridge-dialog';d.innerHTML='<h2 tabindex="-1" autofocus>结束本次跟做？</h2><p>停止所有计时与提醒，不扣库存，不生成用餐记录。</p><button data-stop-confirm>确认结束</button><button data-stop-cancel>继续做饭</button>';document.body.append(d);d.onclose=()=>d.remove();d.showModal();d.querySelector('[data-stop-cancel]').onclick=()=>d.close();d.querySelector('[data-stop-confirm]').onclick=()=>safe(()=>{saveClock(null);d.close();renderCooking();renderResume();});};
  $('#cook-enable-notifications').onclick=()=>{unlockAudio();if(window.webkit?.messageHandlers?.cooking){bridge('authorize');}else{notificationStatus='网页预览仅支持页面内提醒；锁屏提醒请在 iPhone App 内开启。';$('#cook-native-status').textContent=notificationStatus;}};
  $('#cook-native-status').textContent=notificationStatus;updateNotificationSummary();tick();
  if(['cook-pause','cook-extend'].includes(focused))document.getElementById(focused)?.focus({preventScroll:true});
 }
 function updateNotificationSummary(){const label=$('#cook-notification-summary');if(label)label.textContent=notificationStatus==='尚未开启锁屏提醒'?'未开启锁屏提醒':notificationStatus;}
 function tick(){
  if(!session){lastForegroundSpeechTick=null;return;}
  const now=Date.now(),due=C.due(session,now);
  // Read new cues only after continuous foreground ticking. Returning from another
  // tab, lock screen, or a suspended app must not read accumulated overdue cues.
  const foreground=session.running&&location.hash==='#cooking'&&!document.hidden;
  const announce=foreground&&lastForegroundSpeechTick!==null&&now-lastForegroundSpeechTick>=0&&now-lastForegroundSpeechTick<=2000;
  lastForegroundSpeechTick=foreground?now:null;
  if(due.length){try{saveClock({...session,notified:[...session.notified,...due.map(x=>x.id)],lastAlert:due.map(x=>x.text).join(' ')});if(session.running){beep();if(spokenReminders&&announce&&!speaker.isSpeaking())speaker.speak(due.map(x=>x.text).join('。')+'。请检查当前步骤，确认后再继续。');}}catch(e){h.toast('计时状态保存失败，请检查存储空间');}}
  if($('#cook-time')){$('#cook-time').textContent=format(C.remaining(session,now));$('#cook-status').textContent=!session.running?'已暂停':C.remaining(session,now)===0?'建议时间已到 · 等待你确认完成':'本步骤剩余时间';$('#cook-alert').textContent=session.lastAlert||'';$('#cook-elapsed').textContent='本次跟做已开始 '+format(now-session.createdAt)+'（包含暂停与检查时间）';}
 }
 window.addEventListener('chileme:notification-status',e=>{notificationStatus=e.detail?.message||'通知状态已更新';if($('#cook-native-status'))$('#cook-native-status').textContent=notificationStatus;updateNotificationSummary();if(e.detail?.authorized)syncNative();});
 window.addEventListener('chileme:inventory-change',()=>queueMicrotask(()=>{
  refreshPurchase();renderResume();
  if(detailRecipe&&$('#recipe-dialog').open)h.openRecipe(detailRecipe);
  if(session&&(h.state().mealRecords||[]).some(r=>Date.parse(r.at)>=session.createdAt&&r.dishes.some(d=>d.id===session.recipe.id))){safe(()=>saveClock(null));renderResume();renderCooking();location.hash='plan';}
 }));
 window.addEventListener('storage',e=>{if(e.key===key){try{resetSpeech();session=JSON.parse(e.newValue||'null');renderCooking();renderResume();syncNative();}catch{}}else if(e.key==='chileme-v1'){queueMicrotask(refreshPurchase);}});
 window.addEventListener('hashchange',()=>{lastForegroundSpeechTick=null;if(location.hash!=='#cooking')resetSpeech();if(location.hash==='#cooking'&&!page.querySelector('[data-cook-choice]'))renderCooking();if(location.hash==='#shopping'){purchase.open=true;purchase.scrollIntoView({block:'start'});}});
 document.addEventListener('visibilitychange',()=>{lastForegroundSpeechTick=null;if(document.hidden)resetSpeech();else{tick();syncNative();}});
 window.addEventListener('pagehide',resetSpeech);
 window.KitchenFlow={enhanceRecipe,isCooking:()=>Boolean(session)};
 refreshPurchase();renderResume();renderCooking();syncNative();setInterval(tick,500);
 if(location.hash==='#cooking'){document.querySelectorAll('.page').forEach(x=>x.hidden=x!==page);}
})();
