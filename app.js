/* Задачи — движок. Общий для index.html (два экрана: задачи и чат) и panels.html (две панели рядом).
   Оболочка задаёт MODE ('nav' | 'two') до подключения этого файла. */
const MODE = window.MODE || 'two';

/* ---------- icons (пиксельные, 8×8) ----------
   Каждая иконка — 8 строк по 8 символов: # закрашено, . пусто. I() собирает из них SVG:
   подряд идущие пиксели строки сливаются в один <rect>, shape-rendering="crispEdges" не даёт размыть края.
   Размер подгоняется под плотность экрана: пиксель иконки — целое число физических пикселей
   (на iPhone ×3 иконка 12 px выходит 13⅓ px = 5 точек на пиксель, на Retina ×2 — ровно 12 px). */
const P={
 'plus':'........|...##...|...##...|.######.|.######.|...##...|...##...|........',
 'arrow-right':'........|....#...|....##..|#######.|#######.|....##..|....#...|........',
 'chevron-left':'........|....##..|...##...|..##....|..##....|...##...|....##..|........',
 'folder':'........|###.....|#######.|#......#|#......#|#......#|########|........',
 'corner-down-right':'.#......|.#......|.#...#..|.#...##.|.#######|.....##.|.....#..|........',
 'inbox':'........|########|#......#|#......#|###..###|#..##..#|########|........',
 'refresh':'..####.#|.#....##|#....###|#.......|.......#|###....#|##....#.|#.####..',
 'alert-triangle':'...##...|...##...|..#..#..|..#..#..|.#.##.#.|.#....#.|#..##..#|########',
 'list-check':'........|##.#####|........|##.#####|........|##.#####|........|........',
 'calendar':'.#....#.|########|#......#|#.#.#..#|#......#|#.#.#.##|#......#|########',
 'trash':'...##...|########|.#....#.|.#.##.#.|.#.##.#.|.#.##.#.|.#....#.|..####..',
 'file-text':'#####...|#...##..|#....##.|#.###.#.|#.....#.|#.###.#.|#.....#.|#######.'
};
const iconPx=s=>{const d=window.devicePixelRatio||1;return +(Math.max(1,Math.round(s*d/8))*8/d).toFixed(3);};
/* фактический размер иконки 12 (на iPhone 13⅓) — в CSS: по нему знак «>» в строках центрируется под иконкой шапки */
document.documentElement.style.setProperty('--hd-ic',iconPx(12)+'px');
const I=(n,s,c)=>{
 const z=iconPx(s); let r='';
 P[n].split('|').forEach((row,y)=>{for(let x=0;x<8;){if(row[x]!=='#'){x++;continue;}let w=0;while(row[x+w]==='#')w++;r+='<rect x="'+x+'" y="'+y+'" width="'+w+'" height="1"/>';x+=w;}});
 return '<svg class="ic px" width="'+z+'" height="'+z+'" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true"'+(c?' style="color:var(--'+c+')"':'')+'>'+r+'</svg>';
};
const esc=t=>String(t).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

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
let S={seq:1,ts:[],pr:[],showDone:0,cur:null};
let saveT;
function save(){clearTimeout(saveT);saveT=setTimeout(flush,120)}
function flush(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
function load(){
 try{const v=localStorage.getItem(KEY);if(v){const p=JSON.parse(v);if(p&&Array.isArray(p.ts))return p}}catch(e){}
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
 const st={seq:1,ts:[],pr:[],showDone:0,cur:null};
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
 ].forEach(x=>st.ts.push(Object.assign({id:st.seq++,doneAt:null,chat:[]},x)));
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
/* маркер слева от названия — знак «>» тем же пиксельным шрифтом, одинаковый для всех типов */
const kindIcon=()=>'<span class="ki" aria-hidden="true"></span>';   // сам знак — в CSS (.ki::before), чтобы не попадал в текст названия

/* ---------- выборки ---------- */
const byId=i=>S.ts.find(x=>x.id===i);
const prById=i=>S.pr.find(p=>p.id===i);
const inPj=p=>S.ts.filter(x=>x.pj===p);
const openIn=p=>S.ts.filter(x=>x.pj===p&&!x.done);
const curItem=()=>S.cur&&(S.cur.k==='p'?prById(S.cur.id):byId(S.cur.id));

/* ---------- анимации ---------- */
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
/* Кривые движения, те же значения — токены --ease-* в app.css.
   bounce — перелёт и возврат, для появления; out — плавное торможение; in — разгон перед уходом */
const EASE={bounce:'cubic-bezier(.34,1.56,.64,1)',out:'cubic-bezier(.22,1,.36,1)',in:'cubic-bezier(.55,0,.75,.3)'};
/* Обёртка над Web Animations: при reduced motion и там, где animate нет (jsdom), ничего не делает */
const anim=(el,kf,o)=>(!RM&&el&&el.animate)?el.animate(kf,o):null;
/* Появление с отскоком: чуть снизу и меньше, перелёт через конечный размер и возврат */
function popIn(el,i){
 if(!el)return;
 anim(el,[{opacity:0,transform:'translateY(10px) scale(.94)'},{opacity:1,transform:'none'}],
  {duration:480,delay:(i||0)*40,easing:EASE.bounce,fill:'backwards'});
}
function parts(host,cx,cy){
 if(RM||!host.animate)return;
 for(let i=0;i<14;i++){const a=(i/14)*Math.PI*2,d=28+Math.random()*28,s=document.createElement('span');
  s.style.cssText='position:absolute; left:'+cx+'px; top:'+cy+'px; width:5px; height:5px; margin:-2.5px 0 0 -2.5px; border-radius:50%; pointer-events:none; background:var(--text-'+(i%2?'accent':'success')+');';
  host.appendChild(s);
  s.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:'translate('+(Math.cos(a)*d).toFixed(1)+'px,'+(Math.sin(a)*d).toFixed(1)+'px) scale(0)',opacity:0}],{duration:120,easing:EASE.out,fill:'forwards'});}
}
/* Выполнение — по очереди и почти мгновенно (всё меньше 0,1 с): тряска текста 32 мс со свечением → белая вспышка строки →
   строка исчезает за 32 мс. Звук — сразу при нажатии. Тайминги в одном месте: */
