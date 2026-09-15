/* Серверная часть чата: держит ключ Anthropic, собирает системный промт и стримит ответ.
   Клиент присылает снимок задачи и переписку, а не готовые сообщения модели, — поэтому
   адрес воркера, который виден в бандле, нельзя использовать как универсальный прокси. */

import {buildSystem} from './prompt.js';
import {TOOLS} from './tools.js';

const DEFAULT_MODEL='claude-sonnet-5';   /* разговор */
const DEFAULT_SUM_MODEL='claude-haiku-4-5';  /* выжимки старой переписки — дешёвая модель */
const MAX_TOKENS=4096;
const EFFORT='low';                      /* чат должен отвечать быстро; поднять при поверхностных ответах */
const MAX_BODY=1024*1024;                /* история несёт результаты поиска — они объёмные */
const MAX_MSGS=40;

/* Сеть: поиск и загрузка страниц исполняются на стороне Anthropic и приходят в том же
   потоке. Версии _20260209 сами фильтруют выдачу кодом, отдельный code_execution рядом
   объявлять нельзя — модель получает две среды исполнения. Каждый поиск платный, поэтому
   потолок вызовов на ответ; текст страницы ограничен, потому что ляжет в историю у клиента. */
const WEB_USES=3;
const FETCH_TOKENS=6000;
const WEB_TOOLS=[
 {type:'web_search_20260209',name:'web_search',max_uses:WEB_USES},
 {type:'web_fetch_20260209',name:'web_fetch',max_uses:WEB_USES,max_content_tokens:FETCH_TOKENS}
];
const PAUSES=3;                          /* сколько раз продолжаем ход после pause_turn */

const ALLOW=[
 'https://cucujahx-coder.github.io',
 'http://localhost:5173',
 'http://localhost:5199'
];

const cut=(s,n)=>String(s==null?'':s).slice(0,n);
const json=(o,s,h)=>new Response(JSON.stringify(o),{status:s,headers:{...h,'content-type':'application/json'}});
const cors=o=>({
 'Access-Control-Allow-Origin':ALLOW.includes(o)?o:ALLOW[0],
 'Access-Control-Allow-Headers':'content-type',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Vary':'Origin'
});
const ISO=/^\d{4}-\d{2}-\d{2}$/;

export default {
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
   if(x.type==='web_search_tool_result'||x.type==='web_fetch_tool_result')
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
   ?{...t,user_location:{type:'approximate',timezone:b.tz}}:t)];
  const system=buildSystem({...b,today});
  const call=messages=>fetch('https://api.anthropic.com/v1/messages',{
   method:'POST',
   headers:{
    'content-type':'application/json',
    'anthropic-version':'2023-06-01',
    'x-api-key':env.ANTHROPIC_API_KEY
   },
   body:JSON.stringify({
    model,
    max_tokens:MAX_TOKENS,
    stream:true,
    system,
    tools,
    output_config:{effort:EFFORT},
    messages
   })
  });

  let up;
  try{up=await call(hist);}
  catch(e){return json({error:'сеть до Anthropic: '+cut(e&&e.message||e,200)},502,h);}

  if(!up.ok)return json({error:'anthropic '+up.status,detail:cut(await up.text(),500)},502,h);

  /* Серверный цикл упёрся в свой лимит итераций (pause_turn) — продолжаем ход сами,
     в тот же поток: переотправляем историю с уже полученным ходом ассистента, без
     добавочного сообщения. Клиент про паузу не знает. */
  const again=async content=>{
   try{const r=await call([...hist,{role:'assistant',content}]); return r.ok?r.body:null;}
   catch(e){return null;}
  };

  return new Response(relay(up.body,again),{
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
function relay(body,again){
 const dec=new TextDecoder(), enc=new TextEncoder();
 return new ReadableStream({async start(c){
  const send=(ev,data)=>c.enqueue(enc.encode('event: '+ev+'\ndata: '+JSON.stringify(data)+'\n\n'));
  let usage=null, stop=null, srv=false;
  const content=[], src=[], seen={};
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
    }else if(cb.type==='web_search_tool_result'||cb.type==='web_fetch_tool_result'){
     srv=true; content.push({type:cb.type,tool_use_id:cb.tool_use_id,content:cb.content});
     const err=cb.content&&!Array.isArray(cb.content)&&cb.content.error_code;
     if(err)send('srv',{name:cb.type,error:cut(err,60)});
    }
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
   body=await again(content.filter(b=>b.type!=='text'||b.text));
   if(!body)break;
   stop=null;
  }
  if(stop==='refusal')send('error',{error:'Модель отказалась отвечать на это.',code:'refusal'});
  send('done',{usage,stop,
   ...(srv?{content:content.filter(b=>b.type!=='text'||b.text)}:{}),
   ...(src.length?{src}:{})});
  c.close();
 }});
}
