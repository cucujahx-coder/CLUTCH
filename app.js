/* CLUTCH — движок. Общий для index.html (экран списка + экран чата) и panels.html (две панели рядом).
   Оболочка задаёт MODE ('nav' | 'two') до подключения этого файла.
   Раскладка «как в камере»: сверху таблетка логотипа и кнопка сортировки, снизу большая кнопка
   с пауком, под ней переключатель «выполненные», строка ввода вырастает из кнопки. */
const MODE = window.MODE || 'two';
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
/* Кривые движения — те же, что токены --e-* в app.css, по роли: out — появление и остановка,
   in — уход, move — перемещение, over — прибытие с перелётом. Тест сверяет с CSS. */
const EASE = {out:'cubic-bezier(.2,.8,.2,1)', in:'cubic-bezier(.4,0,.8,.4)', move:'cubic-bezier(.32,.72,0,1)', over:'cubic-bezier(.34,1.56,.64,1)'};
const LAG = 40;   /* мс между элементами группы — доводка, как --lag в CSS */
/* Смена иконки на кнопке — не подмена, а движение: новая выскакивает с перелётом. Меняем
   только если иконка действительно другая (ключ в data-ic), иначе кнопка дёргалась бы на
   каждой букве ввода; первую отрисовку не анимируем. */
function swapIcon(btn, key, html){
 if(!btn || btn.dataset.ic === key) return;
 const first = !btn.dataset.ic;
 btn.dataset.ic = key; btn.innerHTML = html;
 const ic = btn.firstElementChild;
 if(first || RM || !ic || !ic.animate) return;
 ic.animate([{transform:'scale(.5)',opacity:0},{transform:'scale(1.18)',opacity:1,offset:.6},{transform:'none'}],{duration:220,easing:EASE.over});
}
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
   /* тело залито целиком (в отличие от паучка-курсора, у которого только обод); глаза поверх */
   [165.12,69],[187.64,69],[210.16,69],
   [153.86,88.5],[198.9,88.5],[243.94,88.5],
   [142.6,108],[165.12,108],[187.64,108],[210.16,108],[232.68,108],
   [153.86,127.5],[176.38,127.5],[198.9,127.5],[221.42,127.5],[243.94,127.5],
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
  globe:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M3 12h18M12 3c-3 3.5-3 14.5 0 18M12 3c3 3.5 3 14.5 0 18',
  sort:'M4 7h13M4 12h9M4 17h5M17 13v7M17 20l3-3M17 20l-3-3',
  x:'M6 6l12 12M18 6L6 18',
  trash:'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  file:'M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z',
  edit:'M4 20h4L18 10l-4-4L4 16v4M13 7l4 4'
};
const Ic = (d,s=16) => '<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="'+d+'"/></svg>';


/* ---------- тактильность ----------
   Вес действия: 6 перелистнуть, 8 открыть, 14 отправить или вызвать меню, 25 выполнить.
   Android умеет vibrate; на iPhone щёлкает скрытый переключатель (Safari 17.4+),
   для тяжёлых значений он повторяется через 45 и 90 мс. */
let hapt = null, hapting = false;   /* hapting: идёт щелчок, фокус на миг уходит в переключатель — это не потеря фокуса */
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
   hapting=true;
   try{hapt.click()}catch(e){}
   if(a&&a!==document.body&&a!==document.activeElement&&a.focus){
    try{a.focus({preventScroll:true})}catch(e){try{a.focus()}catch(e2){}}
   }
   /* Фокуса не было (строка ввода уже закрыта, а тяжёлая отдача повторяется через 45 и 90 мс) —
      переключатель забирал его себе насовсем, и логика клавиатуры видела «поле в фокусе» */
   const now=document.activeElement;
   if(now&&now!==a&&now.closest&&now.closest('.hapt')){ try{now.blur()}catch(e){} }
   hapting=false;
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
             {boxShadow:'inset 0 0 0 999px rgba(255,255,255,0)'}],{duration:ms||220,easing:EASE.out});
}
/* Когда клавиатура была видна в последний раз: первое касание по экрану её убирает, и к моменту
   показа плашки поле уже без фокуса — помним момент, а не только состояние. */
let kbLast = 0, kbAtTap = 0;
addEventListener('focusout', e => { if(e.target.matches && e.target.matches('.inp')) kbLast = Date.now(); });
/* Засветка — только на настоящее нажатие. По одному pointerdown её давать нельзя: при прокрутке
   палец ложится на строку, и она вспыхивала, хотя никто её не нажимал. Как в списках iOS:
   подсветка ждёт 90 мс и появляется, если палец не сдвинулся; сдвиг больше 8 px или начало
   прокрутки (pointercancel) её отменяют, а быстрый тап вспыхивает сразу на отпускании. */
let flashT = 0, flashEl = null, fx0 = 0, fy0 = 0;
addEventListener('pointerdown', e => {
 kbAtTap = kbOpen() ? Date.now() : kbLast;
 clearTimeout(flashT);
 flashEl = e.target.closest && e.target.closest('.press,.row,.step'); fx0 = e.clientX; fy0 = e.clientY;
 if(flashEl) flashT = setTimeout(()=>{ if(flashEl) elflash(flashEl); flashEl = null; }, 90);
}, true);
addEventListener('pointermove', e => {
 if(flashEl && Math.hypot(e.clientX - fx0, e.clientY - fy0) > 8){ clearTimeout(flashT); flashEl = null; }
}, true);
addEventListener('pointerup', () => { if(flashEl){ clearTimeout(flashT); elflash(flashEl); flashEl = null; } }, true);
addEventListener('pointercancel', () => { clearTimeout(flashT); flashEl = null; }, true);
/* Строка ввода вспыхивает в момент активации: вся капсула белеет разом, держит четверть
   времени и гаснет — резко, как фотовспышка. Полоса, проезжавшая 460 мс, была мягкой. */