const SNAP='cubic-bezier(.8,0,1,1)', T_SHAKE=32, T_GONE=48, T_COLLAPSE=32, T_FLASH=80;
function zap(el){
 if(RM||!el||!el.animate)return;
 el.classList.add('zap');
 el.animate([
  /* 2 рывка по кадру (~16 мс); размах 6 px, чтобы глаз успел заметить */
  {transform:'translate(-6px,1px)'},{transform:'translate(6px,-1px)'},
  {transform:'translate(0,0)'}
 ],{duration:T_SHAKE,easing:'steps(1,end)'});
 setTimeout(()=>el.classList.remove('zap'),T_GONE+T_COLLAPSE);
}
function boomRow(row,cb){
 if(RM||!row||!row.animate){cb();return;}
 const h=row.offsetHeight;
 row.style.overflow='hidden'; row.style.pointerEvents='none';
 setTimeout(()=>row.animate([{height:h+'px',opacity:1},{height:'0px',opacity:0}],{duration:T_COLLAPSE,easing:SNAP,fill:'forwards'}),T_GONE);
 setTimeout(cb,T_GONE+T_COLLAPSE+10);
}
function boomSpot(el,cb){
 if(RM||!el.animate){cb();return;}
 el.style.pointerEvents='none';
 parts(el,el.offsetWidth/2,el.offsetHeight/2);
 const c=el.firstChild;
 /* Удар: кружок раздувается и сразу возвращается */
 if(c)c.animate([{transform:'scale(1.4)'},{transform:'scale(1)'}],{duration:60,easing:EASE.out});
 setTimeout(cb,60);
}
/* Звук петарды синтезируется на месте (Web Audio), файла нет: короткий шум с резким спадом,
   низкий «бум» и пара искр-щелчков в хвосте. Контекст создаётся при первом нажатии — иначе iOS его не пустит */
let AC=null;
function bangSound(){
 const C=window.AudioContext||window.webkitAudioContext; if(!C)return;
 try{
  AC=AC||new C(); if(AC.state==='suspended')AC.resume();
  const t=AC.currentTime, sr=AC.sampleRate, n=Math.floor(sr*.3), buf=AC.createBuffer(1,n,sr), d=buf.getChannelData(0);
  for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.exp(-i/sr*30);
  for(let j=0;j<5;j++){const o=Math.floor(sr*(.04+Math.random()*.22)); for(let i=0;i<80&&o+i<n;i++)d[o+i]+=(Math.random()*2-1)*.6*Math.exp(-i/14);}
  const out=AC.createDynamicsCompressor(); out.connect(AC.destination);
  const src=AC.createBufferSource(), hp=AC.createBiquadFilter(), g=AC.createGain();
  src.buffer=buf; hp.type='highpass'; hp.frequency.value=250; g.gain.value=.9;
  src.connect(hp); hp.connect(g); g.connect(out); src.start(t);
  const osc=AC.createOscillator(), og=AC.createGain();
  osc.frequency.setValueAtTime(170,t); osc.frequency.exponentialRampToValueAtTime(40,t+.12);
  og.gain.setValueAtTime(1,t); og.gain.exponentialRampToValueAtTime(.001,t+.16);
  osc.connect(og); og.connect(out); osc.start(t); osc.stop(t+.18);
 }catch(e){}
}
/* Белая вспышка только у выполняемой задачи: фон её строки (или шапки чата, если нажали кружок в шапке)
   на 20 мс белый и сразу гаснет (начинается после тряски, строка к этому моменту ещё на месте). Фон, а не накладка сверху — чтобы трясущийся светящийся текст было видно.
   При reduced motion не мигаем, звук остаётся */
function flash(el){
 const t=!RM&&el&&el.closest&&(el.closest('.row')||el.closest('.hd')); if(!t||!t.animate)return;
 const bg=getComputedStyle(t).backgroundColor||'transparent';
 t.animate([{backgroundColor:'#fff'},{backgroundColor:'#fff',offset:.25,easing:EASE.out},{backgroundColor:bg}],{duration:T_FLASH});
}
/* Звук сразу, тряска текста сразу, вспышка — когда тряска кончилась */
function bang(el,text){bangSound(); zap(text); if(!RM)setTimeout(()=>flash(el),T_SHAKE);}
const key=go=>e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go(e);}};

