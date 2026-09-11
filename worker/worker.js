/* Серверная часть чата: держит ключ Anthropic и системный промпт.
   Клиент присылает только данные задачи, а не готовые сообщения модели, —
   поэтому адрес воркера, который виден в бандле, нельзя использовать
   как универсальный прокси к модели за твой счёт. */

const MODEL='claude-opus-5';
const MAX_TOKENS=2048;
/* Короткие реплики важнее глубины: чат должен отвечать быстро.
   Если ответы кажутся поверхностными — поднять до 'medium' или 'high'. */
const EFFORT='low';

const ALLOW=[
 'https://cucujahx-coder.github.io',
 'http://localhost:5173',
 'http://localhost:5199'
];

const SYSTEM=`Ты помощник внутри списка задач: у каждой задачи свой чат.

Отвечай по-русски и коротко — обычно одна-три фразы. Без вступлений, без
«конечно» и «отличный вопрос», без подписей.

Не пересказывай пользователю его же задачу: он видит её на экране.
Твоя работа — сдвинуть дело с места. Выбери одно: назови ближайший
конкретный шаг, задай один уточняющий вопрос, если без него правда не
обойтись, или прямо скажи, что мешает.

Списком отвечай только если просят разбить на шаги. Если задача выглядит
слишком крупной для одного захода, скажи об этом и предложи разбить.
Если чего-то не знаешь — спроси, не выдумывай подробности.`;

const cut=(s,n)=>String(s==null?'':s).slice(0,n);
const json=(o,s,h)=>new Response(JSON.stringify(o),{status:s,headers:{...h,'content-type':'application/json'}});
const cors=o=>({
 'Access-Control-Allow-Origin':ALLOW.includes(o)?o:ALLOW[0],
 'Access-Control-Allow-Headers':'content-type',
 'Access-Control-Allow-Methods':'POST, OPTIONS',
 'Vary':'Origin'
});

/* Контекст задачи отдельным первым сообщением, а не в system:
   так системный промпт одинаков для всех задач и его можно кэшировать. */
function context(b){
 const L=[(b.kind==='project'?'Проект: ':'Задача: ')+cut(b.title,200)];
 if(b.due)L.push('Срок: '+cut(b.due,20));
 if(b.project)L.push('Входит в проект: '+cut(b.project,200));
 if(b.note)L.push('Что известно: '+cut(b.note,600));
 if(Array.isArray(b.steps)&&b.steps.length)
  L.push('Шаги:\n'+b.steps.slice(0,40).map(s=>(s.done?'[x] ':'[ ] ')+cut(s.t,200)).join('\n'));
 return L.join('\n');
}

export default {
 async fetch(req,env){
  const o=req.headers.get('Origin')||'';
  const h=cors(o);
  if(req.method==='OPTIONS')return new Response(null,{headers:h});
  if(req.method!=='POST')return new Response('Only POST',{status:405,headers:h});
  if(o&&!ALLOW.includes(o))return json({error:'origin not allowed'},403,h);
  if(!env.ANTHROPIC_API_KEY)return json({error:'ANTHROPIC_API_KEY не задан'},500,h);

  let b;
  try{b=await req.json()}catch(e){return json({error:'bad json'},400,h)}

  const hist=(Array.isArray(b.messages)?b.messages:[])
   .slice(-40)
   .filter(m=>m&&m.text)
   .map(m=>({role:m.role==='assistant'?'assistant':'user',content:cut(m.text,4000)}));
  if(!hist.length)return json({error:'empty history'},400,h);
  if(hist[hist.length-1].role!=='user')return json({error:'last message must be user'},400,h);

  try{
   const r=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{
     'content-type':'application/json',
     'anthropic-version':'2023-06-01',
     'x-api-key':env.ANTHROPIC_API_KEY
    },
    body:JSON.stringify({
     model:MODEL,
     max_tokens:MAX_TOKENS,
     system:SYSTEM,
     output_config:{effort:EFFORT},
     messages:[{role:'user',content:context(b)},...hist]
    })
   });
   if(!r.ok)return json({error:'anthropic '+r.status,detail:cut(await r.text(),500)},502,h);
   const d=await r.json();
   /* Модель может отказаться отвечать — это HTTP 200, а не ошибка */
   if(d.stop_reason==='refusal')return json({text:'Не могу ответить на это.'},200,h);
   const text=(d.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n').trim();
   return json({text},200,h);
  }catch(e){
   return json({error:String(e&&e.message||e)},502,h);
  }
 }
};
