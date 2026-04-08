const DEFAULT_SETTINGS = {
  bedtime: "",
  routineActions: [
    { name: "Get ready", minutes: 45, selected: true }
  ],
  todoItems: [],
  theme: "light",
  notify30: true,
  notify5: true,
  notify0: true
};

const form = document.querySelector("#settings-form");
const bedtimeInput = document.querySelector("#bedtime");
const notify30Input = document.querySelector("#notify-30");
const notify5Input = document.querySelector("#notify-5");
const notify0Input = document.querySelector("#notify-0");
const statusMessage = document.querySelector("#status-message");
const actionsList = document.querySelector("#routine-actions");
const addActionButton = document.querySelector("#add-action-button");
const routineTotal = document.querySelector("#routine-total");
const saveToast = document.querySelector("#save-toast");
const countdownCard = document.querySelector("#countdown-card");
const countdownDisplay = document.querySelector("#countdown-display");
const countdownDetail = document.querySelector("#countdown-detail");
const countdownRingProgress = document.querySelector("#countdown-ring-progress");
const todoForm = document.querySelector("#todo-form");
const todoInput = document.querySelector("#todo-input");
const todoMinutesInput = document.querySelector("#todo-minutes");
const todoList = document.querySelector("#todo-list");
const todoEmpty = document.querySelector("#todo-empty");
const sortAscendingButton = document.querySelector("#sort-ascending");
const sortDescendingButton = document.querySelector("#sort-descending");
const todoFitCard = document.querySelector("#todo-fit-card");
const todoFitAnswer = document.querySelector("#todo-fit-answer");
const todoFitDetail = document.querySelector("#todo-fit-detail");
const tabButtons = [...document.querySelectorAll(".tab-button")];
const tabPanels = [...document.querySelectorAll(".tab-panel")];
const themeToggle = document.querySelector("#theme-toggle");

let saveToastTimeoutId = null;
let countdownIntervalId = null;
let statusMessageTimeoutId = null;
const countdownRingCircumference = 2 * Math.PI * 88;

countdownRingProgress.style.strokeDasharray = String(countdownRingCircumference);
countdownRingProgress.style.strokeDashoffset = String(countdownRingCircumference);

initialize();

async function initialize() {
  const settings = await loadSettings();
  applySettingsToForm(settings);
  startCountdown();
  setActiveTab("countdown");
}

function loadSettings() {
  return chrome.storage.sync.get(DEFAULT_SETTINGS);
}

function applySettingsToForm(settings) {
  bedtimeInput.value = settings.bedtime;
  notify30Input.checked = settings.notify30;
  notify5Input.checked = settings.notify5;
  notify0Input.checked = settings.notify0;
  renderRoutineActions(normalizeRoutineActions(settings));
  renderTodoItems(Array.isArray(settings.todoItems) ? settings.todoItems : []);
  applyTheme(settings.theme);
  updateTodoFitEstimate();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const bedtime = bedtimeInput.value;
  const routineActions = collectRoutineActions();

  if (!bedtime) {
    setStatus("Choose a bedtime first.", "error");
    return;
  }

  if (routineActions.length === 0) {
    setStatus("Add at least one routine action.", "error");
    return;
  }

  if (!routineActions.every(isValidRoutineAction)) {
    setStatus("Each action needs a name and a valid minute value.", "error");
    return;
  }

  const nextSettings = {
    bedtime,
    routineActions,
    theme: getStoredTheme(),
    notify30: notify30Input.checked,
    notify5: notify5Input.checked,
    notify0: notify0Input.checked
  };

  await chrome.storage.sync.set(nextSettings);
  setStatus("Settings saved.", "success");
  showSaveToast();
  startCountdown();
  updateTodoFitEstimate();
  setActiveTab("countdown");
});

addActionButton.addEventListener("click", () => {
  const nextActions = [...collectRoutineActions(), createEmptyRoutineAction()];
  renderRoutineActions(nextActions);
});

actionsList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='remove']");

  if (!button) {
    return;
  }

  const row = button.closest(".action-row");

  if (!row) {
    return;
  }

  row.remove();

  if (actionsList.children.length === 0) {
    renderRoutineActions([createEmptyRoutineAction()]);
    setStatus("You need at least one action, so a blank one was added back.", "error");
  }

  updateRoutineTotal();
});

actionsList.addEventListener("input", () => {
  updateRoutineTotal();
  updateCountdownFromForm();
  updateTodoFitEstimate();
});

