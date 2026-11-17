# V-SHAPE · Quality Upgrade — verification checklist

Branch: `work/vshape-quality-upgrade-20261117`. Production `main` must remain unchanged until approval.

## Implemented on this branch
- Export existing JSON data automatically before applying a selected restore.
- Revert in-memory state and suppress success screen if a set or completed workout cannot be saved.
- Add read-only statistics for sessions, sets, total load volume, A/B/C frequency and maximum recorded load per exercise.

## Manual acceptance tests (NOT yet executed)
1. Create a workout in an isolated browser profile, record a set, reload and confirm the active set count and timer.
2. Complete a workout and confirm it appears exactly once in the diary and statistics.
3. Simulate localStorage quota/security errors; confirm no success screen appears and active workout remains available in memory.
4. Import a valid JSON backup; confirm a pre-restore JSON download and correct restored history.
5. Import malformed JSON; confirm no data is overwritten.
6. Inspect statistics with an empty diary, zero-kg exercises, decimal weights and several months.
7. Confirm Spotify authentication and playback, warm-up and rest timers, splash timing, icons, offline loading, and Android standalone mode remain unchanged.
8. Verify no changes to main or GitHub Pages until a release is approved.

## Next implementation work
- Automated persistence and import tests using a browser harness.
- Improved active-workout ergonomics, especially one-handed use and clear last-performance display.
- More detailed per-exercise trends and weekly overview, using existing records.
- Offline and cache update regression tests.
- Pixel 10 Pro XL physical-device verification before production release.
