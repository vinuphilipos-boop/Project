/* Technical Submission Builder
 * Everything runs in the browser. Documents and projects are kept in IndexedDB;
 * the final PDF is assembled with pdf-lib (vendor/pdf-lib.min.js).
 */
"use strict";

const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

/* ------------------------------------------------------------------ */
/* Submission structure                                                */
/* ------------------------------------------------------------------ */
// "{CO}" is replaced with the company short name from settings.
const SECTIONS = [
  { key: "cover", no: "1", title: "Cover Page", generated: true },
  { key: "profile", no: "2", title: "{CO} Company Profile" },
  { key: "design", no: "3", title: "Lighting Design" },
  {
    key: "tds", no: "4", title: "Technical Data Sheets",
    children: [
      { key: "tds_led", no: "4.1", title: "TDS - LED Light Fittings", suggestFrom: "luminaires" },
      { key: "tds_poles", no: "4.2", title: "TDS - Poles", suggestFrom: "poles" },
      { key: "tds_cables", no: "4.3", title: "TDS - Cables" },
      { key: "tds_hdpe", no: "4.4", title: "TDS - HDPE Pipes" },
      { key: "ga_fp", no: "4.5", title: "GA Drawing - Feeder Pillar" },
      { key: "bought_out", no: "4.6", title: "Bought Out Items" },
    ],
  },
  { key: "approvals", no: "5", title: "{CO} Source Approvals" },
  { key: "credentials", no: "6", title: "{CO} Road Lighting Credentials" },
];
const LEAVES = SECTIONS.flatMap((s) => s.children || [s]);
const LIBRARY_SECTIONS = LEAVES.filter((s) => !s.generated); // the cover is generated or uploaded per project

const DEFAULT_SETTINGS = {
  key: "company",
  shortName: "LT",
  fullName: "LIGHTING TECHNOLOGIES INDIA PVT LTD",
  address: "Address line / phone / email",
  title: "TECHNICAL SUBMISSION FOR APPROVAL",
  preparedBy: "",
  coverStyle: "project", // "project" = your Word cover layout, "simple" = details table + approval box
  logo: null, // { data: ArrayBuffer, mime }
};

const DEFAULT_OPTIONS = { optIndex: true, optSchedule: true, optDividers: true, optSubDividers: false, optFooter: true };

