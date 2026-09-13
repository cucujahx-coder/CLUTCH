/* CLUTCH — движок. Общий для index.html (экран списка + экран чата) и panels.html (две панели рядом).
   Оболочка задаёт MODE ('nav' | 'two') до подключения этого файла.
   Раскладка «как в камере»: сверху таблетка логотипа и кнопка сортировки, снизу большая кнопка
   с пауком, под ней переключатель «выполненные», строка ввода вырастает из кнопки. */
const MODE = window.MODE || 'two';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = id => document.getElementById(id);
const root = document.documentElement.style;
const esc = t => String(t).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/* Шестиугольник — один на всю страницу, паучки ссылаются на него через <use> */
document.body.insertAdjacentHTML('beforeend',
 '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'+
 '<path id="hexcell" d="M0 -13L11.26 -6.5L11.26 6.5L0 13L-11.26 6.5L-11.26 -6.5Z"/></defs></svg>');
const HEX = (x,y) => '<use href="#hexcell" x="'+x+'" y="'+y+'"/>';
const HEXES = a => a.map(([x,y])=>HEX(x,y)).join('');
const SPIDER_JUMP =
 '<span class="sw"><svg viewBox="74 36 227 183" aria-hidden="true">'+
 '<g fill="currentColor">'+ HEXES([
   [165.12,69],[187.64,69],[210.16,69],
   [153.86,88.5],[243.94,88.5],
   [142.6,108],[232.68,108],
   [153.86,127.5],[243.94,127.5],
   [165.12,147],[187.64,147],[210.16,147],
   [142.6,69],[131.34,49.5],[108.82,49.5],[97.56,69],
   [120.08,108],[108.82,127.5],[97.56,147],
   [142.6,147],[131.34,166.5],[120.08,186],
   [232.68,69],[243.94,49.5],[266.46,49.5],[277.72,69],
   [255.2,108],[266.46,127.5],[277.72,147],
   [232.68,147],[243.94,166.5],[255.2,186]]) +'</g>'+
 '<g class="tips" fill="currentColor">'+ HEXES([[86.3,88.5],[86.3,166.5],[108.82,205.5],[288.98,88.5],[288.98,166.5],[266.46,205.5]]) +'</g>'+
 '<g class="eye">'+ HEXES([[176.38,88.5],[221.42,88.5]]) +'</g>'+
 '<g class="eye-b">'+ HEXES([[165.12,69],[176.38,88.5],[165.12,108],[210.16,69],[221.42,88.5],[210.16,108]]) +'</g>'+
 '</svg></span>';

const SPIDER =
 '<span class="spider idle" aria-hidden="true"><svg viewBox="62 34 251 187">'+
 '<g class="rig"><g fill="currentColor">'+ HEXES([
   /* тело без заливки: только обод из шестиугольников, внутри пусто */
   [165.12,69],[187.64,69],[210.16,69],
   [153.86,88.5],[243.94,88.5],
   [142.6,108],[232.68,108],
   [153.86,127.5],[243.94,127.5],
   [165.12,147],[187.64,147],[210.16,147],
   /* лапы */
   [142.6,69],[131.34,49.5],[108.82,49.5],[97.56,69],
   [120.08,108],[108.82,127.5],[97.56,147],
   [142.6,147],[131.34,166.5],[120.08,186],
   [232.68,69],[243.94,49.5],[266.46,49.5],[277.72,69],
   [255.2,108],[266.46,127.5],[277.72,147],
   [232.68,147],[243.94,166.5],[255.2,186]]) +'</g>'+
 '<g class="fa" fill="currentColor">'+ HEXES([[75.04,69],[86.3,166.5],[97.56,186],[288.98,88.5],[300.24,147],[266.46,205.5]]) +'</g>'+
 '<g class="fb" fill="currentColor">'+ HEXES([[86.3,88.5],[75.04,147],[108.82,205.5],[300.24,69],[288.98,166.5],[277.72,186]]) +'</g>'+
 '<g fill="#FFE3C2">'+ HEXES([[176.38,88.5],[221.42,88.5]]) +'</g>'+
 '</g></svg></span>';
const P = {
  clip:'M21 12.5 12.5 21a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10.5 19',
  up:'M12 19V5M5 12l7-7 7 7',
  mic:'M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3M5 10v1a7 7 0 0 0 14 0v-1M12 19v3',
  back:'M15 5l-7 7 7 7',
  plus:'M12 5v14M5 12h14',
  check:'M4 12l5 5L20 6',
  list:'M4 6h16M4 12h16M4 18h16',
  sort:'M4 7h13M4 12h9M4 17h5M17 13v7M17 20l3-3M17 20l-3-3',
  x:'M6 6l12 12M18 6L6 18',
  trash:'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  file:'M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z'
};
const Ic = (d,s=16) => '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="'+d+'"/></svg>';


/* ---------- тактильность ----------
   Вес действия: 6 перелистнуть, 8 открыть, 14 отправить или вызвать меню, 25 выполнить.
   Android умеет vibrate; на iPhone щёлкает скрытый переключатель (Safari 17.4+),
   для тяжёлых значений он повторяется через 45 и 90 мс. */
let hapt = null;
const iOSHaptic = typeof HTMLInputElement !== 'undefined' && 'switch' in HTMLInputElement.prototype;
function tap(ms){
 if(RM) return;
 if(iOSHaptic){
  if(!hapt){ hapt = document.createElement('label'); hapt.className='hapt';
   hapt.innerHTML='<input type="checkbox" switch tabindex="-1" aria-hidden="true">'; document.body.appendChild(hapt); }
  /* Клик по label в WebKit не только переключает контрол, но и переводит на него фокус.
     Для iOS это значит, что поле ввода перестало быть активным, и клавиатуру она не
     показывает. Поэтому запоминаем, кто был в фокусе, и возвращаем его после щелчка. */
  const hit=()=>{
   const a=document.activeElement;
   try{hapt.click()}catch(e){}
   if(a&&a!==document.body&&a!==document.activeElement&&a.focus){
    try{a.focus({preventScroll:true})}catch(e){try{a.focus()}catch(e2){}}
   }
  };
  hit(); if(ms>=14) setTimeout(hit,45); if(ms>=20) setTimeout(hit,90);
  return;
 }
 try{ navigator.vibrate && navigator.vibrate(ms); }catch(e){}
}

let AC=null;
function pop(){
  const C = window.AudioContext||window.webkitAudioContext; if(!C) return;
  try{
    AC = AC || new C(); if(AC.state==='suspended') AC.resume();
    const t=AC.currentTime, sr=AC.sampleRate, n=Math.floor(sr*.18), b=AC.createBuffer(1,n,sr), d=b.getChannelData(0);
    for(let i=0;i<n;i++){ const k=1-i/n; d[i]=(Math.random()*2-1)*k*k*k; }
    const src=AC.createBufferSource(); src.buffer=b;
    const hp=AC.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=900;
    const g=AC.createGain(); g.gain.value=.6;
    src.connect(hp); hp.connect(g); g.connect(AC.destination); src.start(t);
    const o=AC.createOscillator(), og=AC.createGain();
    o.frequency.setValueAtTime(180,t); o.frequency.exponentialRampToValueAtTime(40,t+.15);
    og.gain.setValueAtTime(.7,t); og.gain.exponentialRampToValueAtTime(.001,t+.15);
    o.connect(og); og.connect(AC.destination); o.start(t); o.stop(t+.16);
  }catch(e){}
}
/* Safari даёт звук только после жеста — разблокируем на первом касании */
addEventListener('touchend', function unlock(){
  const C = window.AudioContext||window.webkitAudioContext; if(!C) return;
  try{ AC = AC || new C(); AC.resume(); }catch(e){}
  removeEventListener('touchend', unlock);
}, {once:true, passive:true});


/* Засветка нажатия — только внутренняя заливка: анимация filter заставляет Safari
   пересчитывать все backdrop-filter на экране, и вместе с кнопкой вспыхивает таблетка лого. */
function elflash(el, ms){
 if(!el || RM || !el.animate) return;
 el.animate([{boxShadow:'inset 0 0 0 999px rgba(255,255,255,.85)'},
             {boxShadow:'inset 0 0 0 999px rgba(255,255,255,0)'}],{duration:ms||220,easing:'ease-out'});
}
/* Когда клавиатура была видна в последний раз: первое касание по экрану её убирает, и к моменту
   показа плашки поле уже без фокуса — помним момент, а не только состояние. */
let kbLast = 0, kbAtTap = 0;
addEventListener('focusout', e => { if(e.target.matches && e.target.matches('.inp')) kbLast = Date.now(); });
addEventListener('pointerdown', e => {
 kbAtTap = kbOpen() ? Date.now() : kbLast;
 elflash(e.target.closest && e.target.closest('.press,.row,.step'));
}, true);
/* Строка ввода вспыхивает в момент активации: белая полоса идёт слева направо */
function sweep(el){
 if(!el || RM || !el.animate) return;
 const w = document.createElement('div'); w.className='sweep'; w.innerHTML='<i></i>';
 el.appendChild(w);
 const a = w.firstChild.animate([{transform:'translateX(-130%)'},{transform:'translateX(130%)'}],
   {duration:460,easing:'cubic-bezier(.4,0,.2,1)'});
 a.onfinish = () => w.remove();
}
addEventListener('focusin', e => { if(e.target.matches && e.target.matches('.inp')) sweep(e.target.closest('.composer')); });

/* ---------- вспышка выполнения ----------
   Одна и та же у задачи в списке и у шага в чате. keepRow — строка остаётся на месте
   (шаг проекта закрывают кольцом), тогда вместо призрака вспыхивает сама плашка. */
