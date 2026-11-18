# Token Radar v2 — build notes (for the parent agent)

Entry for make.fun bounty `token-radar-01` (Build the best token launch radar,
$1,325 USDC, deadline 2026-12-14 10:00 UTC). Built 2026-11-18 by this session.
v1 is already submitted (submission 01a1ecee-94b6-7785-8c1c-3de7b6fb1f94,
status "verifying", no score yet). v2 is a NEW build in a NEW directory; v1's
build dir and repo were not touched. DO NOT submit v2 yet — see "Still needed".

## Baseline: v1's score

Checked via GET https://make.fun/api/competitions/token-radar-01 on 2026-11-18
~11:40 WIB: our v1 submission ("Solana token radar: momentum, volume and
social signals") has **no score yet — status "verifying"** (26 of 15,994 entries
also still verifying; 15,966 passed). Field: top score 965,208, median
869,356, min 129,850. There is no v1 baseline score to beat yet; v2's claim
rests on the local blind test below, measured with the same protocol for both
models.

## Model (radar-3/curve, lib/model.ts)

- Comps: 127 traded tokens, one per ticker (symbol, fallback gecko_id; the
  largest TVL keeps a shared ticker — only 1 duplicate, "bifi": Beefy kept
  over BiFi). 16 traded rows record mcap <= $0 (dead tokens) and are excluded.
- Fit: log(mcap) = 7.2429 + 0.5082 x log(TVL) (OLS). Each category gets an
  intercept shrunk toward the global curve with weight n/(n+100).
- Why the shrink: a pure curve makes rank ranges vacuous (every refit
  reproduces the TVL order, width 0). Weak shrinkage (k=10) makes ranges
  absurdly wide (median 51 places). k=100 gives median width 10, max 39,
  at a blind-test cost inside the noise (see below). The choice is stated in
  the code and on the dashboard.
- Board: 198 rows (same candidate rule as v1), watchlist 40/40, ranks 1..198,
  198 distinct implied values, non-increasing. Top 5: sentora-curator $89.4M,
  steakhouse-financial $89.4M, gauntlet $67.3M, veda $63.8M, usdd $52.0M.
  Top-20 overlap with v1: 18/20 (v1's top 5 keep ranks 1-5, #1/#2 swapped).
- Farm plans: 7 steps each (v1's 6 + an economics summary step), category
  aware, with cash cost, hours, break-even and implied value per farming hour.
  Steps 89-250 chars (gate: 20-600).
- Rank ranges: 200 bootstrap refits (seeded mulberry32), per-row rank p5-p95
  and implied-value p5-p95. Median width 10 places; 6 rows have width 0.
- The snapshot carries NO volume and NO social figures, so no volume/social
  signal can be derived from it. The only momentum figure is change_7d; it
  was tested as an extra term and dropped (see below).

## Blind test (computed at run time from the snapshot, deterministic)

Median absolute log error on held-out traded-token market caps, lower better.
Measured by the model's own code (lib/model.ts blindTest) and printed on the
dashboard's "How it works" view:

| Test | Flat | Cat-median (v1) | Pure curve | Curve+cat (v2) | Theil-Sen |
|---|---|---|---|---|---|
| 5-fold CV x10 repeats | 1.6135 | 1.5858 | 1.2723 | **1.2665** | 1.2782 |
| Walk-forward <2023 -> >=2023 (24/71) | 1.6579 | 1.6297 | 1.1216 | 1.1352 | — |
| Walk-forward <2024 -> >=2024 (44/51) | 1.6495 | 1.6414 | 1.0691 | 1.0612 | — |
| Walk-forward <2025 -> >=2025 (64/31) | 1.6775 | 1.5917 | 1.1242 | 1.1242 | — |
| Walk-forward mean | 1.6618 | 1.6209 | 1.1050 | 1.1069 | 1.0874 |

- v2 vs v1: CV 1.2665 vs 1.5858 (-20%), walk-forward mean 1.1069 vs 1.6209
  (-32%). The pure curve and the kept curve are within noise of each other
  on both tests; the kept one is used because it can show rank ranges.
- Terms dropped (walk-forward mean): +growth 1.1339, +growth+age+chains
  1.6483, Theil-Sen 1.0874 walk-forward but 1.2782 CV (tests disagree, OLS kept).
- The same protocol in Python (independent check before building) gave the
  same verdicts: flat 1.59, v1 1.61, curve 1.27 CV; walk-forward curve
  1.12/1.07/1.12 vs v1 1.63/1.64/1.59.

## Verification done

1. `main.ts` runs in ~1s, exit 0. Two runs to different dirs: board.json,
   data.js, dossier.json byte-identical (sha256 compared).
2. Local gate replica (`.shot/gate-check.mjs`): ALL 7 PASS. Dossier 630KB
   (cap 1.5MiB), dossier text 32,441 bytes (cap 65,536 — whole dashboard
   source shown to the judge). Dashboard source 32,175 bytes total.
   No http(s) anywhere in dashboard/, lib/ or main.ts.
3. Screenshots (shot-v2.mjs, fresh page per shot, 1440x900): 1-board 145KB,
   2-detail 156KB (sentora-curator), 3-filtered 146KB (watchlist only, "40 of
   198 rows"). All visually checked: board, detail with formula + farm plan +
   economics, filtered view. Method + live views rendered with zero
   console/page errors (checked separately, v2 out dir — note: the .shot
   verify-views.mjs script is hardcoded to the v1 build dir, do not trust its
   output for v2).
4. Kit check (`check --kit . --repo <build-v2> --worktree`): 4 passed
   (competition_open, snapshot, license_osi MIT, entrypoint main.ts/node22),
   1 failed = transcripts_present (no bundle yet — expected, parent's step),
   5 checked at submission (repo not created yet — expected).
5. Kit itself verified: all files sha256 OK (kit.json). vendor/makefun-board.ts
   copied verbatim from the kit (md5 5ba220c2671b81b1c453350f3235adf4).

## Still needed before submit (parent)

1. Create a NEW public GitHub repo under geishakampret (created after
   2026-11-14T10:00Z), push this folder's files, set About (website
   https://make.fun/bounty/token-radar-01, topics makefun/ai-agents/bounties).
   README badges assume owner `geishakampret`, repo `token-radar-01-v2` —
   FIX the owner/repo in the badge URLs if the real repo differs (a wrong
   repo name breaks the rank/reward badges and the repo_readme check —
   this exact failure rejected the gta6-01 and github-core-clone submits).
   `.makefun/owner.json` is NOT included: only needed if the repo owner is
   not Garong's GitHub login.
2. `bundle` from the top-level agent (this session wrote all of main.ts,
   lib/model.ts and dashboard/ — do NOT copy files in from v1), then
   `check --transcripts <bundle>`, then `submit` with the new repo + commit
   SHA before 2026-12-14 10:00 UTC. Submission quota: v1 used 1 of 10 total
   (max 5/day), so 9 remain.
3. Re-run `node main.ts` after any repo-side change that touches dashboard/
   or screenshots/ so dossier.json stays byte-identical.

## Reproduce

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=$PWD/out node main.ts --input ../token-radar-01-kit/input/snapshot.json
node ../.shot/gate-check.mjs $PWD/out ../token-radar-01-kit/input/snapshot.json
```

Screenshots (if the dashboard changes):

```sh
node ../.shot/shot-v2.mjs $PWD/out $PWD/screenshots   # then re-run main.ts
```

Playwright Chromium lives in ~/.cache/ms-playwright.
