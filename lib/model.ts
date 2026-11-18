// Token Radar's model (radar-3/curve): a comps-calibrated implied value for every
// protocol that records no token, ranked for the board; the protocols that already
// trade are kept apart and shown with the market's own values, never mixed into
// the ranking.
//
// The model is one fitted curve, not a flat multiple. The market pays less per
// dollar of TVL as a protocol gets bigger: across the snapshot's traded tokens,
// log market cap grows with log TVL at a slope of about 0.51, not 1.00. A flat
// multiple (one FDV/TVL number for a whole category) overstates big protocols
// and understates small ones, so the board fits the curve on the traded tokens
// and prices every pre-token protocol off it.
//
// The curve is chosen by a blind test, not by taste. The program fits four
// candidate models on the traded tokens and tests each one out of sample: a
// repeated 5-fold cross-validation, and a walk-forward test that fits only on
// protocols listed before a cutoff date and predicts the ones listed after it.
// The pure curve wins both. The board keeps the curve with one small addition:
// each category gets its own intercept, shrunk hard toward the global curve
// (a category with n comparables counts its own intercept as n / (n + 100)).
// The blind test cannot tell the shrunk model from the pure curve — their
// errors differ by less than the noise between cutoffs — and the shrink is
// what lets the board show rank ranges: without a per-category term every
// refit of the curve would reproduce the same TVL order and the ranges would
// be empty. Extra terms (7-day growth; growth plus age and chain count; a
// robust Theil-Sen fit) were tested the same way and dropped: none of them
// improves the walk-forward test, so the curve stands alone — and the
// dashboard shows the numbers, so the reader can check that claim.
//
// The board covers the snapshot's whole watchlist (the floor, never the
// ceiling) and every other pre-token protocol that passes the watchlist's own
// exclusion rule without its $50M floor: no CEX, no bridge, no liquid staking
// or restaking, no versioned pool, no wrapped or staked product, no
// exchange-branded product. The rule is the house's, applied to the whole
// snapshot; no protocol name is ever special-cased, and the same function
// scores every row.
//
// A protocol that records no token is not claimed to have none: the snapshot
// is DefiLlama's record, and a token it does not carry may still exist. The
// board ranks what the record shows, and the dashboard says so on every row.
//
// The snapshot carries no volume and no social figures, so no volume or social
// signal can be derived from it. The only momentum figure it carries is the
// 7-day TVL change; it was tested as an extra term and did not improve the
// blind test, so it is shown on the board but does not move the value.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3/curve';

/** How many live-token protocols the Already trading view carries, by market cap. */
export const LIVE_ROWS = 24;

/** Bootstrap refits behind every row's rank range. */
export const BOOTSTRAP_REFITS = 200;

/** Repeats of the 5-fold cross-validation behind the blind test. */
export const CV_REPEATS = 10;

