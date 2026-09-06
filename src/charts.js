/* ===========================================================
   SAMARTH · SVG chart primitives
   No chart library. One scale per drawing places marks, ticks
   and labels; all colour comes from the theme tokens so every
   chart reads correctly in light and dark.
   =========================================================== */
(function (NX) {
  'use strict';
  var CH = {};
  NX.charts = CH;

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  CH.esc = esc;
  function r1(n) { return Math.round(n * 10) / 10; }

  /* ---------- Radar: current vs target across the four domains ---------- */
  CH.radar = function (domains, cur, tgt, opts) {
    opts = opts || {};
    var W = 360, H = 300, cx = W / 2, cy = 140, R = 88, MAX = 5;
    var n = domains.length, i, a, pts = [];
    function pt(idx, val) {
      var ang = (Math.PI * 2 * idx) / n - Math.PI / 2;
      var rr = (val / MAX) * R;
      return [cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr];
    }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Competency radar, current against role target">';

    // rings at each proficiency level
    for (i = 1; i <= MAX; i++) {
      var ring = [];
      for (a = 0; a < n; a++) ring.push(pt(a, i).map(r1).join(','));
      s += '<polygon points="' + ring.join(' ') + '" fill="none" stroke="var(--grid-line)" stroke-width="1"/>';
    }
    for (a = 0; a < n; a++) {
      var e = pt(a, MAX).map(r1);
      s += '<line x1="' + cx + '" y1="' + cy + '" x2="' + e[0] + '" y2="' + e[1] + '" stroke="var(--grid-line)" stroke-width="1"/>';
    }

    // target ring
    pts = [];
    for (a = 0; a < n; a++) pts.push(pt(a, tgt[a]).map(r1).join(','));
    s += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="var(--text-3)" stroke-width="1.5" stroke-dasharray="4 3"/>';

    // current
    pts = [];
    for (a = 0; a < n; a++) pts.push(pt(a, cur[a]).map(r1).join(','));
    s += '<polygon points="' + pts.join(' ') + '" fill="var(--accent)" fill-opacity="0.18" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>';
    for (a = 0; a < n; a++) {
      var p = pt(a, cur[a]).map(r1);
      s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.4" fill="var(--accent)" stroke="var(--surface)" stroke-width="1.5"/>';
    }

    // axis labels, placed outside the outer ring
    for (a = 0; a < n; a++) {
      var lp = pt(a, MAX + 1.18);
      var anchor = Math.abs(lp[0] - cx) < 6 ? 'middle' : (lp[0] > cx ? 'start' : 'end');
      var dy = lp[1] < cy - 20 ? -4 : (lp[1] > cy + 20 ? 12 : 0);
      s += '<text x="' + r1(lp[0]) + '" y="' + r1(lp[1] + dy) + '" text-anchor="' + anchor +
        '" font-family="var(--f-mono)" font-size="9.5" fill="var(--text-3)" letter-spacing="0.08em">' +
        esc(domains[a].toUpperCase()) + '</text>';
      s += '<text x="' + r1(lp[0]) + '" y="' + r1(lp[1] + dy + 13) + '" text-anchor="' + anchor +
        '" font-family="var(--f-mono)" font-size="12" font-weight="600" fill="var(--text)">' +
        r1(cur[a]) + '<tspan fill="var(--text-3)" font-weight="400" font-size="11"> / ' + r1(tgt[a]) + '</tspan></text>';
    }

    // legend
    s += '<g transform="translate(' + (cx - 74) + ',' + (H - 6) + ')">' +
      '<rect x="0" y="-8" width="11" height="4" rx="1" fill="var(--accent)"/>' +
      '<text x="16" y="-4" font-size="10.5" font-family="var(--f-sans)" fill="var(--text-2)">Current</text>' +
      '<rect x="74" y="-8" width="11" height="4" rx="1" fill="var(--text-3)"/>' +
      '<text x="90" y="-4" font-size="10.5" font-family="var(--f-sans)" fill="var(--text-2)">Role target</text>' +
      '</g>';
    return s + '</svg>';
  };

  /* ---------- Horizontal bars ---------- */
  CH.hbars = function (items, opts) {
    opts = opts || {};
    var labelW = opts.labelW || 168, valW = 46, rowH = opts.rowH || 24, gap = 7;
    var W = 520, H = items.length * (rowH + gap) + 22;
    var plotW = W - labelW - valW - 10;
    var max = opts.max || Math.max.apply(null, items.map(function (d) { return d.v; })) || 1;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(opts.aria || 'Bar chart') + '">';

    // gridlines + axis ticks
    var ticks = opts.ticks || 4, t;
    for (t = 0; t <= ticks; t++) {
      var x = labelW + (plotW * t) / ticks;
      s += '<line x1="' + r1(x) + '" y1="0" x2="' + r1(x) + '" y2="' + (H - 20) + '" stroke="var(--grid-line)" stroke-width="1"/>';
      s += '<text x="' + r1(x) + '" y="' + (H - 7) + '" text-anchor="middle" font-family="var(--f-mono)" font-size="9" fill="var(--text-3)">' +
        (opts.fmtTick ? opts.fmtTick(max * t / ticks) : r1(max * t / ticks)) + '</text>';
    }

    items.forEach(function (d, i) {
      var y = i * (rowH + gap) + 2, w = Math.max(2, (d.v / max) * plotW);
      s += '<text x="' + (labelW - 9) + '" y="' + (y + rowH / 2 + 3.5) + '" text-anchor="end" font-family="var(--f-sans)" font-size="11.5" fill="var(--text-2)">' + esc(d.label) + '</text>';
      s += '<rect x="' + labelW + '" y="' + y + '" width="' + r1(plotW) + '" height="' + rowH + '" rx="1" fill="var(--surface-2)"/>';
      s += '<rect x="' + labelW + '" y="' + y + '" width="' + r1(w) + '" height="' + rowH + '" rx="1" fill="' + (d.colour || 'var(--accent)') + '"/>';
      s += '<text x="' + (labelW + plotW + 8) + '" y="' + (y + rowH / 2 + 3.5) + '" font-family="var(--f-mono)" font-size="11" fill="var(--text)">' +
        esc(d.vl !== undefined ? d.vl : r1(d.v)) + '</text>';
    });
    return s + '</svg>';
  };

  /* ---------- Grouped current/target columns ---------- */
  CH.columns = function (items, opts) {
    opts = opts || {};
    var W = 460, H = 190, padL = 30, padR = 8, padT = 12, padB = 40;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var max = opts.max || 5, n = items.length;
    var slot = plotW / n, bw = Math.min(26, slot * 0.30);
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(opts.aria || 'Column chart') + '">';
    var t;
    for (t = 0; t <= max; t++) {
      var y = padT + plotH - (t / max) * plotH;
      s += '<line x1="' + padL + '" y1="' + r1(y) + '" x2="' + (W - padR) + '" y2="' + r1(y) + '" stroke="var(--grid-line)" stroke-width="1"/>';
      s += '<text x="' + (padL - 7) + '" y="' + r1(y + 3.5) + '" text-anchor="end" font-family="var(--f-mono)" font-size="9" fill="var(--text-3)">' + t + '</text>';
    }
    items.forEach(function (d, i) {
      var cx = padL + slot * i + slot / 2;
      var hc = (d.cur / max) * plotH, ht = (d.tgt / max) * plotH;
      s += '<rect x="' + r1(cx - bw - 2) + '" y="' + r1(padT + plotH - ht) + '" width="' + r1(bw) + '" height="' + r1(ht) +
        '" rx="1" fill="var(--surface-3)"/>';
      s += '<rect x="' + r1(cx + 2) + '" y="' + r1(padT + plotH - hc) + '" width="' + r1(bw) + '" height="' + r1(hc) +
        '" rx="1" fill="var(--accent)"/>';
      s += '<text x="' + r1(cx) + '" y="' + (H - 22) + '" text-anchor="middle" font-family="var(--f-mono)" font-size="9.5" letter-spacing="0.07em" fill="var(--text-3)">' + esc(d.label.toUpperCase()) + '</text>';
      s += '<text x="' + r1(cx) + '" y="' + (H - 8) + '" text-anchor="middle" font-family="var(--f-mono)" font-size="11" fill="var(--text)">' + r1(d.cur) + ' / ' + r1(d.tgt) + '</text>';
    });
    s += '<g transform="translate(' + padL + ',' + (padT - 2) + ')">' +
      '<rect x="0" y="0" width="9" height="9" rx="1" fill="var(--surface-3)"/>' +
      '<text x="13" y="8" font-size="10" font-family="var(--f-sans)" fill="var(--text-3)">Target</text>' +
      '<rect x="58" y="0" width="9" height="9" rx="1" fill="var(--accent)"/>' +
      '<text x="71" y="8" font-size="10" font-family="var(--f-sans)" fill="var(--text-3)">Current</text></g>';
    return s + '</svg>';
  };

  /* ---------- Area line with emphasised endpoint ---------- */
  CH.line = function (series, opts) {
    opts = opts || {};
    var W = 480, H = 168, padL = 34, padR = 44, padT = 14, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var vals = series.map(function (d) { return d.v; });
    var lo = opts.min !== undefined ? opts.min : Math.min.apply(null, vals) - 3;
    var hi = opts.max !== undefined ? opts.max : Math.max.apply(null, vals) + 3;
    function X(i) { return padL + (plotW * i) / (series.length - 1 || 1); }
    function Y(v) { return padT + plotH - ((v - lo) / (hi - lo || 1)) * plotH; }

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(opts.aria || 'Trend line') + '">';
    var t, ticks = 4;
    for (t = 0; t <= ticks; t++) {
      var v = lo + ((hi - lo) * t) / ticks, y = Y(v);
      s += '<line x1="' + padL + '" y1="' + r1(y) + '" x2="' + (W - padR) + '" y2="' + r1(y) + '" stroke="var(--grid-line)" stroke-width="1"/>';
      s += '<text x="' + (padL - 7) + '" y="' + r1(y + 3.5) + '" text-anchor="end" font-family="var(--f-mono)" font-size="9" fill="var(--text-3)">' + Math.round(v) + '</text>';
    }
    var d = '', area = '';
    series.forEach(function (p, i) {
      d += (i ? ' L' : 'M') + r1(X(i)) + ' ' + r1(Y(p.v));
    });
    area = d + ' L' + r1(X(series.length - 1)) + ' ' + r1(padT + plotH) + ' L' + r1(X(0)) + ' ' + r1(padT + plotH) + ' Z';
    s += '<path d="' + area + '" fill="var(--accent)" fill-opacity="0.13"/>';
    s += '<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';

    series.forEach(function (p, i) {
      if (i % 2 === 0 || i === series.length - 1) {
        s += '<text x="' + r1(X(i)) + '" y="' + (H - 8) + '" text-anchor="middle" font-family="var(--f-mono)" font-size="9" fill="var(--text-3)">' + esc(p.label) + '</text>';
      }
    });
    var last = series.length - 1;
    s += '<circle cx="' + r1(X(last)) + '" cy="' + r1(Y(series[last].v)) + '" r="4" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>';
    s += '<text x="' + r1(X(last) + 9) + '" y="' + r1(Y(series[last].v) + 4) + '" font-family="var(--f-mono)" font-size="12" font-weight="600" fill="var(--accent)">' + r1(series[last].v) + '%</text>';
    return s + '</svg>';
  };

  /* ---------- Readiness arc ---------- */
  CH.gauge = function (pct, opts) {
    opts = opts || {};
    var W = 190, H = 118, cx = 95, cy = 96, R = 74, sw = 13;
    function arc(from, to) {
      var a0 = Math.PI + Math.PI * from, a1 = Math.PI + Math.PI * to;
      var x0 = cx + Math.cos(a0) * R, y0 = cy + Math.sin(a0) * R;
      var x1 = cx + Math.cos(a1) * R, y1 = cy + Math.sin(a1) * R;
      // the gauge spans a half turn, so no sweep here can exceed 180 degrees:
      // the large-arc flag must stay 0 or the path doubles back below the viewBox
      return 'M' + r1(x0) + ' ' + r1(y0) + ' A' + R + ' ' + R + ' 0 0 1 ' + r1(x1) + ' ' + r1(y1);
    }
    var f = Math.max(0.004, Math.min(1, pct / 100));
    var col = pct >= 75 ? 'var(--good)' : pct >= 55 ? 'var(--accent)' : pct >= 40 ? 'var(--warn)' : 'var(--critical)';
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Readiness ' + Math.round(pct) + ' per cent">';
    s += '<path d="' + arc(0, 1) + '" fill="none" stroke="var(--track)" stroke-width="' + sw + '" stroke-linecap="round"/>';
    s += '<path d="' + arc(0, f) + '" fill="none" stroke="' + col + '" stroke-width="' + sw + '" stroke-linecap="round"/>';
    s += '<text x="' + cx + '" y="' + (cy - 12) + '" text-anchor="middle" font-family="var(--f-mono)" font-size="31" font-weight="600" letter-spacing="-0.01em" fill="var(--text)">' +
      Math.round(pct) + '<tspan font-size="15" fill="var(--text-3)">%</tspan></text>';
    s += '<text x="' + cx + '" y="' + (cy + 6) + '" text-anchor="middle" font-family="var(--f-mono)" font-size="9" letter-spacing="0.12em" fill="var(--text-3)">' +
      esc((opts.label || 'ROLE READINESS').toUpperCase()) + '</text>';
    s += '<text x="' + (cx - R) + '" y="' + (cy + 16) + '" text-anchor="middle" font-family="var(--f-mono)" font-size="9" fill="var(--text-3)">0</text>';
    s += '<text x="' + (cx + R) + '" y="' + (cy + 16) + '" text-anchor="middle" font-family="var(--f-mono)" font-size="9" fill="var(--text-3)">100</text>';
    return s + '</svg>';
  };

  /* ---------- Donut for categorical splits ---------- */
  CH.donut = function (segs, opts) {
    opts = opts || {};
    var W = 150, H = 150, cx = 75, cy = 75, R = 58, r = 36;
    var total = segs.reduce(function (s2, d) { return s2 + d.v; }, 0) || 1;
    var a0 = -Math.PI / 2, s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(opts.aria || 'Distribution') + '">';
    segs.forEach(function (d) {
      var a1 = a0 + (d.v / total) * Math.PI * 2;
      var large = a1 - a0 > Math.PI ? 1 : 0;
      var p = 'M' + r1(cx + Math.cos(a0) * R) + ' ' + r1(cy + Math.sin(a0) * R) +
        ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + r1(cx + Math.cos(a1) * R) + ' ' + r1(cy + Math.sin(a1) * R) +
        ' L' + r1(cx + Math.cos(a1) * r) + ' ' + r1(cy + Math.sin(a1) * r) +
        ' A' + r + ' ' + r + ' 0 ' + large + ' 0 ' + r1(cx + Math.cos(a0) * r) + ' ' + r1(cy + Math.sin(a0) * r) + ' Z';
      s += '<path d="' + p + '" fill="' + d.colour + '" stroke="var(--surface)" stroke-width="1.5"/>';
      a0 = a1;
    });
    s += '<text x="' + cx + '" y="' + (cy - 1) + '" text-anchor="middle" font-family="var(--f-mono)" font-size="19" font-weight="600" fill="var(--text)">' + esc(opts.centre || total) + '</text>';
    s += '<text x="' + cx + '" y="' + (cy + 13) + '" text-anchor="middle" font-family="var(--f-mono)" font-size="8.5" letter-spacing="0.1em" fill="var(--text-3)">' + esc((opts.centreLabel || '').toUpperCase()) + '</text>';
    return s + '</svg>';
  };

  /* ---------- Heat cell styling ----------
     Blends the severity colour toward the page surface, so the
     ramp stays legible on either ground.                        */
  CH.heatStyle = function (pct) {
    var p = Math.max(0, Math.min(100, pct));
    var col = p >= 82 ? 'var(--good)' : p >= 68 ? 'var(--accent)' : p >= 55 ? 'var(--warn)' : 'var(--critical)';
    // intensity: distance from the "fully ready" end of the scale
    var i = Math.round(18 + (100 - p) * 0.78);
    i = Math.max(14, Math.min(94, i));
    var fg = i > 55 ? 'var(--surface)' : 'var(--text)';
    return 'background:color-mix(in srgb, ' + col + ' ' + i + '%, var(--surface));color:' + fg + ';';
  };

  /* ---------- Stacked "why this was recommended" bar ---------- */
  CH.whyBar = function (contrib, total) {
    var s = '';
    NX.engine.WEIGHTS.forEach(function (w) {
      var pct = total ? (contrib[w.k] / total) * 100 : 0;
      if (pct <= 0.4) return;
      s += '<span style="width:' + r1(pct) + '%;background:' + w.colour + '" title="' + esc(w.label) + '"></span>';
    });
    return '<span class="why">' + s + '</span>';
  };
})(window.NX);