/* ------------------------------------------------------------------ */
/* IndexedDB                                                           */
/* ------------------------------------------------------------------ */
const DB = (() => {
  let dbp;
  function open() {
    if (!dbp) {
      dbp = new Promise((resolve, reject) => {
        const req = indexedDB.open("tech-submission", 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          db.createObjectStore("docs", { keyPath: "id" }); // metadata only
          db.createObjectStore("files", { keyPath: "id" }); // { id, data: ArrayBuffer }
          db.createObjectStore("projects", { keyPath: "id" });
          db.createObjectStore("settings", { keyPath: "key" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbp;
  }
  async function run(stores, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(stores, mode);
      const out = fn(t);
      t.oncomplete = () => resolve(out && "result" in out ? out.result : out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }
  return {
    get: (s, k) => run(s, "readonly", (t) => t.objectStore(s).get(k)),
    all: (s) => run(s, "readonly", (t) => t.objectStore(s).getAll()),
    put: (s, v) => run(s, "readwrite", (t) => t.objectStore(s).put(v)),
    del: (s, k) => run(s, "readwrite", (t) => t.objectStore(s).delete(k)),
    clear: (s) => run(s, "readwrite", (t) => t.objectStore(s).clear()),
    putDoc: (meta, data) =>
      run(["docs", "files"], "readwrite", (t) => {
        t.objectStore("docs").put(meta);
        t.objectStore("files").put({ id: meta.id, data });
      }),
    delDoc: (id) =>
      run(["docs", "files"], "readwrite", (t) => {
        t.objectStore("docs").delete(id);
        t.objectStore("files").delete(id);
      }),
  };
})();

/* ------------------------------------------------------------------ */
/* State + helpers                                                     */
/* ------------------------------------------------------------------ */
const state = { settings: { ...DEFAULT_SETTINGS }, docs: [], projects: [], current: null };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const co = (t) => t.replaceAll("{CO}", state.settings.shortName || "").trim();
const sectionTitle = (s) => co(s.title);
const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const catLabel = (key) => {
  const s = LEAVES.find((l) => l.key === key);
  return s ? `${s.no} ${sectionTitle(s)}` : "Other";
};
const docById = (id) => state.docs.find((d) => d.id === id);

function toast(msg, isError = false) {
  const el = $("#toast");
  el.textContent = msg;
  el.className = "toast" + (isError ? " error" : "");
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (el.hidden = true), isError ? 6000 : 3000);
}
function busy(on, text = "Working…") {
  $("#busy").hidden = !on;
  $("#busy-text").textContent = text;
}

async function fileToDoc(file, scope, category, tags = [], notes = "") {
  const data = await file.arrayBuffer();
  const mime = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "");
  if (!["application/pdf", "image/png", "image/jpeg"].includes(mime)) {
    throw new Error(`${file.name}: only PDF, PNG and JPG files are supported. Save other formats as PDF first.`);
  }
  let pages = 1;
  if (mime === "application/pdf") {
    try {
      const pdf = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
      pages = pdf.getPageCount();
    } catch (e) {
      throw new Error(`${file.name}: could not be read as a PDF (${e.message}).`);
    }
  }
  const meta = {
    id: uid(),
    name: file.name.replace(/\.(pdf|png|jpe?g)$/i, ""),
    fileName: file.name,
    mime,
    size: file.size,
    pages,
    category,
    tags,
    notes,
    scope, // "library" or a project id
    uploadedAt: new Date().toISOString(),
  };
  await DB.putDoc(meta, data);
  state.docs.push(meta);
  return meta;
}

const parseTags = (s) => String(s || "").split(",").map((t) => t.trim()).filter(Boolean);

async function openDoc(id) {
  const meta = docById(id);
  const f = await DB.get("files", id);
  if (!f) return toast("File not found", true);
  const url = URL.createObjectURL(new Blob([f.data], { type: meta.mime }));
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */
function show(view) {
  $$(".view").forEach((v) => (v.hidden = v.id !== "view-" + view));
  const tabView = view === "editor" ? "projects" : view;
  $$(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.view === tabView)));
  if (view === "projects") renderProjects();
  if (view === "library") renderLibrary();
  if (view === "settings") renderSettings();
  window.scrollTo(0, 0);
}
$$(".tab").forEach((t) =>
  t.addEventListener("click", async () => {
    if (state.current) await saveProject();
    state.current = null;
    show(t.dataset.view);
  })
);

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */
function renderSettings() {
  const f = $("#settings-form");
  for (const k of ["shortName", "fullName", "address", "title", "preparedBy", "coverStyle"]) f.elements[k].value = state.settings[k] || "";
  f.elements.logo.value = "";
  const prev = $("#logo-preview");
  prev.innerHTML = "";
  if (state.settings.logo) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(new Blob([state.settings.logo.data], { type: state.settings.logo.mime }));
    prev.append(img);
  }
}
$("#settings-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  for (const k of ["shortName", "fullName", "address", "title", "preparedBy", "coverStyle"]) state.settings[k] = f.elements[k].value.trim();
  const logo = f.elements.logo.files[0];
  if (logo) state.settings.logo = { data: await logo.arrayBuffer(), mime: logo.type };
  await DB.put("settings", state.settings);
  renderSettings();
  fillCategorySelects();
  toast("Settings saved");
});

/* ------------------------------------------------------------------ */
/* Library                                                             */
/* ------------------------------------------------------------------ */
function fillCategorySelects() {
  const opts = LIBRARY_SECTIONS.map((s) => `<option value="${s.key}">${esc(s.no + " " + sectionTitle(s))}</option>`).join("");
  $("#lib-upload").elements.category.innerHTML = opts;
  const filter = $("#lib-filter-cat");
  const v = filter.value;
  filter.innerHTML = `<option value="">All sections</option>` + opts;
  filter.value = v;
}

function usageCount(docId) {
  return state.projects.filter((p) => Object.values(p.sections || {}).some((ids) => ids.includes(docId))).length;
}

function renderLibrary() {
  const cat = $("#lib-filter-cat").value;
  const q = $("#lib-filter-text").value.trim().toLowerCase();
  const docs = state.docs
    .filter((d) => d.scope === "library")
    .filter((d) => !cat || d.category === cat)
    .filter((d) => !q || (d.name + " " + d.tags.join(" ")).toLowerCase().includes(q))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const list = $("#lib-list");
  if (!docs.length) {
    list.innerHTML = `<div class="empty">No documents yet. Upload your standard documents above (company profile, data sheets, approvals, credentials…).</div>`;
    return;
  }
  const catOpts = (sel) => LIBRARY_SECTIONS.map((s) => `<option value="${s.key}" ${s.key === sel ? "selected" : ""}>${esc(s.no + " " + sectionTitle(s))}</option>`).join("");
  list.innerHTML = `<table class="lib-table"><thead><tr><th>Name</th><th>Section</th><th>Tags</th><th>Pages</th><th>Used in</th><th></th></tr></thead><tbody>${docs
    .map(
      (d) => `<tr data-id="${d.id}">
        <td><input data-field="name" value="${esc(d.name)}" /></td>
        <td><select data-field="category">${catOpts(d.category)}</select></td>
        <td><input data-field="tags" value="${esc(d.tags.join(", "))}" /></td>
        <td>${d.pages}</td>
        <td>${usageCount(d.id)} project(s)</td>
        <td class="actions"><button type="button" class="icon" data-act="view" title="Open">View</button>
        <label class="button-like icon" title="Replace with a newer revision of the file">Replace<input type="file" data-act="replace" accept="application/pdf,image/png,image/jpeg" hidden /></label>
        <button type="button" class="icon danger" data-act="delete" title="Delete">Delete</button></td></tr>`
    )
    .join("")}</tbody></table>`;
}

$("#lib-filter-cat").addEventListener("change", renderLibrary);
$("#lib-filter-text").addEventListener("input", renderLibrary);

$("#lib-list").addEventListener("change", async (e) => {
  const tr = e.target.closest("tr[data-id]");
  if (!tr) return;
  const d = docById(tr.dataset.id);
  if (e.target.dataset.act === "replace") {
    const file = e.target.files[0];
    if (!file) return;
    try {
      busy(true, "Replacing…");
      const fresh = await fileToDoc(file, "library", d.category);
      // keep the old id so every project that uses it gets the new revision
      state.docs = state.docs.filter((x) => x.id !== fresh.id);
      await DB.delDoc(fresh.id);
      Object.assign(d, { fileName: fresh.fileName, mime: fresh.mime, size: fresh.size, pages: fresh.pages, uploadedAt: fresh.uploadedAt });
      await DB.putDoc(d, await file.arrayBuffer());
      toast("File replaced. All projects using it now get the new version.");
    } catch (err) {
      toast(err.message, true);
    } finally {
      busy(false);
      renderLibrary();
    }
    return;
  }
  const field = e.target.dataset.field;
  if (!field) return;
  d[field] = field === "tags" ? parseTags(e.target.value) : e.target.value.trim() || d[field];
  await DB.put("docs", d);
  toast("Saved");
});

$("#lib-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.closest("tr").dataset.id;
  if (btn.dataset.act === "view") return openDoc(id);
  if (btn.dataset.act === "delete") {
    const n = usageCount(id);
    if (!confirm(`Delete "${docById(id).name}"?` + (n ? `\nIt is used in ${n} project(s) and will be removed from them.` : ""))) return;
    await deleteDoc(id);
    renderLibrary();
  }
});

async function deleteDoc(id) {
  await DB.delDoc(id);
  state.docs = state.docs.filter((d) => d.id !== id);
  for (const p of state.projects) {
    let changed = false;
    for (const k of Object.keys(p.sections || {})) {
      const before = p.sections[k].length;
      p.sections[k] = p.sections[k].filter((x) => x !== id);
      changed ||= before !== p.sections[k].length;
    }
    if (changed) await DB.put("projects", p);
  }
}

$("#lib-upload").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  const files = [...f.elements.files.files];
  const errors = [];
  busy(true, "Uploading…");
  for (const file of files) {
    try {
      await fileToDoc(file, "library", f.elements.category.value, parseTags(f.elements.tags.value), f.elements.notes.value.trim());
    } catch (err) {
      errors.push(err.message);
    }
  }
  busy(false);
  f.elements.files.value = "";
  $("#lib-filter-cat").value = "";
  renderLibrary();
  if (errors.length) toast(errors.join("\n"), true);
  else toast(`${files.length} document(s) added to the library`);
});

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */
const DEFAULT_PARTIES = ["CONCESSIONAIRE", "CLIENT", "INDEPENDENT ENGINEER"];
const MAX_PARTIES = 4;

// Older projects had separate client / consultant / contractor fields.
function migrateProject(p) {
  if (!p.parties) {
    p.parties = [
      { role: "CONCESSIONAIRE", name: p.contractor || "", logo: null },
      { role: "CLIENT", name: p.client || "", logo: null },
      { role: "INDEPENDENT ENGINEER", name: p.consultant || "", logo: null },
    ];
  }
  p.coverTitle ??= p.name || "";
  p.coverSubtitle ??= "LED STREETLIGHTING PROPOSAL";
  return p;
}
const clientName = (p) => (p.parties || []).find((x) => /client/i.test(x.role))?.name || p.client || "";

