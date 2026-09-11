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
 /* иконки типов слева от названия */
 const kinds=rows().map(r=>r.dataset.kind).join(',');
 assert(kinds==='payment,call,meeting,task,purchase,project,project','тип каждой строки угадан: '+kinds);
 const t2=n=>{const r=rows().find(r=>txt(r)===n); return r&&r.querySelector('.t2')?r.querySelector('.t2').textContent:'';};
 assert(t2('Разобрать фото с поездки')==='без диалога· без срока','нет диалога и срока — так и написано: '+t2('Разобрать фото с поездки'));
 assert(t2('Оплатить хостинг').includes('черновик письма')&&!t2('Оплатить хостинг').includes('без'),'где есть диалог и срок — пустоты не пишутся');
 assert(rows().filter(r=>!r.dataset.pj).every(r=>r.querySelector('.t2')),'у каждой задачи есть подпись');
 assert(rows().every(r=>r.querySelector('.t1 > .ki')&&!r.querySelector('.ki svg')),'у каждой строки маркер «>» слева от названия, без иконок');
 assert(w.app.kindOf({t:'Каждый день звонить маме',pj:null})==='routine'&&w.app.kindOf({t:'Напомнить про паспорт',pj:null})==='reminder','рутина и напоминание по словам');
 assert(w.app.kindOf({t:'Купить молоко',pj:null,kind:'idea'})==='idea'&&w.app.kindOf({t:'Вычитка',pj:3})==='step','явный kind важнее догадки, шаг — по проекту');
 rows()[5].querySelector('[role=checkbox]').click();
 assert($('cnt').textContent==='9','кольцо закрывает следующий шаг');
 assert(rows()[5].querySelector('.t2').textContent.includes('Вычитка'),'следующий шаг сдвинулся');
 rows()[5].click();
 assert($('ct').value==='Запуск лендинга','проект открыт');
 assert($('cm').textContent.startsWith('2 из 4 шагов · '),'мета проекта');
 assert(d.querySelectorAll('#thread .row').length===2&&!d.querySelector('#thread .row .ki'),'в чате 2 открытых шага, без иконок типа');
 d.querySelectorAll('#thread .row [role=checkbox]')[0].click();
 d.querySelectorAll('#thread .row [role=checkbox]')[0].click();
 assert(!rows().some(r=>txt(r)==='Запуск лендинга'),'завершённый проект скрыт');
 assert($('inbox').querySelector('.logo').textContent==='CLUTCH','в шапке списка логотип CLUTCH');
 const br=[...$('inbox').querySelector('.brand').children];
 assert(br[0].querySelector('svg')&&br[1].className==='logo'&&br[2].className==='ttl','сверху иконка, под ней логотип, под логотипом «Входящие»');
 $('inbox').querySelector('.logo').click(); assert(d.querySelector('#inbox .ttl').textContent==='Входящие','нажатие на логотип список не переключает');
 /* «Входящие» переключают список на выполненные и обратно */
 assert(!d.querySelector('.sec'),'отдельного раздела «Выполненные» нет');
 $('inbox').click();
 assert(rows().length===5&&d.querySelector('#inbox .ttl').textContent==='Выполненные'&&$('cnt').textContent==='5','нажатие на «Входящие» показывает выполненные');
 rows().find(r=>txt(r)==='Вычитка').querySelector('[role=checkbox]').click();
 assert(rows().length===4&&$('cnt').textContent==='4','снятая отметка уходит из выполненных');
 $('inbox').click();
 assert(d.querySelector('#inbox .ttl').textContent==='Входящие'&&rows().some(r=>txt(r)==='Запуск лендинга'),'повторное нажатие — обратно, проект вернулся');
 $('inbox').click();
 $('add').click(); assert($('err').style.display==='block','ошибка при пустом вводе');
 $('nt').value='<b>x</b>'; $('nt').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter'}));
 assert($('ct').value==='<b>x</b>'&&!d.querySelector('#list b'),'Enter добавляет, текст экранирован');
 assert(d.querySelector('#inbox .ttl').textContent==='Входящие','после добавления список возвращается к входящим');
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

