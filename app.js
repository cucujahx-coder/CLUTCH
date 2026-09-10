/* Задачи — движок. Общий для index.html (две панели) и screens.html (полноэкранные переходы).
   Оболочка задаёт MODE ('two' | 'nav') до подключения этого файла. */
const MODE = window.MODE || 'two';

/* ---------- icons (inline SVG, стиль Tabler) ---------- */
const P={
 paperclip:'M15 7l-6.5 6.5a1.5 1.5 0 0 0 3 3l6.5 -6.5a3 3 0 0 0 -6 -6l-6.5 6.5a4.5 4.5 0 0 0 9 9l6.5 -6.5',
 clock:'M12 21a9 9 0 1 0 0 -18a9 9 0 0 0 0 18zM12 7v5l3 3',
 check:'M5 12l5 5l10 -10',
 plus:'M12 5v14M5 12h14',
 'arrow-right':'M5 12h14M13 18l6 -6M13 6l6 6',
 folder:'M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-11a2 2 0 0 1 2 -2',
 'corner-down-right':'M6 6v6a3 3 0 0 0 3 3h10M15 11l4 4l-4 4',
 inbox:'M4 4h16v12h-4l-2 3h-4l-2 -3h-4zM4 13h5l1 2h4l1 -2h5',
 refresh:'M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4',
 'alert-triangle':'M12 9v4M10.4 3.5l-8.1 14a1.9 1.9 0 0 0 1.6 2.8h16.2a1.9 1.9 0 0 0 1.6 -2.8l-8.1 -14a1.9 1.9 0 0 0 -3.2 0zM12 17h.01',
 'list-check':'M3.5 5.5l1.5 1.5l2.5 -2.5M3.5 11.5l1.5 1.5l2.5 -2.5M3.5 17.5l1.5 1.5l2.5 -2.5M11 6h9M11 12h9M11 18h9',
 calendar:'M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2zM16 3v4M8 3v4M4 11h16',
 mail:'M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2zM3 7l9 6l9 -6',
 'chevron-left':'M15 6l-6 6l6 6',
 trash:'M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12M9 7v-3h6v3',
 'file-text':'M14 3v4a1 1 0 0 0 1 1h4M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2zM9 9h1M9 13h6M9 17h6'
};
const I=(n,s,c)=>'<svg class="ic" width="'+s+'" height="'+s+'" viewBox="0 0 24 24" aria-hidden="true"'+(c?' style="color:var(--'+c+')"':'')+'><path d="'+P[n]+'"/></svg>';
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

/* ---------- выборки ---------- */
const IC={art:['paperclip','text-accent'],wait:['clock','text-warning'],dec:['check','text-success']};
const byId=i=>S.ts.find(x=>x.id===i);
const prById=i=>S.pr.find(p=>p.id===i);
const inPj=p=>S.ts.filter(x=>x.pj===p);
const openIn=p=>S.ts.filter(x=>x.pj===p&&!x.done);
const curItem=()=>S.cur&&(S.cur.k==='p'?prById(S.cur.id):byId(S.cur.id));

