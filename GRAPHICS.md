# V-SHAPE · Original graphics on Android

Original artwork comes from the owner's supplied installation package.
The original `icon-192.png`, `icon-512.png` and
`splash-1080x2400.jpg` remain byte-identical.

## Android icon

The previous maskable icon put the artwork in only 280 of 512 pixels.
`scripts/resize-original-icon.py` resizes the supplied original PNG uniformly,
centres one complete copy on black, and creates versioned maskable PNGs at
192 and 512 pixels. It chooses a larger size using the actual silver artwork
geometry and verifies that the silver V and highlights stay inside Android's
central 40%-radius safe circle. It does not crop, redraw, tile or stretch the
source image. Android controls the final outside mask, including peripheral glow.

The new asset URLs trigger a manifest icon update. Home keeps the short name
`V-SHAPE`; the existing app URL, scope, standalone mode and identity are retained.

## HTML introduction

The full character/barbell artwork is shown as one image, centred on black with
`object-fit: contain`. No extra border or repeated background image is added.
Its original purple outline is part of the supplied artwork and is preserved.

The image stays visible for 2500 ms after loading, followed by a 400 ms fade
and a 20 ms cleanup allowance. Reduced motion skips the fade. Image errors,
interaction, hiding the app, and independent deadlines close the introduction.
A late or failed image never leaves a persistent black overlay.

An active saved workout no longer suppresses the introduction. It also appears
on an ordinary foreground return after at least 30 seconds away. Immediate
access takes priority for:
- Spotify OAuth callbacks, browser history/BFCache restoration;
- foreground returns within 30 seconds, or a focused input on return;
- recovery/warm-up timers already expired or due within 2900 ms;
- explicit `?resume=1` or `?quick=1` links;
- user interaction, hidden pages or inaccessible/invalid saved state.

The launch code only reads workout storage; it never changes it or pauses timers.
The complete workout/Spotify application script remains byte-identical to
`36c19da2459d65367edccbed0af06a937fde947d`. Recovery still uses its saved absolute
deadline. Backup/import formats and the eight-week program are unchanged.

Android/Chrome generate the earlier native splash from the manifest. The website
cannot replace that OS-controlled screen with the full character image.

## Verification and recovery

Run the dependency-free logic checks with `node --test tests/graphics.cjs`.
The isolated-branch GitHub Actions workflow generates the exact resized images,
checks their geometry/source hashes, runs the logic checks and Chromium mobile
tests, and records actual results and screenshots under `verification/`.
Pillow and Playwright are development-only tooling; the PWA has no new runtime
dependencies, paid services or AI APIs.

Mobile checks cover 432×960, 360×800 and 960×432 viewports, active recovery and
training, timing, one uncropped original image, interaction, immediate/OAuth
returns, reduced motion, image failure, offline mode and unchanged synthetic
workout data. Authenticated Spotify playback and physical Pixel installation
are outside those browser tests.

Recovery branch: `restore/vshape-before-pixel-fix-20261116`.
Pre-change commit: `36c19da2459d65367edccbed0af06a937fde947d`.

For an installed Pixel app, reload the updated site in Chrome and reopen the PWA.
Accept the icon update when Chrome offers it. Do not clear site data to refresh
graphics. Export a JSON backup before considering removal/reinstallation.
