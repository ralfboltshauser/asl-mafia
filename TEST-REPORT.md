# ASL Mafia — historical end-to-end test report

This report covers an earlier deployment. Later updates added passive village nights, guided audio, public voting, and in-person voting. The current rules suite has 30 tests; in-person voting was also verified in Chromium, WebKit, and an isolated live room.

Date: 2026-09-21
Live target: https://asl-mafia.ralfboltshauser.com
Final deployment: dpl_6pDu1hEjN8Ku25e7yMTepjk2UxVf

Result: all executed checks pass after fixing two recovery bugs. No blocking gameplay failure was found in the tested scenarios.

| Suite | Execution | Result |
| --- | --- | --- |
| Rules and privacy | 10 Node tests | Pass |
| Complete five-player game | Independent Chromium and WebKit browser contexts against the real production API | Pass: create, join, configure, deal, ready, night actions, angel protection, sheriff result, reload, vote, town victory, replay |
| Angel configuration matrix | Real production API; 12 combinations of informed/blind × every/once/alternate × use/success accounting | Pass: three nights per configuration, failed/successful saves, cooldowns, ability exhaustion, private results, abstentions, town victory |
| Mafia victory | Real production API | Pass: two mafia, special roles disabled, day/night elimination, parity, final role reveal, replay |
| Edge cases and privacy | Real production API | Pass: night ties, locked choices, dead creator advancing phases, late join rejection, forbidden settings changes, invalid targets, unauthorized seats, minimum/capacity limits, duplicate names, removal/replacement |
| Simultaneous play | Real production API with 7 players and then 12 players | Pass: concurrent joins, readiness, and night submissions; no lost actions |
| Recovery | Chromium and WebKit, real production API, browser network disconnected deliberately | All five recovery scenarios pass |
| Mobile layout | WebKit, production frontend with explicitly mocked 12-player states | Pass at 320×568, 375×667, 390×844, 430×932, and 844×390: long names, touch targets, 16px inputs, action bar placement, live-update scroll/disclosure stability, role reveal, voting, night choices |

The live API scenario suite reported 14 scenarios and 2,949 checked responses/state assertions. These are checks, not 2,949 independent test cases. The layout fixtures are not presented as real multiplayer sessions; the separate browser game and API suites exercise the actual backend.

## Bugs found and fixed

1. **Resume disappeared after changing entry tabs.** Leaving the game screen created a temporary Resume button that a subsequent render removed. Resume is now part of the entry-screen rendering while a saved seat is paused. Regression tested through the actual browser flow.
2. **Removed or missing seats retried forever.** Permanent 401/404 responses were treated as transient connection failures. The app now clears the invalid saved seat, explains the error, and returns to an entry screen that can create/join another game. Ordinary network failures still reconnect. Responses from an obsolete seat are ignored.

After deploying the fixes, all five recovery cases passed in both Chromium and WebKit. A complete WebKit multiplayer game and the five mobile-layout cases passed again on the final deployment. Server rules were unchanged by these fixes.

## Recovery scenarios

- Failed join preserves typed name/code; correcting the code joins successfully.
- Leaving the screen, changing entry tabs, and resuming returns to the same seat.
- A removed seat returns to a usable entry screen instead of retrying indefinitely.
- A missing saved room clears its stale token and permits creating a new game.
- Disconnecting before submitting a sheriff choice preserves the selection, allows retry, completes the night after reconnect, and keeps the private result concealed after reload.

## Limits of verification

- Browser sessions simulate players; no physical iPhone/Android device was used.
- Actual speaker output and the operating system’s native share sheet were not exercised.
- The real 24-hour expiry period was not waited out. Missing-room recovery was tested, and the same 404 recovery path handles an expired room.
- This is functional testing, not a prolonged load or security audit.
- Current intentional MVP behavior: every living player must submit to finish a phase. A disconnected player must reconnect using the same browser. The room creator must remain available to open voting and the next night, even after elimination; there is no creator takeover or forced timeout.

## Reproduce

From the repository directory:

```sh
npm test
TEST_URL=https://asl-mafia.ralfboltshauser.com node tests/browser.mjs
TEST_URL=https://asl-mafia.ralfboltshauser.com BROWSER=webkit ANGEL_VARIANT=1 node tests/browser.mjs
TEST_URL=https://asl-mafia.ralfboltshauser.com node tests/live-scenarios.mjs
TEST_URL=https://asl-mafia.ralfboltshauser.com PLAYERS=12 node tests/concurrent.mjs
TEST_URL=https://asl-mafia.ralfboltshauser.com node tests/recovery.mjs
TEST_URL=https://asl-mafia.ralfboltshauser.com BROWSER=webkit node tests/recovery.mjs
TEST_URL=https://asl-mafia.ralfboltshauser.com BROWSER=webkit node tests/mobile.mjs
```

These commands create isolated test rooms; they do not enter or modify existing user games.
