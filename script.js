const STORAGE_KEY = "studyflow.tasks.v1";

const taskForm = document.querySelector("#task-form");
const taskInput = document.querySelector("#task-input");
const priorityInput = document.querySelector("#task-priority");
const taskList = document.querySelector("#task-list");
const emptyState = document.querySelector("#empty-state");
const taskFilter = document.querySelector("#task-filter");
const totalCount = document.querySelector("#total-count");
const completedCount = document.querySelector("#completed-count");
const remainingLabel = document.querySelector("#remaining-label");
const clearCompletedButton = document.querySelector("#clear-completed");
const toast = document.querySelector("#toast");

let tasks = loadTasks();
let currentView = "dashboard";
let selectedMinutes = 25;
let remainingSeconds = selectedMinutes * 60;
let timerInterval = null;
let timerRunning = false;
let toastTimeout = null;

const reminders = [
  "You don't have to do everything today. Just start with one thing.",
  "Progress is built from small steps repeated consistently.",
  "Give your attention to the task in front of you.",
  "A focused 20 minutes is a great place to begin.",
  "Done is better than waiting for the perfect moment."
];

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.filter(task =>
      task && typeof task.id === "string" &&
      typeof task.title === "string" &&
      typeof task.completed === "boolean"
    ) : [];
  } catch (error) {
    console.warn("Could not load saved tasks:", error);
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    showToast("Couldn't save locally. Check your browser storage settings.");
  }
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2400);
}

function renderTasks() {
  const filter = taskFilter.value;
  const visibleTasks = tasks.filter(task => {
    if (filter === "active") return !task.completed;
    if (filter === "completed") return task.completed;
    return true;
  });

  taskList.replaceChildren();
  visibleTasks.forEach(task => {
    const row = document.createElement("div");
    row.className = `task-row${task.completed ? " is-complete" : ""}`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-check";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `Mark ${task.title} as ${task.completed ? "not completed" : "completed"}`);
    checkbox.addEventListener("change", () => toggleTask(task.id));

    const title = document.createElement("span");
    title.className = "task-title";
    title.textContent = task.title;

    const priority = document.createElement("span");
    const safePriority = ["High", "Medium", "Low"].includes(task.priority) ? task.priority : "Medium";
    priority.className = `priority ${safePriority}`;
    priority.textContent = safePriority;

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-task";
    deleteButton.type = "button";
    deleteButton.textContent = "×";
    deleteButton.setAttribute("aria-label", `Delete ${task.title}`);
    deleteButton.addEventListener("click", () => deleteTask(task.id));

    row.append(checkbox, title, priority, deleteButton);
    taskList.append(row);
  });

  emptyState.hidden = visibleTasks.length > 0;
  totalCount.textContent = tasks.length;
  completedCount.textContent = tasks.filter(task => task.completed).length;
  const remaining = tasks.filter(task => !task.completed).length;
  remainingLabel.textContent = `${remaining} task${remaining === 1 ? "" : "s"} left`;
  clearCompletedButton.disabled = !tasks.some(task => task.completed);
  clearCompletedButton.style.opacity = clearCompletedButton.disabled ? ".45" : "1";
}

function addTask(title, priority) {
  const cleanTitle = title.trim();
  if (!cleanTitle) return;
  tasks.unshift({ id: makeId(), title: cleanTitle, priority, completed: false, createdAt: new Date().toISOString() });
  saveTasks();
  renderTasks();
  showToast("Task added to your planner.");
}

function toggleTask(id) {
  tasks = tasks.map(task => task.id === id ? { ...task, completed: !task.completed } : task);
  saveTasks();
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter(task => task.id !== id);
  saveTasks();
  renderTasks();
  showToast("Task removed.");
}

taskForm.addEventListener("submit", event => {
  event.preventDefault();
  addTask(taskInput.value, priorityInput.value);
  taskInput.value = "";
  taskInput.focus();
});

taskFilter.addEventListener("change", renderTasks);

clearCompletedButton.addEventListener("click", () => {
  const completedBefore = tasks.length;
  tasks = tasks.filter(task => !task.completed);
  if (tasks.length === completedBefore) return;
  saveTasks();
  renderTasks();
  showToast("Completed tasks cleared.");
});

document.querySelector("#new-task-top").addEventListener("click", () => {
  taskInput.focus();
  taskInput.scrollIntoView({ behavior: "smooth", block: "center" });
});

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item === button));
    document.querySelector("#page-title").textContent = currentView === "tasks" ? "Your tasks, your pace." : "Good to see you.";
    document.querySelector("#tasks-heading").textContent = currentView === "tasks" ? "All your tasks" : "Today's tasks";
    taskFilter.value = currentView === "tasks" ? "all" : "active";
    renderTasks();
    document.querySelector(".tasks-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateTimerDisplay() {
  document.querySelector("#timer-display").textContent = formatTime(remainingSeconds);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;
  document.querySelector("#timer-start").textContent = "Start focus";
}

function startTimer() {
  if (timerRunning) {
    stopTimer();
    document.querySelector("#timer-status").textContent = "Timer paused. Resume when ready.";
    return;
  }
  timerRunning = true;
  document.querySelector("#timer-start").textContent = "Pause";
  document.querySelector("#timer-status").textContent = selectedMinutes === 25 ? "Focus session in progress…" : "Break time in progress…";
  timerInterval = setInterval(() => {
    remainingSeconds -= 1;
    updateTimerDisplay();
    if (remainingSeconds <= 0) {
      stopTimer();
      remainingSeconds = 0;
      updateTimerDisplay();
      document.querySelector("#timer-status").textContent = "Session complete. Nice work!";
      showToast("Your timer session is complete!");
    }
  }, 1000);
}

document.querySelector("#timer-start").addEventListener("click", startTimer);
document.querySelector("#timer-reset").addEventListener("click", () => {
  stopTimer();
  remainingSeconds = selectedMinutes * 60;
  updateTimerDisplay();
  document.querySelector("#timer-status").textContent = "Timer reset. Ready when you are.";
});

document.querySelectorAll(".mode-btn").forEach(button => {
  button.addEventListener("click", () => {
    stopTimer();
    document.querySelectorAll(".mode-btn").forEach(item => item.classList.toggle("selected", item === button));
    selectedMinutes = Number(button.dataset.minutes);
    remainingSeconds = selectedMinutes * 60;
    updateTimerDisplay();
    document.querySelector("#timer-start").textContent = selectedMinutes === 25 ? "Start focus" : "Start break";
    document.querySelector("#timer-status").textContent = "Ready when you are.";
  });
});

document.querySelector("#new-quote").addEventListener("click", () => {
  const quote = document.querySelector("#daily-quote");
  const current = quote.textContent;
  const options = reminders.filter(item => item !== current);
  quote.textContent = options[Math.floor(Math.random() * options.length)];
});

function setDateLabel() {
  const now = new Date();
  document.querySelector("#today-label").textContent = now.toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric"
  }).toUpperCase();
}

setDateLabel();
renderTasks();
updateTimerDisplay();
