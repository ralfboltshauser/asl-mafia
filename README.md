# ASL Mafia

Tiny multiplayer Mafia host. Vanilla HTML/CSS/JS, a Node API, and Upstash Redis. Vercel hosts both the static app and API. Optional chimes and pre-generated ElevenLabs narration play only on the room creator’s device.

## Play

Create a room, share its invite link, and join with 5–12 players. The creator selects 1–5 mafia and optionally one sheriff and one angel. The town team must outnumber mafia at the start. Everyone checks their role and readies up.

Night actions are private and resolved together once every living player with an available night ability submits. The mafia’s plurality target is attacked (random tie-break); the angel protects one player, with self and repeat protection allowed. The creator can also let the angel see the mafia’s intended victim before choosing, and limit protection to once per game or require a rest night afterward. Limits can count on use or on a successful save. The angel may skip to preserve their power. The sheriff receives their investigation at dawn, even on the night they die. During the day, discuss in person and let the creator open voting. The creator chooses secret, public, or in-person day voting in the lobby. Secret is the default, including for rooms created before this setting existed. Public ballots show who voted for whom only after everyone submits; night actions always remain private. Voting visibility cannot change during a game. You may vote for yourself. Votes are final; ties or abstain winning eliminate nobody. All roles are revealed at game end.

## Run

`npm install` then `npm start` serves port 4187. Without Redis variables, rooms are saved in the ignored `.data` directory. Production requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

`npm test` checks role configuration, rules, authorization, privacy, and win conditions. Install browser engines with `npx playwright install chromium webkit` before running browser tests. `node tests/browser.mjs` runs a five-browser game against localhost. Set `TEST_URL` to test a deployment.

## Deliberate limits

- Players are physically together; no chat, accounts, or remote audio.
- Keep the same browser to reconnect. A private random seat token lives in localStorage; clearing browser data loses your seat.
- The creator must stay available to open voting and the next night, even if eliminated. No automatic takeover.
- No forced timeout: a missing player must reconnect when they have a required action; villagers and angels with unavailable powers never block the night.
- Room lifetime is 24 hours. Active clients poll every 2.5 seconds; hidden tabs pause polling. Redis compare-and-swap prevents simultaneous actions overwriting each other.
- Audio must be enabled by a tap on the creator’s phone. Keep the screen awake; visual instructions remain available.

## Brand

Logo and font assets sourced from https://www.agenticsystemslab.org/ at the user’s request. The game matches its near-black palette, Inter typography, and Geist Mono labels.

## Deployment

Deploy the repository with Vercel. Configure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` as server environment variables. The included `vercel.json` serves `public/` and the Node API.
Custom domain: https://asl-mafia.ralfboltshauser.com
Stripe Projects provisioned Upstash Redis (`rooms`, `asl-mafia`, eu-central-1, pay-as-you-go). Credentials remain in ignored files and Vercel server-only environment variables.

Night progress is anonymous so automatic villager readiness does not reveal roles. Named readiness remains available during role confirmation and day voting. A saved night that was waiting only on passive players settles atomically on the next authenticated state poll, preserving existing choices.


Night audio: the creator selects Sounds only or Voice + sounds in the header. This enables sequential mafia → sheriff → angel turns for future nights. Enabling during a night leaves that night unchanged. Each turn lasts at least 15 seconds and advances at least 3 seconds after its final choice; authenticated polling drives the clock. Configured special roles are still called when dead or resting, without announcing their status. Villagers never act. Disabling audio mutes the device; guided turns remain enabled. Keep the creator’s screen awake and use ↻ to resume/replay after interruption. Reload requires enabling audio again.

Narration is pre-generated ElevenLabs speech (two variants per cue, randomly chosen first, then alternating). Chimes are synthesized locally with Web Audio. No ElevenLabs key is deployed or needed at runtime. `scripts/generate-audio.py` reads `ELEVENLABS_API_KEY` from the environment (or `~/.env`) and caches generated files. `GUIDED=1 ANGEL_VARIANT=1 TEST_URL=http://127.0.0.1:4193 node tests/browser.mjs` exercises the real timed flow and decoded speech playback; add BROWSER=webkit for WebKit.

In-person day voting: choose “In-person voting” in the lobby’s Day voting setting. The creator opens the vote, records the group's selected living player (including themselves) or “Nobody eliminated,” then confirms the named result. The creator can still record results after elimination. Other players have no phone ballot. The server requires creator authorization, explicit confirmation, the correct phase/stage and voting mode, and a living target. Results record the method without fabricated tallies or ballots. Existing rooms and games retain their current mode; settings only change in the lobby. Test with `node tests/in-person.mjs` (optional `BROWSER=webkit` and `TEST_URL`).
