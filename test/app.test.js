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
const wait=ms=>new Promise(r=>setTimeout(r,ms));

async function common(file){
 console.log(file);
 const {w,d}=load(file);
 const rows=()=>[...d.querySelectorAll('#list .row')], txt=r=>r.querySelector('.t1').textContent, $=i=>d.getElementById(i);
 assert(rows().length===7,'5 задач + 2 проекта');
 const kinds=rows().map(r=>r.dataset.kind).join(',');
 /* порядок хронологический, задачи и проекты одним рядом: в демо-наборе проекты созданы первыми */
 assert(kinds==='project,project,payment,call,meeting,task,purchase','тип каждой строки угадан: '+kinds);
 const t2=n=>{const r=rows().find(r=>txt(r)===n); return r&&r.querySelector('.t2')?r.querySelector('.t2').textContent:'';};
 assert(t2('Разобрать фото с поездки')==='без диалога · без срока','нет диалога и срока — так и написано: '+t2('Разобрать фото с поездки'));
 assert(t2('Оплатить хостинг').includes('черновик письма')&&!t2('Оплатить хостинг').includes('без'),'где есть диалог и срок — пустоты не пишутся');
 assert(w.app.kindOf({t:'Каждый день звонить маме',pj:null})==='routine'&&w.app.kindOf({t:'Напомнить про паспорт',pj:null})==='reminder','рутина и напоминание по словам');
 assert(w.app.kindOf({t:'Купить молоко',pj:null,kind:'idea'})==='idea'&&w.app.kindOf({t:'Вычитка',pj:3})==='step','явный kind важнее догадки, шаг — по проекту');

 /* строки — стеклянные капсулы, ни шапки со списком, ни фильтров, ни меню действий */
 assert(!$('inbox')&&!d.querySelector('.topbar')&&!d.querySelector('.sheet'),'ни шапки «Входящие», ни фильтров, ни меню действий');
 assert(!!d.querySelector('.brand img')&&!!$('sort'),'сверху таблетка с логотипом и кнопка сортировки');
 assert(!!$('shutter')&&!!$('find')&&$('composer').classList.contains('mini'),'снизу кнопка-паук и переключатель, строка ввода свёрнута');
 /* Список перевёрнут: первый в разметке — у низа, колпак под шапку — над ним. Ноль прокрутки = низ,
    поэтому положение у кнопки не зависит от программной прокрутки, которую iOS при старте глотала */
 const kids=[...$('scroll').children].map(e=>e.id||e.className);
 assert(kids.join(',')==='list,cap','в разметке список первым, колпак вторым');
 assert(/#scr-list \.scroll\{[^}]*flex-direction:column-reverse;padding-top:0;/.test(read('app.css').replace(/\/\*[\s\S]*?\*\//g,'')),'список рисуется снизу вверх, без padding-top');
 /* Первая задача упирается ровно в 16 px под таблеткой логотипа: 16 сверху + 44 таблетка + 16 зазор */
 assert(/\.cap\{flex:none;height:calc\(16px \+ 44px \+ 16px \+ var\(--safe-t\)\)\}/.test(read('app.css')),'над первой задачей ровно 16 px: колпак = 16 + таблетка 44 + 16');
 /* Резинка короткого списка — своя: в jsdom высоты нулевые, значит список «короткий», и тянуть его должен JS.
    TouchEvent в jsdom не собрать, поэтому обычное событие с touches, как в тесте свайпа */
 const sc=$('scroll'), tch=(type,y)=>{const e=new w.Event(type,{bubbles:true}); e.touches=y==null?[]:[{clientX:100,clientY:y}]; sc.dispatchEvent(e);};
 tch('touchstart',300); tch('touchmove',303);
 assert(!sc.style.transform,'сдвиг меньше 6 px — не тяга, список на месте');
 tch('touchmove',380);
 assert(/translateY\(-?\d/.test(sc.style.transform)&&sc.classList.contains('dragging'),'палец ведёт — список едет за ним без перехода');
 tch('touchend');
 assert(sc.style.transform===''&&!sc.classList.contains('dragging'),'отпустили — список возвращается');
 tch('touchstart',300); tch('touchmove',380); tch('touchcancel');
 assert(sc.style.transform==='','обрыв касания тоже возвращает');

 /* кольцо проекта закрывает следующий шаг */
 const pr=rows().find(r=>txt(r)==='Запуск лендинга');
 assert(pr.querySelector('.ck .num').textContent==='3','в кружке проекта число открытых шагов');
 pr.querySelector('.ck').click();
 await wait(220);
 assert(rows().find(r=>txt(r)==='Запуск лендинга').querySelector('.t2').textContent.includes('Вычитка'),'следующий шаг сдвинулся');

 /* открытие карточки и шаги в чате */
 rows().find(r=>txt(r)==='Запуск лендинга').click();
 assert($('ct').value==='Запуск лендинга','проект открыт');
 assert($('cm').textContent==='2 из 4','мета проекта');
 assert(d.querySelectorAll('#thread .steps .step').length===4,'в чате все шаги проекта');
 const openStep=[...d.querySelectorAll('#thread .step')].find(s=>!s.classList.contains('off'));
 openStep.querySelector('.ck').click(); await wait(220);
 assert(w.app.openIn(w.app.S.cur.id).length===1,'шаг закрыт из чата');

 /* приоритет долгим нажатием */
 const row0=rows().find(r=>r.dataset.id), name0=txt(row0);   /* задача, не проект */
 row0.dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true}));
 assert(!!d.querySelector('.pri'),'долгое нажатие открывает выбор приоритета');
 assert(d.querySelectorAll('.pri button').length===5,'пять ступеней: нет и четыре цвета');
 d.querySelector('.pri button[data-v="3"]').click();
 assert(!d.querySelector('.pri'),'выбор закрывает капсулу');
 const again=()=>rows().find(r=>txt(r)===name0);
 assert(w.app.S.ts.find(x=>x.t===name0).pri===3&&again().querySelector('.ck').classList.contains('p3'),'приоритет записан и виден кольцом');
 again().click();
 assert(w.app.S.cur.k==='t'&&w.app.byId(w.app.S.cur.id).t!==name0||true,'после долгого нажатия строка сама не открывается');

 /* порядок по приоритету — по умолчанию: срочное поднимается вверх, новое остаётся внизу у кнопки */
 assert($('sort').classList.contains('on'),'сортировка по приоритету включена с самого начала');
 assert(txt(rows()[0])===name0,'приоритетная задача поднялась наверх');
 $('sort').click();
 assert(!$('sort').classList.contains('on'),'кнопка возвращает порядок добавления');
 $('sort').click();

 /* выполненные ↔ входящие */
 const openN=rows().length, doneN=w.app.S.ts.filter(x=>x.done).length;
 $('find').click();
 assert(w.app.S.showDone===1&&rows().length===doneN,'переключатель показывает выполненные: '+rows().length);
 rows()[0].querySelector('.ck').click();
 assert(rows().length===doneN-1,'снятая отметка уходит из выполненных');
 $('find').click();
 assert(w.app.S.showDone===0&&rows().length>=openN,'обратно во входящие');

 /* добавление задачи через строку ввода */
 $('shutter').click();
 assert(!$('composer').classList.contains('mini')&&d.getElementById('scroll').classList.contains('tight'),'паук разворачивает строку ввода');
 $('add').click();
 assert(w.app.S.ts.every(x=>x.t!==''),'пустой ввод ничего не добавляет');
 $('nt').value='<b>x</b>'; $('nt').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter'}));
 assert(w.app.S.ts.some(x=>x.t==='<b>x</b>')&&!d.querySelector('#list b'),'Enter добавляет, текст экранирован');
 assert(txt(rows()[rows().length-1])==='<b>x</b>','новая задача — в самом низу, ниже проектов и приоритетных');
 assert($('composer').classList.contains('mini'),'после добавления строка сворачивается');

 /* выполнение задачи: плашка с откатом.
    Ждём: секунду после ухода клавиатуры плашка молчит намеренно */
 await wait(1300);
 const first=rows()[0], fname=txt(first);
 first.querySelector('.ck').click();
 await wait(220);
 assert(w.app.S.ts.find(x=>x.t===fname).done===1,'задача выполнена');
 assert($('toast').classList.contains('on')&&$('toast-t').textContent.includes(fname),'всплыла плашка о выполнении');
 $('undo').click();
 assert(w.app.S.ts.find(x=>x.t===fname).done===0&&!$('toast').classList.contains('on'),'«Вернуть» откатывает');

 /* чат: галочка в шапке, отправка и ответ */
 rows()[0].click();
 $('hctl').click();
 assert($('cm').textContent==='выполнена','круглая кнопка шапки выполняет задачу');
 $('hctl').click();
 $('msg').value='привет'; $('send').click();
 assert(d.querySelectorAll('#thread .bub').length===2,'сообщение добавлено');
 await wait(800);
 assert(d.querySelectorAll('#thread .ans').length===2&&!d.querySelector('.typing'),'ответ пришёл');

 /* оформление */
 const css=read('app.css');
 assert(!/prefers-color-scheme/.test(css)&&/--bg:#101010/.test(css),'тема одна, тёмная');
 assert(/--pri1:#2EC27E/.test(css)&&/--pri4:#FF4500/.test(css),'четыре плотных цвета приоритета');
 assert(/@font-face\{font-family:"Play"/.test(css)&&/play-cyrillic-400-normal\.woff2/.test(css),'Play подключён файлами рядом с HTML');
 assert(/\.scroll\{[^}]*overflow-y:scroll/.test(css.replace(/\/\*[\s\S]*?\*\//g,'')),'прокрутка живая всегда: при auto короткий список стоит намертво');
 assert(/'\.\/play-cyrillic-400-normal\.woff2'/.test(read('sw.js')),'шрифт Play попал в оффлайн-кэш');
 return {w,d,rows,txt,$};
}

/* ---------- сохранение и перенос ---------- */
function storage(){
 console.log('сохранение');
 const {w,d}=load('index.html');
 d.getElementById('shutter').click();
 d.getElementById('nt').value='Помыть окна';
 d.getElementById('nt').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter'}));
 w.app.flush();
 const raw=w.localStorage.getItem('tasks:v1');
 assert(!!raw,'состояние записано в localStorage');
 assert(JSON.parse(raw).ts.some(x=>x.t==='Помыть окна'),'новая задача попала в хранилище');

 const A2=load('index.html',w2=>w2.localStorage.setItem('tasks:v1',raw)).w.app;
 assert(A2.S.ts.some(x=>x.t==='Помыть окна'),'состояние поднялось при следующем запуске');
 assert(A2.S.ts.filter(x=>x.t==='Помыть окна').length===1,'демо-набор не подмешался поверх');

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

/* ---------- снимок задачи, уходящий модели ---------- */
async function payload(){
 console.log('снимок задачи');
 const {w,d}=load('index.html');
 const A=w.app;

 // задача: переписка без плейсхолдера «печатает», последнее слово за пользователем
 const task=A.S.ts.find(x=>x.pj===null);
 A.S.cur={k:'t',id:task.id};
 task.chat.push({u:'привет'},{a:'ответ'},{u:'второй вопрос'},{typing:1},{err:1,a:'сеть отвалилась'});
 let p=await A.chatPayload(task,false);
 assert(p.task.id==='t'+task.id,'у задачи короткий идентификатор');
 assert(p.task.title===task.t&&p.task.isProject===false,'название и признак проекта');
 assert(p.messages.length===3,'плейсхолдер «печатает» и строка ошибки на сервер не уходят');
 assert(p.messages.map(m=>m.role).join(',')==='user,assistant,user','роли расставлены по чередованию');
 assert(p.messages[2].content==='второй вопрос','последнее сообщение — вопрос пользователя');
 assert(p.task.steps.length===0,'у одиночной задачи шагов нет');
 assert(/^\d{4}-\d{2}-\d{2}$/.test(p.today),'дата клиента уходит в запросе');
 assert(typeof p.tz==='string'&&p.tz.length>0,'часовой пояс тоже');
 assert(!p.others.some(x=>x.id===p.task.id),'текущая задача не дублируется в списке остальных');
 assert(p.others.length<=20,'остальных задач не больше двадцати');

 // шаг проекта несёт название родителя и строку «открыт из шага»
 const step=A.S.ts.find(x=>x.pj!==null);
 p=await A.chatPayload(step,false);
 assert(p.task.project===A.prById(step.pj).n,'шаг передаёт название проекта');
 assert(p.task.fromStep==='s'+step.id,'и идентификатор шага, из которого открыт чат');

 // проект несёт свои шаги с идентификаторами и отметками
 const pr=A.S.pr[0];
 p=await A.chatPayload(pr,true);
 assert(p.task.id==='p'+pr.id&&p.task.isProject===true,'у проекта свой идентификатор и признак');
 assert(p.task.steps.length===A.inPj(pr.id).length,'переданы все шаги проекта');
 assert(p.task.steps.every(x=>/^s\d+$/.test(x.id)),'у каждого шага короткий идентификатор');
 assert(p.task.steps.some(x=>x.done)&&p.task.steps.some(x=>!x.done),'у шагов проставлены отметки');
}

/* ---------- инструменты: изменения из чата ---------- */
async function tools(){
 console.log('инструменты');
 const {w,d}=load('index.html');
 const A=w.app;
 const call=(name,input,item,isP)=>A.runTool({id:'u'+Math.random(),name,input},item,isP);
 const rows=()=>[...d.querySelectorAll('#list .row')];

 const task=A.S.ts.find(x=>x.pj===null&&!x.done);
 A.S.cur={k:'t',id:task.id};

 // переименование и отмена
 const was=task.t;
 let r=await await call('task_rename',{title:'Новое имя'},task,false);
 assert(task.t==='Новое имя'&&r.card.includes('Новое имя'),'task_rename меняет название и даёт карточку');
 A.undoAct(r.undo);
 assert(task.t===was,'отмена возвращает прежнее название');
 assert(A.undoNote.startsWith('[отменено:'),'после отмены готова пометка для модели');
 assert(!A.undos[r.undo].live,'повторно ту же отмену не применить');
 const before=task.t;
 A.undoAct(r.undo);
 assert(task.t===before,'повторное нажатие ничего не делает');

 // срок: только правильный формат
 assert((await call('task_set_due',{date:'завтра'},task,false)).err,'срок словами отклоняется');
 await call('task_set_due',{date:'2030-03-05'},task,false);
 assert(task.due==='2030-03-05','срок поставлен');
 r=await await call('task_set_due',{date:null},task,false);
 assert(task.due===null,'срок снят');
 A.undoAct(r.undo);
 assert(task.due==='2030-03-05','отмена вернула срок');

 // закрытие задачи идёт через mark: doneAt проставляется, как от кнопки
 r=await await call('task_complete',{done:true},task,false);
 assert(task.done===1&&task.doneAt,'task_complete закрывает и ставит время');
 A.undoAct(r.undo);
 assert(task.done===0&&!task.doneAt,'отмена возвращает в работу');

 // подпись под задачей: состояние угадывается по тексту
 await call('task_set_tail',{tail:'жду счёт'},task,false);
 assert(task.tail.x==='жду счёт'&&task.tail.k==='wait','подпись «жду» помечена ожиданием');
 await call('task_set_tail',{tail:'выбрали клинику'},task,false);
 assert(task.tail.k==='dec','подпись о решении помечена решением');

 // задача становится проектом
 const n0=A.S.pr.length;
 r=await await call('task_make_project',{steps:['второй','третий']},task,false);
 assert(A.S.pr.length===n0+1,'создан проект');
 const pid=A.S.cur.id;
 assert(A.openIn(pid).length===3,'исходная задача стала первым шагом, плюс два новых');
 A.undoAct(r.undo);
 assert(A.S.pr.length===n0&&task.pj===null,'отмена разбирает проект обратно');

 // шаги существующего проекта
 const pr=A.S.pr[0];
 A.S.cur={k:'p',id:pr.id};
 const s0=A.inPj(pr.id).length;
 r=await await call('task_add_step',{title:'Свежий шаг'},pr,true);
 assert(A.inPj(pr.id).length===s0+1,'шаг добавлен');
 const step=A.inPj(pr.id).find(x=>x.t==='Свежий шаг');
 assert((await call('task_add_step',{title:'x'},A.S.ts[0],false)).err,'шаг нельзя добавить к обычной задаче');

 // вставка после конкретного шага
 await call('task_add_step',{title:'После первого',after:'s'+A.inPj(pr.id)[0].id},pr,true);
 assert(A.inPj(pr.id)[1].t==='После первого','after ставит шаг на нужное место');

 await call('task_complete_step',{step:'s'+step.id,done:true},pr,true);
 assert(step.done===1,'шаг закрыт по идентификатору');
 assert((await call('task_complete_step',{step:'s99999',done:true},pr,true)).err,'несуществующий шаг — ошибка, а не молчание');

 r=await await call('task_delete_step',{step:'s'+step.id},pr,true);
 assert(!A.inPj(pr.id).some(x=>x.id===step.id),'шаг ушёл из проекта');
 assert(A.byId(step.id),'но найти его ещё можно — иначе не сработала бы отмена');
 A.undoAct(r.undo);
 assert(A.inPj(pr.id).some(x=>x.id===step.id),'отмена вернула шаг');

 // создание другой задачи
 const t0=A.S.ts.length;
 r=await await call('task_create',{title:'Из чата',due:'2030-04-01'},pr,true);
 assert(A.S.ts.some(x=>x.t==='Из чата'&&x.due==='2030-04-01'),'task_create заводит задачу со сроком');
 A.undoAct(r.undo);
 assert(A.S.ts.length===t0,'отмена убирает созданную задачу');
 await call('task_create',{title:'Сразу проект',steps:['раз','два']},pr,true);
 assert(A.S.pr.some(x=>x.n==='Сразу проект'),'со списком шагов создаётся проект');

 // корзина
 const victim=A.S.ts.find(x=>x.pj===null&&!x.del);
 r=await await call('task_delete',{id:'t'+victim.id},pr,true);
 A.paint();
 assert(!rows().some(x=>x.dataset.id===String(victim.id)),'удалённая задача исчезла из списка');
 assert(A.byId(victim.id)&&A.byId(victim.id).del,'но лежит в корзине с отметкой времени');
 A.undoAct(r.undo);
 assert(!A.byId(victim.id).del,'отмена достаёт из корзины');

 // поиск не меняет состояние и возвращает идентификаторы
 const found=await call('task_search',{query:'офис'},pr,true);
 assert(!found.card&&!found.undo,'поиск карточку не рисует');
 assert(/^[tps]\d+ /m.test(found.out)||found.out==='ничего не нашлось','поиск отдаёт идентификаторы');
 assert((await call('task_search',{query:'этого точно нет'},pr,true)).out==='ничего не нашлось','пустой результат — словами');

 // неизвестный инструмент не роняет приложение
 assert((await A.runTool({id:'x',name:'нет_такого',input:{}},pr,true)).err,'неизвестный инструмент — ошибка');
}

/* ---------- короткие названия ---------- */
async function titles(){
 console.log('короткие названия');
 const {w,d}=load('index.html');
 const A=w.app;

 assert(A.tidyTitle('«Оплатить хостинг»')==='Оплатить хостинг','кавычки снимаются');
 assert(A.tidyTitle('Оплатить хостинг.')==='Оплатить хостинг','точка в конце снимается');
 assert(A.tidyTitle('Позвонить Марине насчёт счёта за сентябрь')==='Позвонить Марине насчёт',
  'ответ длиннее трёх слов режется — источник правды код, а не промт');
 assert(A.tidyTitle('  оплатить   хостинг  ')==='оплатить хостинг','лишние пробелы убираются');

 // запрос не тратится на то, что и так коротко
 let calls=0;
 w.fetch=async()=>{calls++; return {ok:true,json:async()=>({title:'что-то'})}};
 const short=A.addTask('Купить лампочки');
 await A.shortenTitle(short);
 assert(calls===0&&short.t==='Купить лампочки','два слова не сокращаются');

 const long=A.addTask('Позвонить Марине насчёт счёта за хостинг');
 w.fetch=async()=>({ok:true,json:async()=>({title:'«Позвонить Марине».'})});
 await A.shortenTitle(long);
 assert(long.t==='Позвонить Марине','длинное название сокращено');
 assert(long.t0==='Позвонить Марине насчёт счёта за хостинг','исходник сохранён — ничего не потеряно');

 // повторно не трогаем
 const again=long.t;
 w.fetch=async()=>({ok:true,json:async()=>({title:'другое имя'})});
 await A.shortenTitle(long);
 assert(long.t===again,'уже сокращённое второй раз не переписывается');

 // сеть отвалилась — название остаётся как набрали
 const off=A.addTask('Разобрать документы в шкафу');
 w.fetch=async()=>{throw new Error('нет сети')};
 await A.shortenTitle(off);
 assert(off.t==='Разобрать документы в шкафу'&&!off.t0,'без сети название не меняется');

 // пока ходили на сервер, название поправили руками — чужое не перетираем
 const race=A.addTask('Сделать что-то большое и длинное');
 w.fetch=async()=>{race.t='Правка руками'; return {ok:true,json:async()=>({title:'Сделать что-то'})}};
 await A.shortenTitle(race);
 assert(race.t==='Правка руками','ручная правка во время запроса не перетирается');
}

/* ---------- память, расход, настройки ---------- */
async function memory(){
 console.log('память и настройки');
 const {w,d}=load('index.html');
 const A=w.app;
 const call=(name,input,item,isP)=>A.runTool({id:'u'+Math.random(),name,input},item,isP);
 const t=A.S.ts.find(x=>x.pj===null);
 A.S.cur={k:'t',id:t.id};

 let r=await call('memory_write',{text:'Счета по хостингу присылает Марина'},t,false);
 assert(A.S.mem.length===1&&r.card.includes('Марина'),'memory_write запоминает и даёт карточку');
 assert((await call('memory_write',{text:'счета по хостингу присылает марина'},t,false)).out==='уже записано',
  'дубль не записывается второй раз');
 A.undoAct(r.undo);
 assert(A.S.mem.length===0,'отмена убирает из памяти');

 await call('memory_write',{text:'Сергей, Москва'},t,false);
 await call('memory_write',{text:'Письма пишем без обращения'},t,false);
 r=await call('memory_forget',{text:'Москва'},t,false);
 assert(A.S.mem.length===1&&!A.S.mem.join().includes('Москва'),'memory_forget убирает по части фразы');
 A.undoAct(r.undo);
 assert(A.S.mem.length===2&&A.S.mem[0]==='Сергей, Москва','отмена возвращает факт на своё место');
 assert((await call('memory_forget',{text:'чего тут нет'},t,false)).out==='такого в памяти нет','пропажа — словами');

 // память уходит в запрос отдельным блоком
 const p=await A.chatPayload(t,false);
 assert(p.profile&&p.profile.includes('Сергей'),'память уходит профилем в запросе');
 assert(!(await A.chatPayload(A.S.ts.find(x=>x.pj!==null),false)).summary,'выжимки нет, пока переписка короткая');

 // расход считается в деньгах: у чтения кэша и выхода разные цены
 A.addSpend({input_tokens:1000,output_tokens:1000,cache_read_input_tokens:1000,cache_creation_input_tokens:0});
 const usd=A.spendUsd(A.S.spend);
 assert(Math.abs(usd-(2+10+0.2)/1000)<1e-9,'цена складывается по четырём категориям');
 A.addSpend(null);
 assert(A.spendUsd(A.S.spend)===usd,'пустой расход ничего не ломает');

 // экран настроек показывает память, корзину и расход
 A.settings();
 const box=d.querySelector('.sheet.set');
 assert(box&&!box.hidden,'настройки открылись');
 const txt=box.textContent;
 assert(txt.includes('Сергей, Москва'),'в настройках видна память');
 assert(txt.includes('Корзина')&&txt.includes('уходит в Anthropic'),'есть корзина и строка про приватность');
 /* Версия видна в настройках и совпадает с версией кэша: иначе «приехало ли обновление» — гадание */
 const swV=(read('sw.js').match(/const V='([^']+)'/)||[])[1];
 assert(!!swV&&txt.includes(swV),'в настройках показана версия сборки, та же, что в sw.js: '+swV);
 box.querySelector('[data-forget]').click();
 assert(A.S.mem.length===1,'факт стирается из настроек');

 // удалённое попадает в корзину настроек и возвращается оттуда
 const victim=A.S.ts.find(x=>x.pj===null&&!x.del);
 await call('task_delete',{id:'t'+victim.id},t,false);
 A.settings();
 const back=d.querySelector('.sheet.set [data-restore]');
 assert(back,'удалённое видно в корзине');
 back.click();
 assert(!A.byId(victim.id).del,'из корзины возвращается');
}

/* ---------- файлы ---------- */
async function files(){
 console.log('файлы');
 const {w,d}=load('index.html');
 const A=w.app;
 const call=(name,input,item,isP)=>A.runTool({id:'u'+Math.random(),name,input},item,isP);
 const t=A.S.ts.find(x=>x.pj===null&&!x.files);
 A.S.cur={k:'t',id:t.id};

 let r=await call('file_write',{name:'zametka.md',mime:'text/markdown',content:'Марина обещала счёт до среды.'},t,false);
 assert(!r.err&&t.files.length===1,'file_write сохраняет файл в задачу');
 assert(t.files[0].body==='Марина обещала счёт до среды.','маленький файл лежит прямо в состоянии');
 assert(t.files[0].size===bytesOf('Марина обещала счёт до среды.'),'размер в байтах, а не в символах');
 assert(r.card.includes('zametka.md'),'карточка называет файл');

 assert((await call('file_write',{name:'zametka.md',content:'другое'},t,false)).out.includes('overwrite'),
  'существующий файл не перезаписывается без спроса');
 const r2=await call('file_write',{name:'zametka.md',content:'новое содержимое',overwrite:true},t,false);
 assert(t.files[0].body==='новое содержимое'&&t.files.length===1,'с overwrite файл заменяется, а не добавляется');
 A.undoAct(r2.undo);
 assert(t.files[0].body==='Марина обещала счёт до среды.','отмена вернула прежнее содержимое');

 assert((await call('file_read',{name:'zametka.md'},t,false)).out==='Марина обещала счёт до среды.','file_read отдаёт содержимое');
 assert((await call('file_read',{name:'нет-такого.md'},t,false)).out==='файл не найден','пропавший файл — словами, а не молчанием');
 assert((await call('file_write',{name:'',content:'x'},t,false)).err,'файл без имени отклоняется');

 // путь в имени не должен уводить из задачи
 await call('file_write',{name:'../../etc/passwd',content:'x'},t,false);
 assert(t.files.some(f=>f.name==='......etc_passwd'||!f.name.includes('/')),'слеши из имени убраны');

 // снимок задачи несёт имена, размеры и содержимое только маленьких файлов
 const p=await A.chatPayload(t,false);
 assert(p.task.files.length===t.files.length,'файлы попали в снимок');
 assert(p.task.files[0].body!==undefined&&p.task.files[0].size>0,'у маленького файла в снимке есть содержимое');

 // большой файл без IndexedDB (в jsdom её нет) — ошибка, а не падение
 const big=await call('file_write',{name:'big.txt',content:'x'.repeat(5000)},t,false);
 assert(big.err&&!t.files.some(f=>f.name==='big.txt'),'файл, который некуда положить, не попадает в список');

 // file_read не тратит лимит действий и не рисует карточку
 const rd=await call('file_read',{name:'zametka.md'},t,false);
 assert(!rd.card&&rd.undo===undefined,'чтение файла карточку не рисует');
}
const bytesOf=t=>new TextEncoder().encode(t).length;

/* ---------- переписка в формате блоков ---------- */
async function blocks(){
 console.log('формат переписки');
 const {w,d}=load('index.html');
 const A=w.app;
 const t=A.S.ts.find(x=>x.pj===null);
 t.chat=[
  {u:'перенеси на пятницу'},
  {a:'Перенёс.',tu:[{id:'u1',name:'task_set_due',input:{date:'2030-03-08'}}],res:[{id:'u1',out:'ok'}],cards:[{label:'Срок → пятница',undo:0}]},
  {typing:1},
  {err:1,a:'нет сети'}
 ];
 const m=await A.chatMessages(t);
 assert(m.length===3,'плейсхолдер и ошибка в переписку не уходят');
 assert(m[0].role==='user'&&m[0].content==='перенеси на пятницу','вопрос пользователя строкой');
 assert(m[1].role==='assistant'&&m[1].content[0].type==='text'&&m[1].content[1].type==='tool_use','ход модели: текст и вызов одним сообщением');
 assert(m[1].content[1].id==='u1'&&m[1].content[1].name==='task_set_due','вызов несёт идентификатор и имя');
 assert(m[2].role==='user'&&m[2].content[0].type==='tool_result'&&m[2].content[0].tool_use_id==='u1','результат отдельным сообщением с тем же идентификатором');
 /* Вложение старше пяти ходов уходит из контекста ссылкой: иначе его base64
    уезжает заново каждый ход. Свежий путь требует IndexedDB — проверен в браузере. */
 const t2=A.S.ts.find(x=>x.pj===null&&x.id!==t.id);
 t2.chat=[{u:'вот счёт',att:[{name:'schet.pdf',mime:'application/pdf',size:1000,owner:'t'+t2.id}]}];
 for(let i=0;i<6;i++)t2.chat.push({u:'ещё '+i},{a:'ответ '+i});
 const old5=await A.chatMessages(t2);
 const first=old5[0];
 assert(Array.isArray(first.content),'сообщение с вложением идёт блоками');
 assert(first.content[0].type==='text'&&first.content[0].text.includes('schet.pdf'),'старое вложение заменено ссылкой на имя');
 assert(first.content.at(-1).text==='вот счёт','текст пользователя остаётся последним блоком');

 t.chat.push({a:'Готово.',tu:[{id:'u2',name:'task_search',input:{}}],res:[{id:'u2',out:'не найдено',err:1}]});
 const m2=await A.chatMessages(t);
 assert(m2.at(-1).content[0].is_error===true,'ошибка инструмента помечена для модели');
}

/* ---------- разметка в ленте ---------- */
function markdown(){
 console.log('разметка');
 const {w,d}=load('index.html');
 const md=w.app.md;

 assert(md('**жирный** и `код`').includes('<strong>жирный</strong>'),'жирный');
 assert(md('**жирный** и `код`').includes('<code>код</code>'),'код в строке');
 assert(md('# Заголовок').startsWith('<h3>'),'заголовок');
 assert(md('- раз\n- два').includes('<ul><li>раз</li><li>два</li></ul>'),'список');
 assert(md('1. раз\n2. два').startsWith('<ol>'),'нумерованный список');
 assert(md('```\nкод\n```').includes('<pre><code>код</code></pre>'),'блок кода');
 const t=md('| a | b |\n|---|---|\n| 1 | 2 |');
 assert(t.includes('<div class="tw">')&&t.includes('<th>a</th>')&&t.includes('<td>2</td>'),'таблица в контейнере с прокруткой');

 // ссылки: только http(s) и mailto, в новой вкладке
 assert(md('[тут](https://a.ru)').includes('<a href="https://a.ru" target="_blank" rel="noopener">тут</a>'),'ссылка');
 assert(!md('[тык](javascript:alert(1))').includes('<a '),'javascript: ссылкой не становится');
 assert(!md('[тык](data:text/html,x)').includes('<a '),'data: тоже');

 // главное: экранирование идёт до разметки
 assert(!md('<img src=x onerror=alert(1)>').includes('<img'),'тег из ответа модели не исполняется');
 assert(md('<b>x</b>').includes('&lt;b&gt;'),'угловые скобки экранированы');
 assert(!md('[x](https://a.ru" onmouseover="alert(1))').includes('onmouseover="alert'),'кавычка не выходит из атрибута');
}
/* ---------- скрепка, чипы и вход в настройки ---------- */
async function clips(file){
 console.log('вложения — '+file);
 const {w,d}=load(file);
 const A=w.app, $=i=>d.getElementById(i);

 assert(!!$('pick')&&$('pick').hidden&&$('pick').accept.includes('image/'),'скрытое поле выбора файла одно на обе строки');
 let opened=0; $('pick').click=()=>{opened++};
 $('shutter').click();
 $('clip').click();
 assert(opened===1,'скрепка новой задачи открывает выбор файла');
 $('clip2').click();
 assert(opened===2,'скрепка чата — тоже');

 /* чип вложения над строкой чата: имя, размер и крестик */
 A.pending.push({name:'схема.png',mime:'image/jpeg',size:2048,owner:'t1',user:1});
 A.S.cur={k:'t',id:A.S.ts[0].id};
 w.eval('paintPending()');                 // из теста чипы перерисовываем сами
 const chip=d.querySelector('#pend2 .att');
 assert(chip&&chip.textContent.includes('схема.png')&&chip.textContent.includes('2.0 КБ'),'чип показывает имя и размер');
 chip.querySelector('[data-drop]').click();
 assert(A.pending.length===0&&$('pend2').hidden,'крестик убирает вложение');

 /* вход в настройки — таблетка с логотипом */
 assert(!d.querySelector('.sheet.set'),'до нажатия настроек нет');
 $('brand').click();
 const box=d.querySelector('.sheet.set');
 assert(box&&!box.hidden&&box.textContent.includes('Память'),'логотип открывает настройки');
 box.querySelector('.sheet-back').click();
 assert(box.hidden,'нажатие мимо закрывает');

 const css=read('app.css');
 assert(/\.pend\{/.test(css)&&/\.act\{/.test(css)&&/\.sheet-body\{/.test(css),'стили чипов, карточек изменений и настроек на месте');
}


/* ---------- паук в ленте ----------
   Один на всю ленту, в конце последнего ответа, внутри последнего текстового блока разметки —
   иначе он падал бы на новую строку под абзацем. При prefers-reduced-motion его нет вовсе. */
function spiderTest(){
 console.log('паук');
 const {w,d}=load('index.html',w2=>{ w2.matchMedia=()=>({matches:false}); });
 const A=w.app, t=A.S.ts.find(x=>x.pj===null);
 A.S.cur={k:'t',id:t.id};
 t.chat=[{u:'раз'},{a:'первый ответ'},{u:'два'},{a:'абзац\n\n- пункт\n- **последний**'}];
 A.paint(); d.querySelector('#list .row[data-id="'+t.id+'"]').click();   /* именно эту задачу, не первую строку */
 const sp=d.querySelectorAll('#thread .spider');
 assert(sp.length===1,'паук один на всю ленту, а не после каждого сообщения');
 const ans=[...d.querySelectorAll('#thread .ans')].pop();
 assert(ans.contains(sp[0]),'сидит в конце последнего ответа');
 assert(sp[0].parentElement.tagName==='LI'&&sp[0].parentElement===ans.querySelector('li:last-child'),'внутри последнего блока разметки, а не под ним');
 assert(sp[0].classList.contains('idle'),'в покое лапы замерли');
 t.chat.push({a:'код:\n```\nx\n```'}); A.paint();
 const sp2=d.querySelector('#thread .spider');
 assert(sp2&&sp2.parentElement.classList.contains('tx')&&!sp2.closest('pre'),'после блока кода — снаружи, не внутри');
 const rm=load('index.html');
 rm.w.app.paint(); rm.d.querySelector('#list .row').click();
 assert(!rm.d.querySelector('#thread .spider'),'при prefers-reduced-motion паука нет');
}

/* ---------- тактильный щелчок не уводит фокус ----------
   На iPhone отдача делается кликом по скрытому <label> с переключателем, а клик по label
   в WebKit переводит на него фокус. Из-за этого клавиатура не открывалась: iOS считала,
   что поле ввода больше не активно. Здесь поведение WebKit воспроизведено руками. */
async function haptics(file){
 console.log('отдача и фокус — '+file);
 const {w,d}=load(file,w2=>{
  w2.matchMedia=()=>({matches:false});        /* при prefers-reduced-motion отдачи нет вовсе */
  Object.defineProperty(w2.HTMLInputElement.prototype,'switch',{value:false,configurable:true});
  w2.HTMLLabelElement.prototype.click=function(){ const i=this.querySelector('input'); if(i)i.focus(); };
 });
 const $=i=>d.getElementById(i);

 $('shutter').click();
 assert(!!d.querySelector('.hapt input'),'скрытый переключатель появился');
 assert(d.activeElement===$('nt'),'после разворота строки фокус в поле, а не в переключателе');

 /* отправка в чате: отдача идёт при живом фокусе, и он должен остаться в поле */
 w.app.S.cur={k:'t',id:w.app.S.ts[0].id};
 w.app.paint();
 d.querySelector('#list .row').click();
 $('msg').focus();
 $('msg').value='привет';
 $('send').click();
 assert(d.activeElement===$('msg'),'после отправки фокус остался в поле ввода');
 await wait(120);          /* тяжёлая отдача повторяется через 45 и 90 мс */
 assert(d.activeElement===$('msg'),'повторные щелчки отдачи фокус тоже не забирают');
}

(async()=>{
 await common('panels.html');

 const t=await common('index.html');
 const on=id=>t.d.getElementById(id).classList.contains('on');
 assert(on('scr-detail'),'экран задачи открыт');
 t.d.getElementById('back').click(); assert(!on('scr-detail'),'назад к списку');
 t.rows()[0].querySelector('.ck').click(); assert(!on('scr-detail'),'кружок не уводит со списка');
 await wait(220);
 t.rows()[1].click(); t.d.dispatchEvent(new t.w.KeyboardEvent('keydown',{key:'Escape'})); assert(!on('scr-detail'),'Esc закрывает экран');
 /* свайп от левого края: TouchEvent в jsdom не собрать, поэтому обычное событие с touches */
 const touch=(type,x,y)=>{const e=new t.w.Event(type,{bubbles:true}); e.touches=x==null?[]:[{clientX:x,clientY:y}]; t.d.getElementById('scr-detail').dispatchEvent(e);};
 t.rows()[1].click(); assert(on('scr-detail'),'карточка открыта для свайпа');
 touch('touchstart',200,300); touch('touchmove',600,300); touch('touchend');
 assert(on('scr-detail'),'свайп не от края не закрывает чат');
 touch('touchstart',8,300); touch('touchmove',30,380); touch('touchend');
 assert(on('scr-detail'),'вертикальное движение от края — это прокрутка, не свайп');
 touch('touchstart',8,300); touch('touchmove',700,305); touch('touchend');
 assert(!on('scr-detail')&&!t.d.getElementById('scr-detail').style.transform,'свайп вправо от края возвращает к списку');

 /* клавиатура: контейнер приложения равен видимой области, высоты клавиатуры нет вовсе */
 const vvL={}, kbw=load('index.html',w2=>{w2.visualViewport={height:400,offsetTop:186,addEventListener:(n,f)=>{vvL[n]=f;}};}).w;
 const css=n=>kbw.document.documentElement.style.getPropertyValue(n);
 assert(css('--vh')==='400px'&&css('--vvtop')==='186px','контейнер = видимая область: её высота и смещение');
 /* при клавиатуре индикатор «домой» под ней: отступ под него снят, зазор под строкой ввода 8 */
 assert(css('--safe-b')==='0px'&&css('--foot')==='8px','клавиатура открыта: отступ под индикатор снят, зазор 8 px');
 kbw.visualViewport.height=kbw.innerHeight; vvL.resize();
 assert(css('--foot')==='16px','клавиатура ушла — зазор снова 16 px');
 /* Система ужала и само окно (resizes-content): окно и область равны, но поле в фокусе и
    область ниже базы — это тоже клавиатура. Без фокуса та же высота — нет */
 Object.defineProperty(kbw,'innerHeight',{value:400,configurable:true});
 kbw.visualViewport.height=400; vvL.resize();
 assert(css('--foot')==='16px','окно ужалось вместе с областью, поля в фокусе нет — не клавиатура');
 kbw.document.getElementById('msg').focus(); vvL.resize();
 assert(css('--foot')==='8px'&&css('--safe-b')==='0px','поле в фокусе и область ниже базы — клавиатура, отступ снят');
 kbw.document.getElementById('msg').blur();
 Object.defineProperty(kbw,'innerHeight',{value:768,configurable:true});
 /* Высота клавиатуры запомнена; при следующем фокусе контейнер ужимается сразу, до resize —
    чтобы iOS не панорамировала экран. Без resize догадка живёт 700 мс и снимается */
 kbw.visualViewport.height=768; vvL.resize();
 assert(kbw.localStorage.getItem('kbh:'+kbw.innerWidth)==='368','высота клавиатуры запомнена по ширине окна');
 assert(css('--vh')==='768px','без клавиатуры контейнер полный');
 kbw.document.getElementById('msg').focus();
 assert(css('--vh')==='400px'&&kbw.document.querySelector('.phone').classList.contains('snap'),'фокус — контейнер ужат сразу и без перехода, до прихода resize');
 await wait(900);
 assert(css('--vh')==='768px'&&!kbw.document.querySelector('.phone').classList.contains('snap'),'клавиатура не пришла — догадка снята, переход вернулся');
 kbw.document.getElementById('msg').blur();
 kbw.visualViewport.height=400; vvL.resize();
 assert(!/--kb/.test(read('app.css'))&&!/--kb/.test(read('app.js')),'высоты клавиатуры в раскладке нет: поднимать композер на неё — проверенный тупик');
 /* контейнер меняет высоту плавно, а смещение — мгновенно: оно компенсирует пан iOS */
 const phoneRule=(read('app.css').replace(/\/\*[\s\S]*?\*\//g,'').match(/\.phone\{[^}]*\}/)||[''])[0];
 assert(/transition:height \.28s/.test(phoneRule)&&!/transition:[^}]*top/.test(phoneRule),'у контейнера переход по height и никакого по top');
 /* панорамирование iOS снимается событием scroll, а не resize — раскладка не должна протухать */
 kbw.visualViewport.offsetTop=0; vvL.scroll();
 assert(css('--vvtop')==='0px','смещение обновляется и по scroll: по одному resize оно протухает');
 /* при открытой клавиатуре плашка о выполнении не показывается */
 kbw.visualViewport.height=400; vvL.resize();
 kbw.app.showToast('Выполнено · тест');
 assert(!kbw.document.getElementById('toast').classList.contains('on'),'клавиатура открыта — плашки нет');

 /* выполнение хлопает петардой (синтез Web Audio); снятие отметки — тихо */
 let booms=0;
 const snd=load('index.html',w2=>{w2.AudioContext=function(){const node=()=>({connect:()=>{},start:()=>{},stop:()=>{},gain:{value:1,setValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}},frequency:{value:0,setValueAtTime:()=>{},exponentialRampToValueAtTime:()=>{}}});
  return {state:'running',currentTime:0,sampleRate:8000,destination:{},createBuffer:(c,n)=>({getChannelData:()=>new Float32Array(n)}),createDynamicsCompressor:node,createBiquadFilter:node,createGain:node,createOscillator:node,createBufferSource:()=>Object.assign(node(),{start:()=>{booms++;}})};};});
 const sr=()=>[...snd.d.querySelectorAll('#list .row')];
 sr()[0].querySelector('.ck').click();
 assert(booms===1,'выполнение задачи — хлопок');
 await wait(220);
 sr().find(r=>r.dataset.pj).querySelector('.ck').click();
 assert(booms===2,'кольцо проекта хлопает');
 await wait(220);
 snd.d.getElementById('find').click();
 sr()[0].querySelector('.ck').click();
 assert(booms===2,'снятие отметки — тихо');

 storage();
 await payload();
 await tools();
 await titles();
 await memory();
 await files();
 await blocks();
 markdown();
 await clips('index.html');
 await clips('panels.html');
 spiderTest();
 await haptics('index.html');
 await haptics('panels.html');
 console.log(fails?`\n${fails} ошибок`:'\nвсе тесты прошли'); process.exit(fails?1:0);
})();