function newProject() {
  return {
    id: uid(),
    name: "New project",
    location: "",
    coverTitle: "",
    coverSubtitle: "LED STREETLIGHTING PROPOSAL",
    parties: DEFAULT_PARTIES.map((role) => ({ role, name: "", logo: null })),
    refNo: "", submissionNo: "01", revision: "R0", date: today(),
    luminaires: [{ desc: "Street light", make: "", model: "", wattage: "", qty: "" }],
    poles: [{ type: "Octagonal GI pole", height: "", dims: "", bracket: "", qty: "" }],
    sections: Object.fromEntries(LEAVES.map((s) => [s.key, []])),
    options: { ...DEFAULT_OPTIONS },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function renderProjects() {
  const list = $("#project-list");
  const projects = [...state.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (!projects.length) {
    list.innerHTML = `<div class="empty">No projects yet. Click <b>+ New project</b> to start. Upload your standard documents in the <b>Document library</b> tab first.</div>`;
    return;
  }
  list.innerHTML = projects
    .map((p) => {
      const nDocs = Object.values(p.sections).reduce((n, ids) => n + ids.length, 0);
      const watts = p.luminaires.map((l) => l.wattage).filter(Boolean).map((w) => w + "W").join(", ");
      return `<div class="card" data-id="${p.id}">
        <h3>${esc(p.name)}</h3>
        <div class="meta">${esc(clientName(p) || "No client")} · ${esc(p.refNo || "no ref")} · Sub. ${esc(p.submissionNo)} ${esc(p.revision)}</div>
        <div class="meta">${nDocs} document(s)${watts ? " · " + esc(watts) : ""} · updated ${p.updatedAt.slice(0, 10)}</div>
        <div class="actions">
          <button type="button" class="primary" data-act="open">Open</button>
          <button type="button" data-act="dup">Duplicate</button>
          <button type="button" class="danger" data-act="delete">Delete</button>
        </div></div>`;
    })
    .join("");
}

$("#new-project").addEventListener("click", async () => {
  const p = newProject();
  state.projects.push(p);
  await DB.put("projects", p);
  openProject(p.id);
});

$("#project-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const p = state.projects.find((x) => x.id === btn.closest(".card").dataset.id);
  if (btn.dataset.act === "open") return openProject(p.id);
  if (btn.dataset.act === "dup") {
    const copy = structuredClone(p);
    Object.assign(copy, { id: uid(), name: p.name + " (copy)", date: today(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    // project-specific uploads are copied too, so the two projects stay independent
    for (const k of Object.keys(copy.sections)) {
      copy.sections[k] = await Promise.all(
        copy.sections[k].map(async (id) => {
          const d = docById(id);
          if (!d || d.scope === "library") return id;
          const f = await DB.get("files", id);
          const nd = { ...d, id: uid(), scope: copy.id };
          await DB.putDoc(nd, f.data);
          state.docs.push(nd);
          return nd.id;
        })
      );
    }
    state.projects.push(copy);
    await DB.put("projects", copy);
    toast("Project duplicated");
    return renderProjects();
  }
  if (btn.dataset.act === "delete") {
    if (!confirm(`Delete project "${p.name}"? Library documents are kept; files uploaded only for this project are deleted.`)) return;
    for (const d of state.docs.filter((d) => d.scope === p.id)) await DB.delDoc(d.id);
    state.docs = state.docs.filter((d) => d.scope !== p.id);
    state.projects = state.projects.filter((x) => x.id !== p.id);
    await DB.del("projects", p.id);
    renderProjects();
  }
});

$("#back-to-projects").addEventListener("click", async () => {
  await saveProject();
  state.current = null;
  show("projects");
});

function openProject(id) {
  state.current = state.projects.find((p) => p.id === id);
  const p = migrateProject(state.current);
  p.options = { ...DEFAULT_OPTIONS, ...(p.options || {}) };
  for (const s of LEAVES) p.sections[s.key] ||= [];
  for (const f of [$("#project-form"), $("#cover-form")]) for (const el of f.elements) if (el.name) el.value = p[el.name] ?? "";
  for (const k of Object.keys(DEFAULT_OPTIONS)) $(`input[name="${k}"]`).checked = !!p.options[k];
  $("#editor-title").textContent = p.name;
  renderRows();
  renderParties();
  renderSections();
  show("editor");
  refreshCoverPreview(0);
}

let saveTimer;
function scheduleSave() {
  $("#save-state").textContent = "Saving…";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveProject, 400);
}
async function saveProject() {
  clearTimeout(saveTimer);
  const p = state.current;
  if (!p) return;
  p.updatedAt = new Date().toISOString();
  await DB.put("projects", p);
  $("#save-state").textContent = "Saved";
}

for (const form of ["#project-form", "#cover-form"]) {
  $(form).addEventListener("input", (e) => {
    const p = state.current;
    p[e.target.name] = e.target.value;
    if (e.target.name === "name") $("#editor-title").textContent = p.name || "Project";
    scheduleSave();
    refreshCoverPreview();
  });
}

/* ---- parties on the cover ---- */
function renderParties() {
  const p = state.current;
  $("#party-list").innerHTML = p.parties
    .map(
      (x, i) => `<div class="party" data-i="${i}">
        <input data-f="role" list="party-roles" value="${esc(x.role)}" placeholder="Role, e.g. CLIENT" />
        <input data-f="name" list="party-names" value="${esc(x.name)}" placeholder="Name, e.g. NATIONAL HIGHWAYS AUTHORITY OF INDIA" />
        <div class="party-logo">${x.logo ? `<img src="${x.logo}" alt="" />` : "No logo"}</div>
        <div class="party-actions">
          <label class="button-like small">Logo<input type="file" data-act="logo" accept="image/png,image/jpeg" hidden /></label>
          ${x.logo ? `<button type="button" class="icon" data-act="nologo" title="Remove logo">No logo</button>` : ""}
          <button type="button" class="icon" data-act="left" ${i === 0 ? "disabled" : ""} title="Move left">↑</button>
          <button type="button" class="icon danger" data-act="del" title="Remove party">✕</button>
        </div></div>`
    )
    .join("");
  $("#add-party").disabled = p.parties.length >= MAX_PARTIES;
  $("#party-names").innerHTML = [...knownParties().keys()].map((n) => `<option value="${esc(n)}"></option>`).join("");
}

// Every party name used in any project, with the most recent logo for it.
function knownParties() {
  const map = new Map();
  const projects = [...state.projects].sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
  for (const pr of projects)
    for (const x of pr.parties || []) {
      const name = x.name.trim();
      if (!name) continue;
      const key = [...map.keys()].find((k) => k.toLowerCase() === name.toLowerCase()) || name;
      if (x.logo || !map.has(key)) map.set(key, x.logo || map.get(key) || null);
    }
  return map;
}

$("#party-list").addEventListener("input", (e) => {
  const row = e.target.closest(".party");
  if (!row || !e.target.dataset.f) return;
  state.current.parties[row.dataset.i][e.target.dataset.f] = e.target.value;
  scheduleSave();
  refreshCoverPreview();
});
$("#party-list").addEventListener("change", async (e) => {
  const row = e.target.closest(".party");
  if (!row) return;
  const party = state.current.parties[row.dataset.i];
  if (e.target.dataset.f === "name" && !party.logo) {
    // reuse the logo from an earlier project with the same party name
    const hit = [...knownParties()].find(([n, logo]) => logo && n.toLowerCase() === party.name.trim().toLowerCase());
    if (hit) {
      party.logo = hit[1];
      renderParties();
      toast("Logo filled in from an earlier project");
    }
  }
  if (e.target.dataset.act === "logo" && e.target.files[0]) {
    try {
      party.logo = await imageToDataUrl(e.target.files[0]);
    } catch (err) {
      return toast(err.message, true);
    }
    renderParties();
  }
  await saveProject();
  refreshCoverPreview(0);
});
$("#party-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const list = state.current.parties;
  const i = +btn.closest(".party").dataset.i;
  if (btn.dataset.act === "nologo") list[i].logo = null;
  if (btn.dataset.act === "left") [list[i - 1], list[i]] = [list[i], list[i - 1]];
  if (btn.dataset.act === "del") list.splice(i, 1);
  renderParties();
  await saveProject();
  refreshCoverPreview(0);
});
$("#add-party").addEventListener("click", () => {
  state.current.parties.push({ role: "", name: "", logo: null });
  renderParties();
  scheduleSave();
});

// Logos are shrunk and stored as PNG data URLs inside the project, so duplicates and backups carry them.
function imageToDataUrl(file, max = 600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error(file.name + " is not a readable image"));
    img.src = url;
  });
}

/* ---- live cover preview ---- */
let previewTimer, previewUrl;
function refreshCoverPreview(delay = 700) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    const p = state.current;
    if (!p) return;
    try {
      const pdf = await PDFDocument.create();
      const F = await loadFonts(pdf);
      await drawCover(pdf, F, await embedLogo(pdf), p);
      const bytes = await pdf.save();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      $("#cover-preview").src = previewUrl + "#toolbar=0&navpanes=0&view=Fit";
    } catch (err) {
      console.error(err);
    }
  }, delay);
}
$("#open-cover").addEventListener("click", () => previewUrl && window.open(previewUrl, "_blank"));
$$(".options input").forEach((cb) =>
  cb.addEventListener("change", () => {
    state.current.options[cb.name] = cb.checked;
    scheduleSave();
  })
);

