/* ===========================================================
   SAMARTH · officer-facing views
   =========================================================== */
(function (NX) {
  'use strict';
  NX.views = NX.views || {};
  var V = NX.views, A = NX.app, E = NX.engine, CH = NX.charts;
  var esc = CH.esc;

  function r1(n) { return Math.round(n * 10) / 10; }

  /* ---------- shared: a single recommendation row ---------- */
  function courseRow(r, rank, showActions) {
    var c = r.course, total = r.score / 100;
    var hits = r.hits.slice(0, 2).map(function (h) {
      return '<span class="tag tag--accent">' + esc(h.id) + ' · gap ' + r1(h.gap) + '</span>';
    }).join(' ');

    var top = E.WEIGHTS.slice().sort(function (a, b) { return r.contrib[b.k] - r.contrib[a.k]; }).slice(0, 2);

    var s = '<div class="course">';
    s += '<div class="course__rank">' + (rank === undefined ? A.icon('spark') : rank) + '</div>';
    s += '<div><div class="course__t">' + esc(c.title) + '</div>' +
      '<div class="course__m"><span class="mono" title="' + esc(c.id) + '">' + esc(A.courseCode(c)) + '</span>' +
      A.originTag(c) +
      '<span>·</span><span>' + esc(c.provider) + '</span>' +
      '<span>·</span><span>' + c.hours + ' h</span><span>·</span>' +
      '<span>Level ' + c.level + '</span><span>·</span>' +
      '<span>' + esc(c.lang) + '</span></div>' +
      '<div class="course__d">' + esc(c.text.split('. ')[0]) + '.</div>' +
      '<div class="course__m" style="margin-top:8px">' + hits +
      (r.alreadyDone ? '<span class="tag tag--good">Already completed</span>' : '') + '</div>';
    if (showActions) {
      s += '<div class="course__m" style="margin-top:9px;color:var(--text-3)">' +
        'Matched on <span class="mono">' + esc(r.terms.slice(0, 4).join(', ')) + '</span></div>';
    }
    s += '</div>';

    s += '<div class="course__right"><div class="matchscore">' + Math.round(r.score) + '<span style="font-size:12px;color:var(--text-3)">%</span></div>';
    s += CH.whyBar(r.contrib, total);
    s += '<div class="whykey">';
    top.forEach(function (w) {
      s += '<div><span class="dot" style="background:' + w.colour + '"></span>' + esc(w.label.split(' ')[0]) +
        '<span class="kv">' + Math.round((r.contrib[w.k] / total) * 100) + '%</span></div>';
    });
    s += '</div>';
    if (showActions && !r.alreadyDone) {
      s += '<button class="btn btn--sm" data-complete="' + c.id + '">Mark complete</button>';
    }
    s += '</div></div>';
    return s;
  }

  /* ===========================================================
     OVERVIEW
     =========================================================== */
  V.overview = function () {
    var o = A.officer(), p = A.profile();
    var recs = E.recommend(p, { hideDone: true });
    var top3 = recs.slice(0, 3);
    var pathPlan = E.buildPath(recs, A.state.budget);
    var quizzes = (o.assessments || []).length;

    var domCur = NX.DOMAINS.map(function (d) { return p.domain[d.id].cur; });
    var domTgt = NX.DOMAINS.map(function (d) { return p.domain[d.id].tgt; });

    var s = '';
    s += '<div class="pagehead"><div class="pagehead__t">' +
      '<div class="eyebrow">' + esc(o.batch) + ' · ' + esc(NX.roleById[o.role].cadre) + '</div>' +
      '<h1>' + esc(o.name) + '</h1>' +
      '<p class="pagehead__d">' + esc(NX.roleById[o.role].name) + ' · ' + esc(o.posting) + ', ' + esc(o.station) +
      ' · ' + o.exp + ' years of service. ' + esc(o.note) + '</p></div>' +
      '<div class="pagehead__actions">' +
      '<button class="btn" data-go="competency">' + A.icon('target') + 'View full profile</button>' +
      '<button class="btn btn--primary" data-go="path">' + A.icon('route') + 'Open learning path</button>' +
      '</div></div>';

    /* guided route — this is a live product, but the demo has an order */
    s += '<div class="demopath" style="margin-bottom:16px">' +
      [['01', 'Competency profile', 'Built from role, service record & assessments'],
        ['02', 'Gap analysis', NX.NC + ' competencies scored against the role matrix'],
        ['03', 'Learning path', 'Ranked iGOT modules with an explainable score'],
        ['04', 'Assessment Studio', 'Upload material, generate a validated quiz'],
        ['05', 'Workforce view', 'Profiled officials, live aggregates']]
        .map(function (x, i) {
          var target = ['competency', 'competency', 'path', 'studio', 'analytics'][i];
          return '<button data-go="' + target + '"><div class="demopath__n">' + x[0] + '</div>' +
            '<div class="demopath__t">' + esc(x[1]) + '</div><div class="demopath__d">' + esc(x[2]) + '</div></button>';
        }).join('') + '</div>';

    /* headline figures */
    s += '<div class="grid g-5">' +
      A.stat('Role readiness', Math.round(p.readiness) + '<small>%</small>',
        'Weighted by mission criticality', p.readiness >= 70 ? 'good' : p.readiness >= 55 ? 'lift' : 'warn') +
      A.stat('Critical gaps', String(p.criticalCount),
        'Of ' + NX.NC + ' mapped competencies', p.criticalCount ? 'crit' : 'good') +
      A.stat('Recommended', pathPlan.count + '<small> modules</small>', 'From ' + A.num(NX.COURSES.length) + ' catalogue modules', 'lift') +
      A.stat('Assessments taken', String(quizzes), quizzes ? 'Feeding the competency vector' : 'None yet — try the Studio') +
      A.stat('Karmayogi credits', A.num(o.trainings.length * 40 + quizzes * 15), 'Earned on completed modules') +
      '</div>';

    /* snapshot + priorities */
    s += '<div class="grid g-main" style="margin-top:15px">';

    s += '<div class="panel"><div class="panel__head"><div><h3>Competency snapshot</h3></div>' +
      '<span class="tag tag--accent hstretch">' + NX.NC + ' competencies</span></div>' +
      '<div class="panel__body"><div class="grid g-2" style="gap:10px;align-items:center">' +
      '<div>' + CH.radar(NX.DOMAINS.map(function (d) { return d.short; }), domCur, domTgt) + '</div>' +
      '<div>' + CH.columns(NX.DOMAINS.map(function (d) {
        return { label: d.id, cur: p.domain[d.id].cur, tgt: p.domain[d.id].tgt };
      }), { aria: 'Attainment by domain' }) + '</div>' +
      '</div></div></div>';

    s += '<div class="panel"><div class="panel__head"><div><h3>Priority gaps</h3>' +
      '<div class="sub">Ranked by shortfall × mission criticality</div></div></div>' +
      '<div>' + p.ranked.slice(0, 6).map(function (g) {
        return '<div style="padding:10px 16px;border-bottom:1px solid var(--line-soft)">' +
          '<div class="row between" style="gap:8px"><div style="min-width:0">' +
          '<div style="font-size:13px;font-weight:500">' + esc(g.name) + '</div>' +
          '<div class="row" style="gap:6px;margin-top:3px"><span class="tag">' + esc(g.id) + '</span>' +
          A.sevTag(g.sev, g.sev === 'crit' ? 'Critical' : g.sev === 'warn' ? 'Moderate' : g.sev === 'info' ? 'Minor' : 'Met') +
          '<span class="muted" style="font-size:11px">criticality ' + g.crit + '</span></div></div>' +
          '<div style="text-align:right;flex:none">' + A.pips(g.cur, g.tgt) +
          '<div class="num" style="font-size:11px;color:var(--text-3);margin-top:4px">' + r1(g.cur) + ' → ' + g.tgt + '</div></div>' +
          '</div></div>';
      }).join('') + '</div>' +
      '<div class="panel__foot"><button class="btn btn--sm" data-go="competency">See all ' + NX.NC + ' competencies</button></div></div>';

    s += '</div>';

    /* next best modules */
    s += '<div class="section-title"><h2>Next best modules</h2><div class="rule"></div>' +
      '<button class="btn btn--sm" data-go="path">Full path</button></div>';
    s += '<div class="panel">' + top3.map(function (r, i) { return courseRow(r, i + 1, false); }).join('') + '</div>';

    return s;
  };

  /* ===========================================================
     COMPETENCY PROFILE
     =========================================================== */
  V.competency = function () {
    var o = A.officer(), p = A.profile(), role = NX.roleById[o.role];
    var f = A.state.compFilter;
    var rows = p.gaps.filter(function (g) { return f === 'ALL' || g.d === f; })
      .sort(function (a, b) { return b.priority - a.priority; });

    var domCur = NX.DOMAINS.map(function (d) { return p.domain[d.id].cur; });
    var domTgt = NX.DOMAINS.map(function (d) { return p.domain[d.id].tgt; });

    var s = '';
    s += '<div class="pagehead"><div class="pagehead__t"><div class="eyebrow">Competency profile</div>' +
      '<h1>' + esc(o.name) + ' — gap analysis</h1>' +
      '<p class="pagehead__d">Each of the ' + NX.NC + ' competencies is scored 0–5 and benchmarked against the ' +
      esc(role.name) + ' target matrix. Attainment is inferred from four evidence sources, weighted by reliability.</p></div>' +
      '<div class="pagehead__actions"><button class="btn btn--primary" data-go="path">' + A.icon('route') + 'Recommend training</button></div></div>';

    s += '<div class="grid g-side">';

    /* ---- evidence panel ---- */
    var W = { self: 30, qual: 20, train: 30, assess: 20 };
    var labels = { self: 'Self-assessment', qual: 'Qualifications', train: 'Training history', assess: 'Assessment scores' };
    var detail = {
      self: 'Structured ' + NX.NC + '-item self-rating captured at profile setup.',
      qual: o.qual.join(', ') || 'Not recorded',
      train: o.trainings.length + ' completed programmes, recency-decayed',
      assess: (o.assessments || []).length ? (o.assessments || []).length + ' quizzes generated from uploaded material' : 'No assessment evidence yet'
    };

    s += '<div class="stack">';
    s += '<div class="panel"><div class="panel__head"><h3>Readiness</h3></div>' +
      '<div class="panel__body">' + CH.gauge(p.readiness) +
      '<div class="grid g-2" style="gap:8px;margin-top:10px">' +
      NX.DOMAINS.map(function (d) {
        var b = p.domain[d.id];
        return '<div style="padding:8px 10px;border:1px solid var(--line-soft);border-radius:var(--r-md)">' +
          '<div class="stat__k">' + esc(d.short) + '</div>' +
          '<div class="num" style="font-size:17px;font-weight:600">' + Math.round(b.pct) + '<span style="font-size:11px;color:var(--text-3)">%</span></div>' +
          '<div class="meter" style="margin-top:5px"><div class="meter__fill" style="width:' + Math.round(b.pct) + '%;background:' + A.domainColour(d.id) + '"></div></div>' +
          '</div>';
      }).join('') + '</div></div></div>';

    s += '<div class="panel"><div class="panel__head"><div><h3>Evidence sources</h3>' +
      '<div class="sub">How attainment is inferred</div></div></div><div class="panel__body stack-sm">';
    // weights renormalise over whatever evidence actually exists, so the bar
    // shows the effective share this source carries for THIS officer
    var liveTotal = 0;
    Object.keys(W).forEach(function (k) { if (p.components[k]) liveTotal += W[k]; });

    Object.keys(W).forEach(function (k) {
      var live = !!p.components[k];
      var eff = live && liveTotal ? (W[k] / liveTotal) * 100 : 0;
      s += '<div style="opacity:' + (live ? 1 : 0.5) + '">' +
        '<div class="row between"><span style="font-size:12.5px;font-weight:500">' + esc(labels[k]) + '</span>' +
        '<span class="num" style="font-size:11px;color:var(--text-3)">' +
        (live ? (Math.abs(eff - W[k]) > 0.6 ? W[k] + '% → ' + r1(eff) + '%' : W[k] + '%') : 'no data') +
        '</span></div>' +
        '<div class="meter" style="margin-top:4px"><div class="meter__fill" style="width:' + r1(eff) + '%"></div></div>' +
        '<div style="font-size:11.5px;color:var(--text-3);margin-top:4px">' + esc(detail[k]) + '</div></div>';
    });
    s += '</div><div class="panel__foot">Nominal weight first, effective weight after renormalisation. Missing evidence is redistributed rather than scored as zero, so a new recruit is never penalised for a thin record.</div></div>';

    s += '<div class="panel"><div class="panel__head"><div><h3>Service record</h3><div class="sub">Feeds the training signal</div></div></div>' +
      '<div class="panel__body stack-sm">' +
      o.trainings.slice().reverse().map(function (t) {
        var c = NX.courseById[t.c];
        return '<div class="row" style="gap:9px;align-items:flex-start">' +
          '<span class="tag tag--good" style="flex:none">' + t.score + '</span>' +
          '<div style="min-width:0"><div style="font-size:12.5px;line-height:1.4">' + esc(c ? c.title : t.c) + '</div>' +
          '<div class="mono" style="font-size:10.5px;color:var(--text-3)">' + esc(t.on) + ' · ' + esc(c ? c.provider : '') + '</div></div></div>';
      }).join('') +
      ((o.assessments || []).length ? '<div style="height:1px;background:var(--line-soft);margin:4px 0"></div>' +
        o.assessments.map(function (a) {
          return '<div class="row" style="gap:9px;align-items:flex-start">' +
            '<span class="tag ' + (a.pct >= 70 ? 'tag--good' : 'tag--warn') + '" style="flex:none">' + a.pct + '</span>' +
            '<div style="min-width:0"><div style="font-size:12.5px;line-height:1.4">' + esc(a.title) + '</div>' +
            '<div class="mono" style="font-size:10.5px;color:var(--text-3)">Studio assessment · ' + esc(a.comp.join(', ')) + '</div></div></div>';
        }).join('') : '') +
      '</div></div>';
    s += '</div>';

    /* ---- detail table ---- */
    s += '<div class="stack">';
    s += '<div class="panel"><div class="panel__head"><div><h3>Attainment by domain</h3>' +
      '<div class="sub">Mean level across the competencies in each domain</div></div></div>' +
      '<div class="panel__body"><div class="grid g-2" style="align-items:center;gap:12px">' +
      '<div>' + CH.radar(NX.DOMAINS.map(function (d) { return d.short; }), domCur, domTgt) + '</div>' +
      '<div>' + CH.hbars(NX.DOMAINS.map(function (d) {
        return { label: d.short, v: p.domain[d.id].pct, vl: Math.round(p.domain[d.id].pct) + '%', colour: A.domainColour(d.id) };
      }), { max: 100, labelW: 96, rowH: 26, aria: 'Attainment percentage by domain', fmtTick: function (v) { return Math.round(v) + '%'; } }) + '</div>' +
      '</div></div></div>';

    s += '</div></div>';

    /* the register is 34 rows wide - give it the full canvas */
    s += '<div class="panel" style="margin-top:15px"><div class="panel__head"><div><h3>Competency register</h3>' +
      '<div class="sub">' + rows.length + ' shown · sorted by shortfall × criticality</div></div>' +
      '<div class="chips hstretch">' +
      ['ALL'].concat(NX.DOMAINS.map(function (d) { return d.id; })).map(function (id) {
        return '<button class="chip" data-cf="' + id + '"' + (f === id ? ' aria-pressed="true"' : '') + '>' +
          esc(id === 'ALL' ? 'All domains' : A.domainName(id)) + '</button>';
      }).join('') + '</div></div>';

    s += '<div class="tablewrap"><table class="tbl"><thead><tr>' +
      '<th>Code</th><th>Competency</th><th>Domain</th><th class="n">Crit</th>' +
      '<th style="min-width:150px">Attainment</th><th class="n">Current</th><th class="n">Target</th><th class="n">Gap</th><th>Status</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function (g) {
      var curPct = (g.cur / 5) * 100, tgtPct = (g.tgt / 5) * 100;
      s += '<tr><td class="mono" style="font-size:11.5px;color:var(--text-3)">' + esc(g.id) + '</td>' +
        '<td style="font-weight:500">' + esc(g.name) + '</td>' +
        '<td><span class="tag"><span class="dot" style="background:' + A.domainColour(g.d) + '"></span>' + esc(A.domainName(g.d)) + '</span></td>' +
        '<td class="n">' + g.crit + '</td>' +
        '<td><div class="dualbar"><div class="dualbar__target" style="width:' + r1(tgtPct) + '%"></div>' +
        '<div class="dualbar__cur" style="width:' + r1(curPct) + '%"></div></div></td>' +
        '<td class="n">' + r1(g.cur) + '</td><td class="n">' + g.tgt + '</td>' +
        '<td class="n" style="color:' + (g.gap > 0.85 ? 'var(--critical)' : 'var(--text-2)') + '">' + (g.gap > 0.05 ? r1(g.gap) : '—') + '</td>' +
        '<td>' + A.sevTag(g.sev, g.sev === 'crit' ? 'Critical' : g.sev === 'warn' ? 'Moderate' : g.sev === 'info' ? 'Minor' : 'Met') + '</td></tr>';
    });
    s += '</tbody></table></div>' +
      '<div class="panel__foot">Levels: 1 Aware · 2 Working · 3 Practitioner · 4 Proficient · 5 Expert. Criticality weights the shortfall when computing readiness and ranking training.</div></div>';
    return s;
  };

  V.competencyBind = function (root) {
    root.querySelectorAll('[data-cf]').forEach(function (b) {
      b.addEventListener('click', function () { A.state.compFilter = b.getAttribute('data-cf'); A.render(); });
    });
  };

  /* ===========================================================
     LEARNING PATH
     =========================================================== */
  V.path = function () {
    var o = A.officer(), p = A.profile();
    var opts = { domain: A.state.recDomain, hideDone: A.state.recHideDone };
    var recs = E.recommend(p, opts);
    var plan = E.buildPath(recs, A.state.budget);

    /* projected readiness if the whole plan is completed */
    var proj = p, cumulative = p.readiness;
    var simCur = p.current.slice();
    plan.items.forEach(function (r) {
      var tmp = { current: simCur, target: p.target };
      var res = E.project(tmp, r.course, 82);
      simCur = res.next; cumulative = res.readiness;
    });
    var lift = cumulative - p.readiness;

    var s = '';
    s += '<div class="pagehead"><div class="pagehead__t"><div class="eyebrow">Personalised learning path</div>' +
      '<h1>Ranked training for ' + esc(o.name) + '</h1>' +
      '<p class="pagehead__d">Every module is scored against this officer\'s live gap vector. The bar under each score shows what actually drove the ranking — no black box.</p></div></div>';

    s += '<div class="grid g-4" style="margin-bottom:15px">' +
      A.stat('Modules in plan', String(plan.count), 'Scored against ' + A.num(E.MAPPED.length) + ' mapped modules', 'lift') +
      A.stat('Total effort', plan.totalHours + '<small> h</small>', 'Within a ' + A.state.budget + ' hour budget') +
      A.stat('Projected readiness', Math.round(cumulative) + '<small>%</small>',
        '<span style="color:var(--good)">▲ ' + r1(lift) + ' points</span> from ' + Math.round(p.readiness) + '%', 'good') +
      A.stat('Critical gaps addressed', String((function () {
        var seen = {};
        plan.items.forEach(function (r) {
          r.hits.forEach(function (h) { if (h.gap >= 1.75) seen[h.id] = 1; });
        });
        return Object.keys(seen).length;
      })()), 'Of ' + p.criticalCount + ' currently critical', 'warn') +
      '</div>';

    /* controls */
    s += '<div class="panel" style="margin-bottom:15px"><div class="panel__body panel__body--tight">' +
      '<div class="row wrap" style="gap:16px">' +
      '<div class="chips">' +
      ['ALL'].concat(NX.DOMAINS.map(function (d) { return d.id; })).map(function (id) {
        return '<button class="chip" data-rd="' + id + '"' + (A.state.recDomain === id ? ' aria-pressed="true"' : '') + '>' +
          esc(id === 'ALL' ? 'All domains' : A.domainName(id)) + '</button>';
      }).join('') + '</div>' +
      '<div style="flex:1;min-width:190px;max-width:290px">' +
      '<div class="row between"><span class="field__l">Time budget</span><span class="num" style="font-size:11px">' + A.state.budget + ' h</span></div>' +
      '<input type="range" id="budget" min="20" max="220" step="10" value="' + A.state.budget + '"></div>' +
      '<button class="chip" id="hidedone"' + (A.state.recHideDone ? ' aria-pressed="true"' : '') + '>Hide completed</button>' +
      '</div></div></div>';

    /* phases */
    s += '<div class="section-title"><h2>Sequenced plan</h2><div class="rule"></div>' +
      '<span class="muted" style="font-size:12px">Ordered so prerequisites land first</span></div>';

    plan.phases.forEach(function (ph, i) {
      var hrs = ph.items.reduce(function (a, r) { return a + r.course.hours; }, 0);
      s += '<div class="phase" style="margin-bottom:14px"><div class="phase__spine">' +
        '<div class="phase__num">' + (i + 1) + '</div>' +
        (i < plan.phases.length - 1 ? '<div class="phase__line"></div>' : '') + '</div>' +
        '<div class="panel"><div class="panel__head"><div><h3>' + esc(ph.name) + '</h3>' +
        '<div class="sub">' + esc(ph.window) + ' · ' + ph.items.length + ' modules · ' + hrs + ' hours</div></div></div>' +
        ph.items.map(function (r, j) { return courseRow(r, j + 1, true); }).join('') +
        '</div></div>';
    });

    /* The blended plan above is dominated by the TPAC supplement for a
       statistical cadre, because the live catalogue is thin on statistical
       method. Show the live catalogue on its own so it is never hidden. */
    var live = E.byOrigin(recs, 'igot').slice(0, 5);
    if (live.length) {
      s += '<div class="section-title"><h2>Best matches in the live iGOT catalogue</h2><div class="rule"></div>' +
        '<span class="muted" style="font-size:12px">' + A.num(NX.IGOT_COURSES.length) + ' modules ingested from the platform export</span></div>';
      s += '<div class="panel">' + live.map(function (r, i) { return courseRow(r, i + 1, true); }).join('') +
        '<div class="panel__foot">These are ranked among iGOT modules only. In the blended plan above they sit lower, because for this role the NSSTA TPAC programmes match the statistical gaps more closely — a gap in the live catalogue, not in the ranking.</div></div>';
    }

    /* full ranking */
    s += '<div class="section-title"><h2>Full ranking</h2><div class="rule"></div>' +
      '<span class="muted" style="font-size:12px">' + recs.length + ' catalogue entries scored</span></div>';
    s += '<div class="panel"><div class="tablewrap"><table class="tbl"><thead><tr>' +
      '<th class="n">#</th><th>Module</th><th>Source</th><th>Provider</th><th class="n">Hrs</th>' +
      '<th class="n">Semantic</th><th class="n">Coverage</th><th class="n">Role fit</th><th class="n">Peer</th><th class="n">Effic.</th><th class="n">Score</th>' +
      '</tr></thead><tbody>';
    recs.slice(0, 18).forEach(function (r, i) {
      s += '<tr><td class="n" style="color:var(--text-3)">' + (i + 1) + '</td>' +
        '<td><div style="font-weight:500">' + esc(r.course.title) + '</div>' +
        '<div class="mono" style="font-size:10.5px;color:var(--text-3)" title="' + esc(r.course.id) + '">' + esc(A.courseCode(r.course)) + '</div></td>' +
        '<td>' + A.originTag(r.course) + '</td>' +
        '<td style="font-size:12px;color:var(--text-2)">' + esc(r.course.provider) + '</td>' +
        '<td class="n">' + r.course.hours + '</td>' +
        '<td class="n">' + r1(r.parts.semantic * 100) + '</td>' +
        '<td class="n">' + r1(r.parts.coverage * 100) + '</td>' +
        '<td class="n">' + r1(r.parts.roleFit * 100) + '</td>' +
        '<td class="n" title="' + r.peerCount + ' of ' + r.cohortSize + ' similar officers completed this">' + r1(r.parts.peer * 100) + '</td>' +
        '<td class="n">' + r1(r.parts.efficiency * 100) + '</td>' +
        '<td class="n" style="font-weight:600;color:var(--accent)">' + Math.round(r.score) + '</td></tr>';
    });
    s += '</tbody></table></div>' +
      '<div class="panel__foot">Score = 0.40 semantic + 0.26 coverage + 0.14 role fit + 0.12 peer + 0.08 effort efficiency. ' +
      'The export carries no ratings or enrolment counts, so none are shown: efficiency is weighted gap closed per contact hour. ' +
      'Peer signal is item-based collaborative filtering over the 80 officers whose gap signature is nearest this one.</div></div>';

    return s;
  };

  V.pathBind = function (root) {
    root.querySelectorAll('[data-rd]').forEach(function (b) {
      b.addEventListener('click', function () { A.state.recDomain = b.getAttribute('data-rd'); A.render(); });
    });
    var bud = document.getElementById('budget');
    if (bud) bud.addEventListener('change', function () { A.state.budget = +bud.value; A.render(); });
    var hd = document.getElementById('hidedone');
    if (hd) hd.addEventListener('click', function () { A.state.recHideDone = !A.state.recHideDone; A.render(); });

    root.querySelectorAll('[data-complete]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-complete'), c = NX.courseById[id], o = A.officer();
        var before = A.profile().readiness;
        var now = new Date();
        var on = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        o.trainings.push({ c: id, on: on, score: 82 });
        var after = A.profile().readiness;
        A.render();
        if (NX.api) NX.api.saveCompletion(o.id, id, 82, on + '-01');
        A.toast('Completion recorded', ' ' + c.title + ' — readiness ' + r1(before) + '% → ' + r1(after) + '%. Recommendations re-ranked.', 'good');
      });
    });
  };
})(window.NX);
