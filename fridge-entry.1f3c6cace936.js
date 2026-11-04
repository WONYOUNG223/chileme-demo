(()=>{
'use strict';
const page=document.getElementById('ingredients');if(!page)return;
const storageKey='chileme-fridge-diy-v1';
const assets=[...['6211','6212','6213','6220','6221','6222','6223'].map(id=>'note-'+id),...['6230','6231','6232','6236','6237','6238','6239','6240','6242'].map(id=>'magnet-'+id)];
let decorations=[];try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(Array.isArray(saved))decorations=saved.filter(x=>assets.includes(x.asset)&&Number.isFinite(x.x)&&Number.isFinite(x.y)).slice(0,24).map(x=>({...x,x:Math.max(16,Math.min(77,x.x)),y:Math.max(12,Math.min(87,x.y)),text:String(x.text||'').slice(0,60)}));}catch{}
let selected=null,busy=false,opened=false,timer;
const entry=document.createElement('section');entry.className='fridge-entry';entry.dataset.mode='closed';entry.setAttribute('aria-label','我的冰箱');
entry.innerHTML=`<div class="fridge-heading"><div><h2>我的小冰箱</h2><p>把喜欢的贴上去，把今天的饭打开。</p></div><button type="button" class="fridge-small" id="fridge-close" hidden>关上冰箱</button></div><div class="fridge-layout"><div><div class="fridge-stage"><div class="fridge-cabinet"><div class="fridge-inside" aria-hidden="true"><span>🥚 🥛</span><span>🥬 🍅</span><span>🥕 🥦</span></div></div><div class="fridge-door"><span class="fridge-brand">吃了么</span><div class="fridge-decorations"></div><button type="button" class="fridge-handle" aria-label="拉开冰箱门，查看食材" aria-expanded="false"></button></div></div><p class="fridge-help">拖动便签和冰箱贴，布置自己的冰箱。</p></div><div class="fridge-toolbox"><h3>给冰箱一点个性</h3><p>点选喜欢的图案，贴到冰箱门上。</p><div class="fridge-assets" aria-label="便签和冰箱贴素材"></div><label for="fridge-note">写张便签</label><textarea id="fridge-note" maxlength="60" placeholder="比如：今晚记得好好吃饭。"></textarea><div class="fridge-tool-actions"><button type="button" class="fridge-small" id="fridge-add-note">贴上便签</button><button type="button" class="fridge-small" id="fridge-remove" disabled>移除选中贴纸</button></div><p id="fridge-status" role="status" aria-live="polite">装饰保存在当前设备。</p><button type="button" class="fridge-primary" id="fridge-open">打开冰箱，看看食材</button></div></div>`;
const intro=page.querySelector('.page-intro');intro.after(entry);
intro.querySelector('h1').textContent='我的冰箱';
intro.querySelector('p').textContent='先看看家里有什么，再决定今天吃什么。';
const direct=document.createElement('button');direct.type='button';direct.className='fridge-primary';direct.id='fridge-direct-open';direct.textContent='打开冰箱 · 查看库存';entry.querySelector('.fridge-heading').after(direct);
const toolbox=entry.querySelector('.fridge-toolbox'),customize=document.createElement('details');customize.className='fridge-customize';const summary=document.createElement('summary');summary.textContent='布置我的冰箱 · 贴纸与便签';toolbox.before(customize);customize.append(summary,toolbox);
const stockNote=document.createElement('p');stockNote.className='fridge-stock-summary';stockNote.setAttribute('aria-live','polite');direct.after(stockNote);
function refreshStock(){
 const inventory=window.ChiLeMe?.getInput().inventory||[],due=inventory.filter(x=>{const age=window.FridgeCore.days(x.storedOn);return age!==null&&age>=x.remindDays;});
 stockNote.textContent=inventory.length?'冰箱里有 '+inventory.length+' 批食材'+(due.length?' · '+due.length+' 批到提醒时间，优先查看':' · 打开查看数量和存放时间'):'冰箱还空着，打开后添加食材。';
 const inside=entry.querySelector('.fridge-inside');inside.replaceChildren();['冷冻','冷藏','常温'].forEach(zone=>{const line=document.createElement('span');line.textContent=zone+'：'+(inventory.filter(x=>x.zone===zone).map(x=>x.name).slice(0,3).join('、')||'暂无食材');inside.append(line);});
}
refreshStock();const display=document.getElementById('fridge-display');if(display)new MutationObserver(refreshStock).observe(display,{childList:true,subtree:true});
const workspace=[...page.children].filter(el=>el!==entry&&el!==intro);
const $=s=>entry.querySelector(s),stage=$('.fridge-stage'),door=$('.fridge-door'),layer=$('.fridge-decorations'),note=$('#fridge-note'),status=$('#fridge-status');
const transforms=document.createElement('fieldset');transforms.className='fridge-transform';transforms.innerHTML='<legend>调整选中贴纸</legend><label>大小 <output id="fridge-size-value">30%</output><input id="fridge-size" type="range" min="12" max="60" value="30" disabled></label><label>旋转 <output id="fridge-angle-value">0°</output><input id="fridge-angle" type="range" min="-180" max="180" value="0" disabled></label><div class="fridge-tool-actions"><button type="button" class="fridge-small" id="fridge-front" disabled>移到最上层</button><button type="button" class="fridge-small" id="fridge-reset" disabled>还原大小和角度</button></div>';
$('.fridge-tool-actions').before(transforms);
const fridgeScale=document.createElement('label');fridgeScale.className='fridge-scale';fridgeScale.innerHTML='冰箱大小 <input type="range" id="fridge-scale" min="75" max="115" value="100"><output>100%</output>';$('.fridge-help').before(fridgeScale);
// Keep daily actions beside the fridge; decoration controls live in the drawer.
stage.after(direct);
toolbox.prepend(fridgeScale);
toolbox.append($('.fridge-help'));
direct.textContent='查看食材 / 添加食材';
try{const v=Number(localStorage.getItem(storageKey+'-scale'));if(v>=75&&v<=115){$('#fridge-scale').value=v;stage.style.setProperty('--fridge-size',v/100);fridgeScale.querySelector('output').textContent=v+'%';}}catch{}
$('#fridge-scale').oninput=e=>{stage.style.setProperty('--fridge-size',e.target.value/100);fridgeScale.querySelector('output').textContent=e.target.value+'%';try{localStorage.setItem(storageKey+'-scale',e.target.value);}catch{}};
function syncControls(){const d=decorations.find(x=>x.id===selected);['#fridge-size','#fridge-angle','#fridge-front','#fridge-reset'].forEach(s=>$(s).disabled=!d);$('#fridge-size').value=d?.size||30;$('#fridge-angle').value=d?.turn||0;$('#fridge-size-value').textContent=(d?.size||30)+'%';$('#fridge-angle-value').textContent=(d?.turn||0)+'°';}
function updateTransform(){const d=decorations.find(x=>x.id===selected);if(!d)return;d.size=Number($('#fridge-size').value);d.turn=Number($('#fridge-angle').value);render();syncControls();save();}
$('#fridge-size').oninput=updateTransform;$('#fridge-angle').oninput=updateTransform;
$('#fridge-reset').onclick=()=>{const d=decorations.find(x=>x.id===selected);if(d){d.size=30;d.turn=0;render();syncControls();save();}};
$('#fridge-front').onclick=()=>{const d=decorations.find(x=>x.id===selected);if(d){decorations=decorations.filter(x=>x!==d);decorations.push(d);render();save();}};
function workspaceVisible(value){workspace.forEach(el=>{el.hidden=!value;});}
workspaceVisible(false);
function save(){try{localStorage.setItem(storageKey,JSON.stringify(decorations));status.textContent='装饰已自动保存。';}catch{status.textContent='此浏览器无法保存，装饰仅在本次访问保留。';}}
function select(id){selected=id;const d=decorations.find(x=>x.id===id);if(d?.asset.startsWith('note-'))note.value=d.text;$('#fridge-remove').disabled=!d;layer.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));syncControls();}
function render(){layer.replaceChildren();decorations.forEach(d=>{const b=document.createElement('button');b.type='button';b.className='fridge-decoration';b.dataset.id=d.id;b.style.left=d.x+'%';b.style.top=d.y+'%';b.style.setProperty('--turn',(d.turn||0)+'deg');b.setAttribute('aria-label',(d.asset.startsWith('note-')?'便签':'冰箱贴')+(d.text?'：'+d.text:'')+'；拖动或用方向键移动');b.setAttribute('aria-pressed',String(selected===d.id));const img=document.createElement('img');img.src='assets--fridge-diy--'+d.asset+'.webp';img.alt='';img.draggable=false;b.append(img);if(d.text){const text=document.createElement('span');text.textContent=d.text;b.append(text);}b.onclick=()=>select(d.id);
 b.onkeydown=e=>{const directions={ArrowLeft:[-2,0],ArrowRight:[2,0],ArrowUp:[0,-2],ArrowDown:[0,2]};if(directions[e.key]){e.preventDefault();select(d.id);move(d,d.x+directions[e.key][0],d.y+directions[e.key][1],b);save();}};
 b.onpointerdown=e=>{if(busy||opened)return;select(d.id);const bounds=door.getBoundingClientRect(),startX=e.clientX,startY=e.clientY,x=d.x,y=d.y;b.setPointerCapture(e.pointerId);b.onpointermove=ev=>move(d,x+(ev.clientX-startX)/bounds.width*100,y+(ev.clientY-startY)/bounds.height*100,b);const finish=()=>{b.onpointermove=null;b.onpointerup=null;b.onpointercancel=null;save();};b.onpointerup=finish;b.onpointercancel=finish;};layer.append(b);});}
