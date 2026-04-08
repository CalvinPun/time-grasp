const DEFAULT_SETTINGS = {
  bedtime: "",
  routineLabel: "",
  routineActions: [
    { name: "Get ready", minutes: 45 }
  ],
  notify30: true,
  notify5: true,
  notify0: true
};

const form = document.querySelector("#settings-form");
const bedtimeInput = document.querySelector("#bedtime");
const routineLabelInput = document.querySelector("#routine-label");
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
const tabButtons = [...document.querySelectorAll(".tab-button")];
const tabPanels = [...document.querySelectorAll(".tab-panel")];

let saveToastTimeoutId = null;
let countdownIntervalId = null;

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
  routineLabelInput.value = settings.routineLabel;
  notify30Input.checked = settings.notify30;
  notify5Input.checked = settings.notify5;
  notify0Input.checked = settings.notify0;
  renderRoutineActions(normalizeRoutineActions(settings));
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const bedtime = bedtimeInput.value;
  const routineLabel = routineLabelInput.value.trim();
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
    setStatus("Each action needs a name and 0 to 300 minutes.", "error");
    return;
  }

  const nextSettings = {
    bedtime,
    routineLabel,
    routineActions,
    notify30: notify30Input.checked,
    notify5: notify5Input.checked,
    notify0: notify0Input.checked
  };

  await chrome.storage.sync.set(nextSettings);
  setStatus("Settings saved.", "success");
  showSaveToast();
  startCountdown();
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
});

bedtimeInput.addEventListener("input", updateCountdownFromForm);
tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveTab(button.dataset.tab);
  });
});

function setStatus(message, tone = "") {
  statusMessage.textContent = message;
  statusMessage.className = "status-message";

  if (tone) {
    statusMessage.classList.add(tone);
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
        name: settings.routineLabel || "Get ready",
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
  minutesInput.max = "300";
  minutesInput.step = "5";
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
    && action.minutes >= 0
    && action.minutes <= 300;
}

function createEmptyRoutineAction() {
  return {
    name: "",
    minutes: 5
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

  renderCountdown(millisecondsLeft, bedtimeDate, totalRoutineMinutes);
}

function renderCountdown(millisecondsLeft, bedtimeDate, totalRoutineMinutes) {
  const totalSecondsLeft = Math.floor(millisecondsLeft / 1000);
  const bedtimeLabel = formatClockTime(bedtimeDate);
  const routineLabel = totalRoutineMinutes === 1 ? "1 min" : `${totalRoutineMinutes} min`;

  if (millisecondsLeft <= 0) {
    countdownDisplay.textContent = "Time's up";
    countdownDetail.textContent = `Bedtime is ${bedtimeLabel}. Your ${routineLabel} routine should already be starting.`;
    setCountdownTone("countdown-expired");
    return;
  }

  countdownDisplay.textContent = formatDuration(totalSecondsLeft);
  countdownDetail.textContent = `Bedtime ${bedtimeLabel}. Routine buffer: ${routineLabel}.`;

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
  setCountdownTone("countdown-idle");
}

function setCountdownTone(toneClass) {
  countdownCard.className = `countdown-card ${toneClass}`;
}

function isDraftRoutineActionUsable(action) {
  return Boolean(action.name) && Number.isFinite(action.minutes) && action.minutes >= 0 && action.minutes <= 300;
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

function setActiveTab(tabName) {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  tabPanels.forEach((panel) => {
    const isActive = panel.dataset.panel === tabName;
    panel.hidden = !isActive;
    panel.classList.toggle("active", isActive);
  });
}
