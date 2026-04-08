const DEFAULT_SETTINGS = {
  bedtime: "",
  routineLabel: "",
  routineMinutes: 45,
  notify30: true,
  notify5: true,
  notify0: true
};

const form = document.querySelector("#settings-form");
const bedtimeInput = document.querySelector("#bedtime");
const routineLabelInput = document.querySelector("#routine-label");
const routineMinutesInput = document.querySelector("#routine-minutes");
const notify30Input = document.querySelector("#notify-30");
const notify5Input = document.querySelector("#notify-5");
const notify0Input = document.querySelector("#notify-0");
const statusMessage = document.querySelector("#status-message");

initialize();

async function initialize() {
  const settings = await loadSettings();
  applySettingsToForm(settings);
}

function loadSettings() {
  return chrome.storage.sync.get(DEFAULT_SETTINGS);
}

function applySettingsToForm(settings) {
  bedtimeInput.value = settings.bedtime;
  routineLabelInput.value = settings.routineLabel;
  routineMinutesInput.value = String(settings.routineMinutes);
  notify30Input.checked = settings.notify30;
  notify5Input.checked = settings.notify5;
  notify0Input.checked = settings.notify0;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const bedtime = bedtimeInput.value;
  const routineLabel = routineLabelInput.value.trim();
  const routineMinutes = Number.parseInt(routineMinutesInput.value, 10);

  if (!bedtime) {
    setStatus("Choose a bedtime first.");
    return;
  }

  if (Number.isNaN(routineMinutes) || routineMinutes < 0 || routineMinutes > 300) {
    setStatus("Routine duration must be between 0 and 300 minutes.");
    return;
  }

  const nextSettings = {
    bedtime,
    routineLabel,
    routineMinutes,
    notify30: notify30Input.checked,
    notify5: notify5Input.checked,
    notify0: notify0Input.checked
  };

  await chrome.storage.sync.set(nextSettings);
  setStatus("Settings saved.");
});

function setStatus(message) {
  statusMessage.textContent = message;
}
