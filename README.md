# SqueekSense 🐹 — The hamster, decoded.

squeekchain-project: f3ef600b-84e5-4a1a-94a1-b651488d0577

A community-built, **read-only** Sepolia dashboard for [Squeekchain](https://sepolia.squeekchain.com/). It shows live wheel telemetry, historical 30-minute activity heatmaps, transparent time-of-day probabilities, a historical walk-forward backtest, Squeek block progress, local predictions and optional foreground browser notifications.

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
- Community game predictions are local to a browser, require the tab to remain open, and may be **unverified** when the tab is suspended. They are not global leaderboard scores.
- No shared database, account, wallet tracking, financial advice, staking, or transaction execution.
- The site uses Google Fonts as an optional enhancement; fallback fonts work offline.
- No analytics, tracking scripts, cookies, or API keys.

## Potential next version

A persistent backend could run a scheduled collector, retain model snapshots and scored predictions, and deliver Web Push. This requires a database, privacy considerations, and additional production monitoring.

## Attribution

Independent community project. Not affiliated with Squeekchain. Data from its public Sepolia API. The emoji artwork is an OS-rendered emoji.

MIT License — see [LICENSE](LICENSE).