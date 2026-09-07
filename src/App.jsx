import { useState, useEffect, useRef } from "react";

// Точка подключения API. Сейчас — заглушка.
async function askAssistant(task) {
  await new Promise((r) => setTimeout(r, 500));
  if (task.isProject) return "Это проект. Когда план готов — отметь шаги в списке выше, в «Сегодня» будет висеть только текущий.";
  const last = task.messages[task.messages.length - 1]?.text || "";
  return `Записал: «${last.slice(0, 60)}${last.length > 60 ? "…" : ""}». Модель пока не подключена.`;
}

// Точка подключения API для плана: вернуть массив шагов по задаче.
async function askPlan(task) {
  await new Promise((r) => setTimeout(r, 700));
  const t = task.title.toLowerCase();
  if (t.includes("ремонт")) return ["Замерить помещение и составить список работ", "Выбрать плитку и сантехнику", "Найти мастера, согласовать смету", "Демонтаж старого", "Черновые работы: трубы, электрика", "Укладка плитки", "Установка сантехники и приёмка"];
  if (t.includes("отпуск") || t.includes("поезд")) return ["Выбрать даты и направление", "Купить билеты", "Забронировать жильё", "Оформить страховку", "Собрать чемодан"];
  return [`Разобраться, что уже есть по «${task.title}»`, "Определить результат и срок", "Сделать первый маленький шаг", "Проверить и скорректировать", "Довести до конца"];
}

const uid = () => Math.random().toString(36).slice(2, 10);
const KEY = "everyday:v4";
let mem = [];
const load = async () => {
  try { const r = await window.storage.get(KEY); if (r?.value) return JSON.parse(r.value); } catch {}
  try { const v = localStorage.getItem(KEY); if (v) return JSON.parse(v); } catch {}
  return mem;
};
const save = async (t) => {
  mem = t; const j = JSON.stringify(t);
  try { if (await window.storage.set(KEY, j)) return; } catch {}
  try { localStorage.setItem(KEY, j); } catch {}
};


// ── даты ──
const iso = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const todayStr = () => iso(new Date());
const plusDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const WEEKDAYS = { "пн": 1, "понедельник": 1, "вт": 2, "вторник": 2, "ср": 3, "среда": 3, "среду": 3, "чт": 4, "четверг": 4, "пт": 5, "пятница": 5, "пятницу": 5, "сб": 6, "суббота": 6, "субботу": 6, "вс": 0, "воскресенье": 0 };
const fmtDue = (d) => {
  if (!d) return "";
  if (d === todayStr()) return "Сегодня";
  if (d === plusDays(1)) return "Завтра";
  const x = new Date(d + "T00:00");
  const diff = Math.round((x - new Date(todayStr() + "T00:00")) / 864e5);
  if (diff > 1 && diff < 7) return x.toLocaleDateString("ru-RU", { weekday: "long" }).replace(/^./, (c) => c.toUpperCase());
  return `${x.getDate()} ${MONTHS[x.getMonth()]}`;
};
// «купить хлеб завтра» → { title: "купить хлеб", due: "2026-09-06" }
function parseDue(text) {
  let title = text, due = null;
  const rules = [
    [/(?<![а-яёa-z])(сегодня)(?![а-яёa-z])/i, () => todayStr()],
    [/(?<![а-яёa-z])(послезавтра)(?![а-яёa-z])/i, () => plusDays(2)],
    [/(?<![а-яёa-z])(завтра)(?![а-яёa-z])/i, () => plusDays(1)],
    [/(?<![а-яёa-z])через\s+(\d+)\s*(дн|день|дня|дней)(?![а-яёa-z])/i, (m) => plusDays(+m[1])],
    [/(?<![а-яёa-z])через\s+неделю(?![а-яёa-z])/i, () => plusDays(7)],
    [/(?<![а-яёa-z])(?:в|во)?\s*(пн|вт|ср|чт|пт|сб|вс|понедельник|вторник|среду|среда|четверг|пятницу|пятница|субботу|суббота|воскресенье)(?![а-яёa-z])/i, (m) => {
      const w = WEEKDAYS[m[1].toLowerCase()]; const d = new Date(); let n = (w - d.getDay() + 7) % 7; if (n === 0) n = 7; return plusDays(n);
    }],
    [/(?<![а-яёa-z])(\d{1,2})[./](\d{1,2})(?![а-яёa-z])/, (m) => { const d = new Date(); d.setMonth(+m[2] - 1, +m[1]); if (iso(d) < todayStr()) d.setFullYear(d.getFullYear() + 1); return iso(d); }],
    [/(?<![а-яёa-z])(\d{1,2})\s+(янв|фев|мар|апр|ма[йя]|июн|июл|авг|сен|окт|ноя|дек)[а-яё]*(?![а-яё])/i, (m) => {
      const mi = MONTHS.findIndex((x) => m[2].toLowerCase().startsWith(x.slice(0, 3))); const d = new Date(); d.setMonth(mi, +m[1]); if (iso(d) < todayStr()) d.setFullYear(d.getFullYear() + 1); return iso(d);
    }],
  ];
  for (const [re, fn] of rules) {
    const m = title.match(re);
    if (m) { due = fn(m); title = title.replace(m[0], " ").replace(/\s{2,}/g, " ").trim(); break; }
  }
  return { title: title || text, due };
}