function burst(row, keepRow){
 if(RM || !row || !row.animate) return;
 const ck = row.querySelector('.ck'); if(!ck) return;
 const host = row.closest('.screen'); if(!host) return;
 const hb = host.getBoundingClientRect(), rb = row.getBoundingClientRect(),
       cb = ck.getBoundingClientRect(), cx = cb.left-hb.left+22, cy = cb.top-hb.top+22;
 if(!keepRow){
  const ghost = row.cloneNode(true);
  ghost.className = 'ghost ' + row.className;
  ghost.style.cssText += 'left:'+(rb.left-hb.left)+'px;top:'+(rb.top-hb.top)+'px;width:'+rb.width+'px;height:'+rb.height+'px';
  host.appendChild(ghost);
  ghost.animate([{filter:'brightness(1) blur(0)',opacity:1},{filter:'brightness(3) blur(7px)',opacity:0,transform:'scale(1.04)'}],
    {duration:130,easing:'ease-out',fill:'forwards'});
  setTimeout(()=>ghost.remove(),150);
 } else {
  row.animate([{boxShadow:'inset 0 0 0 999px rgba(255,255,255,.92)'},
               {boxShadow:'inset 0 0 0 999px rgba(255,255,255,.92)',offset:.18},
               {boxShadow:'inset 0 0 0 999px rgba(255,255,255,0)'}],{duration:180,easing:'ease-out'});
 }
 const fl = document.createElement('div'); fl.className='rflash';
 fl.style.cssText += 'left:'+(cx-90)+'px;top:'+(cy-90)+'px';
 host.appendChild(fl);
 fl.animate([{opacity:.95,transform:'scale(.4)'},{opacity:0,transform:'scale(1)'}],{duration:200,easing:'ease-out'});
 setTimeout(()=>fl.remove(),210);

 const rf = document.createElement('div'); rf.className='ringfx';
 rf.style.cssText += 'left:'+(cx-22)+'px;top:'+(cy-22)+'px;width:44px;height:44px';
 host.appendChild(rf);
 rf.animate([{opacity:.5,transform:'scale(.6)'},{opacity:0,transform:'scale(2.6)'}],{duration:390,easing:'ease-out'});
 setTimeout(()=>rf.remove(),400);

 const cols=['#FF4500','#FF7A3D','#E0E0E0','#FFA073'];
 for(let i=0;i<10;i++){
  const a=(i/10)*Math.PI*2+Math.random(), d=34+Math.random()*40, s=document.createElement('span');
  s.className='spark'; s.style.cssText += 'left:'+cx+'px;top:'+cy+'px;background:'+cols[i%4];
  host.appendChild(s);
  s.animate([{transform:'translate(0,0) scale(1)',opacity:1},
             {transform:'translate('+(Math.cos(a)*d).toFixed(1)+'px,'+(Math.sin(a)*d).toFixed(1)+'px) scale(0)',opacity:0}],
    {duration:180+Math.random()*40,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'});
  setTimeout(()=>s.remove(),230);
 }
}
/* Появление новой строки: всплывает снизу и пружинит */
function fly(row){
 if(!row || RM || !row.animate) return;
 row.animate([{opacity:0,transform:'translateY(16px) scale(.98)'},{opacity:1,transform:'none'}],
   {duration:420,easing:'cubic-bezier(.34,1.56,.64,1)'});
}
/* ---------- даты ---------- */
const MON=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
const iso=d=>{const x=new Date(d);x.setMinutes(x.getMinutes()-x.getTimezoneOffset());return x.toISOString().slice(0,10)};
const today=()=>iso(new Date());
const plus=n=>{const d=new Date();d.setDate(d.getDate()+n);return iso(d)};
const days=s=>Math.round((new Date(s+'T00:00')-new Date(today()+'T00:00'))/864e5);
function fmtDue(s){
 if(!s)return '';
 const n=days(s);
 if(n===0)return 'Сегодня';
 if(n===1)return 'Завтра';
 if(n===-1)return 'Вчера';
 if(n>1&&n<7)return new Date(s+'T00:00').toLocaleDateString('ru-RU',{weekday:'long'}).replace(/^./,c=>c.toUpperCase());
 const d=new Date(s+'T00:00');
 return d.getDate()+' '+MON[d.getMonth()];
}
const overdue=s=>!!s&&days(s)<0;

/* ---------- хранилище ---------- */
const KEY='tasks:v1';
const OLD_KEYS=['clutch:v5','clutch-plan:v1','everyday:v4']; /* приложения-предшественники */
let S={seq:1,ts:[],pr:[],showDone:0,cur:null,mem:[],spend:null};
let saveT;
function save(){clearTimeout(saveT);saveT=setTimeout(flush,120)}
function flush(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
/* Корзина чистится при загрузке: удалённое старше TRASH_DAYS стирается физически */
function purge(st){
 const edge=Date.now()-TRASH_DAYS*864e5, dead=x=>x.del&&x.del<edge;
 const gone=st.pr.filter(dead).map(x=>x.id);
 st.pr=st.pr.filter(x=>!dead(x));
 st.ts=st.ts.filter(x=>!dead(x)&&!gone.includes(x.pj));
 st.mem=st.mem||[];
 return st;
}
function load(){
 try{const v=localStorage.getItem(KEY);if(v){const p=JSON.parse(v);if(p&&Array.isArray(p.ts))return purge(p)}}catch(e){}
 const imported=importOld();
 return imported||seed();
}
/* Разовый перенос из прежнего приложения: там задачи и шаги лежали одним списком,
   проект — это задача с isProject, шаг ссылается на неё через projectId. */
function importOld(){
 for(const k of OLD_KEYS){
  let old;
  try{const v=localStorage.getItem(k);if(!v)continue;old=JSON.parse(v)}catch(e){continue}
  if(!Array.isArray(old)||!old.length)continue;
  const st={seq:1,ts:[],pr:[],showDone:0,cur:null},map={};
  old.filter(t=>t.isProject).forEach(t=>{
   const id=st.seq++;map[t.id]=id;
   st.pr.push({id,n:t.title||'Без названия',due:t.due||null,why:'Перенесено из прежней версии.',chat:[]});
  });
  old.filter(t=>!t.isProject).forEach(t=>{
   st.ts.push({id:st.seq++,t:t.title||'Без названия',due:t.due||null,pj:map[t.projectId]||null,
    done:t.done?1:0,doneAt:t.doneAt||null,tail:null,n:(t.messages||[]).length,
    a:'Перенесено из прежней версии.',chat:(t.messages||[]).map(m=>m.role==='ai'?{a:m.text}:{u:m.text})});
  });
  if(!st.ts.length&&!st.pr.length)continue;
  st.cur=st.ts.length?{k:'t',id:st.ts[0].id}:{k:'p',id:st.pr[0].id};
  return st;
 }
 return null;
}
function seed(){
 const st={seq:1,ts:[],pr:[],showDone:0,cur:null,mem:[],spend:null};
 const mk=(n,due,why)=>{const id=st.seq++;st.pr.push({id,n,due,why,chat:[]});return id};
 const p1=mk('Запуск лендинга',plus(4),'Три шага из пяти готовы. Всё упирается в оффер — без него вычитка и выкладка не двинутся.');
 const p2=mk('Переезд офиса',plus(30),'Список неполный: нет пункта про интернет и вывоз старой мебели.');
 [
  {t:'Оплатить хостинг',due:plus(1),pj:null,done:0,tail:{k:'art',x:'черновик письма'},file:'Письмо об отсрочке — 3 версии',n:4,a:'Черновик письма готов — три версии на выбор.'},
  {t:'Дозвониться до Марины',due:today(),pj:null,done:0,tail:{k:'wait',x:'жду Марину'},n:6,a:'Вопросы к звонку собраны, но она не ответила со вторника.'},
  {t:'Записаться к врачу',due:plus(5),pj:null,done:0,tail:{k:'dec',x:'выбрали клинику'},n:3,a:'Клиника в двух кварталах, приём по будням до 20:00.'},
  {t:'Разобрать фото с поездки',due:null,pj:null,done:0,tail:null,n:0,a:'Ни срока, ни разговора — в списке только название.'},
  {t:'Купить лампочки',due:null,pj:null,done:0,tail:null,n:0,a:'Мелочь без срока.'},
  {t:'Собрать структуру экранов',due:plus(-3),pj:p1,done:1,doneAt:Date.now()-3*864e5,tail:{k:'dec',x:'три экрана'},n:5,a:'Проблема, оффер, тариф.'},
  {t:'Написать текст оффера',due:plus(2),pj:p1,done:0,tail:{k:'art',x:'нужен выбор'},file:'Оффер — три версии текста',n:8,a:'Три версии написаны. Пока не выберете — два шага стоят.'},
  {t:'Вычитка',due:plus(3),pj:p1,done:0,tail:null,n:0,a:'Ждёт текст.'},
  {t:'Залить на прод',due:null,pj:p1,done:0,tail:null,n:0,a:'Срок появится после вычитки.'},
  {t:'Найти грузчиков',due:plus(26),pj:p2,done:0,tail:{k:'wait',x:'ждём смету'},n:3,a:'Три предложения, разброс вдвое.'},
  {t:'Замерить кабинеты',due:null,pj:p2,done:0,tail:null,n:0,a:'Нужны размеры под столы.'},
  {t:'Уведомить арендодателя',due:plus(-6),pj:p2,done:1,doneAt:Date.now()-6*864e5,tail:{k:'dec',x:'письмо отправлено'},n:1,a:'Отправлено на прошлой неделе.'}
 ].forEach(x=>st.ts.push(Object.assign({id:st.seq++,doneAt:null,chat:[],pri:0},x)));
 st.cur={k:'t',id:st.ts[0].id};
 return st;
}

/* ---------- сущности ----------
   Тип записи — для подписи диктору и data-kind у строки (слева от названия у всех строк один знак «>»).
   Проект и шаг — по структуре данных;
   у задачи тип берётся из поля kind, а если его нет — угадывается по словам в названии.
   Порядок правил важен: «каждый день звонить маме» — рутина, а не звонок. */
const KIND={
 task:'Задача', project:'Проект', step:'Шаг проекта', reminder:'Напоминание', routine:'Рутина', call:'Звонок',
 meeting:'Встреча', payment:'Оплата', purchase:'Покупка', mail:'Письмо', idea:'Идея'
};
const GUESS=[
 ['routine',/(^|\s)(кажд(ый|ую|ое|ые)|ежедневн|еженедельн|ежемесячн|по (утрам|вечерам|будням|выходным)|рутин|привычк)/],
 ['reminder',/(напомн|не забыть|не забудь)/],
 ['call',/(позвон|дозвон|созвон|звонок|перезвон)/],
 ['payment',/(оплат|заплат|перевести деньги|счёт|счет за)/],
 ['purchase',/(^|\s)(купить|докупить|заказать|покупк)/],
 ['meeting',/(записаться|встреч|при[её]м у|к врачу|собеседован)/],
 ['mail',/(письм|написать|ответить|e-?mail|почт)/],
 ['idea',/(^|\s)(идея|придумать|подумать)/]
];
function kindOf(x,isP){
 if(isP)return 'project';
 if(x.pj!==null&&x.pj!==undefined)return 'step';
 if(x.kind&&KIND[x.kind])return x.kind;
 const t=String(x.t||'').toLowerCase();
 for(const [k,re] of GUESS)if(re.test(t))return k;
 return 'task';
}

/* ---------- выборки ---------- */
const byId=i=>S.ts.find(x=>x.id===i);
const prById=i=>S.pr.find(p=>p.id===i);
/* Удалённое лежит в корзине с отметкой del и из списков исчезает; byId и prById
   его по-прежнему находят — иначе не сработала бы отмена. */
const inPj=p=>S.ts.filter(x=>x.pj===p&&!x.del);
const openIn=p=>S.ts.filter(x=>x.pj===p&&!x.done&&!x.del);
const curItem=()=>S.cur&&(S.cur.k==='p'?prById(S.cur.id):byId(S.cur.id));

/* ---------- действия ---------- */
/* done меняется только здесь — он же ставит и обнуляет doneAt */
function mark(x,done){x.done=done?1:0;x.doneAt=done?Date.now():null}
function addTask(title){
 const t={id:S.seq++,t:title,due:null,pj:null,done:0,doneAt:null,pri:0,tail:null,n:0,a:'Разговора ещё не было.',chat:[]};
 S.ts.push(t); S.cur={k:'t',id:t.id}; save(); return t;
}
function delItem(){
 const isP=S.cur.k==='p';
 if(isP){S.ts=S.ts.filter(x=>x.pj!==S.cur.id); S.pr=S.pr.filter(p=>p.id!==S.cur.id);}
 else S.ts=S.ts.filter(x=>x.id!==S.cur.id);
 const n=S.ts[0]||S.pr[0];
 S.cur=n?(S.ts[0]?{k:'t',id:S.ts[0].id}:{k:'p',id:S.pr[0].id}):null;
 save(); paint();
}
/* Задача превращается в проект: сама становится записью в pr, а её название — первым шагом */
function makeProject(){
 const x=curItem(); if(S.cur.k==='p'||!x)return;
 const id=S.seq++;
 S.pr.push({id,n:x.t,due:x.due,why:'Проект создан из задачи. Добавьте шаги.',chat:x.chat.slice()});
 x.pj=id; x.chat=[]; x.n=0;
 S.cur={k:'p',id}; save(); paint();
}
function addStep(title){
 if(S.cur.k!=='p')return;
 const id=S.seq++;
 S.ts.push({id,t:title,due:null,pj:S.cur.id,done:0,doneAt:null,pri:0,tail:null,n:0,a:'Разговора ещё не было.',chat:[]});
 save(); paint(1);
 fly(thread.querySelector('.steps .step:last-child'));
}

/* ---------- чат ----------
   Точка подключения модели. Сейчас — локальная заглушка; когда появится
   серверная функция, здесь останется один fetch, остальное не изменится. */
/* Ключ текущей карточки: к нему привязаны отложенные режимы и проверка, что
   ответ всё ещё относится к открытой задаче */
const curKey=()=>S.cur?S.cur.k+':'+S.cur.id:'';

/* Разметка в ленте. Порядок строгий: сначала экранируем весь текст, потом размечаем —
   иначе ответ модели или вставленный пользователем текст становятся XSS. Ссылки только
   http(s) и mailto, открываются в новой вкладке; таблица — в контейнере с прокруткой,
   иначе на телефоне растянет всю ленту. */
function md(src){
 const lines=esc(String(src==null?'':src)).split('\n'), out=[];
 let i=0;
 const inline=t=>t
  .replace(/`([^`]+)`/g,(m,c)=>'<code>'+c+'</code>')
  .replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(m,txt,href)=>
   /^(https?:|mailto:)/i.test(href)?'<a href="'+href+'" target="_blank" rel="noopener">'+txt+'</a>':txt);
 const isBlock=l=>/^```/.test(l)||/^#{1,3}\s/.test(l)||/^\s*([-*]|\d+\.)\s/.test(l)||/^\s*\|.*\|\s*$/.test(l);
 const cells=l=>l.trim().replace(/^\||\|$/g,'').split('|').map(c=>c.trim());
 while(i<lines.length){
  const l=lines[i];
  if(/^```/.test(l)){
   const buf=[]; i++;
   while(i<lines.length&&!/^```/.test(lines[i]))buf.push(lines[i++]);
   i++; out.push('<pre><code>'+buf.join('\n')+'</code></pre>'); continue;
  }
  const h=l.match(/^(#{1,3})\s+(.*)$/);
  if(h){const n=h[1].length+2; out.push('<h'+n+'>'+inline(h[2])+'</h'+n+'>'); i++; continue;}
  if(/^\s*\|.*\|\s*$/.test(l)&&/^\s*\|[-:\s|]+\|\s*$/.test(lines[i+1]||'')){
   const head=cells(l); i+=2; const body=[];
   while(i<lines.length&&/^\s*\|.*\|\s*$/.test(lines[i]))body.push(cells(lines[i++]));
   out.push('<div class="tw"><table><thead><tr>'+head.map(c=>'<th>'+inline(c)+'</th>').join('')+
    '</tr></thead><tbody>'+body.map(r=>'<tr>'+r.map(c=>'<td>'+inline(c)+'</td>').join('')+'</tr>').join('')+
    '</tbody></table></div>'); continue;
  }
  const li=l.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
  if(li){
   const ord=/\d/.test(li[1]), items=[];
   while(i<lines.length){
    const m=lines[i].match(/^\s*([-*]|\d+\.)\s+(.*)$/); if(!m)break;
    items.push('<li>'+inline(m[2])+'</li>'); i++;
   }
   out.push((ord?'<ol>':'<ul>')+items.join('')+(ord?'</ol>':'</ul>')); continue;
  }
  if(!l.trim()){i++; continue;}
  const para=[];
  while(i<lines.length&&lines[i].trim()&&!isBlock(lines[i]))para.push(lines[i++]);
  out.push('<p>'+inline(para.join('<br>'))+'</p>');
 }
 return out.join('');
}

/* ---------- файлы ----------
   Задачи остаются в localStorage: они маленькие и нужны мгновенно при старте.
   Тела файлов туда не помещаются (лимит около 5 МБ и синхронный доступ), поэтому
   уезжают в IndexedDB. В состоянии задачи остаётся только список имён с размерами —
   благодаря этому снимок задачи собирается синхронно и не тянет за собой весь код.
   Файлы до INLINE байт держим прямо в состоянии: они уходят в промт целиком,
   и «поправь второй абзац» не стоит лишнего круга. */
const INLINE=2048, MAX_FILE=512*1024, MAX_FILES=20;
const DB_NAME='clutch', DB_STORE='files';
let dbp=null;
function db(){
 if(dbp)return dbp;
 dbp=new Promise((ok,no)=>{
  if(!self.indexedDB)return no(new Error('нет IndexedDB'));
  const r=indexedDB.open(DB_NAME,1);
  r.onupgradeneeded=()=>{const d=r.result; if(!d.objectStoreNames.contains(DB_STORE))d.createObjectStore(DB_STORE)};
  r.onsuccess=()=>ok(r.result); r.onerror=()=>no(r.error);
 });
 return dbp;
}
const fileKey=(owner,name)=>owner+'/'+name;
async function bodyPut(owner,name,body){
 const d=await db();
 return new Promise((ok,no)=>{const tx=d.transaction(DB_STORE,'readwrite');
  tx.objectStore(DB_STORE).put(body,fileKey(owner,name)); tx.oncomplete=ok; tx.onerror=()=>no(tx.error)});
}
async function bodyGet(owner,name){
 const d=await db();
 return new Promise((ok,no)=>{const tx=d.transaction(DB_STORE,'readonly');
  const q=tx.objectStore(DB_STORE).get(fileKey(owner,name)); q.onsuccess=()=>ok(q.result); q.onerror=()=>no(q.error)});
}
async function bodyDel(owner,name){
 const d=await db();
 return new Promise((ok,no)=>{const tx=d.transaction(DB_STORE,'readwrite');
  tx.objectStore(DB_STORE).delete(fileKey(owner,name)); tx.oncomplete=ok; tx.onerror=()=>no(tx.error)});
}
/* Маленькое тело лежит в состоянии, большое — в IndexedDB */
async function fileBody(item,f){
 if(f.body!==undefined)return f.body;
 try{const b=await bodyGet(f.owner,f.name); return b===undefined?null:b}catch(e){return null}
}
/* ---------- вложения от пользователя ----------
   Картинка и PDF уходят модели как есть, но это base64 в переписке, и без мер он
   уезжает заново каждый ход. Поэтому: картинки сжимаем до IMG_PX мегапикселя и в JPEG,
   PDF ограничен PDF_MAX, а вложение старше ATT_TURNS ходов заменяется в истории
   ссылкой — сам файл остаётся в задаче, из контекста уходит. */
const IMG_PX=1e6, IMG_Q=0.82, PDF_MAX=5*1024*1024, ATT_TURNS=5;
let pending=[];

const readAs=(f,how)=>new Promise((ok,no)=>{
 const r=new FileReader();
 r.onload=()=>ok(r.result); r.onerror=()=>no(r.error);
 how==='url'?r.readAsDataURL(f):r.readAsArrayBuffer(f);
});
const b64of=u=>String(u).slice(String(u).indexOf(',')+1);

async function shrink(file){
 const url=await readAs(file,'url');
 if(typeof document==='undefined'||!document.createElement('canvas').getContext)return {mime:file.type,data:b64of(url)};
 const img=await new Promise((ok,no)=>{const i=new Image(); i.onload=()=>ok(i); i.onerror=no; i.src=url;});
 const k=Math.min(1,Math.sqrt(IMG_PX/Math.max(1,img.width*img.height)));
 const c=document.createElement('canvas');
 c.width=Math.max(1,Math.round(img.width*k)); c.height=Math.max(1,Math.round(img.height*k));
 c.getContext('2d').drawImage(img,0,0,c.width,c.height);
 return {mime:'image/jpeg',data:b64of(c.toDataURL('image/jpeg',IMG_Q))};
}

async function attach(file,item,isP){
 const isImg=/^image\//.test(file.type);
 const isPdf=file.type==='application/pdf';
 if(!isImg&&!isPdf)return {err:'можно приложить картинку или PDF'};
 if(isPdf&&file.size>PDF_MAX)return {err:'PDF больше '+fmtSize(PDF_MAX)};
 let mime,data;
 if(isImg){const r=await shrink(file); mime=r.mime; data=r.data;}
 else {mime='application/pdf'; data=b64of(await readAs(file,'url'));}
 const owner=shortId(item,isP), name=String(file.name||'файл').replace(/[\/\\]/g,'_');
 try{await bodyPut(owner,'att:'+name,data)}catch(e){return {err:'не удалось сохранить вложение'}}
 return {name,mime,size:Math.round(data.length*3/4),owner,user:1};
}
const attBody=a=>bodyGet(a.owner,'att:'+a.name).catch(()=>null);

const fmtSize=n=>n<1024?n+' Б':n<1024*1024?(n/1024).toFixed(n<10240?1:0)+' КБ':(n/1048576).toFixed(1)+' МБ';

/* Скачивание через Blob: файла на сервере нет, он живёт только в браузере */
async function fileOpen(item,f){
 const body=await fileBody(item,f);
 if(body==null)return;
 const url=URL.createObjectURL(new Blob([body],{type:f.mime||'text/plain;charset=utf-8'}));
 const a=document.createElement('a');
 a.href=url; a.download=f.name; document.body.appendChild(a); a.click(); a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

/* ---------- инструменты ----------
   Исполняет их браузер, а не сервер: изменения идут теми же функциями и по тем же
   правилам, что и кнопки, поэтому сохранение, анимации и тесты работают без изменений,
   а сервер не может ничего испортить в задачах. Описания для модели — в worker/tools.js. */
const MAX_ACTS=5;            /* изменяющих вызовов на один ответ; чтение не в счёт */
const TRASH_DAYS=30;         /* сколько удалённое лежит в корзине */
const READ_TOOLS={task_search:1,chat_search:1,file_read:1};
/* Размер именно в байтах: кириллица в UTF-8 занимает по два, и счёт по символам
   врал бы вдвое — а по нему решается, вкладывать файл в промт или нет. */
const bytes=t=>{const v=String(t);
 try{return new TextEncoder().encode(v).length}catch(e){}
 try{return new Blob([v]).size}catch(e){}
 return v.length;
};

const shortId=(x,isP)=>(isP?'p':(x.pj!==null&&x.pj!==undefined)?'s':'t')+x.id;
function byShort(sid){
 const m=/^([tps])(\d+)$/.exec(String(sid==null?'':sid));
 if(!m)return null;
 return m[1]==='p'?prById(+m[2]):byId(+m[2]);
}

/* Стек отмены живёт только до перезагрузки страницы, и это честно показано:
   после неё кнопки в старых карточках гаснут. */
let undos=[], undoNote='';
function act(label,apply,revert){
 undos.push({label,revert,live:1});
 apply();
 return {out:'ok',card:label,undo:undos.length-1};
}
function undoAct(i){
 const u=undos[i];
 if(!u||!u.live)return;
 u.live=0; u.revert();
 /* Отмена расходится с историей модели: там уже лежит «сделал». Пометка в начале
    следующего сообщения объясняет расхождение, чтобы она не повторяла действие. */
 undoNote='[отменено: '+u.label.toLowerCase()+']';
 save(); paint();
}

/* Состояние подписи по её тексту: ждём кого-то — оранжевым, появился результат —
   синим, решили — зелёным. Без \b: он не работает с кириллицей. */
const TAIL_K=t=>/^жд[уёеа]/i.test(t)?'wait':/^(черновик|письмо|текст|файл|набросок)/i.test(t)?'art':'dec';

const ACT={
 task_rename(a,c){
  const t=String(a.title||'').trim(); if(!t)return {out:'пустое название',err:1};
  const o=c.item, was=c.isP?o.n:o.t;
  return act('Название → '+t,()=>{if(c.isP)o.n=t; else o.t=t},()=>{if(c.isP)o.n=was; else o.t=was});
 },
 task_set_due(a,c){
  const d=a.date==null?null:String(a.date);
  if(d!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(d))return {out:'дата должна быть YYYY-MM-DD',err:1};
  const o=c.item, was=o.due;
  return act('Срок → '+(d?fmtDue(d):'снят'),()=>{o.due=d},()=>{o.due=was});
 },
 task_complete(a,c){
  if(c.isP)return {out:'у проекта нет своей отметки, закрывай шаги',err:1};
  const o=c.item, was={done:o.done,doneAt:o.doneAt};
  return act(a.done?'Задача закрыта':'Задача снова в работе',
   ()=>mark(o,!!a.done),()=>{o.done=was.done;o.doneAt=was.doneAt});
 },
 task_set_tail(a,c){
  const t=String(a.tail||'').trim(); if(!t)return {out:'пустая подпись',err:1};
  const o=c.item, was=o.tail;
  return act('Подпись → '+t,()=>{o.tail={k:TAIL_K(t),x:t}},()=>{o.tail=was});
 },
 task_make_project(a,c){
  if(c.isP)return {out:'это уже проект',err:1};
  const o=c.item;
  if(o.pj!==null&&o.pj!==undefined)return {out:'это шаг проекта',err:1};
  const steps=(Array.isArray(a.steps)?a.steps:[]).map(x=>String(x||'').trim()).filter(Boolean).slice(0,30);
  const pid=S.seq++, was={n:o.n,chat:o.chat};
  const made=[];
  return act('Проект из задачи, шагов: '+(steps.length+1),()=>{
   S.pr.push({id:pid,n:o.t,due:o.due,why:'Проект создан из задачи.',chat:o.chat.slice()});
   o.pj=pid; o.chat=[]; o.n=0;
   for(const t of steps){const id=S.seq++; made.push(id); S.ts.push(mkStep(id,t,pid));}
   S.cur={k:'p',id:pid};
  },()=>{
   S.pr=S.pr.filter(x=>x.id!==pid);
   S.ts=S.ts.filter(x=>!made.includes(x.id));
   o.pj=null; o.chat=was.chat; o.n=was.chat.length;
   S.cur={k:'t',id:o.id};
  });
 },
 task_add_step(a,c){
  if(!c.isP)return {out:'шаги есть только у проекта',err:1};
  const t=String(a.title||'').trim(); if(!t)return {out:'пустое название',err:1};
  const id=S.seq++, pid=c.item.id;
  const after=a.after?byShort(a.after):null;
  return act('Шаг: '+t,()=>{
   const st=mkStep(id,t,pid);
   const i=after?S.ts.indexOf(after):-1;
   if(i>=0)S.ts.splice(i+1,0,st); else S.ts.push(st);
  },()=>{S.ts=S.ts.filter(x=>x.id!==id)});
 },
 task_complete_step(a,c){
  const st=byShort(a.step);
  if(!st||st.pj===null||st.pj===undefined)return {out:'шаг не найден',err:1};
  const was={done:st.done,doneAt:st.doneAt};
  return act((a.done?'Шаг закрыт: ':'Шаг открыт: ')+st.t,
   ()=>mark(st,!!a.done),()=>{st.done=was.done;st.doneAt=was.doneAt});
 },
 task_delete_step(a,c){
  const st=byShort(a.step);
  if(!st||st.pj===null||st.pj===undefined)return {out:'шаг не найден',err:1};
  return act('Шаг удалён: '+st.t,()=>{st.del=Date.now()},()=>{delete st.del});
 },
 task_create(a){
  const t=String(a.title||'').trim(); if(!t)return {out:'пустое название',err:1};
  const d=a.due==null?null:String(a.due);
  if(d!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(d))return {out:'дата должна быть YYYY-MM-DD',err:1};
  const id=S.seq++, steps=(Array.isArray(a.steps)?a.steps:[]).map(x=>String(x||'').trim()).filter(Boolean).slice(0,30);
  const made=[]; let pid=null;
  return act('Новая задача: '+t,()=>{
   if(steps.length){
    pid=S.seq++;
    S.pr.push({id:pid,n:t,due:d,why:'Проект создан ассистентом.',chat:[]});
    for(const x of steps){const sid=S.seq++; made.push(sid); S.ts.push(mkStep(sid,x,pid));}
   }else{
    S.ts.push({id,t,due:d,pj:null,done:0,doneAt:null,tail:null,n:0,a:'Разговора ещё не было.',chat:[]});
   }
  },()=>{
   S.ts=S.ts.filter(x=>x.id!==id&&!made.includes(x.id));
   if(pid!==null)S.pr=S.pr.filter(x=>x.id!==pid);
  });
 },
 task_delete(a){
  const o=byShort(a.id);
  if(!o)return {out:'не найдено',err:1};
  const isP=/^p/.test(String(a.id));
  return act('В корзину: '+(isP?o.n:o.t),()=>{o.del=Date.now()},()=>{delete o.del});
 },
 /* Файл сохраняется в задачу: маленький прямо в состоянии, большой в IndexedDB.
    Хвостовой вызов — результат модели не нужен, круг не тратим. */
 async file_write(a,c){
  const name=String(a.name||'').trim().replace(/[\/\\]/g,'_');
  if(!name)return {out:'нет имени файла',err:1};
  const content=String(a.content==null?'':a.content);
  const size=bytes(content);
  if(size>MAX_FILE)return {out:'файл больше '+fmtSize(MAX_FILE),err:1};
  const o=c.item; o.files=o.files||[];
  const i=o.files.findIndex(f=>f.name===name);
  /* Существующий файл не перезаписываем без спроса — так же, как удаление */
  if(i>=0&&!a.overwrite)return {out:'файл существует, нужен overwrite',err:1};
  if(i<0&&o.files.length>=MAX_FILES)return {out:'слишком много файлов у задачи',err:1};
  const owner=shortId(o,c.isP);
  const was=i>=0?{...o.files[i]}:null;
  const wasBody=i>=0?await fileBody(o,o.files[i]):null;
  const f={name,mime:String(a.mime||'text/plain'),size,owner};
  if(size<=INLINE)f.body=content; else {try{await bodyPut(owner,name,content)}catch(e){return {out:'не удалось сохранить файл',err:1}}}
  return act('Файл: '+name+' · '+fmtSize(size),
   ()=>{if(i>=0)o.files[i]=f; else o.files.push(f)},
   ()=>{
    if(was){o.files[i]=was; if(wasBody!=null&&was.body===undefined)bodyPut(owner,name,wasBody).catch(()=>{});}
    else {o.files=o.files.filter(x=>x.name!==name); bodyDel(owner,name).catch(()=>{});}
   });
 },
 /* Память о пользователе: общая на все задачи, живёт в браузере, видна и стирается
    в настройках. Хвостовые вызовы — круга не стоят. */
 memory_write(a){
  const t=String(a.text||'').trim(); if(!t)return {out:'пустая запись',err:1};
  S.mem=S.mem||[];
  if(S.mem.some(x=>x.toLowerCase()===t.toLowerCase()))return {out:'уже записано'};
  if(S.mem.length>=40)return {out:'память переполнена, попроси пользователя почистить',err:1};
  return act('Запомнил: '+t,()=>{S.mem.push(t)},()=>{S.mem=S.mem.filter(x=>x!==t)});
 },
 memory_forget(a){
  const t=String(a.text||'').trim(); S.mem=S.mem||[];
  const i=S.mem.findIndex(x=>x.toLowerCase().includes(t.toLowerCase()));
  if(!t||i<0)return {out:'такого в памяти нет'};
  const was=S.mem[i];
  return act('Забыл: '+was,()=>{S.mem.splice(i,1)},()=>{S.mem.splice(i,0,was)});
 },
 async file_read(a,c){
  const name=String(a.name||'').trim();
  const f=(c.item.files||[]).find(x=>x.name===name);
  if(!f)return {out:'файл не найден'};
  const body=await fileBody(c.item,f);
  return {out:body==null?'файл не читается':body};
 },
 /* Чтение: в лимит действий не входит и карточки не рисует */
 task_search(a){
  const q=String(a.query||'').toLowerCase().trim(); if(!q)return {out:'пустой запрос'};
  const scope=a.scope||'open';
  const hit=x=>(x.t||x.n||'').toLowerCase().includes(q)||((x.tail&&x.tail.x)||'').toLowerCase().includes(q);
  const ok=x=>scope==='all'?1:scope==='done'?x.done:!x.done;
  const r=[...S.ts.filter(x=>!x.del&&hit(x)&&ok(x)).map(x=>shortId(x,0)+' '+x.t),
           ...S.pr.filter(x=>!x.del&&hit(x)).map(x=>shortId(x,1)+' '+x.n)].slice(0,20);
  return {out:r.length?r.join('\n'):'ничего не нашлось'};
 },
 chat_search(a){
  const q=String(a.query||'').toLowerCase().trim(); if(!q)return {out:'пустой запрос'};
  const r=[];
  const scan=(o,isP)=>{for(const m of (o.chat||[])){
   const t=m.u||m.a||''; if(t&&t.toLowerCase().includes(q))r.push(shortId(o,isP)+' «'+(isP?o.n:o.t)+'»: '+t.slice(0,160));
  }};
  S.ts.filter(x=>!x.del).forEach(x=>scan(x,0));
  S.pr.filter(x=>!x.del).forEach(x=>scan(x,1));
  return {out:r.length?r.slice(0,10).join('\n'):'ничего не нашлось'};
 }
};
const mkStep=(id,t,pid)=>({id,t,due:null,pj:pid,done:0,doneAt:null,tail:null,n:0,a:'Разговора ещё не было.',chat:[]});

/* Часть инструментов асинхронна (файлы), поэтому результат всегда обещание */
async function runTool(tu,item,isP){
 const f=ACT[tu.name];
 if(!f)return {out:'неизвестный инструмент',err:1};
 try{return await f(tu.input||{},{item,isP})}
 catch(e){return {out:'ошибка: '+((e&&e.message)||e),err:1}}
}

/* ---------- чат ----------
   API — адрес серверной функции из worker/. Ключ Anthropic в статике держать нельзя:
   бандл публичный. Пока адрес пуст, отвечает локальная заглушка. */
const API='https://clutch.gloomnotgloom.com';

/* Переписка в формате блоков Anthropic. Ход модели с вызовами и ответ клиента с
   результатами — два соседних сообщения; строка ошибки и «печатает» не уходят. */
/* Сколько сообщений держим целиком и после какой длины сжимаем старое */
const SUM_AFTER=24, SUM_KEEP=10;

/* Расход считаем в деньгах, а не в токенах: у чтения кэша, записи кэша, входа и
   выхода разные цены. Цены Sonnet 5 за миллион токенов; поменяется модель — поменять тут. */
const PRICE={in:2,out:10,cr:0.2,cw:2.5};
function addSpend(u){
 if(!u)return;
 const sp=S.spend||(S.spend={in:0,out:0,cr:0,cw:0,at:Date.now()});
 sp.in+=u.input_tokens||0; sp.out+=u.output_tokens||0;
 sp.cr+=u.cache_read_input_tokens||0; sp.cw+=u.cache_creation_input_tokens||0;
 save();
}
const spendUsd=sp=>!sp?0:(sp.in*PRICE.in+sp.out*PRICE.out+sp.cr*PRICE.cr+sp.cw*PRICE.cw)/1e6;

async function chatMessages(item){
 const out=[];
 const from=item.sumTo||0;
 /* Ходы пользователя считаем с конца: вложение старше ATT_TURNS уходит из контекста
    ссылкой — иначе его base64 уезжает заново каждый ход и быстро съедает окно. */
 const turns=item.chat.slice(from).filter(m=>m.u!==undefined).length;
 let seen=0;
 for(const m of item.chat.slice(from)){
  if(m.err||m.typing)continue;
  if(m.u!==undefined){
   seen++;
   if(m.att&&m.att.length){
    const fresh=turns-seen<ATT_TURNS, blocks=[];
    for(const a of m.att){
     const body=fresh?await attBody(a):null;
     if(body)blocks.push({type:/^image\//.test(a.mime)?'image':'document',
      source:{type:'base64',media_type:a.mime,data:body}});
     else blocks.push({type:'text',text:'[вложение '+a.name+' — приложено раньше, сейчас не в контексте]'});
    }
    blocks.push({type:'text',text:m.u});
    out.push({role:'user',content:blocks});
   }else out.push({role:'user',content:m.u});
   continue;
  }
  const blocks=[];
  if(m.a)blocks.push({type:'text',text:m.a});
  if(m.tu)for(const t of m.tu)blocks.push({type:'tool_use',id:t.id,name:t.name,input:t.input||{}});
  if(blocks.length)out.push({role:'assistant',content:blocks});
  if(m.res&&m.res.length)out.push({role:'user',
   content:m.res.map(r=>({type:'tool_result',tool_use_id:r.id,content:r.out,...(r.err?{is_error:true}:{})}))});
 }
 return out;
}

/* Снимок задачи пересобирается на каждый запрос, поэтому чат всегда говорит о том,
   что человек видит на экране. Идентификаторы короткие и стабильные. */
async function chatPayload(item,isP){
 const task={
  id:shortId(item,isP),
  title:isP?item.n:item.t,
  kind:(KIND[kindOf(item,isP)]||'Задача').toLowerCase(),
  due:item.due||null, dueWord:fmtDue(item.due)||'',
  done:isP?false:!!item.done, isProject:!!isP,
  steps:isP?inPj(item.id).map(x=>({id:'s'+x.id,t:x.t,done:!!x.done})):[],
  /* Содержимое в промт не уходит: только имена и размеры. Исключение — маленькие
     файлы, они вкладываются целиком, чтобы правка абзаца не стоила лишнего круга. */
  files:(item.files||[]).map(f=>({name:f.name,size:f.size,...(f.body!==undefined?{body:f.body}:{})}))
 };
 if(!isP&&item.pj!==null&&item.pj!==undefined){
  const pr=prById(item.pj);
  /* Чат один на задачу; отдельного чата у шага нет. Строка «открыт из шага»
     говорит модели, про какой именно шаг спрашивают в контексте проекта. */
  if(pr){task.project=pr.n; task.fromStep='s'+item.id;}
 }
 const cur=task.id;
 const others=S.ts.filter(x=>!x.done&&!x.del&&(x.pj===null||x.pj===undefined)).map(x=>({id:'t'+x.id,t:x.t,due:x.due||null,isProject:false}))
  .concat(S.pr.filter(x=>!x.del&&openIn(x.id).length).map(x=>({id:'p'+x.id,t:x.n,due:x.due||null,isProject:true})))
  .filter(x=>x.id!==cur)
  .sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'))
  .slice(0,20);
 let tz='UTC'; try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC'}catch(e){}
 const profile=(S.mem||[]).join('\n');
 return {task,others,messages:await chatMessages(item),today:today(),tz,
  ...(profile?{profile}:{}),...(item.sum?{summary:item.sum}:{})};
}

/* Один проход потока. Текст отдаётся кусками через onDelta — лента дорисовывается
   на ходу, а не появляется целиком в конце. Вызовы инструментов копятся и отдаются
   в конце: их аргументы приходят кусками и собираются воркером. */
async function streamOnce(body,onDelta){
 const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok){
  let why=''; try{why=(await r.json()).error||''}catch(e){}
  const err=new Error('HTTP '+r.status+(why?' · '+why:''));
  err.retry=r.status===529||r.status>=500;
  throw err;
 }
 if(!r.body)throw new Error('поток недоступен');
 const rd=r.body.getReader(), dec=new TextDecoder();
 let buf='', out='', got=false; const tools=[];
 for(;;){
  const {value,done}=await rd.read();
  if(done)break;
  buf+=dec.decode(value,{stream:true});
  const parts=buf.split('\n\n'); buf=parts.pop();
  for(const part of parts){
   const ev=(part.match(/^event: (.+)$/m)||[])[1];
   const dl=(part.match(/^data: (.*)$/m)||[])[1];
   if(!ev||dl===undefined)continue;
   let d; try{d=JSON.parse(dl)}catch(e){continue}
   if(ev==='text'){out+=d; got=true; onDelta&&onDelta(out);}
   else if(ev==='tool_use'){tools.push(d); got=true;}
   else if(ev==='done'){addSpend(d&&d.usage);}
   else if(ev==='error'){
    const e=new Error(d.error||'ошибка потока');
    e.retry=!got;                       /* повторяем только если ничего не успели показать */
    throw e;
   }
  }
 }
 if(!got){const e=new Error('пустой ответ'); e.retry=true; throw e;}
 return {text:out.trim(),tools};
}

async function askOnce(item,isP,onDelta){
 const body=await chatPayload(item,isP);
 let pause=600;
 for(let n=0;n<3;n++){
  try{return await streamOnce(body,onDelta);}
  catch(e){
   /* Перегрузка модели и обрыв потока — повторяем с нарастающей паузой. Остальное
      показываем сразу: смысла ждать нет, а молчание хуже понятной ошибки. */
   if(e&&e.retry&&n<2){await new Promise(r=>setTimeout(r,pause)); pause*=2; continue;}
   let host=API; try{host=new URL(API).host}catch(_){}
   throw new Error('Не получилось связаться с моделью ('+host+'): '+((e&&e.message)||e)+'.');
  }
 }
}

/* Заглушка на время без сервера */
async function stubReply(text,item,isP){
 await new Promise(r=>setTimeout(r,RM?0:600));
 const t=text.toLowerCase();
 if(isP){
  const op=openIn(item.id);
  if(t.includes('пересобрать'))return 'Порядок оставил бы прежним: сначала то, что блокирует остальное. '+(op[0]?'Ближайший шаг — «'+op[0].t+'».':'Открытых шагов нет.');
  if(t.includes('блокир'))return item.why;
  return 'По проекту «'+item.n+'»: осталось '+op.length+' шаг(ов), срок — '+(fmtDue(item.due)||'не задан')+'.';
 }
 if(t.includes('разбить'))return 'Предлагаю три шага: уточнить детали, сделать основную часть, проверить результат.';
 if(t.includes('перенести'))return 'На какую дату перенести «'+item.t+'»? Сейчас: '+(fmtDue(item.due)||'без срока')+'.';
 return item.a;
}

function ask(text){
 const isP=S.cur.k==='p', item=curItem(); if(!item)return;
 /* Пометка об отмене уходит в начале сообщения: снимок задачи покажет правду,
    но без пометки модель удивится расхождению и повторит действие. */
 const note=undoNote; undoNote='';
 const att=pending.length?pending.slice():null;
 pending=[]; paintPending();
 item.chat.push({u:(note?note+' ':'')+text,...(att?{att}:{})});
 if(!isP)item.n++;
 turn(item,isP);
}

/* Круг «ответ → вызовы → результаты → продолжение». Каждый круг — новый запрос,
   поэтому лишних кругов избегаем: если модель закончила ход только изменениями,
   их результаты уйдут вместе со следующим сообщением пользователя. */
async function turn(item,isP){
 if(!API){
  const ph={typing:1}; item.chat.push(ph); paint(); save();
  const last=[...item.chat].reverse().find(m=>m.u!==undefined);
  ph.typing=0; ph.a=await stubReply((last&&last.u)||'',item,isP); paint(); save(); return;
 }
 const key=curKey();
 let acts=0;
 for(let round=0;round<6;round++){
  const ph={typing:1}; item.chat.push(ph); paint(); save();
  let res;
  try{
   res=await askOnce(item,isP,t=>{
    ph.typing=0; ph.a=t;
    if(curKey()!==key)return;
    const el=thread.lastElementChild;
    if(el&&el.classList.contains('ans')){
     el.classList.remove('typing');
     /* Пишем внутрь .tx, чтобы не ломать разметку элемента ленты */
     const tx=el.querySelector('.tx');
     if(tx)tx.innerHTML=md(t); else el.innerHTML='<span class="tx">'+md(t)+'</span>';
     thread.scrollTop=thread.scrollHeight;
    }
   });
  }catch(e){
   ph.typing=0; ph.err=1; ph.a=(e&&e.message)||String(e); paint(); save(); return;
  }
  ph.typing=0; ph.a=res.text;
  if(!res.tools.length){
   if(!res.text)item.chat.pop();
   paint(); save(); squeeze(item); return;
  }
  ph.tu=res.tools; ph.res=[];
  let read=false;
  for(const tu of res.tools){
   const isRead=!!READ_TOOLS[tu.name];
   if(isRead)read=true;
   if(!isRead&&acts>=MAX_ACTS){ph.res.push({id:tu.id,out:'лимит действий, спроси пользователя',err:1}); continue}
   if(!isRead)acts++;
   const r=await runTool(tu,item,isP);
   ph.res.push({id:tu.id,out:r.out,err:r.err});
   if(r.card!==undefined)(ph.cards=ph.cards||[]).push({label:r.card,undo:r.undo});
  }
  paint(); save();
  /* Хвостовые вызовы: результат модели не нужен — не тратим круг */
  if(!read){squeeze(item); return;}
 }
}

/* Длинную переписку сжимаем: старую часть заменяет выжимка, её делает дешёвая
   модель на сервере. Иначе каждый круг тащит всю историю целиком. */
async function squeeze(item){
 if(!API)return;
 const from=item.sumTo||0, len=item.chat.length;
 if(len-from<=SUM_AFTER)return;
 const upto=len-SUM_KEEP;
 const lines=item.chat.slice(from,upto).filter(m=>!m.typing&&!m.err)
  .map(m=>m.u!==undefined?'Пользователь: '+m.u:'Ассистент: '+(m.a||''))
  .filter(x=>x.length>12);
 if(!lines.length)return;
 if(item.sum)lines.unshift('Ранее: '+item.sum);
 try{
  const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({summarize:lines})});
  if(!r.ok)return;
  const d=await r.json();
  if(!d.summary)return;
  item.sum=d.summary; item.sumTo=upto; save();
 }catch(e){/* выжимка не получилась — просто продолжаем слать историю целиком */}
}

/* ---------- короткие названия ----------
   Пользователь пишет как придётся, а в списке имя должно читаться с одного взгляда.
   Приводим к двум словам (три — только если двумя никак) дешёвой моделью на воркере.
   Исходник сохраняется в t0: ничего не теряется, и видно, из чего получилось. */
const TITLE_WORDS=3;
const wordsOf=t=>String(t).trim().split(/\s+/).filter(Boolean);
/* Модель иногда добавляет кавычки или точку — снимаем и режем до трёх слов */
function tidyTitle(t){
 const w=wordsOf(String(t).replace(/^[«"'`\s]+|[»"'`.\s]+$/g,''));
 return w.slice(0,TITLE_WORDS).join(' ');
}
async function shortenTitle(x){
 if(!API||!x||x.t0)return;
 if(wordsOf(x.t).length<=2)return;      /* и так коротко — запрос не тратим */
 const was=x.t;                         /* запоминаем ДО запроса: пока ходим, название могут поправить руками */
 let title;
 try{
  const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({shorten:x.t})});
  if(!r.ok)return;
  title=tidyTitle((await r.json()).title||'');
 }catch(e){return}                      /* нет сети — название остаётся как набрали */
 if(!title||title===was)return;
 const live=byId(x.id);
 if(!live||live.t!==was)return;         /* название успели поправить руками — чужое не перетираем */
 live.t0=was; live.t=title;
 save(); paint();
}

/* ---------- настройки ----------
   Отдельный экран, а не скрытый жест: без него некуда смотреть память и корзину.
   Сделан накладкой, одинаковой в обеих оболочках, — иначе логика разъедется. */
let setEl=null;
function settings(){
 if(!setEl){
  setEl=document.createElement('div');
  setEl.className='sheet set'; setEl.hidden=true;
  setEl.innerHTML='<div class="sheet-back"></div><div class="sheet-body" role="dialog" aria-label="Настройки"></div>';
  setEl.querySelector('.sheet-back').onclick=()=>{setEl.hidden=true};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&setEl&&!setEl.hidden)setEl.hidden=true});
  document.body.appendChild(setEl);
 }
 const body=setEl.querySelector('.sheet-body');
 const mem=S.mem||[];
 const trash=[...S.ts.filter(x=>x.del).map(x=>({o:x,n:x.t,isP:0})),...S.pr.filter(x=>x.del).map(x=>({o:x,n:x.n,isP:1}))];
 const sp=S.spend, usd=spendUsd(sp);
 let h='<div class="sheet-title">Настройки</div>';

 h+='<div class="sh">Память</div>';
 h+=mem.length?mem.map((t,i)=>'<div class="si"><span>'+esc(t)+'</span>'+
   '<button class="ax" type="button" data-forget="'+i+'" aria-label="Забыть">'+Ic(P.x,12)+'</button></div>').join('')
  :'<div class="se">Пусто. Ассистент сам запоминает то, что пригодится в других задачах.</div>';

 h+='<div class="sh">Расход</div>';
 h+=sp?'<div class="si"><span>'+(usd<0.01?'меньше цента':'≈ $'+usd.toFixed(2))+'</span>'+
   '<span class="as">'+((sp.in+sp.cr+sp.cw)/1000).toFixed(1)+'k вход · '+(sp.out/1000).toFixed(1)+'k выход</span></div>'
  :'<div class="se">Запросов ещё не было.</div>';

 h+='<div class="sh">Корзина</div>';
 h+=trash.length?trash.map((x,i)=>'<div class="si"><span>'+esc(x.n)+'</span>'+
   '<button class="au" type="button" data-restore="'+i+'">Вернуть</button></div>').join('')
  :'<div class="se">Пусто. Удалённое лежит здесь 30 дней.</div>';

 h+='<div class="sh">Данные</div>';
 h+='<button class="mi danger" type="button" data-wipe="1">'+Ic(P.trash,16)+'<span>Стереть все данные</span></button>';
 h+='<div class="se">Текст задачи уходит в Anthropic, у нас не хранится. Задачи, переписка и файлы лежат в этом браузере.</div>';
 body.innerHTML=h;

 body.querySelectorAll('[data-forget]').forEach(b=>b.onclick=()=>{S.mem.splice(+b.dataset.forget,1); save(); settings();});
 body.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{delete trash[+b.dataset.restore].o.del; save(); paint(); settings();});
 body.querySelectorAll('[data-wipe]').forEach(b=>{
  let armed=false;
  b.onclick=()=>{
   if(!armed){armed=true; b.querySelector('span').textContent='Точно стереть всё?'; return;}
   try{localStorage.removeItem(KEY)}catch(e){}
   try{indexedDB.deleteDatabase(DB_NAME)}catch(e){}
   location.reload();
  };
 });
 setEl.hidden=false;
}