/* ---------- анимации ---------- */
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
function parts(host,cx,cy){
 if(RM)return;
 for(let i=0;i<9;i++){const a=(i/9)*Math.PI*2,d=16+Math.random()*16,s=document.createElement('span');
  s.style.cssText='position:absolute; left:'+cx+'px; top:'+cy+'px; width:5px; height:5px; margin:-2.5px 0 0 -2.5px; border-radius:50%; pointer-events:none; background:var(--text-'+(i%2?'accent':'success')+');';
  host.appendChild(s);
  s.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:'translate('+(Math.cos(a)*d).toFixed(1)+'px,'+(Math.sin(a)*d).toFixed(1)+'px) scale(0)',opacity:0}],{duration:400,easing:'cubic-bezier(.2,.8,.3,1)',fill:'forwards'});}
}
function boomRow(row,cb){
 if(RM||!row){cb();return;}
 const h=row.offsetHeight;
 row.style.overflow='hidden'; row.style.position='relative'; row.style.pointerEvents='none';
 parts(row,row.offsetWidth-24,h/2);
 row.animate([{height:h+'px',opacity:1,transform:'scale(1)'},{height:h+'px',opacity:.95,transform:'scale(1.03)',offset:.28},{height:'0px',opacity:0,transform:'scale(.9)'}],{duration:340,easing:'ease-in',fill:'forwards'});
 setTimeout(cb,350);
}
function boomSpot(el,cb){
 if(RM){cb();return;}
 el.style.pointerEvents='none';
 parts(el,el.offsetWidth/2,el.offsetHeight/2);
 const c=el.firstChild;
 if(c)c.animate([{transform:'scale(1)'},{transform:'scale(1.25)',offset:.35},{transform:'scale(1)'}],{duration:340,easing:'ease-out'});
 setTimeout(cb,300);
}
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
   boomSpot(g,()=>{mark(step,1); save(); if(last&&row){boomRow(row,paint);}else paint();});};
  g.onclick=go; g.onkeydown=key(go);
 } else {g.style.cursor='default'; g.setAttribute('role','img'); g.setAttribute('aria-label','Осталось шагов: '+(total-done));}
 return g;
}
function sub(x,ic){
 if(!x.tail&&!x.due)return '';
 const c=x.tail?(x.tail.k==='wait'?'text-warning':'text-secondary'):'text-muted';
 let h='<div class="t2">';
 if(x.tail){
  if(ic)h+=I(IC[x.tail.k][0],14,IC[x.tail.k][1]);
  h+='<span class="s sf" style="color:var(--'+c+');">'+esc(x.tail.x)+'</span>';
 }
 if(x.due)h+='<span class="s" style="color:var(--'+(overdue(x.due)&&!x.done?'text-danger':'text-muted')+');">'+(x.tail?'· ':'')+esc(fmtDue(x.due))+'</span>';
 return h+'</div>';
}
function taskRow(x,ic,sm){
 const d=document.createElement('div'), s=S.cur.k==='t'&&S.cur.id===x.id;
 d.className='row'+(sm?' sm':''); d.tabIndex=0; d.dataset.id=x.id;
 d.setAttribute('aria-current',s?'true':'false');
 if(s)d.style.background='var(--fill-ghost-selected)';
 const b=document.createElement('div'); b.className='cel';
 b.innerHTML='<div class="t1" style="color:var(--text-'+(x.done?'muted':'primary')+');'+(x.done?'text-decoration:line-through;':'')+'">'+esc(x.t)+'</div>'+sub(x,ic);
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
function closeMenu(){
 menuFor=null; menuArmed=false;
 if(menuEl){menuEl.hidden=true; menuEl.querySelector('.sheet-body').innerHTML='';}
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
   I(icon,20)+'<span>'+esc(label)+'</span>'+(val?'<span class="val">'+esc(val)+'</span>':'')+
   (a==='due'?'<input type="date" aria-label="Срок" value="'+(it.due||'')+'">':'')+'</button>';
 let h='<div class="sheet-title">'+esc(isP?it.n:it.t)+'</div>';
 h+=mi('due','calendar','Срок',fmtDue(it.due)||'не задан');
 if(isP)h+=mi('step','plus','Добавить шаг');
 else if(it.pj===null)h+=mi('proj','list-check','Сделать проектом');
 h+=mi('del','trash',menuArmed?'Точно удалить?':(isP?'Удалить проект':'Удалить'));
 body.innerHTML=h; r.hidden=false;
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
 S.ts.push({id:S.seq++,t:title,due:null,pj:S.cur.id,done:0,doneAt:null,tail:null,n:0,a:'Разговора ещё не было.',chat:[]});
 save(); paint();
}

/* ---------- чат ----------
   Точка подключения модели. Сейчас — локальная заглушка; когда появится
   серверная функция, здесь останется один fetch, остальное не изменится. */
async function askAssistant(text,item,isP){
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
function paint(){
 const openT=S.ts.filter(x=>!x.done);
 $('cnt').textContent=openT.length;
 list.innerHTML='';
 openT.filter(x=>x.pj===null).forEach(x=>list.appendChild(taskRow(x,0,0)));
 S.pr.forEach(p=>{
  const all=inPj(p.id),op=openIn(p.id);
  if(!op.length)return;
  const nx=op[0], s=S.cur&&S.cur.k==='p'&&S.cur.id===p.id;
  const d=document.createElement('div'); d.className='row'; d.tabIndex=0; d.dataset.pj=p.id;
  d.setAttribute('aria-current',s?'true':'false');
  if(s)d.style.background='var(--fill-ghost-selected)';
  const b=document.createElement('div'); b.className='cel';
  b.innerHTML='<div class="t1" style="font-weight:600;">'+esc(p.n)+'</div><div class="t2">'+
   '<span class="s sf" style="color:var(--text-secondary);">→ '+esc(nx.t)+'</span>'+
   '<span class="s" style="color:var(--text-muted);">· '+esc(fmtDue(nx.due||p.due)||'без срока')+'</span></div>';
  d.appendChild(b); d.appendChild(ringEl(all.length-op.length,all.length,nx,d));
  const go=()=>{if(suppressRow)return; S.cur={k:'p',id:p.id};save();open();};
  d.onclick=go; d.onkeydown=key(go);
  armLongPress(d,()=>showMenu('p',p.id));
  list.appendChild(d);
 });
 if(!list.children.length)list.innerHTML='<div class="empty">Задач нет. Добавьте первую внизу.</div>';
 const dn=S.ts.filter(x=>x.done);
 const sec=document.createElement('div'); sec.className='sec'; sec.tabIndex=0; sec.setAttribute('role','button'); sec.setAttribute('aria-expanded',S.showDone?'true':'false');
 sec.innerHTML='<span>Выполненные</span><span style="width:var(--ctl); text-align:center;">'+dn.length+'</span>';
 const tog=()=>{S.showDone=!S.showDone;save();paint();};
 sec.onclick=tog; sec.onkeydown=key(tog);
 list.appendChild(sec);
 if(S.showDone)dn.forEach(x=>list.appendChild(taskRow(x,0,0)));

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
 $('crumb').innerHTML=isP?I('folder',16)+'<span>проект</span>'
  :(par?I('corner-down-right',16)+'<span>'+esc(par.n)+'</span>':I('inbox',16)+'<span>без проекта</span>');
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

 thread.innerHTML='';
 const add=h=>{const e=document.createElement('div'); e.innerHTML=h; thread.appendChild(e.firstChild);};
 add('<div class="bub">'+(isP?'Что мешает?':'Как продвинулись?')+'</div>');
 add('<div class="ans">'+esc(isP?p.why:x.a)+'</div>');
 const adding=isP&&addingFor===curKey();
 if(isP&&(op.length||adding)){
  const w=document.createElement('div'); w.className='steps';
  op.forEach((t,i)=>{const r=taskRow(t,1,1); if(i===op.length-1&&!adding)r.style.borderBottom='none'; w.appendChild(r);});
  if(adding){
   const r=document.createElement('div'); r.className='row sm addstep'; r.style.borderBottom='none';
   r.innerHTML='<input class="stepin" placeholder="Название шага" aria-label="Название шага">';
   w.appendChild(r);
  }
  thread.appendChild(w);
 }
 if(!isP&&x.file)add('<div class="card">'+I('file-text',20,'text-accent')+'<div style="min-width:0; flex:1;"><div class="f1">'+esc(x.file)+'</div><div class="f2">вложение задачи · открыть</div></div></div>');
 it.chat.forEach(m=>add(m.u?'<div class="bub">'+esc(m.u)+'</div>':(m.typing?'<div class="ans typing"><i></i><i></i><i></i></div>':'<div class="ans">'+esc(m.a)+'</div>')));
 thread.scrollTop=thread.scrollHeight;
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
function trackVH(){
 const set=()=>{const vv=window.visualViewport;document.documentElement.style.setProperty('--vh',(vv?vv.height:window.innerHeight)+'px');};
 set();
 if(window.visualViewport){visualViewport.addEventListener('resize',set);visualViewport.addEventListener('scroll',set);}
 addEventListener('resize',set);
 addEventListener('orientationchange',()=>setTimeout(set,150));
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
function shellNav(){
 const show=v=>{view=v;$('scr-list').classList.toggle('on',v==='list');$('scr-detail').classList.toggle('on',v==='detail');};
 open=()=>{show('detail');paint();const f=$('back');if(f)f.focus();};
 back=()=>{show('list');paint();const r=list.querySelector('[aria-current="true"]');if(r)r.focus();};
 $('back').innerHTML=I('chevron-left',24);
 $('back').onclick=back;
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menuFor&&view==='detail')back();});
}

/* ---------- старт ---------- */
S=load();
list=$('list'); thread=$('thread'); hctl=$('hctl');
trackVH();
(MODE==='nav'?shellNav:shellTwo)();
const nt=$('nt'),err=$('err'),msg=$('msg'),ct=$('ct');
$('add').innerHTML=I('plus',20); $('send').innerHTML=I('arrow-right',20);
nt.oninput=()=>{err.style.display='none';};
function submitTask(){
 if(!nt.value.trim()){err.style.display='block';nt.focus();return;}
 err.style.display='none';
 addTask(nt.value.trim()); nt.value=''; paint(); nt.focus();
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
$('add').onclick=submitTask; nt.onkeydown=e=>{if(e.key==='Enter')submitTask();};
$('send').onclick=sendMsg; msg.onkeydown=e=>{if(e.key==='Enter')sendMsg();};
addEventListener('keydown',e=>{if(e.key==='Escape'&&menuFor)closeMenu();});
addEventListener('pagehide',flush); addEventListener('beforeunload',flush);
paint();
/* Поверхность для тестов и отладки из консоли браузера. S переприсваивается при загрузке,
   поэтому отдаётся геттером, иначе снаружи виден устаревший объект. */
window.app={get S(){return S},byId,prById,inPj,openIn,curItem,addTask,addStep,makeProject,delItem,fmtDue,flush,paint,showMenu,closeMenu};

if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