// Демо-режим: при каждом запуске список генерируется заново случайно (сохранение не используется)
const DEMO = false;
const POOL = ["Оплатить интернет", "Записаться к стоматологу", "Отправить отчёт", "Купить корм коту", "Забрать посылку", "Обновить резюме", "Позвонить бабушке", "Продлить страховку",
  "Созвон с командой", "Дочитать главу", "Сходить в зал", "Ответить на письма", "Разобрать стол", "Спланировать неделю", "Заказать билеты", "Подготовить презентацию",
  "Сдать анализы", "Поменять резину", "Оплатить налоги", "День рождения Саши", "Продлить домен", "Встреча с юристом", "Купить подарок маме", "Съездить на дачу",
  "Вынести мусор", "Полить цветы", "Записать идею для блога", "Проверить почту", "Заплатить за парковку", "Починить кран", "Сделать бэкап", "Написать Диме",
  "Купить лампочки", "Постирать", "Собрать чемодан", "Обновить приложение", "Погулять с собакой", "Заказать воду", "Проверить страховку авто", "Сходить в банк"];
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function demo() {
  const titles = shuffle(POOL);
  const CHATS = [
    ["С чего начать?", "Разбей на три шага: собрать данные, черновик, проверка. Начни с данных — 20 минут."],
    ["Не успеваю сегодня", "Перенеси на завтра утро, а сейчас сделай только первый шаг — так не потеряешь контекст."],
    ["Какие варианты есть?", "Вижу два: сделать самому за час или делегировать и проверить вечером."],
    ["Напомни, что тут важно", "Дедлайн в пятницу, нужна подпись Ивана и копия в бухгалтерию."],
    ["Готово, проверь", "Выглядит хорошо. Осталось отправить и закрыть задачу."],
  ];
  const mk = (title, done, due, priority = 0) => {
    const chat = Math.random() < 0.4 ? CHATS[rnd(0, CHATS.length - 1)] : null;
    return { id: uid(), title, done, due, priority, messages: chat ? [{ id: uid(), role: "user", text: chat[0] }, { id: uid(), role: "ai", text: chat[1] }] : [] };
  };
  const nDone = rnd(4, 9), nToday = rnd(4, 8), nLater = rnd(6, 12), nLate = rnd(0, 2);
  let i = 0;
  const pid = uid();
  const proj = { id: pid, title: "Ремонт в ванной", done: false, due: todayStr(), priority: 1, isProject: true, createdAt: Date.now() - 5e6, messages: [{ id: uid(), role: "user", text: "С чего начать ремонт?" }, { id: uid(), role: "ai", text: "Сначала замеры и список работ, потом выбор плитки. Разбил на 7 шагов." }] };
  const stepsT = ["Замерить помещение и составить список работ", "Выбрать плитку и сантехнику", "Найти мастера, согласовать смету", "Демонтаж старого", "Черновые работы: трубы, электрика", "Укладка плитки", "Установка сантехники и приёмка"];
  const projSteps = stepsT.map((t, k) => ({ id: uid(), title: t, done: k < 1, due: todayStr(), priority: 0, projectId: pid, order: k, messages: [] }));
  return [proj, ...projSteps,
    ...Array.from({ length: nDone }, (_, k) => mk(titles[i++], true, plusDays(-k))),
    ...Array.from({ length: nToday }, () => mk(titles[i++], false, todayStr(), Math.random() < 0.35 ? rnd(1, 2) : 0)),
    ...Array.from({ length: nLate }, () => mk(titles[i++], false, plusDays(-rnd(1, 5)), Math.random() < 0.5 ? 2 : 0)),
    ...Array.from({ length: nLater }, () => mk(titles[i++], false, plusDays(rnd(1, 14)), Math.random() < 0.25 ? 1 : 0)),
  ];
}