/* ---------- список ----------
   Список растёт снизу вверх: он прижат к строке ввода, самое свежее ближе к пальцу. */
/* Список по умолчанию идёт в порядке приоритетов: самое срочное внизу, у большой кнопки.
   Кнопка в шапке этот порядок выключает, возвращая порядок добавления. */
let sorted = true, undoBuf = null, toastTimer = null, suppressRow = false, priPop = null;
let list, scroll, thread;

/* Подпись строки: состояние или «без диалога», затем срок или «без срока» */
function sub(x, gaps){
 const noTalk = gaps && !x.tail && !x.n && !(x.chat && x.chat.length);
 const bits = [];
 if(x.tail) bits.push(x.tail.x); else if(noTalk) bits.push('без диалога');
 if(x.due) bits.push(fmtDue(x.due)); else if(gaps) bits.push('без срока');
 return bits.join(' · ');
}
/* Кружок строки: у задачи галочка, у проекта число открытых шагов. Кольцо приоритета — цветом */
function ckHTML(x, left){
 const cls = 'ck press' + (x.pri ? ' p'+x.pri : '') + (x.done ? ' on' : '');
 if(left === undefined || x.done)
  return '<button class="'+cls+'" aria-label="'+(x.done?'Снять отметку':'Выполнить')+': '+esc(x.t||x.n||'')+'">'+Ic(P.check,18)+'</button>';
 return '<button class="'+cls+'" aria-label="Закрыть следующий шаг, осталось '+left+'"><span class="num">'+left+'</span></button>';
}
/* Строка списка: задача или проект */
function rowEl(x, isP, next, left){
 const r = document.createElement('div');
 r.className = 'row' + (x.done ? ' done' : '');
 if(isP) r.dataset.pj = x.id; else r.dataset.id = x.id;
 r.dataset.kind = kindOf(x, isP);
 r.tabIndex = 0;
 const title = isP ? x.n : x.t;
 const meta  = isP ? ('→ ' + (next ? next.t : '') + ' · ' + (fmtDue((next&&next.due)||x.due) || 'без срока'))
                   : sub(x, 1);
 r.innerHTML = '<div class="cell"><span class="sr-only">'+KIND[r.dataset.kind]+': </span>'+
   '<div class="t1">'+esc(title)+'</div>'+(meta?'<div class="t2">'+esc(meta)+'</div>':'')+'</div>' +
   ckHTML(isP ? {pri:x.pri, done:0, n:x.n} : x, isP ? left : undefined);
 r.querySelector('.ck').onclick = e => { e.stopPropagation(); isP ? ringTap(x, r) : toggle(x, r); };
 const go = () => { if(suppressRow){ suppressRow = false; return; }
   S.cur = {k:isP?'p':'t', id:x.id}; save(); open(); };
 r.onclick = go;
 r.onkeydown = e => { if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(); } };
 armPri(r, x);
 return r;
}
function paint(keep){
 /* del — корзина: из списков пропадает, но byId находит, иначе не сработала бы отмена */
 const dn = S.ts.filter(x=>x.done && !x.del);
 list.innerHTML = '';
 if(S.showDone){
  dn.forEach(x=>list.appendChild(rowEl(x,0)));
  if(!dn.length) list.innerHTML = '<div class="empty">Пока ничего не сделано.</div>';
 } else {
  const items = [];
  S.ts.filter(x=>!x.done && !x.del && x.pj===null).forEach(x=>items.push({x,isP:0,pri:x.pri||0}));
  S.pr.filter(p=>!p.del).forEach(p=>{
   const all = inPj(p.id), op = openIn(p.id);
   if(!op.length) return;
   items.push({x:p, isP:1, next:op[0], left:op.length, pri:p.pri||0});
  });
  /* Сортировка устойчивая: самое срочное уезжает вниз, ближе к большой кнопке.
     Порядок по умолчанию — этот, а не порядок добавления. */
  if(sorted) items.sort((a,b)=>(a.pri||0)-(b.pri||0));
  items.forEach(i=>list.appendChild(rowEl(i.x, i.isP, i.next, i.left)));
  if(!items.length) list.innerHTML = '<div class="empty">Входящие пусты. Нажми большую кнопку.</div>';
 }
 drawFind();
 if(MODE==='two' || view==='detail') paintDetail();   /* закрытый экран чата не перерисовываем */
 if(!keep) toBottom();
}
/* Список прижат к строке ввода: самое свежее ближе к пальцу, добавил задачу — остальные
   ушли вверх. Распорка .spacer держит короткий список внизу, прокрутка — длинный.
   Чтение offsetHeight заставляет браузер применить новые размеры: без него scrollTop
   обрежется по старым, и только что добавленная задача останется за краем. */