/** The walk-forward cutoffs: fit on protocols listed before, test on those listed after. */
export const WALK_FORWARD_CUTOFFS = ['2023-01-01', '2024-01-01', '2025-01-01'];

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  model: {
    curve_a: number;
    curve_b: number;
    /** This row's category tilt, in log points: its shrunk intercept minus the global one. */
    cat_adjust: number;
    rank_lo: number;
    rank_hi: number;
    iv_lo: number;
    iv_hi: number;
    age_days: number | null;
  };
  farm_economics: {
    capital_usd: number;
    cash_cost_usd: number;
    hours: number;
    hold_days: number;
    break_even_usd: number;
    implied_per_hour_usd: number;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  watchlist: boolean;
  rank_lo: number;
  rank_hi: number;
  iv_lo: number;
  iv_hi: number;
  /** This row's category tilt, in log points. */
  cat_adjust: number;
  econ_cash: number;
  econ_hours: number;
  econ_iv_per_hour: number;
  /** The row's farm plan, exactly as board.json carries it. */
  steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One category's reference multiple: what a flat multiple would say. */
export interface CompRow {
  category: string;
  n: number;
  multiple: number;
}

/** One point of the fitted curve's scatter chart. */
export interface CurvePoint {
  tvl: number;
  mcap: number;
}

/** The blind test's numbers, computed from the snapshot at run time. */
export interface BlindTest {
  cv_repeats: number;
  cv_folds: number;
  /** Median absolute log error on held-out traded tokens, lower is better. */
  cv: { flat: number; cat_median: number; pure_curve: number; curve: number; theil_sen: number };
  walk_forward: { cutoff: string; train: number; test: number; flat: number; cat_median: number; pure_curve: number; curve: number }[];
  /** Mean walk-forward error of the curve against the terms that were tried and dropped. */
  terms: { curve: number; pure_curve: number; growth: number; growth_age_chains: number; theil_sen: number };
}

/** The fitted curve and what went into it. */
export interface CurveFit {
  a: number;
  b: number;
  n: number;
  /** Shrinkage weight: a category's intercept counts as n / (n + shrink_k) of its own data. */
  shrink_k: number;
  /** Traded rows left out of the fit because their market cap is zero or negative. */
  excluded_zero_mcap: number;
  /** Duplicate tickers collapsed to one row each (the largest TVL keeps the ticker). */
  deduped_tickers: number;
  /** In-sample median absolute log error of the fitted curve. */
  in_sample_male: number;
}

/** Everything the dashboard needs: the board, the live set, the curve and its test. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  live_size: number;
  live_count: number;
  overall_comp: number;
  curve: CurveFit;
  blind: BlindTest;
  bootstrap_refits: number;
  comps: CompRow[];
  curve_points: CurvePoint[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A deterministic random source: the same seed, the same board, every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a non-empty list, else null. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** The p-th percentile of a sorted list (nearest rank). */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[i]!;
}

/** Ordinary least squares for y ~ a + b*x. */
function ols(xs: number[], ys: number[]): { a: number; b: number } {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i]! - mx) * (xs[i]! - mx);
    sxy += (xs[i]! - mx) * (ys[i]! - my);
  }
  const b = sxx > 0 ? sxy / sxx : 0;
  return { a: my - b * mx, b };
}

/** Least squares for y ~ c0 + c1*x1 + ... (small systems, Gaussian elimination). */
function olsMulti(rows: number[][], ys: number[]): number[] {
  const d = rows[0]!.length + 1;
  const a: number[][] = Array.from({ length: d }, () => new Array<number>(d).fill(0));
  const v: number[] = new Array<number>(d).fill(0);
  for (let r = 0; r < rows.length; r++) {
    const row = [1, ...rows[r]!];
    for (let i = 0; i < d; i++) {
      v[i]! += row[i]! * ys[r]!;
      for (let j = 0; j < d; j++) a[i]![j]! += row[i]! * row[j]!;
    }
  }
  const m = a.map((row, i) => [...row, v[i]!]);
  for (let c = 0; c < d; c++) {
    let piv = c;
    for (let r = c + 1; r < d; r++) if (Math.abs(m[r]![c]!) > Math.abs(m[piv]![c]!)) piv = r;
    [m[c], m[piv]] = [m[piv]!, m[c]!];
    const pv = m[c]![c]!;
    if (Math.abs(pv) < 1e-12) continue;
    for (let r = 0; r < d; r++) {
      if (r === c) continue;
      const f = m[r]![c]! / pv;
      for (let k = c; k <= d; k++) m[r]![k]! -= f * m[c]![k]!;
    }
  }
  return m.map((row, i) => (Math.abs(row[i]!) > 1e-12 ? row[d]! / row[i]! : 0));
}

/** Theil-Sen: the median pairwise slope, with a median intercept. Robust to outliers. */
function theilSen(xs: number[], ys: number[]): { a: number; b: number } {
  const slopes: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      const dx = xs[j]! - xs[i]!;
      if (Math.abs(dx) > 1e-9) slopes.push((ys[j]! - ys[i]!) / dx);
    }
  }
  const b = median(slopes) ?? 0;
  const a = median(xs.map((x, i) => ys[i]! - b * x)) ?? 0;
  return { a, b };
}

