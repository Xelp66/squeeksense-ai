# SqueekSense 🐹 — The hamster, decoded.

squeekchain-project: f3ef600b-84e5-4a1a-94a1-b651488d0577

**SqueekSense Arena is a playable AI-vs-human prediction game powered by [Squeekchain](https://sepolia.squeekchain.com/) Sepolia measurement history**, with an accompanying intelligence dashboard for context. Players predict whether the wheel will show recorded work in an upcoming 30, 60 or 120-minute UTC window, challenge a transparent statistical model, and earn a local correct-round score only after the public API supplies all measurement buckets.

The companion dashboard shows live wheel telemetry, historical 30-minute activity heatmaps, time-of-day probabilities, a historical walk-forward backtest, block progress, and optional browser notifications.

**[Play SqueekSense Arena](https://squeeksense.xyz/#arena)**

## Arena: a game, not just a read-only dashboard

- Pick **RUN** or **QUIET**, then a round length of **30, 60 or 120 minutes**.
- The human and model predictions are **locked** before the next UTC half-hour boundary.
- After the round, the game waits for **all recorded 30-minute activity buckets (using Squeekchain's noon-to-noon UTC measurement days)** in the window. Any bucket with work counts as **RUN**; fully observed zero-work windows count as **QUIET**. Missing API data is never scored as a loss; rounds without complete data after 48 hours are marked unverified.
- Both sides earn one point when correct; a browser-local scoreboard and recent match history track the contest. **There is no shared leaderboard or server persistence**, and no tokens, wallets, bets or rewards are involved.
- The opponent is a **historical-statistics prediction model**, not a trained machine-learning model. Predictions may be unavailable when the public API lacks enough observations, and the original source may include simulated or replayed data.

This playable experience is independent of Squeekchain and intended for community exploration, not financial use.

## Run locally

No dependencies or API keys. Use any static server:

```bash
python -m http.server 8080
# open http://localhost:8080
```

Deploy to Vercel using `Other` framework (no build command) or simply push the repository and import it in Vercel.

## Public API

- `GET https://api.squeekchain.com/v1/status` — live telemetry and projection (polled every 20 seconds)
- `GET https://api.squeekchain.com/v1/core` — settled core state (polled every 20 seconds)
- `GET https://api.squeekchain.com/v1/measurement/runs?limit=40` — recent run segments (polled every 20 seconds)
- `GET https://api.squeekchain.com/v1/measurement/stats?range=7d|30d` — historical half-hour slots (polled every 5 minutes)

See the [official API reference](https://docs.squeekchain.com/developers/api/). API is under active development, so the UI treats missing/unavailable fields as unknown. Web browser calls require the service's documented `Access-Control-Allow-Origin: *` header. The app itself has no server-side writes.

## What the model actually does

- A half-hour bucket is marked active when **observed wheel work > 0**. `missing` and `future` are *not* treated as zero activity.
- A 30, 60, or 120-minute activity probability uses an empirical hit rate at the **current UTC half-hour slot**, with Laplace smoothing `(hits+1)/(samples+2)`. If fewer than three slot-specific observations exist, it falls back to the ±1 hour neighborhood. The 60-minute headline requires ≥3 usable days and ≥5 examples.
- Confidence labels express *sample size*, not a statistically calibrated credible interval or an AI language model's certainty.
- The historical report card uses walk-forward days: every day is predicted using **only prior days**. It scores 60-minute binary outcomes on 2-hour-spaced sample slots and displays directional accuracy and Brier score when ≥8 forecasts were scored.
- The model predicts **wheel activity**, never that the hamster is asleep, waking, or healthy. The measurements may be `hardware`, `simulated`, `replay`, or `derived`, which is visible in the UI.
- The block progress bar is settled SqueekCore `blockProgress` divided by 1,000,000,000. Optimistic projections are explicitly identified and no fabricated time-to-block is shown.

## Limitations

- Browser notifications only work while the tab is open; they are **not** service-worker push notifications.
- Arena matches and the score are saved locally in this browser. A closed tab can still be settled from later historical API data, but missing or delayed measurements leave rounds unverified; there is no cross-device or global leaderboard.
- No shared database, account, wallet tracking, financial advice, staking, or transaction execution.
- The site uses Google Fonts as an optional enhancement; fallback fonts work offline.
- No analytics, tracking scripts, cookies, or API keys.

## Potential next version

A persistent backend could run a scheduled collector, retain model snapshots and scored predictions, and deliver Web Push. This requires a database, privacy considerations, and additional production monitoring.

## Attribution

Independent community project. Not affiliated with Squeekchain. Data from its public Sepolia API. The emoji artwork is an OS-rendered emoji.

MIT License — see [LICENSE](LICENSE).