// Щелчок: Android — navigator.vibrate; iPhone — трюк со скрытым <input type="checkbox" switch> (Safari 17.4+)
let hapticEl = null;
function iosTick() {
  if (!hapticEl) {
    const label = document.createElement("label");
    label.style.cssText = "position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
    const input = document.createElement("input");
    input.type = "checkbox"; input.setAttribute("switch", "");
    label.appendChild(input); document.body.appendChild(label);
    hapticEl = label;
  }
  hapticEl.click();
}
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
const tap = (ms = 12) => {
  try {
    if (isIOS || !navigator.vibrate) { iosTick(); if (ms >= 18) setTimeout(iosTick, 45); if (ms >= 25) setTimeout(iosTick, 90); }
    else navigator.vibrate(ms);
  } catch {}
};
let audio;
function pop() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === "suspended") audio.resume();
    const t = audio.currentTime;
    const len = Math.floor(audio.sampleRate * 0.25);
    const buf = audio.createBuffer(1, len, audio.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const noise = audio.createBufferSource(); noise.buffer = buf;
    const hp = audio.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 900;
    const g1 = audio.createGain(); g1.gain.setValueAtTime(0.9, t); g1.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    noise.connect(hp).connect(g1).connect(audio.destination); noise.start(t);
    const osc = audio.createOscillator(); osc.type = "sine";
    osc.frequency.setValueAtTime(180, t); osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    const g2 = audio.createGain(); g2.gain.setValueAtTime(0.8, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g2).connect(audio.destination); osc.start(t); osc.stop(t + 0.2);
  } catch {}
}
const PRESS_CSS = `
  * { -webkit-tap-highlight-color: transparent; }
  button, label, .row-press, .composer, [data-row] { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
  input, textarea { -webkit-user-select: text; user-select: text; }
  button, input, label, .row-press { touch-action: manipulation; }
  .press { transition: transform 70ms ease-out, opacity 70ms; }
  .press:active { transform: scale(0.9); }
  .row-press { transition: background 120ms; }
  .row-press:active { background: rgba(255,255,255,0.06); }
  input[type=checkbox].press:checked { animation: pop 140ms cubic-bezier(.2,.8,.2,1); }
  @keyframes pop { 0% { transform: scale(0.8) } 60% { transform: scale(1.12) } 100% { transform: scale(1) } }
  .boom { position: absolute; pointer-events: none; z-index: 20; font-size: 34px; line-height: 1; transform: translate(-50%, -50%); animation: boom 200ms cubic-bezier(.1,.9,.2,1) forwards; }
  @keyframes boom { 0% { transform: translate(-50%,-50%) scale(0.2); opacity: 0 } 25% { transform: translate(-50%,-50%) scale(1.5) rotate(-10deg); opacity: 1 } 60% { transform: translate(-50%,-50%) scale(1.15) rotate(6deg); opacity: 1 } 100% { transform: translate(-50%,-70%) scale(0.9); opacity: 0 } }
  .ghost { position: absolute; z-index: 21; pointer-events: none; display: flex; align-items: center; font-size: 17px; color: #F2F2F2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transform-origin: left center; animation: burst 130ms cubic-bezier(.5,0,1,.4) forwards; }
  @keyframes burst {
    0%   { transform: scale(1); opacity: 1; filter: brightness(1) blur(0) }
    15%  { transform: scale(1.04); opacity: 1; filter: brightness(3) blur(0) }
    100% { transform: scale(1.5); opacity: 0; filter: brightness(2) blur(8px) }
  }
  .landed > span:first-child { animation: land 200ms cubic-bezier(.1,1.2,.3,1) both; transform-origin: left center; }
  @keyframes land {
    0%   { transform: scale(0.5); opacity: 0; filter: brightness(3) blur(4px) }
    30%  { transform: scale(1.1); opacity: 1; filter: brightness(1.8) blur(0) }
    100% { transform: scale(1); opacity: 1; filter: brightness(1) }
  }
  .flash { position: absolute; pointer-events: none; z-index: 18; width: 220px; height: 220px; border-radius: 50%; transform: translate(-50%,-50%); background: radial-gradient(circle, rgba(255,240,200,0.95) 0%, rgba(255,180,80,0.45) 30%, transparent 65%); animation: flash 130ms ease-out forwards; mix-blend-mode: screen; }
  @keyframes flash { 0% { transform: translate(-50%,-50%) scale(0.2); opacity: 1 } 100% { transform: translate(-50%,-50%) scale(1.6); opacity: 0 } }
  .screen-flash { position: absolute; inset: 0; pointer-events: none; z-index: 17; background: #fff; animation: sflash 80ms ease-out forwards; mix-blend-mode: overlay; }
  @keyframes sflash { 0% { opacity: 0.35 } 100% { opacity: 0 } }
  .appear { animation: appear 320ms cubic-bezier(.2,.8,.2,1) both; }
  @keyframes appear { 0% { transform: translateY(24px) scale(0.96); opacity: 0; background: rgba(255,255,255,0.18) } 60% { background: rgba(255,255,255,0.10) } 100% { transform: none; opacity: 1; background: transparent } }
  .ring { animation: ring 380ms ease-out; }
  @keyframes ring { 0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.7) } 100% { box-shadow: 0 0 0 16px rgba(255,255,255,0) } }
  .card-flash { animation: cflash 400ms ease-out; }
  @keyframes cflash { 0% { box-shadow: inset 0 0 0 999px rgba(255,255,255,0.12) } 100% { box-shadow: inset 0 0 0 999px rgba(255,255,255,0) } }
  .elflash { animation: elflash 220ms ease-out; }
  @keyframes elflash { 0% { box-shadow: inset 0 0 0 999px rgba(255,255,255,0.85); filter: brightness(1.6) } 100% { box-shadow: inset 0 0 0 999px rgba(255,255,255,0); filter: brightness(1) } }
  .spark { position: absolute; pointer-events: none; z-index: 19; width: 6px; height: 6px; border-radius: 3px; animation: spark 180ms cubic-bezier(0,.8,.2,1) forwards; }
  @keyframes spark { 0% { transform: translate(-50%,-50%) scale(1); opacity: 1 } 100% { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.2); opacity: 0 } }
`;

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [ready, setReady] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [draft, setDraft] = useState("");

  const rollover = (ts) => ts.map((t) => (!t.done && t.due && t.due < todayStr() ? { ...t, due: todayStr() } : t));
  useEffect(() => { if (DEMO) { setTasks(rollover(demo())); setReady(true); return; } load().then((t) => { setTasks(rollover(t)); setReady(true); }); }, []);
  useEffect(() => { if (ready && !DEMO) save(tasks); }, [tasks, ready]);

  const patch = (id, fn) => setTasks((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));
  const [booms, setBooms] = useState([]);
  const pageRef = useRef(null);
  const [landed, setLanded] = useState(null);
  const [ghosts, setGhosts] = useState([]);
  const onDown = (e) => {
    const el = e.target.closest?.(".press, .row-press, .composer");
    if (!el) return;
    el.classList.remove("elflash"); void el.offsetWidth; el.classList.add("elflash");
    setTimeout(() => el.classList.remove("elflash"), 240);
  };
  const [undo, setUndo] = useState(null);
  const undoTimer = useRef(null);
  const offerUndo = (id, title) => {
    clearTimeout(undoTimer.current);
    setUndo({ id, title });
    undoTimer.current = setTimeout(() => setUndo(null), 5000);
  };
  const doUndo = () => {
    if (!undo) return;
    tap(10);
    patch(undo.id, (x) => ({ ...x, done: false }));
    clearTimeout(undoTimer.current); setUndo(null);
  };

  const [flashCard, setFlashCard] = useState(null);
  const [lastId, setLastId] = useState(null);
  const complete = (e, id, title) => {
    const rowEl = e.target.closest("[data-row]");
    const p = pageRef.current.getBoundingClientRect();
    if (rowEl) {
      const r = rowEl.querySelector("[data-title]").getBoundingClientRect();
      const gid = uid();
      setGhosts((g) => [...g, { id: gid, x: r.left - p.left, y: r.top - p.top, w: r.width, h: r.height, title }]);
      setTimeout(() => setGhosts((g) => g.filter((z) => z.id !== gid)), 200);
    }
    explode(e);
    patch(id, (x) => ({ ...x, done: true }));
    // если это шаг проекта — в тот же слот прилетает следующий шаг
    const me = byId[id];
    const next = me?.projectId ? tasks.filter((t) => t.projectId === me.projectId && !t.done && t.id !== id).sort((a, b) => a.order - b.order)[0] : null;
    setLanded(next ? next.id : id); setTimeout(() => setLanded(null), 220);
    offerUndo(id, title);
  };
  const explode = (e) => {
    const r = e.target.getBoundingClientRect(), p = pageRef.current.getBoundingClientRect();
    const x = r.left - p.left + r.width / 2, y = r.top - p.top + r.height / 2, id = uid();
    const sparks = Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return { dx: Math.cos(a) * 46, dy: Math.sin(a) * 46, c: ["#FFB347", "#FF6B6B", "#FFE066", "#FF8C42"][i % 4] }; });
    setBooms((b) => [...b, { id, x, y, sparks }]);
    setTimeout(() => setBooms((b) => b.filter((z) => z.id !== id)), 220);
    pop(); tap(25);
  };
  const add = (forcedDue) => {
    if (!draft.trim()) return;
    const bang = (draft.match(/!+\s*$/) || [""])[0].trim().length;
    const parsed = parseDue(draft.replace(/!+\s*$/, "").trim());
    const title = parsed.title, due = forcedDue || parsed.due;
    const id = uid();
    setTasks((ts) => [...ts, { id, title, due: due || todayStr(), done: false, priority: Math.min(bang, 2), createdAt: Date.now(), messages: [] }]);
    setLastId(id); setTimeout(() => setLastId(null), 400);
    setFlashCard(due && due > todayStr() ? "later" : "today"); setTimeout(() => setFlashCard(null), 420);
    setDraft("");
  };
  const preview = draft.trim() ? parseDue(draft.replace(/!+\s*$/, "").trim()).due : null;
  const byDue = (a, b) => (a.due || "9").localeCompare(b.due || "9");
  const done = tasks.filter((t) => t.done);
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const anchor = (t) => (t.projectId && byId[t.projectId]) || t;
  const firstStep = {};
  for (const t of tasks) if (t.projectId && !t.done && (!firstStep[t.projectId] || t.order < firstStep[t.projectId].order)) firstStep[t.projectId] = t;
  const todayList = tasks
    .filter((t) => !t.done && !t.isProject && (!t.due || t.due <= todayStr()) && (!t.projectId || firstStep[t.projectId]?.id === t.id))
    .sort((a, b) => ((anchor(a).priority || 0) - (anchor(b).priority || 0)) || (anchor(a).createdAt || 0) - (anchor(b).createdAt || 0));
  const stepsOf = (pid) => tasks.filter((t) => t.projectId === pid).sort((a, b) => a.order - b.order);
  const makeProject = (id, steps) => {
    const base = byId[id]; if (!base) return;
    const created = Date.now();
    setTasks((ts) => [
      ...ts.map((t) => (t.id === id ? { ...t, isProject: true, createdAt: t.createdAt || created } : t)),
      ...steps.map((title, i) => ({ id: uid(), title, due: base.due || todayStr(), done: false, priority: 0, projectId: id, order: i, messages: [] })),
    ]);
  };
  const upcoming = tasks.filter((t) => !t.done && t.due && t.due > todayStr()).sort(byDue);
  const groups = todayList.length ? [{ label: "Сегодня", zone: "today", items: todayList }] : [];
  const open = tasks.find((t) => t.id === openId);
  const listEnd = useRef(null);
  const todayEnd = useRef(null);
  const prevLen = useRef(0);
  // К низу прокручиваем только при первой загрузке и при добавлении новой задачи; дальше скролл свободный
  useEffect(() => {
    if (open) return;
    if (ready && (prevLen.current === 0 || tasks.length > prevLen.current)) todayEnd.current ? todayEnd.current.scrollIntoView({ block: "center" }) : listEnd.current?.scrollIntoView({ block: "end" });
    prevLen.current = tasks.length;
  }, [tasks.length, ready, open]);

  return (
    <div ref={pageRef} onPointerDownCapture={(e) => { onDown(e); try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === "suspended") audio.resume(); } catch {} }} style={{ ...page, position: "relative", overflow: "hidden" }}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Play:wght@400;700&display=swap");` + PRESS_CSS}</style>
      {ghosts.map((g) => (
        <div key={g.id} className="ghost" style={{ left: g.x, top: g.y, width: g.w, height: g.h }}>{g.title}</div>
      ))}
      {booms.map((b) => (
        <span key={b.id}>
          <span className="screen-flash" />
          <span className="flash" style={{ left: b.x, top: b.y }} />
          {b.sparks.map((sp, i) => <span key={i} className="spark" style={{ left: b.x, top: b.y, background: sp.c, "--dx": sp.dx + "px", "--dy": sp.dy + "px" }} />)}
          <span className="boom" style={{ left: b.x, top: b.y }}>💥</span>
        </span>
      ))}
      <Sheet open={!!open} onClose={() => setOpenId(null)}>
        {open && <Task task={open} project={open.projectId ? byId[open.projectId] : null} steps={stepsOf(open.isProject ? open.id : open.projectId)}
          onBack={() => setOpenId(null)} onChange={(fn) => patch(open.id, fn)} onPatch={patch}
          onOpen={(id) => setOpenId(id)}
          onPlan={(steps) => makeProject(open.id, steps)}
          onDelete={() => { setTasks((ts) => ts.filter((t) => t.id !== open.id && t.projectId !== open.id)); setOpenId(null); }} />}
      </Sheet>
      <div style={topBar}>
        <span className="press" style={roundBtn} onClick={() => tap()}>≡</span>
        <span style={{ fontWeight: 600, fontSize: 18 }}>Задачи</span>
        <span className="press" style={roundBtn} onClick={() => tap()}>⚲</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
      <div style={{ height: "100%", overflowY: "auto", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", display: "flex", flexDirection: "column", padding: "24px 0" }}>
        <div style={{ flex: "1 0 auto" }} />
        {todayList.map((t) => (
          <div key={t.id} style={{ position: "relative", marginBottom: t.projectId ? 4 * Math.min(2, stepsOf(t.projectId).filter((x) => !x.done).length - 1) + 6 : 0 }}>
          {t.projectId && Array.from({ length: Math.min(2, stepsOf(t.projectId).filter((x) => !x.done).length - 1) }, (_, k) => (
            <div key={k} style={{ position: "absolute", left: 8 * (k + 1), right: 8 * (k + 1), bottom: -4 * (k + 1), height: 40, borderRadius: 28, background: "#1C1C1C", border: `1px solid ${T.line}`, opacity: 1 - 0.3 * (k + 1), zIndex: 0 }} />
          ))}
          <div data-row ref={t.id === todayList[todayList.length - 1].id ? todayEnd : null} className={"row-press " + (landed === t.id ? "landed" : lastId === t.id ? "appear" : "")} style={{ ...cardBox, ...row, position: "relative", zIndex: 1, ...(t.projectId ? { background: "#1C1C1C", border: `1px solid ${T.line}` } : {}) }}>
            <span onClick={() => { tap(8); setOpenId(t.id); }} style={{ flex: 1, minWidth: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, height: "100%", padding: "0 8px 0 12px", touchAction: "pan-y" }}>
              <span data-title style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                {t.projectId && byId[t.projectId] ? (
                  <span style={{ fontSize: 13, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {byId[t.projectId].title} · {stepsOf(t.projectId).findIndex((x) => x.id === t.id) + 1} из {stepsOf(t.projectId).length}
                  </span>
                ) : null}
              </span>
            </span>
            <span style={{ position: "relative", display: "flex", flexShrink: 0 }}>
              <input type="checkbox" className="press" checked={t.done} onChange={(e) => { if (!t.done) complete(e, t.id, t.title); }} style={{ ...box, background: "#2A2A2A", boxShadow: anchor(t).priority ? `inset 0 0 0 2px ${PRI[anchor(t).priority]}` : "none" }} />
              {t.projectId && <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: T.muted, pointerEvents: "none" }}>{stepsOf(t.projectId).filter((x) => !x.done).length}</span>}
            </span>
          </div>
          </div>
        ))}
        <div ref={listEnd} style={{ height: 16 }} />
      </div>
      </div>
      {undo && (
        <div className="appear" style={toast}>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.muted }}>Выполнено: {undo.title}</span>
          <button className="press" onClick={doUndo} style={undoBtn}>Вернуть</button>
        </div>
      )}
      {preview && <div style={{ fontSize: 13, color: T.muted, margin: "0 0 6px 20px" }}>→ {fmtDue(preview)}</div>}
      <Composer value={draft} onChange={setDraft} onSend={add} dateMenu placeholder="Новая задача" onFiles={(fs) => setTasks((ts) => [...ts, ...fs.map((f) => ({ id: uid(), title: f.name, due: todayStr(), done: false, messages: [] }))])} />
    </div>
  );
}