/* ---------- действия: меню по долгому нажатию ---------- */
async function actions(){
 console.log('действия');
 const {w,d}=load('index.html');
 const A=w.app, wait=ms=>new Promise(r=>setTimeout(r,ms));
 const rows=()=>[...d.querySelectorAll('#list .row')];
 const sheet=()=>d.querySelector('.sheet');
 const mi=a=>d.querySelector('.sheet .mi[data-a='+a+']');
 /* Правая кнопка открывает то же меню, что и удержание пальцем,
    и в jsdom это единственный воспроизводимый путь */
 const press=el=>el.dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true}));

 assert(!d.getElementById('acts'),'панели действий в чате больше нет');

 // долгое нажатие не должно открывать саму задачу
 const was=A.S.cur.k+':'+A.S.cur.id;
 press(rows()[1]);
 assert(sheet()&&!sheet().hidden,'меню открылось долгим нажатием');
 rows()[1].click();
 assert(A.S.cur.k+':'+A.S.cur.id===was,'после долгого нажатия строка не открывается');
 A.closeMenu();

 // срок
 const title=rows()[0].querySelector('.t1').textContent;
 press(rows()[0]);
 mi('del').click();
 assert(!sheet().hidden,'нажатие сразу после открытия игнорируется');
 await wait(450);
 assert(!!mi('due')&&!!mi('proj')&&!!mi('del'),'в меню задачи срок, проект и удаление');
 const din=d.querySelector('.sheet input[type=date]');
 din.value='2030-01-15'; din.dispatchEvent(new w.Event('change'));
 assert(A.S.ts.find(x=>x.t===title).due==='2030-01-15','срок выставлен из меню');
 assert(sheet().hidden,'меню закрылось после выбора даты');

 // задача становится проектом
 const before=A.S.pr.length;
 press(rows()[0]); await wait(450);
 mi('proj').click();
 assert(A.S.pr.length===before+1,'создан проект');
 assert(A.S.cur.k==='p','открылся проект');
 assert(A.openIn(A.S.cur.id).length===1,'исходная задача стала первым шагом');

 // добавление шага из меню проекта
 const pid=A.S.cur.id;
 press(rows().find(r=>r.dataset.pj===String(pid))); await wait(450);
 assert(!!mi('step')&&!mi('proj'),'в меню проекта шаг вместо «сделать проектом»');
 mi('step').click();
 const si=()=>d.querySelector('#thread .stepin');
 assert(!!si(),'поле шага появилось в списке шагов');
 si().value='Новый шаг';
 si().dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 assert(A.openIn(pid).length===2,'шаг добавлен');
 si().dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 assert(!si(),'Escape закрывает поле');

 // переименование прямо в шапке
 d.getElementById('ct').value='Переименованный проект';
 d.getElementById('ct').dispatchEvent(new w.Event('input'));
 assert(A.curItem().n==='Переименованный проект','название правится в шапке');

 // удаление проекта в два касания
 const steps=A.S.ts.length;
 press(rows().find(r=>r.dataset.pj===String(pid))); await wait(450);
 mi('del').click();
 assert(A.S.pr.some(p=>p.id===pid),'первое касание ничего не удаляет');
 assert(mi('del').textContent.includes('Точно'),'меню просит подтвердить');
 await wait(450);
 mi('del').click();
 assert(!A.S.pr.some(p=>p.id===pid),'второе касание удаляет проект');
 assert(A.S.ts.length===steps-2,'шаги удалены вместе с проектом');
}

/* ---------- данные, уходящие модели ---------- */
function payload(){
 console.log('запрос к модели');
 const {w,d}=load('index.html');
 const A=w.app;

 // задача: переписка без плейсхолдера «печатает», последнее слово за пользователем
 const task=A.S.ts.find(x=>x.pj===null);
 A.S.cur={k:'t',id:task.id};
 task.chat.push({u:'привет'},{a:'ответ'},{u:'второй вопрос'},{typing:1});
 let p=A.chatPayload(task,false);
 assert(p.kind==='task'&&p.title===task.t,'задача: вид и название');
 assert(p.messages.length===3,'плейсхолдер «печатает» не уходит на сервер');
 assert(p.messages.map(m=>m.role).join(',')==='user,assistant,user','роли расставлены по чередованию');
 assert(p.messages[2].text==='второй вопрос','последнее сообщение — вопрос пользователя');
 assert(!('steps' in p),'у одиночной задачи шагов нет');

 // шаг проекта несёт название родителя
 const step=A.S.ts.find(x=>x.pj!==null);
 p=A.chatPayload(step,false);
 assert(p.project===A.prById(step.pj).n,'шаг проекта передаёт название проекта');

 // проект несёт свои шаги с отметками
 const pr=A.S.pr[0];
 p=A.chatPayload(pr,true);
 assert(p.kind==='project'&&p.title===pr.n,'проект: вид и название');
 assert(p.steps.length===A.inPj(pr.id).length,'переданы все шаги проекта');
 assert(p.steps.some(x=>x.done)&&p.steps.some(x=>!x.done),'у шагов проставлены отметки');
 assert(p.note===pr.why,'заметка проекта — это «что мешает»');
}