function toBottom(){
 if(!scroll) return;
 const go = () => { void scroll.offsetHeight; scroll.scrollTop = scroll.scrollHeight; };
 go();
 /* Второй проход в следующем кадре: на первом размеры ещё не окончательные — при старте
    и после смены запаса список недоезжал, и последняя задача пряталась под кнопкой. */
 if(typeof requestAnimationFrame === 'function') requestAnimationFrame(go);
}

/* ---------- выполнение ---------- */
function toggle(x, row){
 if(x.done){ mark(x,0); save(); paint(1); tap(10); return; }
 tap(25); pop();
 row.querySelector('.ck').classList.add('on');
 burst(row);
 undoBuf = {x};
 setTimeout(()=>{
  mark(x,1); save(); paint(1);
  [...list.children].forEach(r=>{ if(!RM) r.classList.add('land'); setTimeout(()=>r.classList.remove('land'),210); });
  showToast('Выполнено · ' + x.t);
 }, RM?0:140);
}
/* Кольцо проекта закрывает ближайший открытый шаг; строка остаётся на месте */
function ringTap(p, row){
 const op = openIn(p.id);
 if(!op.length) return;
 tap(25); pop();
 const ck = row.querySelector('.ck');
 burst(row, true);
 if(!RM && ck && ck.animate) ck.animate([{transform:'scale(1)'},{transform:'scale(1.22)'},{transform:'scale(1)'}],
   {duration:320,easing:'cubic-bezier(.34,1.56,.64,1)'});
 undoBuf = {x:op[0]};
 setTimeout(()=>{ mark(op[0],1); save(); paint(1); showToast('Шаг закрыт · ' + op[0].t); }, RM?0:140);
}