function Sheet({ open, onClose, children }) {
  const [closing, setClosing] = useState(false);
  const keep = useRef(null);
  const wasOpen = useRef(false);
  if (open) keep.current = children;
  useEffect(() => {
    if (open) { wasOpen.current = true; setClosing(false); return; }
    if (!wasOpen.current) return;
    setClosing(true);
    const t = setTimeout(() => setClosing(false), 300);
    return () => clearTimeout(t);
  }, [open]);
  if (!open && !closing) return null;
  return (
    <>
      <style>{`
        @keyframes sheetIn { from { transform: translate3d(0,100%,0) } to { transform: translate3d(0,0,0) } }
        @keyframes sheetOut { from { transform: translate3d(0,0,0) } to { transform: translate3d(0,100%,0) } }
        @keyframes dimIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes dimOut { from { opacity: 1 } to { opacity: 0 } }
      `}</style>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 10, animation: `${open ? "dimIn" : "dimOut"} 300ms ease forwards` }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 44, background: T.bg, borderRadius: "28px 28px 0 0", boxShadow: "0 -8px 40px rgba(0,0,0,0.5)", zIndex: 11, display: "flex", flexDirection: "column", overflow: "hidden", willChange: "transform", animation: `${open ? "sheetIn" : "sheetOut"} 300ms cubic-bezier(.32,.72,0,1) forwards` }}>
        <div style={{ width: 40, height: 5, borderRadius: 3, background: "#3A3A3A", margin: "10px auto 0", flexShrink: 0 }} />
        {keep.current}
      </div>
    </>
  );
}