(async()=>{
 const s=await common('panels.html');
 s.d.getElementById('msg').focus(); assert(s.d.querySelector('.grid').classList.contains('kb-detail'),'клавиатура: чат раскрыт');
 s.d.getElementById('nt').focus(); assert(s.d.querySelector('.grid').classList.contains('kb-list'),'клавиатура: список раскрыт');
 s.d.getElementById('nt').blur(); await new Promise(r=>setTimeout(r,200));
 assert(s.d.querySelector('.grid').className==='grid','клавиатура убрана — 50/50');
 assert(!s.d.getElementById('back'),'нет стрелки «назад»');

 const t=await common('index.html');
 const on=id=>t.d.getElementById(id).classList.contains('on');
 assert(on('scr-detail'),'экран задачи открыт');
 t.d.getElementById('back').click(); assert(on('scr-list'),'назад к списку');
 t.rows()[0].querySelector('[role=checkbox]').click(); assert(on('scr-list'),'чекбокс не уводит со списка');
 t.rows()[1].click(); t.d.dispatchEvent(new t.w.KeyboardEvent('keydown',{key:'Escape'})); assert(on('scr-list'),'Esc закрывает экран');
 assert(t.d.querySelector('#scr-detail .pnl > .ft #msg')&&t.d.querySelector('#scr-list .pnl > .ft #nt')&&!t.d.getElementById('fab'),'оба поля ввода внутри своих панелей, прилипают к низу');
 /* свайп от левого края: TouchEvent в jsdom не собрать, поэтому обычное событие с touches */
 const touch=(type,x,y)=>{const e=new t.w.Event(type,{bubbles:true}); e.touches=x==null?[]:[{clientX:x,clientY:y}]; t.d.getElementById('scr-detail').dispatchEvent(e);};
 t.rows()[1].click(); assert(on('scr-detail'),'карточка открыта для свайпа');
 touch('touchstart',200,300); touch('touchmove',600,300); touch('touchend');
 assert(on('scr-detail'),'свайп не от края не закрывает чат');
 touch('touchstart',8,300); touch('touchmove',30,380); touch('touchend');
 assert(on('scr-detail'),'вертикальное движение от края — это прокрутка, не свайп');
 touch('touchstart',8,300); touch('touchmove',700,305); touch('touchend');
 assert(on('scr-list')&&!t.d.getElementById('scr-detail').style.transform,'свайп вправо от края возвращает к списку');

 /* клавиатура: контейнер = видимая область. Обе величины читаются по обоим событиям.
    Обновлять смещение только по resize нельзя — оно протухает: iOS панорамирует при
    фокусе, а возвращает смещение в ноль уже событием scroll. */
 const vvL={}, kbw=load('index.html',w2=>{w2.visualViewport={height:400,offsetTop:0,addEventListener:(n,f)=>{vvL[n]=f;}};}).w;
 const css=n=>kbw.document.documentElement.style.getPropertyValue(n);
 assert(css('--vh')==='400px'&&css('--vvtop')==='0px','высота и смещение берутся у видимой области');
 kbw.visualViewport.height=300; kbw.visualViewport.offsetTop=120; vvL.resize();
 assert(css('--vh')==='300px','клавиатура выехала — контейнер ужался');
 assert(css('--vvtop')==='120px','панорамирование при открытии клавиатуры скомпенсировано');
 kbw.visualViewport.height=280; kbw.visualViewport.offsetTop=200; vvL.scroll();
 assert(css('--vh')==='280px','событие scroll обновляет высоту');
 assert(css('--vvtop')==='200px','и смещение тоже — иначе оно протухает, когда iOS возвращает его в ноль');
 kbw.visualViewport.height=796; kbw.visualViewport.offsetTop=0; vvL.scroll();
 assert(css('--vvtop')==='0px','возврат смещения в ноль доходит до переменной');

 /* выполнение хлопает петардой (синтез Web Audio); снятие отметки — тихо */
 let booms=0;
 const snd=load('index.html',w2=>{w2.AudioContext=function(){const node=()=>({connect:()=>{},start:()=>{},stop:()=>{},gain:{value:1,setValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}},frequency:{value:0,setValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}}});
  return {state:'running',currentTime:0,sampleRate:8000,destination:{},createBuffer:(c,n)=>({getChannelData:()=>new Float32Array(n)}),createDynamicsCompressor:node,createBiquadFilter:node,createGain:node,createOscillator:node,createBufferSource:()=>Object.assign(node(),{start:()=>{booms++;}})};};});
 const sr=()=>[...snd.d.querySelectorAll('#list .row')];
 sr()[0].querySelector('[role=checkbox]').click();
 assert(booms===1,'выполнение задачи — хлопок');
 sr()[4].querySelector('[role=checkbox]').click();
 snd.d.getElementById('inbox').click(); sr()[0].querySelector('[role=checkbox]').click();
 assert(booms===2,'кольцо проекта хлопает, снятие отметки — нет');

 storage();
 await actions();
 payload();
 console.log(fails?`\n${fails} ошибок`:'\nвсе тесты прошли'); process.exit(fails?1:0);
})();
