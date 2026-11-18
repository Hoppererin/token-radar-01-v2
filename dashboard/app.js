// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the board, the detail view, the already-trading view and
// the methodology, including the fitted curve and its blind test. No network:
// every byte it shows is in data.js. No framework.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA || !DATA.rows) { document.body.innerHTML = '<p>Token Radar: no data loaded.</p>'; return; }
  var rows = DATA.rows, live = DATA.live || [];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function money(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + String(Math.round(n));
  }
  function moneyFull(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function pct(v) {
    if (v === null || v === undefined) return '<span class="flat">—</span>';
    var c = v > 0 ? 'up' : v < 0 ? 'down' : 'flat';
    var s = (v > 0 ? '+' : '') + v.toFixed(1) + '%';
    return '<span class="' + c + '">' + s + '</span>';
  }
  function age(v) { return v === null || v === undefined ? '—' : v >= 365 ? (v / 365).toFixed(1) + 'y' : v + 'd'; }
  function chainsHtml(chains) {
    if (!chains || !chains.length) return '<span class="flat">—</span>';
    var shown = chains.slice(0, 3).map(function (c) { return '<span class="pill">' + esc(c) + '</span>'; }).join('');
    if (chains.length > 3) shown += '<span class="pill">+' + (chains.length - 3) + '</span>';
    return shown;
  }

  // ---- header stats -------------------------------------------------------
  var topIv = rows.length ? rows[0].implied_value_usd : 0;
  var wl = rows.filter(function (r) { return r.watchlist; }).length;
  $('stats').innerHTML =
    '<div><dt>Ranked</dt><dd>' + rows.length + ' <small>protocols</small></dd></div>' +
    '<div><dt>Watchlist</dt><dd>' + wl + ' <small>covered</small></dd></div>' +
    '<div><dt>Have a token</dt><dd>' + DATA.live_count + ' <small>set aside</small></dd></div>' +
    '<div><dt>Top implied value</dt><dd>' + money(topIv) + '</dd></div>' +
    '<div><dt>Curve slope</dt><dd>' + DATA.curve.b.toFixed(2) + ' <small>not 1.00</small></dd></div>' +
    '<div><dt>Blind-test error</dt><dd>' + DATA.blind.cv.curve.toFixed(2) + ' <small>vs ' + DATA.blind.cv.cat_median.toFixed(2) + ' flat-median</small></dd></div>';
  $('foot').textContent = 'Token Radar ' + DATA.model_version + ' · snapshot ' + DATA.as_of +
    ' · ' + rows.length + ' ranked rows, watchlist ' + wl + ' of ' + DATA.watchlist_size +
    ' · implied values are the model\u2019s claim, never a promise of a launch.';
  $('src').textContent = 'Source: DefiLlama protocols endpoint, fetched ' + DATA.as_of +
    '. Floor for the watchlist: ' + moneyFull(DATA.floor_usd) + '.';

  // ---- filter controls ----------------------------------------------------
  var cats = [], chains = [];
  rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    (r.chains || []).forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort(); chains.sort();
  cats.forEach(function (c) { $('cat').appendChild(new Option(c, c)); });
  chains.forEach(function (c) { $('chain').appendChild(new Option(c, c)); });

  var state = { q: '', cat: '', chain: '', mintvl: 0, watch: false, sort: 'rank', dir: -1, detail: null };

  function filtered() {
    var q = state.q.toLowerCase();
    var out = rows.filter(function (r) {
      if (state.watch && !r.watchlist) return false;
      if (state.cat && r.category !== state.cat) return false;
      if (state.chain && (!r.chains || r.chains.indexOf(state.chain) < 0)) return false;
      if (r.tvl_usd < state.mintvl) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var k = state.sort, d = state.dir;
    if (k === 'rank') { out.sort(function (a, b) { return a.rank - b.rank; }); return out; }
    out.sort(function (a, b) {
      if (k === 'tvl') return (a.tvl_usd - b.tvl_usd) * d;
      if (k === 'growth') return ((a.change_7d === null ? -1e9 : a.change_7d) - (b.change_7d === null ? -1e9 : b.change_7d)) * d;
      if (k === 'age') return ((a.age_days === null ? -1 : a.age_days) - (b.age_days === null ? -1 : b.age_days)) * d;
      if (k === 'name') return (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) * d;
      return (a.implied_value_usd - b.implied_value_usd) * d;
    });
    return out;
  }

  function rangeText(r) {
    if (r.rank_lo === r.rank_hi) return '#' + r.rank_lo;
    return '#' + r.rank_lo + '–' + r.rank_hi;
  }

  function renderBoard() {
    var list = filtered();
    var maxIv = rows.length ? rows[0].implied_value_usd : 1;
    $('rows').innerHTML = list.map(function (r) {
      var w = Math.max(2, Math.round(100 * r.implied_value_usd / maxIv));
      return '<tr data-slug="' + esc(r.slug) + '">' +
        '<td class="r">' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span>' + (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '') +
        '<br><span class="slug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td>' + chainsHtml(r.chains) + '</td>' +
        '<td class="num">' + money(r.tvl_usd) + '</td>' +
        '<td class="num">' + pct(r.change_7d) + '</td>' +
        '<td class="num">' + age(r.age_days) + '</td>' +
        '<td class="num"><b>' + money(r.implied_value_usd) + '</b><span class="bar"><i style="width:' + w + '%"></i></span></td>' +
        '<td class="num">' + rangeText(r) + '</td></tr>';
    }).join('');
    $('count').textContent = list.length + ' of ' + rows.length + ' rows';
  }

  // ---- detail view --------------------------------------------------------
  function openDetail(slug) {
    var r = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].slug === slug) { r = rows[i]; break; }
    var box = $('detail');
    if (!r) { box.hidden = true; state.detail = null; return; }
    state.detail = slug;
    var curve = DATA.curve;
    var tilt = (r.cat_adjust >= 0 ? '+' : '') + r.cat_adjust.toFixed(2);
    var f = 'ln(market cap) = <b>' + curve.a.toFixed(3) + '</b> + <b>' + curve.b.toFixed(3) + '</b> × ln(TVL)' +
      ' · category tilt <b>' + tilt + '</b> log points' +
      ' &nbsp;→&nbsp; <b>' + moneyFull(r.implied_value_usd) + '</b> for TVL ' + moneyFull(r.tvl_usd) +
      '<br>Rank <b>#' + r.rank + '</b> · across ' + DATA.bootstrap_refits + ' refits of the curve: rank ' +
      '<b>' + rangeText(r) + '</b>, implied value <b>' + money(r.iv_lo) + '–' + money(r.iv_hi) + '</b>.';
    var steps = (r.steps || []).map(function (s) {
      var m = s.match(/^(.*?) Cost: (.*?)\. Time: (.*?)\.?$/);
      if (!m) return '<li><p>' + esc(s) + '</p></li>';
      return '<li><div><p>' + esc(m[1]) + '</p><p class="ct">Cost: <b>' + esc(m[2]) + '</b> &nbsp;·&nbsp; Time: <b>' + esc(m[3]) + '</b></p></div></li>';
    }).join('');
    box.innerHTML =
      '<h2>#' + r.rank + ' · ' + esc(r.name) + (r.watchlist ? '<span class="badge">WATCHLIST</span>' : '') + '</h2>' +
      '<p class="meta">' + esc(r.slug) + ' · ' + esc(r.category || 'Uncategorized') + ' · ' + esc((r.chains || []).join(', ') || '—') +
      ' · tracked since ' + esc(r.listed_at || 'unknown') + ' · records no token</p>' +
      '<dl class="grid">' +
      '<div><dt>TVL</dt><dd>' + moneyFull(r.tvl_usd) + '</dd></div>' +
      '<div><dt>7-day change</dt><dd>' + (r.change_7d === null ? '—' : (r.change_7d > 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</dd></div>' +
      '<div><dt>Age</dt><dd>' + (r.age_days === null ? 'unknown' : r.age_days + ' <small>days</small>') + '</dd></div>' +
      '<div><dt>Implied value</dt><dd>' + moneyFull(r.implied_value_usd) + '</dd></div>' +
      '<div><dt>Plan cash cost</dt><dd>$' + r.econ_cash + ' <small>out of pocket</small></dd></div>' +
      '<div><dt>Implied / hour</dt><dd>' + money(r.econ_iv_per_hour) + ' <small>per farming hour</small></dd></div>' +
      '</dl>' +
      '<div class="formula-box">' + f + '</div>' +
      '<h3>Farm plan — seven steps</h3><ol class="steps">' + steps + '</ol>' +
      '<p class="note">“Records no token” is what the snapshot says, not a claim the protocol has none: ' +
      'a token the record does not carry may still exist. Implied value is the model\u2019s claim from ' +
      'the fitted curve on this snapshot\u2019s traded tokens — never a promise that a token launches, or at this price.</p>';
    box.hidden = false;
    document.querySelectorAll('#rows tr').forEach(function (tr) { tr.classList.toggle('sel', tr.dataset.slug === slug); });
    box.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    if (('replaceState' in history)) history.replaceState(null, '', '#detail=' + slug);
  }

  // ---- already trading ----------------------------------------------------
  $('liveCount').textContent = String(DATA.live_count);
  $('liveRows').innerHTML = live.map(function (p) {
    var ratio = p.tvl_usd > 0 && p.mcap_usd !== null ? (p.mcap_usd / p.tvl_usd).toFixed(2) + 'x' : '—';
    return '<tr><td><span class="name">' + esc(p.name) + '</span><br><span class="slug">' + esc(p.slug) + '</span></td>' +
      '<td>' + esc(p.category || '—') + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td>' +
      '<td class="num">' + (p.mcap_usd === null ? '—' : money(p.mcap_usd)) + '</td>' +
      '<td class="num">' + ratio + '</td>' +
      '<td class="num">' + pct(p.change_7d) + '</td></tr>';
  }).join('');

  // ---- methodology --------------------------------------------------------
  var curve = DATA.curve, blind = DATA.blind;
  $('curveText').innerHTML =
    'The market cap of a traded token grows with its TVL, but not one for one. Fitted on ' +
    '<b>' + curve.n + '</b> traded tokens (one per ticker; ' + curve.excluded_zero_mcap +
    ' traded rows record a market cap of $0 or less and are left out), the curve is ' +
    '<code>ln(market cap) = ' + curve.a.toFixed(3) + ' + ' + curve.b.toFixed(3) + ' × ln(TVL)</code> — ' +
    'a market cap of roughly <b>$' + Math.round(Math.exp(curve.a)).toLocaleString('en-US') + ' × TVL<sup>' + curve.b.toFixed(2) + '</sup></b>. ' +
    'A slope of ' + curve.b.toFixed(2) + ' means doubling TVL lifts the implied value by about ' +
    Math.round((Math.pow(2, curve.b) - 1) * 100) + '%, not 100%. Each category also gets a small intercept, ' +
    'shrunk toward the global curve (weight n/(n+' + curve.shrink_k + ')) — the blind test cannot tell it from the ' +
    'pure curve, and it is what lets the board show rank ranges. In-sample median error is ' + curve.in_sample_male.toFixed(2) + ' log points.';

  // Scatter chart: log10 TVL against log10 market cap, with the fitted line.
  (function chart() {
    var pts = (DATA.curve_points || []).filter(function (p) { return p.tvl > 0 && p.mcap > 0; });
    if (!pts.length) return;
    var W = 720, H = 420, padL = 58, padR = 16, padT = 16, padB = 42;
    var xs = pts.map(function (p) { return Math.log10(p.tvl); });
    var ys = pts.map(function (p) { return Math.log10(p.mcap); });
    var x0 = Math.floor(Math.min.apply(null, xs)), x1 = Math.ceil(Math.max.apply(null, xs));
    var y0 = Math.floor(Math.min.apply(null, ys)), y1 = Math.ceil(Math.max.apply(null, ys));
    function X(v) { return padL + (v - x0) / (x1 - x0) * (W - padL - padR); }
    function Y(v) { return H - padB - (v - y0) / (y1 - y0) * (H - padT - padB); }
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Log market cap against log TVL for the traded comparables">';
    for (var gx = x0; gx <= x1; gx++) {
      svg += '<line x1="' + X(gx) + '" y1="' + Y(y0) + '" x2="' + X(gx) + '" y2="' + Y(y1) + '" stroke="#dfe3ea"/>' +
        '<text x="' + X(gx) + '" y="' + (H - padB + 18) + '" font-size="11" fill="#5b6472" text-anchor="middle">$10^' + gx + '</text>';
    }
    for (var gy = y0; gy <= y1; gy++) {
      svg += '<line x1="' + X(x0) + '" y1="' + Y(gy) + '" x2="' + X(x1) + '" y2="' + Y(gy) + '" stroke="#dfe3ea"/>' +
        '<text x="' + (padL - 8) + '" y="' + (Y(gy) + 4) + '" font-size="11" fill="#5b6472" text-anchor="end">$10^' + gy + '</text>';
    }
    svg += '<text x="' + (W / 2) + '" y="' + (H - 6) + '" font-size="12" fill="#5b6472" text-anchor="middle">TVL (log scale)</text>';
    svg += '<text x="14" y="' + (H / 2) + '" font-size="12" fill="#5b6472" text-anchor="middle" transform="rotate(-90 14 ' + (H / 2) + ')">Market cap (log scale)</text>';
    svg += pts.map(function (p) {
      return '<circle cx="' + X(Math.log10(p.tvl)).toFixed(1) + '" cy="' + Y(Math.log10(p.mcap)).toFixed(1) + '" r="3.2" fill="#2f4bd7" opacity="0.65"/>';
    }).join('');
    var lx0 = x0, lx1 = x1;
    var ly0 = (curve.a + curve.b * lx0 * Math.LN10) / Math.LN10;
    var ly1 = (curve.a + curve.b * lx1 * Math.LN10) / Math.LN10;
    svg += '<line x1="' + X(lx0) + '" y1="' + Y(ly0) + '" x2="' + X(lx1) + '" y2="' + Y(ly1) + '" stroke="#b3261e" stroke-width="2.5"/>';
    svg += '<text x="' + (X(lx1) - 4) + '" y="' + (Y(ly1) - 8) + '" font-size="12" fill="#b3261e" text-anchor="end">fitted curve, slope ' + curve.b.toFixed(2) + '</text>';
    svg += '</svg>';
    $('chart').innerHTML = svg;
  })();

  // Blind-test tables.
  (function blindTables() {
    var b = blind;
    function row(label, f, c, pc, cu, best) {
      function cell(v, isBest) { return '<td class="num' + (isBest ? ' best' : '') + '">' + v.toFixed(2) + '</td>'; }
      return '<tr><td>' + label + '</td>' + cell(f, best === 'flat') + cell(c, best === 'cat') + cell(pc, best === 'pure') + cell(cu, best === 'curve') + '</tr>';
    }
    function bestOf(o) {
      var m = Math.min(o.flat, o.cat_median, o.pure_curve, o.curve);
      return m === o.curve ? 'curve' : m === o.pure_curve ? 'pure' : m === o.cat_median ? 'cat' : 'flat';
    }
    var cvHtml = '<table><thead><tr><th>Cross-validation (' + b.cv_repeats + ' repeats × ' + b.cv_folds + ' folds)</th><th class="num">Flat multiple</th><th class="num">Category median</th><th class="num">Pure curve</th><th class="num">Curve + category</th></tr></thead><tbody>' +
      row('Median held-out log error', b.cv.flat, b.cv.cat_median, b.cv.pure_curve, b.cv.curve, bestOf(b.cv)) + '</tbody></table>';
    var wfRows = b.walk_forward.map(function (w) {
      return row('Listed before ' + w.cutoff + ' → after (' + w.train + ' fit, ' + w.test + ' tested)', w.flat, w.cat_median, w.pure_curve, w.curve, bestOf(w));
    }).join('');
    var wfHtml = '<table><thead><tr><th>Walk-forward: fit older, test newer</th><th class="num">Flat multiple</th><th class="num">Category median</th><th class="num">Pure curve</th><th class="num">Curve + category</th></tr></thead><tbody>' + wfRows + '</tbody></table>';
    $('blindTables').innerHTML = cvHtml + wfHtml;
  })();

  $('termsText').innerHTML =
    'The pure curve (no category term) scores <b>' + blind.terms.pure_curve.toFixed(2) + '</b> on the same walk-forward test; ' +
    'the kept curve with shrunk category intercepts scores <b>' + blind.terms.curve.toFixed(2) + '</b>. The two are within ' +
    'the noise between cutoffs, so the board keeps the latter — it is the one that can show rank ranges. Three further ' +
    'additions were tried on the same test and dropped: adding the 7-day growth term scores <b>' + blind.terms.growth.toFixed(2) +
    '</b>; adding growth, age and chain count scores <b>' + blind.terms.growth_age_chains.toFixed(2) +
    '</b>; a robust Theil–Sen fit scores <b>' + blind.terms.theil_sen.toFixed(2) + '</b> walk-forward but <b>' +
    blind.cv.theil_sen.toFixed(2) + '</b> on cross-validation, against <b>' + blind.cv.curve.toFixed(2) +
    '</b> for the kept curve — the two tests disagree, so the simpler OLS fit is kept.';

  var widths = rows.map(function (r) { return r.rank_hi - r.rank_lo; }).sort(function (a, b) { return a - b; });
  var medWidth = widths.length ? widths[Math.floor(widths.length / 2)] : 0;
  $('bootText').textContent =
    'The curve was refitted ' + DATA.bootstrap_refits + ' times on resampled comparables, and the whole board was ' +
    're-ranked each time. Every row carries the 5th–95th percentile of its rank across those refits: the median ' +
    'row moves ' + medWidth + ' places. A narrow range means the curve is sure about that row; a wide one means ' +
    'its value is close to its neighbours and the order between them is fragile.';

  $('compRows').innerHTML = (DATA.comps || []).map(function (c) {
    return '<tr><td>' + esc(c.category) + '</td><td class="num">' + c.n + '</td><td class="num">' + c.multiple.toFixed(3) + 'x</td></tr>';
  }).join('') + '<tr><td><b>Whole market (fallback)</b></td><td class="num">—</td><td class="num"><b>' + DATA.overall_comp.toFixed(3) + 'x</b></td></tr>';

  // ---- views, controls, deep links ---------------------------------------
  var views = { board: $('boardView'), live: $('liveView'), method: $('methodView') };
  function show(view) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== view; });
    document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.toggle('on', b.dataset.view === view); });
    $('controls').style.display = view === 'board' ? '' : 'none';
  }
  document.querySelectorAll('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () { show(b.dataset.view); });
  });
  $('q').addEventListener('input', function () { state.q = this.value; renderBoard(); });
  $('cat').addEventListener('change', function () { state.cat = this.value; renderBoard(); });
  $('chain').addEventListener('change', function () { state.chain = this.value; renderBoard(); });
  $('mintvl').addEventListener('change', function () { state.mintvl = Number(this.value); renderBoard(); });
  $('watch').addEventListener('change', function () { state.watch = this.checked; renderBoard(); });
  $('sort').addEventListener('change', function () { state.sort = this.value; state.dir = this.value === 'name' ? 1 : -1; renderBoard(); });
  $('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr');
    if (tr) openDetail(tr.dataset.slug);
  });
  document.querySelectorAll('#board thead th').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.dataset.k;
      if (k === 'rank' || k === 'iv') { state.sort = 'rank'; state.dir = -1; $('sort').value = 'rank'; }
      else if (k === 'tvl') { state.sort = 'tvl'; state.dir = -1; $('sort').value = 'tvl'; }
      else if (k === 'g7') { state.sort = 'growth'; state.dir = -1; $('sort').value = 'growth'; }
      else if (k === 'age') { state.sort = 'age'; state.dir = -1; $('sort').value = 'age'; }
      else if (k === 'name') { state.sort = 'name'; state.dir = 1; $('sort').value = 'name'; }
      else return;
      renderBoard();
    });
  });

  // Deep links: #detail=<slug>, #view=live|method, #cat=, #chain=, #q=, #watch=1
  (function hash() {
    var h = (location.hash || '').slice(1);
    if (!h) return;
    var parts = {};
    h.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) parts[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
    });
    if (parts.view && views[parts.view]) show(parts.view);
    if (parts.cat) { state.cat = parts.cat; $('cat').value = parts.cat; }
    if (parts.chain) { state.chain = parts.chain; $('chain').value = parts.chain; }
    if (parts.q) { state.q = parts.q; $('q').value = parts.q; }
    if (parts.watch) { state.watch = true; $('watch').checked = true; }
    if (parts.mintvl) { state.mintvl = Number(parts.mintvl); $('mintvl').value = parts.mintvl; }
    if (parts.sort) { state.sort = parts.sort; $('sort').value = parts.sort; }
    renderBoard();
    if (parts.detail) openDetail(parts.detail);
  })();

  renderBoard();
})();