/* ---- luminaire / pole schedules ---- */
const ROW_FIELDS = {
  luminaires: ["desc", "make", "model", "wattage", "qty"],
  poles: ["type", "height", "dims", "bracket", "qty"],
};
function renderRows() {
  for (const [kind, table] of [["luminaires", "#lum-table"], ["poles", "#pole-table"]]) {
    $(table + " tbody").innerHTML = state.current[kind]
      .map(
        (row, i) =>
          `<tr data-kind="${kind}" data-i="${i}">${ROW_FIELDS[kind]
            .map((f) => `<td><input data-f="${f}" value="${esc(row[f])}" ${f === "qty" || f === "wattage" || f === "height" ? 'inputmode="decimal"' : ""} /></td>`)
            .join("")}<td><button type="button" class="icon danger" data-del-row title="Remove">✕</button></td></tr>`
      )
      .join("");
  }
}
$$(".edit-table").forEach((t) => {
  t.addEventListener("input", (e) => {
    const tr = e.target.closest("tr");
    state.current[tr.dataset.kind][tr.dataset.i][e.target.dataset.f] = e.target.value;
    scheduleSave();
  });
  t.addEventListener("change", () => renderSections()); // refresh suggestions
  t.addEventListener("click", (e) => {
    if (!e.target.matches("[data-del-row]")) return;
    const tr = e.target.closest("tr");
    state.current[tr.dataset.kind].splice(+tr.dataset.i, 1);
    renderRows();
    renderSections();
    scheduleSave();
  });
});
$$("[data-add-row]").forEach((b) =>
  b.addEventListener("click", () => {
    const kind = b.dataset.addRow;
    state.current[kind].push(Object.fromEntries(ROW_FIELDS[kind].map((f) => [f, ""])));
    renderRows();
    scheduleSave();
  })
);

/* ---- sections ---- */
// Library docs whose name/tags mention a model or wattage from the schedule
function suggestions(section) {
  if (!section.suggestFrom) return [];
  const p = state.current;
  const needles = new Set();
  for (const r of p[section.suggestFrom]) {
    if (r.model) needles.add(r.model.toLowerCase());
    if (r.wattage) needles.add(String(r.wattage).toLowerCase().replace(/\s*w$/, "") + "w");
    if (r.height) needles.add(String(r.height).toLowerCase().replace(/\s*m$/, "") + "m");
  }
  if (!needles.size) return [];
  const used = new Set(p.sections[section.key]);
  return state.docs.filter((d) => {
    if (d.scope !== "library" || d.category !== section.key || used.has(d.id)) return false;
    const hay = (d.name + " " + d.tags.join(" ")).toLowerCase().replace(/\s+(w|m)\b/g, "$1");
    return [...needles].some((n) => hay.includes(n));
  });
}

function docRowHtml(d, i, n) {
  const badge = d.scope === "library" ? "" : `<span class="badge proj" title="Uploaded for this project only">project file</span>`;
  return `<div class="doc-row" data-id="${d.id}">
    <span class="name">${esc(d.name)} ${badge}</span>
    <span class="pages">${d.pages} p.</span>
    <button type="button" class="icon" data-act="up" ${i === 0 ? "disabled" : ""} title="Move up">↑</button>
    <button type="button" class="icon" data-act="down" ${i === n - 1 ? "disabled" : ""} title="Move down">↓</button>
    <button type="button" class="icon" data-act="view">View</button>
    ${d.scope !== "library" ? `<button type="button" class="icon" data-act="promote" title="Copy this file into the standard library">To library</button>` : ""}
    <button type="button" class="icon danger" data-act="remove" title="Remove from this project">✕</button>
  </div>`;
}

function sectionHtml(s, isSub) {
  const p = state.current;
  const ids = p.sections[s.key].filter((id) => docById(id));
  const pages = ids.reduce((n, id) => n + docById(id).pages, 0);
  const sugg = suggestions(s);
  const isCover = s.key === "cover";
  const coverNote = isCover
    ? ids.length
      ? `<span class="badge">uploaded cover replaces the generated one</span>`
      : `<span class="badge gen">auto-generated from project details</span>`
    : "";
  return `<div class="section ${isSub ? "sub" : ""}" data-key="${s.key}">
    <div class="section-head">
      <span class="no">${s.no}</span><span class="title">${esc(sectionTitle(s))}</span>
      ${coverNote}
      ${!isCover ? `<span class="badge">${ids.length} doc(s), ${pages} page(s)</span>` : ""}
      ${sugg.length ? `<span class="badge sugg" title="${esc(sugg.map((d) => d.name).join(", "))}">${sugg.length} matching in library</span>` : ""}
      ${!isCover ? `<button type="button" class="small" data-act="pick">Select from library</button>` : ""}
      <label class="button-like small">Upload ${isCover ? "custom cover" : "for this project"}<input type="file" data-act="upload" accept="application/pdf,image/png,image/jpeg" multiple hidden /></label>
    </div>
    <div class="section-body">${
      ids.length ? ids.map((id, i) => docRowHtml(docById(id), i, ids.length)).join("") : isCover ? "" : `<div class="section-empty">Nothing selected — this section will be left out.</div>`
    }</div></div>`;
}

function renderSections() {
  if (!state.current) return;
  $("#section-list").innerHTML = SECTIONS.map((s) =>
    s.children
      ? `<div class="section"><div class="section-head parent"><span class="no">${s.no}</span><span class="title">${esc(sectionTitle(s))}</span></div></div>` +
        s.children.map((c) => sectionHtml(c, true)).join("")
      : sectionHtml(s, false)
  ).join("");
}

$("#section-list").addEventListener("change", async (e) => {
  if (e.target.dataset.act !== "upload") return;
  const key = e.target.closest(".section").dataset.key;
  const errors = [];
  busy(true, "Uploading…");
  for (const file of e.target.files) {
    try {
      const d = await fileToDoc(file, state.current.id, key);
      state.current.sections[key].push(d.id);
    } catch (err) {
      errors.push(err.message);
    }
  }
  busy(false);
  await saveProject();
  renderSections();
  if (errors.length) toast(errors.join("\n"), true);
});

$("#section-list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const key = btn.closest(".section").dataset.key;
  const list = state.current.sections[key];
  const id = btn.closest(".doc-row")?.dataset.id;
  const i = list.indexOf(id);
  switch (btn.dataset.act) {
    case "pick":
      return openPicker(key);
    case "view":
      return openDoc(id);
    case "up":
      [list[i - 1], list[i]] = [list[i], list[i - 1]];
      break;
    case "down":
      [list[i + 1], list[i]] = [list[i], list[i + 1]];
      break;
    case "remove": {
      list.splice(i, 1);
      const d = docById(id);
      if (d && d.scope !== "library") await deleteDoc(id); // project-only file, nothing else uses it
      break;
    }
    case "promote": {
      const d = docById(id);
      const f = await DB.get("files", id);
      const copy = { ...d, id: uid(), scope: "library", uploadedAt: new Date().toISOString() };
      await DB.putDoc(copy, f.data);
      state.docs.push(copy);
      toast(`"${d.name}" copied to the library`);
      return;
    }
  }
  await saveProject();
  renderSections();
});

