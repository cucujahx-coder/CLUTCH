// Запуск: npm test  (jsdom, без браузера)
const {JSDOM}=require('jsdom');const fs=require('fs');const path=require('path');
let fails=0;
const assert=(c,m)=>{if(!c){fails++;console.error('  FAIL',m)}else console.log('  ok  ',m)};
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

function load(file,pre){
 const html=read(file), js=read('app.js');
 const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.org/'});
 const w=dom.window,d=w.document;
 w.matchMedia=()=>({matches:true}); w.scrollTo=()=>{}; w.Element.prototype.scrollIntoView=function(){};
 w.confirm=()=>true; w.prompt=()=>'Новый шаг';
 w.localStorage.clear();
 if(pre)pre(w);
 w.eval(html.match(/window\.MODE=['"]\w+['"]/)[0]);
 w.eval(js);
 return {w,d};
}

async function common(file){
 console.log(file);
 const {w,d}=load(file);
 const rows=()=>[...d.querySelectorAll('#list .row')], txt=r=>r.querySelector('.t1').textContent, $=i=>d.getElementById(i);
 assert($('cnt').textContent==='10','открытых задач 10');
 assert(rows().length===7,'5 задач + 2 проекта');
 rows()[5].querySelector('[role=checkbox]').click();
 assert($('cnt').textContent==='9','кольцо закрывает следующий шаг');
 assert(rows()[5].querySelector('.t2').textContent.includes('Вычитка'),'следующий шаг сдвинулся');
 rows()[5].click();
 assert($('ct').value==='Запуск лендинга','проект открыт');
 assert($('cm').textContent.startsWith('2 из 4 шагов · '),'мета проекта');
 assert(d.querySelectorAll('#thread .row').length===2,'в чате 2 открытых шага');
 d.querySelectorAll('#thread .row [role=checkbox]')[0].click();
 d.querySelectorAll('#thread .row [role=checkbox]')[0].click();
 assert(!rows().some(r=>txt(r)==='Запуск лендинга'),'завершённый проект скрыт');
 const sec=d.querySelector('.sec'); sec.click();
 assert(rows().length===5+1+5,'раздел «Выполненные» раскрыт');
 rows().find(r=>txt(r)==='Вычитка').querySelector('[role=checkbox]').click();
 assert(rows().some(r=>txt(r)==='Запуск лендинга'),'проект вернулся после снятия отметки');
 $('add').click(); assert($('err').style.display==='block','ошибка при пустом вводе');
 $('nt').value='<b>x</b>'; $('nt').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter'}));
 assert($('ct').value==='<b>x</b>'&&!d.querySelector('#list b'),'Enter добавляет, текст экранирован');
 $('hctl').querySelector('[role=checkbox]').click();
 assert($('cm').textContent==='выполнена','чекбокс в шапке');
 $('msg').value='привет'; $('send').click();
 assert(d.querySelectorAll('#thread .bub').length===2,'сообщение добавлено');
 await new Promise(r=>setTimeout(r,800));
 assert(d.querySelectorAll('#thread .ans').length===2&&!d.querySelector('.typing'),'ответ пришёл');
 return {w,d,rows,txt,$};
}

/* ---------- сохранение и перенос ---------- */
function storage(){
 console.log('сохранение');
 const {w,d}=load('index.html');
 d.getElementById('nt').value='Помыть окна';
 d.getElementById('nt').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter'}));
 w.app.flush();
 const raw=w.localStorage.getItem('tasks:v1');
 assert(!!raw,'состояние записано в localStorage');
 assert(JSON.parse(raw).ts.some(x=>x.t==='Помыть окна'),'новая задача попала в хранилище');

 // повторный запуск с тем же хранилищем — демо-набор не перетирает сохранённое
 const A2=load('index.html',w2=>w2.localStorage.setItem('tasks:v1',raw)).w.app;
 assert(A2.S.ts.some(x=>x.t==='Помыть окна'),'состояние поднялось при следующем запуске');
 assert(A2.S.ts.filter(x=>x.t==='Помыть окна').length===1,'демо-набор не подмешался поверх');

 // перенос из прежнего приложения
 const old=[
  {id:'p1',title:'Ремонт',done:false,due:null,isProject:true,messages:[]},
  {id:'s1',title:'Замерить',done:false,due:null,projectId:'p1',order:0,messages:[]},
  {id:'t1',title:'Купить хлеб',done:false,due:null,messages:[{id:'m',role:'ai',text:'ок'}]}
 ];
 const s3=load('index.html',w3=>w3.localStorage.setItem('clutch:v5',JSON.stringify(old)));
 const A3=s3.w.app;
 assert(A3.S.pr.length===1&&A3.S.pr[0].n==='Ремонт','проект перенесён');
 assert(A3.S.ts.length===2,'задача и шаг перенесены');
 assert(A3.S.ts.find(x=>x.t==='Замерить').pj===A3.S.pr[0].id,'шаг привязан к проекту');
 assert(A3.S.ts.find(x=>x.t==='Купить хлеб').chat.length===1,'переписка перенесена');
 A3.flush();
 assert(!!s3.w.localStorage.getItem('tasks:v1'),'перенос сохранён под новым ключом');
}

/* ---------- действия над задачей ---------- */
function actions(){
 console.log('действия');
 const {w,d}=load('index.html');
 const A=w.app, $=i=>d.getElementById(i);
 const qa=a=>d.querySelector('#acts [data-a='+a+']');
 const dateIn=()=>d.querySelector('#acts input[type=date]');

 dateIn().value='2030-01-15';
 dateIn().dispatchEvent(new w.Event('change'));
 assert(A.curItem().due==='2030-01-15','срок сохранён');
 assert($('cm').textContent.startsWith('15 янв'),'срок показан в шапке');

 const before=A.S.pr.length;
 qa('proj').click();
 assert(A.S.pr.length===before+1,'создан проект');
 assert(A.S.cur.k==='p','открылся проект');
 assert(A.openIn(A.S.cur.id).length===1,'исходная задача стала первым шагом');

 qa('step').click();  // prompt застаблен на «Новый шаг»
 assert(A.openIn(A.S.cur.id).length===2,'шаг добавлен');
 assert(d.querySelectorAll('#thread .row').length===2,'шаги видны в чате');

 $('ct').value='Переименованный проект';
 $('ct').dispatchEvent(new w.Event('input'));
 assert(A.curItem().n==='Переименованный проект','название правится в шапке');

 const steps=A.S.ts.length, pid=A.S.cur.id;
 qa('del').click();
 assert(!A.S.pr.some(p=>p.id===pid),'проект удалён');
 assert(A.S.ts.length===steps-2,'шаги удалены вместе с проектом');
}

(async()=>{
 const s=await common('index.html');
 s.d.getElementById('msg').focus(); assert(s.d.querySelector('.grid').classList.contains('kb-detail'),'клавиатура: чат раскрыт');
 s.d.getElementById('nt').focus(); assert(s.d.querySelector('.grid').classList.contains('kb-list'),'клавиатура: список раскрыт');
 s.d.getElementById('nt').blur(); await new Promise(r=>setTimeout(r,200));
 assert(s.d.querySelector('.grid').className==='grid','клавиатура убрана — 50/50');
 assert(!s.d.getElementById('back'),'нет стрелки «назад»');

 const t=await common('screens.html');
 const on=id=>t.d.getElementById(id).classList.contains('on');
 assert(on('scr-detail'),'экран задачи открыт');
 t.d.getElementById('back').click(); assert(on('scr-list'),'назад к списку');
 t.rows()[0].querySelector('[role=checkbox]').click(); assert(on('scr-list'),'чекбокс не уводит со списка');
 t.rows()[1].click(); t.d.dispatchEvent(new t.w.KeyboardEvent('keydown',{key:'Escape'})); assert(on('scr-list'),'Esc закрывает экран');

 storage();
 actions();
 console.log(fails?`\n${fails} ошибок`:'\nвсе тесты прошли'); process.exit(fails?1:0);
})();