actionsList.addEventListener("change", (event) => {
  const checkbox = event.target.closest(".action-checkbox");

  if (!checkbox) {
    return;
  }

  const row = checkbox.closest(".action-row");

  if (!row) {
    return;
  }

  row.classList.toggle("selected", checkbox.checked);
  updateRoutineTotal();
  updateCountdownFromForm();
  updateTodoFitEstimate();
});

todoForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = todoInput.value.trim();
  const minutes = Number.parseInt(todoMinutesInput.value, 10);

  if (!text || !Number.isFinite(minutes) || minutes < 1) {
    return;
  }

  const settings = await loadSettings();
  const nextItems = [
    ...(Array.isArray(settings.todoItems) ? settings.todoItems : []),
    createTodoItem(text, minutes)
  ];

  await chrome.storage.sync.set({ todoItems: nextItems });
  renderTodoItems(nextItems);
  todoInput.value = "";
  todoMinutesInput.value = "";
  updateTodoFitEstimate(nextItems);
});

todoList.addEventListener("change", async (event) => {
  const checkbox = event.target.closest(".todo-checkbox");

  if (!checkbox) {
    return;
  }

  const settings = await loadSettings();
  const nextItems = (Array.isArray(settings.todoItems) ? settings.todoItems : []).map((item) => {
    if (item.id !== checkbox.dataset.todoId) {
      return item;
    }

    return { ...item, done: checkbox.checked };
  });

  await chrome.storage.sync.set({ todoItems: nextItems });
  renderTodoItems(nextItems);
  updateTodoFitEstimate(nextItems);
});

todoList.addEventListener("click", async (event) => {
  const moveButton = event.target.closest("[data-action='move-todo']");
  const removeButton = event.target.closest("[data-action='remove-todo']");

  if (moveButton) {
    const settings = await loadSettings();
    const nextItems = moveTodoItem(
      Array.isArray(settings.todoItems) ? settings.todoItems : [],
      moveButton.dataset.todoId,
      moveButton.dataset.direction
    );

    await chrome.storage.sync.set({ todoItems: nextItems });
    renderTodoItems(nextItems);
    updateTodoFitEstimate(nextItems);
    return;
  }

  if (!removeButton) {
    return;
  }

  const settings = await loadSettings();
  const nextItems = (Array.isArray(settings.todoItems) ? settings.todoItems : []).filter((item) => {
    return item.id !== removeButton.dataset.todoId;
  });

  await chrome.storage.sync.set({ todoItems: nextItems });
  renderTodoItems(nextItems);
  updateTodoFitEstimate(nextItems);
});

sortAscendingButton.addEventListener("click", async () => {
  const settings = await loadSettings();
  const nextItems = sortTodoItemsByMinutes(Array.isArray(settings.todoItems) ? settings.todoItems : [], "asc");
  await chrome.storage.sync.set({ todoItems: nextItems });
  renderTodoItems(nextItems);
  updateTodoFitEstimate(nextItems);
});

sortDescendingButton.addEventListener("click", async () => {
  const settings = await loadSettings();
  const nextItems = sortTodoItemsByMinutes(Array.isArray(settings.todoItems) ? settings.todoItems : [], "desc");
  await chrome.storage.sync.set({ todoItems: nextItems });
  renderTodoItems(nextItems);
  updateTodoFitEstimate(nextItems);
});

bedtimeInput.addEventListener("input", updateCountdownFromForm);
tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveTab(button.dataset.tab);
  });
});
themeToggle.addEventListener("click", async () => {
  const settings = await loadSettings();
  const nextTheme = settings.theme === "dark" ? "light" : "dark";

  await chrome.storage.sync.set({
    bedtime: settings.bedtime,
    routineActions: Array.isArray(settings.routineActions) ? settings.routineActions : DEFAULT_SETTINGS.routineActions,
    todoItems: Array.isArray(settings.todoItems) ? settings.todoItems : [],
    notify30: settings.notify30,
    notify5: settings.notify5,
    notify0: settings.notify0,
    theme: nextTheme
  });

  applyTheme(nextTheme);
});

function setStatus(message, tone = "") {
  if (statusMessageTimeoutId) {
    window.clearTimeout(statusMessageTimeoutId);
    statusMessageTimeoutId = null;
  }

  statusMessage.textContent = message;
  statusMessage.className = "status-message";

  if (tone) {
    statusMessage.classList.add(tone);
  }

  if (message) {
    statusMessageTimeoutId = window.setTimeout(clearStatus, 2200);
  }
}