function move(d,x,y,b){d.x=Math.max(16,Math.min(77,x));d.y=Math.max(12,Math.min(87,y));b.style.left=d.x+'%';b.style.top=d.y+'%';}
function add(asset,text=''){if(decorations.length>=24){status.textContent='最多贴 24 张，先移除一些再添加。';return;}const d={id:crypto.randomUUID(),asset,text,x:32+Math.random()*30,y:38+Math.random()*42,turn:Math.round(Math.random()*16-8)};decorations.push(d);selected=d.id;render();select(d.id);save();}
assets.forEach((asset,i)=>{const b=document.createElement('button');b.type='button';b.setAttribute('aria-label','添加'+(asset.startsWith('note-')?'便签':'冰箱贴')+' '+(i+1));const img=document.createElement('img');img.src='assets--fridge-diy--'+asset+'.webp';img.alt='';img.loading='lazy';b.append(img);b.onclick=()=>add(asset,asset.startsWith('note-')?note.value.trim():'');$('.fridge-assets').append(b);});
$('#fridge-add-note').onclick=()=>{if(!note.value.trim()){status.textContent='先写一点想提醒自己的话。';note.focus();return;}const d=decorations.find(x=>x.id===selected&&x.asset.startsWith('note-'));if(d){d.text=note.value.trim();render();save();}else add('note-6211',note.value.trim());};
$('#fridge-remove').onclick=()=>{decorations=decorations.filter(d=>d.id!==selected);select(null);render();save();};
function animate(open){if(busy)return;busy=true;clearTimeout(timer);if(!open){workspaceVisible(false);entry.dataset.mode='closed';stage.classList.add('is-open');}stage.getBoundingClientRect();requestAnimationFrame(()=>stage.classList.toggle('is-open',open));$('.fridge-handle').setAttribute('aria-expanded',String(open));$('#fridge-open').disabled=true;direct.disabled=true;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;timer=setTimeout(()=>{opened=open;busy=false;entry.dataset.mode=open?'inventory':'closed';workspaceVisible(open);$('#fridge-close').hidden=!open;$('#fridge-open').disabled=false;direct.disabled=false;direct.hidden=open;stockNote.hidden=open;if(open){window.dispatchEvent(new CustomEvent('chileme:fridge-open'));$('#fridge-close').focus({preventScroll:true});entry.scrollIntoView({block:'start',behavior:reduced?'instant':'smooth'});}else direct.focus({preventScroll:true});},reduced?0:1000);}
direct.onclick=()=>animate(true);$('#fridge-open').onclick=()=>animate(true);$('.fridge-handle').onclick=()=>animate(true);$('#fridge-close').onclick=()=>animate(false);
render();
// Width is stored with each decoration; keep pointer and keyboard positioning intact.
const observeSizes=new MutationObserver(()=>{layer.querySelectorAll('.fridge-decoration').forEach(b=>{const d=decorations.find(x=>x.id===b.dataset.id);b.style.width=Math.max(12,Math.min(60,Number(d?.size)||30))+'%';});});observeSizes.observe(layer,{childList:true});
layer.querySelectorAll('.fridge-decoration').forEach(b=>{const d=decorations.find(x=>x.id===b.dataset.id);b.style.width=Math.max(12,Math.min(60,Number(d?.size)||30))+'%';});
})();