/* ---- library picker dialog ---- */
let pickerKey = null;
function renderPicker() {
  const allCats = $("#picker-all-cats").checked;
  const q = $("#picker-search").value.trim().toLowerCase();
  const used = new Set(state.current.sections[pickerKey]);
  const section = LEAVES.find((s) => s.key === pickerKey);
  const sugg = new Set(suggestions(section).map((d) => d.id));
  const docs = state.docs
    .filter((d) => d.scope === "library" && (allCats || d.category === pickerKey))
    .filter((d) => !q || (d.name + " " + d.tags.join(" ")).toLowerCase().includes(q))
    .sort((a, b) => sugg.has(b.id) - sugg.has(a.id) || a.name.localeCompare(b.name));
  $("#picker-list").innerHTML = docs.length
    ? docs
        .map(
          (d) => `<label class="${used.has(d.id) ? "used" : ""}">
          <input type="checkbox" value="${d.id}" ${used.has(d.id) ? "disabled checked" : ""} />
          <span style="flex:1">${esc(d.name)} ${d.tags.length ? `<span class="muted">· ${esc(d.tags.join(", "))}</span>` : ""}
          ${allCats ? `<br><span class="muted">${esc(catLabel(d.category))}</span>` : ""}</span>
          ${sugg.has(d.id) ? `<span class="badge sugg">matches schedule</span>` : ""}
          <span class="muted">${d.pages} p.</span></label>`
        )
        .join("")
    : `<div class="section-empty">No library documents ${allCats ? "" : "in this section "}yet. Add them in the Document library tab, or tick "Show all sections".</div>`;
}
function openPicker(key) {
  pickerKey = key;
  $("#picker-title").textContent = "Select documents for " + catLabel(key);
  $("#picker-all-cats").checked = false;
  $("#picker-search").value = "";
  renderPicker();
  $("#picker").showModal();
}
$("#picker-all-cats").addEventListener("change", renderPicker);
$("#picker-search").addEventListener("input", renderPicker);
$("#picker").addEventListener("close", async () => {
  if ($("#picker").returnValue !== "ok") return;
  const chosen = $$("#picker-list input:checked:not(:disabled)").map((c) => c.value);
  state.current.sections[pickerKey].push(...chosen);
  await saveProject();
  renderSections();
});

/* ------------------------------------------------------------------ */
/* PDF generation                                                      */
/* ------------------------------------------------------------------ */
const A4 = [595.28, 841.89];
const NAVY = rgb(0.075, 0.157, 0.247);
const ACCENT = rgb(0.043, 0.36, 0.678);
const GREY = rgb(0.4, 0.44, 0.5);
const LIGHT = rgb(0.93, 0.95, 0.97);

// Standard PDF fonts only cover WinAnsi; replace anything else so generation never fails.
const safe = (s) =>
  String(s ?? "")
    .replace(/[‐-‒]/g, "-")
    .replace(/[^\x20-\x7E -ÿ–—‘’“”•€™]/g, "?");

