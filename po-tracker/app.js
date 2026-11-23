/* PO Tracker – daily Performance Obligation scorecard (Reach · Convert · Retain).
   All data stays in this browser (localStorage). Values are in Rs crore unless stated. */
(() => {
  "use strict";
  const KEY = "po-tracker-data-v1";
  const STAGES = ["Sprouting", "Seeding", "Budding", "Flowering", "Ripening"];
  const PRINCIPLES = ["SOP compliance", "Error-free output", "Report the problem", "Problem solver",
    "Perfect communication", "LT Values", "LT Ethos"];
  const IND = [
    ["visits", "F2F visits"],
    ["pipe", "Pipeline vs remaining"],
    ["book", "Booking vs pro-rata"],
    ["coll", "Collections vs dues"],
    ["subs", "Submissions on time, FTR"],
  ];
  const STATUS_TXT = { g: "Green", a: "Amber", r: "Red", na: "No data" };
  const RANK = { na: 0, g: 1, a: 2, r: 3 };

  // ---------- defaults ----------
  function defaults() {
    const owner = (id, name, annual, isHead) => ({
      id, name, isHead: !!isHead, annual, q: [annual / 4, annual / 4, annual / 4, annual / 4],
      opening: [0, 0, 0, 0], aovLakh: 25,
    });
    return {
      version: 1,
      settings: {
        trackerStart: "2026-11-16", workDays: [1, 2, 3, 4, 5, 6], holidays: [], deviceOwner: "head",
        bands: { visitsG: 4, visitsA: 3, pipeG: 5, pipeA: 4, bookG: 100, bookA: 80, collA: 15, privRed: 30, subsA: 1 },
        jointPerWeek: 2, stuckDays: 14,
      },
      owners: [
        owner("head", "Sales Head (me)", 30, true),
        owner("umesh", "Umesh Gour", 6),
        owner("santhosh", "Santhosh Kumar", 12),
        owner("mithunn", "Mithunn Kumar", 12),
      ],
      daily: {}, projects: [], orders: [], dues: [], subs: [], ethics: [], reviews: {}, snapshots: {}, checks: {},
    };
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && d.version === 1) {
        const def = defaults();
        d.settings = { ...def.settings, ...d.settings, bands: { ...def.settings.bands, ...(d.settings || {}).bands } };
        for (const k of ["daily", "reviews", "snapshots", "checks"]) d[k] = d[k] || {};
        for (const k of ["projects", "orders", "dues", "subs", "ethics"]) d[k] = d[k] || [];
        return d;
      }
    } catch (e) { /* fall through */ }
    return defaults();
  }
  let S = load();
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
  const worst = (arr) => arr.reduce((w, s) => (RANK[s] > RANK[w] ? s : w), "na");
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600); }

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
    for (let i = 0; i < q; i++) carry = Math.max(0, num(owner(o).q[i]) + carry - bookedInQuarter(o, fy, i));
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
    const ripening = pipeProjects.filter((p) => p.stage === "Ripening");

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

    // submissions this week
    const wkSubs = S.subs.filter((x) => x.owner === o && x.dueDate >= wk && x.dueDate <= D);
    const slips = wkSubs.filter((x) => (!x.sentDate && x.dueDate < D) || (x.sentDate && x.sentDate > x.dueDate) || x.ftr === "no");

    const st = {};
    st.visits = isNaN(vAvg) ? "na" : vAvg >= B.visitsG ? "g" : vAvg >= B.visitsA ? "a" : "r";
    st.pipe = remaining <= 0 ? "g" : coverage >= B.pipeG ? "g" : coverage >= B.pipeA ? "a" : "r";
    st.book = eff <= 0 ? "na" : bookPct >= B.bookG ? "g" : bookPct >= B.bookA ? "a" : "r";
    st.coll = privOver30 || maxOver > B.collA ? "r" : maxOver > 0 ? "a" : "g";
    st.subs = slips.length === 0 ? "g" : slips.length <= B.subsA ? "a" : "r";
    const stuck = S.projects.filter((p) => p.owner === o && p.status === "open" && p.stageDate && diffDays(D, p.stageDate) >= S.settings.stuckDays);

    return { Q, qTarget, carry, eff, booked, remaining, wdTotal, wdElapsed, wdLeft, proRata, bookPct, pipe, pipeProjects, coverage, aov, toWin,
      qualNeeded: toWin * 5, ripening, vAvg, vDays, missingCloses, weekVisits, qVisits, qVisitTarget, overdue, maxOver, privOver30,
      overdueAmt: sumV(overdue, "out"), collEff, slips, wkSubs, st, stuck, closedToday,
      runRate: wdLeft > 0 ? remaining / wdLeft : remaining };
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
      for (const p of m.ripening) {
        const missing = [["dm", "decision-maker"], ["competitor", "competitor"], ["pricePos", "price position"], ["nextMove", "today's move"]].filter(([f]) => !p[f]).map(([, l]) => l);
        if (missing.length) out.push(["a", `${n}: Ripening "${p.name}" missing ${missing.join(", ")}`]);
      }
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
  let D = todayStr();
  let selOwner = S.settings.deviceOwner || "head";
  const views = { dashboard, daily, pipeline, orders, dues, subs, review, ethics, settings };

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
    const fyStart = `${Q.fy}-04-01`;
    const teamFY = S.owners.reduce((t, o) => t + [0, 1, 2, 3].reduce((u, q) => u + (qBounds(Q.fy, q).start <= D ? bookedInQuarter(o.id, Q.fy, q, D) : 0), 0), 0);
    const teamPipe = S.owners.reduce((t, o) => t + ms[o.id].pipe, 0); const teamRem = S.owners.reduce((t, o) => t + ms[o.id].remaining, 0);
    const teamOver = S.owners.reduce((t, o) => t + ms[o.id].overdueAmt, 0);
    const proRataTeam = S.owners.reduce((t, o) => t + ms[o.id].proRata, 0);
    const flags = flagsFor(D);
    const openingsMissing = S.owners.every((o) => o.opening.every((v) => !num(v))) && S.orders.length === 0;
    const checkTime = S.checks[D];
    const wk = weekStart(D);

    return `
    ${openingsMissing ? `<div class="banner"><b>Set up first:</b> enter each owner's Q-wise targets and the orders already booked before ${fmtD(S.settings.trackerStart)} in <a href="#settings">Settings</a>. Until then, Q1–Q2 count as zero booked and the full shortfall rolls into this quarter.</div>` : ""}
    <div class="tiles">
      <div class="tile"><div class="label">Team booking · ${Q.label}</div><div class="value">${cr(teamBooked)}</div><div class="sub">of ${cr(teamEff)} (incl. carry-forward) · ${pct(teamBooked / proRataTeam * 100)} of pro-rata</div></div>
      <div class="tile"><div class="label">Team FY booking</div><div class="value">${cr(teamFY)}</div><div class="sub">of ${cr(teamAnnual)} annual target · ${pct(teamFY / teamAnnual * 100)}</div></div>
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
            <td><b>${esc(o.name)}</b><span class="cell-val">FY target ${cr(num(o.annual))}</span></td>
            <td>${chip(m.st.visits, isNaN(m.vAvg) ? "no closes yet" : `${m.vAvg.toFixed(1)}/day · wk ${m.weekVisits}/24`)}</td>
            <td>${chip(m.st.pipe, m.remaining > 0 ? `${m.coverage.toFixed(1)}× · ${cr(m.pipe)}` : "target met")}</td>
            <td>${chip(m.st.book, `${pct(m.bookPct)} · ${cr(m.booked)}`)}</td>
            <td>${chip(m.st.coll, m.overdue.length ? `${m.overdue.length} overdue · max ${m.maxOver}d` : "nothing overdue")}</td>
            <td>${chip(m.st.subs, `${m.slips.length} slip(s) this week`)}</td>
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
        <p class="small muted">Logged in the Head's evening close. Also: every Ripening negotiation pre-agreed (price floor, terms, competitor counter) and overdue private customers called daily.</p>
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
        <tr><td>Qualified projects needed (5×) / in Master Plan</td><td class="num">${m.qualNeeded} / ${m.pipeProjects.length}</td></tr>
        <tr><td>At negotiation (Ripening): needed ~2× / actual</td><td class="num">${m.toWin * 2} / ${m.ripening.length}</td></tr>
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
  function daily() {
    if (selOwner === "all") selOwner = "head";
    const o = selOwner; const ow = owner(o); const e = S.daily[D]?.[o] || {}; const m = metrics(o, D);
    const dueSoon = S.dues.filter((x) => x.owner === o && outstanding(x, D) > 0.0001 && x.dueDate <= addDays(D, 3)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const todaysOrders = S.orders.filter((x) => x.owner === o && x.date === D);
    const planLines = (e.plan || "").split("\n").filter((l) => l.trim()).length;
    return `${ownerTabs()}
    ${!isWork(D) ? `<div class="banner">${fmtDay(D)} is not a working day.</div>` : ""}
    <div class="grid">
    <div class="card qs">
      <h2>Morning huddle · 9:00–9:20 · ${esc(ow.name)}</h2>
      <div class="q"><h3>Collections due or overdue</h3>
        ${dueSoon.length ? `<table class="small"><thead><tr><th>Customer</th><th>Due</th><th class="num">Outstanding</th><th></th></tr></thead><tbody>${dueSoon.map((x) => `<tr><td>${esc(x.customer)}${x.private ? " <span class='muted'>(private)</span>" : ""}</td><td>${fmtD(x.dueDate)}</td><td class="num">${cr(outstanding(x, D))}</td><td>${x.dueDate < D ? chip(diffDays(D, x.dueDate) > S.settings.bands.collA ? "r" : "a", diffDays(D, x.dueDate) + "d late") : chip("g", x.dueDate === D ? "due today" : "upcoming")}</td></tr>`).join("")}</tbody></table>` : `<p class="muted small">Nothing due in the next 3 days.</p>`}
        <label class="field">Who calls / visits, how much expected today<textarea id="h-coll">${esc(e.collPlan)}</textarea></label></div>
      <div class="q"><h3>Negotiation stage (Ripening)</h3>
        ${m.ripening.length ? m.ripening.map((p) => `<div class="card" style="padding:.6rem">
          <b>${esc(p.name)}</b> · ${esc(p.customer)} · ${cr(num(p.value))}
          <div class="form" style="margin-top:.4rem">
            <label>Decision-maker<input data-rp="${p.id}" data-f="dm" value="${esc(p.dm)}" /></label>
            <label>Competitor<input data-rp="${p.id}" data-f="competitor" value="${esc(p.competitor)}" /></label>
            <label>Our price position<input data-rp="${p.id}" data-f="pricePos" value="${esc(p.pricePos)}" /></label>
            <label>Today's move<input data-rp="${p.id}" data-f="nextMove" value="${esc(p.nextMove)}" /></label>
          </div></div>`).join("") : `<p class="muted small">No Ripening projects. Need about ${m.toWin * 2} at any time.</p>`}</div>
      <div class="q"><h3>Visit plan (4+ named customers with purpose)</h3>
        <label class="field">One per line: Customer – purpose<textarea id="h-plan" rows="5">${esc(e.plan)}</textarea></label>
        <div class="row small"><span id="plan-count">${planLines} planned</span>
        <label class="check" style="display:flex;gap:.3rem"><input type="checkbox" id="h-newproj" ${e.planNewProject ? "checked" : ""}/> includes at least one new qualified project</label></div></div>
      <div class="q"><h3>Help needed (Wire &amp; Win)</h3>
        <div class="form"><label>From<select id="h-helpwho">${["", "Head", "Factory", "R&D", "Colleague", "Accounts"].map((x) => `<option ${e.helpWho === x ? "selected" : ""}>${x}</option>`).join("")}</select></label></div>
        <label class="field">What, by when<textarea id="h-help">${esc(e.help)}</textarea></label></div>
      <button id="save-huddle" type="button">Save huddle</button>
      ${e.huddleAt ? `<span class="small muted"> Saved ${e.huddleAt.slice(11, 16)}</span>` : ""}
    </div>

    <div class="card">
      <h2>Evening close · by 6:30 · ${esc(ow.name)}</h2>
      <div class="form">
        <label>F2F visits done<input id="c-visits" type="number" min="0" value="${e.visitCount ?? ""}" /></label>
        <label>New qualified projects found<input id="c-newq" type="number" min="0" value="${e.newQualified ?? ""}" /></label>
        <label>Spec approvals<input id="c-spec" type="number" min="0" value="${e.specApprovals ?? ""}" /></label>
        <label>POs received<input id="c-pos" type="number" min="0" value="${e.pos ?? ""}" /></label>
        <label>Offers sent<input id="c-offers" type="number" min="0" value="${e.offersSent ?? ""}" /></label>
        <label class="check"><input id="c-ftr" type="checkbox" ${e.offersFTR !== false ? "checked" : ""}/> All offers checked First Time Right</label>
        <label>Collections received (Rs Cr)<input id="c-collr" type="number" step="0.01" min="0" value="${e.collReceived ?? ""}" /></label>
        <label>Collections promised (Rs Cr)<input id="c-collp" type="number" step="0.01" min="0" value="${e.collPromised ?? ""}" /></label>
      </div>
      <label class="field">Visit names (one per line)<textarea id="c-vnames">${esc(e.visitNames)}</textarea></label>
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
    </div>

    <div class="card no-print">
      <h2>Import a team member's evening close</h2>
      <p class="small muted">Team members using the app on their own phones tap <b>Send as message</b>. Paste the whole message here to load it into your tracker.</p>
      <textarea id="imp-text" placeholder="Paste message…"></textarea>
      <button id="imp-btn" type="button">Import</button>
    </div>`;
  }
  function closeText(d, o) {
    const e = S.daily[d]?.[o] || {}; const ord = S.orders.filter((x) => x.owner === o && x.date === d);
    const lines = [
      `*Evening close – ${ownerName(o)} – ${fmtD(d)}*`,
      `Visits: ${e.visitCount ?? 0} / 4${e.visitNames ? " (" + e.visitNames.split("\n").filter(Boolean).join(", ") + ")" : ""}`,
      `New qualified projects: ${e.newQualified ?? 0}`,
      `Collections received: Rs ${e.collReceived ?? 0} Cr · promised: Rs ${e.collPromised ?? 0} Cr`,
      `Orders: ${ord.length ? ord.map((x) => `${x.customer} Rs ${x.value} Cr`).join("; ") : "none"}`,
      `Spec approvals: ${e.specApprovals ?? 0} · POs: ${e.pos ?? 0}`,
      `Offers sent: ${e.offersSent ?? 0}${e.offersFTR === false ? " (not all FTR)" : " (FTR)"}`,
      `Tomorrow: ${e.tomorrow || "-"}`,
    ];
    const payload = { d, o, e: { ...e }, orders: ord };
    lines.push("", "#POT1:" + btoa(unescape(encodeURIComponent(JSON.stringify(payload)))));
    return lines.join("\n");
  }
  bind.daily = () => {
    bindOwnerTabs();
    const o = selOwner;
    $("#h-plan").oninput = () => { $("#plan-count").textContent = $("#h-plan").value.split("\n").filter((l) => l.trim()).length + " planned"; };
    $$("[data-rp]").forEach((inp) => inp.onchange = () => { const p = S.projects.find((x) => x.id === inp.dataset.rp); p[inp.dataset.f] = inp.value.trim(); save(); });
    $("#save-huddle").onclick = () => {
      const e = entry(D, o); e.collPlan = $("#h-coll").value; e.plan = $("#h-plan").value; e.planNewProject = $("#h-newproj").checked;
      e.help = $("#h-help").value; e.helpWho = $("#h-helpwho").value; e.huddleAt = localStamp(); save();
      const n = e.plan.split("\n").filter((l) => l.trim()).length;
      toast(n < 4 ? `Saved. Only ${n} visits planned – need 4.` : "Huddle saved"); render();
    };
    $("#c-oadd").onclick = () => {
      const v = num($("#c-oval").value); const c = $("#c-ocust").value.trim();
      if (!c || v <= 0) return toast("Enter customer and value");
      saveClose(false);
      S.orders.push({ id: uid(), owner: o, date: D, customer: c, project: $("#c-oproj").value.trim(), value: v }); save(); toast("Order added"); render();
    };
    function saveClose(stamp = true) {
      const e = entry(D, o);
      const vn = $("#c-vnames").value; const vc = $("#c-visits").value;
      e.visitNames = vn; e.visitCount = vc === "" ? vn.split("\n").filter((l) => l.trim()).length : num(vc);
      e.newQualified = num($("#c-newq").value); e.specApprovals = num($("#c-spec").value); e.pos = num($("#c-pos").value);
      e.offersSent = num($("#c-offers").value); e.offersFTR = $("#c-ftr").checked;
      e.collReceived = num($("#c-collr").value); e.collPromised = num($("#c-collp").value); e.tomorrow = $("#c-tomorrow").value;
      if (owner(o).isHead) e.jointWith = $$("[data-joint]").filter((c) => c.checked).map((c) => c.dataset.joint);
      else e.jointWithHead = $("#c-joint").checked;
      if (stamp) { e.closedAt = e.closedAt || localStamp(); e.updatedAt = localStamp(); }
      save();
    }
    $("#save-close").onclick = () => { saveClose(); const e = S.daily[D][o]; toast(e.visitCount < 4 ? `Saved. ${e.visitCount} visits – below 4.` : "Evening close saved"); render(); };
    $("#share-close").onclick = async () => {
      saveClose(); const text = closeText(D, o);
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
        let added = 0;
        for (const x of p.orders || []) if (!S.orders.some((y) => y.id === x.id)) { S.orders.push(x); added++; }
        save(); toast(`Imported ${ownerName(p.o)} for ${fmtD(p.d)}${added ? `, ${added} order(s)` : ""}. Record collections in Collections.`); render();
      } catch { toast("Could not read the code"); }
    };
  };
  function localStamp() { const n = new Date(); return `${ymd(n)}T${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`; }

  // ----- Pipeline (Master Plan) -----
  let pipeFilter = "open";
  function pipeline() {
    const list = S.projects.filter((p) => (selOwner === "all" || p.owner === selOwner) && (pipeFilter === "all" || p.status === pipeFilter))
      .sort((a, b) => STAGES.indexOf(b.stage) - STAGES.indexOf(a.stage) || num(b.value) - num(a.value));
    const showOwner = selOwner === "all";
    return `${ownerTabs(true)}
    <div class="card no-print"><h2>Add project to Master Plan</h2>
      <div class="form">
        <label>Owner<select id="p-owner">${ownerOpts(selOwner === "all" ? S.settings.deviceOwner : selOwner)}</select></label>
        <label>Project<input id="p-name" /></label><label>Customer / developer<input id="p-cust" /></label>
        <label>Source<select id="p-seg">${["SOM", "Consultant", "Contractor", "Tender", "Developer", "Govt / PSU", "Other"].map((x) => `<option>${x}</option>`).join("")}</select></label>
        <label>Value (Rs Cr)<input id="p-val" type="number" step="0.01" min="0" /></label>
        <label>Stage<select id="p-stage">${STAGES.map((s) => `<option>${s}</option>`).join("")}</select></label>
        <label>Expected order date<input id="p-close" type="date" /></label>
        <label class="check"><input id="p-qual" type="checkbox" checked /> Qualified</label>
        <button id="p-add" type="button">Add</button>
      </div></div>
    <div class="card">
      <div class="row"><h2>Master Plan</h2><span class="spacer"></span>
        <select id="p-filter">${[["open", "Open"], ["won", "Won"], ["lost", "Lost"], ["all", "All"]].map(([v, l]) => `<option value="${v}" ${pipeFilter === v ? "selected" : ""}>${l}</option>`).join("")}</select></div>
      ${selOwner !== "all" ? (() => { const m = metrics(selOwner, D); return `<p class="small">Qualified open pipeline ${cr(m.pipe)} vs 5× remaining ${cr(m.remaining * 5)} → ${chip(m.st.pipe, m.remaining > 0 ? m.coverage.toFixed(1) + "×" : "target met")}</p>`; })() : ""}
      <div class="table-wrap"><table><thead><tr>${showOwner ? "<th>Owner</th>" : ""}<th>Project</th><th>Customer</th><th class="num">Value</th><th>Stage</th><th>In stage</th><th>Q</th><th>Next move</th><th></th></tr></thead><tbody>
      ${list.map((p) => { const days = p.stageDate ? diffDays(D, p.stageDate) : 0; const stuck = p.status === "open" && days >= S.settings.stuckDays;
        return `<tr>${showOwner ? `<td>${esc(ownerName(p.owner))}</td>` : ""}
          <td><b>${esc(p.name)}</b><span class="cell-val">${esc(p.segment || "")}${p.closeDate ? " · exp. " + fmtD(p.closeDate) : ""}</span></td><td>${esc(p.customer)}</td>
          <td class="num"><input type="number" step="0.01" data-pv="${p.id}" value="${num(p.value)}" style="width:5.5rem" /></td>
          <td>${p.status === "open" ? `<select data-ps="${p.id}">${STAGES.map((s) => `<option ${s === p.stage ? "selected" : ""}>${s}</option>`).join("")}</select>` : `<b>${p.status.toUpperCase()}</b>`}</td>
          <td>${p.status === "open" ? (stuck ? chip("r", days + " days") : days + " d") : ""}</td>
          <td><input type="checkbox" data-pq="${p.id}" ${p.qualified ? "checked" : ""} title="Qualified" /></td>
          <td><input data-pn="${p.id}" value="${esc(p.nextMove)}" placeholder="next move" /></td>
          <td class="row">${p.status === "open" ? `<button class="small" data-pwon="${p.id}">Won</button><button class="small danger" data-plost="${p.id}">Lost</button>` : `<button class="small secondary" data-preopen="${p.id}">Reopen</button>`}<button class="small danger" data-pdel="${p.id}">×</button></td></tr>`; }).join("") || `<tr><td colspan="9" class="muted">No projects.</td></tr>`}
      </tbody></table></div>
      <p class="small muted">Stages: Sprouting → Seeding → Budding → Flowering → Ripening. A project is flagged when it sits in one stage ${S.settings.stuckDays}+ days. Marking a project Won books it as an order on the scorecard date.</p>
    </div>`;
  }
  bind.pipeline = () => {
    bindOwnerTabs();
    $("#p-filter").onchange = (e) => { pipeFilter = e.target.value; render(); };
    $("#p-add").onclick = () => {
      const name = $("#p-name").value.trim(); if (!name) return toast("Enter a project name");
      S.projects.push({ id: uid(), owner: $("#p-owner").value, name, customer: $("#p-cust").value.trim(), segment: $("#p-seg").value,
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
        ["sales", "Sales", `Booked ${cr(m.booked)} vs pro-rata ${cr(m.proRata)} (${pct(m.bookPct)}). Need ${cr(m.runRate)} per working day.`, m.st.book, "Pull forward late-stage deals"],
        ["orders", "Orders", `${moves} stage move(s) this week; ${m.stuck.length} stuck ${S.settings.stuckDays}+ days${m.stuck.length ? ": " + m.stuck.map((p) => esc(p.name)).join(", ") : ""}`, m.stuck.length ? (m.stuck.length > 1 ? "r" : "a") : "g", "Demos and factory visits"],
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
    <div class="card"><h2>Evidence summary · FY${String(Q.fy).slice(2)}-${String(Q.fy + 1).slice(2)}</h2>
      <p class="small muted">20% of the annual increment: Work Ethic Principles 10% · LT Values 5% · LT Ethos 5%. Raise gaps the same week, with one example and one expected change.</p>
      <div class="table-wrap"><table><thead><tr><th>Owner</th>${PRINCIPLES.map((p) => `<th class="num">${p}</th>`).join("")}</tr></thead><tbody>
      ${S.owners.map((o) => `<tr><td>${esc(o.name)}</td>${PRINCIPLES.map((p) => { const xs = S.ethics.filter((x) => x.owner === o.id && x.principle === p && x.date >= `${Q.fy}-04-01`);
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
    return `<div class="card"><h2>Team and targets (Rs Cr) · FY${String(Q.fy).slice(2)}-${String(Q.fy + 1).slice(2)}</h2>
      <p class="small muted">Quarters follow the financial year (Q1 Apr–Jun … Q4 Jan–Mar). Quarterly targets default to a quarter of the annual figure – replace them with the Q-wise targets once mailed. "Booked before tracker" is the order value booked in each quarter before ${fmtD(s.trackerStart)}; any shortfall rolls into the next quarter.</p>
      <div class="table-wrap"><table><thead><tr><th>Name</th><th class="num">Annual</th><th class="num">Q1</th><th class="num">Q2</th><th class="num">Q3</th><th class="num">Q4</th><th class="num">Booked before tracker Q1</th><th class="num">Q2</th><th class="num">Q3</th><th class="num">Q4</th><th class="num">Avg order (lakh)</th></tr></thead><tbody>
      ${S.owners.map((o) => `<tr><td><input data-on="${o.id}" value="${esc(o.name)}" /></td><td class="num"><input type="number" step="0.01" data-oa="${o.id}" value="${num(o.annual)}" style="width:5rem"/></td>
        ${[0, 1, 2, 3].map((i) => `<td class="num"><input type="number" step="0.01" data-oq="${o.id}|${i}" value="${num(o.q[i])}" style="width:5rem"/></td>`).join("")}
        ${[0, 1, 2, 3].map((i) => `<td class="num"><input type="number" step="0.01" data-oo="${o.id}|${i}" value="${num(o.opening[i])}" style="width:5rem"/></td>`).join("")}
        <td class="num"><input type="number" step="1" data-oaov="${o.id}" value="${num(o.aovLakh)}" style="width:4.5rem"/></td></tr>`).join("")}
      </tbody></table></div>
      <p class="small" id="q-check"></p>
      <button id="split-btn" type="button" class="secondary">Split each annual target equally into quarters</button></div>

    <div class="card"><h2>This device</h2><div class="form">
      <label>This phone/computer belongs to<select id="st-dev">${ownerOpts(s.deviceOwner)}</select></label>
      <label>Tracker start date<input id="st-start" type="date" value="${s.trackerStart}" /></label>
      <label>Joint visits per member per week<input id="st-joint" type="number" min="0" value="${s.jointPerWeek}" /></label>
      <label>Deal "stuck" after (days in one stage)<input id="st-stuck" type="number" min="1" value="${s.stuckDays}" /></label></div>
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
      <label>Submission slips/week still Amber<input type="number" data-b="subsA" value="${B.subsA}" /></label></div></div>

    <div class="card no-print"><h2>Backup</h2>
      <p class="small muted">Data is stored only in this browser. Export a backup regularly (and before clearing browser data).</p>
      <div class="row"><button id="bk-exp" type="button">Export backup (JSON)</button>
      <label class="button secondary" for="bk-imp">Import backup</label><input id="bk-imp" type="file" accept=".json,application/json" hidden />
      <button id="csv-exp" type="button" class="secondary">Export daily log (CSV)</button>
      <button id="bk-reset" type="button" class="danger">Erase all data</button></div></div>`;
  }
  bind.settings = () => {
    const s = S.settings;
    const qcheck = () => { $("#q-check").innerHTML = S.owners.map((o) => { const t = o.q.reduce((a, b) => a + num(b), 0);
      return Math.abs(t - num(o.annual)) > 0.01 ? `<span class="chip a">Check</span> ${esc(o.name)}: quarters add up to ${cr(t)}, annual is ${cr(num(o.annual))}` : ""; }).filter(Boolean).join("<br>"); };
    qcheck();
    const O = (id) => owner(id);
    $$("[data-on]").forEach((i) => i.onchange = () => { O(i.dataset.on).name = i.value.trim() || O(i.dataset.on).name; save(); });
    $$("[data-oa]").forEach((i) => i.onchange = () => { O(i.dataset.oa).annual = num(i.value); save(); qcheck(); });
    $$("[data-oq]").forEach((i) => i.onchange = () => { const [o, q] = i.dataset.oq.split("|"); O(o).q[q] = num(i.value); save(); qcheck(); });
    $$("[data-oo]").forEach((i) => i.onchange = () => { const [o, q] = i.dataset.oo.split("|"); O(o).opening[q] = num(i.value); save(); });
    $$("[data-oaov]").forEach((i) => i.onchange = () => { O(i.dataset.oaov).aovLakh = num(i.value) || 25; save(); });
    $("#split-btn").onclick = () => { for (const o of S.owners) o.q = [0, 1, 2, 3].map(() => Math.round(num(o.annual) / 4 * 100) / 100); save(); render(); };
    $("#st-dev").onchange = (e) => { s.deviceOwner = e.target.value; selOwner = s.deviceOwner; save(); };
    $("#st-start").onchange = (e) => { if (e.target.value) { s.trackerStart = e.target.value; save(); } };
    $("#st-joint").onchange = (e) => { s.jointPerWeek = num(e.target.value); save(); };
    $("#st-stuck").onchange = (e) => { s.stuckDays = num(e.target.value) || 14; save(); };
    $$("[data-wd]").forEach((c) => c.onchange = () => { s.workDays = $$("[data-wd]").filter((x) => x.checked).map((x) => +x.dataset.wd); save(); });
    $("#st-hol").onchange = (e) => { s.holidays = e.target.value.split(/[\s,]+/).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)); save(); };
    $$("[data-b]").forEach((i) => i.onchange = () => { s.bands[i.dataset.b] = num(i.value); save(); });
    $("#bk-exp").onclick = () => download(`po-tracker-backup-${todayStr()}.json`, JSON.stringify(S, null, 1), "application/json");
    $("#bk-imp").onchange = async (e) => { const f = e.target.files[0]; if (!f) return;
      try { const d = JSON.parse(await f.text()); if (d.version !== 1 || !Array.isArray(d.owners)) throw 0;
        if (!confirm("Replace all data on this device with the backup?")) return; localStorage.setItem(KEY, JSON.stringify(d)); S = load(); toast("Backup restored"); render();
      } catch { toast("Not a PO Tracker backup"); } };
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
  $("#as-of").onchange = (e) => { if (e.target.value) { D = e.target.value; render(); } };
  window.addEventListener("hashchange", render);
  render();

  let deferred;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; $("#install-btn").hidden = false; });
  $("#install-btn").onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $("#install-btn").hidden = true; };
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js");
})();
