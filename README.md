# SqueekSense AI 🐹 — Learning Lab & Wheel Intelligence

squeekchain-project: f3ef600b-84e5-4a1a-94a1-b651488d0577

**Live app:** https://squeeksense.xyz  
**Learning Lab:** https://squeeksense.xyz/#learning-lab  
**Live Signal Center:** https://squeeksense.xyz/#signal-center
**Neural Garden design trailer (interactive demo):** https://squeeksense.xyz/neural-garden-preview.html

An independent, open-source Squeekchain Sepolia project that explores measured wheel activity with a transparent, adaptive prediction model, live device telemetry and historical visualizations.

## 1 — Learning Lab

The learning model uses **chronological online logistic regression** (not an LLM): hour/day cyclic features, observed previous activity, recent work intensity and activity streaks. It predicts **activity in the next 30-minute measurement window**, not sleep or health. The first 75% of complete chronological examples train the initial model; the later 25% remain untouched for evaluation. Baseline and model both score the same withheld examples.

When **new** labelled windows arrive, the model first records whether its old prediction was correct, then updates its weights. It saves trained-through timestamps to avoid training the same observations on every refresh. We show the real sample count, holdout accuracy, Brier score, baseline comparison and post-deployment test-then-learn record. Improvements are measured, not promised. No demo accuracy is invented.

- Server-side implementation: `api/learning.js` with private model snapshots in Vercel Blob.
- Browser fallback: `browser-learning.js`, with persistent **per-browser** model state in localStorage.
- **Important current constraint:** Requests from Vercel egress currently face a Cloudflare challenge from `api.squeekchain.com`. On-device learning can use Squeekchain's documented browser CORS access, but is **not** a globally shared model while server access is blocked.

## Neural Garden × Feature Brain — interactive visual edition

The Learning Lab now includes two responsive, interactive but **stationary** SVG scenes (no endlessly moving decorative animation):

- **Neural Garden:** Detailed botanical branches initially contain **zero leaves**. Exactly one realistically veined leaf appears per verified prediction result: **green = correct**, **amber = incorrect**. Wrong predictions do not remove leaves. Missing or pending results do not add leaves. The tree counts recorded outcomes rather than claiming model accuracy improved.
- **Feature Brain:** Ten interactive, keyboard-accessible nodes visualize the real *logistic regression input feature weights* (hour/day rhythms, recent movement and work intensity). It is a feature visualization, not a claim that we have trained a deep neural network.
- **Forecast Ledger:** Browser-local predictions are timestamped and frozen **before** the next UTC half-hour starts; only complete public Squeekchain measurement buckets can grade them. Pending, missing and expired-unverified intervals never count as wrong answers. Click result markers to see their stored outcomes.
- **Interactive design trailer:** `/neural-garden-preview.html` opens with a leafless tree. Visitors may play a short, finite, deliberately initiated simulated sequence, inspect model nodes and switch to the live Learning Lab. The trailer clearly labels its outcomes **simulated**.

Files: `neural-garden.js`, `neural-garden.css`, `neural-garden-preview.html`. Real prediction data comes from the unchanged browser-direct API client and `browser-learning.js`'s time-safe `predictForWindow` helper.

**Critical operational limitation:** Forecast logging and garden progression currently require at least one visitor browser running the page; this is **not** an always-on central service, and different devices have different local prediction histories. Continuous server-based tracking would require an approved Squeekchain server-to-server API path and persistent scheduler. No false background or global success metrics are claimed. The main Live Monitor API connection and Squeekchain verification meta tag are preserved.

## 2 — Current live modules

- **Learning Lab:** A chronological, incrementally updated activity prediction model, with holdout validation and a baseline comparison.
- **Live Signal Center:** Running versus wheel-still telemetry, source provenance, freshness, and optional locally saved personal annotations.
- **Live Monitor, AI Forecast, Activity Map and Block Radar:** Sensor readings, transparent historical estimates and Squeekchain state.
- **Connection diagnostics:** Clear distinction between browser API access, Vercel server egress, missing data and stale measurements.

The previous **You vs the Wheel / Prediction Arena** and **Can You Beat the Past? / Historical Replay** games have been **removed from the public interface** as we design a new game. Their client-side event handlers no longer run and Replay's script is not loaded. Older server-side game code and stored player records remain archived for possible future migration; no user records have been deliberately deleted.

## 3 — Honest signal visualization and API health

A separate Signal Center displays device **RUNNING**, **IDLE / wheel still**, or **STALE / no data**, plus last observation time, provenance, historical-statistics availability and device passage feed status. It uses independent `/status`, `/measurement/stats?range=7d` and `/measurement/runs?limit=25` checks, never an unsupported query parameter.

The API measures the **wheel**, not feeding, sleeping or falls. 🥕/💤/⚠️ can only be logged as **unverified user observations** in the browser, never inferred as verified facts or fed into the ML labels.

The original dashboard remains in the project for telemetry, historical heatmaps and SqueekCore block progress.

## Official API