function sweep(el){
 if(!el || RM || !el.animate) return;
 const w = document.createElement('div'); w.className='sweep'; w.innerHTML='<i></i>';
 el.appendChild(w);
 const a = w.firstChild.animate([{opacity:.95,offset:0},{opacity:.95,offset:.25},{opacity:0,offset:1}],
   {duration:180,easing:EASE.in});   /* гаснет с ускорением — уход */
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
  /* дуга: призрак уходит вверх и чуть вправо, не по прямой */
  ghost.animate([{filter:'brightness(1) blur(0)',opacity:1,transform:'translate(0,0) scale(1)'},
                 {filter:'brightness(2) blur(3px)',opacity:.6,transform:'translate(5px,-9px) scale(1.02)',offset:.5},
                 {filter:'brightness(3) blur(7px)',opacity:0,transform:'translate(8px,-12px) scale(1.04)'}],
    {duration:130,easing:EASE.out,fill:'forwards'});
  setTimeout(()=>ghost.remove(),150);
 } else {
  row.animate([{boxShadow:'inset 0 0 0 999px rgba(255,255,255,.92)'},
               {boxShadow:'inset 0 0 0 999px rgba(255,255,255,.92)',offset:.18},
               {boxShadow:'inset 0 0 0 999px rgba(255,255,255,0)'}],{duration:180,easing:EASE.out});
 }
 const fl = document.createElement('div'); fl.className='rflash';
 fl.style.cssText += 'left:'+(cx-90)+'px;top:'+(cy-90)+'px';
 host.appendChild(fl);
 fl.animate([{opacity:.95,transform:'scale(.4)'},{opacity:0,transform:'scale(1)'}],{duration:200,easing:EASE.out});
 setTimeout(()=>fl.remove(),210);

 const rf = document.createElement('div'); rf.className='ringfx';
 rf.style.cssText += 'left:'+(cx-22)+'px;top:'+(cy-22)+'px;width:44px;height:44px';
 host.appendChild(rf);
 rf.animate([{opacity:.5,transform:'scale(.6)'},{opacity:0,transform:'scale(2.6)'}],{duration:390,easing:EASE.out});
 setTimeout(()=>rf.remove(),400);

 const cols=['#E50006','#FF4A44','#E0E0E0','#FF8A86'];
 for(let i=0;i<10;i++){
  const a=(i/10)*Math.PI*2+Math.random(), d=34+Math.random()*40, s=document.createElement('span');
  s.className='spark'; s.style.cssText += 'left:'+cx+'px;top:'+cy+'px;background:'+cols[i%4];
  host.appendChild(s);
  /* дуги: искра летит по параболе — на полпути выше прямой, к концу проседает под тяжестью */
  const x=Math.cos(a)*d, y=Math.sin(a)*d;
  s.animate([{transform:'translate(0,0) scale(1)',opacity:1},
             {transform:'translate('+(x*.6).toFixed(1)+'px,'+(y*.6-10).toFixed(1)+'px) scale(.8)',opacity:.9,offset:.5},
             {transform:'translate('+x.toFixed(1)+'px,'+(y+14).toFixed(1)+'px) scale(0)',opacity:0}],
    {duration:180+Math.random()*40,easing:EASE.out,fill:'forwards'});
  setTimeout(()=>s.remove(),230);
 }
}
/* Появление новой строки: всплывает снизу и пружинит */
function fly(row){
 if(!row || RM || !row.animate) return;
 /* дуга: новая строка заходит снизу и чуть слева, выравниваясь к месту; садится с перелётом */
 row.animate([{opacity:0,transform:'translate(-8px,16px) scale(.98)'},
              {opacity:1,transform:'translate(2px,4px) scale(1)',offset:.6},
              {opacity:1,transform:'none'}],
   {duration:420,easing:EASE.over});
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
  if(body!=null&&typeof body!=='string')return {out:'файл двоичный ('+(f.mime||'')+'), текстом не читается; он остался в среде исполнения'};
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
/* Версия сборки. Должна совпадать с V в sw.js — тест это проверяет. Видна в настройках:
   без неё «приехало обновление или нет» выясняется только гаданием, а на телефоне
   установленное приложение умеет держаться за старый код дольше, чем кажется. */
const APP_V='tasks-v79';
const API='https://clutch.gloomnotgloom.com';

/* Переписка в формате блоков Anthropic. Ход модели с вызовами и ответ клиента с
   результатами — два соседних сообщения; строка ошибки и «печатает» не уходят. */
/* Сколько сообщений держим целиком и после какой длины сжимаем старое */
const SUM_AFTER=24, SUM_KEEP=10;

/* Расход считаем в деньгах, а не в токенах: у чтения кэша, записи кэша, входа и
   выхода разные цены. Цены Sonnet 5 за миллион токенов; поменяется модель — поменять тут. */
const PRICE={in:2,out:10,cr:0.2,cw:2.5};
const PRICE_WS=0.01;              /* поиск в сети — за запрос, не за токены */
function addSpend(u){
 if(!u)return;
 const sp=S.spend||(S.spend={in:0,out:0,cr:0,cw:0,at:Date.now()});
 sp.in+=u.input_tokens||0; sp.out+=u.output_tokens||0;
 sp.cr+=u.cache_read_input_tokens||0; sp.cw+=u.cache_creation_input_tokens||0;
 sp.ws=(sp.ws||0)+((u.server_tool_use&&u.server_tool_use.web_search_requests)||0);
 save();
}
const spendUsd=sp=>!sp?0:(sp.in*PRICE.in+sp.out*PRICE.out+sp.cr*PRICE.cr+sp.cw*PRICE.cw)/1e6+(sp.ws||0)*PRICE_WS;

/* Ход с поиском в сети хранится блоками как есть (raw) и в историю возвращается целиком —
   иначе модель забывает, что искала. Но результаты объёмные, поэтому целиком уходят только
   последние WEB_TURNS ходов; у более старых блоки стираются, остаётся текст. */
const WEB_TURNS=3;

async function chatMessages(item){
 const out=[];
 const from=item.sumTo||0;
 const answers=item.chat.filter(m=>m.a!==undefined&&!m.err&&!m.typing);
 const rawFrom=answers.length>WEB_TURNS?answers[answers.length-WEB_TURNS]:null;
 let rawOk=!rawFrom;
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
  if(m===rawFrom)rawOk=true;
  if(m.raw&&!rawOk){delete m.raw; save();}
  const blocks=[];
  if(m.raw)blocks.push(...m.raw);
  else{
   if(m.a)blocks.push({type:'text',text:m.a});
   if(m.tu)for(const t of m.tu)blocks.push({type:'tool_use',id:t.id,name:t.name,input:t.input||{}});
  }
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
  ...(profile?{profile}:{}),...(item.sum?{summary:item.sum}:{}),
  ...(item.cid?{container:item.cid}:{})};   /* среда исполнения задачи: в ней уже собранные файлы */
}

/* Один проход потока. Текст отдаётся кусками через onDelta — лента дорисовывается
   на ходу, а не появляется целиком в конце. Вызовы инструментов копятся и отдаются
   в конце: их аргументы приходят кусками и собираются воркером. */
/* Подпись под точками, пока модель ищет: что именно ищет или какую страницу читает */
function srvLabel(d){
 const inp=(d&&d.input)||{};
 if(d.error)return /web/.test(d.name||'')?'Поиск не удался':'Не вышло, пробую иначе';
 if(d.name==='web_search')return 'Ищу в сети'+(inp.query?': '+inp.query:'');
 if(d.name==='web_fetch'){let h=''; try{h=new URL(inp.url).host.replace(/^www\./,'')}catch(e){} return 'Читаю'+(h?' '+h:' страницу');}
 if(d.name==='bash_code_execution')return 'Выполняю код';
 if(d.name==='text_editor_code_execution')return 'Пишу файл';
 return '';
}

/* Файлы, собранные в среде исполнения: у клиента только их идентификаторы, тело
   скачивается через воркер (ключ там) и ложится во вложения задачи как обычный файл —
   в IndexedDB, Blob как есть. Одноимённый файл заменяется: модель правит свой же документ. */
async function pullFiles(item,isP,files){
 const owner=shortId(item,isP); item.files=item.files||[];
 for(const f of files.slice(0,10)){
  const name=String(f.name||'файл').replace(/[\/\\]/g,'_');
  try{
   const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({file:f.id})});
   if(!r.ok)throw new Error('HTTP '+r.status);
   const blob=await r.blob();
   await bodyPut(owner,name,blob);
   const i=item.files.findIndex(x=>x.name===name);
   if(i<0&&item.files.length>=MAX_FILES)item.files.shift();
   const e={name,mime:blob.type||f.mime||'application/octet-stream',size:blob.size||f.size||0,owner};
   if(i>=0)item.files[i]=e; else item.files.push(e);
  }catch(e){item.chat.push({err:1,a:'Не удалось забрать файл '+name+': '+((e&&e.message)||e)});}
 }
}

