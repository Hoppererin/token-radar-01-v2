# Token Radar v2

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/geishakampret/token-radar-01-v2/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/geishakampret/token-radar-01-v2/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Every protocol that records no token, priced off a comps curve that was fitted on the traded tokens and tested blind. Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC. This is the second entry: v1 (category-median multiples) is submitted already; v2 replaces the flat multiple with a fitted size curve and beats it out of sample.

## What it is

A sealed DefiLlama snapshot (758 protocols, 2026-11-14) goes in; a ranked board comes out. The board covers the snapshot's whole 40-protocol watchlist plus every other pre-token protocol that passes the watchlist's own exclusion rule without its $50M floor — 198 rows in all. The 416 protocols that record a token are set aside in their own view, valued by the market, never by the model.

## The model (radar-3/curve)

No names are special-cased. The market pays less per dollar of TVL as a protocol gets bigger, so the board fits a curve on the snapshot's traded tokens instead of using one multiple for a whole category:

```text
ln(market cap) = 7.2429 + 0.5082 × ln(TVL)
```

Fitted on 127 traded tokens (one per ticker; 16 traded rows record a market cap of $0 or less and are left out). Each category also gets a small intercept, shrunk toward the global curve (weight n/(n+100)). Every row carries a rank range from 200 bootstrap refits of the curve (median row moves 10 places) and a farm plan with its economics: cash cost, hours, break-even, and implied value per farming hour.

## The blind test

The curve was not picked by taste. Three models were fitted on the traded tokens and tested on tokens they had not seen. Median absolute log error on held-out market caps, lower is better:

| Test | Flat multiple | Category median | Pure curve | Curve + category |
|---|---|---|---|---|
| 5-fold CV (10 repeats) | 1.61 | 1.59 | 1.27 | **1.27** |
| Walk-forward, listed before 2023 → after | 1.66 | 1.63 | 1.12 | 1.14 |
| Walk-forward, listed before 2024 → after | 1.65 | 1.64 | 1.07 | 1.06 |
| Walk-forward, listed before 2025 → after | 1.68 | 1.59 | 1.12 | 1.12 |

Extra terms were tried on the same walk-forward test and dropped: adding the 7-day growth term scores 1.13; adding growth, age and chain count scores 1.65; a robust Theil–Sen fit scores 1.09 walk-forward but 1.28 on cross-validation, against 1.27 for the kept curve — the two tests disagree, so the simpler OLS fit is kept. The snapshot carries no volume and no social figures, so no volume or social signal can be derived from it.

Top of the board: Sentora Curator $89.4M, Steakhouse Financial $89.4M, Gauntlet $67.3M, Veda $63.8M, USDD $52.0M.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json>
```

Node 22.18 or later, standard library only — no install, no network. `main.ts` writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and `dossier.json` to the output directory. Open `out/dashboard/index.html` in a browser; it renders with no network.

## Layout

- `main.ts` — entrypoint: reads the snapshot, writes the board, data and dossier
- `lib/model.ts` — the model: comparables, curve fit, blind test, bootstrap rank ranges, farm plans, board validation
- `vendor/makefun-board.ts` — make.fun's dossier library (verbatim from the kit)
- `dashboard/` — the static page: `index.html`, `app.css`, `app.js`
- `screenshots/` — the board, a protocol detail view, and a filtered view

"Records no token" is what the snapshot says, not a claim the protocol has none: a token the record does not carry may still exist. Implied values are the model's claim — never a promise that a token launches, or at this price.

---

<sub>Entered on [make.fun](https://make.fun/?ref=dhj53q2r&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
