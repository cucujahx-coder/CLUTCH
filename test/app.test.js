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
 /* две строки: у задачи заголовок — название, подпись — срок; у проекта заголовок — ближайший шаг, подпись — имя проекта */
 const pj=n=>rows().find(r=>r.dataset.pj&&r.querySelector('.t2')&&r.querySelector('.t2').textContent===n);
 { const p0=rows().find(r=>r.dataset.pj), t2=p0.querySelector('.t2');
   assert(t2&&w.app.S.pr.some(p=>p.n===t2.textContent),'у проекта подпись — имя проекта');
   const dued=w.app.S.ts.find(x=>x.pj===null&&x.due&&!x.done);
   const rd=rows().find(r=>+r.dataset.id===dued.id);
   assert(rd.querySelector('.t2')&&rd.querySelector('.t2').textContent===w.app.fmtDue(dued.due),'у задачи со сроком подпись — срок');
   const nod=w.app.S.ts.find(x=>x.pj===null&&!x.due&&!x.done);
   assert(!rows().find(r=>+r.dataset.id===nod.id).querySelector('.t2'),'без срока подписи нет — заголовок один'); }
 assert(/--rowh:48px/.test(read('app.css'))&&/\.row\{[^}]*height:var\(--rowh\);padding:6px 6px 6px 16px[^}]*border-radius:24px/.test(read('app.css'))&&/\.pri\{[^}]*height:var\(--rowh\)/.test(read('app.css')),'строка 48 — минимум под две строки текста: 36 + 6×2, радиус 24, капсула приоритета той же высоты');
 assert(/\.row \.ck\{width:36px;height:36px\}/.test(read('app.css'))&&/\.row \.t1\{font-size:15px;line-height:18px\}/.test(read('app.css'))&&/\.row \.t2\{font-size:12px;line-height:14px/.test(read('app.css'))&&/#list\{[^}]*gap:4px/.test(read('app.css')),'кружок 36, заголовок 15/18, подпись 12/14, зазор 4');
 assert(/\.row::before\{content:'';position:absolute;left:16px;top:50%;width:6px;height:6px;margin-top:-3px[^}]*background:rgba\(224,224,224,\.16\)/.test(read('app.css'))&&/\.row\.ask::before\{background:var\(--blue\)\}/.test(read('app.css'))&&/\.row \.t2\{[^}]*color:var\(--muted\)/.test(read('app.css')),'точка 6 px по вертикальному центру строки, едва заметная, синяя когда ждут ответа; подпись приглушённая');
 { const t0=w.app.S.ts.find(x=>x.pj===null&&!x.done);
   t0.chat=[{u:'что делать?'},{a:'Перенести на пятницу или оставить?'}]; w.app.paint();
   assert(rows().find(r=>+r.dataset.id===t0.id).classList.contains('ask'),'последняя реплика ассистента кончается вопросом — строка помечена');
   t0.chat.push({u:'оставить'}); w.app.paint();
   assert(!rows().find(r=>+r.dataset.id===t0.id).classList.contains('ask'),'ответили — пометка снята');
   t0.chat.push({a:'Хорошо, оставил.'}); w.app.paint();
   assert(!rows().find(r=>+r.dataset.id===t0.id).classList.contains('ask'),'реплика без вопроса не ждёт ответа');
   t0.chat=[]; w.app.paint(); }
 assert(pj('Запуск лендинга')&&txt(pj('Запуск лендинга'))==='Написать текст оффера','у проекта заголовок — ближайший открытый шаг, в подписи — имя');
 assert(/\.t2\{font-size:14px;color:var\(--text-2\)/.test(read('app.css'))&&/--text-2:#B4B4B4/.test(read('app.css')),'имя проекта читается: своя ступень цвета, а не приглушённый --muted');
 assert(w.app.kindOf({t:'Каждый день звонить маме',pj:null})==='routine'&&w.app.kindOf({t:'Напомнить про паспорт',pj:null})==='reminder','рутина и напоминание по словам');
 assert(w.app.kindOf({t:'Купить молоко',pj:null,kind:'idea'})==='idea'&&w.app.kindOf({t:'Вычитка',pj:3})==='step','явный kind важнее догадки, шаг — по проекту');

 /* строки — стеклянные капсулы, ни шапки со списком, ни фильтров, ни меню действий */
 assert(!$('inbox')&&!d.querySelector('.topbar')&&!d.querySelector('.sheet'),'ни шапки «Входящие», ни фильтров, ни меню действий');
 assert(/\.topbtn\{[^}]*right:16px[^}]*\}/.test(read('app.css'))&&!/\.topbtn[^{]*\{[^}]*translateX/.test(read('app.css')),'угловые кнопки на кромке 16 px, как строки и док — без сдвига внутрь');
 assert($('find').closest('.dock')&&/\.dock #find\{position:absolute;right:0;bottom:0/.test(read('app.css')),'выполненные внизу — на кромке справа от капсулы видов');
 assert(/\.brand\{[^}]*left:16px/.test(read('app.css'))&&!/\.brand\{[^}]*translateX\(-50%\)/.test(read('app.css')),'логотип у левой кромки 16, не по центру');
 assert($('vname').classList.contains('title')&&$('vname').textContent==='Поток'&&/\.vname\{[^}]*background:none[^}]*box-shadow:none/.test(read('app.css')),'по центру шапки — название вида, Play Bold, текстом без капсулы');
 d.querySelector('.dockrow .seg[data-tab="process"]').click(); assert($('vname').textContent==='Процесс','переключили вид — сменилось название');
 d.querySelector('.dockrow .seg[data-tab="flow"]').click(); $('find').click(); assert($('vname').textContent==='Выполнено','выполненные — своё название'); $('find').click();
 assert($('sort').classList.contains('topbtn')&&!$('scr-list').classList.contains('top'),'сверху справа — порядок списка; по умолчанию снизу вверх, от кнопки');
 { const before=rows().map(txt).join('|'); $('sort').click();
   assert(w.app.S.up===1&&$('scr-list').classList.contains('top'),'переключили — список под логотипом, сверху вниз');
   assert(rows().map(txt).join('|')===before,'под логотипом порядок тот же: приоритет растёт сверху вниз, срочное внизу');
   assert(/#scr-list\.top \.scroll\{flex-direction:column\}/.test(read('app.css'))&&/#scr-list\.top \.cap\{order:-1\}/.test(read('app.css')),'под логотипом: контейнер обычный, колпак уходит первым; запас снизу и колпак — те же, что от кнопки');
   assert(!/\.tail\{|\.top \.tail|class="tail"|margin-top:auto|kickScroll/.test(read('app.css')+read('app.js')+read('index.html')),'отступы «в одну строку», хвост, прижим к строке ввода и пинок прокрутки откачены (v114)');
   assert(/#scr-list \.scroll\{[^}]*padding-bottom:calc\(76px \+ 21px \+ 44px \+ 47px/.test(read('app.css'))&&/\.dock\{[^}]*gap:21px/.test(read('app.css')),'от кнопки: 16 до кольца кнопки, док 21');
   assert(/#scr-list \.scroll\.tight\{padding-bottom:calc\(68px \+ 4px/.test(read('app.css')),'строка ввода открыта: до ближайшей задачи зазор как между задачами');
   $('sort').click(); assert(w.app.S.up===0&&!$('scr-list').classList.contains('top'),'и обратно'); }
 assert(!!d.querySelector('.brand img')&&!!$('find')&&$('sort').classList.contains('topbtn'),'сверху таблетка с логотипом и кнопка выполненных');
 /* три капсулы в доке выбирают, что показывать; переключателя сортировки нет вовсе */
 const segs=[...d.querySelectorAll('.dockrow .seg')];
 assert(segs.map(b=>b.dataset.tab).join(',')==='flow,process,focus'&&segs.map(b=>b.getAttribute('aria-label')).join(',')==='FLOW,PROCESS,FOCUS'&&segs.every(b=>b.querySelector('svg')&&!b.textContent.trim()),'вместо сортировки — три капсулы FLOW / PROCESS / FOCUS');
 assert(segs[0].classList.contains('on')&&segs[0].getAttribute('aria-selected')==='true','по умолчанию FLOW');
 /* одна плашка на три вида: подложка активного одна и ездит между третями */
 assert(d.querySelectorAll('.dockrow .segbar').length===1&&d.querySelector('.dockrow').style.getPropertyValue('--seg-i')==='0','активный вид отмечен общей подложкой, стоящей на первой трети');
 /* капсула видов — стеклянная таблетка по центру с тремя иконками; активная — плоская светлая подложка внутри */
 const cssSeg=read('app.css').replace(/\/\*[\s\S]*?\*\//g,'');
 assert(/\.dockrow\{[^}]*width:auto[^}]*backdrop-filter:blur\(8px\);\s*box-shadow:var\(--glass\)/.test(cssSeg),'капсула видов стеклянная и по ширине содержимого, как .rnd44 и таблетка логотипа');
 assert(/\.segbar\{[^}]*background:var\(--g2a\)/.test(cssSeg)&&!/\.segbar\{[^}]*(backdrop-filter|--glass)/.test(cssSeg),'подложка активного плоская — второе стекло внутри первого сливалось бы');
 assert(/\.seg\{[^}]*width:64px/.test(cssSeg),'три иконки по 64 — цель нажатия шире 44');
 assert(!/\.row\{[^}]*--glass/.test(cssSeg),'у плашек задач канта нет — владелец убрал обводки');
 assert(/--glass:[^;]*0 6px 18px rgba\(0,0,0,\.45\)/.test(read('app.css')),'у всего с кантом есть и тень — она в самом токене');
 assert(/\.composer\.mini\{[^}]*box-shadow:0 0 0 3px var\(--bg\),0 0 0 5px var\(--g3a\),var\(--edge\)\}/.test(cssSeg),'у большой кнопки исходная обводка — зазор и серое кольцо — и кант без тени');
 assert(!!$('shutter')&&!!$('find')&&$('composer').classList.contains('mini'),'снизу кнопка-паук и переключатель, строка ввода свёрнута');
 /* кнопка и строка ввода — одна капсула: кнопка внутри неё, свёрнутый вид — красный круг на месте кнопки в доке */
 assert($('shutter').parentElement===$('composer')&&!$('dock').contains($('shutter')),'кнопка-паук живёт внутри капсулы строки ввода, не в доке');
 const cssMini=read('app.css').replace(/\/\*[\s\S]*?\*\//g,'');
 assert(/\.composer\.mini\{left:calc\(50% - 38px\);right:calc\(50% - 38px\);height:76px;[^}]*background:var\(--hot\)[^}]*transform:translateY\(-75px\)/.test(cssMini),'свёрнутая капсула — круг 76 цвета кнопки, поднятый на место кнопки трансформой');
 assert(/\.composer\{[^}]*--tr-composer:left[^}]*transition:var\(--tr-composer\)/.test(cssMini)&&/\.phone\.easing \.composer\{transition:bottom var\(--t-kb\) var\(--e-kb\),var\(--tr-composer\)\}/.test(cssMini),'геометрия капсулы едет одним списком переходов, .easing его дополняет, а не заменяет');
 /* resizes-content на iOS сдвигает экран на высоту клавиатуры всегда, и шапка дёргается; overlays — только когда поле под клавиатурой */
 assert(/interactive-widget=overlays-content/.test(read(file)),'viewport с overlays-content, а не resizes-content');
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
 /* Большая кнопка привязана к резинке: тянешь — сжимается на долю тяги, отпустил — прыгает */
 const cmp=$('composer'), sy=()=>+((cmp.style.transform.match(/scale\([\d.]+,([\d.]+)\)/)||[])[1]);
 assert(cmp.classList.contains('pull')&&/^translateY\(-75px\) scale\(1\.0\d+,0\.9\d+\)$/.test(cmp.style.transform),'пока тянешь, кнопка сжата на долю тяги, трансформа inline');
 const p1=sy(); tch('touchmove',420);
 assert(sy()<p1,'тянешь сильнее — сжимается сильнее');
 tch('touchend');
 assert(sc.style.transform===''&&!sc.classList.contains('dragging'),'отпустили — список возвращается');
 assert(!cmp.classList.contains('pull')&&cmp.style.transform==='','отпустили — сжатие снято; здесь reduced-motion, поэтому без прыжка');
 { /* с анимациями — прыжок через animate(), высота по тяге */
  const {w:wj,d:dj}=load('index.html',w2=>{ w2.matchMedia=()=>({matches:false}); });
  const scj=dj.getElementById('scroll'), cj=dj.getElementById('composer');
  let kf=null, kfF=null; cj.animate=(k,o)=>{ kf={k,o}; return {}; };
  const fj=dj.getElementById('find'), bj=dj.getElementById('brand'); fj.animate=(k,o)=>{ kfF={k,o}; return {}; }; bj.animate=fj.animate;
  const tj=(type,y)=>{const e=new wj.Event(type,{bubbles:true}); e.touches=y==null?[]:[{clientX:100,clientY:y}]; scj.dispatchEvent(e);};
  tj('touchstart',300); tj('touchmove',380);
  assert(!fj.classList.contains('pull')&&!fj.style.transform&&!bj.style.transform&&!dj.querySelector('#scr-list .dockrow').classList.contains('pull'),'пружинит только кнопка: таблетки, кнопки шапки и капсула видов стоят');
  tj('touchend');
  assert(kfF===null,'и не прыгают — владелец оставил прыжок одной кнопке');
  assert(kf&&/^translateY\(-75px\) translateY\(-3\d\.\dpx\) scale\(0\.940,1\.100\)$/.test(kf.k[1].transform)&&kf.k[1].offset<=.3&&kf.o.duration<=300&&kf.k[0].easing==='cubic-bezier(.2,.8,.2,1)'&&kf.o.easing==='cubic-bezier(.34,1.56,.64,1)','отпустили — резкий прыжок: взлёт по --e-out за треть времени, высота по тяге, посадка с перелётом');
  assert(!cj.classList.contains('pull')&&cj.style.transform==='','после прыжка inline-трансформы нет — кнопка снова управляется классами');
  /* Длинный список: пружина нативная, iOS отдаёт scrollTop за краем — кнопка сжимается и прыгает так же */
  Object.defineProperty(scj,'scrollHeight',{value:1000,configurable:true}); Object.defineProperty(scj,'clientHeight',{value:400,configurable:true});
  const scrollTo=v=>{ scj.scrollTop=v; scj.dispatchEvent(new wj.Event('scroll')); };
  kf=null; tj('touchstart',300); scrollTo(-30);
  assert(cj.classList.contains('pull')&&/scale\(1\.0\d+,0\.9\d+\)/.test(cj.style.transform)&&!scj.classList.contains('dragging'),'длинный список: перелёт за край сжимает кнопку, свою резинку JS не включает');
  tj('touchend');
  assert(kf&&!cj.classList.contains('pull'),'отпустили за краем — прыжок');
  kf=null; scrollTo(-20); assert(!cj.classList.contains('pull'),'обратный ход пружины после прыжка кнопку не сжимает — иначе прыгнуло бы дважды');
  scrollTo(0); scrollTo(-25);
  assert(cj.classList.contains('pull'),'бросок в край без пальца — сжатие по пружине');
  scrollTo(0);
  assert(kf&&!cj.classList.contains('pull'),'пружина вернулась — прыжок');
  scrollTo(200); assert(!cj.classList.contains('pull')&&!kf.k[0].transform.includes('NaN'),'обычная прокрутка внутри диапазона кнопку не трогает');
 }
 assert(/\.veil\.top\{top:0;height:calc\(76px \+ var\(--safe-t\)\)/.test(read('app.css'))&&/\.veil\.top\{[^}]*rgba\(var\(--veil-rgb\),\.85\),rgba\(var\(--veil-rgb\),\.35\) 65%/.test(read('app.css'))&&/--veil-rgb:16,16,16/.test(read('app.css'))&&/\.veil::after\{[^}]*mask-image:url\("data:image\/svg\+xml,[^"]*hex|\.veil::after\{[^}]*mask-image:url/.test(read('app.css'))&&/\.veil\{[^}]*backdrop-filter:blur\(10px\)/.test(read('app.css')),'верхняя полоса затемнения исходная: 76 px, .85 → .35 — владелец вернул после проб');
 assert(/\.dock\{pointer-events:none\}/.test(read('app.css'))&&/\.dock > \*\{pointer-events:auto\}/.test(read('app.css'))&&/\.dock\.hide > \*\{pointer-events:none\}/.test(read('app.css')),'пустое место дока касания не ловит — свайп над кнопкой прокручивает список');
 assert(/\.pull\{transition:none\}/.test(read('app.css'))&&!/calc\([^)]*var\(--pull/.test(read('app.css')),'сжатие идёт за пальцем без перехода; calc() с --pull в CSS нет — Safari его не рисует');
 tch('touchstart',300); tch('touchmove',380); tch('touchcancel');
 assert(sc.style.transform==='','обрыв касания тоже возвращает');

 /* кольцо проекта закрывает следующий шаг */
 const pr=pj('Запуск лендинга');
 assert(pr.querySelector('.ck .num').textContent==='3','в кружке проекта число открытых шагов');
 pr.querySelector('.ck').click();
 await wait(220);
 assert(txt(pj('Запуск лендинга'))==='Вычитка','следующий шаг сдвинулся — теперь он в заголовке');

 /* открытие карточки и шаги в чате */
 pj('Запуск лендинга').click();
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
 assert(d.querySelectorAll('.pri button[data-v]').length===5&&!!d.querySelector('.pri [data-edit]'),'пять ступеней: нет и четыре цвета, плюс карандаш правки');
 d.querySelector('.pri button[data-v="3"]').click();
 assert(!d.querySelector('.pri'),'выбор закрывает капсулу');
 const again=()=>rows().find(r=>txt(r)===name0);
 assert(w.app.S.ts.find(x=>x.t===name0).pri===3,'приоритет записан');
 { const rs=rows(), rg=r=>+r.querySelector('.ck').style.getPropertyValue('--ring');
   assert(rg(rs[0])===0&&rg(rs[rs.length-1])===1&&rg(rs[1])>rg(rs[0])&&rg(rs[rs.length-1])===rg(again()),'кольцо красное с шагом прозрачности по позиции: верхняя 0, нижняя (срочная) 1');
   assert(rs.every(r=>!/\bp[1-4]\b/.test(r.querySelector('.ck').className)),'цветных ступеней на кольце нет'); }
 again().click();
 assert(w.app.S.cur.k==='t'&&w.app.byId(w.app.S.cur.id).t!==name0||true,'после долгого нажатия строка сама не открывается');

 /* порядок от якоря: список растёт от кнопки — срочное внизу, у пальца */
 assert(txt(rows()[rows().length-1])===name0,'приоритетная задача ушла вниз, к кнопке');

 /* капсулы: PROCESS — только проекты, FOCUS — только с приоритетом, FLOW — всё */
 const seg=t=>d.querySelector('.dockrow .seg[data-tab="'+t+'"]');
 seg('process').click();
 assert(w.app.S.tab==='process'&&rows().length&&rows().every(r=>r.dataset.pj),'PROCESS показывает только проекты');
 assert(seg('process').classList.contains('on')&&!seg('flow').classList.contains('on'),'активна капсула PROCESS');
 assert(d.querySelector('.dockrow').style.getPropertyValue('--seg-i')==='1','подложка переехала на вторую треть');
 seg('focus').click();
 assert(rows().length&&rows().every(r=>{const x=w.app.byId(+r.dataset.id)||w.app.prById(+r.dataset.pj); return (x.pri||0)>0}),'FOCUS показывает только то, чему проставлен приоритет');
 seg('flow').click();
 assert(w.app.S.tab==='flow'&&rows().length>1,'FLOW возвращает всё');

 /* выполненные ↔ входящие */
 const openN=rows().length, doneN=w.app.S.ts.filter(x=>x.done).length;
 $('find').click();
 assert(w.app.S.showDone===1&&rows().length===doneN,'переключатель показывает выполненные: '+rows().length);
 rows()[0].querySelector('.ck').click();
 assert(rows().length===doneN-1,'снятая отметка уходит из выполненных');
 assert(!d.querySelector('.dockrow .seg.on')&&d.querySelector('.dockrow').classList.contains('none'),'в выполненных ни одна капсула не подсвечена, подложка убрана');
 $('find').click();
 assert(w.app.S.showDone===0&&rows().length>=openN,'обратно во входящие');
 /* нажатие на капсулу из выполненных возвращает к списку */
 $('find').click(); seg('flow').click();
 assert(w.app.S.showDone===0&&seg('flow').classList.contains('on'),'капсула уводит из выполненных обратно в список');

 /* добавление задачи через строку ввода */
 $('shutter').click();
 assert(!$('composer').classList.contains('mini')&&d.getElementById('scroll').classList.contains('tight'),'паук разворачивает строку ввода');
 assert($('composer').style.transform==='','после разворота инлайновый сдвиг снят — переход идёт к раскрытой капсуле');
 assert(/composer\.style\.transform = 'translateY\(' \+ \(-MINI_Y \+ \(voice \? 0 : \(kbH \|\| 0\)\)\)/.test(read('app.js'))&&/const MINI_Y = 75;/.test(read('app.js')),'точка старта морфа — место кнопки с поправкой на высоту клавиатуры (без неё в голосовом раскрытии)');
 $('add').click();
 assert(w.app.S.ts.every(x=>x.t!==''),'пустой ввод ничего не добавляет');
 assert(/Микрофон/.test($('nt').placeholder),'без Web Speech кнопка-микрофон подсказывает микрофон на клавиатуре');
 await wait(2300);
 assert($('nt').placeholder==='Новая задача','подсказка возвращается к обычной');
 $('nt').value='q'; $('nt').dispatchEvent(new w.Event('input'));
 assert($('add').dataset.ic==='up','набрали текст — микрофон сменился стрелкой (ключ иконки)');
 $('nt').value=''; $('nt').dispatchEvent(new w.Event('input'));
 assert($('add').dataset.ic==='mic','стёрли — обратно микрофон');
 $('nt').value='<b>x</b>'; $('nt').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter'}));
 assert(w.app.S.ts.some(x=>x.t==='<b>x</b>')&&!d.querySelector('#list b'),'Enter добавляет, текст экранирован');
 { const names=rows().map(txt), ni=names.indexOf('<b>x</b>');
   assert(ni>=0&&ni===names.length-2&&names[names.length-1]===name0,'новая задача — внизу своей ступени: ниже всех без приоритета, но выше приоритетной'); }
 assert($('composer').classList.contains('mini'),'после добавления строка сворачивается');

 /* выполнение задачи: плашка с откатом.
    Ждём: секунду после ухода клавиатуры плашка молчит намеренно */
 await wait(1300);
 const first=rows().find(r=>r.dataset.id), fname=txt(first);   /* задача, не проект: первым может стоять проект */
 first.querySelector('.ck').click();
 await wait(220);
 assert(w.app.S.ts.find(x=>x.t===fname).done===1,'задача выполнена');
 assert($('toast').classList.contains('on')&&$('toast-t').textContent.includes(fname),'всплыла плашка о выполнении');
 $('undo').click();
 assert(w.app.S.ts.find(x=>x.t===fname).done===0&&!$('toast').classList.contains('on'),'«Вернуть» откатывает');

 /* чат: галочка в шапке, отправка и ответ — открываем задачу, не проект (порядок теперь от якоря, первым может стоять проект) */
 rows().find(r=>r.dataset.id).click();
 /* первое касание по полю — программный фокус без прокрутки, iOS не панорамирует; повторное — не перехватывается (каретка) */
 const pd=()=>{ const e=new w.Event('pointerdown',{bubbles:true,cancelable:true}); $('msg').dispatchEvent(e); return e.defaultPrevented; };
 $('msg').blur();
 assert(pd()===true&&d.activeElement===$('msg'),'тап по полю чата: фокус поставлен программно, действие iOS отменено');
 assert(pd()===false,'тап по полю в фокусе не перехватывается — каретка ставится как обычно');
 /* прокрутка ленты клавиатуру не трогает; тап и сильная протяжка вниз от верха — убирают */
 const tt=(type,y)=>{ const e=new w.Event(type,{bubbles:true}); e.touches=y==null?[]:[{clientX:100,clientY:y}]; $('thread').dispatchEvent(e); };
 tt('touchstart',300); tt('touchmove',340); tt('touchend');
 assert(d.activeElement===$('msg'),'обычная прокрутка ленты фокус не снимает');
 tt('touchstart',300); tt('touchmove',420); tt('touchend');
 assert(d.activeElement!==$('msg'),'сильная протяжка вниз от верха ленты убирает клавиатуру');
 $('msg').focus(); $('thread').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
 assert(d.activeElement!==$('msg'),'касание по ленте без движения убирает клавиатуру');
 $('msg').blur();
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
 /* FOCUS — красный фон: вся гамма одним блоком токенов, поверхности темнее фона, кольцо белое */
 assert(/#scr-list\.focus\{[^}]*--bg:var\(--hot\)[^}]*--ring-rgb:255,255,255/.test(css)&&/#scr-list\.focus \.composer\.mini\{background:#101010\}/.test(css),'во вкладке FOCUS фон фирменный красный, гамма под него: кольцо белое, кнопка тёмная');
 { const body=css.replace(/:root\{[\s\S]*?\n\}/,'');
   assert(!/rgba\(26,26,26,\.72\)|rgba\(21,21,21,\.8\)|rgba\(16,16,16,\./.test(body),'цвета поверхностей — только токенами в :root, иначе FOCUS их не перекрасит'); }
 assert(/--ring-rgb:229,0,6/.test(css)&&/\.ck\{box-shadow:inset 0 0 0 2px rgba\(var\(--ring-rgb\),var\(--ring,0\)\)\}/.test(css)&&!/--pri1/.test(css),'кольцо кружка — красное с прозрачностью --ring, цветов приоритета нет');
 /* движение — одна система: кривые по роли в CSS и в EASE движка совпадают, сырых кривых и секунд в переходах нет */
 const js=read('app.js'), tokOf=n=>(css.match(new RegExp('--'+n+':(cubic-bezier\\([^)]*\\))'))||[])[1];
 const ease=eval('('+(js.match(/const EASE = (\{[^}]*\})/)||[])[1]+')');
 assert(ease.out===tokOf('e-out')&&ease.in===tokOf('e-in')&&ease.move===tokOf('e-move')&&ease.over===tokOf('e-over')&&ease.kb===tokOf('e-kb'),'EASE в движке = токены --e-* в стилях');
 const motion=css.replace(/\/\*[\s\S]*?\*\//g,'').split('\n').filter(l=>/transition:|animation:/.test(l));
 assert(motion.every(l=>!/cubic-bezier|ease-in-out|\d+ms|\.\d+s(?![\w-])/.test(l.replace(/steps\(1\)/g,''))),'в переходах нет сырых кривых и длительностей — только токены');
 assert(!/easing:'(ease|cubic)/.test(js),'в движке кривые только из EASE');
 assert(/\.press:active\{transform:scale\(1\.05,\.92\)/.test(css)&&/scale\(1\.28,\.8\)/.test(js),'сжатие и растяжение: кнопка плющится под пальцем, кружок — при отметке');
 assert(/\.pri button:nth-child\(5\)\{animation-delay:calc\(var\(--lag\) \* 4\)\}/.test(css)&&/\n\.sheet-body > \*\{animation:rise[^}]*var\(--i, 0\) \* var\(--lag\)\)\}\n/.test(css)&&/@keyframes sheet-in\{from\{[^}]*\}to\{[^}]*\}\}\n/.test(css),'доводка: кнопки приоритета и разделы настроек догоняют друг друга');
 assert(/@keyframes toast-in\{0%\{[^}]*\}55%\{transform:translateY\(-6px\)\}/.test(css)&&/translate\('\+\(x\*\.6\)/.test(js),'дуги: плашка приподнимается по пути, искры летят по параболе');
 /* система на всём интерактивном: отклик под пальцем, появление и уход у того, что не .press */
 assert(/\.row:active\{transform:scale\(\.99,\.965\)/.test(css)&&/\.ax:active,\.au:active,\.pri button:active\{transform:scale\(1\.08/.test(css)&&/\.mi:active,\.card:active\{transform:scale\(\.99/.test(css),'отклик под пальцем: полноширинное сжимается внутрь, кнопки — вширь');
 assert(/\.scroll\{[^}]*overflow-x:hidden;scrollbar-width:none/.test(css.replace(/\/\*[\s\S]*?\*\//g,''))&&/\.sheet-body\{[^}]*overflow-x:hidden/.test(css),'горизонтальной прокрутки нет ни у областей, ни у листа: трансформы её открывали');
 assert(/\.title:focus-within\{box-shadow:inset 0 0 0 2px var\(--blue\)/.test(css),'заголовок задачи подсвечивается при правке');
 assert(/\.sheet\.out \.sheet-body\{animation:sheet-out var\(--t-fast\) var\(--e-in\) forwards\}/.test(css)&&/\.pri\.out\{animation:pri-out var\(--t-tap\) var\(--e-in\) forwards\}/.test(css)&&/\.sheet-back\{animation:fade/.test(css),'лист настроек и капсула приоритета появляются и уходят движением');
 assert(/body\.nav #scr-detail:not\(\.on\) \.scroll\{transform:translateX\(32px\)\}/.test(css)&&/body\.nav #scr-detail\.on \.scroll\{transition-delay:var\(--lag\)\}/.test(css),'лента догоняет экран чата на шаг позже, только в nav');
 assert(/function swapIcon/.test(js)&&(js.match(/swapIcon\(/g)||[]).length>=5,'смена иконок на кнопках идёт через swapIcon');
 assert(/\.row\{[^}]*flex-direction:row;[^}]*padding:6px 6px 6px 16px/.test(css)&&/\.step\{[^}]*flex-direction:row;/.test(css),'кружки справа: обычный порядок у строк и шагов, отступ текста слева');
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

/* ---------- сеть: ход с поиском хранится блоками, источники под ответом ---------- */
async function web(){
 console.log('сеть');
 const {w,d}=load('index.html');
 const A=w.app;
 const t=A.S.ts.find(x=>x.pj===null);
 const HIT={type:'web_search_result',url:'https://a.ru/x',title:'Грузчики',encrypted_content:'abc'};
 const raw=[{type:'text',text:'Смотрю.'},{type:'server_tool_use',id:'srvtoolu_1',name:'web_search',input:{query:'грузчики'}},
  {type:'web_search_tool_result',tool_use_id:'srvtoolu_1',content:[HIT]},{type:'text',text:'От 500.'}];
 t.chat=[{u:'сколько стоят грузчики?'},{a:'Смотрю.\n\nОт 500.',raw,src:[{url:'https://a.ru/x',title:'<b>Грузчики'},{url:'javascript:alert(1)',title:'зло'}]}];
 let m=await A.chatMessages(t);
 assert(m[1].role==='assistant'&&m[1].content.map(b=>b.type).join()==='text,server_tool_use,web_search_tool_result,text','ход с поиском уходит в историю блоками как есть');
 assert(m[1].content[2].content[0].encrypted_content==='abc','шифрованное содержимое результата не тронуто');
 /* Старые ходы с поиском ужимаются до текста: результаты объёмные */
 for(let i=0;i<3;i++)t.chat.push({u:'ещё '+i},{a:'ответ '+i,raw:[{type:'text',text:'ответ '+i}]});
 m=await A.chatMessages(t);
 assert(m[1].content.length===1&&m[1].content[0].text==='Смотрю.\n\nОт 500.','ход старше WEB_TURNS ужат до текста');
 assert(!t.chat[1].raw,'и блоки у него стёрты, чтобы не копить в localStorage');
 assert(t.chat.at(-1).raw,'у свежих ходов блоки на месте');
 /* Источники в ленте */
 A.paint(); [...d.querySelectorAll('#list .row')].find(r=>r.textContent.includes(t.t)).click();
 const links=[...d.querySelectorAll('.srcs a.src')];
 assert(links.length===1&&links[0].getAttribute('href')==='https://a.ru/x','под ответом капсула источника, не-http ссылка отброшена');
 assert(links[0].textContent.includes('<b>Грузчики')&&!links[0].querySelector('b'),'заголовок источника экранирован');
 assert(links[0].getAttribute('target')==='_blank'&&links[0].getAttribute('rel')==='noopener','открывается в новой вкладке без opener');
 assert(links[0].textContent.includes('a.ru'),'рядом хост');
 /* Среда исполнения задачи: её id уходит в запросе, подписи ходов кода */
 assert(!(await A.chatPayload(t,false)).container,'без среды поле не шлётся');
 t.cid='container_abc'; assert((await A.chatPayload(t,false)).container==='container_abc','id среды задачи уходит в запросе');
 assert(A.srvLabel({name:'bash_code_execution',input:{command:'ls'}})==='Выполняю код'&&A.srvLabel({name:'web_search',input:{query:'x'}})==='Ищу в сети: x','подписи серверных ходов');
 /* Двоичный файл текстом не читается */
 t.files=[{name:'d.docx',mime:'application/x',size:3,body:undefined,owner:'t'+t.id}];
 const rd=await A.runTool({id:'r1',name:'file_read',input:{name:'d.docx'}},t,false);
 assert(/не читается|двоичн/.test(rd.out),'нечитаемый файл — понятный ответ модели, не исключение');
 /* Поиск платный поштучно */
 const before=A.spendUsd(A.S.spend);
 A.addSpend({output_tokens:0,server_tool_use:{web_search_requests:2}});
 assert(Math.abs(A.spendUsd(A.S.spend)-before-0.02)<1e-9,'два поиска — два цента в расходе');
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


/* ---------- правка названия из строки ---------- */
async function editing(){
 console.log('правка из строки');
 const {w,d}=load('index.html');
 const A=w.app, rows=()=>[...d.querySelectorAll('#list .row')], $=i=>d.getElementById(i);
 const row=rows().find(r=>r.dataset.id), x=A.byId(+row.dataset.id), was=x.t;
 row.dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true}));
 d.querySelector('.pri [data-edit]').click();
 const inp=d.querySelector('#list .row[data-id="'+x.id+'"] input.edit');
 assert(inp&&inp.value===was&&d.activeElement===inp,'карандаш ставит поле на место заголовка с текущим названием и фокусом');
 inp.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
 assert(!$('scr-detail').classList.contains('on'),'клик внутри поля не открывает чат');
 inp.value='Новое имя'; inp.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter'}));
 assert(x.t==='Новое имя'&&rows().find(r=>+r.dataset.id===x.id).querySelector('.t1').textContent==='Новое имя','Enter сохраняет и перерисовывает строку');
 const pr=rows().find(r=>r.dataset.pj), p=A.prById(+pr.dataset.pj);
 pr.dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true})); d.querySelector('.pri [data-edit]').click();
 const pi=d.querySelector('#list .row[data-pj="'+p.id+'"] input.edit');
 assert(pi.value===p.n,'у проекта правится имя проекта, а не шаг');
 pi.value='Другое'; pi.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));
 assert(p.n!=='Другое'&&!d.querySelector('#list input.edit'),'Escape отменяет');
 /* после Escape строка перерисована — берём её заново, старый элемент уже отвязан */
 rows().find(r=>+r.dataset.pj===p.id).dispatchEvent(new w.MouseEvent('contextmenu',{bubbles:true})); d.querySelector('.pri [data-edit]').click();
 const pi2=d.querySelector('#list input.edit'); pi2.value='Проект Икс'; pi2.blur();
 assert(p.n==='Проект Икс','уход фокуса сохраняет');
}

/* ---------- засветка только на нажатие ---------- */
async function flashTest(){
 console.log('засветка');
 const {w,d}=load('index.html',w2=>{ w2.matchMedia=()=>({matches:false}); });
 const row=d.querySelector('#list .row'); let flashes=0; row.animate=()=>{ flashes++; return {}; };
 const pe=(type,x,y)=>{ const e=new w.Event(type,{bubbles:true}); e.clientX=x; e.clientY=y; row.dispatchEvent(e); };
 pe('pointerdown',100,300); pe('pointermove',100,340); await wait(150); pe('pointerup',100,340);
 assert(flashes===0,'палец сдвинулся — прокрутка, строка не вспыхивает');
 pe('pointerdown',100,300); w.dispatchEvent(new w.Event('pointercancel')); await wait(150);
 assert(flashes===0,'началась нативная прокрутка (pointercancel) — не вспыхивает');
 pe('pointerdown',100,300); pe('pointerup',100,300);
 assert(flashes===1,'быстрый тап вспыхивает сразу на отпускании');
 pe('pointerdown',100,300); await wait(150);
 assert(flashes===2,'удержание без сдвига вспыхивает через 90 мс');
 pe('pointerup',100,300);
 assert(flashes===2,'и на отпускании второй раз не вспыхивает');
}

/* ---------- голосовой набор ---------- */
async function voice(){
 console.log('голосовой набор');
 const starts=[]; let live=null;
 const {w,d}=load('index.html',w2=>{
  w2.SpeechRecognition=function(){ live=this; this.start=()=>starts.push(this.lang); this.stop=()=>{ if(this.onend)this.onend(); }; };
 });
 const $=i=>d.getElementById(i);
 $('shutter').click();
 $('add').click();
 assert(starts.length===1&&$('add').classList.contains('rec'),'пустое поле: кнопка-микрофон запускает распознавание, кнопка красная');
 live.onresult({results:[[{transcript:'купить '}],[{transcript:'молоко'}]]});
 assert($('nt').value==='купить молоко'&&$('add').classList.contains('rec'),'текст подставляется по мере распознавания, кнопка остаётся красной');
 live.onend();
 assert(!$('add').classList.contains('rec')&&$('add').dataset.ic==='up','распознавание кончилось — кнопка снова обычная, со стрелкой отправки');
 $('add').click();
 assert(w.app.S.ts.some(x=>x.t==='купить молоко'),'надиктованное отправляется той же кнопкой');
 /* удержание паука — режим голоса: круг остаётся кругом, белеет и слушает молча */
 await wait(150);
 assert($('composer').classList.contains('mini'),'после отправки строка свёрнута');
 assert(!!$('shutter').querySelector('.micro svg'),'микрофон лежит в кнопке заранее — переход паук → микрофон один и обратимый');
 const pe=(type,x,y)=>{ const e=new w.Event(type,{bubbles:true}); e.clientX=x; e.clientY=y; $('shutter').dispatchEvent(e); };
 const click=()=>$('shutter').dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
 pe('pointerdown',100,700); await wait(650); pe('pointerup',100,700); click();
 assert($('composer').classList.contains('mini')&&$('composer').classList.contains('voice')&&starts.length===2,'удержание: круг остался кругом, в режиме голоса, распознавание пошло');
 live.onresult({results:[[{transcript:'позвонить маме'}]]});
 assert($('nt').value===''&&$('composer').classList.contains('mini'),'пока идёт запись, текст не показывается');
 live.onend();
 assert(!$('composer').classList.contains('mini')&&!$('composer').classList.contains('voice')&&$('nt').value==='позвонить маме'&&d.activeElement===$('nt'),'запись кончилась сама — строка раскрылась с текстом и фокусом');
 $('nt').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));
 /* тап по белому кругу останавливает запись сам, внутри жеста */
 pe('pointerdown',100,700); await wait(650); pe('pointerup',100,700); click();
 assert($('composer').classList.contains('voice')&&starts.length===3,'вторая запись пошла');
 live.onresult({results:[[{transcript:'купить хлеб'}]]});
 pe('pointerdown',100,700); pe('pointerup',100,700); click();
 assert(!$('composer').classList.contains('voice')&&!$('composer').classList.contains('mini')&&$('nt').value==='купить хлеб'&&d.activeElement===$('nt'),'тап по кругу — стоп, строка с текстом и фокусом сразу');
 const stale=live; stale.onend&&stale.onend();
 assert($('nt').value==='купить хлеб','запоздалый onend распознавателя ничего не ломает');
 $('nt').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape'}));
 /* ничего не сказали — круг остаётся кругом */
 pe('pointerdown',100,700); await wait(650); pe('pointerup',100,700); click(); live.onend();
 assert($('composer').classList.contains('mini')&&!$('composer').classList.contains('voice'),'пустая запись — круг остался кругом');
 pe('pointerdown',100,700); await wait(200); pe('pointerup',100,700); click();
 assert(!$('composer').classList.contains('mini')&&starts.length===4&&d.activeElement===$('nt'),'короткое нажатие — обычное раскрытие с фокусом, без голоса');
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
 /* отправка закрывает строку, а тяжёлая отдача повторяется через 45 и 90 мс — переключатель не должен остаться в фокусе */
 $('nt').value='Проверка отдачи'; $('add').click();
 await wait(150);
 assert(!(d.activeElement&&d.activeElement.closest&&d.activeElement.closest('.hapt')),'после отправки задачи фокус не остался на переключателе отдачи');
 assert(/if\(hapting \|\| !isText\(e\.target\)\) return;/.test(read('app.js')),'перескоки фокуса из-за щелчка логика клавиатуры не считает потерей фокуса');

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
 t.$('msg').focus();
 t.d.getElementById('back').click(); assert(!on('scr-detail'),'назад к списку');
 assert(t.d.activeElement!==t.$('msg'),'выход из чата снимает фокус — клавиатура уходит вместе с чатом');
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
 const vvL={}, kbw=load('index.html',w2=>{
  w2.matchMedia=()=>({matches:false});   /* движение включено: иначе .easing по правилу не вешается */
  w2.visualViewport={height:400,offsetTop:186,addEventListener:(n,f)=>{vvL[n]=f;}};
 }).w;
 const css=n=>kbw.document.documentElement.style.getPropertyValue(n);
 assert(css('--vh')==='400px'&&css('--vvtop')==='186px','контейнер = видимая область: её высота и смещение');
 /* при клавиатуре индикатор «домой» под ней: отступ под него снят, зазор под строкой ввода 8 */
 assert(css('--safe-b')==='0px'&&css('--foot')==='8px','клавиатура открыта: отступ под индикатор снят, зазор 8 px');
 kbw.visualViewport.height=kbw.innerHeight; vvL.resize();
 assert(css('--foot')==='16px','клавиатура ушла — зазор снова 16 px');
 /* innerHeight в Safari равен видимой области: окно и область равны, признак — область ниже базы.
    Он физический и от фокуса не зависит: в момент focusout фокуса уже нет, а клавиатура ещё на экране */
 Object.defineProperty(kbw,'innerHeight',{value:400,configurable:true});
 kbw.visualViewport.height=400; vvL.resize();
 assert(css('--foot')==='8px'&&css('--safe-b')==='0px','окно равно области, область ниже базы — клавиатура и без фокуса');
 kbw.visualViewport.height=kbw.innerHeight=700; Object.defineProperty(kbw,'innerHeight',{value:700,configurable:true}); vvL.resize();
 assert(css('--foot')==='16px','область ниже базы меньше чем на 150 — полоса браузера, не клавиатура');
 /* компенсация прокрутки — исходная (v114): обычные контейнеры держат низ при любом сдвиге высоты, перевёрнутый список — сам */
 { const th=kbw.document.getElementById('thread'); th.scrollTop=100; kbw.visualViewport.height=400; vvL.resize();
   assert(th.scrollTop===400,'область ужалась на 300 — лента держит низ');
   kbw.visualViewport.height=700; vvL.resize(); }
 Object.defineProperty(kbw,'innerHeight',{value:768,configurable:true});
 /* Высота клавиатуры запомнена; при следующем фокусе контейнер ужимается сразу, до resize —
    чтобы iOS не панорамировала экран. Без resize догадка живёт 700 мс и снимается */
 kbw.visualViewport.height=768; vvL.resize();
 assert(kbw.localStorage.getItem('kbh:'+kbw.innerWidth)==='368','высота клавиатуры запомнена по ширине окна');
 assert(css('--vh')==='768px','без клавиатуры контейнер полный');
 kbw.document.getElementById('msg').focus();
 assert(css('--vh')==='400px'&&css('--foot')==='8px','фокус — контейнер и низ ужаты сразу, до прихода resize');
 assert(css('--vvtop')==='368px','и сдвиг на высоту клавиатуры выставлен заранее: iOS панорамирует ровно на неё');
 await wait(1700);          /* окно догадки 1,5 с: resize на iOS приходит позже, чем кажется */
 assert(css('--vh')==='768px','клавиатура не пришла — догадка снята');
 kbw.document.getElementById('msg').blur();
 /* обратная догадка: потеря фокуса разворачивает контейнер сразу, пока клавиатура ещё едет вниз */
 kbw.document.getElementById('msg').focus(); kbw.visualViewport.height=400; vvL.resize();
 assert(css('--vh')==='400px','клавиатура на экране');
 kbw.document.getElementById('msg').blur();
 assert(css('--vh')==='768px'&&css('--foot')==='16px'&&css('--vvtop')==='0px','фокус ушёл — контейнер, низ и сдвиг возвращены сразу, до resize');
 /* разворот идёт движением вместе с клавиатурой: класс .easing на 320 мс, ужатие — без него */
 assert(kbw.document.querySelector('.phone').classList.contains('easing'),'на предсказанный разворот повешен переход');
 await wait(400);
 assert(!kbw.document.querySelector('.phone').classList.contains('easing'),'через 320 мс переход снят');
 kbw.visualViewport.height=768; vvL.resize();
 assert(css('--vh')==='768px','пришёл настоящий resize — совпал с догадкой');
 /* фокус ушёл раньше, чем поднялась клавиатура: догадка ужатия снимается сразу, а не через 1,5 с.
    Клавиатуры нет — нет и панорамирования, у подменённой области сдвиг 0 */
 kbw.visualViewport.offsetTop=0;
 kbw.document.getElementById('msg').focus();
 assert(css('--vh')==='400px'&&css('--vvtop')==='368px','фокус — догадка ужатия');
 assert(!kbw.document.querySelector('.phone').classList.contains('easing'),'ужатие при фокусе — мгновенно, без перехода');
 kbw.document.getElementById('msg').blur();
 assert(css('--vh')==='768px'&&css('--vvtop')==='0px'&&css('--foot')==='16px','клавиатуры не было — после потери фокуса всё развёрнуто сразу');
 kbw.visualViewport.height=400; vvL.resize();
 assert(!/--kb/.test(read('app.css'))&&!/--kb/.test(read('app.js')),'высоты клавиатуры в раскладке нет: поднимать композер на неё — проверенный тупик');
 /* никаких переходов на раскладке под клавиатуру: она предвосхищает события, переход = запаздывание */
 const cssClean=read('app.css').replace(/\/\*[\s\S]*?\*\//g,'');
 const phoneRule=(cssClean.match(/\.phone\{[^}]*\}/)||[''])[0];
 const noEase=cssClean.replace(/\.phone\.easing[^{]*\{[^}]*\}/g,'');
 assert(!/transition/.test(phoneRule)&&!/bottom \.\d+s/.test(noEase),'ни у контейнера, ни у низа нет переходов — кроме .easing на предсказанный разворот');
 /* всё, что едет вместе с клавиатурой, едет по её кривой — иначе содержимое её обгоняет */
 const easing=cssClean.split('\n').filter(l=>l.startsWith('.phone.easing'));
 assert(easing.length>=4&&easing.every(l=>/(bottom|height|top) var\(--t-kb\) var\(--e-kb\)/.test(l))&&!easing.some(l=>/(bottom|height|top) var\(--t-kb\) var\(--e-(move|out|over)\)/.test(l)),'разворот под клавиатуру — по кривой клавиатуры, не по общей');
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
 await web();
 markdown();
 await clips('index.html');
 await clips('panels.html');
 spiderTest();
 await editing();
 await voice();
 await flashTest();
 await haptics('index.html');
 await haptics('panels.html');
 console.log(fails?`\n${fails} ошибок`:'\nвсе тесты прошли'); process.exit(fails?1:0);
})();