/* ---------- плашка о выполненном ----------
   Вырастает из кружка переключателя справа внизу и через 4 секунды сворачивается обратно.
   При открытой клавиатуре не показывается: ей негде встать, она легла бы на строку ввода. */
/* Видимая область меньше окна — значит клавиатура на экране */
function kbUp(){
 const vv = window.visualViewport;
 return innerHeight - (vv ? vv.height : innerHeight) > 80;
}
function kbOpen(){
 const a = document.activeElement, c = $('composer');
 if(kbUp()) return true;
 if(a && a.matches && a.matches('.inp')) return true;
 return !!(c && !c.classList.contains('mini'));
}
function showToast(text){
 if(kbOpen()) return;
 if(Date.now() - Math.max(kbAtTap, kbLast) < 1200) return;
 $('toast-t').textContent = text;
 $('find').classList.add('busy');
 $('toast').classList.add('on');
 clearTimeout(toastTimer);
 toastTimer = setTimeout(hideToast, 4000);
}
function hideToast(){
 clearTimeout(toastTimer);
 $('toast').classList.remove('on');
 setTimeout(()=>$('find').classList.remove('busy'), 220);
}

/* ---------- приоритет ----------
   Долгое нажатие по строке открывает на её месте капсулу: «нет» и четыре ступени, каждая своего цвета. */