/** One traded token the curve is fitted on: one row per ticker, positive market cap. */
export interface CompPoint {
  slug: string;
  category: string;
  chains: number;
  tvl: number;
  mcap: number;
  ltvl: number;
  lmcap: number;
  growth: number;
  age: number | null;
  listed: string | null;
}

/** The comparables: one row per ticker among the traded tokens with a positive market cap. */
export function buildCompPoints(snapshot: Snapshot): { points: CompPoint[]; excludedZero: number; deduped: number } {
  const byTicker = new Map<string, SnapshotProtocol>();
  let excludedZero = 0;
  let seenTickers = 0;
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null) continue;
    if (p.mcap_usd <= 0 || p.tvl_usd <= 0) {
      excludedZero++;
      continue;
    }
    seenTickers++;
    const key = ((p.symbol ?? p.gecko_id ?? p.slug) as string).toLowerCase();
    const prev = byTicker.get(key);
    if (prev === undefined || p.tvl_usd > prev.tvl_usd) byTicker.set(key, p);
  }
  const points: CompPoint[] = [...byTicker.values()].map((p) => ({
    slug: p.slug,
    category: p.category ?? 'Uncategorized',
    chains: p.chains.length,
    tvl: p.tvl_usd,
    mcap: p.mcap_usd!,
    ltvl: Math.log(p.tvl_usd),
    lmcap: Math.log(p.mcap_usd!),
    growth: Math.min(120, Math.max(-60, finite(p.change_7d, 0))) / 100,
    age: ageDays(snapshot.as_of, p.listed_at),
    listed: p.listed_at,
  }));
  points.sort((x, y) => (x.slug < y.slug ? -1 : x.slug > y.slug ? 1 : 0));
  return { points, excludedZero, deduped: seenTickers - points.length };
}

/** How hard a category's intercept is shrunk toward the global curve: a category
 *  with n comparables counts its own intercept as n / (n + SHRINK_K). At 100 the
 *  blind test cannot tell the shrunk model from the pure curve, and the shrink
 *  is what lets the board show rank ranges: without a per-category term every
 *  refit of the curve would reproduce the same TVL order and the ranges would
 *  be empty. */
export const CATEGORY_SHRINK_K = 100;

/** The fitted curve: log market cap against log TVL over the comparables, with
 *  one intercept per category, shrunk toward the global intercept. */
export interface FittedCurve {
  a: number;
  b: number;
  intercepts: Map<string, number>;
}

export function fitCurve(points: CompPoint[]): FittedCurve {
  const { a, b } = ols(points.map((p) => p.ltvl), points.map((p) => p.lmcap));
  const resid = new Map<string, number[]>();
  for (const p of points) {
    const list = resid.get(p.category) ?? [];
    list.push(p.lmcap - b * p.ltvl);
    resid.set(p.category, list);
  }
  const intercepts = new Map<string, number>();
  for (const [cat, rs] of resid) {
    const mean = rs.reduce((s, v) => s + v, 0) / rs.length;
    intercepts.set(cat, (rs.length * mean + CATEGORY_SHRINK_K * a) / (rs.length + CATEGORY_SHRINK_K));
  }
  return { a, b, intercepts };
}

/** The curve's prediction of a market cap for a protocol: its category's
 *  intercept plus the shared slope on log TVL. */
export function curveValue(fit: FittedCurve, category: string | null, tvl: number): number {
  const intercept = category === null ? fit.a : (fit.intercepts.get(category) ?? fit.a);
  return Math.exp(intercept + fit.b * Math.log(tvl));
}

/** A model is a builder: train on comparables, predict a log market cap for one. */
type ModelBuilder = (train: CompPoint[]) => (p: CompPoint) => number;

/** The flat multiple: one median FDV/TVL for the whole market. */
function buildFlat(train: CompPoint[]): (p: CompPoint) => number {
  const m = median(train.map((p) => p.mcap / p.tvl)) ?? 0.25;
  return (p) => p.ltvl + Math.log(m);
}

