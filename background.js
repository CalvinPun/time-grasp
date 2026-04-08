const SETTINGS_DEFAULTS = {
  bedtime: "",
  routineActions: [
    { name: "Get ready", minutes: 45, selected: true }
  ],
  notificationSound: true,
  notificationVolume: 80,
  notify30: true,
  notify5: true,
  notify0: true
};

const ALARM_KEYS = {
  thirty: "time-grasp:notify-30",
  five: "time-grasp:notify-5",
  zero: "time-grasp:notify-0"
};

const OFFSCREEN_PATH = "offscreen.html";
const ALERT_SOUNDS = {
  thirty: "soft",
  five: "medium",
  zero: "final",
  test: "final"
};

let lastNotificationResult = "No notification sent yet";

chrome.runtime.onInstalled.addListener(() => {
  void refreshNotificationAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  void refreshNotificationAlarms();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") {
    return;
  }

  if (
    changes.bedtime
    || changes.routineActions
    || changes.notificationSound
    || changes.notificationVolume
    || changes.notify30
    || changes.notify5
    || changes.notify0
  ) {
    void refreshNotificationAlarms();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "refresh-alarms") {
    void refreshNotificationAlarms()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));

    return true;
  }

  if (message?.type === "test-notification") {
    void sendNotification("Test notification", "Time Grasp notifications are working.", ALERT_SOUNDS.test)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));

    return true;
  }

  if (message?.type === "preview-sound") {
    void playAlertSound(message.sound || ALERT_SOUNDS.test, message.volume)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));

    return true;
  }

  if (message?.type === "get-alarm-status") {
    void getNotificationDebugStatus()
      .then((status) => sendResponse({ ok: true, status }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));

    return true;
  }

  return false;
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!Object.values(ALARM_KEYS).includes(alarm.name)) {
    return;
  }

  if (alarm.name === ALARM_KEYS.thirty) {
    void sendNotification("30 minutes left", "You have 30 minutes of usable time left.", ALERT_SOUNDS.thirty);
    return;
  }

  if (alarm.name === ALARM_KEYS.five) {
    void sendNotification("5 minutes left", "Wrap up now. Your usable time is almost gone.", ALERT_SOUNDS.five);
    return;
  }

  if (alarm.name === ALARM_KEYS.zero) {
    void sendNotification("Time's up", "Your usable time is over. It is time to start your night routine.", ALERT_SOUNDS.zero);
  }
});

async function refreshNotificationAlarms() {
  await clearNotificationAlarms();

  const settings = await chrome.storage.sync.get(SETTINGS_DEFAULTS);

  if (!settings.bedtime) {
    return;
  }

  const cutoffDate = getCutoffDate(settings, new Date());

  if (!cutoffDate) {
    return;
  }

  const alarmRequests = [
    {
      enabled: settings.notify30,
      name: ALARM_KEYS.thirty,
      when: new Date(cutoffDate.getTime() - 30 * 60 * 1000)
    },
    {
      enabled: settings.notify5,
      name: ALARM_KEYS.five,
      when: new Date(cutoffDate.getTime() - 5 * 60 * 1000)
    },
    {
      enabled: settings.notify0,
      name: ALARM_KEYS.zero,
      when: cutoffDate
    }
  ];

  const now = Date.now();

  for (const request of alarmRequests) {
    if (!request.enabled || request.when.getTime() <= now) {
      continue;
    }

    await chrome.alarms.create(request.name, { when: request.when.getTime() });
  }
}

async function clearNotificationAlarms() {
  await Promise.all(Object.values(ALARM_KEYS).map((name) => chrome.alarms.clear(name)));
}

function getCutoffDate(settings, now) {
  const bedtimeDate = getNextBedtimeDate(settings.bedtime, now);
  const selectedRoutineMinutes = getSelectedRoutineMinutes(settings);

  return new Date(bedtimeDate.getTime() - selectedRoutineMinutes * 60 * 1000);
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

function getSelectedRoutineMinutes(settings) {
  const routineActions = normalizeRoutineActions(settings);

  return routineActions.reduce((sum, action) => {
    if (!action.selected) {
      return sum;
    }

    return sum + action.minutes;
  }, 0);
}

function normalizeRoutineActions(settings) {
  if (Array.isArray(settings.routineActions) && settings.routineActions.length > 0) {
    return settings.routineActions
      .map((action) => ({
        minutes: Number.isFinite(action.minutes) ? action.minutes : 0,
        selected: "selected" in action ? Boolean(action.selected) : Boolean(action.done)
      }))
      .filter((action) => action.minutes >= 0);
  }

  if (Number.isFinite(settings.routineMinutes)) {
    return [
      {
        minutes: settings.routineMinutes,
        selected: true
      }
    ];
  }

  return SETTINGS_DEFAULTS.routineActions;
}

async function sendNotification(title, message, sound) {
  try {
    const settings = await chrome.storage.sync.get(SETTINGS_DEFAULTS);
    const notificationId = await chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("public/time-grasp-128.png"),
      title,
      message,
      priority: 2,
      silent: !settings.notificationSound
    });

    if (settings.notificationSound) {
      await playAlertSound(sound, settings.notificationVolume);
    }

    lastNotificationResult = `Sent "${title}" as ${notificationId}`;
    return notificationId;
  } catch (error) {
    lastNotificationResult = `Failed to send "${title}": ${String(error)}`;
    throw error;
  }
}

async function playAlertSound(sound, volume) {
  if (!sound) {
    return;
  }

  await ensureOffscreenDocument();

  const response = await chrome.runtime.sendMessage({
    type: "play-alert-sound",
    sound,
    volume: normalizeNotificationVolume(volume)
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Unable to play alert sound.");
  }
}

function normalizeNotificationVolume(value) {
  if (!Number.isFinite(value)) {
    return SETTINGS_DEFAULTS.notificationVolume;
  }

  return Math.min(100, Math.max(0, Math.round(value)));
}

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_PATH);

  if (await hasOffscreenDocument(offscreenUrl)) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ["AUDIO_PLAYBACK"],
    justification: "Play alert sounds for countdown notifications."
  });
}

async function hasOffscreenDocument(offscreenUrl) {
  if (typeof chrome.runtime.getContexts !== "function") {
    return false;
  }

  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl]
  });

  return contexts.length > 0;
}

async function getNotificationDebugStatus() {
  const alarms = await chrome.alarms.getAll();
  const permissionLevel = await chrome.notifications.getPermissionLevel();

  return {
    permissionLevel,
    lastNotificationResult,
    alarms: alarms
      .filter((alarm) => Object.values(ALARM_KEYS).includes(alarm.name))
      .map((alarm) => ({
        name: alarm.name,
        scheduledFor: alarm.scheduledTime ?? null
      }))
  };
}