function wrap(text, font, size, maxW) {
  const words = safe(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (font.widthOfTextAtSize(t, size) <= maxW || !line) line = t;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
function fit(text, font, size, maxW) {
  let t = safe(text);
  if (font.widthOfTextAtSize(t, size) <= maxW) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > maxW) t = t.slice(0, -1);
  return t + "…";
}

async function loadFonts(pdf) {
  return {
    reg: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
}

async function embedLogo(pdf) {
  const l = state.settings.logo;
  if (!l) return null;
  try {
    return l.mime === "image/png" ? await pdf.embedPng(l.data) : await pdf.embedJpg(l.data);
  } catch {
    return null;
  }
}

// Header band used on all generated pages
function drawHeader(page, F, logo, label) {
  const [w, h] = A4;
  page.drawRectangle({ x: 0, y: h - 60, width: w, height: 60, color: NAVY });
  let x = 40;
  if (logo) {
    const s = logo.scaleToFit(110, 38);
    page.drawRectangle({ x: 34, y: h - 54, width: s.width + 12, height: 48, color: rgb(1, 1, 1) });
    page.drawImage(logo, { x: 40, y: h - 30 - s.height / 2, width: s.width, height: s.height });
    x = 40 + s.width + 22;
  }
  page.drawText(fit(state.settings.fullName, F.bold, 13, w - x - 40), { x, y: h - 35, size: 13, font: F.bold, color: rgb(1, 1, 1) });
  if (label) {
    const lw = F.reg.widthOfTextAtSize(safe(label), 9);
    page.drawText(safe(label), { x: w - 40 - lw, y: h - 52, size: 9, font: F.reg, color: rgb(0.8, 0.85, 0.9) });
  }
}

async function drawCover(pdf, F, logo, p) {
  migrateProject(p);
  if (state.settings.coverStyle === "simple") return drawSimpleCover(pdf, F, logo, p);
  return drawProjectCover(pdf, F, logo, p);
}

const BLUE = rgb(0, 0x70 / 255, 0xc0 / 255); // 0070C0, as in the Word cover template
const DARK_BLUE = rgb(0, 0x20 / 255, 0x60 / 255); // 002060

async function embedDataUrl(pdf, dataUrl) {
  if (!dataUrl) return null;
  try {
    return dataUrl.startsWith("data:image/png") ? await pdf.embedPng(dataUrl) : await pdf.embedJpg(dataUrl);
  } catch {
    return null;
  }
}

function centred(page, text, font, size, y, color, cx = A4[0] / 2) {
  const t = safe(text);
  const tw = font.widthOfTextAtSize(t, size);
  page.drawText(t, { x: cx - tw / 2, y, size, font, color });
  return tw;
}

// Lines of text, honouring line breaks typed by the user, wrapped to maxW
const wrapLines = (text, font, size, maxW) => String(text || "").split(/\n/).flatMap((l) => (l.trim() ? wrap(l, font, size, maxW) : []));

// Layout of MAIN COVER PAGE.docx: border, PROJECT title, underlined heading, parties with logos, submitted by.
async function drawProjectCover(pdf, F, logo, p) {
  const page = pdf.addPage(A4);
  const [w, h] = A4;
  page.drawRectangle({ x: 24, y: 24, width: w - 48, height: h - 48, borderColor: rgb(0, 0, 0), borderWidth: 0.6 });

  // Title: "PROJECT: ..." shrinks to fit at most 8 lines
  const raw = (p.coverTitle || p.name || "").trim().replace(/^project\s*:\s*/i, "");
  const title = ("PROJECT: " + raw).toUpperCase();
  const maxW = w - 144;
  let size = 15, lines;
  for (; size > 9; size -= 0.5) {
    lines = wrapLines(title, F.bold, size, maxW);
    if (lines.length <= 8) break;
  }
  let y = h - 95;
  for (const l of lines) {
    centred(page, l, F.bold, size, y, BLUE);
    y -= size * 1.3;
  }

  // Heading, underlined
  y -= 22;
  for (const l of wrapLines((p.coverSubtitle || "").toUpperCase(), F.bold, 14, maxW)) {
    const tw = centred(page, l, F.bold, 14, y, BLUE);
    page.drawLine({ start: { x: (w - tw) / 2, y: y - 2.5 }, end: { x: (w + tw) / 2, y: y - 2.5 }, thickness: 0.9, color: BLUE });
    y -= 20;
  }
  if (p.location) centred(page, p.location.toUpperCase(), F.bold, 10.5, y - 6, DARK_BLUE);

  // Parties: one column each
  const parties = (p.parties || []).filter((x) => x.role || x.name || x.logo).slice(0, MAX_PARTIES);
  if (parties.length) {
    const left = 48, colW = (w - 2 * left) / parties.length;
    const logoW = Math.min(115, colW - 16), logoH = 82;
    const roleY = 400;
    for (const [i, x] of parties.entries()) {
      const cx = left + colW * (i + 0.5);
      wrapLines(x.role.toUpperCase(), F.bold, 10.5, colW - 10).slice(0, 2).forEach((l, j) => centred(page, l, F.bold, 10.5, roleY - j * 13, BLUE, cx));
      const img = await embedDataUrl(pdf, x.logo);
      if (img) {
        const s = img.scaleToFit(logoW, logoH);
        page.drawImage(img, { x: cx - s.width / 2, y: roleY - 30 - logoH + (logoH - s.height) / 2, width: s.width, height: s.height });
      }
      wrapLines(x.name.toUpperCase(), F.bold, 10, colW - 12).slice(0, 4).forEach((l, j) => centred(page, l, F.bold, 10, roleY - 30 - logoH - 20 - j * 12.5, BLUE, cx));
    }
  }

  // Submitted by
  let sy = 205;
  centred(page, "SUBMITTED BY", F.bold, 11, sy, BLUE);
  sy -= 12;
  if (logo) {
    const s = logo.scaleToFit(150, 72);
    page.drawImage(logo, { x: (w - s.width) / 2, y: sy - s.height, width: s.width, height: s.height });
    sy -= s.height + 18;
  } else sy -= 18;
  for (const l of wrapLines((state.settings.fullName || "").toUpperCase(), F.bold, 12, w - 120)) {
    centred(page, l, F.bold, 12, sy, DARK_BLUE);
    sy -= 15;
  }

  // Document control line, inside the border
  const ctl = [p.refNo && "Doc. No.: " + p.refNo, p.submissionNo && "Submission No.: " + p.submissionNo, p.revision && "Rev.: " + p.revision, p.date && "Date: " + fmtDate(p.date)].filter(Boolean).join("     ");
  if (ctl) {
    page.drawLine({ start: { x: 48, y: 54 }, end: { x: w - 48, y: 54 }, thickness: 0.4, color: BLUE });
    centred(page, fit(ctl, F.reg, 8.5, w - 100), F.reg, 8.5, 40, BLUE);
  }
}

function drawSimpleCover(pdf, F, logo, p) {
  const page = pdf.addPage(A4);
  const [w, h] = A4;
  drawHeader(page, F, logo, "");
  let y = h - 150;
  const title = state.settings.title || "TECHNICAL SUBMISSION FOR APPROVAL";
  for (const line of wrap(title, F.bold, 24, w - 80)) {
    const lw = F.bold.widthOfTextAtSize(line, 24);
    page.drawText(line, { x: (w - lw) / 2, y, size: 24, font: F.bold, color: NAVY });
    y -= 30;
  }
  page.drawRectangle({ x: w / 2 - 60, y: y + 8, width: 120, height: 3, color: ACCENT });
  y -= 28;
  for (const line of wrap(p.coverSubtitle, F.reg, 14, w - 120)) {
    const lw = F.reg.widthOfTextAtSize(line, 14);
    page.drawText(line, { x: (w - lw) / 2, y, size: 14, font: F.reg, color: GREY });
    y -= 19;
  }
  y -= 25;
  const rows = [
    ["Project", p.coverTitle || p.name],
    ["Location", p.location],
    ...p.parties.filter((x) => x.name).map((x) => [x.role || "Party", x.name]),
    ["Submitted by", state.settings.fullName],
    ["Document / reference no.", p.refNo],
    ["Submission no.", p.submissionNo],
    ["Revision", p.revision],
    ["Date", fmtDate(p.date)],
  ].filter((r) => r[1]);
  const x0 = 60, colW = 160, tw = w - 120;
  for (const [k, v] of rows) {
    const lines = wrap(v, F.reg, 11, tw - colW - 20);
    const rh = 12 + lines.length * 14;
    page.drawRectangle({ x: x0, y: y - rh + 14, width: colW, height: rh, color: LIGHT, borderColor: rgb(0.8, 0.83, 0.87), borderWidth: 0.6 });
    page.drawRectangle({ x: x0 + colW, y: y - rh + 14, width: tw - colW, height: rh, borderColor: rgb(0.8, 0.83, 0.87), borderWidth: 0.6 });
    page.drawText(safe(k), { x: x0 + 8, y: y - 2, size: 10, font: F.bold, color: NAVY });
    lines.forEach((l, i) => page.drawText(l, { x: x0 + colW + 10, y: y - 2 - i * 14, size: 11, font: F.reg }));
    y -= rh;
  }

  // Client approval block
  const by = 70, bh = 150;
  page.drawRectangle({ x: x0, y: by, width: tw, height: bh, borderColor: NAVY, borderWidth: 1 });
  page.drawRectangle({ x: x0, y: by + bh - 22, width: tw, height: 22, color: NAVY });
  page.drawText("FOR CLIENT / CONSULTANT USE", { x: x0 + 10, y: by + bh - 15, size: 10, font: F.bold, color: rgb(1, 1, 1) });
  const choices = ["A - Approved", "B - Approved as noted", "C - Revise and resubmit", "D - Rejected"];
  choices.forEach((c, i) => {
    const cx = x0 + 14 + (i % 2) * (tw / 2), cy = by + bh - 45 - Math.floor(i / 2) * 22;
    page.drawRectangle({ x: cx, y: cy - 2, width: 11, height: 11, borderColor: NAVY, borderWidth: 0.8 });
    page.drawText(c, { x: cx + 18, y: cy, size: 10, font: F.reg });
  });
  page.drawText("Comments:", { x: x0 + 14, y: by + 50, size: 10, font: F.bold });
  page.drawLine({ start: { x: x0 + 75, y: by + 48 }, end: { x: x0 + tw - 14, y: by + 48 }, thickness: 0.5, color: GREY });
  page.drawText("Name & signature:", { x: x0 + 14, y: by + 18, size: 10, font: F.bold });
  page.drawLine({ start: { x: x0 + 110, y: by + 16 }, end: { x: x0 + tw / 2 + 60, y: by + 16 }, thickness: 0.5, color: GREY });
  page.drawText("Date:", { x: x0 + tw / 2 + 80, y: by + 18, size: 10, font: F.bold });
  page.drawLine({ start: { x: x0 + tw / 2 + 110, y: by + 16 }, end: { x: x0 + tw - 14, y: by + 16 }, thickness: 0.5, color: GREY });
  if (state.settings.preparedBy) page.drawText(safe("Prepared by: " + state.settings.preparedBy), { x: x0, y: by - 18, size: 9, font: F.reg, color: GREY });
  if (state.settings.address) {
    const a = fit(state.settings.address, F.reg, 8, w - 80);
    page.drawText(a, { x: (w - F.reg.widthOfTextAtSize(a, 8)) / 2, y: 30, size: 8, font: F.reg, color: GREY });
  }
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return isNaN(d) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function drawDivider(pdf, F, logo, no, title, docs, p) {
  const page = pdf.addPage(A4);
  const [w, h] = A4;
  drawHeader(page, F, logo, p.name);
  page.drawRectangle({ x: 0, y: h / 2 - 70, width: w, height: 140, color: LIGHT });
  page.drawRectangle({ x: 0, y: h / 2 - 70, width: 12, height: 140, color: ACCENT });
  page.drawText(safe("SECTION " + no), { x: 60, y: h / 2 + 30, size: 14, font: F.bold, color: ACCENT });
  wrap(title.toUpperCase(), F.bold, 26, w - 120).slice(0, 2).forEach((l, i) => page.drawText(l, { x: 60, y: h / 2 - 8 - i * 30, size: 26, font: F.bold, color: NAVY }));
  if (docs.length) {
    let y = h / 2 - 110;
    page.drawText("Contents of this section:", { x: 60, y, size: 11, font: F.bold, color: NAVY });
    for (const d of docs.slice(0, 20)) {
      y -= 17;
      page.drawText(fit("•  " + d.name, F.reg, 10.5, w - 130), { x: 70, y, size: 10.5, font: F.reg });
    }
    if (docs.length > 20) page.drawText(`… and ${docs.length - 20} more`, { x: 70, y: y - 17, size: 10.5, font: F.reg, color: GREY });
  }
}

function drawTable(page, F, x, y, cols, header, rows) {
  const tw = cols.reduce((a, b) => a + b, 0);
  const draw = (cells, yy, bold, fill) => {
    const linesPer = cells.map((c, i) => wrap(c, bold ? F.bold : F.reg, 9, cols[i] - 8));
    const rh = 8 + Math.max(...linesPer.map((l) => l.length)) * 11;
    if (fill) page.drawRectangle({ x, y: yy - rh, width: tw, height: rh, color: fill });
    let cx = x;
    linesPer.forEach((lines, i) => {
      page.drawRectangle({ x: cx, y: yy - rh, width: cols[i], height: rh, borderColor: rgb(0.75, 0.78, 0.82), borderWidth: 0.5 });
      lines.forEach((l, j) => page.drawText(l, { x: cx + 4, y: yy - 12 - j * 11, size: 9, font: bold ? F.bold : F.reg, color: bold ? NAVY : rgb(0, 0, 0) }));
      cx += cols[i];
    });
    return yy - rh;
  };
  y = draw(header, y, true, LIGHT);
  for (const r of rows) y = draw(r, y, false, null);
  return y;
}

function drawSchedule(pdf, F, logo, p) {
  const page = pdf.addPage(A4);
  const [w, h] = A4;
  drawHeader(page, F, logo, p.name);
  let y = h - 100;
  page.drawText("SCHEDULE OF MATERIALS PROPOSED", { x: 40, y, size: 16, font: F.bold, color: NAVY });
  y -= 30;
  const lum = p.luminaires.filter((r) => Object.values(r).some(Boolean));
  const poles = p.poles.filter((r) => Object.values(r).some(Boolean));
  page.drawText("A. Light fittings", { x: 40, y, size: 12, font: F.bold, color: ACCENT });
  y -= 10;
  y = drawTable(page, F, 40, y, [30, 165, 95, 110, 60, 55], ["Sl.", "Description / application", "Make", "Model", "Wattage (W)", "Qty"],
    lum.map((r, i) => [String(i + 1), r.desc, r.make, r.model, r.wattage, r.qty]));
  y -= 30;
  page.drawText("B. Poles", { x: 40, y, size: 12, font: F.bold, color: ACCENT });
  y -= 10;
  drawTable(page, F, 40, y, [30, 120, 60, 155, 95, 55], ["Sl.", "Pole type", "Height (m)", "Dimensions", "Bracket / arm", "Qty"],
    poles.map((r, i) => [String(i + 1), r.type, r.height, r.dims, r.bracket, r.qty]));
}

const INDEX_ROWS_PER_PAGE = 34;
function drawIndex(pdf, F, logo, p, entries) {
  const [w, h] = A4;
  const pages = [];
  for (let start = 0; start < Math.max(entries.length, 1); start += INDEX_ROWS_PER_PAGE) {
    const page = pdf.addPage(A4);
    pages.push(page);
    drawHeader(page, F, logo, p.name);
    let y = h - 100;
    page.drawText(start ? "INDEX (continued)" : "INDEX", { x: 40, y, size: 16, font: F.bold, color: NAVY });
    y -= 28;
    page.drawRectangle({ x: 40, y: y - 6, width: w - 80, height: 20, color: LIGHT });
    page.drawText("Sl.", { x: 46, y, size: 10, font: F.bold, color: NAVY });
    page.drawText("Description", { x: 90, y, size: 10, font: F.bold, color: NAVY });
    page.drawText("Page no.", { x: w - 100, y, size: 10, font: F.bold, color: NAVY });
    y -= 22;
    for (const e of entries.slice(start, start + INDEX_ROWS_PER_PAGE)) {
      const font = e.level === 0 ? F.bold : F.reg;
      const indent = e.level * 16;
      if (e.no) page.drawText(safe(e.no), { x: 46 + (e.level === 2 ? 30 : 0), y, size: 10, font });
      page.drawText(fit(e.text, font, 10, w - 210 - indent), { x: 90 + indent, y, size: 10, font, color: e.level === 2 ? GREY : rgb(0, 0, 0) });
      if (e.pages) page.drawText(e.pages, { x: w - 100, y, size: 10, font });
      page.drawLine({ start: { x: 40, y: y - 6 }, end: { x: w - 40, y: y - 6 }, thickness: 0.3, color: rgb(0.85, 0.87, 0.9) });
      y -= 20;
    }
  }
  return pages;
}

async function appendDoc(out, meta, warnings) {
  const f = await DB.get("files", meta.id);
  if (!f) {
    warnings.push(`${meta.name}: file missing`);
    return 0;
  }
  if (meta.mime === "application/pdf") {
    const src = await PDFDocument.load(f.data, { ignoreEncryption: true });
    if (src.isEncrypted) warnings.push(`${meta.name} is password-protected; its pages may appear blank. Upload an unprotected copy.`);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((pg) => out.addPage(pg));
    return pages.length;
  }
  const img = meta.mime === "image/png" ? await out.embedPng(f.data) : await out.embedJpg(f.data);
  const landscape = img.width > img.height;
  const size = landscape ? [A4[1], A4[0]] : A4;
  const page = out.addPage(size);
  const s = img.scaleToFit(size[0] - 50, size[1] - 70);
  page.drawImage(img, { x: (size[0] - s.width) / 2, y: (size[1] - s.height) / 2 + 8, width: s.width, height: s.height });
  return 1;
}

function stampFooter(page, F, text, n, total) {
  const rot = ((page.getRotation().angle % 360) + 360) % 360;
  const label = `Page ${n} of ${total}`;
  const size = 8;
  const left = fit(text, F.reg, size, 300);
  const box = page.getMediaBox();
  if (rot === 0) {
    page.drawText(left, { x: box.x + 30, y: box.y + 14, size, font: F.reg, color: GREY });
    page.drawText(label, { x: box.x + box.width - 30 - F.reg.widthOfTextAtSize(label, size), y: box.y + 14, size, font: F.reg, color: GREY });
  } else if (rot === 90) {
    // shown turned clockwise: the visible bottom edge is the page's right edge, text runs upward
    const x = box.x + box.width - 14;
    page.drawText(left, { x, y: box.y + 30, size, font: F.reg, color: GREY, rotate: degrees(90) });
    page.drawText(label, { x, y: box.y + box.height - 30 - F.reg.widthOfTextAtSize(label, size), size, font: F.reg, color: GREY, rotate: degrees(90) });
  } else if (rot === 270) {
    // shown turned anticlockwise: the visible bottom edge is the page's left edge, text runs downward
    const x = box.x + 14;
    page.drawText(left, { x, y: box.y + box.height - 30, size, font: F.reg, color: GREY, rotate: degrees(270) });
    page.drawText(label, { x, y: box.y + 30 + F.reg.widthOfTextAtSize(label, size), size, font: F.reg, color: GREY, rotate: degrees(270) });
  } else {
    page.drawText(left, { x: box.x + box.width - 30, y: box.y + box.height - 14, size, font: F.reg, color: GREY, rotate: degrees(180) });
    page.drawText(label, { x: box.x + 30 + F.reg.widthOfTextAtSize(label, size), y: box.y + box.height - 14, size, font: F.reg, color: GREY, rotate: degrees(180) });
  }
}

async function generate() {
  const p = state.current;
  await saveProject();
  const o = p.options;
  const docsOf = (key) => p.sections[key].map(docById).filter(Boolean);
  const total = LEAVES.filter((s) => s.key !== "cover").reduce((n, s) => n + docsOf(s.key).length, 0);
  if (!total && !confirm("No documents are selected in any section. Generate the cover and index only?")) return;

  busy(true, "Building the submission PDF…");
  const warnings = [];
  try {
    const out = await PDFDocument.create();
    const F = await loadFonts(out);
    const logo = await embedLogo(out);
    out.setTitle(safe(`${state.settings.title} - ${p.name}`));
    out.setAuthor(safe(state.settings.fullName));
    out.setSubject(safe(p.coverTitle || p.name));

    // ---- plan the page layout first so the index can show page numbers ----
    const coverDocs = docsOf("cover");
    const coverPages = coverDocs.length ? coverDocs.reduce((n, d) => n + d.pages, 0) : 1;
    const groups = []; // { section, parent?, docs, divider }
    for (const s of SECTIONS) {
      if (s.key === "cover") continue;
      if (s.children) {
        const kids = s.children.map((c) => ({ section: c, docs: docsOf(c.key), divider: o.optSubDividers })).filter((g) => g.docs.length);
        if (!kids.length) continue;
        groups.push({ section: s, docs: [], divider: o.optDividers, isParent: true, childDocs: kids.flatMap((k) => k.docs) });
        groups.push(...kids.map((k) => ({ ...k, isChild: true })));
      } else {
        const docs = docsOf(s.key);
        if (docs.length) groups.push({ section: s, docs, divider: o.optDividers });
      }
    }
    const entryCount = () => {
      let n = 1 + (o.optSchedule ? 1 : 0);
      for (const g of groups) n += 1 + (g.isParent ? 0 : g.docs.length);
      return n;
    };
    const indexPages = o.optIndex ? Math.ceil(entryCount() / INDEX_ROWS_PER_PAGE) : 0;
    let cursor = coverPages + indexPages + 1;
    const entries = [{ level: 0, no: "1", text: "Cover Page", pages: "1" }];
    if (o.optSchedule) {
      entries.push({ level: 0, no: "", text: "Schedule of Materials Proposed", pages: String(cursor) });
      cursor += 1;
    }
    for (const g of groups) {
      const start = cursor;
      if (g.divider) cursor += 1;
      if (g.isParent) {
        g.entry = { level: 0, no: g.section.no, text: sectionTitle(g.section), pages: "" };
        entries.push(g.entry);
        g.entry._start = start;
        continue;
      }
      const head = { level: g.isChild ? 1 : 0, no: g.section.no, text: sectionTitle(g.section) };
      entries.push(head);
      for (const d of g.docs) {
        entries.push({ level: 2, no: "", text: d.name, pages: range(cursor, cursor + d.pages - 1) });
        cursor += d.pages;
      }
      head.pages = range(start, cursor - 1);
      g.end = cursor - 1;
    }
    // parent section (4) spans to the end of its last child
    for (let i = 0; i < groups.length; i++) {
      if (!groups[i].isParent) continue;
      let j = i + 1;
      while (j < groups.length && groups[j].isChild) j++;
      groups[i].entry.pages = range(groups[i].entry._start, groups[j - 1].end);
    }

    // ---- build ----
    if (coverDocs.length) for (const d of coverDocs) await appendDoc(out, d, warnings);
    else await drawCover(out, F, logo, p);
    if (o.optIndex) drawIndex(out, F, logo, p, entries);
    if (o.optSchedule) drawSchedule(out, F, logo, p);
    for (const g of groups) {
      if (g.divider) drawDivider(out, F, logo, g.section.no, sectionTitle(g.section), g.isParent ? [] : g.docs, p);
      if (g.isParent) continue;
      for (const d of g.docs) {
        busy(true, `Adding ${d.name}…`);
        await appendDoc(out, d, warnings);
      }
    }

    if (o.optFooter) {
      const pages = out.getPages();
      const text = [state.settings.shortName, p.refNo, p.submissionNo && "Sub. " + p.submissionNo, p.revision].filter(Boolean).join("  |  ");
      pages.forEach((pg, i) => stampFooter(pg, F, text, i + 1, pages.length));
    }

    busy(true, "Saving…");
    const bytes = await out.save();
    const name = `${[p.refNo, "Technical Submission", p.name, p.revision].filter(Boolean).join(" - ")}.pdf`
      .replace(/[\u2010-\u2015]/g, "-")
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, "") // some browsers drop the whole name if it has non-ASCII characters
      .replace(/[\\/:*?"<>|]+/g, "_");
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast(`Generated ${out.getPageCount()} pages` + (warnings.length ? ` — ${warnings.join("; ")}` : ""), warnings.length > 0);
  } catch (err) {
    console.error(err);
    toast("Could not generate the PDF: " + err.message, true);
  } finally {
    busy(false);
  }
}
const range = (a, b) => (b > a ? `${a} - ${b}` : String(a));
$("#generate").addEventListener("click", generate);

/* ------------------------------------------------------------------ */
/* Backup / restore                                                    */
/* ------------------------------------------------------------------ */
const toB64 = (buf) => {
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;

$("#export-all").addEventListener("click", async () => {
  busy(true, "Preparing backup…");
  const files = await DB.all("files");
  const settings = { ...state.settings, logo: state.settings.logo ? { mime: state.settings.logo.mime, data: toB64(state.settings.logo.data) } : null };
  const backup = {
    app: "tech-submission-builder",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    projects: state.projects,
    docs: state.docs,
    files: files.map((f) => ({ id: f.id, data: toB64(f.data) })),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `tech-submission-backup-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  busy(false);
});

$("#import-all").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    const b = JSON.parse(await file.text());
    if (b.app !== "tech-submission-builder") throw new Error("This is not a Technical Submission Builder backup.");
    if (!confirm("Replace ALL current projects, library documents and settings with this backup?")) return;
    busy(true, "Restoring…");
    for (const s of ["docs", "files", "projects", "settings"]) await DB.clear(s);
    const files = new Map(b.files.map((f) => [f.id, f.data]));
    for (const d of b.docs) if (files.has(d.id)) await DB.putDoc(d, fromB64(files.get(d.id)));
    for (const p of b.projects) await DB.put("projects", p);
    const s = b.settings;
    if (s.logo) s.logo = { mime: s.logo.mime, data: fromB64(s.logo.data) };
    await DB.put("settings", s);
    await load();
    toast("Backup restored");
    show("projects");
  } catch (err) {
    toast(err.message, true);
  } finally {
    busy(false);
  }
});

/* ------------------------------------------------------------------ */
/* Start                                                               */
/* ------------------------------------------------------------------ */
async function load() {
  state.settings = { ...DEFAULT_SETTINGS, ...((await DB.get("settings", "company")) || {}) };
  state.docs = await DB.all("docs");
  state.projects = await DB.all("projects");
  fillCategorySelects();
}

load()
  .then(() => show("projects"))
  .catch((err) => toast("Could not open browser storage: " + err.message, true));