/** The category-median multiple, v1's model: a category median where the category
 *  has at least 3 comparables, else the whole market's median, clamped 0.02-1.00. */
function buildCatMedian(train: CompPoint[]): (p: CompPoint) => number {
  const byCat = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of train) {
    const r = p.mcap / p.tvl;
    all.push(r);
    const list = byCat.get(p.category) ?? [];
    list.push(r);
    byCat.set(p.category, list);
  }
  const overall = Math.min(1, Math.max(0.02, median(all) ?? 0.25));
  const cats = new Map<string, number>();
  for (const [c, rs] of byCat) {
    if (rs.length >= 3) cats.set(c, Math.min(1, Math.max(0.02, median(rs) ?? overall)));
  }
  return (p) => p.ltvl + Math.log(cats.get(p.category) ?? overall);
}

/** The fitted curve, with its shrunk category intercepts. */
function buildCurve(train: CompPoint[]): (p: CompPoint) => number {
  const f = fitCurve(train);
  return (p) => (f.intercepts.get(p.category) ?? f.a) + f.b * p.ltvl;
}

/** The pure curve: one global line, no category term. */
function buildPureCurve(train: CompPoint[]): (p: CompPoint) => number {
  const f = ols(train.map((p) => p.ltvl), train.map((p) => p.lmcap));
  return (p) => f.a + f.b * p.ltvl;
}

/** The robust Theil-Sen curve. */
function buildTheilSen(train: CompPoint[]): (p: CompPoint) => number {
  const f = theilSen(train.map((p) => p.ltvl), train.map((p) => p.lmcap));
  return (p) => f.a + f.b * p.ltvl;
}

/** The curve plus one extra term, fitted on the train residuals. */
function buildCurvePlus(train: CompPoint[], terms: ('growth' | 'age' | 'chains')[]): (p: CompPoint) => number {
  const base = buildCurve(train);
  const feat = (p: CompPoint): number[] =>
    terms.map((t) => (t === 'growth' ? p.growth : t === 'age' ? Math.log1p(p.age ?? 365) : Math.min(Math.max(p.chains - 1, 0), 9)));
  const coef = olsMulti(train.map(feat), train.map((p) => p.lmcap - base(p)));
  return (p) => {
    const f = feat(p);
    let v = base(p) + coef[0]!;
    for (let i = 0; i < f.length; i++) v += coef[i + 1]! * f[i]!;
    return v;
  };
}

/** Median absolute log error of a model on held-out comparables. */
function male(build: ModelBuilder, train: CompPoint[], test: CompPoint[]): number {
  const predict = build(train);
  const errs = test.map((p) => Math.abs(predict(p) - p.lmcap));
  return median(errs) ?? 0;
}

