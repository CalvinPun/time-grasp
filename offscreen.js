const ALERT_AUDIO = {
  soft: "alerts/soft-alert.mp3",
  medium: "alerts/medium-alert.mp3",
  final: "alerts/final-alert.mp3"
};

let activeAudio = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "play-alert-sound") {
    return false;
  }

  void playAlertSound(message.sound, message.volume)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));

  return true;
});

async function playAlertSound(sound, volume) {
  const filePath = ALERT_AUDIO[sound];

  if (!filePath) {
    throw new Error(`Unknown alert sound: ${sound}`);
  }

  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
  }

  activeAudio = new Audio(chrome.runtime.getURL(filePath));
  activeAudio.volume = normalizeVolume(volume);
  await activeAudio.play();
}

function normalizeVolume(value) {
  if (!Number.isFinite(value)) {
    return 0.8;
  }

  return Math.min(1, Math.max(0, value / 100));
}
