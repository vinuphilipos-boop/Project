/* PO Tracker – daily Performance Obligation scorecard (Reach · Convert · Retain).
   All data stays in this browser (localStorage). Values are in Rs crore unless stated. */
(() => {
  "use strict";
  const KEY = "po-tracker-data-v1";
  // LT philosophy – stages of a Master Plan account (customer from the SOM)
  const STAGES = ["Sprouting", "Seeding", "Budding", "Flowering", "Ripening"];
  const STAGE_DEF = {
    Sprouting: "Does not know LT yet", Seeding: "Introduced to LT", Budding: "Convinced on LT",
    Flowering: "Has specified / recommended LT", Ripening: "Repeatedly specifies / recommends LT",
  };
  // Convert – navigation stages of a project
  const PSTAGES = ["Identified", "LT specified", "Offer submitted", "Negotiation"];
  const ACC_TYPES = ["Consultant", "Architect", "Lighting designer", "Contractor", "Developer / Builder", "Govt / PSU", "Industry / Corporate", "Other"];
  const POTENTIAL = ["High", "Medium", "Low"];
  const TOUCH_TYPES = ["F2F visit", "Joint visit", "Online meeting", "Call"];
  const DECK = [["corp", "LT corporate video"], ["prod", "Product videos"], ["cred", "LT credentials"], ["other", "Other LT Deck content"]];
  const isF2F = (t) => t.type === "F2F visit" || t.type === "Joint visit";
  const PRINCIPLES = ["SOP compliance", "Error-free output", "Report the problem", "Problem solver",
    "Perfect communication", "LT Values", "LT Ethos"];
  const IND = [
    ["visits", "F2F visits"],
    ["pipe", "Pipeline vs remaining"],
    ["book", "Booking vs pro-rata"],
    ["coll", "Collections vs dues"],
    ["subs", "Submissions on time, FTR"],
    ["deck", "LT Deck use"],
  ];
  const STATUS_TXT = { g: "Green", a: "Amber", r: "Red", na: "No data" };
  const RANK = { na: 0, g: 1, a: 2, r: 3 };
  // The tracker covers Q3 and Q4 of FY 2026-27 only (array indices 2 and 3 of each owner's quarters).
  const PERIOD = { start: "2026-10-01", end: "2027-03-31", qs: [2, 3], label: "Q3+Q4 FY26-27" };
  const TARGETS = { head: 30, umesh: 6, santhosh: 6, mithunn: 6 }; // Rs Cr for Q3+Q4
  const half = (t) => [0, 0, Math.round(t / 2 * 100) / 100, Math.round(t / 2 * 100) / 100];

  // ---------- defaults ----------
  function defaults() {
    const owner = (id, name, isHead) => ({
      id, name, isHead: !!isHead, annual: TARGETS[id], q: half(TARGETS[id]), opening: [0, 0, 0, 0], aovLakh: 25,
    });
    return {
      version: 3,
      settings: {
        trackerStart: "2026-11-16", workDays: [1, 2, 3, 4, 5, 6], holidays: [], deviceOwner: "head",
        bands: { visitsG: 4, visitsA: 3, pipeG: 5, pipeA: 4, bookG: 100, bookA: 80, collA: 15, privRed: 30, subsA: 1, deckG: 80, deckA: 50 },
        jointPerWeek: 2, stuckDays: 14, touchGapDays: 30,
      },
      owners: [
        owner("head", "Vinu", true),
        owner("umesh", "Umesh Gour"),
        owner("santhosh", "Santhosh Kumar"),
        owner("mithunn", "Mithunn Kumar"),
      ],
      daily: {}, accounts: [], touches: [], projects: [], orders: [], dues: [], subs: [], ethics: [], reviews: {}, snapshots: {}, checks: {},
    };
  }
  // Version 1 tracked the whole FY with the old targets. Version 2 keeps all logged data but limits
  // targets to Q3+Q4 with the revised figures, split equally (edit in Settings).
  function migrate(d) {
    if (d && d.version === 1 && Array.isArray(d.owners)) {
      for (const o of d.owners) {
        if (o.id in TARGETS) { o.annual = TARGETS[o.id]; o.q = half(TARGETS[o.id]); }
        else { o.q = [0, 0, num(o.q?.[2]), num(o.q?.[3])]; o.annual = o.q[2] + o.q[3]; }
        o.opening = [0, 0, num(o.opening?.[2]), 0];
        if (o.id === "head" && o.name === "Sales Head (me)") o.name = "Vinu";
      }
      d.snapshots = {}; // computed with the old targets
      d.version = 2;
    }
    // Version 3: Sprouting→Ripening now describes Master Plan accounts; projects get navigation stages.
    if (d && d.version === 2) {
      const map = { Sprouting: "Identified", Seeding: "Identified", Budding: "Identified", Flowering: "LT specified", Ripening: "Negotiation" };
      for (const p of d.projects || []) if (!PSTAGES.includes(p.stage)) p.stage = map[p.stage] || "Identified";
      d.accounts = d.accounts || []; d.touches = d.touches || [];
      d.snapshots = {};
      d.version = 3;
    }
    return d;
  }
  function load() {
    try {
      const d = migrate(JSON.parse(localStorage.getItem(KEY)));
      if (d && d.version === 3) {
        const def = defaults();
        d.settings = { ...def.settings, ...d.settings, bands: { ...def.settings.bands, ...(d.settings || {}).bands } };
        for (const k of ["daily", "reviews", "snapshots", "checks"]) d[k] = d[k] || {};
        for (const k of ["accounts", "touches", "projects", "orders", "dues", "subs", "ethics"]) d[k] = d[k] || [];
        return d;
      }
    } catch (e) { /* fall through */ }
    return defaults();
  }
  const save = () => localStorage.setItem(KEY, JSON.stringify(S));

  // ---------- helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const cr = (v) => "Rs " + (Math.round(v * 100) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " Cr";
  const pct = (v) => (isFinite(v) ? Math.round(v) + "%" : "–");
  const toD = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); };
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const addDays = (s, n) => { const d = toD(s); d.setDate(d.getDate() + n); return ymd(d); };
  const diffDays = (a, b) => Math.round((toD(a) - toD(b)) / 86400000); // a - b
  const todayStr = () => ymd(new Date());
  const fmtD = (s) => s ? toD(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "–";
  const fmtDay = (s) => toD(s).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
  const owner = (id) => S.owners.find((o) => o.id === id);
  const ownerName = (id) => (owner(id) || { name: id }).name;
  const members = () => S.owners.filter((o) => !o.isHead);
  const chip = (st, extra = "") => `<span class="chip ${st}">${STATUS_TXT[st]}</span>${extra ? `<span class="cell-val">${extra}</span>` : ""}`;
  const tag = (st, text) => `<span class="chip ${st}">${esc(text)}</span>`; // status chip with its own label
  const worst = (arr) => arr.reduce((w, s) => (RANK[s] > RANK[w] ? s : w), "na");
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600); }

  // Load after the helpers above exist (migrate() uses num()).
  let S = load();
  save();

  function isWork(s) {
    return S.settings.workDays.includes(toD(s).getDay()) && !S.settings.holidays.includes(s);
  }
  function workDaysBetween(a, b) { // inclusive
    let n = 0;
    for (let s = a; s <= b; s = addDays(s, 1)) if (isWork(s)) n++;
    return n;
  }
  function prevWorkDays(s, n) { // last n working days ending at s (inclusive), not before tracker start
    const out = [];
    for (let d = s; out.length < n && d >= S.settings.trackerStart; d = addDays(d, -1)) if (isWork(d)) out.push(d);
    return out;
  }
  function weekStart(s) { const d = toD(s); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return ymd(d); } // Monday
  // Indian financial year: Q1 Apr–Jun, Q2 Jul–Sep, Q3 Oct–Dec, Q4 Jan–Mar
  function quarter(s) {
    const d = toD(s); const m = d.getMonth(); const y = d.getFullYear();
    const fy = m >= 3 ? y : y - 1; const q = Math.floor(((m + 9) % 12) / 3);
    const sm = 3 + q * 3; const start = new Date(fy, sm, 1, 12); const end = new Date(fy, sm + 3, 0, 12);
    return { fy, q, start: ymd(start), end: ymd(end), label: `Q${q + 1} FY${String(fy).slice(2)}-${String(fy + 1).slice(2)}` };
  }
  function qBounds(fy, q) { const sm = 3 + q * 3; return { start: ymd(new Date(fy, sm, 1, 12)), end: ymd(new Date(fy, sm + 3, 0, 12)) }; }

  // ---------- measures ----------
  const ordersOf = (o, from, to) => S.orders.filter((x) => x.owner === o && x.date >= from && x.date <= to);
  const sumV = (arr, f = "value") => arr.reduce((t, x) => t + num(x[f]), 0);

  function bookedInQuarter(o, fy, q, asOf) {
    const b = qBounds(fy, q); const to = asOf && asOf < b.end ? asOf : b.end;
    return num(owner(o).opening[q]) + sumV(ordersOf(o, b.start, to));
  }
  function carryInto(o, fy, q) { // shortfall rolls forward from previous quarters of the FY
    let carry = 0;
    for (let i = PERIOD.qs[0]; i < q; i++) carry = Math.max(0, num(owner(o).q[i]) + carry - bookedInQuarter(o, fy, i));
    return carry;
  }
  function received(due, asOf) { return (due.receipts || []).filter((r) => !asOf || r.date <= asOf).reduce((t, r) => t + num(r.amount), 0); }
  function outstanding(due, asOf) { return Math.max(0, num(due.amount) - received(due, asOf)); }
  const qualifiedOpen = (o) => S.projects.filter((p) => p.owner === o && p.status === "open" && p.qualified);

  function metrics(o, D) {
    const B = S.settings.bands; const Q = quarter(D); const ow = owner(o);
    const qTarget = num(ow.q[Q.q]); const carry = carryInto(o, Q.fy, Q.q); const eff = qTarget + carry;
    const booked = bookedInQuarter(o, Q.fy, Q.q, D);
    const remaining = Math.max(0, eff - booked);
    const wdTotal = workDaysBetween(Q.start, Q.end); const wdElapsed = workDaysBetween(Q.start, D);
    const wdLeft = Math.max(0, wdTotal - wdElapsed);
    const proRata = wdTotal ? eff * wdElapsed / wdTotal : eff;
    const bookPct = proRata > 0 ? booked / proRata * 100 : 100;
    const pipeProjects = qualifiedOpen(o); const pipe = sumV(pipeProjects);
    const coverage = remaining > 0 ? pipe / remaining : Infinity;
    const aov = num(ow.aovLakh) / 100 || 0.25;
    const toWin = Math.ceil(remaining / aov - 1e-9);
    const nego = pipeProjects.filter((p) => p.stage === "Negotiation");

    // visits: rolling last 6 working days (today counted once the close is in)
    const closedToday = !!(S.daily[D] && S.daily[D][o] && S.daily[D][o].closedAt);
    const vDays = prevWorkDays(closedToday ? D : addDays(D, -1), 6);
    const visitsIn = (d) => num(S.daily[d]?.[o]?.visitCount);
    const vSum = vDays.reduce((t, d) => t + visitsIn(d), 0);
    const vAvg = vDays.length ? vSum / vDays.length : NaN;
    const missingCloses = vDays.filter((d) => !S.daily[d]?.[o]?.closedAt);
    const wk = weekStart(D); const weekVisits = Object.keys(S.daily).filter((d) => d >= wk && d <= D).reduce((t, d) => t + visitsIn(d), 0);
    const qVisitStart = S.settings.trackerStart > Q.start ? S.settings.trackerStart : Q.start;
    const qVisits = Object.keys(S.daily).filter((d) => d >= qVisitStart && d <= D).reduce((t, d) => t + visitsIn(d), 0);
    const qVisitTarget = 4 * workDaysBetween(qVisitStart, Q.end);

    // collections
    const myDues = S.dues.filter((x) => x.owner === o);
    const overdue = myDues.filter((x) => x.dueDate < D && outstanding(x, D) > 0.0001)
      .map((x) => ({ ...x, days: diffDays(D, x.dueDate), out: outstanding(x, D) }));
    const maxOver = overdue.reduce((m, x) => Math.max(m, x.days), 0);
    const privOver30 = overdue.some((x) => x.private && x.days > B.privRed);
    const dueQ = myDues.filter((x) => x.dueDate >= Q.start && x.dueDate <= D);
    const dueQAmt = sumV(dueQ, "amount");
    const onTimeAmt = dueQ.reduce((t, x) => t + (x.receipts || []).filter((r) => r.date <= x.dueDate).reduce((u, r) => u + num(r.amount), 0), 0);
    const collEff = dueQAmt > 0 ? onTimeAmt / dueQAmt * 100 : NaN;

    // LT Deck use over the same 6 working days
    const tWin = S.touches.filter((t) => t.owner === o && vDays.includes(t.date));
    const tDeck = tWin.filter((t) => (t.deck || []).length);
    const deckPct = tWin.length ? tDeck.length / tWin.length * 100 : NaN;

    // submissions this week
    const wkSubs = S.subs.filter((x) => x.owner === o && x.dueDate >= wk && x.dueDate <= D);
    const slips = wkSubs.filter((x) => (!x.sentDate && x.dueDate < D) || (x.sentDate && x.sentDate > x.dueDate) || x.ftr === "no");

    const st = {};
    st.visits = isNaN(vAvg) ? "na" : vAvg >= B.visitsG ? "g" : vAvg >= B.visitsA ? "a" : "r";
    st.pipe = remaining <= 0 ? "g" : coverage >= B.pipeG ? "g" : coverage >= B.pipeA ? "a" : "r";
    st.book = eff <= 0 ? "na" : bookPct >= B.bookG ? "g" : bookPct >= B.bookA ? "a" : "r";
    st.coll = privOver30 || maxOver > B.collA ? "r" : maxOver > 0 ? "a" : "g";
    st.subs = slips.length === 0 ? "g" : slips.length <= B.subsA ? "a" : "r";
    st.deck = isNaN(deckPct) ? "na" : deckPct >= B.deckG ? "g" : deckPct >= B.deckA ? "a" : "r";
    const stuck = S.projects.filter((p) => p.owner === o && p.status === "open" && p.stageDate && diffDays(D, p.stageDate) >= S.settings.stuckDays);

    return { Q, qTarget, carry, eff, booked, remaining, wdTotal, wdElapsed, wdLeft, proRata, bookPct, pipe, pipeProjects, coverage, aov, toWin,
      qualNeeded: toWin * 5, nego, tWin, deckPct, vAvg, vDays, missingCloses, weekVisits, qVisits, qVisitTarget, overdue, maxOver, privOver30,
      overdueAmt: sumV(overdue, "out"), collEff, slips, wkSubs, st, stuck, closedToday,
      runRate: wdLeft > 0 ? remaining / wdLeft : remaining };
  }

  // Reach: Master Plan accounts
  const lastTouch = (accId) => S.touches.filter((t) => t.accountId === accId).reduce((m, t) => (t.date > m ? t.date : m), "");
  function reach(o, D) {
    const accs = S.accounts.filter((a) => (o === "all" || a.owner === o) && !a.archived);
    const byStage = Object.fromEntries(STAGES.map((st) => [st, accs.filter((a) => a.stage === st)]));
    const wk = weekStart(D); const m30 = addDays(D, -29);
    const movesIn = (from) => accs.reduce((t, a) => t + (a.history || []).filter((h) => h.date >= from && h.date <= D && STAGES.indexOf(h.to) > STAGES.indexOf(h.from)).length, 0);
    const gap = S.settings.touchGapDays;
    const untouched = accs.filter((a) => { const lt = lastTouch(a.id); return !lt ? diffDays(D, a.createdAt || D) >= gap : diffDays(D, lt) >= gap; });
    const dueActions = accs.filter((a) => a.nextDate && a.nextDate <= D);
    const t30 = S.touches.filter((t) => (o === "all" || t.owner === o) && t.date >= m30 && t.date <= D);
    const deck30 = t30.length ? t30.filter((t) => (t.deck || []).length).length / t30.length * 100 : NaN;
    const deckItems = Object.fromEntries(DECK.map(([k]) => [k, t30.filter((t) => (t.deck || []).includes(k)).length]));
    return { accs, byStage, movesWeek: movesIn(wk), movesMonth: movesIn(m30), untouched, dueActions, t30, deck30, deckItems,
      high: accs.filter((a) => a.potential === "High") };
  }
  function setStage(a, to, d) {
    if (!to || a.stage === to) return;
    a.history = a.history || []; a.history.push({ date: d, from: a.stage, to });
    a.stage = to; a.stageDate = d; a.updatedAt = localStamp();
  }

  // snapshots: today's statuses are stored so the escalation ladder has history
  let stCache = {};
  function statusOn(o, d) {
    if (S.snapshots[d]?.[o]) return S.snapshots[d][o];
    const k = o + d;
    return stCache[k] || (stCache[k] = metrics(o, d).st);
  }
  function snapshot(D) {
    if (D !== todayStr()) return;
    S.snapshots[D] = S.snapshots[D] || {};
    for (const ow of S.owners) S.snapshots[D][ow.id] = metrics(ow.id, D).st;
    save();
  }
  function escalation(o, D, m) {
    const days = prevWorkDays(D, 12); // two working weeks
    let step = 0; const why = [];
    for (const [k, label] of IND) {
      const now = m.st[k];
      if (now === "g" || now === "na") continue;
      let redRun = 0, amberRun = 0;
      for (const d of days) { const s = statusOn(o, d)[k]; if (s === "r") redRun++; else break; }
      for (const d of days) { const s = statusOn(o, d)[k]; if (s === "r" || s === "a") amberRun++; else break; }
      let s = now === "a" ? 1 : 2;
      if (now === "a" && amberRun >= 12) s = 2;
      if (now === "r" && redRun >= 12) s = 3;
      if (k === "book" && now === "r" && diffDays(m.Q.end, D) <= 7) s = 4;
      if (s >= step) { if (s > step) why.length = 0; step = s; why.push(label); }
    }
    return { step, why };
  }
  const STEP_TXT = ["On track", "Step 1 · discuss at huddle, fix this week", "Step 2 · joint visits + daily check-in",
    "Step 3 · written improvement plan", "Step 4 · re-allocate, Head closes the gap"];

  function flagsFor(D) {
    const out = []; const B = S.settings.bands;
    for (const ow of S.owners) {
      const m = metrics(ow.id, D); const n = ow.name;
      if (isWork(D) && !m.closedToday) out.push(["a", `${n}: evening close for ${fmtD(D)} not submitted yet`]);
      const miss = m.missingCloses.filter((d) => d !== D);
      if (miss.length) out.push(["r", `${n}: no evening close on ${miss.map(fmtD).join(", ")}`]);
      for (const [k, label] of IND) if (m.st[k] === "r") out.push(["r", `${n}: ${label} is RED`]);
      for (const x of m.overdue.filter((x) => x.private && x.days > B.privRed)) out.push(["r", `${n}: ${x.customer} – private, ${x.days} days overdue (${cr(x.out)}). Head to call personally.`]);
      for (const p of m.nego) {
        const missing = [["dm", "decision-maker"], ["competitor", "competitor"], ["pricePos", "price position"], ["nextMove", "today's move"]].filter(([f]) => !p[f]).map(([, l]) => l);
        if (missing.length) out.push(["a", `${n}: negotiation "${p.name}" missing ${missing.join(", ")}`]);
      }
      const r = reach(ow.id, D);
      const hiGap = r.untouched.filter((a) => a.potential === "High");
      if (hiGap.length) out.push(["a", `${n}: ${hiGap.length} high-potential Master Plan account(s) not met in ${S.settings.touchGapDays}+ days – ${hiGap.slice(0, 4).map((a) => a.name).join(", ")}${hiGap.length > 4 ? "…" : ""}`]);
      if (!r.accs.length) out.push(["a", `${n}: no Master Plan accounts entered yet`]);
      for (const p of m.stuck) out.push(["a", `${n}: "${p.name}" stuck in ${p.stage} for ${diffDays(D, p.stageDate)} days – demo / factory visit?`]);
      for (const x of S.subs.filter((x) => x.owner === ow.id && !x.sentDate && x.dueDate <= D)) out.push([x.dueDate < D ? "r" : "a", `${n}: offer/submission for ${x.customer} ${x.dueDate < D ? "overdue since " + fmtD(x.dueDate) : "due today"}`]);
    }
    // Head's joint visit commitment
    const wk = weekStart(D);
    for (const mb of members()) {
      const jv = jointVisits(mb.id, wk, D);
      const dayIdx = workDaysBetween(wk, D);
      if (dayIdx >= 4 && jv < S.settings.jointPerWeek) out.push(["a", `Head: only ${jv} of ${S.settings.jointPerWeek} joint visits with ${mb.name} this week`]);
    }
    return out;
  }
  function jointVisits(memberId, from, to) {
    let n = 0;
    for (const d of Object.keys(S.daily)) if (d >= from && d <= to) {
      const h = S.daily[d].head; if (h && (h.jointWith || []).includes(memberId)) n++;
    }
    return n;
  }

  // ---------- views ----------
  const clampD = (d) => (d < PERIOD.start ? PERIOD.start : d > PERIOD.end ? PERIOD.end : d);
  let D = clampD(todayStr());
  let selOwner = S.settings.deviceOwner || "head";
  const views = { dashboard, daily, master, pipeline, orders, dues, subs, review, ethics, settings };

  function render() {
    stCache = {};
    const tab = (location.hash || "#dashboard").slice(1);
    const fn = views[tab] || dashboard;
    $$("nav#tabs a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + (views[tab] ? tab : "dashboard")));
    $("#as-of").value = D;
    $("#view").innerHTML = fn();
    bind[views[tab] ? tab : "dashboard"]?.();
  }
  const bind = {};
  function ownerTabs(includeAll = false) {
    const list = (includeAll ? [{ id: "all", name: "All" }] : []).concat(S.owners);
    return `<div class="owner-tabs no-print">${list.map((o) => `<button type="button" data-owner="${o.id}" class="${o.id === selOwner ? "on" : ""}">${esc(o.name)}</button>`).join("")}</div>`;
  }
  function bindOwnerTabs() { $$("[data-owner]").forEach((b) => b.onclick = () => { selOwner = b.dataset.owner; render(); }); }
  const ownerOpts = (sel) => S.owners.map((o) => `<option value="${o.id}" ${o.id === sel ? "selected" : ""}>${esc(o.name)}</option>`).join("");

  // ----- Scorecard -----
  function dashboard() {
    snapshot(D);
    const Q = quarter(D); const ms = Object.fromEntries(S.owners.map((o) => [o.id, metrics(o.id, D)]));
    const teamEff = S.owners.reduce((t, o) => t + ms[o.id].eff, 0); const teamBooked = S.owners.reduce((t, o) => t + ms[o.id].booked, 0);
    const teamAnnual = S.owners.reduce((t, o) => t + num(o.annual), 0);
    const teamFY = S.owners.reduce((t, o) => t + PERIOD.qs.reduce((u, q) => u + (qBounds(Q.fy, q).start <= D ? bookedInQuarter(o.id, Q.fy, q, D) : 0), 0), 0);
    const teamPipe = S.owners.reduce((t, o) => t + ms[o.id].pipe, 0); const teamRem = S.owners.reduce((t, o) => t + ms[o.id].remaining, 0);
    const teamOver = S.owners.reduce((t, o) => t + ms[o.id].overdueAmt, 0);
    const proRataTeam = S.owners.reduce((t, o) => t + ms[o.id].proRata, 0);
    const flags = flagsFor(D);
    const openingsMissing = S.owners.every((o) => !num(o.opening[2])) && !S.orders.some((x) => x.date < S.settings.trackerStart);
    const checkTime = S.checks[D];
    const wk = weekStart(D);

    return `
    ${openingsMissing ? `<div class="banner"><b>Set up first:</b> check each owner's Q3 and Q4 targets and enter the Q3 orders already booked before ${fmtD(S.settings.trackerStart)} in <a href="#settings">Settings</a>. Until then, Q3 bookings before that date count as zero.</div>` : ""}
    <div class="tiles">
      <div class="tile"><div class="label">Team booking · ${Q.label}</div><div class="value">${cr(teamBooked)}</div><div class="sub">of ${cr(teamEff)} (incl. carry-forward) · ${pct(teamBooked / proRataTeam * 100)} of pro-rata</div></div>
      <div class="tile"><div class="label">Team booking · ${PERIOD.label}</div><div class="value">${cr(teamFY)}</div><div class="sub">of ${cr(teamAnnual)} target · ${pct(teamFY / teamAnnual * 100)}</div></div>
      <div class="tile"><div class="label">Qualified pipeline</div><div class="value">${cr(teamPipe)}</div><div class="sub">${teamRem > 0 ? (teamPipe / teamRem).toFixed(1) + "× remaining (need 5×)" : "target met"}</div></div>
      <div class="tile"><div class="label">Overdue collections</div><div class="value">${cr(teamOver)}</div><div class="sub">as of ${fmtD(D)}</div></div>
      <div class="tile"><div class="label">Working days left in ${Q.label}</div><div class="value">${ms.head.wdLeft}</div><div class="sub">of ${ms.head.wdTotal}</div></div>
    </div>

    <div class="card">
      <div class="row"><h2>Daily scorecard · ${fmtDay(D)}</h2><span class="spacer"></span><span class="small muted">Green keep going · Amber fix this week · Red Head steps in</span></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Owner</th>${IND.map(([, l]) => `<th>${l}</th>`).join("")}<th>Escalation</th><th>Last 12 working days</th></tr></thead>
        <tbody>${S.owners.map((o) => {
          const m = ms[o.id]; const e = escalation(o.id, D, m);
          const days = prevWorkDays(D, 12).reverse();
          return `<tr>
            <td><b>${esc(o.name)}</b><span class="cell-val">Q3+Q4 target ${cr(num(o.annual))}</span></td>
            <td>${chip(m.st.visits, isNaN(m.vAvg) ? "no closes yet" : `${m.vAvg.toFixed(1)}/day · wk ${m.weekVisits}/24`)}</td>
            <td>${chip(m.st.pipe, m.remaining > 0 ? `${m.coverage.toFixed(1)}× · ${cr(m.pipe)}` : "target met")}</td>
            <td>${chip(m.st.book, `${pct(m.bookPct)} · ${cr(m.booked)}`)}</td>
            <td>${chip(m.st.coll, m.overdue.length ? `${m.overdue.length} overdue · max ${m.maxOver}d` : "nothing overdue")}</td>
            <td>${chip(m.st.subs, `${m.slips.length} slip(s) this week`)}</td>
            <td>${chip(m.st.deck, m.tWin.length ? `${pct(m.deckPct)} of ${m.tWin.length} meetings` : "no meetings logged")}</td>
            <td><span class="step s${e.step}">${STEP_TXT[e.step]}</span>${e.why.length ? `<span class="cell-val">${e.why.join(", ")}</span>` : ""}</td>
            <td><div class="strip">${days.map((d) => { const s = worst(Object.values(statusOn(o.id, d))); return `<span class="${s}" title="${fmtD(d)}: worst indicator ${STATUS_TXT[s]}"></span>`; }).join("")}</div><span class="cell-val">worst indicator per day</span></td>
          </tr>`; }).join("")}</tbody>
      </table></div>
    </div>

    <div class="grid">
      <div class="card">
        <div class="row"><h2>Captain's check · reds for tomorrow's huddle</h2></div>
        ${checkTime ? `<div class="banner ${checkTime.slice(11, 16) <= "19:00" ? "g" : ""}">Reviewed at ${checkTime.slice(11, 16)}${checkTime.slice(11, 16) > "19:00" ? " (after 7:00 pm)" : ""}</div>` : ""}
        ${flags.length ? `<ul class="flags">${flags.sort((a, b) => RANK[b[0]] - RANK[a[0]]).map(([s, t]) => `<li class="${s}"><b>${s === "r" ? "RED" : "AMBER"}</b> · ${esc(t)}</li>`).join("")}</ul>` : `<p>All clear.</p>`}
        <button id="do-check" type="button">Mark today's review done</button>
      </div>
      <div class="card">
        <h2>My commitments · week of ${fmtD(wk)}</h2>
        <table><thead><tr><th>Joint visits with</th><th class="num">This week</th><th>Status</th></tr></thead><tbody>
        ${members().map((mb) => { const n = jointVisits(mb.id, wk, D); const st = n >= S.settings.jointPerWeek ? "g" : workDaysBetween(wk, D) >= 4 ? "r" : "a";
          return `<tr><td>${esc(mb.name)}</td><td class="num">${n} / ${S.settings.jointPerWeek}</td><td>${chip(st)}</td></tr>`; }).join("")}
        </tbody></table>
        <p class="small muted">Logged in the Head's evening close. Also: every negotiation pre-agreed (price floor, terms, competitor counter) and overdue private customers called daily.</p>
      </div>
    </div>

    <h2>Your quarter in numbers · ${Q.label}</h2>
    <div class="grid">${S.owners.map((o) => ownerCard(o, ms[o.id])).join("")}</div>`;
  }
  function ownerCard(o, m) {
    const meter = (v, t, mark) => `<div class="meter"><span style="width:${Math.min(100, t > 0 ? v / t * 100 : 100)}%"></span>${mark != null ? `<i style="left:${Math.min(100, mark)}%" title="pro-rata today"></i>` : ""}</div>`;
    return `<div class="card">
      <h3 style="margin-top:0">${esc(o.name)}</h3>
      <div class="small">Booked <b>${cr(m.booked)}</b> of ${cr(m.eff)} ${m.carry > 0 ? `<span class="muted">(Q target ${cr(m.qTarget)} + carry ${cr(m.carry)})</span>` : ""}</div>
      ${meter(m.booked, m.eff, m.eff > 0 ? m.proRata / m.eff * 100 : null)}
      <div class="small">Pipeline <b>${cr(m.pipe)}</b> of ${cr(m.remaining * 5)} needed (5× remaining)</div>
      ${meter(m.pipe, m.remaining * 5)}
      <div class="small">Visits this quarter <b>${m.qVisits}</b> of ~${m.qVisitTarget}</div>
      ${meter(m.qVisits, m.qVisitTarget)}
      <table class="small"><tbody>
        <tr><td>Remaining to book</td><td class="num">${cr(m.remaining)}</td></tr>
        <tr><td>Run-rate needed / working day</td><td class="num">${cr(m.runRate)}</td></tr>
        <tr><td>Projects still to win (at ${num(o.aovLakh)} L avg)</td><td class="num">${m.toWin}</td></tr>
        <tr><td>Qualified projects needed (5×) / in pipeline</td><td class="num">${m.qualNeeded} / ${m.pipeProjects.length}</td></tr>
        <tr><td>Projects at negotiation: needed ~2× / actual</td><td class="num">${m.toWin * 2} / ${m.nego.length}</td></tr>
        <tr><td>Collections paid on due date (QTD)</td><td class="num">${pct(m.collEff)}</td></tr>
        <tr><td>Overdue amount</td><td class="num">${cr(m.overdueAmt)}</td></tr>
      </tbody></table>
    </div>`;
  }
  bind.dashboard = () => {
    $("#do-check").onclick = () => { const n = new Date(); S.checks[D] = `${D}T${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`; save(); render(); };
  };

  // ----- Huddle & Close -----
  function entry(d, o) { S.daily[d] = S.daily[d] || {}; S.daily[d][o] = S.daily[d][o] || {}; return S.daily[d][o]; }
  const accName = (id) => (S.accounts.find((a) => a.id === id) || {}).name || "(unknown account)";
  const stageChip = (st) => `<span class="stage st${STAGES.indexOf(st)}" title="${esc(STAGE_DEF[st] || "")}">${esc(st)}</span>`;
  const deckTxt = (keys) => (keys || []).map((k) => (DECK.find(([x]) => x === k) || [, k])[1]).join(", ");
  function accountOpts(o, sel = "") {
    const accs = S.accounts.filter((a) => a.owner === o && !a.archived).sort((a, b) => a.name.localeCompare(b.name));
    return STAGES.map((st) => { const xs = accs.filter((a) => a.stage === st); return xs.length ? `<optgroup label="${st}">${xs.map((a) => `<option value="${a.id}" ${a.id === sel ? "selected" : ""}>${esc(a.name)}${a.potential === "High" ? " ★" : ""}</option>`).join("")}</optgroup>` : ""; }).join("");
  }
  function daily() {
    if (selOwner === "all") selOwner = "head";
    const o = selOwner; const ow = owner(o); const e = S.daily[D]?.[o] || {}; const m = metrics(o, D); const r = reach(o, D);
    const dueSoon = S.dues.filter((x) => x.owner === o && outstanding(x, D) > 0.0001 && x.dueDate <= addDays(D, 3)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const todaysOrders = S.orders.filter((x) => x.owner === o && x.date === D);
    const plan = e.planItems || [];
    const touches = S.touches.filter((t) => t.owner === o && t.date === D);
    const f2fToday = touches.filter(isF2F).length;
    const offers = S.projects.filter((p) => p.owner === o && p.status === "open" && p.stage === "Offer submitted");
    const attention = [...new Map([...r.dueActions, ...r.untouched.filter((a) => a.potential === "High")].map((a) => [a.id, a])).values()].slice(0, 8);
    return `${ownerTabs()}
    ${!isWork(D) ? `<div class="banner">${fmtDay(D)} is not a working day.</div>` : ""}
    <div class="card"><div class="row"><h2>Morning huddle · 9:00–9:20 · ${esc(ow.name)}</h2><span class="spacer"></span>
      ${e.huddleAt ? `<span class="small muted">Saved ${e.huddleAt.slice(11, 16)}</span>` : ""}</div>
    <div class="grid">
    <div class="pillar reach">
      <h3>REACH · Master Plan</h3>
      <div class="funnel">${STAGES.map((st) => `<div><span class="stage st${STAGES.indexOf(st)}">${st}</span><b>${r.byStage[st].length}</b></div>`).join("")}</div>
      <p class="small">${r.accs.length} accounts · ${r.high.length} high potential · <b>${r.movesWeek}</b> stage move(s) this week · LT Deck used in ${pct(r.deck30)} of meetings (30 days)</p>
      ${attention.length ? `<p class="small"><b>Needs attention:</b></p><ul class="small">${attention.map((a) => { const lt = lastTouch(a.id);
        return `<li>${esc(a.name)} ${stageChip(a.stage)} – ${a.nextDate && a.nextDate <= D ? `action due ${fmtD(a.nextDate)}: ${esc(a.nextAction || "")}` : `not met ${lt ? "since " + fmtD(lt) : "yet"}`}</li>`; }).join("")}</ul>` : ""}
      <h4>Today's visit plan (4 or more)</h4>
      ${plan.length ? `<table class="small"><tbody>${plan.map((x, i) => { const done = touches.some((t) => t.accountId && t.accountId === x.accountId && isF2F(t));
        const a = S.accounts.find((y) => y.id === x.accountId);
        return `<tr><td>${done ? tag("g", "Met") : ""}</td><td><b>${esc(a ? a.name : x.name)}</b> ${a ? stageChip(a.stage) : "<span class='muted'>(new)</span>"}<span class="cell-val">${esc(x.purpose)}</span></td><td><button class="small danger" data-pldel="${i}">×</button></td></tr>`; }).join("")}</tbody></table>` : `<p class="muted small">No visits planned yet.</p>`}
      <div class="form">
        <label>Account<select id="pl-acc"><option value="">— new customer —</option>${accountOpts(o)}</select></label>
        <label>New customer name<input id="pl-name" placeholder="if not in Master Plan" /></label>
        <label>Purpose / aim<input id="pl-purpose" placeholder="e.g. show credentials, move to Budding" /></label>
        <button id="pl-add" type="button" class="secondary">Add to plan</button>
      </div>
      <p class="small">${plan.length < 4 ? tag("r", `${plan.length} planned – need 4`) : tag("g", `${plan.length} planned`)}</p>
    </div>

    <div class="pillar convert">
      <h3>CONVERT · Project navigation</h3>
      <p class="small">${m.pipeProjects.length} qualified projects · ${cr(m.pipe)} · ${m.remaining > 0 ? m.coverage.toFixed(1) + "× remaining target" : "target met"} ${chip(m.st.pipe)}</p>
      <h4>At negotiation</h4>
      ${m.nego.length ? m.nego.map((p) => `<div class="card" style="padding:.6rem">
        <b>${esc(p.name)}</b> · ${esc(p.customer)} · ${cr(num(p.value))}
        <div class="form" style="margin-top:.4rem">
          <label>Decision-maker<input data-rp="${p.id}" data-f="dm" value="${esc(p.dm)}" /></label>
          <label>Competitor<input data-rp="${p.id}" data-f="competitor" value="${esc(p.competitor)}" /></label>
          <label>Our price position<input data-rp="${p.id}" data-f="pricePos" value="${esc(p.pricePos)}" /></label>
          <label>Today's move<input data-rp="${p.id}" data-f="nextMove" value="${esc(p.nextMove)}" /></label>
        </div></div>`).join("") : `<p class="muted small">None. Need about ${m.toWin * 2} at any time.</p>`}
      <h4>Offers awaiting decision</h4>
      ${offers.length ? `<ul class="small">${offers.map((p) => `<li>${esc(p.name)} · ${cr(num(p.value))} · ${p.stageDate ? diffDays(D, p.stageDate) + " days" : ""}${p.nextMove ? " · next: " + esc(p.nextMove) : ""}</li>`).join("")}</ul>` : `<p class="muted small">None.</p>`}
      ${m.stuck.length ? `<p class="small">${tag("a", `${m.stuck.length} stuck ${S.settings.stuckDays}+ days`)} ${m.stuck.map((p) => esc(p.name)).join(", ")} – demo or factory visit?</p>` : ""}
    </div>

    <div class="pillar retain">
      <h3>RETAIN · Execute and collect</h3>
      ${dueSoon.length ? `<table class="small"><thead><tr><th>Customer</th><th>Due</th><th class="num">Outstanding</th><th></th></tr></thead><tbody>${dueSoon.map((x) => `<tr><td>${esc(x.customer)}${x.private ? " <span class='muted'>(private)</span>" : ""}</td><td>${fmtD(x.dueDate)}</td><td class="num">${cr(outstanding(x, D))}</td><td>${x.dueDate < D ? chip(diffDays(D, x.dueDate) > S.settings.bands.collA ? "r" : "a", diffDays(D, x.dueDate) + "d late") : chip("g", x.dueDate === D ? "due today" : "upcoming")}</td></tr>`).join("")}</tbody></table>` : `<p class="muted small">No collections due in the next 3 days.</p>`}
      <label class="field">Collections: who calls / visits, how much expected today<textarea id="h-coll">${esc(e.collPlan)}</textarea></label>
      <label class="field">Execution: spec approvals, delivery sequence, invoicing issues<textarea id="h-exec">${esc(e.execPlan)}</textarea></label>
    </div>
    </div>
    <div class="form" style="margin-top:.6rem"><label>Help needed from (Wire &amp; Win)<select id="h-helpwho">${["", "Head", "Factory", "R&D", "Colleague", "Accounts"].map((x) => `<option ${e.helpWho === x ? "selected" : ""}>${x}</option>`).join("")}</select></label></div>
    <label class="field">What, by when<textarea id="h-help">${esc(e.help)}</textarea></label>
    ${e.plan ? `<p class="small muted">Earlier plan notes: ${esc(e.plan)}</p>` : ""}
    <button id="save-huddle" type="button">Save huddle</button>
    </div>

    <div class="card">
      <h2>Evening close · by 6:30 · ${esc(ow.name)}</h2>
      <h3>Meetings today and LT Deck used</h3>
      ${touches.length ? `<div class="table-wrap"><table class="small"><thead><tr><th>Account</th><th>Type</th><th>LT Deck shown</th><th>Stage</th><th>Outcome</th><th></th></tr></thead><tbody>${touches.map((t) => `<tr>
        <td><b>${esc(accName(t.accountId))}</b>${t.newProject ? `<span class="cell-val">new qualified project</span>` : ""}</td><td>${esc(t.type)}</td>
        <td>${(t.deck || []).length ? esc(deckTxt(t.deck)) : tag("r", "None")}</td>
        <td>${t.stageTo && t.stageTo !== t.stageFrom ? `${stageChip(t.stageFrom)} → ${stageChip(t.stageTo)}` : stageChip(t.stageFrom || "")}</td>
        <td>${esc(t.outcome)}</td><td><button class="small danger" data-tdel="${t.id}">×</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="muted small">No meetings logged yet.</p>`}
      <div class="form">
        <label>Account<select id="t-acc"><option value="">— new customer —</option>${accountOpts(o, (plan.find((x) => x.accountId && !touches.some((t) => t.accountId === x.accountId)) || {}).accountId)}</select></label>
        <label>New customer name<input id="t-name" placeholder="added to Master Plan as Sprouting" /></label>
        <label>New customer type<select id="t-type2">${ACC_TYPES.map((x) => `<option>${x}</option>`).join("")}</select></label>
        <label>Meeting type<select id="t-type">${TOUCH_TYPES.map((x) => `<option>${x}</option>`).join("")}</select></label>
        <label>Stage after this meeting<select id="t-stage"><option value="">(no change)</option>${STAGES.map((x) => `<option>${x}</option>`).join("")}</select></label>
      </div>
      <div class="field" style="margin-top:.5rem">LT Deck content shown<div class="row">${DECK.map(([k, l]) => `<label class="check" style="display:flex;gap:.3rem"><input type="checkbox" data-deck="${k}" /> ${l}</label>`).join("")}</div></div>
      <label class="field">Outcome / next step<input id="t-out" /></label>
      <div class="row" style="margin-top:.4rem"><label class="check" style="display:flex;gap:.3rem"><input type="checkbox" id="t-newp" /> New LT qualified project found</label>
        <span class="spacer"></span><button id="t-add" type="button" class="secondary">Log meeting</button></div>

      <h3>Day summary</h3>
      <div class="form">
        <label>F2F visits done<input id="c-visits" type="number" min="0" value="${e.visitCount ?? ""}" placeholder="${f2fToday} logged" /></label>
        <label>New qualified projects found<input id="c-newq" type="number" min="0" value="${e.newQualified ?? ""}" placeholder="${touches.filter((t) => t.newProject).length} logged" /></label>
        <label>Spec approvals<input id="c-spec" type="number" min="0" value="${e.specApprovals ?? ""}" /></label>
        <label>POs received<input id="c-pos" type="number" min="0" value="${e.pos ?? ""}" /></label>
        <label>Offers sent<input id="c-offers" type="number" min="0" value="${e.offersSent ?? ""}" /></label>
        <label class="check"><input id="c-ftr" type="checkbox" ${e.offersFTR !== false ? "checked" : ""}/> All offers checked First Time Right</label>
        <label>Collections received (Rs Cr)<input id="c-collr" type="number" step="0.01" min="0" value="${e.collReceived ?? ""}" /></label>
        <label>Collections promised (Rs Cr)<input id="c-collp" type="number" step="0.01" min="0" value="${e.collPromised ?? ""}" /></label>
      </div>
      <p class="small muted">Leave visits and new projects blank to use the meetings logged above.</p>
      ${ow.isHead ? `<div class="field">Joint visits today with<div class="row">${members().map((mb) => `<label class="check" style="display:flex;gap:.3rem"><input type="checkbox" data-joint="${mb.id}" ${(e.jointWith || []).includes(mb.id) ? "checked" : ""}/> ${esc(mb.name)}</label>`).join("")}</div></div>`
        : `<label class="check field" style="flex-direction:row"><input id="c-joint" type="checkbox" ${e.jointWithHead ? "checked" : ""}/> Joint visit with Head today</label>`}
      <h3>Orders booked today</h3>
      ${todaysOrders.length ? `<ul class="small">${todaysOrders.map((x) => `<li>${esc(x.customer)} – ${esc(x.project)}: ${cr(num(x.value))}</li>`).join("")}</ul>` : `<p class="muted small">None logged.</p>`}
      <div class="form"><label>Customer<input id="c-ocust" /></label><label>Project<input id="c-oproj" /></label><label>Value (Rs Cr)<input id="c-oval" type="number" step="0.01" min="0" /></label><button id="c-oadd" type="button" class="secondary">Add order</button></div>
      <label class="field">Tomorrow's first visit and must-do<textarea id="c-tomorrow">${esc(e.tomorrow)}</textarea></label>
      <div class="row" style="margin-top:.6rem">
        <button id="save-close" type="button">Save evening close</button>
        <button id="share-close" type="button" class="secondary">Send as message</button>
        ${e.closedAt ? `<span class="small ${e.closedAt.slice(11, 16) > "18:30" ? "" : "muted"}">Closed ${e.closedAt.slice(11, 16)}${e.closedAt.slice(11, 16) > "18:30" ? " – after 6:30 pm" : ""}</span>` : ""}
      </div>
    </div>

    <div class="card no-print">
      <h2>Import a team member's evening close</h2>
      <p class="small muted">Team members using the app on their own phones tap <b>Send as message</b>. Paste the whole message here to load their close, meetings, new Master Plan accounts and orders.</p>
      <textarea id="imp-text" placeholder="Paste message…"></textarea>
      <button id="imp-btn" type="button">Import</button>
    </div>`;
  }
  function closeText(d, o) {
    const e = S.daily[d]?.[o] || {}; const ord = S.orders.filter((x) => x.owner === o && x.date === d);
    const touches = S.touches.filter((t) => t.owner === o && t.date === d);
    const accs = S.accounts.filter((a) => touches.some((t) => t.accountId === a.id));
    const lines = [
      `*Evening close – ${ownerName(o)} – ${fmtD(d)}*`,
      `Visits: ${e.visitCount ?? 0} / 4`,
      ...touches.map((t) => `• ${accName(t.accountId)} (${t.type})${t.stageTo && t.stageTo !== t.stageFrom ? ` ${t.stageFrom}→${t.stageTo}` : ""} · LT Deck: ${deckTxt(t.deck) || "none"}${t.outcome ? " · " + t.outcome : ""}`),
      `New qualified projects: ${e.newQualified ?? 0}`,
      `Collections received: Rs ${e.collReceived ?? 0} Cr · promised: Rs ${e.collPromised ?? 0} Cr`,
      `Orders: ${ord.length ? ord.map((x) => `${x.customer} Rs ${x.value} Cr`).join("; ") : "none"}`,
      `Spec approvals: ${e.specApprovals ?? 0} · POs: ${e.pos ?? 0}`,
      `Offers sent: ${e.offersSent ?? 0}${e.offersFTR === false ? " (not all FTR)" : " (FTR)"}`,
      `Tomorrow: ${e.tomorrow || "-"}`,
    ];
    const payload = { d, o, e: { ...e }, orders: ord, touches, accounts: accs };
    lines.push("", "#POT1:" + btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
    return lines.join("\n");
  }
  bind.daily = () => {
    bindOwnerTabs();
    const o = selOwner;
    $$("[data-rp]").forEach((inp) => inp.onchange = () => { const p = S.projects.find((x) => x.id === inp.dataset.rp); p[inp.dataset.f] = inp.value.trim(); save(); });
    function saveHuddle(stamp) {
      const e = entry(D, o); e.collPlan = $("#h-coll").value; e.execPlan = $("#h-exec").value;
      e.help = $("#h-help").value; e.helpWho = $("#h-helpwho").value; if (stamp) e.huddleAt = localStamp(); save(); return e;
    }
    $("#pl-add").onclick = () => {
      const accId = $("#pl-acc").value; const name = $("#pl-name").value.trim();
      if (!accId && !name) return toast("Pick an account or type a new customer");
      saveHuddle(false); saveClose(false); const e = entry(D, o); e.planItems = e.planItems || [];
      e.planItems.push({ accountId: accId, name: accId ? "" : name, purpose: $("#pl-purpose").value.trim() }); save(); render();
    };
    $$("[data-pldel]").forEach((b) => b.onclick = () => { saveHuddle(false); saveClose(false); entry(D, o).planItems.splice(+b.dataset.pldel, 1); save(); render(); });
    $("#save-huddle").onclick = () => {
      const e = saveHuddle(true); const n = (e.planItems || []).length;
      toast(n < 4 ? `Saved. Only ${n} visits planned – need 4.` : "Huddle saved"); render();
    };
    $("#t-add").onclick = () => {
      let accId = $("#t-acc").value; const name = $("#t-name").value.trim();
      if (!accId && !name) return toast("Pick an account or type a new customer");
      saveHuddle(false); saveClose(false);
      if (!accId) {
        const a = { id: uid(), owner: o, name, type: $("#t-type2").value, potential: "Medium", stage: "Sprouting", stageDate: D, history: [], createdAt: D, updatedAt: localStamp(), nextAction: "", nextDate: "", contact: "", city: "", notes: "" };
        S.accounts.push(a); accId = a.id;
        const e = entry(D, o); const pi = (e.planItems || []).find((x) => !x.accountId && x.name.toLowerCase() === name.toLowerCase()); if (pi) { pi.accountId = accId; pi.name = ""; }
      }
      const a = S.accounts.find((x) => x.id === accId); const from = a.stage; const to = $("#t-stage").value || from;
      S.touches.push({ id: uid(), owner: o, accountId: accId, date: D, type: $("#t-type").value, deck: $$("[data-deck]").filter((c) => c.checked).map((c) => c.dataset.deck),
        outcome: $("#t-out").value.trim(), stageFrom: from, stageTo: to, newProject: $("#t-newp").checked });
      setStage(a, to, D); a.updatedAt = localStamp(); save();
      toast(to !== from ? `Logged. ${a.name} moved to ${to}.` : "Meeting logged"); render();
    };
    $$("[data-tdel]").forEach((b) => b.onclick = () => { if (!confirm("Delete this meeting? (A stage change it made stays – change it in Master Plan if needed.)")) return; saveHuddle(false); saveClose(false); S.touches = S.touches.filter((t) => t.id !== b.dataset.tdel); save(); render(); });
    $("#c-oadd").onclick = () => {
      const v = num($("#c-oval").value); const c = $("#c-ocust").value.trim();
      if (!c || v <= 0) return toast("Enter customer and value");
      saveHuddle(false); saveClose(false);
      S.orders.push({ id: uid(), owner: o, date: D, customer: c, project: $("#c-oproj").value.trim(), value: v }); save(); toast("Order added"); render();
    };
    function saveClose(stamp = true) {
      const e = entry(D, o); const touches = S.touches.filter((t) => t.owner === o && t.date === D);
      const vc = $("#c-visits").value; const nq = $("#c-newq").value;
      e.visitCount = vc === "" ? touches.filter(isF2F).length : num(vc);
      e.newQualified = nq === "" ? touches.filter((t) => t.newProject).length : num(nq);
      e.specApprovals = num($("#c-spec").value); e.pos = num($("#c-pos").value);
      e.offersSent = num($("#c-offers").value); e.offersFTR = $("#c-ftr").checked;
      e.collReceived = num($("#c-collr").value); e.collPromised = num($("#c-collp").value); e.tomorrow = $("#c-tomorrow").value;
      if (owner(o).isHead) e.jointWith = $$("[data-joint]").filter((c) => c.checked).map((c) => c.dataset.joint);
      else e.jointWithHead = $("#c-joint").checked;
      if (stamp) { e.closedAt = e.closedAt || localStamp(); e.updatedAt = localStamp(); }
      else { if (vc === "") delete e.visitCount; if (nq === "") delete e.newQualified; } // stay automatic until the close is saved
      save();
    }
    $("#save-close").onclick = () => { saveHuddle(false); saveClose(); const e = S.daily[D][o]; toast(e.visitCount < 4 ? `Saved. ${e.visitCount} visits – below 4.` : "Evening close saved"); render(); };
    $("#share-close").onclick = async () => {
      saveHuddle(false); saveClose(); const text = closeText(D, o);
      if (navigator.share) { try { await navigator.share({ text }); return; } catch (err) { if (err.name === "AbortError") return; } }
      try { await navigator.clipboard.writeText(text); toast("Copied – paste into WhatsApp"); } catch { window.open("https://wa.me/?text=" + encodeURIComponent(text), "_blank"); }
    };
    $("#imp-btn").onclick = () => {
      const m = $("#imp-text").value.match(/#POT1:([A-Za-z0-9+/=]+)/);
      if (!m) return toast("No tracker code found in the message");
      try {
        const p = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
        if (!owner(p.o)) return toast("Unknown team member in message");
        S.daily[p.d] = S.daily[p.d] || {}; S.daily[p.d][p.o] = { ...(S.daily[p.d][p.o] || {}), ...p.e };
        let added = 0, accs = 0, mt = 0;
        for (const x of p.orders || []) if (!S.orders.some((y) => y.id === x.id)) { S.orders.push(x); added++; }
        for (const a of p.accounts || []) {
          const i = S.accounts.findIndex((y) => y.id === a.id);
          if (i < 0) { S.accounts.push(a); accs++; } else if ((a.updatedAt || "") > (S.accounts[i].updatedAt || "")) S.accounts[i] = a;
        }
        for (const t of p.touches || []) if (!S.touches.some((y) => y.id === t.id)) { S.touches.push(t); mt++; }
        save(); toast(`Imported ${ownerName(p.o)} for ${fmtD(p.d)}: ${mt} meeting(s)${accs ? `, ${accs} new account(s)` : ""}${added ? `, ${added} order(s)` : ""}.`); render();
      } catch { toast("Could not read the code"); }
    };
  };
  function localStamp() { const n = new Date(); return `${ymd(n)}T${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`; }

  // ----- Master Plan import (CSV or rows pasted from a spreadsheet) -----
  const IMPORT_COLS = [ // [field, heading, other accepted headings]
    ["name", "Customer", ["customer / firm", "company name", "account", "name"]], ["type", "Type", []], ["potential", "Potential", []],
    ["stage", "Stage", ["milestone"]], ["stageDate", "Stage since", ["since"]], ["contact", "Key person", ["contact"]],
    ["phone", "Phone", ["phone no", "mobile"]], ["email", "Email", ["email id"]], ["city", "City / area", ["city", "area", "location"]],
    ["leadCr", "Lead value (Rs Cr)", ["lead value", "target"]], ["actualCr", "Actual YTD (Rs Cr)", ["actual ytd", "actual"]],
    ["nextAction", "Next action", []], ["nextDate", "Next date", ["next action date"]], ["notes", "Notes", []],
  ];
  function parseRows(text) {
    const first = text.split("\n")[0];
    const delim = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? "\t" : ",";
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
      else if (c === '"' && cell === "") q = true;
      else if (c === delim) { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function toISO(v) {
    v = String(v || "").trim(); const iso = v.match(/^(\d{4}-\d{2}-\d{2})/); if (iso) return iso[1];
    const m = v.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3})[A-Za-z]*[-\/ ](\d{4})/);
    if (m) { const mo = "janfebmaraprmayjunjulaugsepoctnovdec".indexOf(m[2].toLowerCase()) / 3; if (mo >= 0) return `${m[3]}-${String(mo + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
    const n = v.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/); // dd-mm-yyyy
    if (n) return `${n[3]}-${n[2].padStart(2, "0")}-${n[1].padStart(2, "0")}`;
    return "";
  }
  function importAccounts(text, ownerId) {
    const rows = parseRows(text.replace(/^﻿/, ""));
    const head = (rows.shift() || []).map((h) => h.trim().toLowerCase());
    const col = {};
    for (const [f, l, alt] of IMPORT_COLS) { const i = head.findIndex((h) => h === l.toLowerCase() || alt.includes(h)); if (i >= 0) col[f] = i; }
    if (col.name == null) return { error: "No 'Customer' column found in the first row." };
    const pick = (list, v, def) => list.find((x) => x.toLowerCase() === String(v || "").trim().toLowerCase()) || def;
    let added = 0, updated = 0;
    for (const r of rows) {
      if (r.every((c) => !c.trim())) break; // stop at the first blank row
      const g = (f) => (col[f] == null ? "" : String(r[col[f]] ?? "").trim());
      const name = g("name"); if (!name) continue;
      const data = { name, contact: g("contact"), phone: g("phone"), email: g("email"), city: g("city"), nextAction: g("nextAction"), notes: g("notes") };
      if (col.type != null) data.type = pick(ACC_TYPES, g("type"), "Other");
      if (col.potential != null) data.potential = pick(POTENTIAL, g("potential"), "Medium");
      if (col.leadCr != null) data.leadCr = num(g("leadCr"));
      if (col.actualCr != null) data.actualCr = num(g("actualCr"));
      if (col.nextDate != null) data.nextDate = toISO(g("nextDate"));
      const stage = col.stage != null ? pick(STAGES, g("stage"), "Sprouting") : null;
      const since = toISO(g("stageDate")) || D;
      const ex = S.accounts.find((a) => a.owner === ownerId && !a.archived && a.name.toLowerCase() === name.toLowerCase());
      if (ex) {
        for (const [k, v] of Object.entries(data)) if (v !== "" && v != null) ex[k] = v;
        if (stage && stage !== ex.stage) setStage(ex, stage, D);
        ex.updatedAt = localStamp(); updated++;
      } else {
        S.accounts.push({ id: uid(), owner: ownerId, type: "Other", potential: "Medium", nextDate: "", ...data, stage: stage || "Sprouting",
          stageDate: since, history: [], createdAt: since, updatedAt: localStamp() });
        added++;
      }
    }
    save(); return { added, updated };
  }

  // ----- Projects import (CSV or rows pasted from a spreadsheet) -----
  const PROJECT_COLS = [
    ["name", "Project", ["project name"]], ["customer", "Customer", ["customer / developer", "client"]],
    ["account", "Master Plan account", ["account"]], ["value", "Value (Rs Cr)", ["project value cr", "value"]],
    ["stage", "Stage", ["action status"]], ["closeDate", "Expected order date", ["expected closure"]],
    ["nextMove", "Next move", ["next action"]], ["prob", "Winning probability", ["probability"]],
    ["segment", "Source", ["segment"]], ["createdAt", "Created", ["created at"]], ["notes", "Notes", []],
  ];
  // SPELT action statuses -> project navigation stages
  const PSTAGE_ALIAS = { "spec in": "LT specified", "specified": "LT specified", "tendering": "Offer submitted", "tender": "Offer submitted",
    "offer": "Offer submitted", "negotiation": "Negotiation", "identified": "Identified", "initial": "Identified", "mockup": "LT specified", "mock-up": "LT specified" };
  function importProjects(text, ownerId) {
    const rows = parseRows(text.replace(/^﻿/, ""));
    const head = (rows.shift() || []).map((h) => h.trim().toLowerCase());
    const col = {};
    for (const [f, l, alt] of PROJECT_COLS) { const i = head.findIndex((h) => h === l.toLowerCase() || alt.includes(h)); if (i >= 0) col[f] = i; }
    if (col.name == null) return { error: "No 'Project' column found in the first row." };
    const accs = S.accounts.filter((a) => a.owner === ownerId && !a.archived);
    let added = 0, updated = 0, linked = 0;
    for (const r of rows) {
      if (r.every((c) => !c.trim())) break;
      const g = (f) => (col[f] == null ? "" : String(r[col[f]] ?? "").trim());
      const name = g("name"); if (!name) continue;
      const st = g("stage").toLowerCase();
      const stage = PSTAGES.find((x) => x.toLowerCase() === st) || PSTAGE_ALIAS[st] || (col.stage != null ? "Identified" : null);
      const accName0 = g("account").toLowerCase();
      const acc = accName0 ? accs.find((a) => a.name.toLowerCase() === accName0) : null;
      if (acc) linked++;
      const prob = g("prob");
      let notes = g("notes");
      if (prob) notes = `Winning probability ${prob.replace(/\s*%$/, "")}%` + (notes ? " · " + notes : "");
      const data = { name, customer: g("customer") || (acc ? acc.name : ""), nextMove: g("nextMove"), segment: g("segment"), notes };
      if (col.value != null) data.value = num(g("value").replace(/,/g, ""));
      if (col.closeDate != null) data.closeDate = toISO(g("closeDate"));
      if (acc) data.accountId = acc.id;
      const ex = S.projects.find((x) => x.owner === ownerId && x.name.toLowerCase() === name.toLowerCase());
      if (ex) {
        for (const [k, v] of Object.entries(data)) if (v !== "" && v != null) ex[k] = v;
        if (stage && ex.status === "open" && stage !== ex.stage) { ex.stage = stage; ex.stageDate = D; }
        updated++;
      } else {
        const created = toISO(g("createdAt")) || D;
        S.projects.push({ id: uid(), owner: ownerId, accountId: "", value: 0, closeDate: "", ...data, stage: stage || "Identified", qualified: true,
          status: "open", stageDate: D, createdAt: created, dm: "", competitor: "", pricePos: "" });
        added++;
      }
    }
    save(); return { added, updated, linked };
  }

  // ----- Master Plan (Reach) -----
  let mpPot = "all";
  function master() {
    const r = reach(selOwner, D);
    const accs = r.accs.filter((a) => mpPot === "all" || a.potential === mpPot);
    const showOwner = selOwner === "all";
    const gap = S.settings.touchGapDays;
    return `${ownerTabs(true)}
    <div class="card">
      <h2>Master Plan · ${showOwner ? "Team" : esc(ownerName(selOwner))}</h2>
      <p class="small muted">Pick high-potential customers from the SOM (Serviceable Obtainable Market) and move them from Sprouting to Ripening through regular visits and the LT Deck. LT qualified projects come from accounts in the later stages.</p>
      <div class="funnel big">${STAGES.map((st) => `<div><span class="stage st${STAGES.indexOf(st)}">${st}</span><b>${r.byStage[st].length}</b><small>${STAGE_DEF[st]}</small></div>`).join("")}</div>
      <div class="tiles" style="margin-top:.8rem">
        <div class="tile"><div class="label">Accounts</div><div class="value">${r.accs.length}</div><div class="sub">${r.high.length} high potential</div></div>
        <div class="tile"><div class="label">Stage moves forward</div><div class="value">${r.movesWeek}</div><div class="sub">this week · ${r.movesMonth} in 30 days</div></div>
        <div class="tile"><div class="label">Not met in ${gap}+ days</div><div class="value">${r.untouched.length}</div><div class="sub">${r.untouched.filter((a) => a.potential === "High").length} high potential</div></div>
        <div class="tile"><div class="label">LT Deck used</div><div class="value">${pct(r.deck30)}</div><div class="sub">of ${r.t30.length} meetings in 30 days</div></div>
      </div>
      <p class="small">LT Deck content shown (30 days): ${DECK.map(([k, l]) => `${l} <b>${r.deckItems[k]}</b>`).join(" · ")}</p>
      ${showOwner ? `<div class="table-wrap"><table class="small"><thead><tr><th>Owner</th>${STAGES.map((st) => `<th class="num">${st}</th>`).join("")}<th class="num">Total</th><th class="num">Moves (30 d)</th><th class="num">Not met ${gap}+ d</th><th class="num">LT Deck use</th></tr></thead><tbody>
        ${S.owners.map((o) => { const x = reach(o.id, D); return `<tr><td>${esc(o.name)}</td>${STAGES.map((st) => `<td class="num">${x.byStage[st].length}</td>`).join("")}<td class="num"><b>${x.accs.length}</b></td><td class="num">${x.movesMonth}</td><td class="num">${x.untouched.length}</td><td class="num">${pct(x.deck30)}</td></tr>`; }).join("")}
      </tbody></table></div>` : ""}
    </div>

    <div class="card no-print"><h2>Add Master Plan account</h2><div class="form">
      <label>Owner<select id="a-owner">${ownerOpts(showOwner ? S.settings.deviceOwner : selOwner)}</select></label>
      <label>Customer / firm<input id="a-name" /></label>
      <label>Type<select id="a-type">${ACC_TYPES.map((x) => `<option>${x}</option>`).join("")}</select></label>
      <label>Key person<input id="a-contact" /></label>
      <label>City / area<input id="a-city" /></label>
      <label>Potential<select id="a-pot">${POTENTIAL.map((x) => `<option>${x}</option>`).join("")}</select></label>
      <label>Stage<select id="a-stage">${STAGES.map((x) => `<option title="${STAGE_DEF[x]}">${x}</option>`).join("")}</select></label>
      <label>Next action<input id="a-next" /></label>
      <label>Next action date<input id="a-nextd" type="date" /></label>
      <button id="a-add" type="button">Add</button></div></div>

    <div class="card no-print"><h2>Import accounts from a sheet</h2>
      <p class="small muted">Choose a CSV file, or copy the rows from Excel / Google Sheets and paste them below (first row = headings).
      Columns read: ${IMPORT_COLS.map(([, l]) => l).join(", ")}. An account already in this person's Master Plan with the same customer name is updated, not duplicated.</p>
      <div class="form"><label>Import into<select id="im-owner">${ownerOpts(showOwner ? S.settings.deviceOwner : selOwner)}</select></label>
        <label>CSV file<input id="im-file" type="file" accept=".csv,text/csv,text/plain" /></label></div>
      <textarea id="im-text" placeholder="…or paste rows here"></textarea>
      <div class="row"><button id="im-go" type="button">Import</button><span id="im-msg" class="small"></span></div></div>

    <div class="card"><div class="row"><h2>Accounts by stage</h2><span class="spacer"></span>
      <label class="small">Potential <select id="a-filter">${[["all", "All"], ...POTENTIAL.map((x) => [x, x])].map(([v, l]) => `<option value="${v}" ${mpPot === v ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
      <div class="board">${STAGES.map((st, si) => { const xs = accs.filter((a) => a.stage === st).sort((a, b) => POTENTIAL.indexOf(a.potential) - POTENTIAL.indexOf(b.potential) || a.name.localeCompare(b.name));
        return `<div class="col"><div class="col-h st${si}"><b>${st}</b> <span>${xs.length}</span><small>${STAGE_DEF[st]}</small></div>
        ${xs.map((a) => { const lt = lastTouch(a.id); const n = S.touches.filter((t) => t.accountId === a.id).length; const nDeck = S.touches.filter((t) => t.accountId === a.id && (t.deck || []).length).length;
          const stale = lt ? diffDays(D, lt) >= gap : diffDays(D, a.createdAt || D) >= gap;
          return `<div class="acc ${a.potential === "High" ? "hi" : ""}">
            <div class="row"><b>${esc(a.name)}</b><span class="spacer"></span><span class="small muted">${a.potential === "High" ? "★ High" : esc(a.potential)}</span></div>
            <div class="small muted">${esc(a.type)}${a.city ? " · " + esc(a.city) : ""}${showOwner ? " · " + esc(ownerName(a.owner)) : ""}${a.contact ? "<br>" + esc(a.contact) : ""}</div>
            ${a.phone || a.email ? `<div class="small">${a.phone ? `<a href="tel:${esc(a.phone)}">${esc(a.phone)}</a>` : ""}${a.phone && a.email ? " · " : ""}${a.email ? `<a href="mailto:${esc(a.email)}">${esc(a.email)}</a>` : ""}</div>` : ""}
            ${num(a.leadCr) || num(a.actualCr) ? `<div class="small">Lead ${cr(num(a.leadCr))}${num(a.actualCr) ? " · actual YTD " + cr(num(a.actualCr)) : ""}</div>` : ""}
            <div class="small">${a.stageDate ? diffDays(D, a.stageDate) + " d in stage · " : ""}${n} meeting(s), LT Deck in ${nDeck}</div>
            <div class="small">${lt ? "Last met " + fmtD(lt) : "Not met yet"} ${stale ? tag("a", "Follow up") : ""}</div>
            ${a.nextAction || a.nextDate ? `<div class="small">Next: ${esc(a.nextAction)}${a.nextDate ? " · " + fmtD(a.nextDate) : ""} ${a.nextDate && a.nextDate < D ? tag("r", "Overdue") : ""}</div>` : ""}
            <div class="row" style="margin-top:.3rem">
              <button class="small secondary" data-amv="${a.id}|-1" ${si === 0 ? "disabled" : ""} title="Move back">◀</button>
              <button class="small secondary" data-amv="${a.id}|1" ${si === STAGES.length - 1 ? "disabled" : ""} title="Move forward">▶</button>
              <button class="small secondary" data-aedit="${a.id}">Edit</button>
              <span class="spacer"></span><button class="small danger" data-adel="${a.id}" title="Remove">×</button></div>
            <div class="aedit" id="ae-${a.id}" hidden><div class="form">
              <label>Name<input data-af="name" value="${esc(a.name)}" /></label>
              <label>Type<select data-af="type">${ACC_TYPES.map((x) => `<option ${x === a.type ? "selected" : ""}>${x}</option>`).join("")}</select></label>
              <label>Key person<input data-af="contact" value="${esc(a.contact)}" /></label>
              <label>Phone<input type="tel" data-af="phone" value="${esc(a.phone)}" /></label>
              <label>Email<input type="email" data-af="email" value="${esc(a.email)}" /></label>
              <label>Lead value (Rs Cr)<input type="number" step="0.01" data-af="leadCr" value="${num(a.leadCr) || ""}" /></label>
              <label>Actual YTD (Rs Cr)<input type="number" step="0.01" data-af="actualCr" value="${num(a.actualCr) || ""}" /></label>
              <label>City / area<input data-af="city" value="${esc(a.city)}" /></label>
              <label>Potential<select data-af="potential">${POTENTIAL.map((x) => `<option ${x === a.potential ? "selected" : ""}>${x}</option>`).join("")}</select></label>
              <label>Owner<select data-af="owner">${ownerOpts(a.owner)}</select></label>
              <label>Next action<input data-af="nextAction" value="${esc(a.nextAction)}" /></label>
              <label>Next action date<input type="date" data-af="nextDate" value="${a.nextDate || ""}" /></label>
              <label>Notes<input data-af="notes" value="${esc(a.notes)}" /></label></div>
              <button class="small" data-asave="${a.id}">Save</button></div>
          </div>`; }).join("") || `<p class="small muted">None</p>`}</div>`; }).join("")}</div>
      <p class="small muted">Stage changes are dated so weekly and monthly movement can be measured. Meetings are logged in Huddle &amp; Close.</p>
    </div>`;
  }
  bind.master = () => {
    bindOwnerTabs();
    $("#im-go").onclick = async () => {
      const f = $("#im-file").files[0]; const text = f ? await f.text() : $("#im-text").value;
      if (!text.trim()) return toast("Choose a file or paste rows first");
      const ow = $("#im-owner").value;
      const r = importAccounts(text, ow);
      if (r.error) { $("#im-msg").textContent = r.error; return; }
      toast(`${ownerName(ow)}: ${r.added} added, ${r.updated} updated`); selOwner = ow; render();
    };
    $("#a-filter").onchange = (e) => { mpPot = e.target.value; render(); };
    $("#a-add").onclick = () => {
      const name = $("#a-name").value.trim(); if (!name) return toast("Enter the customer name");
      const ow = $("#a-owner").value;
      if (S.accounts.some((a) => a.owner === ow && !a.archived && a.name.toLowerCase() === name.toLowerCase())) return toast("Already in this Master Plan");
      S.accounts.push({ id: uid(), owner: ow, name, type: $("#a-type").value, contact: $("#a-contact").value.trim(), city: $("#a-city").value.trim(),
        potential: $("#a-pot").value, stage: $("#a-stage").value, stageDate: D, history: [], createdAt: D, updatedAt: localStamp(),
        nextAction: $("#a-next").value.trim(), nextDate: $("#a-nextd").value, notes: "" });
      save(); toast("Account added"); render();
    };
    const A = (id) => S.accounts.find((a) => a.id === id);
    $$("[data-amv]").forEach((b) => b.onclick = () => { const [id, dir] = b.dataset.amv.split("|"); const a = A(id); const i = STAGES.indexOf(a.stage) + Number(dir);
      if (i < 0 || i >= STAGES.length) return; setStage(a, STAGES[i], D); save(); toast(`${a.name} → ${STAGES[i]}`); render(); });
    $$("[data-aedit]").forEach((b) => b.onclick = () => { const el = $("#ae-" + b.dataset.aedit); el.hidden = !el.hidden; });
    $$("[data-asave]").forEach((b) => b.onclick = () => { const a = A(b.dataset.asave); const box = $("#ae-" + a.id);
      $$("[data-af]", box).forEach((i) => { a[i.dataset.af] = i.type === "number" ? num(i.value) : i.value.trim(); }); a.updatedAt = localStamp(); save(); toast("Saved"); render(); });
    $$("[data-adel]").forEach((b) => b.onclick = () => { const a = A(b.dataset.adel);
      if (!confirm(`Remove ${a.name} from the Master Plan? Its meeting history is kept.`)) return; a.archived = true; a.updatedAt = localStamp(); save(); render(); });
  };

  // ----- Projects (Convert) -----
  let pipeFilter = "open";
  function pipeline() {
    const list = S.projects.filter((p) => (selOwner === "all" || p.owner === selOwner) && (pipeFilter === "all" || p.status === pipeFilter))
      .sort((a, b) => PSTAGES.indexOf(b.stage) - PSTAGES.indexOf(a.stage) || num(b.value) - num(a.value));
    const showOwner = selOwner === "all";
    return `${ownerTabs(true)}
    <div class="card no-print"><h2>Import projects from a sheet</h2>
      <p class="small muted">Choose a CSV file, or paste rows copied from Excel / Google Sheets / SPELT (first row = headings).
      Columns read: ${PROJECT_COLS.map(([, l]) => l).join(", ")}. SPELT's Spec In / Mockup → LT specified, Tendering → Offer submitted, Negotiation → Negotiation.
      A project already listed for this person with the same name is updated, not duplicated.</p>
      <div class="form"><label>Import into<select id="pi-owner">${ownerOpts(selOwner === "all" ? S.settings.deviceOwner : selOwner)}</select></label>
        <label>CSV file<input id="pi-file" type="file" accept=".csv,text/csv,text/plain" /></label></div>
      <textarea id="pi-text" placeholder="…or paste rows here"></textarea>
      <div class="row"><button id="pi-go" type="button">Import</button><span id="pi-msg" class="small"></span></div></div>
    <div class="card no-print"><h2>Add project</h2>
      <div class="form">
        <label>Owner<select id="p-owner">${ownerOpts(selOwner === "all" ? S.settings.deviceOwner : selOwner)}</select></label>
        <label>Project<input id="p-name" /></label>
        <label>Through Master Plan account<select id="p-acc"><option value="">—</option>${accountOpts(selOwner === "all" ? S.settings.deviceOwner : selOwner)}</select></label>
        <label>Customer / developer<input id="p-cust" /></label>
        <label>Source<select id="p-seg">${["SOM", "Consultant", "Contractor", "Tender", "Developer", "Govt / PSU", "Other"].map((x) => `<option>${x}</option>`).join("")}</select></label>
        <label>Value (Rs Cr)<input id="p-val" type="number" step="0.01" min="0" /></label>
        <label>Stage<select id="p-stage">${PSTAGES.map((s) => `<option>${s}</option>`).join("")}</select></label>
        <label>Expected order date<input id="p-close" type="date" /></label>
        <label class="check"><input id="p-qual" type="checkbox" checked /> Qualified</label>
        <button id="p-add" type="button">Add</button>
      </div></div>
    <div class="card">
      <div class="row"><h2>Projects · Convert</h2><span class="spacer"></span>
        <select id="p-filter">${[["open", "Open"], ["won", "Won"], ["lost", "Lost"], ["all", "All"]].map(([v, l]) => `<option value="${v}" ${pipeFilter === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      ${selOwner !== "all" ? (() => { const m = metrics(selOwner, D); return `<p class="small">Qualified open pipeline ${cr(m.pipe)} vs 5× remaining ${cr(m.remaining * 5)} → ${chip(m.st.pipe, m.remaining > 0 ? m.coverage.toFixed(1) + "×" : "target met")}</p>`; })() : ""}
      <div class="table-wrap"><table><thead><tr>${showOwner ? "<th>Owner</th>" : ""}<th>Project</th><th>Customer</th><th class="num">Value</th><th>Stage</th><th>In stage</th><th>Q</th><th>Next move</th><th></th></tr></thead><tbody>
      ${list.map((p) => { const days = p.stageDate ? diffDays(D, p.stageDate) : 0; const stuck = p.status === "open" && days >= S.settings.stuckDays;
        return `<tr>${showOwner ? `<td>${esc(ownerName(p.owner))}</td>` : ""}
          <td><b>${esc(p.name)}</b><span class="cell-val">${esc(p.segment || "")}${p.closeDate ? " · exp. " + fmtD(p.closeDate) : ""}${p.status === "open" && p.closeDate && p.closeDate < D ? " " + tag("a", "Date passed") : ""}</span>${p.notes ? `<span class="cell-val">${esc(p.notes)}</span>` : ""}</td><td>${esc(p.customer)}${p.accountId ? `<span class="cell-val">via ${esc(accName(p.accountId))}</span>` : ""}</td>
          <td class="num"><input type="number" step="0.01" data-pv="${p.id}" value="${num(p.value)}" style="width:5.5rem" /></td>
          <td>${p.status === "open" ? `<select data-ps="${p.id}">${PSTAGES.map((s) => `<option ${s === p.stage ? "selected" : ""}>${s}</option>`).join("")}</select>` : `<b>${p.status.toUpperCase()}</b>`}</td>
          <td>${p.status === "open" ? (stuck ? chip("r", days + " days") : days + " d") : ""}</td>
          <td><input type="checkbox" data-pq="${p.id}" ${p.qualified ? "checked" : ""} title="Qualified" /></td>
          <td><input data-pn="${p.id}" value="${esc(p.nextMove)}" placeholder="next move" /></td>
          <td class="row">${p.status === "open" ? `<button class="small" data-pwon="${p.id}">Won</button><button class="small danger" data-plost="${p.id}">Lost</button>` : `<button class="small secondary" data-preopen="${p.id}">Reopen</button>`}<button class="small danger" data-pdel="${p.id}">×</button></td></tr>`; }).join("") || `<tr><td colspan="9" class="muted">No projects.</td></tr>`}
      </tbody></table></div>
      <p class="small muted">Project navigation: ${PSTAGES.join(" → ")} → Won / Lost. A project is flagged when it sits in one stage ${S.settings.stuckDays}+ days. Marking a project Won books it as an order on the scorecard date. Customer stages (Sprouting → Ripening) live in the Master Plan tab.</p>
    </div>`;
  }
  bind.pipeline = () => {
    $("#pi-go").onclick = async () => {
      const f = $("#pi-file").files[0]; const text = f ? await f.text() : $("#pi-text").value;
      if (!text.trim()) return toast("Choose a file or paste rows first");
      const ow = $("#pi-owner").value; const r = importProjects(text, ow);
      if (r.error) { $("#pi-msg").textContent = r.error; return; }
      toast(`${ownerName(ow)}: ${r.added} added, ${r.updated} updated${r.linked ? `, ${r.linked} linked to Master Plan` : ""}`); selOwner = ow; render();
    };
    bindOwnerTabs();
    $("#p-filter").onchange = (e) => { pipeFilter = e.target.value; render(); };
    $("#p-owner").onchange = (e) => { $("#p-acc").innerHTML = `<option value="">—</option>${accountOpts(e.target.value)}`; };
    $("#p-acc").onchange = (e) => { if (e.target.value && !$("#p-cust").value) $("#p-cust").value = accName(e.target.value); };
    $("#p-add").onclick = () => {
      const name = $("#p-name").value.trim(); if (!name) return toast("Enter a project name");
      const accId = $("#p-acc").value;
      S.projects.push({ id: uid(), owner: $("#p-owner").value, name, accountId: accId, customer: $("#p-cust").value.trim() || (accId ? accName(accId) : ""), segment: $("#p-seg").value,
        value: num($("#p-val").value), stage: $("#p-stage").value, qualified: $("#p-qual").checked, closeDate: $("#p-close").value,
        status: "open", stageDate: D, createdAt: D, dm: "", competitor: "", pricePos: "", nextMove: "" });
      save(); render();
    };
    const P = (id) => S.projects.find((p) => p.id === id);
    $$("[data-pv]").forEach((i) => i.onchange = () => { P(i.dataset.pv).value = num(i.value); save(); });
    $$("[data-ps]").forEach((i) => i.onchange = () => { const p = P(i.dataset.ps); p.stage = i.value; p.stageDate = D; save(); render(); });
    $$("[data-pq]").forEach((i) => i.onchange = () => { P(i.dataset.pq).qualified = i.checked; save(); });
    $$("[data-pn]").forEach((i) => i.onchange = () => { P(i.dataset.pn).nextMove = i.value.trim(); save(); });
    $$("[data-pwon]").forEach((b) => b.onclick = () => {
      const p = P(b.dataset.pwon); const v = prompt(`Order value for "${p.name}" (Rs Cr), booked on ${fmtD(D)}:`, p.value);
      if (v === null) return; p.status = "won"; p.wonDate = D;
      S.orders.push({ id: uid(), owner: p.owner, date: D, customer: p.customer, project: p.name, value: num(v), projectId: p.id }); save(); render();
    });
    $$("[data-plost]").forEach((b) => b.onclick = () => { const p = P(b.dataset.plost); const why = prompt("Reason lost (for the record):"); if (why === null) return; p.status = "lost"; p.lostReason = why; p.lostDate = D; save(); render(); });
    $$("[data-preopen]").forEach((b) => b.onclick = () => { const p = P(b.dataset.preopen); if (p.status === "won" && !confirm("Reopening removes the booked order. Continue?")) return; S.orders = S.orders.filter((o) => o.projectId !== p.id); p.status = "open"; p.stageDate = D; save(); render(); });
    $$("[data-pdel]").forEach((b) => b.onclick = () => { if (confirm("Delete this project?")) { S.projects = S.projects.filter((p) => p.id !== b.dataset.pdel); save(); render(); } });
  };

  // ----- Orders ledger -----
  function orders() {
    const Q = quarter(D);
    const list = S.orders.filter((x) => selOwner === "all" || x.owner === selOwner).sort((a, b) => b.date.localeCompare(a.date));
    return `${ownerTabs(true)}
    <div class="card no-print"><h2>Book an order</h2><div class="form">
      <label>Owner<select id="o-owner">${ownerOpts(selOwner === "all" ? S.settings.deviceOwner : selOwner)}</select></label>
      <label>Date<input id="o-date" type="date" value="${D}" /></label><label>Customer<input id="o-cust" /></label><label>Project<input id="o-proj" /></label>
      <label>Value (Rs Cr)<input id="o-val" type="number" step="0.01" min="0" /></label><button id="o-add" type="button">Add</button></div></div>
    <div class="card"><h2>Orders</h2>
      <p class="small">${Q.label} total: <b>${cr(sumV(list.filter((x) => x.date >= Q.start && x.date <= Q.end)))}</b> (excludes opening balances in Settings)</p>
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>Owner</th><th>Customer</th><th>Project</th><th class="num">Value</th><th></th></tr></thead><tbody>
      ${list.map((x) => `<tr><td>${fmtD(x.date)}</td><td>${esc(ownerName(x.owner))}</td><td>${esc(x.customer)}</td><td>${esc(x.project)}</td><td class="num">${cr(num(x.value))}</td><td><button class="small danger" data-odel="${x.id}">×</button></td></tr>`).join("") || `<tr><td colspan="6" class="muted">No orders yet.</td></tr>`}
      </tbody></table></div></div>`;
  }
  bind.orders = () => {
    bindOwnerTabs();
    $("#o-add").onclick = () => { const v = num($("#o-val").value); const c = $("#o-cust").value.trim(); if (!c || v <= 0) return toast("Enter customer and value");
      S.orders.push({ id: uid(), owner: $("#o-owner").value, date: $("#o-date").value || D, customer: c, project: $("#o-proj").value.trim(), value: v }); save(); render(); };
    $$("[data-odel]").forEach((b) => b.onclick = () => { if (!confirm("Delete this order?")) return; const o = S.orders.find((x) => x.id === b.dataset.odel);
      if (o.projectId) { const p = S.projects.find((p) => p.id === o.projectId); if (p) { p.status = "open"; p.stageDate = D; } }
      S.orders = S.orders.filter((x) => x.id !== b.dataset.odel); save(); render(); });
  };

  // ----- Collections (due list) -----
  let duesFilter = "open";
  function dues() {
    const list = S.dues.filter((x) => (selOwner === "all" || x.owner === selOwner) && (duesFilter === "all" || outstanding(x) > 0.0001))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const B = S.settings.bands;
    return `${ownerTabs(true)}
    <div class="card no-print"><h2>Add invoice / due</h2><div class="form">
      <label>Owner<select id="d-owner">${ownerOpts(selOwner === "all" ? S.settings.deviceOwner : selOwner)}</select></label>
      <label>Customer<input id="d-cust" /></label><label>Invoice / ref<input id="d-inv" /></label>
      <label>Amount (Rs Cr)<input id="d-amt" type="number" step="0.01" min="0" /></label><label>Due date (per payment terms)<input id="d-due" type="date" /></label>
      <label class="check"><input id="d-priv" type="checkbox" checked /> Private customer</label><button id="d-add" type="button">Add</button></div></div>
    <div class="card"><div class="row"><h2>Due list</h2><span class="spacer"></span>
      <select id="d-filter"><option value="open" ${duesFilter === "open" ? "selected" : ""}>Outstanding</option><option value="all" ${duesFilter === "all" ? "selected" : ""}>All</option></select></div>
      <div class="table-wrap"><table><thead><tr><th>Owner</th><th>Customer</th><th>Invoice</th><th>Due</th><th class="num">Amount</th><th class="num">Received</th><th class="num">Outstanding</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map((x) => { const out = outstanding(x, D); const late = diffDays(D, x.dueDate);
        const st = out <= 0.0001 ? "g" : late <= 0 ? "g" : (x.private && late > B.privRed) || late > B.collA ? "r" : "a";
        const lastPaid = (x.receipts || []).slice(-1)[0];
        return `<tr><td>${esc(ownerName(x.owner))}</td><td>${esc(x.customer)}${x.private ? "" : " <span class='muted small'>(govt/PSU)</span>"}</td><td>${esc(x.invoice)}</td><td>${fmtD(x.dueDate)}</td>
        <td class="num">${cr(num(x.amount))}</td><td class="num">${cr(received(x))}${lastPaid ? `<span class="cell-val">last ${fmtD(lastPaid.date)}</span>` : ""}</td><td class="num">${cr(outstanding(x))}</td>
        <td>${out <= 0.0001 ? chip("g", "paid") : chip(st, late > 0 ? late + " days late" : late === 0 ? "due today" : "due in " + -late + "d")}</td>
        <td class="row"><button class="small" data-dpay="${x.id}">Record payment</button><button class="small danger" data-ddel="${x.id}">×</button></td></tr>`; }).join("") || `<tr><td colspan="9" class="muted">Nothing here.</td></tr>`}
      </tbody></table></div>
      <p class="small muted">Green paid by due date · Amber up to ${B.collA} days late · Red over ${B.collA} days, or any private customer over ${B.privRed} days.</p></div>`;
  }
  bind.dues = () => {
    bindOwnerTabs();
    $("#d-filter").onchange = (e) => { duesFilter = e.target.value; render(); };
    $("#d-add").onclick = () => { const a = num($("#d-amt").value); const c = $("#d-cust").value.trim(); const dd = $("#d-due").value;
      if (!c || a <= 0 || !dd) return toast("Enter customer, amount and due date");
      S.dues.push({ id: uid(), owner: $("#d-owner").value, customer: c, invoice: $("#d-inv").value.trim(), amount: a, dueDate: dd, private: $("#d-priv").checked, receipts: [] }); save(); render(); };
    $$("[data-dpay]").forEach((b) => b.onclick = () => { const x = S.dues.find((y) => y.id === b.dataset.dpay);
      const a = prompt(`Amount received from ${x.customer} (Rs Cr):`, outstanding(x).toFixed(2)); if (a === null) return;
      const d = prompt("Date received (YYYY-MM-DD):", D); if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return toast("Date must be YYYY-MM-DD");
      x.receipts.push({ date: d, amount: num(a) }); save(); render(); });
    $$("[data-ddel]").forEach((b) => b.onclick = () => { if (confirm("Delete this due?")) { S.dues = S.dues.filter((y) => y.id !== b.dataset.ddel); save(); render(); } });
  };

  // ----- Offers / submissions -----
  function subs() {
    const list = S.subs.filter((x) => selOwner === "all" || x.owner === selOwner).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
    return `${ownerTabs(true)}
    <div class="card no-print"><h2>Log an offer / BOQ / submission</h2><div class="form">
      <label>Owner<select id="s-owner">${ownerOpts(selOwner === "all" ? S.settings.deviceOwner : selOwner)}</select></label>
      <label>Customer / project<input id="s-cust" /></label><label>What<select id="s-what">${["Offer", "BOQ", "Technical submission", "Revised offer", "Invoice"].map((x) => `<option>${x}</option>`).join("")}</select></label>
      <label>Due date<input id="s-due" type="date" value="${D}" /></label><button id="s-add" type="button">Add</button></div></div>
    <div class="card"><h2>Submissions</h2><div class="table-wrap"><table><thead><tr><th>Owner</th><th>Customer</th><th>What</th><th>Due</th><th>Sent</th><th>First Time Right?</th><th>Status</th><th></th></tr></thead><tbody>
    ${list.map((x) => { const late = x.sentDate ? x.sentDate > x.dueDate : x.dueDate < D; const st = late || x.ftr === "no" ? "r" : x.sentDate ? "g" : "a";
      return `<tr><td>${esc(ownerName(x.owner))}</td><td>${esc(x.customer)}</td><td>${esc(x.what)}</td><td>${fmtD(x.dueDate)}</td>
      <td><input type="date" data-ssent="${x.id}" value="${x.sentDate || ""}" /></td>
      <td><select data-sftr="${x.id}">${[["", "–"], ["yes", "Yes"], ["no", "No – rework"]].map(([v, l]) => `<option value="${v}" ${x.ftr === v ? "selected" : ""}>${l}</option>`).join("")}</select></td>
      <td>${chip(st, late ? "late" : x.ftr === "no" ? "not FTR" : x.sentDate ? "on time" : "pending")}</td><td><button class="small danger" data-sdel="${x.id}">×</button></td></tr>`; }).join("") || `<tr><td colspan="8" class="muted">No submissions logged.</td></tr>`}
    </tbody></table></div><p class="small muted">A slip = sent after the due date, still pending past due, or not First Time Right. Weekly: 0 Green · 1 Amber · 2+ Red.</p></div>`;
  }
  bind.subs = () => {
    bindOwnerTabs();
    $("#s-add").onclick = () => { const c = $("#s-cust").value.trim(); if (!c) return toast("Enter customer");
      S.subs.push({ id: uid(), owner: $("#s-owner").value, customer: c, what: $("#s-what").value, dueDate: $("#s-due").value || D, sentDate: "", ftr: "" }); save(); render(); };
    const X = (id) => S.subs.find((x) => x.id === id);
    $$("[data-ssent]").forEach((i) => i.onchange = () => { X(i.dataset.ssent).sentDate = i.value; save(); render(); });
    $$("[data-sftr]").forEach((i) => i.onchange = () => { X(i.dataset.sftr).ftr = i.value; save(); render(); });
    $$("[data-sdel]").forEach((b) => b.onclick = () => { if (confirm("Delete?")) { S.subs = S.subs.filter((x) => x.id !== b.dataset.sdel); save(); render(); } });
  };

  // ----- Saturday shortfall review -----
  function review() {
    const wk = weekStart(D); const wkEnd = addDays(wk, 5); const key = wk; const R = S.reviews[key] = S.reviews[key] || {};
    const asOf = D < wkEnd ? D : wkEnd;
    return `<div class="card"><div class="row"><h2>Saturday shortfall review · week ${fmtD(wk)} – ${fmtD(wkEnd)}</h2><span class="spacer"></span><button id="r-print" type="button" class="secondary">Print / PDF</button></div>
      <p class="small muted">Numbers as of ${fmtDay(asOf)}. Every gap gets a named fix before Monday.</p></div>
    ${S.owners.map((o) => { const m = metrics(o.id, asOf); const r = R[o.id] = R[o.id] || {};
      const moves = S.projects.filter((p) => p.owner === o.id && p.stageDate >= wk && p.stageDate <= asOf && p.createdAt !== p.stageDate).length;
      const visitTarget = 4 * workDaysBetween(wk, wkEnd);
      const rows = [
        ["reach", "Master Plan (Reach)", (() => { const x = reach(o.id, asOf); return `${x.accs.length} accounts (${STAGES.map((st) => st[0] + st.slice(1, 3) + " " + x.byStage[st].length).join(" · ")}); ${x.movesWeek} forward move(s) this week; ${x.untouched.length} not met in ${S.settings.touchGapDays}+ days`; })(),
          (() => { const x = reach(o.id, asOf); return !x.accs.length || x.untouched.filter((a) => a.potential === "High").length > 1 ? "r" : x.movesWeek === 0 || x.untouched.length ? "a" : "g"; })(), "Add SOM accounts; plan visits to stale high-potential accounts"],
        ["deck", "LT Deck use", m.tWin.length ? `${pct(m.deckPct)} of ${m.tWin.length} meetings (last 6 working days)` : "No meetings logged", m.st.deck, "Show corporate video / credentials in every meeting"],
        ["sales", "Sales", `Booked ${cr(m.booked)} vs pro-rata ${cr(m.proRata)} (${pct(m.bookPct)}). Need ${cr(m.runRate)} per working day.`, m.st.book, "Pull forward late-stage deals"],
        ["orders", "Projects (Convert)", `${moves} stage move(s) this week; ${m.stuck.length} stuck ${S.settings.stuckDays}+ days${m.stuck.length ? ": " + m.stuck.map((p) => esc(p.name)).join(", ") : ""}`, m.stuck.length ? (m.stuck.length > 1 ? "r" : "a") : "g", "Demos and factory visits"],
        ["pipeline", "Pipeline", m.remaining > 0 ? `${m.coverage.toFixed(1)}× remaining (${cr(m.pipe)} vs ${cr(m.remaining * 5)} needed)` : "Target met", m.st.pipe, "Hunting days: segments, tenders"],
        ["coll", "Collections", m.overdue.length ? m.overdue.map((x) => `${esc(x.customer)} ${cr(x.out)} · ${x.days}d`).join("; ") : "Nothing overdue", m.st.coll, "Same-day written reminder; escalate"],
        ["visits", "Visits", `${Object.keys(S.daily).filter((d) => d >= wk && d <= asOf).reduce((t, d) => t + num(S.daily[d][o.id]?.visitCount), 0)} vs ${visitTarget} this week`, m.st.visits, "Find the cause; reset the plan"],
        ["subs", "Submissions", `${m.slips.length} slip(s)`, m.st.subs, "Checklist before send; second pair of eyes"],
      ];
      return `<div class="card"><h3 style="margin-top:0">${esc(o.name)}</h3><div class="table-wrap"><table><thead><tr><th>Area</th><th>Where we are</th><th>Status</th><th style="width:35%">Named fix (owner, by when)</th></tr></thead><tbody>
      ${rows.map(([k, l, txt, st, hint]) => `<tr><td><b>${l}</b></td><td class="small">${txt}</td><td>${chip(st)}</td><td><textarea data-rv="${o.id}|${k}" placeholder="${st === "g" ? "–" : hint}" rows="2">${esc(r[k])}</textarea></td></tr>`).join("")}
      </tbody></table></div></div>`; }).join("")}`;
  }
  bind.review = () => {
    const wk = weekStart(D);
    $$("[data-rv]").forEach((t) => t.onchange = () => { const [o, k] = t.dataset.rv.split("|"); S.reviews[wk][o][k] = t.value; save(); toast("Saved"); });
    $("#r-print").onclick = () => window.print();
  };

  // ----- Work ethic evidence -----
  function ethics() {
    const list = S.ethics.filter((x) => selOwner === "all" || x.owner === selOwner).sort((a, b) => b.date.localeCompare(a.date));
    const Q = quarter(D);
    return `${ownerTabs(true)}
    <div class="card"><h2>Evidence summary · ${PERIOD.label}</h2>
      <p class="small muted">20% of the annual increment: Work Ethic Principles 10% · LT Values 5% · LT Ethos 5%. Raise gaps the same week, with one example and one expected change.</p>
      <div class="table-wrap"><table><thead><tr><th>Owner</th>${PRINCIPLES.map((p) => `<th class="num">${p}</th>`).join("")}</tr></thead><tbody>
      ${S.owners.map((o) => `<tr><td>${esc(o.name)}</td>${PRINCIPLES.map((p) => { const xs = S.ethics.filter((x) => x.owner === o.id && x.principle === p && x.date >= PERIOD.start);
        const g = xs.filter((x) => x.kind === "good").length; const b = xs.length - g; return `<td class="num">${g ? `<span title="positive">+${g}</span>` : ""} ${b ? `<b style="color:#9b1f1f" title="gaps">−${b}</b>` : ""}${!g && !b ? "·" : ""}</td>`; }).join("")}</tr>`).join("")}
      </tbody></table></div></div>
    <div class="card no-print"><h2>Log evidence</h2><div class="form">
      <label>Owner<select id="e-owner">${ownerOpts(selOwner === "all" ? "umesh" : selOwner)}</select></label>
      <label>Principle<select id="e-pr">${PRINCIPLES.map((p) => `<option>${p}</option>`).join("")}</select></label>
      <label>Type<select id="e-kind"><option value="good">Good example</option><option value="gap">Gap</option></select></label>
      <label>Date<input id="e-date" type="date" value="${D}" /></label></div>
      <label class="field">Example (what happened)<textarea id="e-ex"></textarea></label>
      <label class="field">Expected change (for gaps)<textarea id="e-ch"></textarea></label>
      <button id="e-add" type="button">Add</button></div>
    <div class="card"><h2>Log</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>Owner</th><th>Principle</th><th>Type</th><th>Example</th><th>Expected change</th><th></th></tr></thead><tbody>
      ${list.map((x) => `<tr><td>${fmtD(x.date)}</td><td>${esc(ownerName(x.owner))}</td><td>${esc(x.principle)}</td><td>${x.kind === "good" ? chip("g", "good") : chip("r", "gap")}</td><td class="small">${esc(x.example)}</td><td class="small">${esc(x.change)}</td><td><button class="small danger" data-edel="${x.id}">×</button></td></tr>`).join("") || `<tr><td colspan="7" class="muted">Nothing logged yet.</td></tr>`}
    </tbody></table></div></div>`;
  }
  bind.ethics = () => {
    bindOwnerTabs();
    $("#e-add").onclick = () => { const ex = $("#e-ex").value.trim(); if (!ex) return toast("Describe the example");
      S.ethics.push({ id: uid(), owner: $("#e-owner").value, principle: $("#e-pr").value, kind: $("#e-kind").value, date: $("#e-date").value || D, example: ex, change: $("#e-ch").value.trim() }); save(); render(); };
    $$("[data-edel]").forEach((b) => b.onclick = () => { if (confirm("Delete?")) { S.ethics = S.ethics.filter((x) => x.id !== b.dataset.edel); save(); render(); } });
  };

  // ----- Settings -----
  function settings() {
    const s = S.settings; const B = s.bands; const Q = quarter(D);
    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `<div class="card"><h2>Team and targets (Rs Cr) · ${PERIOD.label}</h2>
      <p class="small muted">The tracker covers Q3 (Oct–Dec 2026) and Q4 (Jan–Mar 2027) only. Targets start split equally between Q3 and Q4 – type in your own Q3 and Q4 figures. "Q3 booked before tracker" is the order value booked from 1 Oct to ${fmtD(addDays(s.trackerStart, -1))}. Any Q3 shortfall rolls into Q4.</p>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th class="num">Target Q3+Q4</th><th class="num">Q3 target</th><th class="num">Q4 target</th><th class="num">Q3 booked before tracker</th><th class="num">Avg order (lakh)</th></tr></thead><tbody>
      ${S.owners.map((o) => `<tr><td><input data-on="${o.id}" value="${esc(o.name)}" /></td><td class="num"><input type="number" step="0.01" data-oa="${o.id}" value="${num(o.annual)}" style="width:5rem"/></td>
        ${PERIOD.qs.map((i) => `<td class="num"><input type="number" step="0.01" data-oq="${o.id}|${i}" value="${num(o.q[i])}" style="width:5rem"/></td>`).join("")}
        <td class="num"><input type="number" step="0.01" data-oo="${o.id}|2" value="${num(o.opening[2])}" style="width:5rem"/></td>
        <td class="num"><input type="number" step="1" data-oaov="${o.id}" value="${num(o.aovLakh)}" style="width:4.5rem"/></td></tr>`).join("")}
      </tbody></table></div>
      <p class="small" id="q-check"></p>
      <button id="split-btn" type="button" class="secondary">Split each target equally between Q3 and Q4</button></div>

    <div class="card"><h2>This device</h2><div class="form">
      <label>This phone/computer belongs to<select id="st-dev">${ownerOpts(s.deviceOwner)}</select></label>
      <label>Tracker start date<input id="st-start" type="date" value="${s.trackerStart}" /></label>
      <label>Joint visits per member per week<input id="st-joint" type="number" min="0" value="${s.jointPerWeek}" /></label>
      <label>Deal "stuck" after (days in one stage)<input id="st-stuck" type="number" min="1" value="${s.stuckDays}" /></label>
      <label>Master Plan account needs a visit after (days)<input id="st-gap" type="number" min="1" value="${s.touchGapDays}" /></label></div>
      <div class="field" style="margin-top:.6rem">Working days<div class="row">${DAYS.map((d, i) => `<label class="check" style="display:flex;gap:.25rem"><input type="checkbox" data-wd="${i}" ${s.workDays.includes(i) ? "checked" : ""}/>${d}</label>`).join("")}</div></div>
      <label class="field" style="margin-top:.6rem">Holidays (YYYY-MM-DD, comma or new line)<textarea id="st-hol">${s.holidays.join("\n")}</textarea></label></div>

    <div class="card"><h2>Scorecard bands</h2><p class="small muted">Starting points from the kick-off deck – tune after the first month.</p><div class="form">
      <label>Visits/day Green from<input type="number" step="0.5" data-b="visitsG" value="${B.visitsG}" /></label>
      <label>Visits/day Amber from<input type="number" step="0.5" data-b="visitsA" value="${B.visitsA}" /></label>
      <label>Pipeline Green from (×)<input type="number" step="0.5" data-b="pipeG" value="${B.pipeG}" /></label>
      <label>Pipeline Amber from (×)<input type="number" step="0.5" data-b="pipeA" value="${B.pipeA}" /></label>
      <label>Booking Green from (% pro-rata)<input type="number" data-b="bookG" value="${B.bookG}" /></label>
      <label>Booking Amber from (%)<input type="number" data-b="bookA" value="${B.bookA}" /></label>
      <label>Collections Amber up to (days late)<input type="number" data-b="collA" value="${B.collA}" /></label>
      <label>Private customer always Red after (days)<input type="number" data-b="privRed" value="${B.privRed}" /></label>
      <label>Submission slips/week still Amber<input type="number" data-b="subsA" value="${B.subsA}" /></label>
      <label>LT Deck use Green from (% of meetings)<input type="number" data-b="deckG" value="${B.deckG}" /></label>
      <label>LT Deck use Amber from (%)<input type="number" data-b="deckA" value="${B.deckA}" /></label></div></div>

    <div class="card no-print"><h2>Backup</h2>
      <p class="small muted">Data is stored only in this browser. Export a backup regularly (and before clearing browser data).</p>
      <div class="row"><button id="bk-exp" type="button">Export backup (JSON)</button>
      <label class="button secondary" for="bk-imp">Import backup</label><input id="bk-imp" type="file" accept=".json,application/json" hidden />
      <button id="csv-exp" type="button" class="secondary">Export daily log (CSV)</button>
      <button id="csv-mp" type="button" class="secondary">Export Master Plan &amp; meetings (CSV)</button>
      <button id="bk-reset" type="button" class="danger">Erase all data</button></div></div>`;
  }
  bind.settings = () => {
    const s = S.settings;
    const qcheck = () => { $("#q-check").innerHTML = S.owners.map((o) => { const t = num(o.q[2]) + num(o.q[3]);
      return Math.abs(t - num(o.annual)) > 0.01 ? `<span class="chip a">Check</span> ${esc(o.name)}: Q3 + Q4 add up to ${cr(t)}, target is ${cr(num(o.annual))}` : ""; }).filter(Boolean).join("<br>"); };
    qcheck();
    const O = (id) => owner(id);
    $$("[data-on]").forEach((i) => i.onchange = () => { O(i.dataset.on).name = i.value.trim() || O(i.dataset.on).name; save(); });
    $$("[data-oa]").forEach((i) => i.onchange = () => { O(i.dataset.oa).annual = num(i.value); save(); qcheck(); });
    $$("[data-oq]").forEach((i) => i.onchange = () => { const [o, q] = i.dataset.oq.split("|"); O(o).q[q] = num(i.value); save(); qcheck(); });
    $$("[data-oo]").forEach((i) => i.onchange = () => { const [o, q] = i.dataset.oo.split("|"); O(o).opening[q] = num(i.value); save(); });
    $$("[data-oaov]").forEach((i) => i.onchange = () => { O(i.dataset.oaov).aovLakh = num(i.value) || 25; save(); });
    $("#split-btn").onclick = () => { for (const o of S.owners) o.q = half(num(o.annual)); save(); render(); };
    $("#st-dev").onchange = (e) => { s.deviceOwner = e.target.value; selOwner = s.deviceOwner; save(); };
    $("#st-start").onchange = (e) => { if (e.target.value) { s.trackerStart = e.target.value; save(); } };
    $("#st-joint").onchange = (e) => { s.jointPerWeek = num(e.target.value); save(); };
    $("#st-stuck").onchange = (e) => { s.stuckDays = num(e.target.value) || 14; save(); };
    $("#st-gap").onchange = (e) => { s.touchGapDays = num(e.target.value) || 30; save(); };
    $$("[data-wd]").forEach((c) => c.onchange = () => { s.workDays = $$("[data-wd]").filter((x) => x.checked).map((x) => +x.dataset.wd); save(); });
    $("#st-hol").onchange = (e) => { s.holidays = e.target.value.split(/[\s,]+/).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)); save(); };
    $$("[data-b]").forEach((i) => i.onchange = () => { s.bands[i.dataset.b] = num(i.value); save(); });
    $("#bk-exp").onclick = () => download(`po-tracker-backup-${todayStr()}.json`, JSON.stringify(S, null, 1), "application/json");
    $("#bk-imp").onchange = async (e) => { const f = e.target.files[0]; if (!f) return;
      try { const d = migrate(JSON.parse(await f.text())); if (d.version !== 3 || !Array.isArray(d.owners)) throw 0;
        if (!confirm("Replace all data on this device with the backup?")) return; localStorage.setItem(KEY, JSON.stringify(d)); S = load(); toast("Backup restored"); render();
      } catch { toast("Not a PO Tracker backup"); } };
    $("#csv-mp").onclick = () => {
      const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const rows = [["Owner", ...IMPORT_COLS.map(([, l]) => l), "Last met", "Meetings", "With LT Deck"].join(",")];
      for (const a of S.accounts.filter((a) => !a.archived)) { const ts = S.touches.filter((t) => t.accountId === a.id);
        rows.push([ownerName(a.owner), ...IMPORT_COLS.map(([f]) => f === "leadCr" || f === "actualCr" ? (num(a[f]) || "") : a[f]), lastTouch(a.id), ts.length, ts.filter((t) => (t.deck || []).length).length].map(q).join(",")); }
      rows.push("", ["Date", "Owner", "Account", "Meeting", "LT Deck shown", "Stage before", "Stage after", "New project", "Outcome"].join(","));
      for (const t of [...S.touches].sort((a, b) => a.date.localeCompare(b.date))) rows.push([t.date, ownerName(t.owner), accName(t.accountId), t.type, deckTxt(t.deck), t.stageFrom, t.stageTo, t.newProject ? "yes" : "", t.outcome].map(q).join(","));
      download(`po-tracker-master-plan-${todayStr()}.csv`, rows.join("\n"), "text/csv");
    };
    $("#csv-exp").onclick = () => {
      const cols = ["date", "owner", "visitCount", "newQualified", "specApprovals", "pos", "offersSent", "offersFTR", "collReceived", "collPromised", "closedAt", "visitNames", "plan", "help", "tomorrow"];
      const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const rows = [cols.join(",")];
      for (const d of Object.keys(S.daily).sort()) for (const o of Object.keys(S.daily[d])) { const e = S.daily[d][o]; rows.push(cols.map((c) => q(c === "date" ? d : c === "owner" ? ownerName(o) : e[c])).join(",")); }
      download(`po-tracker-daily-${todayStr()}.csv`, rows.join("\n"), "text/csv");
    };
    $("#bk-reset").onclick = () => { if (confirm("Erase ALL tracker data on this device? Export a backup first.") && confirm("Really erase?")) { S = defaults(); save(); render(); } };
  };
  function download(name, text, type) { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

  // ---------- boot ----------
  $("#as-of").min = PERIOD.start; $("#as-of").max = PERIOD.end;
  $("#as-of").onchange = (e) => { if (e.target.value) { D = clampD(e.target.value); render(); } };
  window.addEventListener("hashchange", render);
  render();

  let deferred;
  // Install: use the browser prompt when offered, otherwise show the manual steps for this device.
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (!standalone) $("#install-btn").hidden = false;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; });
  window.addEventListener("appinstalled", () => { $("#install-btn").hidden = true; $("#install-help").hidden = true; toast("Installed"); });
  $("#install-btn").onclick = async () => {
    if (deferred) { deferred.prompt(); const r = await deferred.userChoice; deferred = null; if (r.outcome === "accepted") $("#install-btn").hidden = true; return; }
    const ua = navigator.userAgent; const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const android = /Android/.test(ua); const inApp = /FBAN|FBAV|Instagram|WhatsApp|Line\//.test(ua);
    let steps;
    if (inApp) steps = "<li>This page is open inside another app (e.g. WhatsApp). Tap ⋮ or the share icon and choose <b>Open in Chrome</b> (Android) or <b>Open in Safari</b> (iPhone), then tap Install app again.</li>";
    else if (ios) steps = "<li>Open this page in <b>Safari</b> (or Chrome on iPhone).</li><li>Tap the <b>Share</b> button (square with an arrow).</li><li>Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>";
    else if (android) steps = "<li>Open this page in <b>Chrome</b>.</li><li>Tap the <b>⋮</b> menu at the top right.</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>, then <b>Install</b>.</li><li>If neither appears, reload the page once and try again.</li>";
    else steps = "<li>Use <b>Chrome</b> or <b>Edge</b>.</li><li>Click the install icon at the right end of the address bar, or open the <b>⋮ / …</b> menu → <b>Cast, save and share → Install page as app</b> (Chrome) or <b>Apps → Install this site as an app</b> (Edge).</li><li>If it isn't offered, reload the page once and try again.</li>";
    $("#install-help").innerHTML = `<div class="row"><b>Install PO Tracker</b><span class="spacer"></span><button type="button" class="small secondary" id="ih-close">Close</button></div><ol>${steps}</ol>`;
    $("#install-help").hidden = false; $("#ih-close").onclick = () => ($("#install-help").hidden = true);
  };
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js");
})();