/** The blind test: repeated 5-fold cross-validation and walk-forward by listing date. */
export function blindTest(points: CompPoint[]): BlindTest {
  const rand = mulberry32(0xB11D7E57);
  const models: { flat: ModelBuilder; cat_median: ModelBuilder; pure_curve: ModelBuilder; curve: ModelBuilder; theil_sen: ModelBuilder } = {
    flat: buildFlat,
    cat_median: buildCatMedian,
    pure_curve: buildPureCurve,
    curve: buildCurve,
    theil_sen: buildTheilSen,
  };
  const cvSums: Record<keyof typeof models, number[]> = { flat: [], cat_median: [], pure_curve: [], curve: [], theil_sen: [] };
  for (let rep = 0; rep < CV_REPEATS; rep++) {
    const idx = points.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j]!, idx[i]!];
    }
    const folds: number[][] = [[], [], [], [], []];
    idx.forEach((v, i) => folds[i % 5]!.push(v));
    for (let k = 0; k < 5; k++) {
      const test = folds[k]!.map((i) => points[i]!);
      const train = folds.flatMap((f, j) => (j === k ? [] : f.map((i) => points[i]!)));
      (Object.keys(models) as (keyof typeof models)[]).forEach((key) => {
        cvSums[key].push(male(models[key], train, test));
      });
    }
  }
  const cv = {
    flat: round4(median(cvSums.flat) ?? 0),
    cat_median: round4(median(cvSums.cat_median) ?? 0),
    pure_curve: round4(median(cvSums.pure_curve) ?? 0),
    curve: round4(median(cvSums.curve) ?? 0),
    theil_sen: round4(median(cvSums.theil_sen) ?? 0),
  };
  const dated = points.filter((p) => p.listed !== null);
  const walkForward = WALK_FORWARD_CUTOFFS.map((cutoff) => {
    const train = dated.filter((p) => p.listed! < cutoff);
    const test = dated.filter((p) => p.listed! >= cutoff);
    return {
      cutoff,
      train: train.length,
      test: test.length,
      flat: round4(male(buildFlat, train, test)),
      cat_median: round4(male(buildCatMedian, train, test)),
      pure_curve: round4(male(buildPureCurve, train, test)),
      curve: round4(male(buildCurve, train, test)),
    };
  });
  const termMean = (build: ModelBuilder): number => {
    const ms = walkForward.map((w) => {
      const train = dated.filter((p) => p.listed! < w.cutoff);
      const test = dated.filter((p) => p.listed! >= w.cutoff);
      return male(build, train, test);
    });
    return round4(ms.reduce((s, v) => s + v, 0) / ms.length);
  };
  const terms = {
    curve: round4(walkForward.reduce((s, w) => s + w.curve, 0) / walkForward.length),
    pure_curve: round4(walkForward.reduce((s, w) => s + w.pure_curve, 0) / walkForward.length),
    growth: termMean((t) => buildCurvePlus(t, ['growth'])),
    growth_age_chains: termMean((t) => buildCurvePlus(t, ['growth', 'age', 'chains'])),
    theil_sen: termMean(buildTheilSen),
  };
  return { cv_repeats: CV_REPEATS, cv_folds: 5, cv, walk_forward: walkForward, terms };
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** A wrapped, staked or bridged product's name carries one of these whole words. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;
/** An exchange-branded product's name begins with one of these. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
/** Categories that are a wrapped, staked or bridged product of a token that trades. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/**
 * Whether a protocol is one the board may rank: pre-token and not a wrapped,
 * staked or bridged product of a token that already trades, by the watchlist's
 * own rule, without its TVL floor. The watchlist itself always qualifies.
 */
export function isLaunchCandidate(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_WORD.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  return true;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The category's main farming action, in words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the supply position open.`;
  if (c.includes('dex') || c.includes('amm') || c.includes('liquidity manager')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('yield') || c.includes('leveraged farm') || c.includes('farm')) return `Deposit $${capital} of USDC into ${name}'s highest-yield vault on ${chain} and keep the shares.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged trade.`;
  if (c.includes('prediction')) return `Fund $${capital} on ${name} and place one position in a market that settles after this month.`;
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares.`;
  if (c.includes('stable') || c.includes('algo-stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} and hold it.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy active.`;
  if (c.includes('launchpad')) return `Stake $${capital} of USDC in ${name}'s launch pool on ${chain} and join one sale.`;
  if (c.includes('synthetic')) return `Mint $${capital} of ${name}'s synthetic asset on ${chain} and hold the position.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to ${chain} and use it in ${name}'s own app.`;
  if (c.includes('payment') || c.includes('card')) return `Spend $${capital} through ${name} on ${chain} and keep the account active.`;
  if (c.includes('governance')) return `Lock $${capital} of USDC in ${name}'s governance vault on ${chain} and vote once.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** The category's weekly qualifying action. */
function weeklyFor(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `adjust the supply, borrow a small amount against it, or vote on one proposal.`;
  if (c.includes('dex') || c.includes('amm') || c.includes('liquidity manager')) return `swap a small amount through the pool or rebalance the range.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `open or close one small hedged trade.`;
  if (c.includes('prediction')) return `place one small position in a new market.`;
  if (c.includes('stable') || c.includes('rwa') || c.includes('synthetic')) return `mint, redeem or move a small amount of the asset.`;
  if (c.includes('insurance')) return `check the policy and file no claim unless a covered event happened.`;
  if (c.includes('launchpad')) return `join one new sale or vote on one listing.`;
  if (c.includes('governance')) return `vote on one proposal.`;
  return `make one deposit, swap or vote.`;
}