function normalizeRoutineActions(settings) {
  if (Array.isArray(settings.routineActions) && settings.routineActions.length > 0) {
    return settings.routineActions.map((action) => ({
      name: typeof action.name === "string" ? action.name : "",
      minutes: Number.isFinite(action.minutes) ? action.minutes : 0,
      selected: "selected" in action ? Boolean(action.selected) : Boolean(action.done)
    }));
  }

  if (Number.isFinite(settings.routineMinutes)) {
    return [
      {
        name: "Get ready",
        minutes: settings.routineMinutes,
        selected: true
      }
    ];
  }

  return DEFAULT_SETTINGS.routineActions;
}

function renderRoutineActions(actions) {
  actionsList.replaceChildren();

  actions.forEach((action) => {
    actionsList.append(createActionRow(action));
  });

  updateRoutineTotal();
}

function createActionRow(action) {
  const row = document.createElement("div");
  row.className = "action-row";

  if (action.selected) {
    row.classList.add("selected");
  }

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "action-checkbox";
  checkbox.checked = Boolean(action.selected);
  checkbox.setAttribute("aria-label", `Include ${action.name || "routine action"} in routine`);

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "action-name";
  nameInput.maxLength = 40;
  nameInput.placeholder = "Action name";
  nameInput.value = action.name;

  const minutesInput = document.createElement("input");
  minutesInput.type = "number";
  minutesInput.className = "action-minutes";
  minutesInput.min = "0";
  minutesInput.step = "1";
  minutesInput.placeholder = "Min";
  minutesInput.value = String(action.minutes);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-button";
  removeButton.setAttribute("data-action", "remove");
  removeButton.setAttribute("aria-label", "Remove action");
  removeButton.textContent = "×";

  row.append(checkbox, nameInput, minutesInput, removeButton);
  return row;
}

function collectRoutineActions() {
  return [...actionsList.querySelectorAll(".action-row")].map((row) => {
    const selected = row.querySelector(".action-checkbox").checked;
    const name = row.querySelector(".action-name").value.trim();
    const minutes = Number.parseInt(row.querySelector(".action-minutes").value, 10);

    return { name, minutes, selected };
  });
}

function updateRoutineTotal() {
  const total = collectRoutineActions().reduce((sum, action) => {
    if (!action.selected) {
      return sum;
    }

    return sum + (Number.isFinite(action.minutes) && action.minutes > 0 ? action.minutes : 0);
  }, 0);

  routineTotal.textContent = `Total routine time: ${total} min`;
}

function isValidRoutineAction(action) {
  return Boolean(action.name)
    && Number.isFinite(action.minutes)
    && action.minutes >= 0;
}

function createEmptyRoutineAction() {
  return {
    name: "",
    minutes: 5,
    selected: true
  };
}

function createTodoItem(text, minutes) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    text,
    minutes,
    done: false
  };
}

function showSaveToast() {
  saveToast.classList.add("visible");
  saveToast.setAttribute("aria-hidden", "false");

  if (saveToastTimeoutId) {
    window.clearTimeout(saveToastTimeoutId);
  }

  saveToastTimeoutId = window.setTimeout(() => {
    saveToast.classList.remove("visible");
    saveToast.setAttribute("aria-hidden", "true");
  }, 1600);
}

function startCountdown() {
  if (countdownIntervalId) {
    window.clearInterval(countdownIntervalId);
  }

  updateCountdownFromForm();
  countdownIntervalId = window.setInterval(updateCountdownFromForm, 1000);
}

function updateCountdownFromForm() {
  const bedtime = bedtimeInput.value;
  const routineActions = collectRoutineActions();

  if (!bedtime) {
    renderCountdownIdle("Add your bedtime and routine to start the countdown.");
    return;
  }

  const invalidAction = routineActions.find((action) => !isDraftRoutineActionUsable(action));

  if (invalidAction) {
    renderCountdownIdle("Add names and times for the routine actions you want included.");
    return;
  }

  const totalRoutineMinutes = routineActions.reduce((sum, action) => {
    return action.selected ? sum + action.minutes : sum;
  }, 0);
  const bedtimeDate = getNextBedtimeDate(bedtime, new Date());
  const cutoffDate = new Date(bedtimeDate.getTime() - totalRoutineMinutes * 60 * 1000);
  const millisecondsLeft = cutoffDate.getTime() - Date.now();
  const millisecondsUntilBed = bedtimeDate.getTime() - Date.now();

  renderCountdown(millisecondsLeft, bedtimeDate, totalRoutineMinutes, millisecondsUntilBed);
}

