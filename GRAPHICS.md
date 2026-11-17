# V-SHAPE · Definitive System Ascension splash

The active HTML introduction now uses only `splash-system-ascension.jpg`, copied
byte-for-byte from the owner's attachment `145227.png` on 17 November 2026.
The attachment contains JPEG data despite its `.png` name. It is installed under
the correct extension without decoding/re-encoding, redrawing or changing pixels.

SHA-256: `87435779dd7d5ad0ac80ac8fa72f5f36beb6b3a44ce56e98a864adb9c2c9757a`.
Original dimensions: 864×1536. The whole image is centred with `object-fit: contain`
on black, without borders, stretching, tiling or cropped content. On taller Pixel
viewports the unused area stays black; filling that area would require cropping
or changing the supplied artwork. The old artwork is no longer preloaded or
referenced by the active intro or current worker cache.

## Behavior preserved

There is one HTML introduction. Its existing 2500 ms hold and 400 ms fade, reduced
motion behavior, independent error/deadline safeguards and quick-access rules
are unchanged. It can appear with a saved active workout; recovery deadlines
continue to run. OAuth returns, short foreground returns and urgent recovery
access still bypass it as before.

Android/Chrome control the preceding native launch screen. This website update
replaces the image in the existing HTML introduction only.

All Home icon files, favicons and `manifest.webmanifest` remain byte-identical.
The complete workout/Spotify application script and the app CSS are unchanged.
No workout, backup, diary, progression, timer or Spotify code is modified.
Only the intro image URL/dimensions and the worker asset cache version change.
The new cache still retires only obsolete V-SHAPE asset caches; local workout
and Spotify storage and other applications' caches are untouched.

## Verification

`python scripts/verify-definitive-splash.py` checks the attachment hash, image
format/dimensions, icon and manifest identity, unchanged app script/CSS, intro
behavior/timing, syntax and the presence of one introduction.

`node --test tests/graphics.cjs` checks launch, data and cache safeguards.
The isolated-branch workflow runs the actual Chromium mobile checks in
`tests/mobile-graphics.cjs`, including 448×998, 432×960, 360×800 and 960×432
viewports, original image dimensions, image count, uncropped layout, timing,
recovery, OAuth, reduced motion, image failure and offline loading. Its actual
results and screenshots are recorded under `verification/`.

Only synthetic local browser data is used. This is mobile browser emulation,
not a physical Pixel or authenticated Spotify Premium session. The PWA has no
new runtime dependencies, AI APIs, subscriptions or paid services.

Recovery branch: `restore/vshape-before-definitive-splash-20261117`.
Baseline commit: `af21e620072d867b275acabb21a8f186299d4952`.

Reload the updated site and reopen the installed PWA to receive the asset/cache
update. Do not delete site data to refresh graphics.