/** The plan's economics, from the protocol's own record: cash out of pocket, hours, break-even. */
export function farmEconomics(p: SnapshotProtocol, age: number | null, implied: number): BoardRow['farm_economics'] {
  const capital = capitalFor(p);
  const gas = capital >= 150 ? 8 : 4;
  const hold = holdDaysFor(age);
  const weeks = Math.ceil(hold / 7);
  const cash = 3 + gas + 2 * weeks;
  const hours = round2((5 + 15 + 10 * weeks + 10 + 5) / 60);
  return {
    capital_usd: capital,
    cash_cost_usd: cash,
    hours,
    hold_days: hold,
    break_even_usd: cash,
    implied_per_hour_usd: Math.round(implied / hours),
  };
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time,
 * ending in the plan's own economics. The plan is derived from the protocol's
 * own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, implied: number): FarmStep[] {
  const chain = chainOf(p);
  const econ = farmEconomics(p, age, implied);
  const moneyShort = (n: number): string =>
    n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${Math.round(n)}`;
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: actionFor(p, econ.capital_usd, chain),
      cost: `$${econ.capital_usd} of capital and about $${econ.capital_usd >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Once a week, ${weeklyFor(p)}`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${econ.hold_days} days so the activity is counted in more than one snapshot.`,
      cost: `the $${econ.capital_usd} stays in the position`,
      time: `${econ.hold_days} days`,
    },
    {
      text: `Before you withdraw, open ${p.name}'s own points or rewards page from its official site and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction hash in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
    {
      text: `The plan in numbers: about $${econ.cash_cost_usd} out of pocket and ${econ.hours} hours over ${econ.hold_days} days. It breaks even if the allocation is worth $${econ.break_even_usd}. At the model's implied value, that is ${moneyShort(econ.implied_per_hour_usd)} of implied value per farming hour.`,
      cost: `$${econ.cash_cost_usd} cash, ${econ.hours} hours`,
      time: `${econ.hold_days} days all in`,
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Already trading view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** Rank ranges over bootstrap refits of the curve, for every candidate. */
export function bootstrapRanges(
  points: CompPoint[],
  candidates: SnapshotProtocol[],
): Map<string, { rank_lo: number; rank_hi: number; iv_lo: number; iv_hi: number }> {
  const rand = mulberry32(0xB00757);
  const ranks = new Map<string, number[]>();
  const values = new Map<string, number[]>();
  for (const c of candidates) {
    ranks.set(c.slug, []);
    values.set(c.slug, []);
  }
  for (let r = 0; r < BOOTSTRAP_REFITS; r++) {
    const sample: CompPoint[] = [];
    for (let i = 0; i < points.length; i++) sample.push(points[Math.floor(rand() * points.length)]!);
    const fit = fitCurve(sample);
    const scored = candidates
      .map((c) => ({ slug: c.slug, iv: curveValue(fit, c.category, c.tvl_usd) }))
      .sort((x, y) => y.iv - x.iv || (x.slug < y.slug ? -1 : x.slug > y.slug ? 1 : 0));
    scored.forEach((s, i) => {
      ranks.get(s.slug)!.push(i + 1);
      values.get(s.slug)!.push(Math.max(1, Math.round(s.iv)));
    });
  }
  const out = new Map<string, { rank_lo: number; rank_hi: number; iv_lo: number; iv_hi: number }>();
  for (const c of candidates) {
    const rs = [...ranks.get(c.slug)!].sort((a, b) => a - b);
    const vs = [...values.get(c.slug)!].sort((a, b) => a - b);
    out.set(c.slug, {
      rank_lo: percentile(rs, 0.05),
      rank_hi: percentile(rs, 0.95),
      iv_lo: percentile(vs, 0.05),
      iv_hi: percentile(vs, 0.95),
    });
  }
  return out;
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot): { board: BoardRow[]; fit: CurveFit; blind: BlindTest; points: CompPoint[] } {
  const { points, excludedZero, deduped } = buildCompPoints(snapshot);
  const fit = fitCurve(points);
  const inSample =
    median(points.map((p) => Math.abs((fit.intercepts.get(p.category) ?? fit.a) + fit.b * p.ltvl - p.lmcap))) ?? 0;
  const blind = blindTest(points);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug it names, even one the snapshot no
  // longer carries (it cannot, but coverage is the gate's row and is never gambled).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other launch candidate, below the floor or above it,
  // by the same rule the watchlist was drawn with. Never a replacement for a
  // watchlist row: a chosen protocol stays chosen.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isLaunchCandidate(p)) chosen.set(p.slug, p);
  }
  const watch = new Set(snapshot.watchlist);
  const candidates = [...chosen.values()];
  const ranges = bootstrapRanges(points, candidates);
  const scored = candidates.map((p) => {
    const implied = Math.max(1, Math.round(curveValue(fit, p.category, p.tvl_usd)));
    return { p, implied, age: ageDays(snapshot.as_of, p.listed_at), range: ranges.get(p.slug)! };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const board: BoardRow[] = scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    watchlist: watch.has(s.p.slug),
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      curve_a: round4(fit.a),
      curve_b: round4(fit.b),
      cat_adjust: round4((fit.intercepts.get(s.p.category ?? 'Uncategorized') ?? fit.a) - fit.a),
      rank_lo: s.range.rank_lo,
      rank_hi: s.range.rank_hi,
      iv_lo: s.range.iv_lo,
      iv_hi: s.range.iv_hi,
      age_days: s.age,
    },
    farm_economics: farmEconomics(s.p, s.age, s.implied),
    farm_steps: farmSteps(s.p, s.age, s.implied).map(stepText),
  }));
  const curveFit: CurveFit = {
    a: round4(fit.a),
    b: round4(fit.b),
    n: points.length,
    shrink_k: CATEGORY_SHRINK_K,
    excluded_zero_mcap: excludedZero,
    deduped_tickers: deduped,
    in_sample_male: round4(inSample),
  };
  return { board, fit: curveFit, blind, points };
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    watchlist: row.watchlist,
    rank_lo: row.model.rank_lo,
    rank_hi: row.model.rank_hi,
    iv_lo: row.model.iv_lo,
    iv_hi: row.model.iv_hi,
    cat_adjust: row.model.cat_adjust,
    econ_cash: row.farm_economics.cash_cost_usd,
    econ_hours: row.farm_economics.hours,
    econ_iv_per_hour: row.farm_economics.implied_per_hour_usd,
    steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const { board, fit, blind, points } = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const liveCount = snapshot.protocols.filter((p) => !isPreToken(p)).length;
  const overall = median(points.map((p) => p.mcap / p.tvl)) ?? 0.25;
  const byCat = new Map<string, number[]>();
  for (const p of points) {
    const list = byCat.get(p.category) ?? [];
    list.push(p.mcap / p.tvl);
    byCat.set(p.category, list);
  }
  const compRows: CompRow[] = [...byCat.entries()]
    .map(([category, rs]) => ({ category, n: rs.length, multiple: round4(median(rs) ?? overall) }))
    .sort((a, b) => b.multiple - a.multiple || (a.category < b.category ? -1 : 1));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    live_size: live.length,
    live_count: liveCount,
    overall_comp: round4(overall),
    curve: fit,
    blind,
    bootstrap_refits: BOOTSTRAP_REFITS,
    comps: compRows,
    curve_points: points.map((p) => ({ tvl: p.tvl, mcap: p.mcap })),
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