function Task({ task, project, steps, onBack, onChange, onPatch, onOpen, onPlan, onDelete }) {
  const [plan, setPlan] = useState(null);      // предложенный ИИ план до подтверждения
  const [planning, setPlanning] = useState(false);
  const draftPlan = async () => {
    tap(); setPlanning(true);
    const p = await askPlan(task);
    setPlanning(false); setPlan(p);
  };
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } end.current?.scrollIntoView({ block: "nearest" }); }, [task.messages.length, busy]);

  const send = async () => {
    const t = text.trim(); if (!t || busy) return;
    setText("");
    const next = { ...task, messages: [...task.messages, { id: uid(), role: "user", text: t }] };
    onChange(() => next); setBusy(true);
    const reply = await askAssistant(next);
    setBusy(false);
    onChange((x) => ({ ...x, messages: [...x.messages, { id: uid(), role: "ai", text: reply }] }));
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: 16, boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="press" onClick={() => { tap(); onBack(); }} style={roundBtn}>✕</button>
        <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
          <h1 style={{ ...h1, fontSize: 18, margin: 0, textDecoration: task.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</h1>
          {project && <div onClick={() => onOpen(project.id)} style={{ fontSize: 13, color: T.muted, marginTop: 2, cursor: "pointer" }}>{project.title} · {steps.findIndex((x) => x.id === task.id) + 1} из {steps.length}</div>}
          {task.isProject && <div style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>Проект · {steps.filter((x) => x.done).length} из {steps.length}</div>}
        </div>
        <input type="checkbox" className="press" checked={task.done} onChange={() => { tap(task.done ? 8 : 18); onChange((x) => ({ ...x, done: !x.done })); }} style={{ ...box, background: task.done ? "#F5F5F3" : "#2A2A2A", boxShadow: !task.done && task.priority ? `inset 0 0 0 2px ${PRI[task.priority]}` : "none" }} />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "16px 0" }}>
        {task.isProject && steps.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {steps.map((st) => (
              <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 44 }}>
                <input type="checkbox" className="press" checked={st.done} onChange={() => { tap(st.done ? 8 : 18); onPatch(st.id, (x) => ({ ...x, done: !x.done })); }} style={{ ...box, width: 28, height: 28, background: st.done ? "#F5F5F3" : "#2A2A2A" }} />
                <span onClick={() => onOpen(st.id)} style={{ flex: 1, minWidth: 0, cursor: "pointer", color: st.done ? T.muted : T.text, textDecoration: st.done ? "line-through" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{st.title}</span>
              </div>
            ))}
          </div>
        )}
        {plan && (
          <div style={{ ...cardBox, background: "#1C1C1C", border: `1px solid ${T.line}`, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: T.muted, marginBottom: 8 }}>План — проверь и подтверди</div>
            {plan.map((st, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "6px 0" }}>
                <span style={{ color: T.muted, width: 18, flexShrink: 0 }}>{i + 1}.</span>
                <input value={st} onChange={(e) => setPlan((p) => p.map((x, j) => (j === i ? e.target.value : x)))} style={{ ...input, height: "auto", padding: 0, fontSize: 16 }} />
                <button className="press" onClick={() => setPlan((p) => p.filter((_, j) => j !== i))} style={{ ...roundBtn, width: 28, height: 28, fontSize: 14, color: T.muted }}>✕</button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button className="press" onClick={() => { tap(14); onPlan(plan.filter((x) => x.trim())); setPlan(null); }} style={{ ...chip, background: "#F5F5F3", color: "#111", fontWeight: 600 }}>Создать шаги</button>
              <button className="press" onClick={() => setPlan(null)} style={chip}>Отмена</button>
            </div>
          </div>
        )}
        {task.messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} style={{ display: "flex", justifyContent: "flex-end", margin: "16px 0" }}>
              <div style={bubble}>{m.text}</div>
            </div>
          ) : (
            <p key={m.id} style={aiText}>{m.text}</p>
          )
        )}
        {busy && <p style={{ ...aiText, color: T.muted }}>…</p>}
        <div ref={end} />
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-start", flexWrap: "wrap", padding: "0 0 10px" }}>
        <label className="press" style={{ ...chip, color: task.due ? T.text : T.muted }}>
          {task.due ? fmtDue(task.due) : "Дата"}
          <input type="date" value={task.due || ""} onChange={(e) => onChange((x) => ({ ...x, due: e.target.value || null }))} style={{ position: "absolute", inset: 0, opacity: 0, width: "100%", height: "100%" }} />
        </label>
        <button className="press" onClick={() => { tap(); onChange((x) => ({ ...x, priority: ((x.priority || 0) + 1) % 3 })); }} style={{ ...chip, color: task.priority ? PRI[task.priority] : T.muted, borderColor: task.priority ? PRI[task.priority] : T.line }}>
          {["Обычная", "Важная", "Срочная"][task.priority || 0]}
        </button>
        {!task.isProject && !task.projectId && (
          <button className="press" onClick={draftPlan} disabled={planning || !!plan} style={{ ...chip, opacity: planning ? 0.6 : 1 }}>{planning ? "Думаю…" : "Разбить на шаги"}</button>
        )}
        <button className="press" onClick={() => { tap(20); onDelete(); }} style={{ ...chip, color: "#e5645a" }}>{task.isProject ? "Удалить проект" : "Удалить"}</button>
      </div>
      <Composer value={text} onChange={setText} onSend={send} placeholder="Написать" disabled={busy} onFiles={(fs) => onChange((x) => ({ ...x, messages: [...x.messages, ...fs.map((f) => ({ id: uid(), role: "user", text: "📎 " + f.name }))] }))} />
    </div>
  );
}