/* ---------- контролы ---------- */
function mark(x,done){x.done=done?1:0;x.doneAt=done?Date.now():null}
function hit(x,row,sm,spot){
 const h=document.createElement('span');
 h.className='ck';
 h.setAttribute('role','checkbox'); h.setAttribute('aria-checked',x.done?'true':'false');
 h.setAttribute('aria-label',(x.done?'Снять отметку: ':'Выполнить: ')+x.t); h.tabIndex=0;
 h.innerHTML='<span class="dot'+(sm?' sm':'')+(x.done?' on':'')+'">'+(x.done?'✓':'')+'</span>';
 const go=e=>{e.stopPropagation();
  if(x.done){mark(x,0);paint();save();return;}
  bang(h,spot?document.getElementById('ct'):row&&row.querySelector('.cel'));
  (spot?boomSpot(h,()=>{mark(x,1);paint();save();}):boomRow(row,()=>{mark(x,1);paint();save();}));};
 h.onclick=go; h.onkeydown=key(go);
 return h;
}
function ringEl(done,total,step,row){
 const R=14,c=2*Math.PI*R,o=total?c*(1-done/total):c, g=document.createElement('span');
 g.className='ck';
 g.innerHTML='<svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="'+R+'" fill="none" stroke="var(--border-stronger)" stroke-width="2"/><circle cx="16" cy="16" r="'+R+'" fill="none" stroke="var(--text-accent)" stroke-width="2" stroke-dasharray="'+c.toFixed(1)+'" stroke-dashoffset="'+o.toFixed(1)+'" transform="rotate(-90 16 16)" stroke-linecap="round"/></svg><span class="ring">'+(total-done)+'</span>';
 if(step){
  g.setAttribute('role','checkbox'); g.setAttribute('aria-checked','false'); g.tabIndex=0;
  g.setAttribute('aria-label','Отметить шаг: '+step.t);
  const go=e=>{e.stopPropagation();
   const last=total-done===1;
   bang(g,row&&row.querySelector('.cel'));
   /* последний шаг — строка проекта уходит сразу по общему расписанию, кружок только пружинит */
   if(last&&row){boomSpot(g,()=>{}); boomRow(row,()=>{mark(step,1); save(); paint();});}
   else boomSpot(g,()=>{mark(step,1); save(); paint();});};
  g.onclick=go; g.onkeydown=key(go);
 } else {g.style.cursor='default'; g.setAttribute('role','img'); g.setAttribute('aria-label','Осталось шагов: '+(total-done));}
 return g;
}
/* Подпись под названием. gaps — показывать и то, чего нет: «без диалога» (ни одного сообщения и нет
   подписи-состояния) и «без срока». Так в основном списке у каждой строки видно, в каком она состоянии;
   у шагов в чате проекта пустоты не пишем, чтобы не шуметь. */
function sub(x,gaps){
 const noTalk=gaps&&!x.tail&&!x.n&&!(x.chat&&x.chat.length), noDue=gaps&&!x.due;
 if(!x.tail&&!x.due&&!noTalk)return '';
 const c=x.tail?(x.tail.k==='wait'?'text-warning':'text-secondary'):'text-muted';
 let h='<div class="t2">', first=false;
 if(x.tail){
  h+='<span class="s sf" style="color:var(--'+c+');">'+esc(x.tail.x)+'</span>'; first=true;
 } else if(noTalk){h+='<span class="s sf" style="color:var(--text-muted);">без диалога</span>'; first=true;}
 if(x.due)h+='<span class="s" style="color:var(--'+(overdue(x.due)&&!x.done?'text-danger':'text-muted')+');">'+(first?'· ':'')+esc(fmtDue(x.due))+'</span>';
 else if(noDue)h+='<span class="s" style="color:var(--text-muted);">'+(first?'· ':'')+'без срока</span>';
 return h+'</div>';
}
function taskRow(x,sm){
 const d=document.createElement('div'), s=S.cur.k==='t'&&S.cur.id===x.id;
 d.className='row'+(sm?' sm':''); d.tabIndex=0; d.dataset.id=x.id;
 d.setAttribute('aria-current',s?'true':'false');
 if(s)d.style.background='var(--fill-ghost-selected)';
 const b=document.createElement('div'); b.className='cel'+(sm?'':' k');
 /* в основном списке слева от названия иконка типа; у шагов внутри чата проекта её нет — там все строки шаги */
 const kd=kindOf(x); d.dataset.kind=kd;
 b.innerHTML=(sm?'':'<span class="sr-only">'+KIND[kd]+': </span>')+'<div class="t1" style="color:var(--text-'+(x.done?'muted':'primary')+');">'+(sm?'':kindIcon(kd))+
  '<span class="tt"'+(x.done?' style="text-decoration:line-through;"':'')+'>'+esc(x.t)+'</span></div>'+sub(x,!sm);
 d.appendChild(b); d.appendChild(hit(x,d,sm,0));
 const go=()=>{if(suppressRow)return; S.cur={k:'t',id:x.id};save();open();};
 d.onclick=go; d.onkeydown=key(go);
 armLongPress(d,()=>showMenu('t',x.id));
 return d;
}

/* ---------- долгое нажатие ---------- */
/* 500 мс — столько же держит iOS до своего меню. Сдвиг больше 10 px считаем
   прокруткой и отменяем. Правая кнопка мыши открывает то же меню. */
function armLongPress(el,fn){
 let t=null,x=0,y=0;
 const cancel=()=>{if(t){clearTimeout(t);t=null}};
 el.addEventListener('pointerdown',e=>{
  if(e.pointerType==='mouse'&&e.button!==0)return;
  suppressRow=false; x=e.clientX; y=e.clientY; cancel();
  t=setTimeout(()=>{t=null;suppressRow=true;fn();},500);
 });
 el.addEventListener('pointermove',e=>{if(t&&(Math.abs(e.clientX-x)>10||Math.abs(e.clientY-y)>10))cancel()});
 ['pointerup','pointercancel','pointerleave'].forEach(n=>el.addEventListener(n,cancel));
 el.addEventListener('contextmenu',e=>{e.preventDefault();cancel();suppressRow=true;fn()});
}