async function streamOnce(body,onDelta,onStatus){
 const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 if(!r.ok){
  let why=''; try{why=(await r.json()).error||''}catch(e){}
  const err=new Error('HTTP '+r.status+(why?' · '+why:''));
  err.retry=r.status===529||r.status>=500;
  throw err;
 }
 if(!r.body)throw new Error('поток недоступен');
 const rd=r.body.getReader(), dec=new TextDecoder();
 let buf='', out='', got=false, raw=null, src=null, cid=null, files=null; const tools=[];
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
   else if(ev==='srv'){const l=srvLabel(d); if(l&&onStatus)onStatus(l);}
   else if(ev==='done'){addSpend(d&&d.usage); if(d&&Array.isArray(d.content))raw=d.content; if(d&&Array.isArray(d.src))src=d.src;
    if(d&&typeof d.container==='string')cid=d.container; if(d&&Array.isArray(d.files))files=d.files;}
   else if(ev==='error'){
    const e=new Error(d.error||'ошибка потока');
    e.retry=!got;                       /* повторяем только если ничего не успели показать */
    throw e;
   }
  }
 }
 if(!got){const e=new Error('пустой ответ'); e.retry=true; throw e;}
 return {text:out.trim(),tools,raw,src,cid,files};
}

async function askOnce(item,isP,onDelta,onStatus){
 const body=await chatPayload(item,isP);
 let pause=600;
 for(let n=0;n<3;n++){
  try{return await streamOnce(body,onDelta,onStatus);}
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
  ph.typing=0; ph.a=await stubReply((last&&last.u)||'',item,isP);
  typeNext=ph;                       /* без сервера ответ печатается по буквам, паук бежит следом */
  paint(); save(); return;
 }
 const key=curKey();
 let acts=0;
 for(let round=0;round<6;round++){
  const ph={typing:1}; item.chat.push(ph); paint(); save();
  let res;
  const last=()=>{ if(curKey()!==key)return null; const el=thread.lastElementChild; return el&&el.classList.contains('ans')?el:null; };
  try{
   res=await askOnce(item,isP,t=>{
    ph.typing=0; ph.a=t;
    const el=last(); if(!el)return;
    el.classList.remove('typing');
    const st=el.querySelector('.st'); if(st)st.remove();
    /* Пишем внутрь .tx, чтобы не ломать разметку элемента ленты */
    const tx=el.querySelector('.tx');
    if(tx)tx.innerHTML=md(t); else el.innerHTML='<span class="tx">'+md(t)+'</span>';
    spiderRun(el);
    thread.scrollTop=thread.scrollHeight;
   },label=>{
    /* Модель ушла в сеть: подпись под точками или под уже написанным текстом.
       Живёт до следующего куска текста — в состояние не пишется. */
    const el=last(); if(!el)return;
    let st=el.querySelector('.st');
    if(!st){st=document.createElement('span'); st.className='st'; el.appendChild(st);}
    st.textContent=label;
    thread.scrollTop=thread.scrollHeight;
   });
  }catch(e){
   ph.typing=0; ph.err=1; ph.a=(e&&e.message)||String(e); paint(); save(); return;
  }
  ph.typing=0; ph.a=res.text;
  if(res.raw)ph.raw=res.raw;
  if(res.src&&res.src.length)ph.src=res.src;
  if(res.cid)item.cid=res.cid;
  if(res.files&&res.files.length)await pullFiles(item,isP,res.files);
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
  /* уход — движением: лист уезжает вниз с ускорением, подложка гаснет; при reduced-motion сразу */
  const hideSheet=()=>{
   if(setEl.hidden)return;
   if(RM){setEl.hidden=true;return;}
   setEl.classList.add('out'); setTimeout(()=>{setEl.hidden=true; setEl.classList.remove('out');},200);
  };
  setEl.querySelector('.sheet-back').onclick=hideSheet;
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&setEl&&!setEl.hidden)hideSheet()});
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

 h+='<div class="sh">Версия</div>';
 h+='<div class="si" data-ver="1"><span>'+esc(APP_V)+'</span><span class="as">обновление приезжает само</span></div>';
 body.innerHTML=h;
 [...body.children].forEach((el,i)=>el.style.setProperty('--i',i));   /* доводка: разделы друг за другом */

 body.querySelectorAll('[data-forget]').forEach(b=>b.onclick=()=>{S.mem.splice(+b.dataset.forget,1); save(); settings();});
 body.querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{delete trash[+b.dataset.restore].o.del; save(); paint(); settings();});
 /* Пять нажатий на версию включают отладочный слой в установленном приложении, где
    ?debug в адрес не дописать; ещё пять — выключают. */
 body.querySelectorAll('[data-ver]').forEach(v=>{
  let n=0;
  v.onclick=()=>{ if(++n<5)return; try{localStorage.setItem('debug', DEBUG?'0':'1')}catch(e){} location.reload(); };
 });
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
/* Порядок один и всегда: срочное выше, новое — в самом низу, у большой кнопки. Переключателя
   сортировки нет — владелец убрал, его место в шапке заняли «Выполненные».
   Три капсулы в доке выбирают, что показывать (S.tab): FLOW — всё открытое, PROCESS — только
   проекты, FOCUS — только то, чему проставлен приоритет. Порядок внутри любого вида один и тот же. */
const TABS = {
 flow:    {all:()=>true,          empty:'Входящие пусты. Нажми большую кнопку.'},
 process: {all:i=>i.isP,          empty:'Проектов нет. Задачу разбивают на шаги из чата.'},
 focus:   {all:i=>(i.pri||0)>0,   empty:'Ничего срочного. Приоритет — долгим нажатием по задаче.'}
};
const curTab = () => TABS[S.tab] ? S.tab : 'flow';
let undoBuf = null, toastTimer = null, suppressRow = false, priPop = null;
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
 /* У задачи только название, подзаголовка нет. У проекта заголовок — ближайший открытый шаг,
    мелким снизу — название самого проекта: в списке видно, что делать, а не как называется папка. */
 const title = isP ? ((next && next.t) || x.n) : x.t;
 /* Строка в одну линию: подзаголовка нет ни у задач, ни у проектов (владелец снял).
    Имя проекта остаётся в title и для диктора — глазами его видно в шапке чата. */
 if(isP) r.title = x.n;
 r.innerHTML = '<div class="cell"><span class="sr-only">'+KIND[r.dataset.kind]+': </span>'+
   '<div class="t1">'+esc(title)+'</div>'+(isP?'<span class="sr-only"> — '+esc(x.n)+'</span>':'')+'</div>' +
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
  S.ts.filter(x=>!x.done && !x.del && x.pj===null).forEach(x=>items.push({x,isP:0,pri:x.pri||0,id:x.id}));
  S.pr.filter(p=>!p.del).forEach(p=>{
   const all = inPj(p.id), op = openIn(p.id);
   if(!op.length) return;
   items.push({x:p, isP:1, next:op[0], left:op.length, pri:p.pri||0, id:p.id});
  });
  /* Новое — всегда в самом низу, у большой кнопки: задачи и проекты идут одним рядом по
     времени добавления (id общий), а не задачи-потом-проекты. Сверху приоритетные: чем
     срочнее, тем выше; внутри одного приоритета — по времени. Порядок один на все виды. */
  items.sort((a,b)=>(b.pri - a.pri) || (a.id - b.id));
  const tab = TABS[curTab()];
  const shown = items.filter(tab.all);
  shown.forEach(i=>list.appendChild(rowEl(i.x, i.isP, i.next, i.left)));
  if(!shown.length) list.innerHTML = '<div class="empty">'+esc(tab.empty)+'</div>';
 }
 drawFind(); drawTabs();
 if(MODE==='two' || view==='detail') paintDetail();   /* закрытый экран чата не перерисовываем */
 if(!keep) toBottom();
}
/* Резинка для короткого списка. iOS даёт отдачу только области, которой есть куда
   прокручиваться; короткий список у неё стоит намертво, и ни переполнение на пиксель,
   ни overscroll-behavior этого не меняют — проверено на устройстве. Поэтому пока
   содержимое помещается, тянем область за пальцем сами с затуханием, как у UIScrollView,
   и отпускаем с возвратом. Длинный список сюда не попадает — он пружинит нативно. */
