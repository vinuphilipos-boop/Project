(() => {
  const STORAGE_KEY = "eisenhower-box-tasks";

  const form = document.getElementById("task-form");
  const input = document.getElementById("task-input");
  const urgentInput = document.getElementById("urgent-input");
  const importantInput = document.getElementById("important-input");
  const clearDoneBtn = document.getElementById("clear-done");
  const quadrants = document.querySelectorAll(".quadrant");

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

    li.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", task.id);
      e.dataTransfer.effectAllowed = "move";
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", () => li.classList.remove("dragging"));

    li.append(checkbox, text, del);
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

  render();
})();
