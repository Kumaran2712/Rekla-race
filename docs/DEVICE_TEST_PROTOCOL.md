# M0 + M1 real-device test protocol

Required by gate 9 of the approval brief. Headless results do not count as device results.

## Devices

| Slot | Requirement | Browser |
| --- | --- | --- |
| A | iPhone 16 or newer — **confirmed: iPhone 16** | Safari (current iOS) |
| B | A flagship Android phone — **confirmed: Google Pixel 9** | Chrome (current) |

Chrome on Android hides the phone model from websites (user-agent reduction), and Safari never exposes the iPhone model, so the tester types the exact model into the panel. The report records OS, browser version, screen and GPU automatically.

## Before you start

1. Fully charge the phone, close other apps, and set screen brightness to about 70 %. Turn off Low Power Mode or Battery Saver, unless a step says otherwise.
2. Open the preview link with `?stats=1` added. The diagnostics panel appears top-left.
3. Type the exact model (for example "iPhone 16 Pro, 256 GB") into the panel's **Device model** box. The JSON report records the OS, browser, screen and GPU automatically.
4. After every scenario, tap **Copy report** and paste the JSON into our chat, with the scenario number. If copying fails, select the text box and copy it by hand.

## Scenarios

| # | What to do | What it measures |
| --- | --- | --- |
| 1 | Clear website data for the preview site (so no tier is remembered). Open the link. Wait for **Start race**. Copy the report. | Cold load time; the tier the warm-up benchmark picked |
| 2 | Add `&autoplay=1` to the link: the built-in perfect bot drives three pack races back to back. Do not touch the screen. Copy the report after the third finish. | Average FPS, p95 frame time, spikes, draw calls and triangles in real races |
| 3 | Play one **Kongu time trial** yourself. Copy the report. | Touch input and shout timing on real hardware |
| 4 | Soak: autoplay for 10 minutes without stopping (about 10 races). Copy the report. It contains a 5-second history, so first-minute and last-minute FPS show heat throttling. | Thermal behaviour |
| 5 | For each tier from `&tier=0` to `&tier=5`: open the link, start a race, take one screenshot at the first village stretch, and copy the report. | Visual quality and cost of every tier |
| 6 | Add `&leaktest=1`: the game runs 20 race / menu / breed-change cycles by itself and shows a pass or fail line in the panel. Copy the report. | Memory across repeated races (the JS heap is measured on Chrome; Safari does not expose it) |
| 7 | During a race, switch to another app for 10 s, then come back. The race must be paused, and **Continue** must give a 3-2-1 count. Then repeat with `&losecontext=1`, which simulates the phone dropping graphics; the game must recover. | Pause handling and graphics recovery |

## Pass criteria (from the approval brief)

- A stable 30 FPS on the lowest tier the device settles on (p95 frame time no more than about 36 ms), and 60 FPS where the device sustains it (p95 no more than about 18 ms).
- No growth in GPU geometry or texture counts across the 20 cycles.
- Pause, resume and graphics recovery all work.
- Visual quality is acceptable to you at the tier each phone settles on.

## Not claimed until done

Nothing about phone performance is claimed until these reports are in. The headless numbers in the completion report are labelled as software-rendering estimates.