/* ---------- меню действий ---------- */
function menuRoot(){
 if(menuEl)return menuEl;
 menuEl=document.createElement('div');
 menuEl.className='sheet'; menuEl.hidden=true;
 menuEl.innerHTML='<div class="sheet-back"></div><div class="sheet-body" role="menu"></div>';
 /* Меню открывается ещё при нажатом пальце: следом придёт pointerup и клик
    по подложке. Первые 400 мс её нажатия игнорируем, иначе меню схлопнется. */
 menuEl.querySelector('.sheet-back').onclick=()=>{if(Date.now()-menuAt>400)closeMenu()};
 document.body.appendChild(menuEl);
 return menuEl;
}
/* Закрытие плавное: панель уезжает вниз, подложка гаснет. Если за время ухода меню
   открыли снова, таймер видит menuFor и ничего не прячет */
let menuClosing=0;
/* Анимация ухода держит конечный кадр (fill:forwards) — перед следующим показом её надо снять */
const stopAnims=(...els)=>els.forEach(e=>e&&e.getAnimations&&e.getAnimations().forEach(x=>x.cancel()));
function closeMenu(){
 menuFor=null; menuArmed=false;
 if(!menuEl||menuEl.hidden)return;
 const body=menuEl.querySelector('.sheet-body'), bk=menuEl.querySelector('.sheet-back');
 const done=()=>{menuClosing=0; menuEl.hidden=true; body.innerHTML=''; stopAnims(body,bk);};
 const a=anim(body,[{opacity:1,transform:'none'},{opacity:0,transform:'translateY(16px) scale(.97)'}],{duration:200,easing:EASE.in,fill:'forwards'});
 if(!a){done();return;}
 anim(bk,[{opacity:1},{opacity:0}],{duration:220,easing:EASE.out,fill:'forwards'});
 const my=++menuClosing;
 setTimeout(()=>{if(my===menuClosing&&!menuFor)done();},210);
}
function showMenu(kind,id){
 if(!(kind==='p'?prById(id):byId(id)))return;
 menuFor={kind,id}; menuArmed=false; menuAt=Date.now(); tapMenu();
}
function tapMenu(){
 if(!menuFor)return closeMenu();
 const {kind,id}=menuFor, isP=kind==='p', it=isP?prById(id):byId(id);
 if(!it)return closeMenu();
 const r=menuRoot(), body=r.querySelector('.sheet-body');
 const mi=(a,icon,label,val)=>'<button class="mi'+(a==='del'?' danger':'')+'" type="button" data-a="'+a+'">'+
   I(icon,16)+'<span>'+esc(label)+'</span>'+(val?'<span class="val">'+esc(val)+'</span>':'')+
   (a==='due'?'<input type="date" aria-label="Срок" value="'+(it.due||'')+'">':'')+'</button>';
 let h='<div class="sheet-title">'+esc(isP?it.n:it.t)+'</div>';
 h+=mi('due','calendar','Срок',fmtDue(it.due)||'не задан');
 if(isP)h+=mi('step','plus','Добавить шаг');
 else if(it.pj===null)h+=mi('proj','list-check','Сделать проектом');
 h+=mi('del','trash',menuArmed?'Точно удалить?':(isP?'Удалить проект':'Удалить'));
 const appear=r.hidden||menuClosing;
 if(appear){menuClosing=0; stopAnims(body,r.querySelector('.sheet-back'));}
 body.innerHTML=h; r.hidden=false;
 if(appear){
  anim(r.querySelector('.sheet-back'),[{opacity:0},{opacity:1}],{duration:240,easing:EASE.out});
  anim(body,[{opacity:0,transform:'translateY(28px) scale(.95)'},{opacity:1,transform:'none'}],{duration:520,easing:EASE.bounce});
 }
 const fresh=()=>Date.now()-menuAt>400;
 body.querySelector('input[type=date]').onchange=e=>{it.due=e.target.value||null; save(); closeMenu(); paint();};
 body.querySelectorAll('.mi').forEach(b=>{const a=b.dataset.a;
  b.onclick=()=>{
   if(!fresh())return;
   if(a==='due'){const i=body.querySelector('input[type=date]'); i.showPicker?i.showPicker():i.focus(); return;}
   if(a==='step'){S.cur={k:'p',id}; addingFor=curKey(); closeMenu(); open(); return;}
   if(a==='proj'){S.cur={k:'t',id}; closeMenu(); makeProject(); return;}
   /* Удаление в два касания: системный confirm() в standalone на iOS
      ведёт себя непредсказуемо, а промах пальцем слишком дёшев */
   if(a==='del'){
    if(!menuArmed){menuArmed=true; menuAt=Date.now(); tapMenu(); return;}
    S.cur={k:kind,id}; closeMenu(); delItem();
   }
  };
 });
}

/* ---------- действия ---------- */
function addTask(title){
 const t={id:S.seq++,t:title,due:null,pj:null,done:0,doneAt:null,tail:null,n:0,a:'Разговора ещё не было.',chat:[]};
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
 S.ts.push({id,t:title,due:null,pj:S.cur.id,done:0,doneAt:null,tail:null,n:0,a:'Разговора ещё не было.',chat:[]});
 save(); paint();
 popIn(thread.querySelector('.steps .row[data-id="'+id+'"]'));
}

/* ---------- чат ----------
   API — адрес серверной функции из worker/. Ключ Anthropic в статике держать
   нельзя: бандл публичный. Поэтому запрос уходит в воркер, а ключ и системный
   промпт живут там. Пока адрес пуст, отвечает локальная заглушка — приложение
   остаётся рабочим и без сервера. */
const API='https://clutch.gloomnotgloom.com';

/* Модели уходят данные задачи, а не готовый промпт: воркер собирает его сам */
function chatPayload(item,isP){
 const hist=item.chat
  .filter(m=>!m.typing)
  .map(m=>m.u!==undefined?{role:'user',text:m.u}:{role:'assistant',text:m.a});
 const p={kind:isP?'project':'task',title:isP?item.n:item.t,due:item.due||null,
  note:isP?item.why:item.a,messages:hist};
 if(isP)p.steps=inPj(item.id).map(x=>({t:x.t,done:!!x.done}));
 else if(item.pj!==null){const pr=prById(item.pj); if(pr)p.project=pr.n;}
 return p;
}