const PRI = [{v:0},{v:1,c:'var(--pri1)'},{v:2,c:'var(--pri2)'},{v:3,c:'var(--pri3)'},{v:4,c:'var(--pri4)'}];
function closePri(){ if(!priPop) return; priPop.back.remove(); priPop.el.remove(); priPop = null; }
function openPri(x, row){
 closePri();
 const host = row.closest('.screen'); if(!host) return;
 const hb = host.getBoundingClientRect(), rb = row.getBoundingClientRect();
 const back = document.createElement('div'); back.className = 'pri-back';
 const el = document.createElement('div'); el.className = 'pri';
 el.innerHTML = PRI.map(p => '<button class="press'+(Number(x.pri||0)===p.v?' on':'')+'" data-v="'+p.v+'" '+
   'aria-label="Приоритет '+(p.v||'нет')+'">'+(p.c?'<span class="dotc" style="background:'+p.c+'"></span>':'—')+'</button>').join('');
 el.style.top = Math.max(16, Math.min(rb.top - hb.top, hb.height - 68 - 16)) + 'px';
 host.appendChild(back); host.appendChild(el);
 priPop = {el, back};
 tap(14);
 back.onclick = closePri;
 el.querySelectorAll('button').forEach(b => b.onclick = () => {
  x.pri = Number(b.dataset.v); save(); tap(8); closePri(); paint(1);
 });
}
/* 500 мс — столько же держит iOS до своего меню; сдвиг больше 10 px это прокрутка */
function armPri(row, x){
 let t = null, sx = 0, sy = 0;
 const cancel = () => { clearTimeout(t); t = null; };
 row.addEventListener('pointerdown', e => {
  if(e.pointerType==='mouse' && e.button!==0) return;
  suppressRow = false; sx = e.clientX; sy = e.clientY; cancel();
  t = setTimeout(()=>{ t = null; suppressRow = true; openPri(x, row); }, 500);
 });
 row.addEventListener('pointermove', e => { if(t && (Math.abs(e.clientX-sx)>10 || Math.abs(e.clientY-sy)>10)) cancel(); });
 ['pointerup','pointercancel','pointerleave'].forEach(n=>row.addEventListener(n, cancel));
 row.addEventListener('contextmenu', e => { e.preventDefault(); cancel(); suppressRow = true; openPri(x, row); });
}

/* ---------- чат ----------
   Шапка — таблетка с названием и круглые кнопки по углам: слева назад, справа выполнить.
   Паучок один на всю ленту: бежит за печатающимся ответом и остаётся сидеть в конце последнего. */
