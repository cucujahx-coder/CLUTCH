/* Серверная часть чата: держит ключ Anthropic, собирает системный промт и стримит ответ.
   Клиент присылает снимок задачи и переписку, а не готовые сообщения модели, — поэтому
   адрес воркера, который виден в бандле, нельзя использовать как универсальный прокси. */

import {buildSystem} from './prompt.js';
import {TOOLS} from './tools.js';

const DEFAULT_MODEL='claude-sonnet-5';   /* разговор */
const DEFAULT_SUM_MODEL='claude-haiku-4-5';  /* выжимки старой переписки — дешёвая модель */
const MAX_TOKENS=4096;
const EFFORT='low';                      /* чат должен отвечать быстро; поднять при поверхностных ответах */
const MAX_BODY=256*1024;
const MAX_MSGS=40;

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

  let up;
  try{
   up=await fetch('https://api.anthropic.com/v1/messages',{
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
     system:buildSystem({...b,today}),
     tools:TOOLS,
     output_config:{effort:EFFORT},
     messages:hist
    })
   });
  }catch(e){return json({error:'сеть до Anthropic: '+cut(e&&e.message||e,200)},502,h);}

  if(!up.ok)return json({error:'anthropic '+up.status,detail:cut(await up.text(),500)},502,h);

  return new Response(relay(up.body),{
   headers:{...h,'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache','connection':'keep-alive'}
  });
 }
};

/* Пересобираем поток Anthropic в свой: клиенту нужны только text, error и done.
   Свой формат, а не проброс как есть, — чтобы клиент не зависел от внутренних
   типов событий API и не ломался при их изменении. */
function relay(body){
 const dec=new TextDecoder(), enc=new TextEncoder();
 let buf='', usage=null, stop=null, blocks={};
 const send=(c,ev,data)=>c.enqueue(enc.encode('event: '+ev+'\ndata: '+JSON.stringify(data)+'\n\n'));
 return body.pipeThrough(new TransformStream({
  transform(chunk,c){
   buf+=dec.decode(chunk,{stream:true});
   const parts=buf.split('\n\n'); buf=parts.pop();
   for(const p of parts){
    const line=p.split('\n').find(x=>x.startsWith('data:'));
    if(!line)continue;
    let d; try{d=JSON.parse(line.slice(5).trim())}catch(e){continue}
    if(d.type==='content_block_start'&&d.content_block&&d.content_block.type==='tool_use')
     blocks[d.index]={id:d.content_block.id,name:d.content_block.name,json:''};
    else if(d.type==='content_block_delta'&&d.delta&&d.delta.type==='text_delta')send(c,'text',d.delta.text);
    else if(d.type==='content_block_delta'&&d.delta&&d.delta.type==='input_json_delta'&&blocks[d.index])
     blocks[d.index].json+=d.delta.partial_json||'';
    else if(d.type==='content_block_stop'&&blocks[d.index]){
     /* Аргументы приходят кусками; клиенту отдаём одно событие с готовым JSON */
     const b=blocks[d.index]; delete blocks[d.index];
     let input={}; try{input=b.json?JSON.parse(b.json):{}}catch(e){}
     send(c,'tool_use',{id:b.id,name:b.name,input});
    }
    else if(d.type==='message_delta'){
     if(d.usage)usage=d.usage;
     if(d.delta&&d.delta.stop_reason)stop=d.delta.stop_reason;
    }
    else if(d.type==='error')send(c,'error',{error:(d.error&&d.error.message)||'ошибка потока',code:(d.error&&d.error.type)||''});
   }
  },
  flush(c){
   if(stop==='refusal')send(c,'error',{error:'Модель отказалась отвечать на это.',code:'refusal'});
   send(c,'done',{usage,stop});
  }
 }));
}
