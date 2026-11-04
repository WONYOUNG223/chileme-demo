/* Mobile app navigation shell. Does not change recipes or inventory accounting. */
(()=>{
 'use strict';
 const $=s=>document.querySelector(s),h=window.KitchenAccess;
 document.body.classList.add('app-shell');
 const icons={home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',community:'<path d="M20 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 18 0Z"/><path d="M7 10h10M7 14h6"/>',ai:'<path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6Z"/>',plan:'<path d="M12 5v16M3 4h5a4 4 0 0 1 4 2 4 4 0 0 1 4-2h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z"/>',account:'<circle cx="12" cy="8" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>'};
 const icon=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[name]+'</svg>';
 const nav=document.createElement('nav');nav.className='app-tabbar';nav.setAttribute('aria-label','底部导航');
 nav.innerHTML=[['home','首页'],['community','社区'],['ai','灶王爷'],['plan','食谱'],['account','我的']].map(([id,label])=>'<a href="#'+id+'" data-tab="'+id+'"'+(id==='ai'?' class="app-ai-tab" aria-label="灶王爷，厨房 AI 助手"':'')+'><span class="app-tab-icon'+(id==='ai'?' app-zao-icon':'')+'">'+(id==='ai'?'<img src="assets--brand--zaowang-mascot.webp" alt="" width="48" height="48">':icon(id))+'</span><span>'+label+'</span></a>').join('');document.body.append(nav);
 const ai=document.createElement('section');ai.id='ai';ai.className='page workspace-page app-ai-page';ai.hidden=true;ai.innerHTML='<div class="ai-orbit">'+icon('ai')+'</div><span class="app-kicker">你的随身厨房搭子</span><h1>不会做的，<br>以后就问 AI。</h1><p>陪你弄懂火候、步骤和调味，<br>让每一道菜都更有把握。</p><span class="app-status-pill">尚未接入 · 暂不提供回答</span><div class="ai-question-preview"><span>未来可以这样问</span><p>“炒鸡蛋怎样才会嫩？”</p><p>“这一步应该用多大的火？”</p><p>“这道菜没有料酒怎么办？”</p></div><a class="button primary" href="#plan">先看看详细食谱</a>';document.querySelector('main').append(ai);
 const welcome=document.createElement('section');welcome.id='welcome-login';welcome.className='welcome-login';welcome.innerHTML='<span class="app-kicker">从今天，好好吃饭</span><h2>让冰箱里的食材，<br>变成今天的一顿好饭。</h2><p>录入食材 → 选择食谱 → 跟着做饭<br>做完记录这一餐，库存随之更新。</p>';$('#home').append(welcome);welcome.append($('#auth-panel'));
 const loginShortcut=document.createElement('button');loginShortcut.type='button';loginShortcut.className='welcome-shortcut';loginShortcut.textContent='已有账号？直接登录';$('#home').prepend(loginShortcut);
 function showLogin(){welcome.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});}
 loginShortcut.onclick=showLogin;
 $('#home').addEventListener('click',e=>{if(!e.target.closest('a[href^="#"]'))return;e.preventDefault();e.stopImmediatePropagation();showLogin();},true);
 const account=$('#account'),hero=document.createElement('section');hero.className='app-profile-card';hero.innerHTML='<div class="app-avatar">'+icon('account')+'</div><div><span class="app-kicker">我的厨房</span><h1 id="app-user-name">我的厨房</h1><p id="app-user-status"></p></div>';account.prepend(hero);
 const stats=document.createElement('div');stats.className='app-personal-stats';stats.innerHTML='<div><strong id="app-stock-count">0</strong><span>库存批次</span></div><div><strong id="app-meal-count">0</strong><span>用餐记录</span></div><div><strong id="app-plan-count">0</strong><span>计划菜品</span></div>';hero.after(stats);
 const links=document.createElement('div');links.className='app-personal-links';links.innerHTML='<a href="#ingredients"><span>我的冰箱<small>食材、调味品与厨具</small></span><b>›</b></a><button type="button" id="app-open-diary"><span>餐桌日记<small>查看做过的菜和自己的评价</small></span><b>›</b></button><a href="#plan"><span>我的开饭计划<small>准备好下一顿</small></span><b>›</b></a>';stats.after(links);
 const details=document.createElement('details');details.className='app-account-details';details.innerHTML='<summary>账号与个人资料<span>登录 / 管理 ›</span></summary>';links.after(details);details.append($('#account .account-layout'));
 const note=document.createElement('p');note.className='app-local-note';note.textContent='库存与餐桌日记目前保存在本机，不代表已同步到账号。社区与云端账号等待接入。';details.after(note);
 $('#app-open-diary').onclick=()=>{location.hash='plan';requestAnimationFrame(()=>requestAnimationFrame(()=>$('#meal-diary').scrollIntoView({behavior:'smooth',block:'start'})));};
 const header=$('.site-header');const title=document.createElement('span');title.className='app-header-title';header.append(title);
 const back=document.createElement('a');back.className='app-back';back.textContent='‹';back.setAttribute('aria-label','返回');header.prepend(back);
 const titles={home:'好好吃饭',ingredients:'我的冰箱',plan:'食谱与计划',cooking:'跟着做饭',community:'饭友社区',account:'我的',membership:'会员计划',ai:'厨房 AI'};
 // Keep the original introduction route, but make it the signed-out entrance.
 const firstTab=nav.querySelector('[data-tab="home"]');firstTab.href='#ingredients';firstTab.dataset.tab='ingredients';firstTab.lastElementChild.textContent='冰箱';firstTab.querySelector('svg').innerHTML='<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 9h14M8 5v2M8 12v4"/>';
 let previousUser=window.ChiLeMeCloud?.user?.id||null;
 function render(){
  const signedIn=!!window.ChiLeMeCloud?.user;
  let route=location.hash.slice(1)||'home';const loginRequested=!signedIn&&route!=='home';
  if(!signedIn)route='home';else if(route==='home')route='ingredients';
  if(location.hash!=='#'+route){history.replaceState(null,'','#'+route);window.dispatchEvent(new HashChangeEvent('hashchange'));if(loginRequested)requestAnimationFrame(showLogin);return;}
  document.body.classList.toggle('app-welcome',!signedIn);
  document.querySelectorAll('.page').forEach(p=>p.hidden=p.id!==route);
  $('.site-header .brand').href=signedIn?'#ingredients':'#home';$('.site-header .brand').setAttribute('aria-label',signedIn?'我的冰箱':'吃了么介绍');
  const active=['plan','cooking','shopping'].includes(route)?'plan':route==='membership'?'account':route;
  nav.querySelectorAll('a').forEach(a=>{const on=a.dataset.tab===active;a.classList.toggle('selected',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  title.textContent=titles[route]||'好好吃饭';document.body.dataset.appPage=route;
  back.hidden=!['cooking','membership'].includes(route);back.href=route==='membership'?'#account':'#plan';
  const s=h.state();$('#app-stock-count').textContent=s.inventory.length;$('#app-meal-count').textContent=(s.mealRecords||[]).length;$('#app-plan-count').textContent=s.plan.length;
  const cloud=window.ChiLeMeCloud,user=cloud?.user;$('#app-user-name').textContent=user?.user_metadata?.username||'我的厨房';$('#app-user-status').textContent=user?(user.email||'已登录'):cloud?.ready?'尚未登录 · 本机厨房可以继续使用':'本机体验中 · 账号服务尚未连接';
  note.textContent='库存与餐桌日记目前保存在本机，不代表已同步到账号。'+(cloud?.ready?'账号与社区已配置连接。':'社区与云端账号等待接入。');
 }
 nav.addEventListener('click',e=>{const a=e.target.closest('a');if(a&&a.hash===location.hash)window.scrollTo({top:0,behavior:'smooth'});});
 function keyboard(){
  const editing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||''),v=window.visualViewport;
  document.body.classList.toggle('app-keyboard-open',!!(editing&&v&&window.innerHeight-v.height>140));
  // Only the chat layout consumes these values; other pages retain normal scrolling.
  document.documentElement.style.setProperty('--app-viewport-height',(v?.height||window.innerHeight)+'px');
  document.documentElement.style.setProperty('--app-viewport-top',(v?.offsetTop||0)+'px');
 }
 window.visualViewport?.addEventListener('resize',keyboard);window.visualViewport?.addEventListener('scroll',keyboard);window.addEventListener('resize',keyboard);
 document.addEventListener('focusin',keyboard);document.addEventListener('focusout',()=>setTimeout(keyboard,0));keyboard();
 window.addEventListener('hashchange',render);window.addEventListener('chileme:auth',render);window.addEventListener('chileme:inventory-change',()=>queueMicrotask(render));
 render();if(location.hash==='#ai')document.querySelectorAll('.page').forEach(p=>p.hidden=p!==ai);
 window.addEventListener('chileme:auth',()=>{const current=window.ChiLeMeCloud?.user?.id||null;if(current!==previousUser){previousUser=current;location.hash=current?'ingredients':'home';if(!current)requestAnimationFrame(showLogin);}});
})();