/* Большая кнопка привязана к резинке списка: пока тянешь — сжимается, как под пальцем,
   отпустил — подпрыгивает. Степень сжатия — доля от PULL_FULL пикселей пути пальца.
   Геометрия считается в JS и ставится inline (сжатие) и через animate() (прыжок): calc()
   внутри scale() и var() в @keyframes Safari на телефоне не отрисовал — кнопка стояла. */
const PULL_FULL = 90, JUMP_MS = 280, OVER_FULL = 60;
function armRubber(el){
 let y0 = null, live = false, snapT = 0, pulled = 0, touching = false, cool = false;
 const short = () => el.scrollHeight - el.clientHeight <= 1;
 /* Длинный список пружинит нативно, и iOS во время пружины отдаёт scrollTop за пределами
    допустимого: у перевёрнутого контейнера диапазон [-(max), 0], у обычного [0, max].
    Перелёт за край — та же тяга: кнопка сжимается на его долю, а на отпускании прыгает. */
 const over = () => { const max = el.scrollHeight - el.clientHeight, st = el.scrollTop;
   const rev = getComputedStyle(el).flexDirection === 'column-reverse';
   return Math.max((rev ? -max : 0) - st, st - (rev ? 0 : max), 0); };
 const btn = () => el.closest('#scr-list') && composer.classList.contains('mini') ? composer : null;
 const sw = () => composer.querySelector('.shutter .sw');
 const squash = p => ({b:'translateY(-75px) scale(' + (1 + .06*p).toFixed(3) + ',' + (1 - .1*p).toFixed(3) + ')',
                       s:'scale(' + (1 + .14*p).toFixed(3) + ',' + (1 - .2*p).toFixed(3) + ')'});
 const pull = p => { const b = btn(); if(!b) return;
   pulled = p; const q = squash(p);
   b.classList.add('pull'); b.style.transform = q.b; const s = sw(); if(s) s.style.transform = q.s; };
 const jump = () => { const b = composer; if(!b.classList.contains('pull')) return;
   const p = pulled, q = squash(p), s = sw(); pulled = 0;
   b.classList.remove('pull'); b.style.transform = ''; if(s) s.style.transform = '';
   if(RM || !b.classList.contains('mini') || !b.animate) return;
   /* прыжок резкий: взлёт за треть времени по --e-out (быстрый старт), высота по тяге,
      растяжение в верхней точке, посадка с перелётом по --e-over. Владелец просил резче:
      было 420 мс с пиком посередине. */
   b.animate([{transform:q.b, easing:EASE.out},{transform:'translateY(' + (-75 - 36*p).toFixed(1) + 'px) scale(.94,1.1)',offset:.3},{transform:'translateY(-75px)'}],
     {duration:JUMP_MS, easing:EASE.over});
   if(s && s.animate) s.animate([{transform:q.s, easing:EASE.out},{transform:'scale(.9,1.16)',offset:.3},{transform:'none'}],{duration:JUMP_MS, easing:EASE.over}); };
 el.addEventListener('scroll', () => {
  if(short()) return;
  const o = over();
  if(o > 0){ if(!cool) pull(Math.min(1, o / OVER_FULL)); }
  else { cool = false; if(pulled && !touching) jump(); }   /* пружина без пальца (бросок в край) — прыжок, когда вернулась */
 }, {passive:true});
 /* затухание как у iOS: чем дальше тянешь, тем медленнее едет, предел — чуть больше половины */
 const damp = d => { const h = el.clientHeight || 1, c = 0.55, a = Math.abs(d);
   return Math.sign(d) * h * c * (1 - 1 / (a * c / h + 1)); };
 el.addEventListener('touchstart', e => {
  touching = true;
  if(e.touches.length !== 1 || !short()){ y0 = null; return; }
  y0 = e.touches[0].clientY; live = false;
 }, {passive:true});
 el.addEventListener('touchmove', e => {
  if(y0 === null) return;
  const dy = e.touches[0].clientY - y0;
  if(!live){ if(Math.abs(dy) < 6) return; live = true; clearTimeout(snapT); el.classList.add('dragging'); el.classList.remove('rubber'); }
  el.style.transform = 'translateY(' + damp(dy).toFixed(1) + 'px)';
  pull(Math.min(1, Math.abs(dy) / PULL_FULL));   /* по пути пальца, не по затухшему сдвигу */
 }, {passive:true});
 const release = () => {
  touching = false;
  /* Нативная пружина: отпустили за краем — прыжок сразу, а обратный ход пружины
     (scrollTop ещё за краем) сжимать заново нельзя, иначе прыгнет дважды */
  if(pulled && !short()){ jump(); cool = over() > 0; }
  if(y0 === null) return;
  y0 = null;
  if(!live) return;
  live = false;
  el.classList.remove('dragging'); if(!RM) el.classList.add('rubber');
  el.style.transform = '';
  snapT = setTimeout(()=>el.classList.remove('rubber'), 450);
  jump();
 };
 el.addEventListener('touchend', release);
 el.addEventListener('touchcancel', release);
}

/* Список прижат к строке ввода: самое свежее ближе к пальцу, добавил задачу — остальные
   ушли вверх. Список перевёрнут (column-reverse), и его низ — ноль прокрутки: в покое он
   у кнопки сам. toBottom остаётся для случая, когда пользователь ушёл вверх, а список
   перерисовался: scrollTop=scrollHeight в перевёрнутом контейнере обрезается до нуля,
   то есть до низа, — и это работает в обе стороны реализации. Чтение offsetHeight
   заставляет браузер применить новые размеры до правки прокрутки. */
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
 /* сжатие и растяжение: кружок плющится под нажатием, растягивается и садится */
 if(!RM && ck && ck.animate) ck.animate([{transform:'scale(1)'},{transform:'scale(1.28,.8)',offset:.3},
   {transform:'scale(.9,1.16)',offset:.65},{transform:'scale(1)'}],{duration:320,easing:EASE.over});
 undoBuf = {x:op[0]};
 setTimeout(()=>{ mark(op[0],1); save(); paint(1); showToast('Шаг закрыт · ' + op[0].t); }, RM?0:140);
}

