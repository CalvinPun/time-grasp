# Time Grasp

Time Grasp is a Chrome extension that helps you see how much usable time you actually have left before bed.

Instead of only counting down to bedtime, it subtracts your selected night routine and shows the time you really have left to do things before you need to start winding down.

Made for a friend :)

## Logo
- Handmade in Figma

## What It Does

- Shows a live countdown for your usable time left
- Lets you set a bedtime with free text input or quick 10-minute suggestions
- Lets you build a routine out of multiple selectable actions
- Calculates a `Finish by` time based on `bedtime - selected routine time`
- Sends notifications at:
  - 30 minutes left
  - 5 minutes left
  - time's up
- Has custom alert sounds with:
  - soft alert for 30 minutes
  - medium alert for 5 minutes
  - final alert for time's up
- Includes a to-do list with estimated minutes per task
- Tells you whether your unfinished tasks still fit before bed
- Supports light mode and dark mode

## How It Works

Core idea:

`usable time left = bedtime - selected routine time - current time`

Examples:

- Bedtime: `11:00 PM`
- Selected routine time: `45 min`
- Current time: `8:30 PM`
- Usable time left: `1h 45m`

The countdown ring tracks the usable window, and once that window is over the popup shows `Time's Up`.

## Bedtime Input

The bedtime field supports:

- typed input like `10:30 PM`
- compact input like `1030pm`
- 24-hour input like `22:30`
- a clickable dropdown with 10-minute suggestions

Overnight times are handled too. For example, entering `3:30 AM` during the evening is treated as the next morning.

## Project Structure

```text
time-grasp/
├── alerts/
│   ├── soft-alert.mp3
│   ├── medium-alert.mp3
│   └── final-alert.mp3
├── public/
│   ├── time-grasp.png
│   ├── time-grasp-16.png
│   ├── time-grasp-32.png
│   ├── time-grasp-48.png
│   └── time-grasp-128.png
├── background.js
├── manifest.json
├── offscreen.html
├── offscreen.js
├── popup.css
├── popup.html
└── popup.js
```

## Installation

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select this project folder:
   `/Users/calvin/time-grasp/time-grasp`

## Development Notes

- This is a Manifest V3 extension
- Settings and to-do data are stored with `chrome.storage.sync`
- Notifications are scheduled with `chrome.alarms`
- Sound playback uses an offscreen document so alert audio can play outside the popup

## Current Version

`0.1.0`