- `GET https://api.squeekchain.com/v1/status` — live device telemetry and pipeline status.
- `GET https://api.squeekchain.com/v1/measurement/runs?limit=100` — device-signed passage segments, timestamps and pagination.
- `GET https://api.squeekchain.com/v1/measurement/stats?range=30d` — 30-minute aggregate history. Days start at **12:00 UTC**, and missing/partial buckets are not definite quiet periods.
- `GET https://api.squeekchain.com/v1/core` — separate settled chain state.

Reference: https://docs.squeekchain.com/developers/api/

## Live API connectivity (updated November 6, 2026)

Squeekchain's official API documents **public browser CORS reads** for `https://api.squeekchain.com/v1/*`. The application now uses **`squeek-api.js`** as its shared, browser-direct GET client for live status, statistics, run segments and Learning Lab, with path allowlisting, request deduplication, endpoint-specific TTLs, sensible 429/503 backoff, and explicit unavailable-data errors. It avoids arbitrary query parameters and conditional CORS preflights.

**Telemetry is not a synonym for backend availability:** the live UI uses `measurement.freshness`, `measurement.coreStatus` and API-generated time stamps to distinguish **RUNNING**, **IDLE (wheel still)**, **STALE** and **API UNREACHABLE**, rather than comparing signed device timestamps against possibly inaccurate visitor clocks. Stale data remains unknown, never biological sleep.

**Verified operational limitation:** on November 6, 2026, server-side requests from Vercel to the upstream API received **HTTP 403**, `cf-mitigated: challenge` from Cloudflare, even for `/v1/status`. The `/api/health` server endpoint classifies this as `upstream.state: "server-challenged"`. We do **not** bypass Cloudflare's protections with fake credentials or an untrusted proxy. Independent Arena settlement and a centrally shared training model remain dependent on the Squeekchain API operator allowing a supported server-to-server connection. In the meantime, on-device Learning Lab and Replay rely on the documented public browser API. Ask the Squeekchain team about an authorized server-side access route for `squeeksense.xyz` Vercel functions.

## In-app API connection diagnostics (November 7)

When `/v1/status` cannot be fetched, the live monitor now displays **NO FEED**, not a false `OFFLINE` hamster classification, and exposes a diagnostic panel underneath the status banner. The panel separately tests **browser-to-Squeekchain** and **Vercel-to-Squeekchain** connectivity, displays any saved *previously successful* status response clearly as an **ARCHIVED, not live** reading, and links to the exact official status JSON.

If the real upstream status JSON opens in another browser tab, users may optionally inspect a copied response on-device. This is a **user-pasted, unverified historical snapshot**; it does not alter live telemetry, score Arena rounds, or teach the model. The diagnostics report can be copied without authentication tokens. The source integration still uses only documented public GET endpoints, and does not circumvent Cloudflare.

**Access-blocking evidence:** from Vercel's Frankfurt region, `GET https://api.squeekchain.com/v1/status` returned `HTTP 403`, `cf-mitigated: challenge`, and an HTML challenge instead of the documented JSON. The project's own `/api/health` correctly reports `upstream.state: server-challenged`. Since browsers can see cross-origin fetch errors when the challenge omits CORS headers, a successful direct URL navigation alone does not prove JavaScript can access the API. The Squeekchain operator must allow the documented public GET traffic for any future server-verified game and shared learning to work reliably.

## Botanical light redesign

The public site uses a warmer, brighter ivory/green/lavender visual hierarchy (`fresh-theme.css`), with prominent predictor education and clear emphasis on the live Learning Lab, forecasts, actual history and verified outcomes. It explains that SqueekSense is a statistical prediction companion for community members rather than a guaranteed oracle or active wagering game. The original Squeekchain browser API requests remain unchanged.

## Simplified navigation

The compact header links to **Learning Lab** and **Live**; the **Explore** dropdown contains Live Monitor, AI Forecast, Activity Map and Block Radar. The mobile menu mirrors these destinations without obsolete game links.

## Deployment and limitations

Root `index.html` is static; `lab.js` and `browser-learning.js` power the currently displayed Learning Lab and Signal Center. The retired `replay.js` is not loaded by the app. Archived game functions under `api/` may still use private Vercel Blob storage and environment secrets; these must never be committed. The live browser telemetry API client does not need these secrets.

To run the static interface locally:

```bash
npm install
npx serve .
```

The active Learning Lab and live telemetry use the public browser API where CORS and upstream access permit. Legacy account APIs are not linked from the current interface. Vercel Blob storage has usage limits and may have charges above included quotas. No payment, staking, NFT transfer, wallet connection or real-money wager is implemented.

Privacy: local manual observations and browser-training snapshots remain on the user's device. Existing player-account records from the retired Arena have been preserved rather than erased; any future reintroduction of accounts requires an updated privacy and recovery review.

## Attribution

Independent community experiment, **not affiliated with Squeekchain**. Source activity may be hardware, simulated, replay or derived. A wheel-not-moving event must not be described as biologically verified sleep or eating.

MIT License — see [LICENSE](LICENSE).