function Composer({ value, onChange, onSend, placeholder, disabled, onFiles, dateMenu }) {
  const [rec, setRec] = useState(false);
  const ref = useRef(null);
  const fileRef = useRef(null);
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const mic = () => {
    if (!SR) return;
    if (rec) { if (ref.current) ref.current.keep = false; ref.current?.stop(); setRec(false); return; }
    const r = new SR(); r.lang = "ru-RU"; r.interimResults = true; r.continuous = true;
    let fin = "";
    r.onresult = (e) => { let it = ""; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) fin += t + " "; else it += t; } onChange((fin + it).trim()); };
    r.onerror = () => setRec(false);
    r.onend = () => { if (ref.current === r && ref.current.keep) { try { r.start(); } catch { setRec(false); } } else setRec(false); };
    r.keep = true;
    ref.current = r; r.start(); setRec(true);
  };
  const can = value.trim() && !disabled;
  const [ring, setRing] = useState(false);
  const fire = (due) => { setRing(true); setTimeout(() => setRing(false), 400); onSend(due); };

  // Удержание кнопки отправки → меню дат, палец вверх выбирает, отпустил — отправил
  const wd = (d) => { const w = new Date(d + "T00:00").toLocaleDateString("ru-RU", { weekday: "short" }).replace(".", ""); return w[0].toUpperCase() + w.slice(1); };
  const OPTIONS = dateMenu ? Array.from({ length: 7 }, (_, i) => ({ label: wd(plusDays(i)), due: plusDays(i) })) : [];
  const [menu, setMenu] = useState(false);
  const [sel, setSel] = useState(0);
  const press = useRef(null);
  const boxRef = useRef(null);
  const down = (e) => {
    if (!can) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    press.current = { x: e.clientX, held: false, timer: setTimeout(() => { press.current.held = true; setMenu(true); setSel(0); tap(15); }, 220) };
  };
  const move = (e) => {
    if (!press.current?.held) return;
    const w = boxRef.current?.getBoundingClientRect().width || 360;
    const step = w / OPTIONS.length;
    const i = Math.max(0, Math.min(OPTIONS.length - 1, Math.round((press.current.x - e.clientX) / step)));
    if (i !== sel) { setSel(i); tap(6); }
  };
  const up = () => {
    if (!press.current) return;
    clearTimeout(press.current.timer);
    const held = press.current.held; press.current = null;
    setMenu(false);
    if (!can) return;
    tap(14);
    fire(held ? OPTIONS[sel].due : undefined);
  };
  const cancel = () => {
    if (!press.current) return;
    if (press.current.held) return; // iOS шлёт pointercancel при удержании — игнорируем, ждём pointerup/touchend
    clearTimeout(press.current.timer); press.current = null; setMenu(false);
  };
  return (
    <div ref={boxRef} className="composer" style={{ ...composer, position: "relative" }}>
      {menu && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "row-reverse", gap: 4, padding: 6, zIndex: 5, borderRadius: "inherit", background: "#1C1C1C" }}>
          {OPTIONS.map((o, i) => (
            <div key={o.due} style={{ ...dateItem, flex: 1, background: i === sel ? "#F5F5F3" : "#2A2A2A", color: i === sel ? "#111" : T.text, transform: i === sel ? "scale(1.06)" : "none" }}>{o.label}</div>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={(e) => { if (e.target.files?.length) onFiles?.(Array.from(e.target.files)); e.target.value = ""; }} />
      <button className="press" onClick={() => { tap(); fileRef.current?.click(); }} style={{ ...inBtn, background: "#2A2A2A" }} aria-label="Приложить файл"><Ic d="M21 12l-8.5 8.5a5 5 0 0 1-7-7L14 5a3 3 0 0 1 4.5 4.5L10 18a1.5 1.5 0 0 1-2-2l7.5-7.5" /></button>
      <input value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && can && fire()} placeholder={placeholder} enterKeyHint="send" autoComplete="off" autoCorrect="on" style={input} />
      {can ? (
        <span style={{ position: "relative", display: "flex" }}>
          <button className={"press" + (ring ? " ring" : "")}
            onPointerDown={dateMenu ? down : undefined} onPointerMove={dateMenu ? move : undefined} onPointerUp={dateMenu ? up : undefined} onPointerCancel={dateMenu ? cancel : undefined} onTouchEnd={dateMenu ? (e) => { if (press.current?.held) { e.preventDefault(); up(); } } : undefined} onContextMenu={(e) => e.preventDefault()}
            onClick={dateMenu ? undefined : () => { tap(14); fire(); }}
            style={{ ...inBtn, background: "#F5F5F3", color: "#111", border: "none", touchAction: "none", WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }} aria-label="Отправить"><Ic d="M12 19V5M5 12l7-7 7 7" /></button>
        </span>
      ) : (
        <button className="press" onClick={() => { tap(); mic(); }} style={{ ...inBtn, background: rec ? "#e5645a" : "#2A2A2A", color: rec ? "#fff" : "#D6D6D2", border: "none" }} aria-label="Голосовой ввод"><Ic d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v3" /></button>
      )}
    </div>
  );
}