/* ---------- плашка о выполненном ----------
   Вырастает из кружка переключателя справа внизу и через 4 секунды сворачивается обратно.
   При открытой клавиатуре не показывается: ей негде встать, она легла бы на строку ввода. */
/* Клавиатура на экране — признак физический: видимая область ниже базы (наибольшей высоты,
   что видели без фокуса) больше чем на 150 px, или ниже окна. От фокуса он не зависит
   намеренно: в момент focusout фокуса уже нет, а клавиатура ещё на экране и только едет
   вниз — признак, завязанный на фокус, гас раньше времени, обратная догадка не срабатывала,
   и контейнер оставался ужатым и сдвинутым при закрытой клавиатуре. innerHeight в Safari
   равен видимой области, поэтому на iPhone работает именно сравнение с базой. Фокус нужен
   только чтобы не обновлять базу под клавиатурой; поворот (другая ширина) сбрасывает её.
   150, а не 80: полоса инструментов Safari меняет высоту до ~100, клавиатура — от 250. */
let kbBaseH = 0, kbBaseW = 0;
/* Клавиатуру зовёт только текстовое поле: переключатель отдачи тоже <input>, но нет */
const isText = el => !!el && (el.tagName === 'TEXTAREA' ||
 (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|reset|range|file|color|hidden)$/.test(el.type)));
function kbUp(){
 const vv = window.visualViewport;
 if(!vv) return false;
 if(innerWidth !== kbBaseW){ kbBaseW = innerWidth; kbBaseH = 0; }
 const h = vv.height, a = document.activeElement;
 const focused = isText(a);
 if(!focused && h > kbBaseH) kbBaseH = h;
 return innerHeight - h > 150 || kbBaseH - h > 150;
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
 document.querySelector('.dockrow').classList.add('busy');   /* плашка встаёт ровно на место капсул */
 $('toast').classList.add('on');
 clearTimeout(toastTimer);
 toastTimer = setTimeout(hideToast, 4000);
}
function hideToast(){
 clearTimeout(toastTimer);
 $('toast').classList.remove('on');
 setTimeout(()=>document.querySelector('.dockrow').classList.remove('busy'), 220);
}

/* ---------- приоритет ----------
   Долгое нажатие по строке открывает на её месте капсулу: «нет» и четыре ступени, каждая своего цвета. */
const PRI = [{v:0},{v:1,c:'var(--pri1)'},{v:2,c:'var(--pri2)'},{v:3,c:'var(--pri3)'},{v:4,c:'var(--pri4)'}];
function closePri(){
 if(!priPop) return;
 const p = priPop; priPop = null;
 if(RM || !p.el.animate){ p.back.remove(); p.el.remove(); return; }
 p.el.classList.add('out'); p.back.style.pointerEvents = 'none';   /* уходит вниз с ускорением, потом снимается */
 setTimeout(()=>{ p.back.remove(); p.el.remove(); }, 140);
}
function openPri(x, row){
 closePri();
 const host = row.closest('.screen'); if(!host) return;
 const hb = host.getBoundingClientRect(), rb = row.getBoundingClientRect();
 const back = document.createElement('div'); back.className = 'pri-back';
 const el = document.createElement('div'); el.className = 'pri';
 el.innerHTML = PRI.map(p => '<button class="press'+(Number(x.pri||0)===p.v?' on':'')+'" data-v="'+p.v+'" '+
   'aria-label="Приоритет '+(p.v||'нет')+'">'+(p.c?'<span class="dotc" style="background:'+p.c+'"></span>':'—')+'</button>').join('')+
   '<button class="press edit" data-edit="1" aria-label="Переименовать">'+Ic(P.edit,18)+'</button>';
 el.style.top = Math.max(16, Math.min(rb.top - hb.top, hb.height - 44 - 16)) + 'px';
 host.appendChild(back); host.appendChild(el);
 priPop = {el, back};
 tap(14);
 back.onclick = closePri;
 el.querySelectorAll('button[data-v]').forEach(b => b.onclick = () => {
  x.pri = Number(b.dataset.v); save(); tap(8); closePri(); paint(1);
 });
 el.querySelector('[data-edit]').onclick = () => { tap(8); closePri(); editRow(row, x); };
}
/* Правка названия прямо в строке: карандаш в капсуле долгого нажатия. Заголовок строки
   заменяется полем, Enter или уход фокуса сохраняют, Escape отменяет. У проекта правится
   имя проекта (как в шапке чата), у задачи — название. Сокращать до двух слов не надо:
   человек правит руками и знает, что пишет. Касания внутри поля не доходят до строки —
   иначе клик открывал бы чат, а долгое нажатие снова звало бы капсулу. */
function editRow(row, x){
 const isP = !!row.dataset.pj, cell = row.querySelector('.cell'); if(!cell) return;
 const was = isP ? x.n : x.t;
 cell.innerHTML = '<input class="t1 edit" type="text" aria-label="Название" autocomplete="off" enterkeyhint="done">';
 const inp = cell.querySelector('input'); inp.value = was;
 ['click','pointerdown','touchstart','keydown'].forEach(ev => inp.addEventListener(ev, e => e.stopPropagation()));
 let done = false;
 const finish = ok => {
  if(done) return; done = true;
  const v = inp.value.trim();
  if(ok && v && v !== was){ if(isP) x.n = v; else x.t = v; save(); }
  paint(1);
 };
 inp.addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); finish(true); } if(e.key === 'Escape'){ e.preventDefault(); finish(false); } });
 inp.addEventListener('blur', () => finish(true));
 try{ inp.focus({preventScroll:true}); }catch(e){ inp.focus(); }
 try{ inp.setSelectionRange(inp.value.length, inp.value.length); }catch(e){}
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
/* Паук один на всю ленту: старый снимается, новый встаёт в конец последнего ответа. Ответ
   размечен — абзацы, списки — поэтому паук ставится внутрь последнего текстового блока,
   иначе он падал бы на новую строку под абзацем, а не бежал за последней буквой. Внутрь
   кода и таблицы не лезем: там он встаёт после блока. */
const SPIDER_IN = /^(P|UL|OL|LI|H3|H4|H5)$/;
function spider(host){
 thread.querySelectorAll('.spider').forEach(o=>o.remove());
 if(RM || !host) return null;
 let at = host.querySelector('.tx') || host;
 while(at.lastElementChild && SPIDER_IN.test(at.lastElementChild.tagName)) at = at.lastElementChild;
 at.insertAdjacentHTML('beforeend', SPIDER);
 return host.querySelector('.spider');
}
/* Пока ответ идёт потоком, паук бежит за приходящим текстом; пауза дольше 160 мс — лапы
   замирают, следующий кусок снова их запускает. В конце paint() сажает его на место. */