async function askAssistant(text,item,isP){
 if(!API)return stubReply(text,item,isP);
 try{
  const r=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify(chatPayload(item,isP))});
  if(!r.ok){
   let why=''; try{why=(await r.json()).error||''}catch(_){}
   throw new Error('HTTP '+r.status+(why?' · '+why:''));
  }
  const d=await r.json();
  const t=(d.text||'').trim();
  return t||'Пустой ответ. Попробуйте переспросить.';
 }catch(e){
  /* Приложение офлайн-first: сеть отвалилась — говорим об этом в чате, а не роняем
     интерфейс. Причину показываем вместе с адресом: без них истёкший ключ, чужой
     origin, блокировка сети и старый закэшированный адрес выглядят одинаково. */
  let host=API; try{host=new URL(API).host}catch(_){}
  return 'Не получилось связаться с моделью ('+host+'): '+(e&&e.message||e)+'.';
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
 if(t.includes('разбить'))return 'Предлагаю три шага: уточнить детали, сделать основную часть, проверить результат. Нажмите «Сделать проектом», чтобы добавить их.';
 if(t.includes('перенести'))return 'На какую дату перенести «'+item.t+'»? Сейчас: '+(fmtDue(item.due)||'без срока')+'.';
 if(t.includes('письмо'))return 'Набросал письмо по задаче «'+item.t+'». Кому отправить?';
 return item.a;
}
function ask(text){
 const isP=S.cur.k==='p', item=curItem(); if(!item)return;
 const ph={typing:1};
 item.chat.push({u:text},ph);
 if(!isP)item.n++;
 paint(); save();
 askAssistant(text,item,isP).then(a=>{ph.typing=0; ph.a=a; paint(); save();});
}

/* ---------- отрисовка ---------- */
const $=i=>document.getElementById(i);
let list,thread,hctl;
/* Ключ текущей карточки: к нему привязаны «добавляю шаг» и взведённое удаление,
   поэтому переключение на другую задачу само их сбрасывает */