let typeNext = null, typing = null;
function spider(host){
 thread.querySelectorAll('.spider').forEach(o=>o.remove());
 if(RM || !host) return null;
 host.insertAdjacentHTML('beforeend', SPIDER);
 return host.querySelector('.spider');
}
function parkSpider(){
 const all = thread.querySelectorAll('.ans');
 const sp = spider(all[all.length-1]);
 if(sp) sp.classList.add('idle');
}
function typeInto(el, text){
 const tx = el.querySelector('.tx') || el;
 const sp = spider(el);
 if(RM || !sp){ tx.textContent = text; return; }
 let i = 0, idle = null;
 clearTimeout(typing);
 (function step(){
  if(i >= text.length){ clearTimeout(idle); sp.classList.add('idle'); return; }
  const ch = text[i++];
  tx.textContent += ch;
  sp.classList.remove('idle');
  let d = 26;
  if(ch === ' ') d *= 1.4;
  if('.,—:'.includes(ch)) d *= 7;
  clearTimeout(idle);
  if(d > 90) idle = setTimeout(()=>sp.classList.add('idle'), 60);
  thread.scrollTop = thread.scrollHeight;
  typing = setTimeout(step, d);
 })();
}
function paintDetail(){
 if(!S.cur || !curItem()){
  const n = S.ts[0] || S.pr[0];
  if(!n){ $('ct').value=''; $('cm').textContent=''; thread.innerHTML=''; return; }
  S.cur = S.ts[0] ? {k:'t',id:S.ts[0].id} : {k:'p',id:S.pr[0].id};
 }
 const isP = S.cur.k==='p', p = isP?prById(S.cur.id):null, x = isP?null:byId(S.cur.id);
 const it = isP ? p : x;
 const par = !isP && x.pj!==null ? prById(x.pj) : null;
 $('ct').value = isP ? p.n : x.t;
 $('crumb').textContent = isP ? 'Проект' : (par ? par.n : 'Без проекта');
 const all = isP?inPj(S.cur.id):null, op = isP?openIn(S.cur.id):null;
 $('cm').textContent = isP ? ((all.length-op.length)+' из '+all.length)
   : (x.done ? 'выполнена' : (fmtDue(x.due) || 'без срока'));
 /* правая круглая кнопка шапки: у задачи галочка, у проекта число открытых шагов */
 const h = $('hctl');
 h.className = 'rnd44 topbtn press' + (!isP && x.done ? ' on' : '');
 h.innerHTML = isP ? '<span class="num">'+op.length+'</span>' : Ic(P.check,18);
 h.setAttribute('aria-label', isP ? ('Закрыть следующий шаг, осталось '+op.length) : (x.done?'Снять отметку':'Выполнить'));
 h.onclick = () => {
  if(isP){ const o = openIn(p.id); if(!o.length) return; tap(25); pop(); mark(o[0],1); save(); paint(1); return; }
  if(x.done){ mark(x,0); save(); paint(1); tap(10); return; }
  tap(25); pop(); mark(x,1); save(); paint(1);
 };

 thread.innerHTML = '<div class="spacer"></div>';
 const add = html => { const d=document.createElement('div'); d.innerHTML=html; const el=d.firstElementChild; thread.appendChild(el); return el; };
 if(isP){
  add('<div class="lbl">Шаги</div>');
  const w = document.createElement('div'); w.className='steps'; thread.appendChild(w);
  inPj(p.id).forEach(s=>{
   const d=document.createElement('div'); d.className='step'+(s.done?' off':'');
   d.innerHTML = '<div class="cell"><div class="t1"'+(s.done?' style="text-decoration:line-through;color:var(--muted)"':'')+'>'+esc(s.t)+'</div></div>'+
     '<button class="ck press'+(s.done?' on':'')+'" aria-label="'+(s.done?'Снять отметку':'Выполнить')+': '+esc(s.t)+'">'+Ic(P.check,18)+'</button>';
   const b = d.querySelector('.ck');
   b.onclick = () => {
    if(s.done){ mark(s,0); save(); paint(1); tap(10); return; }
    tap(25); pop(); b.classList.add('on'); burst(d);
    setTimeout(()=>{ mark(s,1); save(); paint(1); }, RM?0:140);
   };
   w.appendChild(d);
  });
 }
 add('<div class="bub">'+(isP?'Что мешает?':'Как продвинулись?')+'</div>');
 add('<div class="ans"><span class="tx">'+esc(isP?p.why:x.a)+'</span></div>');
 /* Вложения задачи: файла на сервере нет, он живёт только в браузере,
    поэтому скачивание идёт через Blob. */
 (it.files||[]).forEach((f,i)=>add('<div class="card" data-file="'+i+'">'+Ic(P.file,18)+
   '<div class="cell"><div class="f1">'+esc(f.name)+'</div><div class="f2">'+esc(fmtSize(f.size))+' · скачать</div></div></div>'));
 let typeEl = null;
 it.chat.forEach(m=>{
  if(m.u!==undefined){
   if(m.att)for(const a of m.att)add('<div class="att">'+Ic(P.clip,12)+'<span>'+esc(a.name)+'</span><span class="as">'+esc(fmtSize(a.size))+'</span></div>');
   add('<div class="bub">'+esc(m.u)+'</div>'); return;
  }
  if(m.typing){ add('<div class="ans typing"><i></i><i></i><i></i></div>'); return; }
  if(m.err){ add('<div class="ans err"><span class="tx">'+esc(m.a)+'</span></div>'); return; }
  if(m.a){
   const el = add('<div class="ans"><span class="tx">'+(m===typeNext?'':md(m.a))+'</span></div>');
   if(m===typeNext) typeEl = el;
  }
  /* Карточка каждого изменения с отменой. Стек живёт до перезагрузки: после неё
     записи о вызове нет, и кнопка просто не рисуется — так честнее, чем мёртвая. */
  if(m.cards)for(const c of m.cards){
   const u=undos[c.undo];
   add('<div class="act">'+Ic(P.list,12)+'<span class="al">'+esc(c.label)+'</span>'+
    (u&&u.live?'<button class="au" type="button" data-undo="'+c.undo+'">Отменить</button>'
      :u?'<span class="au off">отменено</span>':'')+'</div>');
  }
 });
 if(typeEl){ const txt = typeNext.a; typeNext = null; typeInto(typeEl, txt); }
 else parkSpider();
 thread.querySelectorAll('[data-undo]').forEach(b=>b.onclick=()=>undoAct(+b.dataset.undo));
 thread.querySelectorAll('[data-file]').forEach(el=>el.onclick=()=>fileOpen(it,(it.files||[])[+el.dataset.file]));
 thread.scrollTop = thread.scrollHeight;
}

/* ---------- оболочка ---------- */
let view = 'list', open, back;

/* Контейнер приложения равен видимой области: высота из visualViewport.height, смещение
   сверху из visualViewport.offsetTop. Обе величины — чистая функция текущего состояния,
   без накопленных дельт: пропущенное обновление не оставляет следа.

   Событиям iOS доверять нельзя. При скрытии клавиатуры может не прийти ни одного, и
   раскладка застревает в поднятом состоянии, накладывая блоки друг на друга. Поэтому
   пока идёт ввод ИЛИ пока клавиатура на экране — сверяемся с фактическими размерами
   каждый кадр. Второе условие важнее первого: цикл не остановится, пока высота не
   вернулась. Вне ввода — обычные события. */
let vvTrace = [];
function trackVH(){
 const vv = window.visualViewport;
 let lastH = null, until = 0, ticking = false;
 const apply = src => {
  const h = vv ? vv.height : innerHeight, t = vv ? vv.offsetTop : 0;
  root.setProperty('--vh', h + 'px');
  root.setProperty('--vvtop', t + 'px');
  if(lastH !== null && h !== lastH){
   /* Высота изменилась — держим низ содержимого на месте, иначе список и лента съезжают
      вверх на высоту клавиатуры. Чтение offsetHeight заставляет браузер применить новую
      высоту: без него scrollTop обрежется по старым размерам. */
   const d = lastH - h;
   document.querySelectorAll('.scroll').forEach(b=>{ void b.offsetHeight; b.scrollTop += d; });
   if(vvTrace.length > 7) vvTrace.shift();
   vvTrace.push(src + Math.round(h));
  }
  lastH = h;
 };
 const typing = () => { const a = document.activeElement; return !!a && a.tagName === 'INPUT'; };
 const pump = () => {
  apply('f');
  if(typing() || kbUp() || Date.now() < until) requestAnimationFrame(pump); else ticking = false;
 };
 const watch = ms => {
  until = Math.max(until, Date.now() + ms);
  if(!ticking){ ticking = true; requestAnimationFrame(pump); }
 };
 apply('i');
 if(vv){
  vv.addEventListener('resize', ()=>{ apply('r'); watch(800); });
  vv.addEventListener('scroll', ()=>apply('s'));
 }
 addEventListener('resize', ()=>apply('w'));
 addEventListener('orientationchange', ()=>setTimeout(()=>apply('o'), 150));
 /* Фокус и его потеря — моменты, когда клавиатура появляется и убирается */
 addEventListener('focusin', e=>{ if(e.target && e.target.tagName === 'INPUT') watch(1500); });
 addEventListener('focusout', e=>{ if(e.target && e.target.tagName === 'INPUT') watch(1500); });
}
/* Безопасные зоны меряем один раз пробником: env() в calc() из JS не прочитать */
function trackSafe(){
 const probe = document.createElement('div');
 probe.style.cssText = 'position:fixed;top:0;left:0;width:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
 document.body.appendChild(probe);
 const cs = getComputedStyle(probe);
 root.setProperty('--safe-t', cs.paddingTop || '0px');
 root.setProperty('--safe-b', cs.paddingBottom || '0px');
 probe.remove();
}
function shellTwo(){
 open = () => { paint(1); };
 back = () => {};
}
/* index.html: экраны лежат друг над другом, переход — CSS по классу .on */
function shellNav(){
 const show = v => { view=v; $('scr-detail').classList.toggle('on', v==='detail'); $('scr-list').classList.toggle('away', v==='detail'); };
 open = () => { tap(8); show('detail'); paintDetail(); setTimeout(()=>{ thread.scrollTop = thread.scrollHeight; },320); };
 back = () => { show('list'); paint(1); };
 $('back').onclick = () => { tap(8); back(); };
 document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !priPop && view==='detail') back(); });
 armSwipeBack();
}
/* Свайп вправо от левого края экрана чата возвращает к списку, как на iPhone */
const EDGE = 28;
function armSwipeBack(){
 const d = $('scr-detail'), l = $('scr-list');
 let x0=null, y0=0, dx=0, w=1, t0=0, drag=false;
 d.addEventListener('touchstart', e => {
  if(view!=='detail' || e.touches.length!==1 || priPop) return;
  const t=e.touches[0]; if(t.clientX>EDGE) return;
  x0=t.clientX; y0=t.clientY; dx=0; drag=false; t0=Date.now(); w=d.offsetWidth||innerWidth;
 }, {passive:true});
 d.addEventListener('touchmove', e => {
  if(x0===null) return;
  const t=e.touches[0]; dx=t.clientX-x0; const dy=Math.abs(t.clientY-y0);
  if(!drag){
   if(dy>10 && dy>Math.abs(dx)){ x0=null; return; }   /* это прокрутка ленты */
   if(dx<=10) return;
   drag=true; d.style.transition='none'; l.style.transition='none';
  }
  const p=Math.max(0,Math.min(1,dx/w));
  d.style.transform='translateX('+(p*100).toFixed(2)+'%)';
  l.style.transform='translateX('+(-22*(1-p)).toFixed(2)+'%)';
 }, {passive:true});
 const end = () => {
  if(x0===null) return; x0=null;
  if(!drag) return; drag=false;
  const fast = dx/Math.max(1,Date.now()-t0) > .5;
  /* переход включаем обратно и в том же кадре снимаем инлайн — CSS доигрывает от текущего положения */
  d.style.transition=''; l.style.transition='';
  if(dx>w/3 || fast) back();
  d.style.transform=''; l.style.transform='';
 };
 d.addEventListener('touchend', end); d.addEventListener('touchcancel', end);
}

/* ---------- старт ---------- */
S = load();
list = $('list'); scroll = $('scroll'); thread = $('thread');
trackSafe(); trackVH();
(MODE==='nav' ? shellNav : shellTwo)();

/* верхняя кнопка — сортировка по приоритету, включена с самого начала */
$('sort').innerHTML = Ic(P.sort,18);
function drawSort(){
 $('sort').classList.toggle('on', sorted);
 $('sort').setAttribute('aria-label', sorted ? 'Вернуть порядок добавления' : 'Сортировать по приоритету');
}
drawSort();
$('sort').onclick = () => {
 sorted = !sorted;
 drawSort();
 tap(8); paint(1);
 if(!RM) [...list.children].forEach((r,i)=>{ r.classList.add('land'); setTimeout(()=>r.classList.remove('land'),210+i*10); });
};
/* правый нижний кружок переключает входящие ↔ выполненные */
function drawFind(){
 const f = $('find');
 f.classList.toggle('on', !!S.showDone);
 f.innerHTML = Ic(S.showDone ? P.list : P.check, 18);
 f.setAttribute('aria-label', S.showDone ? 'Входящие' : 'Выполненные');
}
$('find').onclick = () => { tap(8); S.showDone = S.showDone?0:1; save(); paint(); };
$('undo').onclick = () => { if(undoBuf){ mark(undoBuf.x,0); save(); paint(1); tap(8); } hideToast(); };

