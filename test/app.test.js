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

/* ---------- снимок задачи, уходящий модели ---------- */
function payload(){
 console.log('снимок задачи');
 const {w,d}=load('index.html');
 const A=w.app;

 // задача: переписка без плейсхолдера «печатает», последнее слово за пользователем
 const task=A.S.ts.find(x=>x.pj===null);
 A.S.cur={k:'t',id:task.id};
 task.chat.push({u:'привет'},{a:'ответ'},{u:'второй вопрос'},{typing:1},{err:1,a:'сеть отвалилась'});
 let p=A.chatPayload(task,false);
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
 p=A.chatPayload(step,false);
 assert(p.task.project===A.prById(step.pj).n,'шаг передаёт название проекта');
 assert(p.task.fromStep==='s'+step.id,'и идентификатор шага, из которого открыт чат');

 // проект несёт свои шаги с идентификаторами и отметками
 const pr=A.S.pr[0];
 p=A.chatPayload(pr,true);
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
 const p=A.chatPayload(t,false);
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
function blocks(){
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
 const m=A.chatMessages(t);
 assert(m.length===3,'плейсхолдер и ошибка в переписку не уходят');
 assert(m[0].role==='user'&&m[0].content==='перенеси на пятницу','вопрос пользователя строкой');
 assert(m[1].role==='assistant'&&m[1].content[0].type==='text'&&m[1].content[1].type==='tool_use','ход модели: текст и вызов одним сообщением');
 assert(m[1].content[1].id==='u1'&&m[1].content[1].name==='task_set_due','вызов несёт идентификатор и имя');
 assert(m[2].role==='user'&&m[2].content[0].type==='tool_result'&&m[2].content[0].tool_use_id==='u1','результат отдельным сообщением с тем же идентификатором');
 t.chat.push({a:'Готово.',tu:[{id:'u2',name:'task_search',input:{}}],res:[{id:'u2',out:'не найдено',err:1}]});
 const m2=A.chatMessages(t);
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
 const vvL={}, vvL2={}, kbw=load('index.html',w2=>{w2.visualViewport={height:400,offsetTop:0,addEventListener:(n,f)=>{vvL[n]=f;}};}).w;
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

 /* область ужалась под клавиатуру — низ содержимого остаётся на месте */
 const kb2=load('index.html',w2=>{w2.visualViewport={height:800,offsetTop:0,addEventListener:(n,f)=>{vvL2[n]=f;}};}).w;
 const box=kb2.document.getElementById('list');
 Object.defineProperty(box,'scrollHeight',{value:2000,configurable:true});
 Object.defineProperty(box,'clientHeight',{value:800,configurable:true});
 box.scrollTop=300;
 kb2.visualViewport.height=460; vvL2.resize();
 assert(box.scrollTop===640,'прокрутка сдвинулась на высоту клавиатуры — низ содержимого не уехал');
 kb2.visualViewport.height=800; vvL2.resize();
 assert(box.scrollTop===300,'клавиатура убралась — прокрутка вернулась');

 /* Главное: раскладка возвращается, даже если iOS не прислал ни одного события.
    Именно так ломалось — клавиатура скрывалась, а всё оставалось поднятым. */
 const vvL3={}, kb3=load('index.html',w2=>{w2.visualViewport={height:800,offsetTop:0,addEventListener:(n,f)=>{vvL3[n]=f;}};}).w;
 const css3=n=>kb3.document.documentElement.style.getPropertyValue(n);
 kb3.visualViewport.height=460; vvL3.resize();   // фокус намеренно не ставим
 assert(css3('--vh')==='460px','клавиатура открылась');
 kb3.visualViewport.height=800;            // ни одного события не шлём
 await new Promise(r=>setTimeout(r,300));
 assert(css3('--vh')==='800px','высота вернулась без события и без фокуса — сверка идёт, пока клавиатура на экране');

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
 markdown();
 await tools();
 await files();
 blocks();
 console.log(fails?`\n${fails} ошибок`:'\nвсе тесты прошли'); process.exit(fails?1:0);
})();
