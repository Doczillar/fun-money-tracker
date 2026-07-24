# Fun Money

A small, single-purpose app for tracking discretionary "fun money" spending
through the month - enter what you spend or add, watch a running total
update in real time, and start each month fresh (or roll over what's left).

**[Try it live →](https://doczillar.github.io/fun-money-tracker/)**

<!-- Replace with an actual screenshot or short GIF 
![Fun Money app screenshot](screenshot.png)

-->

## Install

### iOS

1. Open the live link in **Safari** - required; only Safari's "Add to
   Home Screen" creates a standalone app with its own protected storage
2. Tap the **Share** icon (square with an arrow) in the address bar
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add** in the top right

### Android

1. Open the live link in **Chrome**
2. Tap the **⋮** menu in the top right
3. Tap **Add to Home Screen** (some Chrome versions call this
   **Install app**)
4. Confirm

Once installed, always open the app from its home screen icon rather than
revisiting the link in the browser - it gets better storage protections
that way (see Data & Storage below).

## Tech Stack

- Plain HTML, CSS, and vanilla JavaScript - no frameworks, no build step
- A single `index.html` file contains the entire app, including the icon
  (embedded as a base64 image) and all styling and logic
- Data is stored locally on-device via the browser's `localStorage` -
  nothing is sent anywhere, because there's nothing to send it to
- Hosted for free on GitHub Pages, which just serves the static file at a
  public URL so Safari or Chrome can load and install it
- No backend to maintain - shipping an update means replacing
  `index.html` in this repo, and anyone with it installed gets the new
  version next time they open the app

## Features

- Set a base "fun money" amount for the month (editable anytime)
- Log entries one at a time as either a spend or an addition, with an
  optional short note
- Live running total in a circular gauge that visually drains as you
  spend, and flips to a warning color when funds run low
- At month's end, either roll the leftover balance (surplus or deficit)
  into the new month, or start fresh at the base amount - the rollover
  shows up as a real line item so the math is never hidden
- Tracks days remaining in the month, and flags in red if a new month has
  started but the budget hasn't been reset yet
- Export/import a JSON backup of your data via the share sheet or a file
  download

## Use Cases

Any recurring personal or household discretionary budget where you want
something faster than a spreadsheet and lighter than a full budgeting app -
entertainment money, a monthly "no questions asked" allowance, eating-out
budget, that kind of thing.

## Data & Storage

All data lives in the browser's local storage on that one device - no
account, no cloud sync, no server. That's good for privacy, but it means
the data is only as durable as the phone it's on: clearing site data, a
full device reset, or switching browsers will erase it. Back up
regularly via **Settings → Backup → Export**, and **Import** to restore.

<details>
<summary>Platform-specific details</summary>

### iOS (Safari)

- Home screen web apps are exempt from Safari's policy of deleting data
  after a week of not being opened - but they're **not** exempt from iOS
  clearing data if the device gets critically low on storage, or if you
  manually clear website data in Settings → Safari → Advanced
- A full device reset, restore from backup, or "erase all content" wipes
  it, same as any other app's local data

### Android (Chrome)

- Chrome shares storage between the regular browser and the installed
  app. Using "Clear browsing data" (or clearing Chrome's storage from
  Android Settings → Apps → Chrome → Storage) wipes it, as does
  uninstalling Chrome or factory-resetting the phone
- Chrome rarely clears site data automatically - it's almost always a
  manual clear or a device reset that causes loss, not the browser
  quietly evicting it in the background

### Both platforms

- Opening the link in a *different* browser (or a private/incognito
  window) shows a blank slate - storage doesn't carry over between
  browsers, even on the same phone
- The app requests "persistent storage" from the browser on load, which
  meaningfully reduces the odds of automatic cleanup - but no browser
  guarantees this forever, on any platform

</details>

## Limitations

- No sync between devices - each install keeps its own independent copy
  of the data
- Single-user only; not designed for a shared household budget viewed
  from multiple phones at once
- One single spending category - each entry is assumed to belong to your "fun money" budget category. 
- No native OS integrations (widgets, notifications, biometric lock) -
  it's a web app, not a platform-native one
