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

  void playAlertSound(message.sound)
    .then(() => sendResponse({ ok: true }))
    .catch((error) => sendResponse({ ok: false, error: String(error) }));

  return true;
});

async function playAlertSound(sound) {
  const filePath = ALERT_AUDIO[sound];

  if (!filePath) {
    throw new Error(`Unknown alert sound: ${sound}`);
  }

  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
  }

  activeAudio = new Audio(chrome.runtime.getURL(filePath));
  activeAudio.volume = 1;
  await activeAudio.play();
}
