const DEFAULT_SETTINGS = {
  bedtime: "",
  routineActions: [
    { name: "Get ready", minutes: 45 }
  ],
  todoItems: [],
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
const countdownPercent = document.querySelector("#countdown-percent");
const countdownRingProgress = document.querySelector("#countdown-ring-progress");
const todoForm = document.querySelector("#todo-form");
const todoInput = document.querySelector("#todo-input");
const todoMinutesInput = document.querySelector("#todo-minutes");
const todoList = document.querySelector("#todo-list");
const todoEmpty = document.querySelector("#todo-empty");
const todoFitCard = document.querySelector("#todo-fit-card");
const todoFitAnswer = document.querySelector("#todo-fit-answer");
const todoFitDetail = document.querySelector("#todo-fit-detail");
const tabButtons = [...document.querySelectorAll(".tab-button")];
const tabPanels = [...document.querySelectorAll(".tab-panel")];

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
  const removeButton = event.target.closest("[data-action='remove-todo']");

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

bedtimeInput.addEventListener("input", updateCountdownFromForm);
tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveTab(button.dataset.tab);
  });
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
      minutes: Number.isFinite(action.minutes) ? action.minutes : 0
    }));
  }

  if (Number.isFinite(settings.routineMinutes)) {
    return [
      {
        name: "Get ready",
        minutes: settings.routineMinutes
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

  row.append(nameInput, minutesInput, removeButton);
  return row;
}

function collectRoutineActions() {
  return [...actionsList.querySelectorAll(".action-row")].map((row) => {
    const name = row.querySelector(".action-name").value.trim();
    const minutes = Number.parseInt(row.querySelector(".action-minutes").value, 10);

    return { name, minutes };
  });
}

function updateRoutineTotal() {
  const total = collectRoutineActions().reduce((sum, action) => {
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
    minutes: 5
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
    renderCountdownIdle("Finish each routine action to see your real usable time.");
    return;
  }

  const totalRoutineMinutes = routineActions.reduce((sum, action) => sum + action.minutes, 0);
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
    countdownPercent.textContent = "0% usable";
    countdownDetail.textContent = `Bedtime is ${bedtimeLabel}. Your ${routineLabel} routine should already be starting.`;
    setCountdownProgress(0);
    setCountdownTone("countdown-expired");
    return;
  }

  countdownDisplay.textContent = formatDuration(totalSecondsLeft);
  countdownPercent.textContent = `${Math.round(usableShare * 100)}% usable`;
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
  countdownPercent.textContent = "0% usable";
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

function renderTodoItems(items) {
  todoList.replaceChildren();

  items.forEach((item) => {
    todoList.append(createTodoListItem(item));
  });

  todoEmpty.hidden = items.length > 0;
}

function createTodoListItem(item) {
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

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "remove-button";
  removeButton.textContent = "×";
  removeButton.dataset.action = "remove-todo";
  removeButton.dataset.todoId = item.id;
  removeButton.setAttribute("aria-label", `Remove ${item.text}`);

  listItem.append(checkbox, text, minutes, removeButton);
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

  const totalRoutineMinutes = routineActions.reduce((sum, action) => sum + action.minutes, 0);
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