const curKey=()=>S.cur?S.cur.k+':'+S.cur.id:'';
let addingFor=null;
const closeStep=()=>{addingFor=null;paint()};
/* Меню действий по долгому нажатию на строку */
let menuEl=null, menuFor=null, menuArmed=false, menuAt=0, suppressRow=false;
/* Нажатие на «Входящие» переключает список на выполненные и обратно (S.showDone) */
let listMode=null, threadKey=null;
function paint(){
 const openT=S.ts.filter(x=>!x.done), dn=S.ts.filter(x=>x.done);
 const switched=listMode!==null&&listMode!==!!S.showDone; listMode=!!S.showDone;
 const ttl=$('inbox').querySelector('.ttl');
 ttl.textContent=S.showDone?'Выполненные':'Входящие';
 ttl.setAttribute('aria-pressed',S.showDone?'true':'false');
 ttl.setAttribute('aria-label',S.showDone?'Выполненные. Вернуться к входящим':'Входящие. Показать выполненные');
 $('cnt').textContent=S.showDone?dn.length:openT.length;
 list.innerHTML='';
 if(S.showDone){
  dn.forEach(x=>list.appendChild(taskRow(x,0)));
  if(!dn.length)list.innerHTML='<div class="empty">Выполненных пока нет.</div>';
 } else {
 openT.filter(x=>x.pj===null).forEach(x=>list.appendChild(taskRow(x,0)));
 S.pr.forEach(p=>{
  const all=inPj(p.id),op=openIn(p.id);
  if(!op.length)return;
  const nx=op[0], s=S.cur&&S.cur.k==='p'&&S.cur.id===p.id;
  const d=document.createElement('div'); d.className='row'; d.tabIndex=0; d.dataset.pj=p.id;
  d.setAttribute('aria-current',s?'true':'false');
  if(s)d.style.background='var(--fill-ghost-selected)';
  const b=document.createElement('div'); b.className='cel k'; d.dataset.kind='project';
  b.innerHTML='<span class="sr-only">Проект: </span><div class="t1">'+kindIcon('project')+'<span class="tt">'+esc(p.n)+'</span></div><div class="t2">'+
   '<span class="s sf" style="color:var(--text-secondary);">→ '+esc(nx.t)+'</span>'+
   '<span class="s" style="color:var(--text-muted);">· '+esc(fmtDue(nx.due||p.due)||'без срока')+'</span></div>';
  d.appendChild(b); d.appendChild(ringEl(all.length-op.length,all.length,nx,d));
  const go=()=>{if(suppressRow)return; S.cur={k:'p',id:p.id};save();open();};
  d.onclick=go; d.onkeydown=key(go);
  armLongPress(d,()=>showMenu('p',p.id));
  list.appendChild(d);
 });
 if(!list.children.length)list.innerHTML='<div class="empty">Задач нет. Добавьте первую внизу.</div>';
 }

 /* Входящие ↔ выполненные: строки въезжают лесенкой с отскоком */
 if(switched){
  popIn(ttl);
  [...list.children].slice(0,14).forEach((r,i)=>popIn(r,i));
 }
 paintDetail();
 const selRow=list.querySelector('[aria-current="true"]');
 if(selRow&&selRow.scrollIntoView)selRow.scrollIntoView({block:'nearest'});
}
function paintDetail(){
 if(!S.cur||!curItem()){
  const n=S.ts[0]||S.pr[0];
  if(!n){$('crumb').innerHTML='';$('ct').value='';$('cm').textContent='';hctl.innerHTML='';thread.innerHTML='';return;}
  S.cur=S.ts[0]?{k:'t',id:S.ts[0].id}:{k:'p',id:S.pr[0].id};
 }
 const isP=S.cur.k==='p', p=isP?prById(S.cur.id):null, x=isP?null:byId(S.cur.id);
 const par=!isP&&x.pj!==null?prById(x.pj):null;
 $('crumb').innerHTML=isP?I('folder',12)+'<span>проект</span>'
  :(par?I('corner-down-right',12)+'<span>'+esc(par.n)+'</span>':I('inbox',12)+'<span>без проекта</span>');
 const ct=$('ct');
 ct.value=isP?p.n:x.t;
 ct.style.color=(!isP&&x.done)?'var(--text-muted)':'var(--text-primary)';
 ct.style.textDecoration=(!isP&&x.done)?'line-through':'none';
 const all=isP?inPj(S.cur.id):null, op=isP?openIn(S.cur.id):null;
 const nmsg=n=>n%10===1&&n%100!==11?n+' сообщение':(n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?n+' сообщения':n+' сообщений');
 const nstep=n=>n%10===1&&n%100!==11?'шага':'шагов';
 $('cm').textContent=isP?((all.length-op.length)+' из '+all.length+' '+nstep(all.length)+' · '+(fmtDue(p.due)||'без срока'))
  :(x.done?'выполнена':((fmtDue(x.due)||'без срока')+' · '+(x.n?nmsg(x.n):'разговора не было')));
 hctl.innerHTML='';
 hctl.appendChild(isP?ringEl(all.length-op.length,all.length,0,0):hit(x,null,0,1));

 const it=isP?p:x;

 /* Новые реплики появляются с отскоком. Лента пересобирается целиком,
    поэтому сравниваем с тем, что было в этой же карточке до перерисовки */
 const k=curKey(), same=k===threadKey, prevN=thread.children.length, prevTyping=!!thread.querySelector('.typing');
 threadKey=k;
 thread.innerHTML='';
 const add=h=>{const e=document.createElement('div'); e.innerHTML=h; thread.appendChild(e.firstChild);};
 add('<div class="bub">'+(isP?'Что мешает?':'Как продвинулись?')+'</div>');
 add('<div class="ans">'+esc(isP?p.why:x.a)+'</div>');
 const adding=isP&&addingFor===curKey();
 if(isP&&(op.length||adding)){
  const w=document.createElement('div'); w.className='steps';
  op.forEach((t,i)=>{const r=taskRow(t,1); if(i===op.length-1&&!adding)r.style.borderBottom='none'; w.appendChild(r);});
  if(adding){
   const r=document.createElement('div'); r.className='row sm addstep'; r.style.borderBottom='none';
   r.innerHTML='<input class="stepin" placeholder="Название шага" aria-label="Название шага">';
   w.appendChild(r);
  }
  thread.appendChild(w);
 }
 if(!isP&&x.file)add('<div class="card">'+I('file-text',16,'text-accent')+'<div style="min-width:0; flex:1;"><div class="f1">'+esc(x.file)+'</div><div class="f2">вложение задачи · открыть</div></div></div>');
 it.chat.forEach(m=>add(m.u?'<div class="bub mine">'+esc(m.u)+'</div>':(m.typing?'<div class="ans typing"><i></i><i></i><i></i></div>':'<div class="ans">'+esc(m.a)+'</div>')));
 thread.scrollTop=thread.scrollHeight;
 if(same){
  const kids=thread.children;
  for(let i=prevN;i<kids.length;i++){kids[i].style.transformOrigin=kids[i].classList.contains('bub')?'100% 100%':'0 100%'; popIn(kids[i],i-prevN);}
  if(prevTyping&&kids.length===prevN&&!thread.querySelector('.typing')){const l=kids[kids.length-1]; l.style.transformOrigin='0 100%'; popIn(l);}
 }
 /* Поле шага: Enter добавляет и остаётся открытым — шаги обычно вносят пачкой.
    Проверка isConnected нужна, потому что paint() сносит старое поле и это тоже blur. */
 const si=thread.querySelector('.stepin');
 if(si){
  si.focus();
  si.onkeydown=e=>{
   if(e.key==='Enter'){e.preventDefault();const v=si.value.trim();v?addStep(v):closeStep();}
   else if(e.key==='Escape'){e.preventDefault();closeStep();}
  };
  si.onblur=()=>setTimeout(()=>{if(!si.isConnected)return;const v=si.value.trim();v?addStep(v):closeStep();},0);
 }
}

/* ---------- оболочка ---------- */
let view='list', open, back;
/* Видимая высота окна в --vh. На телефоне клавиатура ужимает область просмотра,
   а 100dvh про это не знает — без этого композер уезжает под клавиатуру. */
/* Контейнер приложения = видимая область: высота из visualViewport.height, смещение
   сверху из visualViewport.offsetTop. Обе величины — чистая функция текущего состояния,
   без накопленных дельт: пропущенное обновление не оставляет след.

   Событиям iOS доверять нельзя. За время работы они подводили четырежды: при скрытии
   клавиатуры могло не прийти ни одного, и раскладка застревала в поднятом состоянии,
   накладывая блоки друг на друга. Поэтому пока поле в фокусе и ещё секунду после —
   сверяемся с фактическими размерами каждый кадр. Расхождение живёт максимум один кадр,
   и неважно, какие события версия Safari решила прислать. Вне ввода — обычные события. */
