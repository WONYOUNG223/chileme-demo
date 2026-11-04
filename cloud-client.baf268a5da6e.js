(()=>{
'use strict';
const cfg=window.CHILEME_CLOUD||{},key='chileme-cloud-session-v1';
const ready=!!(cfg.url&&cfg.publishableKey&&/^https:\/\//.test(cfg.url));
const proxyPath='/api/supabase';
// Proxy is opt-in: local/file builds and hosts without redirects must use direct transport.
const useProxy=cfg.proxyPath===proxyPath&&typeof location!=='undefined'&&location.protocol==='https:';
const nativeFetch=globalThis.fetch.bind(globalThis);
// Buffer the response while the timer is active, including stalled response bodies.
async function fetch(url,options={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
 try{
  const target=useProxy&&url.startsWith(cfg.url.replace(/\/$/,'')+'/')?proxyPath+url.slice(cfg.url.replace(/\/$/,'').length):url;
  const response=await nativeFetch(target,{...options,signal:controller.signal,cache:'no-store'});
  const body=await response.text();
  return {ok:response.ok,status:response.status,text:async()=>body};
 }catch(error){
  if(controller.signal.aborted)throw new Error('timeout');
  throw error;
 }finally{clearTimeout(timer);}
}
let session=null,refreshing=null;
// Bundled iPhone pages have a file:// origin; let the server use its configured Site URL.
const emailRedirect=typeof location!=='undefined'&&/^https?:$/.test(location.protocol)?location.origin+location.pathname:'';
try{session=JSON.parse(localStorage.getItem(key)||'null');}catch{}
function save(data){session=data?.access_token?{access_token:data.access_token,refresh_token:data.refresh_token,expires_at:data.expires_at||Math.floor(Date.now()/1000)+data.expires_in,user:data.user}:null;try{session?localStorage.setItem(key,JSON.stringify(session)):localStorage.removeItem(key);}catch{}window.dispatchEvent(new Event('chileme:auth'));}
// Supabase's default confirmation email is a link. Accept its fragment before
// the hash router sees it, while still supporting projects configured for OTP.
try{const callback=new URLSearchParams(location.hash.slice(1));if(callback.get('access_token')&&callback.get('refresh_token')){save({access_token:callback.get('access_token'),refresh_token:callback.get('refresh_token'),expires_at:Number(callback.get('expires_at'))||undefined,expires_in:Number(callback.get('expires_in'))||undefined});history.replaceState(null,'',location.pathname+location.search+'#account');}}catch{}
function need(){if(!ready)throw new Error('账户与社区正在开通中。你可以继续免费录入食材、查看菜谱和生成计划。');}
async function raw(path,options={},token){need();let response;try{response=await fetch(cfg.url.replace(/\/$/,'')+path,{...options,headers:{apikey:cfg.publishableKey,...(token?{Authorization:'Bearer '+token}:{}),...(options.body&&!(options.body instanceof Blob)?{'Content-Type':'application/json'}:{}),...options.headers}});}catch{throw new Error('暂时连接不上账户服务，请稍后重试。');}const text=await response.text();let body;try{body=text?JSON.parse(text):null;}catch{body=null;}if(!response.ok){const code=body?.error_code||body?.code;const errors={email_not_confirmed:'请先输入邮箱验证码完成注册。',invalid_credentials:'邮箱或密码不正确。',otp_expired:'验证码错误或已过期，请重新发送。',over_email_send_rate_limit:'发送过于频繁，请稍后再试。',email_exists:'该邮箱已注册，请登录。',weak_password:'密码强度不足，请更换更长的密码。','23505':'这项操作已经完成，请刷新查看。','23503':'你的社区资料尚未初始化，请联系管理员执行资料回填后重试。','42501':'你的账户暂时没有发布权限，请先确认邮箱已验证后重新登录。'};const socialErrors={LOGIN_REQUIRED:'请先验证邮箱并登录。',UNAVAILABLE:'内容不可用，或双方已设置拉黑。',FORBIDDEN:'你没有权限执行此操作。',INVALID_IMAGES:'照片无效，请重新上传自己的图片。',INVALID_POST:'请填写 2–60 字标题和 1–1500 字内容。',INVALID_MESSAGE:'消息不能为空，最多 1000 字。',RATE_LIMIT:'操作太频繁，请稍后再试。',REQUEST_WAITING:'已发送一条消息申请，请等待对方接受。',CHAT_CLOSED:'会话已关闭，不能继续发送。',OWN_LIKE:'不能给自己的帖子点赞。'};throw new Error(errors[code]||socialErrors[body?.message]||(/rate|429/.test(String(code))?'操作过于频繁，请稍后再试。':'操作未完成，请检查输入或稍后重试。'));}return body;}
async function token(){if(!session)return null;if(session.expires_at>Date.now()/1000+60)return session.access_token;if(!refreshing)refreshing=raw('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:session.refresh_token})}).then(data=>{save(data);return data.access_token;}).catch(error=>{save(null);throw error;}).finally(()=>refreshing=null);return refreshing;}
async function request(path,options={},auth=false){const access=await token();if(auth&&!access)throw new Error('请先登录后再操作。');return raw(path,options,access);}
const json=(method,body)=>({method,body:JSON.stringify(body)});
const rpc=(name,data={})=>request('/rest/v1/rpc/'+name,json('POST',data));
window.ChiLeMeCloud={ready,registrationEnabled:ready&&cfg.registrationEnabled===true,configuredPayments:!!cfg.paymentsEnabled,get user(){return session?.user||null;},
 async askKitchenAI(payload,{signal}={}){
  if(cfg.kitchenAIEnabled!==true)throw new Error('厨房 AI 接入准备中，暂未开通回答。');
  need();const access=await token();if(!access)throw new Error('请先登录后再提问。');
  const controller=new AbortController();let timedOut=false;
  const cancel=()=>controller.abort();if(signal?.aborted)cancel();else signal?.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(()=>{timedOut=true;controller.abort();},45000);
  try{
   if(controller.signal.aborted){const e=new Error('已停止回答。');e.name='AbortError';throw e;}
   const url=cfg.url.replace(/\/$/,'')+'/functions/v1/kitchen-ai';
   const context=payload.context&&typeof payload.context==='object'?['菜谱：'+String(payload.context.recipeName||'').slice(0,80),'步骤：'+String(payload.context.stepTitle||'').slice(0,100),String(payload.context.instruction||'').slice(0,1600)].join('\n'):'';
   const response=await nativeFetch(url,{method:'POST',cache:'no-store',signal:controller.signal,headers:{apikey:cfg.publishableKey,Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({message:payload.message,history:payload.history||[],context})});
   const text=await response.text();let body;try{body=JSON.parse(text);}catch{throw new Error('AI 服务返回异常，请稍后重试。');}
   if(!response.ok){const messages={AI_NOT_CONFIGURED:'厨房 AI 接入准备中，暂未开通回答。',LOGIN_REQUIRED:'登录状态已过期，请重新登录。',RATE_LIMIT:'提问额度已用完或操作太快，请稍后再试。',INVALID_REQUEST:'问题或对话过长，请精简后重试。',UPSTREAM_BUSY:'免费 AI 目前繁忙，请稍后手动重试。',UPSTREAM_TIMEOUT:'AI 回答超时，问题已保留，请稍后重试。',QUOTA_UNAVAILABLE:'AI 额度服务暂时不可用，请稍后重试。'};throw new Error(messages[body?.error]||'AI 暂时无法回答，问题已保留，请稍后重试。');}
   if(body?.model!=='glm-4-flash-250414'||typeof body?.answer!=='string'||!body.answer.trim())throw new Error('AI 返回内容无效，请稍后重试。');
   return {answer:body.answer,remaining:body.remaining,model:body.model};
  }catch(error){if(controller.signal.aborted){const e=new Error(timedOut?'AI 回答超时，问题已保留，请稍后重试。':'已停止回答。');e.name=timedOut?'Error':'AbortError';throw e;}if(error instanceof TypeError)throw new Error('暂时连不上厨房 AI，问题已保留，请检查网络后重试。');throw error;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 },
 socialRead(action,args={}){return rpc('social_read',{action,args});},
 socialWrite(action,args={}){return request('/rest/v1/rpc/social_write',json('POST',{action,args}),true);},
 async signup(email,password,username){if(ready&&!cfg.registrationEnabled)throw new Error('邮箱注册正在开通中，暂时不能发送验证码。做饭功能可以继续免费使用。');const options=emailRedirect?{emailRedirectTo:emailRedirect}:{};const data=await raw('/auth/v1/signup',json('POST',{email,password,data:{username},options}));if(data.access_token)throw new Error('邮箱验证尚未正确启用，请联系团队开通；本次没有登录。');return data;},
 async login(email,password){const data=await raw('/auth/v1/token?grant_type=password',json('POST',{email,password}));if(!data.user?.email_confirmed_at)throw new Error('请先验证邮箱。');save(data);return data.user;},
 async verify(email,code,type='email'){const data=await raw('/auth/v1/verify',json('POST',{email,token:code,type}));if(!data.user?.email_confirmed_at)throw new Error('邮箱验证未完成。');save(data);return data.user;},
 resend(email,type='signup'){return raw('/auth/v1/resend',json('POST',{email,type}));},
 async setPassword(password){if(!this.user?.email_confirmed_at)throw new Error('请先验证邮箱并登录。');if(password.length<8)throw new Error('密码至少 8 位。');return request('/auth/v1/user',json('PUT',{password}),true);},
 async logout(){if(session)await request('/auth/v1/logout',{method:'POST'},true);save(null);},
 async restore(){if(!session||!ready)return null;const user=await request('/auth/v1/user',{},true);if(!user.email_confirmed_at){save(null);return null;}session.user=user;return user;},
 feed(sort='new',offset=0){return rpc('community_feed',{sort_mode:sort,page_offset:offset});},
 leaders(sort='likes'){return rpc('community_leaders',{sort_mode:sort});},
 comments(id){return rpc('community_comments',{target_post:id});},
 like(id){return request('/rest/v1/rpc/toggle_like',json('POST',{target_post:id}),true);},
 comment(id,body){return request('/rest/v1/comments',json('POST',{post_id:id,author_id:session?.user?.id,body}),true);},
 profile(){return request('/rest/v1/profiles?id=eq.'+encodeURIComponent(session?.user?.id)+'&select=*',{},true).then(x=>x[0]);},
 updateProfile(username,bio,avatar_path){return request('/rest/v1/profiles?id=eq.'+encodeURIComponent(session?.user?.id),{...json('PATCH',{username,bio,...(avatar_path?{avatar_path}:{})}),headers:{Prefer:'return=representation'}},true);},
 async upload(file,kind){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw new Error('请选择 JPG、PNG 或 WebP 图片，大小不超过 5 MB。');const uid=session?.user?.id;if(!uid)throw new Error('请先登录。');const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],path=uid+'/'+kind+'/'+crypto.randomUUID()+'.'+extension;await request('/storage/v1/object/community/'+path,{method:'POST',body:file,headers:{'Content-Type':file.type,'x-upsert':'false'}},true);return path;},
 image(path){if(!path||path.split('/').includes('..')||!/^[-a-zA-Z0-9/_.]+$/.test(path))return '';return (useProxy?proxyPath:cfg.url.replace(/\/$/,''))+'/storage/v1/object/public/community/'+path;},
 post(data){return request('/rest/v1/posts',json('POST',{...data,author_id:session?.user?.id}),true);},
 withdraw(id){return request('/rest/v1/posts?id=eq.'+encodeURIComponent(id),json('PATCH',{status:'withdrawn'}),true);},
 apply(message){return request('/rest/v1/creator_applications',json('POST',{user_id:session?.user?.id,message}),true);},
 application(){return request('/rest/v1/creator_applications?user_id=eq.'+encodeURIComponent(session?.user?.id)+'&select=status',{},true).then(x=>x[0]);}
};
window.addEventListener('storage',e=>{if(e.key===key){try{session=JSON.parse(e.newValue||'null');}catch{session=null;}window.dispatchEvent(new Event('chileme:auth'));}});
})();
