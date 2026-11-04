/* Ranking only: inventory and equipment eligibility remain owned by the kitchen. */
(function(root){
 'use strict';
 const tastes=['不限','清淡鲜香','香辣','麻辣','酸甜','蒜香','咸香'];
 const cuisines=['不限','家常风味','川湘风味','粤式风味','西式风味'];
 function normalize(p={}){return {taste:tastes.includes(p?.taste)?p.taste:'不限',cuisine:cuisines.includes(p?.cuisine)?p.cuisine:'不限'};}
 function classify(r){
  const n=r.name||'',ingredients=(r.ingredients||[]).map(x=>x[0]).join(' '),tags=[];
  const hot=/辣椒|豆瓣酱|辣酱|辣油/.test(ingredients)||/麻辣|香辣|辣子|剁椒|水煮肉|水煮鱼/.test(n);
  if(hot)tags.push(/花椒/.test(ingredients)||/麻辣|麻婆/.test(n)?'麻辣':'香辣');
  if(/糖醋|酸甜|咕咾|咕噜|菠萝|荔枝肉|橙汁/.test(n))tags.push('酸甜');
  if(/蒜香|蒜蓉|蒜泥/.test(n))tags.push('蒜香');
  if(!hot&&/清蒸|白灼|清炒|清炖|蒸蛋|蛋羹|冬瓜汤|紫菜.*汤/.test(n))tags.push('清淡鲜香');
  if(/红烧|酱烧|酱爆|卤|黑椒|葱爆|葱烧|蚝油|豉汁|盐焗/.test(n))tags.push('咸香');
  let cuisine='家常风味';
  if(/宫保|麻婆|回锅肉|鱼香|辣子鸡|剁椒|口水鸡|水煮肉|水煮鱼|干煸|湘味/.test(n))cuisine='川湘风味';
  else if(/白灼|豉汁|叉烧|煲仔|盐焗|咕咾|咕噜|广式/.test(n))cuisine='粤式风味';
  else if(/意面|意大利|披萨|奶油蘑菇|牛排|三明治|汉堡|西式/.test(n))cuisine='西式风味';
  return {tastes:tags,cuisine};
 }
 function score(r,p){p=normalize(p);const c=classify(r);return (p.taste!=='不限'&&c.tastes.includes(p.taste)?2:0)+(p.cuisine!=='不限'&&c.cuisine===p.cuisine?1:0);}
 function matches(r,p){p=normalize(p);const c=classify(r);return (p.taste==='不限'||c.tastes.includes(p.taste))&&(p.cuisine==='不限'||c.cuisine===p.cuisine);}
 function compare(a,b,p){return Number(matches(b,p))-Number(matches(a,p))||score(b,p)-score(a,p);}
 const api={tastes,cuisines,normalize,classify,score,matches,compare};root.RecipePreferences=api;
 if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