let vvTrace=[];
function trackVH(){
 const root=document.documentElement, vv=window.visualViewport;
 let lastH=null, until=0, ticking=false;
 const apply=src=>{
  const h=vv?vv.height:innerHeight, t=vv?vv.offsetTop:0;
  root.style.setProperty('--vh',h+'px');
  root.style.setProperty('--vvtop',t+'px');
  if(lastH!==null&&h!==lastH){
   /* Высота изменилась — держим низ содержимого на месте. Чтение offsetHeight заставляет
      браузер применить новую высоту, иначе scrollTop обрежется по старым размерам. */
   const d=lastH-h;
   document.querySelectorAll('.bd').forEach(b=>{void b.offsetHeight; b.scrollTop+=d;});
   if(vvTrace.length>7)vvTrace.shift();
   vvTrace.push(src+Math.round(h));
  }
  lastH=h;
 };
 const typing=()=>{const a=document.activeElement; return !!a&&a.tagName==='INPUT'};
 /* Видимая область меньше окна — значит клавиатура ещё на экране */
 const shrunk=()=>innerHeight-(vv?vv.height:innerHeight)>80;
 /* Сверяемся, пока идёт ввод ИЛИ пока клавиатура на экране. Второе условие важнее:
    оно не даёт застрять в поднятом состоянии, даже если событие фокуса не пришло —
    цикл не остановится, пока раскладка не вернётся к полной высоте. */
 const pump=()=>{
  apply('f');
  if(typing()||shrunk()||Date.now()<until)requestAnimationFrame(pump); else ticking=false;
 };
 const watch=ms=>{
  until=Math.max(until,Date.now()+ms);
  if(!ticking){ticking=true;requestAnimationFrame(pump);}
 };
 apply('i');
 if(vv){
  vv.addEventListener('resize',()=>{apply('r');watch(800);});
  vv.addEventListener('scroll',()=>apply('s'));
 }
 addEventListener('resize',()=>apply('w'));
 addEventListener('orientationchange',()=>setTimeout(()=>apply('o'),150));
 /* Фокус и потеря фокуса — моменты, когда клавиатура появляется и убирается */
 addEventListener('focusin',e=>{if(e.target instanceof HTMLInputElement)watch(1500);});
 addEventListener('focusout',e=>{if(e.target instanceof HTMLInputElement)watch(1500);});
}
function shellTwo(){
 const grid=document.querySelector('.grid');
 let kbT;
 document.addEventListener('focusin',e=>{
  if(!(e.target instanceof HTMLInputElement)||e.target.type==='date')return;
  clearTimeout(kbT);
  const scr=e.target.closest('.scr'); if(!scr)return;
  grid.classList.toggle('kb-list',scr.id==='scr-list');
  grid.classList.toggle('kb-detail',scr.id==='scr-detail');
  setTimeout(()=>{window.scrollTo(0,0);e.target.scrollIntoView({block:'nearest'});},50);
 });
 document.addEventListener('focusout',e=>{
  if(!(e.target instanceof HTMLInputElement))return;
  kbT=setTimeout(()=>{if(!(document.activeElement instanceof HTMLInputElement)){grid.classList.remove('kb-list','kb-detail');window.scrollTo(0,0);}},120);
 });
 open=paint; back=()=>{};
}
/* index.html: экраны лежат друг над другом, переход — CSS-трансформ по классу .on (см. app.css).
   Фокус ставим без прокрутки: экран ещё за краем, и браузер иначе сдвинул бы .grid вбок */
function shellNav(){
 const show=v=>{view=v;$('scr-list').classList.toggle('on',v==='list');$('scr-detail').classList.toggle('on',v==='detail');};
 open=()=>{show('detail');paint();const f=$('back');if(f)f.focus({preventScroll:true});};
 back=()=>{show('list');paint();const r=list.querySelector('[aria-current="true"]');if(r)r.focus({preventScroll:true});};
 $('back').innerHTML=I('chevron-left',16);
 $('back').onclick=back;
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menuFor&&view==='detail')back();});
 armSwipeBack();
}
/* Свайп вправо от левого края экрана чата возвращает к списку, как на iPhone.
   Пока палец ведёт, оба экрана двигаются за ним (класс .drag выключает CSS-переход).
   Отпустили дальше трети ширины или быстрым движением — back(); иначе чат возвращается на место.
   Инлайновые трансформы снимаются в тот же кадр, что и .drag, поэтому переход доигрывает от текущего положения. */
const EDGE=28;
function armSwipeBack(){
 const d=$('scr-detail'), l=$('scr-list');
 let x0=null,y0=0,dx=0,w=1,t0=0,drag=false;
 const reset=()=>{
  d.classList.remove('drag'); l.classList.remove('drag');
  d.style.transform=''; l.style.transform=''; l.style.visibility=''; l.style.removeProperty('--scrim-o');
 };
 d.addEventListener('touchstart',e=>{
  if(view!=='detail'||e.touches.length!==1||menuFor)return;
  const t=e.touches[0]; if(t.clientX>EDGE)return;
  x0=t.clientX; y0=t.clientY; dx=0; drag=false; t0=Date.now(); w=d.offsetWidth||innerWidth;
 },{passive:true});
 d.addEventListener('touchmove',e=>{
  if(x0===null)return;
  const t=e.touches[0]; dx=t.clientX-x0; const dy=t.clientY-y0;
  if(!drag){
   if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){x0=null;return;}   // это прокрутка ленты
   if(dx<=10)return;
   drag=true; d.classList.add('drag'); l.classList.add('drag'); l.style.visibility='visible';
  }
  const p=Math.max(0,Math.min(1,dx/w));
  d.style.transform='translateX('+(p*100).toFixed(2)+'%)';
  l.style.transform='translateX('+(-24*(1-p)).toFixed(2)+'%)';
  l.style.setProperty('--scrim-o',(1-p).toFixed(3));
 },{passive:true});
 const end=()=>{
  if(x0===null)return; x0=null;
  if(!drag)return; drag=false;
  const fast=dx/Math.max(1,Date.now()-t0)>0.5;
  reset();
  if(dx>w/3||fast)back();
 };
 d.addEventListener('touchend',end); d.addEventListener('touchcancel',end);
}