let spIdle = null;
function spiderRun(el){
 const sp = spider(el);
 if(!sp) return;
 sp.classList.remove('idle');
 clearTimeout(spIdle);
 spIdle = setTimeout(()=>sp.classList.add('idle'), 160);
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
 swapIcon(h, isP ? 'n'+op.length : 'check', isP ? '<span class="num">'+op.length+'</span>' : Ic(P.check,18));
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
  /* Источники из сети — капсулами под ответом; в тексте модель ссылки не перечисляет */
  if(m.src&&m.src.length)add('<div class="srcs">'+m.src.filter(x=>/^https?:/i.test(x.url)).map(x=>{
   let h=''; try{h=new URL(x.url).host.replace(/^www\./,'')}catch(e){}
   return '<a class="att src press" href="'+esc(x.url)+'" target="_blank" rel="noopener">'+Ic(P.globe,12)+'<span>'+esc(x.title||h)+'</span>'+(x.title&&h?'<span class="as">'+esc(h)+'</span>':'')+'</a>';
  }).join('')+'</div>');
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
let vvTrace = [], kbH = 0;
function trackVH(){
 const vv = window.visualViewport, phone = document.querySelector('.phone');
 let lastH = null, until = 0, ticking = false, predictUntil = 0, predictH = 0, predictT = 0, easeT = 0;
 /* Раскладка предвосхищает клавиатуру, как приложение на iOS по keyboardWillShow. Высота
    клавиатуры на устройстве постоянна — помним её (kbH, по ширине окна: у поворота своя).
    При фокусе контейнер ужимается сразу, до событий iOS: поле уже над будущей клавиатурой,
    панорамировать нечего, шапка стоит. При потере фокуса разворачивается сразу же, как
    клавиатура пошла вниз, — иначе список после чата возвращался с запозданием. Догадка
    живёт до первого настоящего resize в ту же сторону или 700 мс, дальше — только факты. */
 try{ kbH = +localStorage.getItem('kbh:' + innerWidth) || 0; }catch(e){}
 /* Догадка задаёт сразу и высоту, и сдвиг. iOS при клавиатуре панорамирует экран ровно на её
    высоту — снимки показали top 413 при высоте 413, и это не зависит от режима viewport.
    Гнаться за сдвигом по факту значит опаздывать на кадры, а шапка на это время уезжает.
    Ставим конечные значения до того, как iOS начнёт анимацию: ей остаётся только проехать
    по уже готовой раскладке. resize приходит позже, чем кажется, — окно догадки 1,5 с. */
 /* Открытие — мгновенно: контейнер ужимается заранее, клавиатура приезжает под готовую
    раскладку, движется только она. Закрытие — наоборот, двигаться должен сам список, и
    делать это ему надо вместе с клавиатурой: iOS увозит её за ~250 мс, а разворот одним
    кадром ронял список на её высоту под ещё видимую клавиатуру. Поэтому на предсказанный
    разворот вешается класс .easing с переходом на те же 250 мс и снимается сразу после.
    Это не переход «на всё», который снимали раньше: тот превращал в задержку и приход
    реальных событий. Этот живёт 320 мс и только в момент, который мы сами предсказали. */
 const predict = (h, t, src) => {
  predictH = h; predictT = t; predictUntil = Date.now() + 1500;
  if(phone){
   clearTimeout(easeT);
   if(src === 'q' && !RM){ phone.classList.add('easing'); easeT = setTimeout(()=>phone.classList.remove('easing'), 320); }
   else phone.classList.remove('easing');
  }
  apply(src);
 };
 const apply = src => {
  const real = vv ? vv.height : innerHeight;
  let h = real, t = vv ? vv.offsetTop : 0;
  if(predictUntil){
   const arrived = predictH < kbBaseH ? kbUp() : !kbUp();   /* факт пришёл в ту же сторону */
   if(arrived || Date.now() > predictUntil) predictUntil = 0; else { h = predictH; t = predictT; }
  }
  root.setProperty('--vh', h + 'px');
  root.setProperty('--vvtop', t + 'px');
  /* Клавиатура на экране — индикатор «домой» под ней, отступ под него ничего не защищает,
     а строка ввода висела на 50 px выше клавиатуры. Снимаем его и ужимаем зазор до 8. */
  /* Низ живёт по той же догадке, что и высота, — иначе строка ввода едет отдельно от контейнера */
  const kb = predictUntil ? predictH < kbBaseH : kbUp();
  root.setProperty('--safe-b', kb ? '0px' : safeB);
  root.setProperty('--foot', kb ? '8px' : '16px');
  if(kbUp() && kbBaseH){ const k = kbBaseH - real; if(k > 80 && k !== kbH){ kbH = k; try{ localStorage.setItem('kbh:' + innerWidth, k); }catch(e){} } }
  if(lastH !== null && h !== lastH){
   /* Высота изменилась — держим низ содержимого на месте, иначе список и лента съезжают
      вверх на высоту клавиатуры. Чтение offsetHeight заставляет браузер применить новую
      высоту: без него scrollTop обрежется по старым размерам. */
   const d = lastH - h;
   /* У перевёрнутого (column-reverse) списка низ — это ноль прокрутки, он держится сам */
   document.querySelectorAll('.scroll').forEach(b=>{
    if(getComputedStyle(b).flexDirection === 'column-reverse') return;
    void b.offsetHeight; b.scrollTop += d;
   });
   if(vvTrace.length > 7) vvTrace.shift();
   vvTrace.push(src + Math.round(h));
  }
  lastH = h;
 };
 const typing = () => isText(document.activeElement);
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
 addEventListener('focusin', e=>{
  if(hapting || !isText(e.target)) return;   /* перескок фокуса из-за щелчка — не событие клавиатуры */
  if(kbH && kbBaseH && !kbUp()) predict(kbBaseH - kbH, kbH, 'p');   /* клавиатура придёт — ужимаемся и сдвигаемся сейчас */
  watch(1500);
 });
 addEventListener('focusout', e=>{
  if(hapting || !isText(e.target)) return;
  /* Клавиатура уйдёт — разворачиваемся сейчас. А если её и не было (фокус ушёл раньше,
     чем она поднялась), догадка ужатия снимается принудительно: иначе контейнер стоял
     ужатым и сдвинутым при закрытой клавиатуре до конца окна догадки. */
  if(kbUp() && kbBaseH) predict(kbBaseH, 0, 'q'); else { predictUntil = 0; apply('o'); }
  watch(1500);
 });
}
/* Безопасные зоны меряем один раз пробником: env() в calc() из JS не прочитать */
let safeB = '0px';   /* измеренный отступ под индикатор «домой»; trackVH обнуляет его на время клавиатуры */
function trackSafe(){
 const probe = document.createElement('div');
 probe.style.cssText = 'position:fixed;top:0;left:0;width:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
 document.body.appendChild(probe);
 const cs = getComputedStyle(probe);
 root.setProperty('--safe-t', cs.paddingTop || '0px');
 safeB = cs.paddingBottom || '0px';
 root.setProperty('--safe-b', safeB);
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
 back = () => {
  /* Сначала снять фокус: иначе клавиатура остаётся висеть над уже показанным списком */
  const a = document.activeElement; if(isText(a) && a.blur) a.blur();
  show('list'); paint(1);
 };
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

/* Три капсулы в доке: чем показан список. Выбор живёт в S — переживает перезагрузку.
   Выполненные идут поверх вида, поэтому при переключении капсулы список возвращается к ним. */
function drawTabs(){
 const t = curTab(), segs = [...document.querySelectorAll('.seg')];
 segs.forEach((b,i)=>{
  const on = !S.showDone && b.dataset.tab === t;
  b.classList.toggle('on', on);
  b.setAttribute('aria-selected', on ? 'true' : 'false');
  /* подложка одна на всех — двигаем её к активной трети, а не перекрашиваем фоны */
  if(on) b.parentElement.style.setProperty('--seg-i', i);
 });
 const row = segs[0] && segs[0].parentElement;
 if(row) row.classList.toggle('none', !!S.showDone);
}
document.querySelectorAll('.seg').forEach(b=>{
 b.onclick = () => {
  const t = b.dataset.tab;
  if(curTab() === t && !S.showDone) return;
  S.tab = t; S.showDone = 0; save(); tap(8); paint();
 };
});
/* круглая кнопка в шапке переключает входящие ↔ выполненные */
function drawFind(){
 const f = $('find');
 f.classList.toggle('on', !!S.showDone);
 swapIcon(f, S.showDone ? 'list' : 'check', Ic(S.showDone ? P.list : P.check, 18));
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
 addBtn.className = 'rnd press ' + (has ? 'go' : 'solid') + (recBtn === addBtn ? ' rec' : '');
 swapIcon(addBtn, has ? 'up' : 'mic', Ic(has ? P.up : P.mic, 18));
}
function drawSend(){
 const has = msg.value.trim().length > 0;
 sendBtn.className = 'rnd press ' + (has ? 'go' : 'solid') + (recBtn === sendBtn ? ' rec' : '');
 swapIcon(sendBtn, has ? 'up' : 'mic', Ic(has ? P.up : P.mic, 18));
}
/* Голосовой набор на кнопке-микрофоне (она показывается, пока поле пустое). Web Speech API:
   в Safari — webkitSpeechRecognition, есть с iOS 14.5. Текст подставляется в поле по мере
   распознавания, кнопка на это время красная, повторное нажатие останавливает; отправлять
   человек будет сам — так можно поправить. Где API нет, подсказываем микрофон на клавиатуре
   (он у iOS свой) и ставим фокус в поле. */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
let rec = null, recBtn = null;
function dictate(input, btn, redraw){
 if(rec){ try{ rec.stop(); }catch(e){} return; }
 if(!SR){
  const ph = input.placeholder; input.placeholder = 'Микрофон — на клавиатуре';
  setTimeout(()=>{ input.placeholder = ph; }, 2200);
  try{ input.focus({preventScroll:true}); }catch(e){ input.focus(); }
  return;
 }
 const r = new SR();
 r.lang = navigator.language || 'ru-RU'; r.interimResults = true; r.continuous = false;
 const base = input.value.trim();
 r.onresult = e => {
  let t = ''; for(const res of e.results) t += res[0].transcript;
  input.value = (base ? base + ' ' : '') + t.trim(); redraw();
 };
 r.onend = () => { rec = null; recBtn = null; redraw(); };
 r.onerror = () => { if(rec === r) r.onend(); };
 rec = r; recBtn = btn; redraw(); tap(8);
 try{ r.start(); }catch(e){ r.onend(); }
}
let ntFocused = false;
/* Морф стартует с места кнопки. Фокус ниже ужмёт контейнер под клавиатуру мгновенно, и
   капсула вместе с ним подпрыгнула бы на её высоту ещё до начала движения. Поэтому до
   фокуса ставим капсуле сдвиг «свёрнутое положение + высота клавиатуры» и фиксируем его
   reflow-ом как точку старта: после ужатия это ровно то место, где стояла кнопка. Снятие
   сдвига в конце запускает переход из этой точки в строку над клавиатурой. Фокус ставится
   синхронно, прямо в обработчике нажатия: iOS открывает клавиатуру только внутри жеста. */
/* voice — раскрыть под голосовой набор: без фокуса и без клавиатуры. Фокус из таймера
   долгого нажатия iOS клавиатурой всё равно не ответит, а догадка ужатия под неё сработала бы
   и через 1,5 с откатилась — прыжок. Без фокуса контейнер не ужимается, значит и поправку
   на высоту клавиатуры в точку старта морфа не кладём. */
function openComposer(voice){
 if(!mini()) return;
 ntFocused = false;
 composer.style.transform = 'translateY(' + (-75 + (voice ? 0 : (kbH || 0))) + 'px)';
 void composer.offsetHeight;
 composer.classList.remove('mini'); scroll.classList.add('tight');
 $('dock').classList.add('hide');
 $('veil-b').style.height = 'calc(68px + 24px + var(--foot) + var(--pend, 0px) + var(--safe-b))';
 drawAdd(); toBottom();          /* .tight меняет запас снизу — доводим список до строки ввода */
 /* Отклик — до фокуса: последним действием жеста должен остаться именно focus(),
    иначе iOS не считает поле активным и клавиатуру не открывает. */
 if(voice){ composer.style.transform = ''; dictate(nt, addBtn, drawAdd); return; }
 tap(8);
 try{ nt.focus({preventScroll:true}); }catch(e){ nt.focus(); }
 composer.style.transform = '';
}
function closeComposer(){
 if(mini()) return;
 sweep(composer);                     /* та же вспышка, что при раскрытии: капсула гаснет и сворачивается разом */
 nt.value=''; nt.blur(); composer.classList.add('mini');
 ntPick = []; paintNtPick();          /* отменили задачу — отменили и её вложения */
 $('dock').classList.remove('hide'); scroll.classList.remove('tight');
 $('veil-b').style.height = '';
 drawAdd(); toBottom();
}
/* Открываем по click, не по touchend: iOS отдаёт клавиатуру только из «настоящего» жеста,
   а touchend с preventDefault она за такой не считает */
/* Режим голоса по удержанию паука. Круг остаётся кругом (.voice: белеет, паук перетекает в
   микрофон, дышит свечением) и молча слушает — текст копится в voiceText и не показывается.
   Запись кончилась — капсула раскрывается в строку с готовым текстом и фокусом. Кончиться
   может двумя путями: сама, по тишине (onend — фоновое событие, iOS клавиатуру из него не
   откроет: строка с текстом и стрелкой появится, клавиатура — по тапу в поле), или по тапу на
   белый круг — тогда заканчиваем сами, синхронно, внутри жеста, и клавиатура выезжает сразу;
   запоздалый onend распознавателя после этого игнорируется. Без Web Speech удержание ведёт
   в прежнюю подсказку про микрофон на клавиатуре. */
let voiceRec = null, voiceText = '';
$('shutter').insertAdjacentHTML('beforeend', '<span class="micro" aria-hidden="true">' + Ic(P.mic, 32) + '</span>');
function voiceStart(){
 if(!mini() || voiceRec) return;
 if(!SR){ openComposer(true); return; }
 const r = new SR();
 r.lang = navigator.language || 'ru-RU'; r.interimResults = true; r.continuous = false;
 voiceText = '';
 r.onresult = e => { let t = ''; for(const res of e.results) t += res[0].transcript; voiceText = t.trim(); };
 r.onend = () => { if(voiceRec === r) voiceEnd(); };
 r.onerror = r.onend;
 voiceRec = r; composer.classList.add('voice'); $('shutter').setAttribute('aria-label', 'Остановить запись');
 try{ r.start(); }catch(e){ voiceEnd(); }
}
function voiceEnd(){
 const r = voiceRec; if(!r) return;
 voiceRec = null; composer.classList.remove('voice'); $('shutter').setAttribute('aria-label', 'Новая задача');
 try{ r.onend = null; r.onerror = null; r.stop(); }catch(e){}
 const text = voiceText; voiceText = '';
 if(!text) return;                       /* ничего не сказали — круг остаётся кругом */
 nt.value = text; openComposer(); drawAdd();
}
/* Удержание 500 мс (как у строк) — режим голоса; сдвиг больше 10 px — не удержание. После
   удержания придёт обычный click — его гасим. Тап по белому кругу во время записи — стоп. */
(function armHold(){
 const b = $('shutter'); let t = 0, x0 = 0, y0 = 0, held = false;
 b.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; held = false; clearTimeout(t);
  if(voiceRec) return;
  t = setTimeout(()=>{ held = true; tap(14); voiceStart(); }, 500); });
 const off = () => clearTimeout(t);
 b.addEventListener('pointermove', e => { if(Math.hypot(e.clientX - x0, e.clientY - y0) > 10) off(); });
 ['pointerup','pointercancel','pointerleave'].forEach(ev => b.addEventListener(ev, off));
 b.addEventListener('contextmenu', e => e.preventDefault());   /* iOS не должна показывать своё меню */
 b.onclick = () => {
  if(held){ held = false; return; }
  if(voiceRec){ tap(8); voiceEnd(); return; }
  openComposer();
 };
})();
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
 if(!v){ dictate(nt, addBtn, drawAdd); return; }   /* поле пустое — кнопка это микрофон */
 const t = addTask(v);
 nt.value=''; S.showDone=0; save(); paint();
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