/* большая кнопка с пауком разворачивается в строку ввода */
$('shutter').innerHTML = SPIDER_JUMP;
$('clip').innerHTML = Ic(P.clip,18);
$('clip2').innerHTML = Ic(P.clip,18);
$('back').innerHTML = Ic(P.back,20);

const nt = $('nt'), addBtn = $('add'), msg = $('msg'), sendBtn = $('send'), ct = $('ct');
const composer = $('composer');
const mini = () => composer.classList.contains('mini');
function drawAdd(){
 const has = nt.value.trim().length > 0;
 addBtn.className = 'rnd press ' + (has ? 'go' : 'solid');
 addBtn.innerHTML = Ic(has ? P.up : P.mic, 18);
}
function drawSend(){
 const has = msg.value.trim().length > 0;
 sendBtn.className = 'rnd press ' + (has ? 'go' : 'solid');
 sendBtn.innerHTML = Ic(has ? P.up : P.mic, 18);
}
let ntFocused = false;
function openComposer(){
 if(!mini()) return;
 ntFocused = false;
 /* фокус ставим синхронно, прямо в обработчике нажатия: iOS открывает клавиатуру только внутри жеста */
 composer.classList.remove('mini'); scroll.classList.add('tight');
 $('dock').classList.add('hide');
 $('veil-b').style.height = 'calc(68px + 40px + var(--pend, 0px) + var(--safe-b))';
 drawAdd(); toBottom();          /* .tight меняет запас снизу — доводим список до строки ввода */
 /* Отклик — до фокуса: последним действием жеста должен остаться именно focus(),
    иначе iOS не считает поле активным и клавиатуру не открывает. */
 tap(8);
 try{ nt.focus({preventScroll:true}); }catch(e){ nt.focus(); }
}
function closeComposer(){
 if(mini()) return;
 nt.value=''; nt.blur(); composer.classList.add('mini');
 ntPick = []; paintNtPick();          /* отменили задачу — отменили и её вложения */
 $('dock').classList.remove('hide'); scroll.classList.remove('tight');
 $('veil-b').style.height = '';
 drawAdd(); toBottom();
}
/* Открываем по click, не по touchend: iOS отдаёт клавиатуру только из «настоящего» жеста,
   а touchend с preventDefault она за такой не считает */
$('shutter').onclick = () => openComposer();
nt.oninput = drawAdd;
/* Строку закрывает уход фокуса — но только если фокус вообще был получен: внутри
   превью-iframe и на части устройств focus() не проходит, и строка схлопывалась сразу,
   не успев показаться. Тогда она просто остаётся открытой, и в неё можно ткнуть пальцем. */
nt.addEventListener('focus', ()=>{ ntFocused = true; });
/* picking: пока открыт системный выбор файла, поле теряет фокус — закрывать строку нельзя,
   иначе выбранное вложение вернётся в уже свёрнутый композер */
nt.addEventListener('blur', ()=>setTimeout(()=>{ if(ntFocused && !picking && !nt.value.trim()) closeComposer(); },120));
/* касание по списку мимо строки — тоже закрывает */
scroll.addEventListener('pointerdown', ()=>{ if(!mini() && !nt.value.trim()) closeComposer(); });
nt.addEventListener('keydown', e=>{ if(e.key==='Escape') closeComposer(); });
function submitTask(){
 const v = nt.value.trim();
 if(!v){ addBtn.classList.add('rec'); tap(12); setTimeout(()=>{ addBtn.classList.remove('rec'); drawAdd(); },900); return; }
 const t = addTask(v);
 nt.value=''; S.showDone=0; save(); paint();
 fly(list.querySelector('.row[data-id="'+t.id+'"]'));
 tap(14);
 closeComposer();
 shortenTitle(t);                    /* пишут как придётся — в списке имя в два слова */
 /* Файлы, выбранные скрепкой до того, как задача появилась: цепляем к ней и открываем чат —
    иначе вложение осталось бы висеть и уехало бы в первую попавшуюся переписку. */
 if(ntPick.length){
  const files = ntPick; ntPick = []; paintNtPick();
  take(files, t, 0).then(()=>{ S.cur = {k:'t', id:t.id}; save(); paintPending(); open(); });
 }
}
addBtn.onclick = submitTask;
nt.onkeydown = e => { if(e.key==='Enter'){ e.preventDefault(); submitTask(); } };

/* чат: отправка не уводит фокус из поля, иначе iOS прячет клавиатуру */
sendBtn.addEventListener('pointerdown', e => e.preventDefault());
msg.oninput = drawSend;
function sendMsg(){
 const v = msg.value.trim();
 if(!v){ sendBtn.classList.add('rec'); tap(12); setTimeout(()=>{ sendBtn.classList.remove('rec'); drawSend(); },900); return; }
 msg.value=''; drawSend(); tap(14); ask(v);
 if(document.activeElement !== msg){ try{ msg.focus({preventScroll:true}); }catch(e){} }
}
sendBtn.onclick = sendMsg;
msg.onkeydown = e => { if(e.key==='Enter'){ e.preventDefault(); sendMsg(); } };
/* клавиатура уходит по касанию или прокрутке самой переписки */
thread.addEventListener('pointerdown', ()=>{ if(document.activeElement===msg) msg.blur(); });
thread.addEventListener('touchmove', ()=>{ if(document.activeElement===msg) msg.blur(); }, {passive:true});

/* ---------- скрепка ----------
   В чате вложение уходит с ближайшим сообщением. У строки новой задачи цели ещё нет:
   файлы ждут, пока задача появится. Оба поля делят один <input type=file>: диалог
   выбора всё равно один на экран, а два скрытых поля пришлось бы держать в синхроне. */
const pick = $('pick');
let pickTo = 'chat', ntPick = [], picking = false;

function drawChips(box, arr, redraw){
 if(!box) return;
 box.hidden = !arr.length;
 box.innerHTML = arr.map((a,i)=>'<span class="att">'+Ic(P.clip,12)+'<span>'+esc(a.name)+'</span>'+
   '<span class="as">'+esc(fmtSize(a.size))+'</span>'+
   '<button class="ax" type="button" data-drop="'+i+'" aria-label="Убрать вложение">'+Ic(P.x,12)+'</button></span>').join('');
 box.querySelectorAll('[data-drop]').forEach(b=>b.onclick=()=>{ arr.splice(+b.dataset.drop,1); redraw(); tap(8); });
 /* Чипы переносятся по строкам, поэтому высоту не угадать формулой — меряем и кладём
    в --pend своего экрана: на неё поднимается дно прокрутки, иначе лента лезет под чипы */
 const scr = box.closest('.screen');
 if(scr) scr.style.setProperty('--pend', box.offsetHeight ? (box.offsetHeight + 8) + 'px' : '0px');
}
function paintPending(){ drawChips($('pend2'), pending, paintPending); }
function paintNtPick(){ drawChips($('pend'), ntPick, paintNtPick); }

/* Картинка ужимается, PDF проверяется по размеру, тело уезжает в IndexedDB —
   в переписке остаётся только имя с размером. */
async function take(files, item, isP){
 for(const f of files){
  const a = await attach(f, item, isP);
  if(a.err){ item.chat.push({err:1, a:a.err}); save(); paint(1); }
  else pending.push(a);
 }
}
if(pick){
 const askFiles = to => { pickTo = to; picking = true; pick.value = ''; pick.click(); };
 /* отмену системного диалога событием не поймать — снимаем флаг по возврату фокуса в окно */
 addEventListener('focus', () => setTimeout(()=>{ picking = false; }, 400));
 $('clip').onclick  = () => askFiles('nt');
 $('clip2').onclick = () => askFiles('chat');
 pick.onchange = async () => {
  const files = [...pick.files].slice(0,4);
  pick.value = ''; picking = false;
  if(!files.length) return;
  if(pickTo === 'nt'){ ntPick.push(...files); paintNtPick(); return; }
  const item = curItem();
  if(!item) return;
  await take(files, item, S.cur.k==='p');
  paintPending();
 };
}

/* вход в настройки — таблетка с логотипом: памяти, расходу и корзине больше негде быть */
$('brand').onclick = () => { tap(8); settings(); };

/* название задачи правится прямо в шапке */
ct.oninput = () => { const it=curItem(); if(!it) return; if(S.cur.k==='p') it.n=ct.value; else it.t=ct.value; save(); };
ct.onblur = () => { const it=curItem(); if(!it) return; const v=ct.value.trim();
 if(!v){ if(S.cur.k==='p') it.n='Без названия'; else it.t='Без названия'; } save(); paint(1); };
ct.onkeydown = e => { if(e.key==='Enter'){ e.preventDefault(); ct.blur(); } };

drawAdd(); drawSend();
addEventListener('keydown', e=>{ if(e.key==='Escape' && priPop) closePri(); });
addEventListener('pagehide', flush); addEventListener('beforeunload', flush);
paint();
/* Шрифт приезжает после первой отрисовки и меняет высоту строк — доводим список ещё раз */
addEventListener('load', toBottom);
try{ document.fonts && document.fonts.ready.then(toBottom); }catch(e){}

/* Поверхность для тестов и консоли: S переприсваивается при загрузке, поэтому отдаётся геттером */
window.app = {get S(){return S}, kindOf, byId, prById, inPj, openIn, curItem, addTask, addStep, makeProject,
  delItem, fmtDue, flush, paint, openPri, closePri, showToast, hideToast,
  chatPayload, chatMessages, md, runTool, undoAct, byShort, shortId, fileBody, fmtSize, attach,
  settings, squeeze, spendUsd, addSpend, shortenTitle, tidyTitle,
  get pending(){return pending}, get undos(){return undos}, get undoNote(){return undoNote}};

/* Открыть страницу с ?debug — поверх интерфейса появятся живые числа: размеры окна и
   видимой области, смещение, значения переменных и положение контейнера с композером.
   Нужно потому, что поведение клавиатуры воспроизводится только на настоящем телефоне:
   в браузере на компьютере её нет вовсе. Снимок экрана с открытой клавиатурой заменяет
   целый круг догадок — дважды словесные описания приводили к половинчатым правкам. */
if(/(^|[?&])debug(=|&|$)/.test(location.search)){
 const box = document.createElement('pre');
 box.style.cssText = 'position:fixed;left:0;top:0;z-index:9999;margin:0;padding:4px 6px;'+
  'font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;color:#0f0;'+
  'background:rgba(0,0,0,.82);white-space:pre;pointer-events:none;max-width:100%';
 document.body.appendChild(box);
 const n = v => Math.round(v);
 const rect = e => { const b = e && e.getBoundingClientRect(); return b ? n(b.top)+'..'+n(b.bottom)+' ('+n(b.height)+')' : 'нет'; };
 const tick = () => {
  const vv = window.visualViewport, cs = getComputedStyle(document.documentElement);
  box.textContent =
   'окно     '+n(innerWidth)+'x'+n(innerHeight)+'   scrollY '+n(scrollY)+'\n'+
   'видимая  h '+(vv?n(vv.height):'—')+'  top '+(vv?n(vv.offsetTop):'—')+'  scale '+(vv?vv.scale:'—')+'\n'+
   'перем.   --vh '+(cs.getPropertyValue('--vh').trim()||'—')+'  --vvtop '+(cs.getPropertyValue('--vvtop').trim()||'—')+'\n'+
   'phone    '+rect(document.querySelector('.phone'))+'\n'+
   'композер '+rect(document.querySelector('#scr-detail.on .composer') || $('composer'))+'\n'+
   'фокус    '+((document.activeElement && document.activeElement.id) || 'нет')+'\n'+
   'трасса   '+vvTrace.join(' ');
  requestAnimationFrame(tick);
 };
 tick();
}

/* Обновление установленного приложения: новый service worker забирает управление сам,
   но страница уже исполняет старый код — перезагружаем её. Только если управляющий
   воркер уже был: при первой установке controllerchange тоже срабатывает. */
if('serviceWorker' in navigator){
 const had = !!navigator.serviceWorker.controller; let done = false;
 navigator.serviceWorker.addEventListener('controllerchange', ()=>{ if(!had||done) return; done = true; location.reload(); });
 addEventListener('load', ()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