/* ---------- старт ---------- */
S=load();
list=$('list'); thread=$('thread'); hctl=$('hctl');
trackVH();
(MODE==='nav'?shellNav:shellTwo)();
const nt=$('nt'),err=$('err'),msg=$('msg'),ct=$('ct');
$('add').innerHTML=I('plus',16); $('send').innerHTML=I('arrow-right',16);
$('brand-ic').innerHTML=I('inbox',12);   // иконка над логотипом — та же, что «без проекта» в шапке чата
nt.oninput=()=>{err.style.display='none';};
function submitTask(){
 if(!nt.value.trim()){err.style.display='block';nt.focus();return;}
 err.style.display='none';
 const was=S.showDone, t=addTask(nt.value.trim()); nt.value=''; S.showDone=0; paint();
 nt.focus();
 if(!was)popIn(list.querySelector('.row[data-id="'+t.id+'"]'));
}
function sendMsg(){
 const v=msg.value.trim(); if(!v)return;
 msg.value=''; ask(v); msg.focus();
}
/* Название правится прямо в шапке */
ct.oninput=()=>{const it=curItem(); if(!it)return; if(S.cur.k==='p')it.n=ct.value; else it.t=ct.value; save();};
ct.onblur=()=>{const it=curItem(); if(!it)return; const v=ct.value.trim();
 if(!v){if(S.cur.k==='p')it.n='Без названия'; else it.t='Без названия';} save(); paint();};
ct.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();ct.blur();}};
$('add').onclick=submitTask;
nt.onkeydown=e=>{if(e.key==='Enter')submitTask();};
$('send').onclick=sendMsg;
/* Поле фокусируется обычным тапом. Перехвата касания больше нет: с
   interactive-widget=resizes-content слой раскладки ужимается сам, iOS не
   прокручивает страницу к полю, и прятать поле на время фокуса незачем. */
msg.onkeydown=e=>{if(e.key==='Enter')sendMsg();};
const tog=()=>{S.showDone=S.showDone?0:1;save();paint();};
$('inbox').onclick=e=>{if(!e.target.closest('.logo'))tog();};   // логотип список не переключает $('inbox').querySelector('.ttl').onkeydown=key(tog);
addEventListener('keydown',e=>{if(e.key==='Escape'&&menuFor)closeMenu();});
addEventListener('pagehide',flush); addEventListener('beforeunload',flush);
paint();
/* Поверхность для тестов и отладки из консоли браузера. S переприсваивается при загрузке,
   поэтому отдаётся геттером, иначе снаружи виден устаревший объект. */
window.app={get S(){return S},kindOf,byId,prById,inPj,openIn,curItem,addTask,addStep,makeProject,delItem,fmtDue,flush,paint,showMenu,closeMenu,chatPayload};

/* Обновление установленного приложения. Новый service worker забирает управление сам
   (skipWaiting + clients.claim), но страница продолжает исполнять старый код до перезагрузки —
   поэтому перезагружаем её один раз при смене управляющего воркера. Только если он уже был:
   при первой в жизни установке controllerchange тоже срабатывает, и перезагрузка была бы лишней. */
/* Диагностика раскладки. Открыть страницу с ?debug — поверх интерфейса появятся живые
   числа: размеры окна и видимой области, смещение, значения переменных и положение
   контейнера с композером. Нужно потому, что поведение клавиатуры воспроизводится только
   на настоящем телефоне: в эмуляторе браузера её нет вовсе. Снимок экрана с открытой
   клавиатурой заменяет целый круг догадок. */
if(/(^|[?&])debug(=|&|$)/.test(location.search)){
 const box=document.createElement('pre');
 box.style.cssText='position:fixed;left:0;top:0;z-index:9999;margin:0;padding:4px 6px;'+
  'font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;color:#0f0;'+
  'background:rgba(0,0,0,.82);white-space:pre;pointer-events:none;max-width:100%';
 document.body.appendChild(box);
 const n=v=>Math.round(v);
 const rect=e=>{const b=e&&e.getBoundingClientRect();return b?n(b.top)+'..'+n(b.bottom)+' ('+n(b.height)+')':'нет'};
 const tick=()=>{
  const vv=window.visualViewport, cs=getComputedStyle(document.documentElement);
  box.textContent=
   'окно    '+n(innerWidth)+'x'+n(innerHeight)+'   scrollY '+n(scrollY)+'\n'+
   'видимая h '+(vv?n(vv.height):'—')+'  top '+(vv?n(vv.offsetTop):'—')+'  pageTop '+(vv?n(vv.pageTop):'—')+'  scale '+(vv?vv.scale:'—')+'\n'+
   'перем.  --vh '+(cs.getPropertyValue('--vh').trim()||'—')+'  --vvtop '+(cs.getPropertyValue('--vvtop').trim()||'—')+'\n'+
   'app     '+rect(document.querySelector('.app'))+'\n'+
   'композер '+rect(document.querySelector('.scr.on .ft')||document.querySelector('.ft'))+'\n'+
   'фокус   '+((document.activeElement&&document.activeElement.id)||'нет')+'\n'+
   'трасса  '+vvTrace.join(' ');
  requestAnimationFrame(tick);
 };
 tick();
}

if('serviceWorker' in navigator){
 const had=!!navigator.serviceWorker.controller; let done=false;
 navigator.serviceWorker.addEventListener('controllerchange',()=>{
  if(!had||done)return; done=true; location.reload();
 });
 addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
}
