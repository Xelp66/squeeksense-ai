# SqueekSense AI 🐹 — Learning Lab + Prediction Arena

squeekchain-project: f3ef600b-84e5-4a1a-94a1-b651488d0577

**Live app:** https://squeeksense.xyz  
**Learning Lab:** https://squeeksense.xyz/#learning-lab  
**Player Arena:** https://squeeksense.xyz/#arena  
**Instant Replay:** https://squeeksense.xyz/#practice-replay

An independent, open-source Squeekchain Sepolia project that uses real wheel measurements to build a testable prediction game and an adaptive, scientifically transparent learning engine.

## 1 — Learning Lab

The learning model uses **chronological online logistic regression** (not an LLM): hour/day cyclic features, observed previous activity, recent work intensity and activity streaks. It predicts **activity in the next 30-minute measurement window**, not sleep or health. The first 75% of complete chronological examples train the initial model; the later 25% remain untouched for evaluation. Baseline and model both score the same withheld examples.

When **new** labelled windows arrive, the model first records whether its old prediction was correct, then updates its weights. It saves trained-through timestamps to avoid training the same observations on every refresh. We show the real sample count, holdout accuracy, Brier score, baseline comparison and post-deployment test-then-learn record. Improvements are measured, not promised. No demo accuracy is invented.

- Server-side implementation: `api/learning.js` with private model snapshots in Vercel Blob.
- Browser fallback: `browser-learning.js`, with persistent **per-browser** model state in localStorage.
- **Important current constraint:** Requests from Vercel egress currently face a Cloudflare challenge from `api.squeekchain.com`. On-device learning can use Squeekchain's documented browser CORS access, but is **not** a globally shared model while server access is blocked.

## 2 — Named-player Prediction Arena

Users create a unique public handle plus password. The password is salted and hashed with Node's scrypt; private account data and server-locked rounds are stored in a private Vercel Blob store. Sessions are HMAC-signed and expire after 30 days. There is no email, wallet connection or password recovery yet.

Players can enter **any whole number of minutes from 5 through 1440**, not fixed 30/60/120 presets. The question rotates between:

1. Whether wheel movement will be observed (yes/no).
2. Number of device **passage segments** beginning in the chosen window.
3. Duration of the first completed measured passage segment (seconds); not necessarily a full biological running session.
4. Number of fully observed active 30-minute intervals (for games with at least one full interval).

The server locks the answer before the next time boundary and *attempts* to verify the result from public Squeekchain history. Exact counts use signed device segment evidence where sufficient, or complete historical half-hour buckets for aggregate questions. Results are marked **unverified** rather than fabricated when readings or sufficient coverage are missing.

- Backend: `api/arena.js`, `api/_lib.js`.
- Identity and match data: Vercel **private** Blob storage.
- Leaderboard: derived from immutable server-recorded verified outcomes (up to the latest 500 results), not user-entered scores.
- **Known limitation:** Vercel's outbound requests to the official Squeekchain API currently encounter upstream bot protection. Live round locking and player accounts can be available while score settlement remains pending until Squeekchain allows our server to read the official API; never call these pending games verified. The app explicitly displays this status.

## 3 — Historical Replay (play immediately)

An instant, fully observable game using the browser's direct API access. Visitors need **no account**. They choose 1–24 complete 30-minute windows (30–720 minutes), then receive a rotating question:

- Any movement in the window?
- How many active 30-minute buckets?
- Which half-hour had the first activity?
- Was measured work higher than the previous equal-length interval?

Only complete historical observations can become a puzzle. The user sees previous data, not the hidden outcome. The baseline is computed from **past data only** to avoid look-ahead. After guessing, the correct recorded answer appears and local practice points update. **Replay points do not count toward the server leaderboard.** Files: `replay.js` and `lab.css`.

## 4 — Honest signal visualization and API health

A separate Signal Center displays device **RUNNING**, **IDLE / wheel still**, or **STALE / no data**, plus last observation time, provenance, historical-statistics availability and device passage feed status. It uses independent `/status`, `/measurement/stats?range=7d` and `/measurement/runs?limit=25` checks, never an unsupported query parameter.

The API measures the **wheel**, not feeding, sleeping or falls. 🥕/💤/⚠️ can only be logged as **unverified user observations** in the browser, never inferred as verified facts or fed into the ML labels.

The original dashboard remains in the project for telemetry, historical heatmaps and SqueekCore block progress.

## Official API

- `GET https://api.squeekchain.com/v1/status` — live device telemetry and pipeline status.
- `GET https://api.squeekchain.com/v1/measurement/runs?limit=100` — device-signed passage segments, timestamps and pagination.
- `GET https://api.squeekchain.com/v1/measurement/stats?range=30d` — 30-minute aggregate history. Days start at **12:00 UTC**, and missing/partial buckets are not definite quiet periods.
- `GET https://api.squeekchain.com/v1/core` — separate settled chain state.

Reference: https://docs.squeekchain.com/developers/api/

## Deployment and limitations

Root `index.html` is static; `lab.js`, `browser-learning.js`, `replay.js` provide the interface. Vercel Node Functions under `api/` use `@vercel/blob` (private storage credentials and `ARENA_SESSION_SECRET` are server environment variables and **must never be committed**).

To run the static interface locally:

```bash
npm install
npx serve .
```

Without Vercel deployment and server environment variables, account APIs will not work; the browser learning and replay features can still use the direct public API where CORS and upstream access permit. Vercel Blob storage has usage limits and may have charges above included quotas. No payment, staking, NFT transfer, wallet connection or real-money wager is implemented.

Privacy: a username is visible in the public leaderboard. The user's password is hashed in private storage, and 30-day session tokens are saved on the user's browser. Personal manual observations and browser-training snapshots remain local. A backup/recovery flow, consent notices and more robust abuse protection are future improvements.

## Attribution

Independent community experiment, **not affiliated with Squeekchain**. Source activity may be hardware, simulated, replay or derived. A wheel-not-moving event must not be described as biologically verified sleep or eating.

MIT License — see [LICENSE](LICENSE).