/* Фокус в поле — только программный, с preventScroll. Тап по полю iOS обрабатывает сама:
   ставит фокус и «показывает» поле — панорамирует экран своей анимацией, которую мы не
   контролируем, и шапка чата улетала и возвращалась. Программный focus() из того же жеста
   клавиатуру открывает, а показывать ничего не пытается — так работает строка новой задачи,
   у неё шапка стоит. Перехватываем только первое касание: у поля в фокусе тап ставит каретку. */
function armFocus(el){
 if(!el) return;
 el.addEventListener('pointerdown', e => {
  if(document.activeElement === el) return;
  e.preventDefault();
  try{ el.focus({preventScroll:true}); }catch(err){ el.focus(); }
 });
}
armFocus(msg); armFocus(nt); armFocus(ct);
/* чат: отправка не уводит фокус из поля, иначе iOS прячет клавиатуру */
sendBtn.addEventListener('pointerdown', e => e.preventDefault());
msg.oninput = drawSend;
function sendMsg(){
 const v = msg.value.trim();
 if(!v){ dictate(msg, sendBtn, drawSend); return; }
 msg.value=''; drawSend(); tap(14); ask(v);
 if(document.activeElement !== msg){ try{ msg.focus({preventScroll:true}); }catch(e){} }
}
sendBtn.onclick = sendMsg;
msg.onkeydown = e => { if(e.key==='Enter'){ e.preventDefault(); sendMsg(); } };
/* Клавиатура в чате остаётся, пока идёт переписка: прокрутка ленты её не трогает. Раньше
   фокус снимался по началу касания — любая попытка прокрутить сворачивала клавиатуру.
   Убирают её касание без движения (click, у протяжки его нет) и сильная протяжка вниз
   (>90 px), когда лента уже в самом верху или палец начал у самой клавиатуры, — как
   interactive dismiss в iOS. */