function renderCountdown(millisecondsLeft, bedtimeDate, totalRoutineMinutes, millisecondsUntilBed) {
  const totalSecondsLeft = Math.floor(millisecondsLeft / 1000);
  const bedtimeLabel = formatClockTime(bedtimeDate);
  const routineLabel = totalRoutineMinutes === 1 ? "1 min" : `${totalRoutineMinutes} min`;
  const usableShare = getUsableShare(millisecondsLeft, millisecondsUntilBed);

  if (millisecondsLeft <= 0) {
    countdownDisplay.textContent = "Time's up";
    countdownDetail.textContent = `Bedtime is ${bedtimeLabel}. Your ${routineLabel} routine should already be starting.`;
    setCountdownProgress(0);
    setCountdownTone("countdown-expired");
    return;
  }

  countdownDisplay.textContent = formatDuration(totalSecondsLeft);
  countdownDetail.textContent = `Bedtime ${bedtimeLabel}. Routine buffer: ${routineLabel}.`;
  setCountdownProgress(usableShare);

  if (millisecondsLeft <= 15 * 60 * 1000) {
    setCountdownTone("countdown-urgent");
    return;
  }

  if (millisecondsLeft <= 60 * 60 * 1000) {
    setCountdownTone("countdown-warning");
    return;
  }

  setCountdownTone("countdown-safe");
}

function renderCountdownIdle(message) {
  countdownDisplay.textContent = "--:--:--";
  countdownDetail.textContent = message;
  setCountdownProgress(0);
  setCountdownTone("countdown-idle");
}

function setCountdownTone(toneClass) {
  countdownCard.className = `countdown-card ${toneClass}`;
}

function isDraftRoutineActionUsable(action) {
  return Boolean(action.name) && Number.isFinite(action.minutes) && action.minutes >= 0;
}

