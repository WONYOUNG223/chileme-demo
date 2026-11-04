/* Load after app-shell.js. The cloud client owns authentication, request timeout,
 * and the service URL. Expected API:
 * askKitchenAI({message, history:[{role,content}], context}, {signal})
 *   -> Promise<{answer, remaining, model}>. No provider key belongs in this file.
 */
(()=>{
 'use strict';
 const page=document.getElementById('ai');if(!page)return;
 page.classList.add('kitchen-ai-page');
 page.innerHTML=`<header class="kitchen-ai-head"><div class="kitchen-ai-identity"><span class="kitchen-ai-avatar"><img src="assets--brand--zaowang-mascot.webp" alt="" width="44" height="44"></span><div><h1>灶王爷 <span>AI 助手</span></h1><p id="kitchen-ai-availability"></p></div></div><button type="button" id="kitchen-ai-clear" aria-label="清空当前对话">新对话</button></header>
 <div class="kitchen-ai-scroll" id="kitchen-ai-scroll">
 <div id="kitchen-ai-intro" class="kitchen-ai-intro"><div class="kitchen-ai-welcome"><div><span class="kitchen-ai-eyebrow">好好吃饭，慢慢来</span><h2>开火之前，<br>问问灶王爷。</h2><p>火候、调味、食材处理，<br>陪你做好这一顿。</p></div><img src="assets--brand--zaowang-mascot.webp" alt="微笑着拿着木勺的灶王爷" width="156" height="156"></div><p class="kitchen-ai-suggestions-label">不知道怎么问？试试这些</p><div class="kitchen-ai-starters"></div></div>
 <div id="kitchen-ai-messages" class="kitchen-ai-messages" role="log" aria-label="厨房问答" aria-live="polite" aria-relevant="additions"></div></div>
 <form id="kitchen-ai-form" class="kitchen-ai-composer">
 <div id="kitchen-ai-context" class="kitchen-ai-context" hidden><div><span>随本次问题发送</span><strong id="kitchen-ai-context-label"></strong></div><button type="button" id="kitchen-ai-context-remove" aria-label="取消附带当前步骤">×</button></div>
 <label class="kitchen-ai-sr-only" for="kitchen-ai-input">你的问题</label><div class="kitchen-ai-input-row"><textarea id="kitchen-ai-input" rows="1" maxlength="1000" placeholder="做饭哪里拿不准？" enterkeyhint="enter"></textarea>
 <div class="kitchen-ai-compose-actions"><button type="button" id="kitchen-ai-stop" aria-label="停止回答" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg></button><button type="submit" id="kitchen-ai-send" aria-label="发送问题"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></div></div>
 <div class="kitchen-ai-input-meta"><span>仅聊做饭相关问题</span><span id="kitchen-ai-count">0 / 1000</span></div>
 <p id="kitchen-ai-status" role="status" aria-live="polite"></p>
 <details class="kitchen-ai-notice"><summary>问题会交给智谱生成回答 <span>使用说明</span></summary><p class="kitchen-ai-footnote">问题、最近对话和附带步骤会发送至智谱。每天最多 10 问，失败或停止也可能占用次数。AI 建议可能不准确，请结合菜谱与实际食材判断；会话只在本次打开期间保留。</p><p class="kitchen-ai-model">GLM-4-Flash-250414 · 免费文字模型</p></details>
 </form>`;
 const $=s=>page.querySelector(s),input=$('#kitchen-ai-input'),send=$('#kitchen-ai-send'),stop=$('#kitchen-ai-stop'),status=$('#kitchen-ai-status'),log=$('#kitchen-ai-messages');
 const returnLink=document.createElement('a');returnLink.href='#cooking';returnLink.className='kitchen-ai-return';returnLink.textContent='‹ 返回正在做的菜';page.prepend(returnLink);
 const starters=[{label:'掌握火候',question:'炒鸡蛋怎样才会嫩？',icon:'<path d="M12 3c2 4-2 5 1 8 1-1 2-2 2-4 4 3 5 6 3 10a7 7 0 0 1-12 0C3 12 9 9 9 5c1 1 2 2 3 3"/>'},{label:'调味补救',question:'菜炒咸了，怎么补救？',icon:'<path d="M8 3h8M9 3v5l-3 4v7a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-7l-3-4V3M6 13h12M10 17h4"/>'},{label:'处理食材',question:'切菜时怎样避免生肉和蔬菜交叉污染？',icon:'<path d="M14 4c5 0 7 2 6 7-1 5-5 9-9 9-4 0-7-4-7-8 0-5 4-8 10-8ZM7 17 17 7M11 13l-1-4M11 13l5 1"/>'}];
 let history=[],entries=[],context=null,pending=null,serial=0,owner=window.ChiLeMeCloud?.user?.id||null;
 const enabled=()=>window.CHILEME_CLOUD?.kitchenAIEnabled===true;
 const signedIn=()=>Boolean(window.ChiLeMeCloud?.user);
 function availability(){
  return !enabled()?'接入准备中':!signedIn()?'登录后使用':typeof window.ChiLeMeCloud?.askKitchenAI!=='function'?'服务暂未就绪':'你的随身厨房搭子';
 }
 function update(){
  returnLink.hidden=!window.KitchenFlow?.isCooking();
  $('#kitchen-ai-availability').textContent=availability();
  send.disabled=!!pending||!enabled()||!signedIn()||typeof window.ChiLeMeCloud?.askKitchenAI!=='function'||!input.value.trim();
  send.hidden=!!pending;stop.hidden=!pending;
  $('#kitchen-ai-clear').disabled=!!pending||(!entries.length&&!input.value&&!context);
  $('#kitchen-ai-context-remove').disabled=!!pending;
  $('#kitchen-ai-count').textContent=input.value.length+' / 1000';
  $('#kitchen-ai-intro').hidden=entries.length>0||!!pending;
  $('#kitchen-ai-context').hidden=!context;
  $('#kitchen-ai-context-label').textContent=context?[context.recipeName,context.stepTitle].filter(Boolean).join(' · '):'';
  input.style.height='auto';input.style.height=Math.min(112,Math.max(44,input.scrollHeight))+'px';
 }
 function renderMessages(){
  log.replaceChildren();
  entries.forEach(entry=>{
   const article=document.createElement('article');article.className='kitchen-ai-message kitchen-ai-message--'+entry.role;
   const label=document.createElement('span');label.className='kitchen-ai-speaker';label.textContent=entry.role==='user'?'你':'灶王爷 · AI';
   if(entry.role==='assistant'){const avatar=document.createElement('img');avatar.src='assets--brand--zaowang-mascot.webp';avatar.alt='';avatar.width=30;avatar.height=30;label.prepend(avatar);}
   const body=document.createElement('p');body.textContent=entry.content;
   article.append(label,body);log.append(article);
  });
  if(pending){
   const question=document.createElement('article');question.className='kitchen-ai-message kitchen-ai-message--user';const body=document.createElement('p');body.textContent=pending.message;question.append(body);
   const thinking=document.createElement('p');thinking.className='kitchen-ai-thinking';thinking.textContent='灶王爷正在想办法…';log.append(question,thinking);
  }
  update();
 }
 function setStatus(message,error=false){status.textContent=message;status.classList.toggle('is-error',error);}
 function reset(){
  serial++;pending?.controller.abort();pending=null;history=[];entries=[];context=null;input.value='';setStatus('');renderMessages();
 }
 function cleanContext(value){
  if(!value||typeof value!=='object')return null;
  const text=(key,max)=>typeof value[key]==='string'?value[key].trim().slice(0,max):'';
  const next={recipeName:text('recipeName',80),stepTitle:text('stepTitle',100),instruction:text('instruction',1600)};
  return next.recipeName&&next.instruction?next:null;
 }
 starters.forEach(({label,question,icon})=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',question);b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icon+'</svg>';const text=document.createElement('span');text.textContent=label;b.append(text);b.onclick=()=>{input.value=question;update();input.focus();};$('.kitchen-ai-starters').append(b);});
 input.addEventListener('input',update);
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)&&!e.isComposing){e.preventDefault();$('#kitchen-ai-form').requestSubmit();}});
 $('#kitchen-ai-context-remove').onclick=()=>{context=null;update();};
 $('#kitchen-ai-clear').onclick=reset;
 stop.onclick=()=>{if(!pending)return;serial++;const draft=pending.message;pending.controller.abort();pending=null;if(!input.value)input.value=draft;setStatus('已停止，问题已保留。');renderMessages();};
 $('#kitchen-ai-form').addEventListener('submit',async e=>{
  e.preventDefault();if(pending)return;
  if(!enabled()){setStatus('接入准备中，可以先写下问题；服务开通后才能发送。');return;}
  if(!signedIn()){setStatus('请先登录后提问。',true);return;}
  const message=input.value.trim();if(!message)return;
  const cloud=window.ChiLeMeCloud;if(typeof cloud?.askKitchenAI!=='function'){setStatus('问答服务暂未就绪，请稍后再试。',true);return;}
  const id=++serial,controller=new AbortController(),attached=context?{...context}:null;
  pending={id,controller,message};setStatus('正在回答，可随时停止。');renderMessages();$('#kitchen-ai-scroll').scrollTo({top:$('#kitchen-ai-scroll').scrollHeight,behavior:'smooth'});
  try{
   // Only this question, up to six successful history messages, and an explicit
   // step attachment are sent. Do not read inventory, profile, email or account ID.
   const result=await cloud.askKitchenAI({message,history:history.slice(-6).map(x=>({...x})),context:attached},{signal:controller.signal});
   if(id!==serial||controller.signal.aborted)return;
   if(typeof result?.answer!=='string'||!result.answer.trim())throw Error('这次没有收到完整回答。');
   const answer=result.answer.trim().slice(0,12000);
   entries.push({role:'user',content:message},{role:'assistant',content:answer});entries=entries.slice(-12);
   const historyQuestion=attached?(message+'\n本次参考：'+attached.recipeName+' · '+attached.stepTitle+'\n'+attached.instruction.slice(0,350)).slice(0,1500):message;
   history.push({role:'user',content:historyQuestion},{role:'assistant',content:answer.slice(0,1500)});history=history.slice(-6);
   if(input.value.trim()===message)input.value='';
   context=null;
   pending=null;renderMessages();
   const remaining=Number.isFinite(result.remaining)?Math.max(0,Math.floor(result.remaining)):null;
   setStatus(remaining===null?'回答完成。':remaining?'回答完成 · 今日还可提问 '+remaining+' 次':'今日提问次数已用完，明天再来。');
   const scroller=$('#kitchen-ai-scroll'),last=log.lastElementChild;
   if(last)scroller.scrollTo({top:scroller.scrollTop+last.getBoundingClientRect().top-scroller.getBoundingClientRect().top-16,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  }catch(error){
   if(id!==serial)return;
   pending=null;setStatus((error?.name==='AbortError'?'回答已停止。':String(error?.message||'连接暂时失败。').slice(0,220))+' 问题已保留，点击发送可重试。',true);renderMessages();
  }
 });
 function authChanged(){const next=window.ChiLeMeCloud?.user?.id||null;if(next!==owner){owner=next;reset();}else update();}
 window.addEventListener('chileme:auth',authChanged);
 window.addEventListener('chileme:logout',()=>{owner=null;reset();});
 window.addEventListener('hashchange',()=>{if(location.hash==='#ai')update();});
 window.KitchenAI={openContext(value){
  if(pending){location.hash='ai';setStatus('请先停止当前回答，再附带新的步骤。');return;}
  context=cleanContext(value);update();location.hash='ai';
  if(context)setStatus('已附带当前步骤，发送前可以取消。');
 }};
 if(!enabled())setStatus('服务接入准备中，可以先写下问题。');
 update();
})();
