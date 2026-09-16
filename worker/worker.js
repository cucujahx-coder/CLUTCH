/* Серверная часть чата: держит ключ Anthropic, собирает системный промт и стримит ответ.
   Клиент присылает снимок задачи и переписку, а не готовые сообщения модели, — поэтому
   адрес воркера, который виден в бандле, нельзя использовать как универсальный прокси. */

import {buildSystem} from './prompt.js';
import {TOOLS} from './tools.js';
import {sendPush} from './push.js';

const DEFAULT_MODEL='claude-sonnet-5';   /* разговор */
const DEFAULT_SUM_MODEL='claude-haiku-4-5';  /* выжимки старой переписки — дешёвая модель */
const MAX_TOKENS=8192;                   /* ход с кодом длиннее разговорного: скрипты тоже выход */
const EFFORT='low';                      /* чат должен отвечать быстро; поднять при поверхностных ответах */
const MAX_BODY=1024*1024;                /* история несёт результаты поиска — они объёмные */
const MAX_MSGS=40;

/* Сеть: поиск и загрузка страниц исполняются на стороне Anthropic и приходят в том же
   потоке. Версии базовые (_20250305/_20250910), а не _20260209: те фильтруют выдачу
   своим кодом, и рядом с code_execution модель получала бы две среды исполнения —
   документация прямо предупреждает. Каждый поиск платный, поэтому потолок вызовов
   на ответ; текст страницы ограничен, потому что ляжет в историю у клиента. */
const WEB_USES=3;
const FETCH_TOKENS=6000;
const WEB_TOOLS=[
 {type:'web_search_20250305',name:'web_search',max_uses:WEB_USES},
 {type:'web_fetch_20250910',name:'web_fetch',max_uses:WEB_USES,max_content_tokens:FETCH_TOKENS}
];
/* Код и документы: контейнер на стороне Anthropic, в нём готовые навыки для docx/xlsx/
   pptx/pdf. Контейнер живёт у задачи (client присылает его id), файлы из него клиент
   забирает через {file:id} ниже. Навыки требуют бета-заголовок; Files API — нет. */
const CODE_TOOL={type:'code_execution_20260521',name:'code_execution'};
const SKILLS=['docx','xlsx','pptx','pdf'].map(id=>({type:'anthropic',skill_id:id,version:'latest'}));
const BETA='code-execution-2025-08-25';
const CID=/^container_[A-Za-z0-9_-]{2,120}$/;
const FID=/^file_[A-Za-z0-9_-]{2,120}$/;
const FILE_MAX=20*1024*1024;             /* больше — не проксируем, это ляжет в IndexedDB */
const PAUSES=3;                          /* сколько раз продолжаем ход после pause_turn */

const ALLOW=[
 'https://cucujahx-coder.github.io',
 'http://localhost:5173',
 'http://localhost:5199'
];

const cut=(s,n)=>String(s==null?'':s).slice(0,n);
const PLAN_MAX=60;   /* ближайшие напоминания; дальше плана клиент не шлёт */
const sha=async s=>{
 const b=new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
 return [...b.slice(0,16)].map(x=>x.toString(16).padStart(2,'0')).join('');
};
/* Момент «ЧЧ:ММ местного времени» в минуты от эпохи по поясу подписки: у сервера UTC,
   у человека — свой пояс, и без пересчёта напоминание придёт не тогда. */