thread.addEventListener('click', ()=>{ if(document.activeElement===msg) msg.blur(); });
let ty0 = null, tTop = 0;
thread.addEventListener('touchstart', e=>{ if(e.touches.length!==1){ ty0=null; return; } ty0=e.touches[0].clientY; tTop=thread.scrollTop; }, {passive:true});
thread.addEventListener('touchmove', e=>{
 if(ty0===null || document.activeElement!==msg) return;
 const dy = e.touches[0].clientY - ty0;
 const nearKb = ty0 > thread.getBoundingClientRect().bottom - 120;
 if(dy > 90 && (tTop <= 0 || nearKb)){ msg.blur(); ty0=null; }
}, {passive:true});

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
 /* новый чип всплывает; при удалении соседей остальные не дёргаются */
 if(arr.length > +(box.dataset.n || 0) && box.lastElementChild) box.lastElementChild.classList.add('rise');
 box.dataset.n = arr.length;
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
armRubber(scroll); armRubber(thread);
paint();
/* Шрифт приезжает после первой отрисовки и меняет высоту строк — доводим список ещё раз.
   pageshow — возврат к вкладке из кэша назад-вперёд, там раскладка тоже может быть старой */
addEventListener('load', toBottom);
addEventListener('pageshow', toBottom);
try{ document.fonts && document.fonts.ready.then(toBottom); }catch(e){}

/* Поверхность для тестов и консоли: S переприсваивается при загрузке, поэтому отдаётся геттером */
window.app = {get S(){return S}, kindOf, byId, prById, inPj, openIn, curItem, addTask, addStep, makeProject,
  delItem, fmtDue, flush, paint, openPri, closePri, showToast, hideToast,
  chatPayload, chatMessages, md, runTool, undoAct, byShort, shortId, fileBody, fmtSize, attach,
  settings, squeeze, spendUsd, addSpend, shortenTitle, tidyTitle, srvLabel, pullFiles,
  get pending(){return pending}, get undos(){return undos}, get undoNote(){return undoNote}};

/* Открыть страницу с ?debug — поверх интерфейса появятся живые числа: размеры окна и
   видимой области, смещение, значения переменных и положение контейнера с композером.
   Нужно потому, что поведение клавиатуры воспроизводится только на настоящем телефоне:
   в браузере на компьютере её нет вовсе. Снимок экрана с открытой клавиатурой заменяет
   целый круг догадок — дважды словесные описания приводили к половинчатым правкам. */
let DEBUG = /(^|[?&])debug(=|&|$)/.test(location.search);
try{ DEBUG = DEBUG || localStorage.getItem('debug') === '1'; }catch(e){}
if(DEBUG){
 /* Слой живёт внутри .phone, а не на body: контейнер при клавиатуре уезжает на смещение
    панорамирования, и слой на body оставался за краем — ровно в тот момент, когда нужен. */
 const box = document.createElement('pre');
 box.style.cssText = 'position:absolute;left:0;top:var(--safe-t,0px);z-index:9999;margin:0;padding:4px 6px;'+
  'font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;color:#0f0;'+
  'background:rgba(0,0,0,.82);white-space:pre;pointer-events:none;max-width:100%';
 (document.querySelector('.phone') || document.body).appendChild(box);
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
   'фокус    '+((document.activeElement && document.activeElement.id) || 'нет')+'   клавиатура '+(kbUp()?'да':'нет')+'  база '+n(kbBaseH)+'  высота '+n(kbH)+'\n'+
   'низ      --safe-b '+(cs.getPropertyValue('--safe-b').trim()||'—')+'  --foot '+(cs.getPropertyValue('--foot').trim()||'—')+'\n'+
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