const PRI = ["#4A4A48", "#E8A33D", "#E5645A"]; // обычная, важная, срочная
const T = { bg: "#161616", card: "#232323", line: "#343434", text: "#EDEDEB", muted: "#9A9A96" };
const page = { fontFamily: "Play, Inter, -apple-system, system-ui, sans-serif", fontSize: 16, color: T.text, background: T.bg, height: "100dvh", boxSizing: "border-box", padding: "max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", maxWidth: 600, margin: "0 auto" };
const topBar = { display: "flex", alignItems: "center", justifyContent: "space-between", height: 48, marginBottom: 8 };
const roundBtn = { width: 44, height: 44, borderRadius: 22, border: "1px solid #3A3A3A", background: "transparent", color: T.text, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer", padding: 0, flexShrink: 0, fontFamily: "inherit" };
const cardBox = { background: "transparent", border: "1px solid transparent", borderRadius: 28, padding: 11, marginBottom: 0, flexShrink: 0, boxSizing: "border-box" };
const head = { fontSize: 13, fontWeight: 600, color: T.muted, textTransform: "uppercase", letterSpacing: 0.6, padding: "12px 0 4px" };
const row = { display: "flex", alignItems: "center", gap: 6, minHeight: 68, fontSize: 17 };
const box = { width: 44, height: 44, margin: 0, flexShrink: 0, appearance: "none", WebkitAppearance: "none", borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer" };
const composer = { display: "flex", alignItems: "center", gap: 6, height: 68, padding: 11, border: `1px solid ${T.line}`, borderRadius: 28, background: "#1C1C1C", boxSizing: "border-box" };
const input = { flex: 1, minWidth: 0, height: "100%", fontSize: 17, padding: "0 8px", border: "none", background: "transparent", color: T.text, fontFamily: "inherit", outline: "none" };
const inBtn = { width: 44, height: 44, borderRadius: 22, border: "none", background: "transparent", color: "#D6D6D2", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0, flexShrink: 0 };
const btn = { fontSize: 16, padding: "0 14px", border: `1px solid ${T.line}`, borderRadius: 12, background: "transparent", color: T.text, cursor: "pointer", fontFamily: "inherit" };
const h1 = { fontSize: 24, fontWeight: 600, margin: "0 0 12px" };
const bubble = { maxWidth: "85%", background: "#2B2B2B", padding: "14px 20px", borderRadius: 26, fontSize: 17, lineHeight: 1.5, whiteSpace: "pre-wrap" };
const aiText = { margin: "16px 0", lineHeight: 1.6, whiteSpace: "pre-wrap" };
const Ic = ({ d }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const chip = { position: "relative", display: "inline-flex", alignItems: "center", height: 44, padding: "0 18px", borderRadius: 22, border: "none", background: "#2A2A2A", color: T.text, fontFamily: "inherit", fontSize: 15, cursor: "pointer" };
const toast = { display: "flex", alignItems: "center", gap: 12, height: 48, padding: "0 8px 0 20px", marginBottom: 8, borderRadius: 24, background: "#1C1C1C", border: `1px solid ${T.line}`, fontSize: 15 };
const undoBtn = { height: 34, padding: "0 14px", borderRadius: 17, border: "none", background: "#F5F5F3", color: "#111", fontFamily: "inherit", fontSize: 14, fontWeight: 600, cursor: "pointer" };
const _dateMenuBox = { position: "absolute", right: 0, bottom: 52, display: "flex", flexDirection: "column-reverse", gap: 4, padding: 4, borderRadius: 26, background: "#1C1C1C", border: `1px solid ${T.line}`, boxShadow: "0 12px 40px rgba(0,0,0,0.6)", zIndex: 30 };
const dateItem = { height: "100%", minWidth: 0, padding: 0, borderRadius: 22, display: "flex", alignItems: "center", justifyContent: "center", whiteSpace: "nowrap", fontSize: 14, fontWeight: 600, overflow: "hidden", transition: "background 80ms, transform 80ms" };