function getNextBedtimeDate(timeString, now) {
  const [hoursText, minutesText] = timeString.split(":");
  const bedtime = new Date(now);
  bedtime.setHours(Number.parseInt(hoursText, 10), Number.parseInt(minutesText, 10), 0, 0);

  if (bedtime.getTime() <= now.getTime()) {
    bedtime.setDate(bedtime.getDate() + 1);
  }

  return bedtime;
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatClockTime(date) {
  return new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function setCountdownProgress(progress) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const offset = countdownRingCircumference * (1 - clampedProgress);
  countdownRingProgress.style.strokeDashoffset = String(offset);
}

function getUsableShare(millisecondsLeft, millisecondsUntilBed) {
  if (millisecondsLeft <= 0 || millisecondsUntilBed <= 0) {
    return 0;
  }

  return millisecondsLeft / millisecondsUntilBed;
}

function setActiveTab(tabName) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  document.querySelector(".hero").hidden = tabName !== "countdown";
  clearStatus();

  tabPanels.forEach((panel) => {
    const isActive = panel.dataset.panel === tabName;
    panel.hidden = !isActive;
    panel.classList.toggle("active", isActive);
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === "dark" ? "dark" : "light";
}

function getStoredTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function renderTodoItems(items) {
  todoList.replaceChildren();

  items.forEach((item, index) => {
    todoList.append(createTodoListItem(item, index, items.length));
  });

  todoEmpty.hidden = items.length > 0;
}

function createTodoListItem(item, index, totalItems) {
  const listItem = document.createElement("li");
  listItem.className = "todo-item";

  if (item.done) {
    listItem.classList.add("done");
  }

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "todo-checkbox";
  checkbox.checked = Boolean(item.done);
  checkbox.dataset.todoId = item.id;
  checkbox.setAttribute("aria-label", `Mark ${item.text} complete`);

  const text = document.createElement("span");
  text.className = "todo-text";
  text.textContent = item.text;

  const minutes = document.createElement("span");
  minutes.className = "todo-minutes";
  minutes.textContent = `${item.minutes} min`;

  const actions = document.createElement("div");
  actions.className = "todo-actions";

  const moveUpButton = document.createElement("button");
  moveUpButton.type = "button";
  moveUpButton.className = "move-button";
  moveUpButton.textContent = "↑";
  moveUpButton.dataset.action = "move-todo";
  moveUpButton.dataset.direction = "up";
  moveUpButton.dataset.todoId = item.id;
  moveUpButton.setAttribute("aria-label", `Move ${item.text} up`);
  moveUpButton.disabled = index === 0;

  const moveDownButton = document.createElement("button");
  moveDownButton.type = "button";
  moveDownButton.className = "move-button";
  moveDownButton.textContent = "↓";
  moveDownButton.dataset.action = "move-todo";
  moveDownButton.dataset.direction = "down";
  moveDownButton.dataset.todoId = item.id;
  moveDownButton.setAttribute("aria-label", `Move ${item.text} down`);
  moveDownButton.disabled = index === totalItems - 1;

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-button";
  removeButton.textContent = "×";
  removeButton.dataset.action = "remove-todo";
  removeButton.dataset.todoId = item.id;
  removeButton.setAttribute("aria-label", `Remove ${item.text}`);

  actions.append(moveUpButton, moveDownButton, removeButton);
  listItem.append(checkbox, text, minutes, actions);
  return listItem;
}

function clearStatus() {
  if (statusMessageTimeoutId) {
    window.clearTimeout(statusMessageTimeoutId);
    statusMessageTimeoutId = null;
  }

  statusMessage.textContent = "";
  statusMessage.className = "status-message";
}

function updateTodoFitEstimate(todoItems = null) {
  const items = todoItems ?? getCurrentTodoItemsFromDom();
  const bedtime = bedtimeInput.value;
  const routineActions = collectRoutineActions();

  todoFitCard.className = "todo-fit-card";

  if (!bedtime || routineActions.some((action) => !isDraftRoutineActionUsable(action))) {
    todoFitAnswer.textContent = "Set bedtime first";
    todoFitDetail.textContent = "We will compare your unfinished task time against your remaining usable time.";
    return;
  }

  const totalRoutineMinutes = routineActions.reduce((sum, action) => {
    return action.selected ? sum + action.minutes : sum;
  }, 0);
  const bedtimeDate = getNextBedtimeDate(bedtime, new Date());
  const cutoffDate = new Date(bedtimeDate.getTime() - totalRoutineMinutes * 60 * 1000);
  const remainingMinutes = Math.max(0, Math.floor((cutoffDate.getTime() - Date.now()) / 60000));
  const todoMinutes = items.reduce((sum, item) => {
    if (item.done) {
      return sum;
    }

    return sum + (Number.isFinite(item.minutes) ? item.minutes : 0);
  }, 0);

  if (todoMinutes === 0) {
    todoFitAnswer.textContent = "Yes";
    todoFitDetail.textContent = `You have ${remainingMinutes} min left and no unfinished tasks right now.`;
    todoFitCard.classList.add("fits");
    return;
  }

  const difference = remainingMinutes - todoMinutes;

  if (difference >= 15) {
    todoFitAnswer.textContent = "Yes";
    todoFitDetail.textContent = `${todoMinutes} min of unfinished tasks fits inside ${remainingMinutes} min left.`;
    todoFitCard.classList.add("fits");
    return;
  }

  if (difference >= 0) {
    todoFitAnswer.textContent = "Maybe";
    todoFitDetail.textContent = `${todoMinutes} min of tasks fits, but with only ${difference} min of buffer.`;
    todoFitCard.classList.add("tight");
    return;
  }

  if (difference >= -10) {
    todoFitAnswer.textContent = "Maybe";
    todoFitDetail.textContent = `You are only over by ${Math.abs(difference)} min, so this is still close.`;
    todoFitCard.classList.add("tight");
    return;
  }

  todoFitAnswer.textContent = "No";
  todoFitDetail.textContent = `You are over by ${Math.abs(difference)} min: ${todoMinutes} min of tasks vs ${remainingMinutes} min left.`;
  todoFitCard.classList.add("over");
}

function getCurrentTodoItemsFromDom() {
  return [...todoList.querySelectorAll(".todo-item")].map((item) => {
    const checkbox = item.querySelector(".todo-checkbox");
    const text = item.querySelector(".todo-text");
    const minutes = item.querySelector(".todo-minutes");

    return {
      done: checkbox.checked,
      text: text.textContent,
      minutes: Number.parseInt(minutes.textContent, 10)
    };
  });
}

function sortTodoItemsByMinutes(items, direction) {
  const multiplier = direction === "desc" ? -1 : 1;

  return [...items].sort((left, right) => {
    return (left.minutes - right.minutes) * multiplier;
  });
}

function moveTodoItem(items, todoId, direction) {
  const nextItems = [...items];
  const index = nextItems.findIndex((item) => item.id === todoId);

  if (index === -1) {
    return nextItems;
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= nextItems.length) {
    return nextItems;
  }

  const [item] = nextItems.splice(index, 1);
  nextItems.splice(targetIndex, 0, item);
  return nextItems;
}
