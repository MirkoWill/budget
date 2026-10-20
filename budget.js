"use strict";
// Budget: freies Monatsbudget (ohne Fixkosten). Zeitraum läuft vom Stichtag (Standard 25.) bis zum Tag davor.
// Daten in localStorage (Beträge in Cent); optional gemeinsamer Abgleich über eine Google-Tabelle (sync/Code.gs).
(() => {
  const KEY = "budget-v1";
  const DAY = 86400000;
  const KEEP_DAYS = 400;   // ältere Ausgaben werden verworfen
  const CATS = [
    { id: "essen", label: "Essen unterwegs" },
    { id: "lebensmittel", label: "Lebensmittel" },
    { id: "amazon", label: "Amazon" },
    { id: "kultur", label: "Kultur" },
    { id: "kleidung", label: "Kleidung" },
    { id: "sonstiges", label: "Sonstiges" },
  ];
  const catLabel = (id) => (CATS.find((c) => c.id === id) || { label: id }).label;
  const catId = (v) => (CATS.find((c) => c.id === v || c.label === v) || { id: "sonstiges" }).id;
  const SETTINGS = ["budget", "resetDay", "since", "budgets"];   // gemeinsame Einstellungen

  const $ = (id) => document.getElementById(id);
  const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
  const euro0 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const fmt = (c) => euro.format(c / 100);
  const fmt0 = (c) => euro0.format(Math.round(c / 100));
  const dShort = (d) => d.toLocaleDateString("de-DE", { day: "numeric", month: "short" });
  const dWeek = (d) => d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  // ---------- Speicher ----------
  // pending: noch nicht übertragene Änderungen (id → Eintrag mit u = Zeitstempel, x = gelöscht)
  // su/sDirty: Zeitstempel und Übertragungsbedarf der Einstellungen
  const fresh = () => ({ budget: 0, resetDay: 25, budgets: {}, entries: [], pending: {}, su: 0 });
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && Array.isArray(d.entries)) return { ...fresh(), ...d };
    } catch (e) { /* leer starten */ }
    return fresh();
  }
  let data = load();
  function store() {
    const cut = Date.now() - KEEP_DAYS * DAY;
    data.entries = data.entries.filter((e) => e.t >= cut);
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { toast("Speichern fehlgeschlagen – Speicher voll?"); }
  }
  function save() { store(); scheduleSync(); }
  function touchSettings() { data.su = Date.now(); data.sDirty = true; }
  // Ausgaben ändern: lokal sofort, für den Abgleich vormerken
  function mark(e, gone) { if (data.sync) data.pending[e.id] = { ...e, u: Date.now(), ...(gone ? { x: 1 } : {}) }; }
  function putEntry(e) { data.entries = data.entries.filter((x) => x.id !== e.id).concat(e); mark(e, false); }
  function dropEntry(e) { data.entries = data.entries.filter((x) => x.id !== e.id); mark(e, true); }

  // ---------- Zeitraum ----------
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const dateOfKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
  function periodOf(date, offset = 0) {
    const r = data.resetDay;
    let y = date.getFullYear(), m = date.getMonth();
    if (date.getDate() < r) m -= 1;
    m += offset;
    let start = new Date(y, m, r);
    const end = new Date(y, m + 1, r);   // end = exklusiv
    const key = keyOf(start), full = Math.round((end - start) / DAY);
    // Erster Zeitraum beginnt erst am Tag der Einrichtung → Budget anteilig
    const since = data.since && dateOfKey(data.since);
    if (since && since > start && since < end) start = since;
    return { start, end, key, full, days: Math.round((end - start) / DAY) };
  }
  const budgetOf = (p) => Math.round((data.budgets[p.key] ?? data.budget) * p.days / p.full);
  // Startdatum festhalten, sobald ein Budget existiert (frühester Eintrag oder heute)
  function sinceFix() {
    if (!data.budget || data.since) return;
    const first = data.entries.reduce((t, e) => Math.min(t, e.t), Date.now());
    data.since = keyOf(new Date(first));
    touchSettings();
    save();
  }
  const inPeriod = (p) => data.entries.filter((e) => e.t >= +p.start && e.t < +p.end);
  const dayDate = (p, i) => new Date(p.start.getFullYear(), p.start.getMonth(), p.start.getDate() + i);
  const weekLabel = (p, w) => `${dShort(dayDate(p, w.from))} – ${dShort(dayDate(p, w.from + w.len - 1))}`;
  const dayIdx = (p, t) => Math.floor((startOfDay(new Date(t)) - p.start) / DAY + 0.5);   // 0-basiert, sommerzeitfest

  function stats(now = new Date()) {
    const p = periodOf(now);
    if (data.budget > 0 && data.budgets[p.key] == null) { data.budgets[p.key] = data.budget; touchSettings(); save(); }
    const B = budgetOf(p);
    const list = inPeriod(p);
    const today = dayIdx(p, +now);                 // 0-basiert
    const daily = new Array(p.days).fill(0);
    for (const e of list) daily[Math.min(p.days - 1, Math.max(0, dayIdx(p, e.t)))] += e.a;
    const spent = daily.reduce((s, v) => s + v, 0);
    const spentToday = daily[today];
    const daysLeft = p.days - today;               // inkl. heute
    const remaining = B - spent;
    // Wochen (Mo–So, am Zeitraumrand gekürzt): Wochenbudget = Rest zu Wochenbeginn anteilig auf die Tage der Woche.
    // Mehr- oder Minderausgaben einer Woche verschieben so die folgenden Wochen, nicht die laufende.
    const sum = (a, b) => daily.slice(a, b).reduce((t, v) => t + v, 0);
    const weeks = [];
    for (let i = 0; i < p.days;) {
      const len = Math.min(7 - (dayDate(p, i).getDay() + 6) % 7, p.days - i);
      const budget = Math.max(0, B - sum(0, i)) * len / (p.days - i);
      weeks.push({ from: i, len, budget, spent: sum(i, i + len) });
      i += len;
    }
    const week = weeks.find((w) => today < w.from + w.len);
    const weekDaysLeft = week.from + week.len - today;          // inkl. heute
    const weekLeft = week.budget - week.spent;
    // Tageswert aus der Woche: was zu Tagesbeginn von der Woche übrig war, verteilt auf die restlichen Wochentage
    const todayShare = Math.max(0, week.budget - sum(week.from, today)) / weekDaysLeft;
    const planToDate = B * (today + 1) / p.days;
    const n7 = Math.min(7, today + 1);
    const avg7 = daily.slice(today + 1 - n7, today + 1).reduce((s, v) => s + v, 0) / n7;
    const projection = spent + avg7 * (daysLeft - 1);
    const byCat = {};
    for (const e of list) byCat[e.c] = (byCat[e.c] || 0) + e.a;
    return { p, B, list, today, daily, spent, spentToday, daysLeft, remaining, todayShare, todayLeft: todayShare - spentToday,
      perDay: remaining / daysLeft, weeks, week, weekLeft, weekDaysLeft, weekPerDay: weekLeft / weekDaysLeft, planToDate, avg7, n7, projection, byCat };
  }

  // ---------- Startseite ----------
  let ago = 0;
  function renderHome(s) {
    const last = new Date(s.p.end - DAY);
    $("period").textContent = `${dShort(s.p.start)} – ${dShort(last)} · Tag ${s.today + 1} von ${s.p.days}`;
    $("weekTitle").textContent = `Woche · ${weekLabel(s.p, s.week)}`;
    if (!s.B) {
      $("remaining").textContent = "–";
      $("ofBudget").textContent = "Noch kein Budget festgelegt – im Cockpit eintragen.";
      $("pace").textContent = ""; $("today").textContent = "–"; $("perDay").textContent = "–";
      $("weekLeft").textContent = "–"; $("weekSub").textContent = ""; $("weekFill").style.width = "0"; $("weekPlan").style.left = "0";
      $("todayHint").textContent = ""; $("perDayHint").textContent = "";
      $("meterFill").style.width = "0"; $("meterPlan").style.left = "0";
    } else {
      $("remaining").textContent = fmt(s.remaining);
      $("remaining").classList.toggle("neg", s.remaining < 0);
      $("ofBudget").textContent = `von ${fmt0(s.B)} · ${fmt(s.spent)} ausgegeben`;
      const fill = $("meterFill");
      fill.style.width = `${Math.min(100, (s.spent / s.B) * 100)}%`;
      fill.classList.toggle("over", s.spent > s.B);
      $("meterPlan").style.left = `${((s.today + 1) / s.p.days) * 100}%`;
      const diff = s.spent - s.planToDate, pace = $("pace");
      if (s.remaining < 0) { pace.textContent = `Budget um ${fmt(-s.remaining)} überschritten`; pace.className = "pace bad"; }
      else if (diff > 0) { pace.textContent = `▲ ${fmt(diff)} über Plan`; pace.className = "pace warn"; }
      else { pace.textContent = `▼ ${fmt(-diff)} unter Plan`; pace.className = "pace ok"; }
      $("today").textContent = fmt(s.todayLeft);
      $("today").classList.toggle("neg", s.todayLeft < 0);
      $("todayHint").textContent = `Tagesanteil ${fmt(Math.max(0, s.todayShare))}`;
      $("perDay").textContent = fmt(Math.max(0, s.weekPerDay));
      $("perDayHint").textContent = s.weekDaysLeft === 1 ? "letzter Tag der Woche" : `für ${s.weekDaysLeft} Tage bis ${dWeek(dayDate(s.p, s.week.from + s.week.len - 1)).split(",")[0]}`;
      $("weekLeft").textContent = fmt(s.weekLeft);
      $("weekLeft").classList.toggle("neg", s.weekLeft < 0);
      $("weekSub").textContent = `von ${fmt(s.week.budget)} · ${fmt(s.week.spent)} ausgegeben`;
      const wf = $("weekFill");
      wf.style.width = `${s.week.budget ? Math.min(100, (s.week.spent / s.week.budget) * 100) : 100}%`;
      wf.classList.toggle("over", s.week.spent > s.week.budget);
      $("weekPlan").style.left = `${((s.today - s.week.from + 1) / s.week.len) * 100}%`;
    }
    const recent = [...s.list].sort((a, b) => b.t - a.t).slice(0, 5);
    $("recent").innerHTML = recent.length ? recent.map(rowHtml).join("") : `<li class="empty">Noch keine Ausgaben in diesem Zeitraum.</li>`;
  }
  function rowHtml(e) {
    const d = new Date(e.t);
    const when = startOfDay(d).getTime() === startOfDay(new Date()).getTime()
      ? d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : dWeek(d);
    const who = data.sync && e.w ? `${e.w} · ` : "";
    return `<li><span class="what"><b>${esc(catLabel(e.c))}</b><small>${esc(who + when)}${e.n ? " · " + esc(e.n) : ""}</small></span>
      <span class="amt">${fmt(e.a)}</span><button class="del" type="button" data-del="${esc(e.id)}" aria-label="Löschen">×</button></li>`;
  }

  // Schnelle Eingabe: Betrag tippen → Kategorie antippen = gespeichert
  $("cats").innerHTML = CATS.map((c) => `<button type="button" data-cat="${c.id}">${c.label}</button>`).join("");
  function parseAmount(str) {
    const s = String(str).replace(/[\s€]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    if (!/^\d*\.?\d{0,2}$/.test(s) || s === "" || s === ".") return 0;
    const c = Math.round(parseFloat(s) * 100);
    return c > 0 && c < 1e9 ? c : 0;
  }
  // Feld wächst mit dem Betrag, damit Zahl und € mittig zusammenstehen
  function sizeAmount() { $("amount").style.width = `${Math.max(4, $("amount").value.length) + 0.2}ch`; }
  $("amount").addEventListener("input", () => { $("cats").classList.toggle("ready", parseAmount($("amount").value) > 0); sizeAmount(); });
  $("amount").addEventListener("keydown", (ev) => { if (ev.key === "Enter") $("amount").blur(); });
  $("cats").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-cat]");
    if (!b) return;
    const a = parseAmount($("amount").value);
    if (!a) {
      const box = $("amount").parentElement;
      box.classList.remove("shake"); void box.offsetWidth; box.classList.add("shake");
      $("amount").focus();
      return;
    }
    const now = new Date();
    const t = ago ? +new Date(now.getFullYear(), now.getMonth(), now.getDate() - ago, 12) : +now;
    const e = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t, a, c: b.dataset.cat };
    const note = $("note").value.trim();
    if (note) e.n = note;
    if (data.sync && data.sync.me) e.w = data.sync.me;
    putEntry(e);
    if (data.since && t < +dateOfKey(data.since)) { data.since = keyOf(new Date(t)); touchSettings(); }   // Nachtrag vor dem Start
    save();
    $("amount").value = ""; $("note").value = ""; $("cats").classList.remove("ready"); $("amount").blur(); sizeAmount();
    setAgo(0);
    if (navigator.vibrate) navigator.vibrate(12);
    render();
    toast(`${fmt(a)} · ${catLabel(e.c)} erfasst`, () => { dropEntry(e); save(); render(); });
  });
  function setAgo(n) {
    ago = n;
    for (const b of $("when").querySelectorAll("button")) b.setAttribute("aria-pressed", String(+b.dataset.ago === n));
  }
  $("when").addEventListener("click", (ev) => { const b = ev.target.closest("[data-ago]"); if (b) setAgo(+b.dataset.ago); });

  // Löschen mit Rückgängig
  document.addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-del]");
    if (!b) return;
    const e = data.entries.find((x) => x.id === b.dataset.del);
    if (!e) return;
    dropEntry(e); save(); render();
    toast(`${fmt(e.a)} · ${catLabel(e.c)} gelöscht`, () => { putEntry(e); save(); render(); });
  });

  // ---------- Cockpit ----------
  $("resetDay").innerHTML = Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}">${i + 1}.</option>`).join("");
  function renderCockpit(s) {
    if (document.activeElement !== $("budgetInput")) $("budgetInput").value = data.budget ? (data.budget / 100).toLocaleString("de-DE") : "";
    $("resetDay").value = String(data.resetDay);
    const last = new Date(s.p.end - DAY);
    $("periodInfo").textContent = `Aktueller Zeitraum: ${dShort(s.p.start)} – ${dShort(last)} (${s.p.days} Tage)` +
      (s.p.days < s.p.full ? `, dein erster – deshalb anteilig ${fmt0(s.B)} von ${fmt0(budgetOf({ ...s.p, days: s.p.full }))}.` : ".") +
      ` Am ${data.resetDay}. beginnt automatisch ein neuer Zeitraum mit vollem Budget.`;

    const k = [
      ["Budget", fmt0(s.B)],
      ["Ausgegeben", fmt(s.spent)],
      ["Verfügbar", fmt(s.remaining), s.remaining < 0],
      ["Pro Tag übrig", fmt(Math.max(0, s.perDay))],
      ["Wochenbudget", fmt(s.week.budget)],
      ["Tagesbudget", fmt(s.B / s.p.days)],
      ["Ø pro Tag bisher", fmt(s.spent / (s.today + 1))],
      [`Ø letzte ${s.n7} Tage`, fmt(s.avg7)],
      ["Prognose Ende", fmt0(s.projection), s.B > 0 && s.projection > s.B],
    ];
    $("kpis").innerHTML = k.map(([t, v, neg]) => `<div><dt>${t}</dt><dd${neg ? ' class="neg"' : ""}>${v}</dd></div>`).join("");
    const target = s.B / s.p.days;
    let trend;
    if (!s.B) trend = "Lege oben dein Monatsbudget fest, dann siehst du hier die Tendenz.";
    else if (!s.spent) trend = "Noch keine Ausgaben – volles Budget verfügbar.";
    else {
      const arrow = s.avg7 > target * 1.1 ? "↗" : s.avg7 < target * 0.9 ? "↘" : "→";
      const end = s.B - s.projection;
      trend = `${arrow} Zuletzt Ø ${fmt(s.avg7)} pro Tag bei ${fmt(target)} Tagesbudget. ` +
        (end >= 0 ? `Bei diesem Tempo bleiben am Ende etwa ${fmt0(end)} übrig.` : `Bei diesem Tempo wird das Budget um etwa ${fmt0(-end)} überschritten.`);
    }
    $("trend").textContent = trend;

    burnChart(s); dailyChart(s);

    const cats = CATS.map((c) => ({ ...c, v: s.byCat[c.id] || 0 })).sort((a, b) => b.v - a.v);
    const maxC = Math.max(1, ...cats.map((c) => c.v));
    $("catBars").innerHTML = s.spent ? cats.map((c) => `<li><span class="name">${c.label}</span>
      <span class="amt">${fmt(c.v)}<small>${Math.round((c.v / s.spent) * 100)} %</small></span>
      <span class="track"><i data-w="${(c.v / maxC) * 100}"></i></span></li>`).join("") : `<li class="empty">Noch keine Ausgaben.</li>`;

    $("weekBars").innerHTML = s.B ? s.weeks.map((w) => {
      const now = w === s.week, future = w.from > s.today, d = w.budget - w.spent;
      const note = future ? "geplant" : now ? (d >= 0 ? `noch ${fmt0(d)}` : `${fmt0(-d)} drüber`) : (d >= 0 ? `${fmt0(d)} übrig` : `${fmt0(-d)} drüber`);
      return `<li${future ? ' class="future"' : ""}><span class="name">${now ? "<b>" : ""}${esc(weekLabel(s.p, w))}${now ? "</b>" : ""}</span>
        <span class="amt">${future ? fmt0(w.budget) : `${fmt0(w.spent)} / ${fmt0(w.budget)}`}<small>${note}</small></span>
        <span class="track"><i class="${w.spent > w.budget ? "over" : ""}" data-w="${w.budget ? Math.min(100, (w.spent / w.budget) * 100) : w.spent ? 100 : 0}"></i></span></li>`;
    }).join("") : `<li class="empty">Lege oben dein Monatsbudget fest.</li>`;

    const hist = [];
    for (let i = -1; i >= -12; i--) {
      const p = periodOf(new Date(), i);
      const sp = inPeriod(p).reduce((sum, e) => sum + e.a, 0);
      if (sp) hist.push({ p, sp, B: budgetOf(p) });
    }
    $("history").innerHTML = hist.length ? hist.map(({ p, sp, B }) => {
      const d = B - sp;
      return `<li><span class="name">${dShort(p.start)} – ${dShort(new Date(p.end - DAY))}</span>
        <span class="amt">${fmt0(sp)}<small>${B ? (d >= 0 ? `${fmt0(d)} übrig` : `${fmt0(-d)} drüber`) : ""}</small></span>
        <span class="track"><i class="${B && sp > B ? "over" : ""}" data-w="${B ? Math.min(100, (sp / B) * 100) : 100}"></i></span></li>`;
    }).join("") : `<li class="empty">Noch keine abgeschlossenen Zeiträume.</li>`;
    const who = {};
    for (const e of s.list) who[e.w || "–"] = (who[e.w || "–"] || 0) + e.a;
    const whoList = Object.entries(who).sort((a, b) => b[1] - a[1]);
    $("whoCard").hidden = !data.sync || !whoList.length;
    $("whoBars").innerHTML = whoList.map(([n, v]) => `<li><span class="name">${esc(n)}</span>
      <span class="amt">${fmt(v)}<small>${Math.round((v / s.spent) * 100)} %</small></span>
      <span class="track"><i data-w="${(v / whoList[0][1]) * 100}"></i></span></li>`).join("");
    renderSync();

    // Breiten per CSSOM setzen – Inline-style-Attribute verbietet die CSP
    for (const i of document.querySelectorAll("#cockpit [data-w]")) i.style.width = `${i.dataset.w}%`;

    const all = [...s.list].sort((a, b) => b.t - a.t);
    $("countInfo").textContent = all.length ? `${all.length} in diesem Zeitraum` : "";
    let html = "", lastDay = "";
    for (const e of all) {
      const dk = keyOf(new Date(e.t));
      if (dk !== lastDay) {
        lastDay = dk;
        const sum = all.filter((x) => keyOf(new Date(x.t)) === dk).reduce((t, x) => t + x.a, 0);
        html += `<li class="day"><span>${esc(dWeek(new Date(e.t)))}</span><span>${fmt(sum)}</span></li>`;
      }
      html += rowHtml(e);
    }
    $("allEntries").innerHTML = html || `<li class="empty">Noch keine Ausgaben in diesem Zeitraum.</li>`;
  }

  $("budgetInput").addEventListener("change", () => {
    const c = parseAmount($("budgetInput").value);
    if (!c) { toast("Bitte einen Betrag eingeben, z. B. 600"); render(); return; }
    data.budget = c;
    touchSettings();
    sinceFix();
    data.budgets[periodOf(new Date()).key] = c;   // gilt ab dem laufenden Zeitraum
    save(); render(); toast(`Budget: ${fmt0(c)} pro Monat`);
  });
  $("budgetInput").addEventListener("keydown", (ev) => { if (ev.key === "Enter") $("budgetInput").blur(); });
  $("resetDay").addEventListener("change", () => {
    data.resetDay = Math.min(28, Math.max(1, +$("resetDay").value || 25));
    touchSettings(); save(); render();
  });

  // ---------- Diagramme (SVG) ----------
  const NS = "http://www.w3.org/2000/svg";
  function frame(el, yMax, days) {
    const W = el.clientWidth || 320, H = el.clientHeight || 170, L = 44, R = 6, T = 8, Bt = 20;
    const x = (i) => L + (i / days) * (W - L - R);
    const y = (v) => T + (1 - v / yMax) * (H - T - Bt);
    let g = "";
    for (const f of [0, 0.5, 1]) {
      const v = yMax * f;
      g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 6}" y="${y(v) + 3}" text-anchor="end">${fmt0(v)}</text>`;
    }
    return { W, H, L, R, T, Bt, x, y, g };
  }
  function axisLabels(f, s, step) {
    let out = "";
    for (let i = 0; i < s.p.days; i += step) {
      const d = new Date(s.p.start.getFullYear(), s.p.start.getMonth(), s.p.start.getDate() + i);
      out += `<text class="axis" x="${f.x(i + 0.5)}" y="${f.H - 4}" text-anchor="middle">${d.getDate()}.</text>`;
    }
    return out;
  }
  const dateOf = (s, i) => new Date(s.p.start.getFullYear(), s.p.start.getMonth(), s.p.start.getDate() + i);

  function burnChart(s) {
    const el = $("burn");
    const cum = []; let run = 0;
    for (let i = 0; i <= s.today; i++) { run += s.daily[i]; cum.push(run); }
    const yMax = Math.max(s.B, run, 100) * 1.08;
    const f = frame(el, yMax, s.p.days);
    const pts = [[f.x(0), f.y(0)], ...cum.map((v, i) => [f.x(i + 1), f.y(v)])];
    const line = pts.map((p) => p.join(",")).join(" ");
    const area = `${line} ${f.x(cum.length)},${f.y(0)} ${f.x(0)},${f.y(0)}`;
    el.innerHTML = `<svg viewBox="0 0 ${f.W} ${f.H}" role="img" aria-label="Kumulierte Ausgaben im Vergleich zum Plan">${f.g}
      <line class="plan" x1="${f.x(0)}" y1="${f.y(0)}" x2="${f.x(s.p.days)}" y2="${f.y(s.B)}"/>
      <polygon class="area" points="${area}"/><polyline class="line" points="${line}"/>
      <circle class="dot" cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="4.5"/>
      ${axisLabels(f, s, 5)}<g id="burnCursor"></g></svg>`;
    hover(el, f, s, (i) => {
      if (i > s.today) return null;
      const plan = s.B * (i + 1) / s.p.days;
      return { x: f.x(i + 1), y: f.y(cum[i]), text: `${dWeek(dateOf(s, i))}<br>ausgegeben ${fmt(cum[i])}<br>Plan ${fmt(plan)}` };
    }, true);
  }

  function dailyChart(s) {
    const el = $("daily");
    const target = s.B / s.p.days;
    const yMax = Math.max(target, ...s.daily, 100) * 1.1;
    const f = frame(el, yMax, s.p.days);
    const bw = Math.max(2, (f.W - f.L - f.R) / s.p.days - 2);
    let bars = "";
    for (let i = 0; i <= s.today; i++) {
      const v = s.daily[i];
      if (!v) continue;
      const h = Math.max(2, f.y(0) - f.y(v)), x = f.x(i) + 1, r = Math.min(4, bw / 2, h / 2);
      // oben abgerundet, unten bündig an der Grundlinie
      bars += `<path class="bar${v > target ? " over" : ""}" d="M${x},${f.y(0)} v${-(h - r)} q0,${-r} ${r},${-r} h${bw - 2 * r} q${r},0 ${r},${r} v${h - r} z"/>`;
    }
    el.innerHTML = `<svg viewBox="0 0 ${f.W} ${f.H}" role="img" aria-label="Ausgaben pro Tag">${f.g}${bars}
      <line class="plan" x1="${f.L}" x2="${f.W - f.R}" y1="${f.y(target)}" y2="${f.y(target)}"/>
      ${axisLabels(f, s, 5)}<g id="dailyCursor"></g></svg>`;
    hover(el, f, s, (i) => {
      if (i > s.today) return null;
      return { x: f.x(i + 0.5), y: f.y(s.daily[i]), text: `${dWeek(dateOf(s, i))}<br>${fmt(s.daily[i])} · Tagesbudget ${fmt(target)}` };
    }, false);
  }

  // Antippen/Überfahren zeigt den Tageswert
  function hover(el, f, s, info, isLine) {
    const cursor = el.querySelector("g");
    const tip = $("tip");
    const show = (ev) => {
      const box = el.getBoundingClientRect();
      const px = ((ev.clientX - box.left) / box.width) * f.W;
      let i = Math.floor(((px - f.L) / (f.W - f.L - f.R)) * s.p.days - (isLine ? 0.5 : 0));
      i = Math.max(0, Math.min(s.p.days - 1, i));
      const d = info(i);
      if (!d) { hide(); return; }
      cursor.innerHTML = `<line class="cursor" x1="${d.x}" x2="${d.x}" y1="${f.T}" y2="${f.y(0)}"/>${isLine ? `<circle class="dot" cx="${d.x}" cy="${d.y}" r="4.5"/>` : ""}`;
      tip.innerHTML = d.text;
      tip.hidden = false;
      const left = box.left + (d.x / f.W) * box.width;
      tip.style.left = `${Math.min(window.innerWidth - tip.offsetWidth / 2 - 8, Math.max(tip.offsetWidth / 2 + 8, left))}px`;
      tip.style.top = `${box.top + (d.y / f.H) * box.height - 10}px`;
    };
    const hide = () => { cursor.innerHTML = ""; tip.hidden = true; };
    el.onpointermove = show; el.onpointerdown = show; el.onpointerleave = hide;
  }
  window.addEventListener("scroll", () => { $("tip").hidden = true; }, { passive: true });

  // ---------- Sicherung ----------
  async function exportData() {
    const name = `budget-${new Date().toISOString().slice(0, 10)}.json`;
    const json = JSON.stringify({ ...data, sync: undefined, pending: undefined });   // ohne Zugangsschlüssel
    try {
      const file = new File([json], name, { type: "application/json" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Budget – Sicherung" });
        toast("Sicherung verschickt ✓");
        return;
      }
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast("Sicherung gespeichert ✓");
  }
  $("exportBtn").addEventListener("click", exportData);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async () => {
    const f = $("importFile").files[0];
    $("importFile").value = "";
    if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!d || !Array.isArray(d.entries) || !d.entries.every((e) => e && typeof e.t === "number" && typeof e.a === "number" && e.id)) throw new Error();
      if (!confirm(`Sicherung mit ${d.entries.length} Ausgaben laden? Die aktuellen Daten werden ersetzt.`)) return;
      data = { ...fresh(), ...d, sync: data.sync, pending: {} };
      for (const e of data.entries) mark(e, false);
      touchSettings();
      sinceFix();
      save(); render(); toast("Sicherung geladen ✓");
    } catch (e) { toast("Diese Datei ist keine gültige Budget-Sicherung."); }
  });
  $("wipeBtn").addEventListener("click", () => {
    const shared = data.sync ? " auf diesem Gerät (die gemeinsame Tabelle bleibt erhalten, die Verbindung wird getrennt)" : "";
    if (!confirm(`Wirklich alle Ausgaben und Einstellungen${shared} löschen?`)) return;
    if (!confirm("Ganz sicher? Das lässt sich nicht rückgängig machen.")) return;
    data = fresh();
    save(); render(); toast("Alle Daten gelöscht");
  });

  // ---------- Gemeinsam nutzen (Google-Tabelle) ----------
  let syncTimer, syncing = false, syncAgain = false;
  function scheduleSync() {
    if (!data.sync) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 800);
  }
  async function sync() {
    const cfg = data.sync;
    if (!cfg) return;
    if (syncing) { syncAgain = true; return; }
    syncing = true;
    clearTimeout(syncTimer);
    const put = Object.values(data.pending);
    const su = data.su;
    const body = { key: cfg.key, put: put.map((p) => ({ ...p, c: catLabel(p.c) })) };
    if (cfg.init) body.init = true;
    if (data.sDirty) { body.settings = Object.fromEntries(SETTINGS.map((k) => [k, data[k]])); body.su = su; }
    try {
      // Fehler genau benennen, damit die Einrichtung prüfbar ist
      let res, r;
      try {
        res = await fetch(cleanUrl(cfg.url), { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) });
      } catch (e) { throw new Error(navigator.onLine && !cfg.last ? "reach" : "offline"); }   // nach erstem Erfolg: Funkloch
      if (!res.ok) throw new Error(`http ${res.status}`);
      try { r = JSON.parse(await res.text()); } catch (e) { throw new Error("html"); }
      if (r.error) throw new Error(r.error === "key" ? "key" : `script: ${r.error}`);
      if (data.sync === cfg) {
        // Übertragenes abhaken, außer es wurde währenddessen erneut geändert
        for (const x of put) if (data.pending[x.id] && data.pending[x.id].u === x.u) delete data.pending[x.id];
        if (body.settings && data.su === su) data.sDirty = false;
        if (!data.sDirty && r.settings && r.su > (data.su || 0)) {
          for (const k of SETTINGS) if (r.settings[k] != null) data[k] = r.settings[k];
          data.su = r.su;
        }
        // Stand der Tabelle + eigene, noch offene Änderungen
        const all = new Map(r.entries.map((e) => [e.id, { id: e.id, t: e.t, a: e.a, c: catId(e.c), ...(e.n ? { n: e.n } : {}), ...(e.w ? { w: e.w } : {}) }]));
        for (const p of Object.values(data.pending)) {
          if (p.x) all.delete(p.id);
          else { const { u, ...e } = p; all.set(p.id, e); }
        }
        data.entries = [...all.values()];
        delete cfg.init;
        cfg.last = Date.now();
        cfg.err = "";
      }
    } catch (e) {
      cfg.err = e.message || "offline";
    } finally {
      syncing = false;
    }
    store();
    render();
    if (syncAgain) { syncAgain = false; sync(); }
  }
  function syncText() {
    const cfg = data.sync;
    if (!cfg) return "";
    const open = Object.keys(data.pending).length + (data.sDirty ? 1 : 0);
    const err = cfg.err || "";
    if (!err && !cfg.last) return "Gemeinsam · verbinde …";
    if (err === "key") return "Gemeinsam · Zugang abgelehnt – Verbindung im Cockpit prüfen";
    if (err === "reach") return "Gemeinsam · Skript nicht erreichbar – Bereitstellung prüfen: Web-App, Zugriff „Jeder“";
    if (err === "html") return "Gemeinsam · Skript antwortet nicht richtig – Bereitstellung prüfen: Web-App, Zugriff „Jeder“";
    if (err.startsWith("http")) return `Gemeinsam · Skript-Fehler (${err.toUpperCase()}) – URL prüfen`;
    if (err.startsWith("script")) return `Gemeinsam · Fehler im Skript: ${err.slice(8)}`;
    if (err) return `Gemeinsam · offline${open ? ` · ${open} Änderung${open > 1 ? "en" : ""} warten` : ""}`;
    return `Gemeinsam · abgeglichen ${new Date(cfg.last).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
  }
  function renderSync() {
    const on = !!data.sync;
    $("syncSetup").hidden = on;
    $("syncActive").hidden = !on;
    if (on) $("syncInfo").textContent = `${syncText()}${data.sync.me ? ` · du bist „${data.sync.me}“` : ""}.`;
  }
  // Bei mehreren Google-Konten kopiert der Browser …/macros/u/1/s/…/exec – das schlägt fehl
  const cleanUrl = (url) => url.replace(/\/macros\/u\/\d+\//, "/macros/");
  const b64 = (str) => btoa(unescape(encodeURIComponent(str)));
  const unb64 = (str) => decodeURIComponent(escape(atob(str)));
  function startSync(cfg) {
    data.sync = cfg;
    data.pending = {};
    // eigene bisherigen Einträge kommen in den gemeinsamen Topf
    for (const e of data.entries) { if (!e.w && cfg.me) e.w = cfg.me; mark(e, false); }
  }
  $("syncConnect").addEventListener("click", () => {
    const url = cleanUrl($("syncUrl").value.trim());
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) { toast("Bitte die Web-App-URL (…/exec) aus Apps Script einfügen."); return; }
    const key = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, "0")).join("");
    startSync({ url, key, me: $("syncMe").value.trim(), init: true });
    touchSettings();
    store(); render(); sync();
  });
  $("syncInvite").addEventListener("click", async () => {
    const link = `${location.origin}${location.pathname}#join=${b64(JSON.stringify({ u: cleanUrl(data.sync.url), k: data.sync.key, n: $("inviteName").value.trim() }))}`;
    const text = "Unser gemeinsames Budget – Link öffnen, dann „Zum Startbildschirm hinzufügen“:";
    try {
      if (navigator.share) { await navigator.share({ title: "Budget", text, url: link }); return; }
    } catch (e) {
      if (e && e.name === "AbortError") return;
    }
    try { await navigator.clipboard.writeText(`${text} ${link}`); toast("Einladungslink kopiert ✓"); }
    catch (e) { prompt("Diesen Link weitergeben:", link); }
  });
  $("syncNow").addEventListener("click", () => { sync(); toast("Gleiche ab …"); });
  $("syncDisconnect").addEventListener("click", () => {
    if (!confirm("Verbindung trennen? Die Daten bleiben in der Tabelle und auf diesem Gerät.")) return;
    data.sync = null; data.pending = {}; data.sDirty = false;
    store(); render();
  });
  // Einladungslink #join=… übernehmen
  function joinFromHash() {
    const m = location.hash.match(/^#join=(.+)$/);
    if (!m) return;
    history.replaceState(null, "", location.pathname + location.search);
    try {
      const j = JSON.parse(unb64(decodeURIComponent(m[1])));
      if (!j.u || !j.k) throw new Error();
      if (data.sync && data.sync.key === j.k) return;
      const me = (prompt("Dein Name (steht bei deinen Einträgen):", j.n || "") ?? j.n ?? "").trim();
      startSync({ url: j.u, key: j.k, me });
      data.su = 0; data.sDirty = false;   // Budget und Stichtag kommen aus der Tabelle
      store();
      toast("Mit dem gemeinsamen Budget verbunden ✓");
    } catch (e) { toast("Der Einladungslink ist ungültig."); }
  }

  // ---------- Toast ----------
  let toastTimer, undoFn;
  function toast(msg, undo) {
    $("toastText").textContent = msg;
    undoFn = undo;
    $("toastUndo").hidden = !undo;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $("toast").hidden = true; undoFn = null; }, undo ? 5000 : 3000);
  }
  $("toastUndo").addEventListener("click", () => {
    const f = undoFn; undoFn = null; $("toast").hidden = true;
    if (f) f();
  });

  // ---------- Ansicht ----------
  const isCockpit = () => location.hash === "#cockpit";
  function render() {
    const s = stats();
    renderHome(s);
    $("syncState").textContent = syncText();
    $("syncState").hidden = !data.sync;
    if (isCockpit()) renderCockpit(s);
  }
  function route() {
    $("home").hidden = isCockpit();
    $("cockpit").hidden = !isCockpit();
    $("tip").hidden = true; $("toast").hidden = true;
    window.scrollTo(0, 0);
    render();
  }
  let pushed = false;   // Cockpit per Knopf geöffnet → Zurück-Geste des Handys schließt es
  $("openCockpit").addEventListener("click", () => { pushed = true; location.hash = "cockpit"; });
  $("closeCockpit").addEventListener("click", () => {
    if (pushed) { pushed = false; history.back(); return; }
    history.replaceState(null, "", location.pathname + location.search);
    route();
  });
  window.addEventListener("hashchange", route);
  window.addEventListener("resize", () => { if (isCockpit()) render(); });
  // Neuer Tag/Zeitraum, während die App offen bleibt
  // Neue Einträge des anderen holen: beim Öffnen, bei Netz und jede Minute
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { render(); sync(); } });
  window.addEventListener("online", sync);
  setInterval(() => { render(); if (!document.hidden) sync(); }, 60000);

  joinFromHash();
  sinceFix();
  if (!data.budget && !data.sync && !isCockpit()) location.replace("#cockpit");
  route();
  if (!data.budget && !data.sync) setTimeout(() => $("budgetInput").focus(), 200);
  sync();

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