const localNow=tz=>{
 try{
  const p=new Intl.DateTimeFormat('sv-SE',{timeZone:tz||'UTC',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());
  return p.replace(' ','T').slice(0,16);
 }catch(e){ return new Date().toISOString().slice(0,16); }
};
const json=(o,s,h)=>new Response(JSON.stringify(o),{status:s,headers:{...h,'content-type':'application/json'}});
const cors=o=>({
 'Access-Control-Allow-Origin':ALLOW.includes(o)?o:ALLOW[0],
 'Access-Control-Allow-Headers':'content-type',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Vary':'Origin'
});
const ISO=/^\d{4}-\d{2}-\d{2}$/;

export default {
 /* Cron: раз в минуту проходим по подпискам и шлём то, чему пришло время.
    Отправленное вычёркиваем из плана, мёртвые подписки (404/410) удаляем. */
 async scheduled(ev, env, ctx){
  if(!env.PUSH) return;
  let cursor;
  do{
   const page = await env.PUSH.list({prefix:'p:', cursor});
   cursor = page.list_complete ? null : page.cursor;
   for(const k of page.keys){
    const rec = await env.PUSH.get(k.name, 'json');
    if(!rec || !rec.sub) continue;
    const now = localNow(rec.tz);
    const due = (rec.plan||[]).filter(x => x.at <= now);
    if(!due.length) continue;
    let dead = false;
    for(const x of due.slice(0,5)){
     const code = await sendPush(rec.sub, JSON.stringify({title:x.t, id:x.id, at:x.at}), env).catch(()=>0);
     if(code === 404 || code === 410) dead = true;
    }
    if(dead){ await env.PUSH.delete(k.name); continue; }
    const rest = (rec.plan||[]).filter(x => x.at > now);
    await env.PUSH.put(k.name, JSON.stringify({...rec, plan:rest}), {expirationTtl: 60*60*24*120});
   }
  }while(cursor);
 },
 async fetch(req,env){
  const o=req.headers.get('Origin')||'';
  const h=cors(o);
  if(req.method==='OPTIONS')return new Response(null,{headers:h});
  const model=env.CHAT_MODEL||DEFAULT_MODEL;
  if(req.method==='GET')return new Response(
   'Чат-воркер работает.\n'+
   'Модель: '+model+'\n'+
   'Ключ: '+(env.ANTHROPIC_API_KEY?'задан':'НЕ ЗАДАН — wrangler secret put ANTHROPIC_API_KEY')+'\n'+
   'Отвечает на POST потоком SSE.\n',
   {status:200,headers:{...h,'content-type':'text/plain; charset=utf-8'}});
  if(req.method!=='POST')return new Response('Only POST',{status:405,headers:{...h,'content-type':'text/plain; charset=utf-8'}});
  if(o&&!ALLOW.includes(o))return json({error:'origin not allowed'},403,h);
  if(!env.ANTHROPIC_API_KEY)return json({error:'ANTHROPIC_API_KEY не задан'},500,h);

  const raw=await req.text();
  if(raw.length>MAX_BODY)return json({error:'слишком большой запрос'},413,h);
  let b; try{b=JSON.parse(raw)}catch(e){return json({error:'bad json'},400,h)}

  /* ---------- напоминания ----------
     Задачи живут в браузере, сервер их не знает. Поэтому клиент сам присылает короткий
     план: «в такое-то время сказать вот это». Храним план рядом с подпиской в KV под
     ключом подписки; Cron раз в минуту забирает наступившее и шлёт пуш.
     Ничего, кроме названия задачи и времени, на сервер не уходит. */
  if(b.push === 'sub' || b.push === 'plan' || b.push === 'off'){
   if(!env.PUSH) return json({error:'напоминания не настроены: нет KV PUSH'}, 501, h);
   const sub = b.sub;
   if(!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys || !sub.keys.p256dh || !sub.keys.auth)
    return json({error:'нужна подписка'}, 400, h);
   const key = 'p:' + await sha(sub.endpoint);
   if(b.push === 'off'){ await env.PUSH.delete(key); return json({ok:true}, 200, h); }
   /* План: до PLAN_MAX ближайших напоминаний, каждое — момент и строка */
   const plan = (Array.isArray(b.plan) ? b.plan : []).slice(0, PLAN_MAX)
    .map(x => ({at:cut(x && x.at, 20), t:cut(x && x.t, 80), id:cut(x && x.id, 16)}))
    .filter(x => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(x.at) && x.t);
   await env.PUSH.put(key, JSON.stringify({sub, plan, tz:cut(b.tz, 60), at:Date.now()}),
    {expirationTtl: 60 * 60 * 24 * 120});   /* полгода тишины — подписка и так протухнет */
   return json({ok:true, planned:plan.length}, 200, h);
  }

  /* Файл, собранный в контейнере: клиент скачивает его через нас — ключ только тут.
     Отдаём поток как есть, с типом содержимого из Files API. */
  if(typeof b.file==='string'){
   if(!FID.test(b.file))return json({error:'кривой идентификатор файла'},400,h);
   let r;
   try{r=await fetch('https://api.anthropic.com/v1/files/'+b.file+'/content',{headers:{'anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_API_KEY}});}
   catch(e){return json({error:'сеть до Anthropic: '+cut(e&&e.message||e,200)},502,h);}
   if(!r.ok)return json({error:'anthropic '+r.status},502,h);
   if(+(r.headers.get('content-length')||0)>FILE_MAX)return json({error:'файл слишком большой'},413,h);
   return new Response(r.body,{headers:{...h,'content-type':r.headers.get('content-type')||'application/octet-stream','cache-control':'no-store'}});
  }

  /* Название задачи в два слова. Пользователь пишет как придётся, а в списке имя
     должно читаться с одного взгляда. Дешёвая модель, ответ — одна строка. */
  if(typeof b.shorten==='string'){
   const src=cut(b.shorten,300).trim();
   if(!src)return json({title:''},200,h);
   try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{
     method:'POST',
     headers:{'content-type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_API_KEY},
     body:JSON.stringify({
      model:env.SUM_MODEL||DEFAULT_SUM_MODEL,
      max_tokens:32,
      system:'Сократи название задачи до двух слов. Три слова — только если двумя никак. '+
       'Сохрани суть и узнаваемость: глагол и предмет, например «оплатить хостинг», «позвонить Марине». '+
       'Тот же язык, что в исходнике. Не добавляй того, чего нет. '+
       'Ответь только названием: без кавычек, без точки, без пояснений.',
      messages:[{role:'user',content:src}]
     })
    });
    if(!r.ok)return json({error:'anthropic '+r.status},502,h);
    const d=await r.json();
    const title=(d.content||[]).filter(x=>x.type==='text').map(x=>x.text).join(' ').trim();
    return json({title},200,h);
   }catch(e){return json({error:'сеть до Anthropic: '+cut(e&&e.message||e,200)},502,h)}
  }

  /* Выжимка старой переписки — отдельный дешёвый вызов, не стрим: клиенту нужен
     только текст, и он хранит его рядом с чатом до следующего сжатия. */
  if(Array.isArray(b.summarize)){
   const lines=b.summarize.slice(-200).map(x=>cut(x,2000)).join('\n').slice(0,60000);
   if(!lines.trim())return json({summary:''},200,h);
   try{
    const r=await fetch('https://api.anthropic.com/v1/messages',{
     method:'POST',
     headers:{'content-type':'application/json','anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_API_KEY},
     body:JSON.stringify({
      model:env.SUM_MODEL||DEFAULT_SUM_MODEL,
      max_tokens:600,
      system:'Сожми переписку по задаче в несколько строк по-русски. Оставь только то, что понадобится дальше: принятые решения, договорённости, обещанные сроки, имена людей, названия созданных файлов. Выбрось вежливость и рассуждения. Без вступления и заголовков.',
      messages:[{role:'user',content:lines}]
     })
    });
    if(!r.ok)return json({error:'anthropic '+r.status},502,h);
    const d=await r.json();
    const text=(d.content||[]).filter(x=>x.type==='text').map(x=>x.text).join('\n').trim();
    return json({summary:text},200,h);
   }catch(e){return json({error:'сеть до Anthropic: '+cut(e&&e.message||e,200)},502,h)}
  }

  /* Дата приходит от клиента: у него и у воркера сутки могут не совпасть.
     Проверяем только, что расхождение не больше суток — иначе календарь будет врать. */
  const today=ISO.test(b.today||'')?b.today:new Date().toISOString().slice(0,10);
  const drift=Math.abs(new Date(today+'T00:00:00Z')-new Date(new Date().toISOString().slice(0,10)+'T00:00:00Z'));
  if(drift>36e5*30)return json({error:'дата клиента разошлась с серверной'},400,h);

  /* Содержимое — строка или массив блоков: ходы с tool_use и tool_result приходят
     массивами. Блоки пропускаем как есть, обрезая только текст. */
  const block=x=>{
   if(!x||typeof x!=='object')return null;
   if(x.type==='text')return {type:'text',text:cut(x.text,8000)};
   if(x.type==='tool_use')return {type:'tool_use',id:cut(x.id,80),name:cut(x.name,60),input:x.input&&typeof x.input==='object'?x.input:{}};
   if(x.type==='tool_result')return {type:'tool_result',tool_use_id:cut(x.tool_use_id,80),content:cut(x.content,4000),...(x.is_error?{is_error:true}:{})};
   /* Серверные вызовы и их результаты — как есть: в результатах поиска лежит шифрованное
      содержимое, по которому модель собирает цитаты, его не обрезать и не пересобирать. */
   if(x.type==='server_tool_use')return {type:'server_tool_use',id:cut(x.id,80),name:cut(x.name,60),input:x.input&&typeof x.input==='object'?x.input:{}};
   if(/^[a-z_]+_tool_result$/.test(x.type)&&x.type!=='tool_result')
    return {type:x.type,tool_use_id:cut(x.tool_use_id,80),content:x.content};
   /* Вложения пользователя: картинка и PDF идут как есть, base64 не режем */
   if((x.type==='image'||x.type==='document')&&x.source&&x.source.type==='base64')
    return {type:x.type,source:{type:'base64',media_type:cut(x.source.media_type,80),data:String(x.source.data||'')}};
   return null;
  };
  const hist=(Array.isArray(b.messages)?b.messages:[])
   .slice(-MAX_MSGS)
   .map(m=>{
    if(!m)return null;
    const role=m.role==='assistant'?'assistant':'user';
    if(Array.isArray(m.content)){
     const cs=m.content.map(block).filter(Boolean);
     return cs.length?{role,content:cs}:null;
    }
    return m.content?{role,content:cut(m.content,8000)}:null;
   })
   .filter(Boolean);
  if(!hist.length)return json({error:'empty history'},400,h);
  if(hist[hist.length-1].role!=='user')return json({error:'last message must be user'},400,h);

  /* Поиск учитывает, где пользователь: «клиника рядом» без этого ищется где попало.
     Пояс приходит от клиента; кривой — не подставляем, иначе API вернёт 400. */
  const tools=[...TOOLS,...WEB_TOOLS.map(t=>t.name==='web_search'&&validTz(b.tz)
   ?{...t,user_location:{type:'approximate',timezone:b.tz}}:t),CODE_TOOL];
  const system=buildSystem({...b,today});
  const headers={'content-type':'application/json','anthropic-version':'2023-06-01','anthropic-beta':BETA,'x-api-key':env.ANTHROPIC_API_KEY};
  const call=(messages,cid)=>fetch('https://api.anthropic.com/v1/messages',{
   method:'POST',
   headers,
   body:JSON.stringify({
    model,
    max_tokens:MAX_TOKENS,
    stream:true,
    system,
    tools,
    container:cid?{id:cid,skills:SKILLS}:{skills:SKILLS},
    output_config:{effort:EFFORT},
    messages
   })
  });

  /* Контейнер задачи: в нём лежат уже собранные файлы, так что «поправь таблицу»
     не начинается с нуля. Протухший (400) — молча начинаем с нового. */
  let cid=CID.test(b.container||'')?b.container:null;
  let up;
  try{
   up=await call(hist,cid);
   if(!up.ok&&up.status===400&&cid){cid=null; up=await call(hist,null);}
  }catch(e){return json({error:'сеть до Anthropic: '+cut(e&&e.message||e,200)},502,h);}

  if(!up.ok)return json({error:'anthropic '+up.status,detail:cut(await up.text(),500)},502,h);

  /* Серверный цикл упёрся в свой лимит итераций (pause_turn) — продолжаем ход сами,
     в тот же поток: переотправляем историю с уже полученным ходом ассистента, без
     добавочного сообщения, в тот же контейнер. Клиент про паузу не знает. */
  const again=async(content,c)=>{
   try{const r=await call([...hist,{role:'assistant',content}],c||cid); return r.ok?r.body:null;}
   catch(e){return null;}
  };
  /* Имя и размер собранного файла — из Files API; сам файл клиент заберёт отдельно */
  const meta=async id=>{
   try{
    const r=await fetch('https://api.anthropic.com/v1/files/'+id,{headers:{'anthropic-version':'2023-06-01','x-api-key':env.ANTHROPIC_API_KEY}});
    if(!r.ok)return null;
    const d=await r.json();
    return {id,name:cut(d.filename||id,200),mime:cut(d.mime_type||'application/octet-stream',100),size:+d.size_bytes||0};
   }catch(e){return null;}
  };

  return new Response(relay(up.body,again,meta),{
   headers:{...h,'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache','connection':'keep-alive'}
  });
 }
};

const validTz=tz=>{if(typeof tz!=='string'||!tz||tz.length>60)return false;try{new Intl.DateTimeFormat('en',{timeZone:tz});return true}catch(e){return false}};

/* Расход суммируется по проходам: после pause_turn ход тот же, а запросов два */
const acc=(a,b)=>{
 if(!b||typeof b!=='object')return a;
 a=a&&typeof a==='object'?a:{};
 for(const k in b){
  if(typeof b[k]==='number')a[k]=(a[k]||0)+b[k];
  else if(b[k]&&typeof b[k]==='object')a[k]=acc(a[k],b[k]);
 }
 return a;
};

/* Пересобираем поток Anthropic в свой: клиенту нужны text, tool_use, srv, error и done.
   Свой формат, а не проброс как есть, — чтобы клиент не зависел от внутренних
   типов событий API и не ломался при их изменении.
   Ход с серверными вызовами (поиск, загрузка страницы) клиент должен вернуть в истории
   целиком и в том же порядке, иначе на следующем ходу модель забудет, что искала, —
   поэтому такой ход отдаётся в done блоками (content), а источники из цитат — списком (src). */
function relay(body,again,meta){
 const dec=new TextDecoder(), enc=new TextEncoder();
 return new ReadableStream({async start(c){
  const send=(ev,data)=>c.enqueue(enc.encode('event: '+ev+'\ndata: '+JSON.stringify(data)+'\n\n'));
  let usage=null, stop=null, srv=false, cid=null;
  const content=[], src=[], seen={}, fids=[];
  const cite=x=>{
   if(!x||typeof x.url!=='string'||!/^https?:/i.test(x.url)||seen[x.url])return;
   seen[x.url]=1; src.push({url:cut(x.url,500),title:cut(x.title||'',120)});
  };
  const handle=(d,blocks)=>{
   const i=d.index;
   if(d.type==='content_block_start'&&d.content_block){
    const cb=d.content_block;
    if(cb.type==='text'){const b={type:'text',text:''}; blocks[i]=b; content.push(b);}
    else if(cb.type==='tool_use'||cb.type==='server_tool_use'){
     const b={type:cb.type,id:cb.id,name:cb.name,input:{}}; blocks[i]=b; b.json=''; content.push(b);
     if(cb.type==='server_tool_use')srv=true;
    }else if(/_tool_result$/.test(cb.type)){
     /* Результат серверного инструмента приходит целиком одним блоком */
     srv=true; content.push({type:cb.type,tool_use_id:cb.tool_use_id,content:cb.content});
     const r=cb.content;
     const err=r&&!Array.isArray(r)&&(r.error_code||(/_error$/.test(r.type||'')&&(r.error_code||r.type)));
     if(err)send('srv',{name:cb.type,error:cut(err,60)});
     /* Файлы, собранные кодом: у результата список выходов с file_id */
     if(r&&Array.isArray(r.content))for(const o of r.content)if(o&&typeof o.file_id==='string'&&!fids.includes(o.file_id))fids.push(o.file_id);
    }
   }
   else if(d.type==='message_start'){
    const m=d.message; if(m&&m.container&&typeof m.container.id==='string')cid=m.container.id;
   }
   else if(d.type==='content_block_delta'&&d.delta){
    const dl=d.delta;
    if(dl.type==='text_delta'){
     let b=blocks[i];
     if(!b||b.type!=='text'){b={type:'text',text:''}; blocks[i]=b; content.push(b);}
     b.text+=dl.text||''; send('text',dl.text);
    }
    else if(dl.type==='input_json_delta'&&blocks[i]&&blocks[i].json!==undefined)blocks[i].json+=dl.partial_json||'';
    else if(dl.type==='citations_delta')cite(dl.citation);
   }
   else if(d.type==='content_block_stop'&&blocks[i]){
    const b=blocks[i]; delete blocks[i];
    if(b.json===undefined)return;
    /* Аргументы приходят кусками; наружу отдаём одно событие с готовым JSON */
    let input={}; try{input=b.json?JSON.parse(b.json):{}}catch(e){}
    delete b.json; b.input=input;
    if(b.type==='tool_use')send('tool_use',{id:b.id,name:b.name,input});
    else send('srv',{name:b.name,input});
   }
   else if(d.type==='message_delta'){
    if(d.usage)usage=acc(usage,d.usage);
    if(d.delta&&d.delta.stop_reason)stop=d.delta.stop_reason;
    /* Контейнер создаётся, когда код уже выполнился, поэтому в потоке его id
       приезжает в конце — в дельте сообщения, а не в message_start */
    const ct=(d.delta&&d.delta.container)||d.container;
    if(ct&&typeof ct.id==='string')cid=ct.id;
   }
   else if(d.type==='error')send('error',{error:(d.error&&d.error.message)||'ошибка потока',code:(d.error&&d.error.type)||''});
  };
  for(let pass=0;pass<=PAUSES;pass++){
   const blocks={}; let buf='';
   const rd=body.getReader();
   for(;;){
    const {value,done}=await rd.read();
    if(done)break;
    buf+=dec.decode(value,{stream:true});
    const parts=buf.split('\n\n'); buf=parts.pop();
    for(const p of parts){
     const line=p.split('\n').find(x=>x.startsWith('data:'));
     if(!line)continue;
     let d; try{d=JSON.parse(line.slice(5).trim())}catch(e){continue}
     handle(d,blocks);
    }
   }
   if(stop!=='pause_turn'||!again||pass===PAUSES)break;
   body=await again(content.filter(b=>b.type!=='text'||b.text),cid);
   if(!body)break;
   stop=null;
  }
  if(stop==='refusal')send('error',{error:'Модель отказалась отвечать на это.',code:'refusal'});
  const files=[];
  if(meta)for(const id of fids.slice(0,10)){const f=await meta(id); if(f)files.push(f);}
  send('done',{usage,stop,
   ...(srv?{content:content.filter(b=>b.type!=='text'||b.text)}:{}),
   ...(src.length?{src}:{}),
   ...(cid?{container:cid}:{}),
   ...(files.length?{files}:{})});
  c.close();
 }});
}
