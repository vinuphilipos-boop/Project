(() => {
  const STORAGE_KEY = "eisenhower-box-tasks";

  const form = document.getElementById("task-form");
  const input = document.getElementById("task-input");
  const urgentInput = document.getElementById("urgent-input");
  const importantInput = document.getElementById("important-input");
  const clearDoneBtn = document.getElementById("clear-done");
  const quadrants = document.querySelectorAll(".quadrant");
  const exportBtn = document.getElementById("export-btn");
  const importFile = document.getElementById("import-file");
  const installBtn = document.getElementById("install-btn");

  const QUADRANTS = [
    ["do", "Do"],
    ["schedule", "Schedule"],
    ["delegate", "Delegate"],
    ["delete", "Delete"],
  ];

  let tasks = load();

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  function quadrantFor(urgent, important) {
    if (urgent && important) return "do";
    if (!urgent && important) return "schedule";
    if (urgent && !important) return "delegate";
    return "delete";
  }

  function render() {
    quadrants.forEach((section) => {
      const list = section.querySelector(".task-list");
      list.replaceChildren();
      const items = tasks.filter((t) => t.quadrant === section.dataset.quadrant);
      if (items.length === 0) {
        const li = document.createElement("li");
        li.className = "empty";
        li.textContent = "No tasks";
        list.appendChild(li);
        return;
      }
      items.forEach((task) => list.appendChild(renderTask(task)));
    });
  }

  function renderTask(task) {
    const li = document.createElement("li");
    li.className = "task" + (task.done ? " done" : "");
    li.draggable = true;
    li.dataset.id = task.id;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = task.done;
    checkbox.setAttribute("aria-label", "Mark complete");
    checkbox.addEventListener("change", () => {
      task.done = checkbox.checked;
      save();
      render();
    });

    const text = document.createElement("span");
    text.className = "text";
    text.textContent = task.text;
    text.title = "Double-click to edit";
    text.addEventListener("dblclick", () => {
      const updated = prompt("Edit task", task.text);
      if (updated && updated.trim()) {
        task.text = updated.trim();
        save();
        render();
      }
    });

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete";
    del.textContent = "×";
    del.setAttribute("aria-label", "Delete task");
    del.addEventListener("click", () => {
      tasks = tasks.filter((t) => t.id !== task.id);
      save();
      render();
    });

    // Move menu: works on touch devices where drag-and-drop doesn't.
    const move = document.createElement("select");
    move.className = "move";
    move.setAttribute("aria-label", "Move to box");
    QUADRANTS.forEach(([value, label]) => move.add(new Option(label, value)));
    move.value = task.quadrant;
    move.addEventListener("change", () => {
      task.quadrant = move.value;
      save();
      render();
    });

    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", task.id);
      e.dataTransfer.effectAllowed = "move";
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", () => li.classList.remove("dragging"));

    li.append(checkbox, text, move, del);
    return li;
  }

  quadrants.forEach((section) => {
    section.addEventListener("dragover", (e) => {
      e.preventDefault();
      section.classList.add("drag-over");
    });
    section.addEventListener("dragleave", (e) => {
      if (!section.contains(e.relatedTarget)) section.classList.remove("drag-over");
    });
    section.addEventListener("drop", (e) => {
      e.preventDefault();
      section.classList.remove("drag-over");
      const task = tasks.find((t) => t.id === e.dataTransfer.getData("text/plain"));
      if (task && task.quadrant !== section.dataset.quadrant) {
        task.quadrant = section.dataset.quadrant;
        save();
        render();
      }
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    tasks.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      text,
      quadrant: quadrantFor(urgentInput.checked, importantInput.checked),
      done: false,
    });
    save();
    render();
    form.reset();
    input.focus();
  });

  clearDoneBtn.addEventListener("click", () => {
    tasks = tasks.filter((t) => !t.done);
    save();
    render();
  });

  exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `eisenhower-tasks-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  importFile.addEventListener("change", async () => {
    const file = importFile.files[0];
    importFile.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const valid = QUADRANTS.map(([v]) => v);
      if (!Array.isArray(data)) throw new Error("not a list");
      const imported = data
        .filter((t) => t && typeof t.text === "string" && valid.includes(t.quadrant))
        .map((t) => ({ id: String(t.id || Math.random().toString(36).slice(2)), text: t.text, quadrant: t.quadrant, done: !!t.done }));
      if (!confirm(`Replace your current ${tasks.length} task(s) with ${imported.length} imported task(s)?`)) return;
      tasks = imported;
      save();
      render();
    } catch {
      alert("That file couldn't be imported. Choose a file created with Export.");
    }
  });

  // Install prompt (Chrome/Edge/Android). iOS uses Share → Add to Home Screen.
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.hidden = true;
  });
  window.addEventListener("appinstalled", () => (installBtn.hidden = true));

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js");
  }

  render();
})();
