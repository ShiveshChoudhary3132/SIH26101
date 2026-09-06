/* ===========================================================
   SAMARTH · competency + recommendation engine
   Every number rendered in the UI is produced here from the
   data layer. No stored results, no lookup tables of answers.
   =========================================================== */
(function (NX) {
  'use strict';
  var E = {};
  NX.engine = E;
  var CS = NX.COMPETENCIES, NC = NX.NC;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  E.clamp = clamp;

  /* ---------- 1. TF-IDF space over the course catalogue ---------- */
  E.courseSpace = new NX.nlp.Space(NX.COURSES.map(function (c) {
    return { id: c.id, text: c.title + '. ' + c.text };
  }));

  /* ---------- 1a. Automatic competency mapping ----------
     The iGOT export carries no competency tags. Each competency is
     vectorised in the same space as the catalogue and every module is
     scored against all of them; modules that clear the floor are mapped,
     the rest are retained unmapped rather than force-fitted.

     The hand-authored TPAC mapping is left in place and used as a holdout:
     agreement between it and the automatic mapper is reported on the
     integration screen, so the mapper is validated, not merely asserted. */
  /* Precision over recall: a wrong recommendation to a serving officer
     costs more than a missing one. At this floor roughly one module in
     seven maps to the statistical framework — which is itself the finding
     the problem statement describes. */
  E.MAP_FLOOR = 0.18;

  E.compVecs = CS.map(function (c) {
    return E.courseSpace.vectorise(c.name + ' ' + c.name + ' ' + c.kw);
  });

  E.mapping = (function () {
    var stats = { mapped: 0, unmapped: 0, checked: 0, agreed: 0, byDomain: {} };
    NX.DOMAINS.forEach(function (d) { stats.byDomain[d.id] = 0; });

    NX.COURSES.forEach(function (c, i) {
      var v = E.courseSpace.vecs[i], scored = [], k, s;
      for (k = 0; k < NC; k++) {
        s = NX.nlp.cos(v, E.compVecs[k]);
        if (s > 0) scored.push({ k: k, s: s });
      }
      scored.sort(function (a, b) { return b.s - a.s; });
      c.mapScore = scored.length ? scored[0].s : 0;
      c.autoTop = scored.slice(0, 3).filter(function (x) { return x.s >= E.MAP_FLOOR; });

      if (c.origin === 'tpac') {
        // hand mapping stands; score the mapper against it
        if (scored.length) {
          stats.checked++;
          if (c.covRef[CS[scored[0].k].id]) stats.agreed++;
        }
      } else {
        var cov = {};
        c.autoTop.forEach(function (x, rank) {
          cov[CS[x.k].id] = Math.max(0.35, Math.min(1, x.s / c.mapScore) * (rank === 0 ? 1 : 0.8));
        });
        c.cov = cov;
      }

      if (Object.keys(c.cov).length) {
        stats.mapped++;
        var d0 = CS[NX.compIndex[Object.keys(c.cov)[0]]].d;
        stats.byDomain[d0]++;
      } else {
        stats.unmapped++;
      }
    });

    stats.agreement = stats.checked ? Math.round(100 * stats.agreed / stats.checked) : 0;

    // competencies the combined catalogue cannot currently serve
    stats.uncovered = CS.filter(function (c) {
      return !NX.COURSES.some(function (x) { return x.cov[c.id]; });
    }).map(function (c) { return { id: c.id, name: c.name, d: c.d, crit: c.crit }; });

    return stats;
  })();

  /* Flatten coverage once: the recommender and the peer model both walk
     this on every officer, and object key iteration over 800 modules is
     the hot path. */
  NX.COURSES.forEach(function (c) {
    c.covIdx = Object.keys(c.cov).map(function (k) { return [NX.compIndex[k], c.cov[k]]; });
  });
  E.MAPPED = NX.COURSES.filter(function (c) { return c.covIdx.length; });

  /* Background space for key-phrase IDF: catalogue + sample material,
     so domain terms are correctly weighted against general English. */
  E.bgSpace = new NX.nlp.Space(
    NX.COURSES.map(function (c) { return { id: c.id, text: c.text }; })
      .concat(NX.MATERIALS.map(function (m) { return { id: m.id, text: m.text }; }))
      .concat(CS.map(function (c) { return { id: c.id, text: c.name + ' ' + c.kw }; }))
  );

  /* ---------- 2. Realised proficiency from officer signals ---------- */
  function realised(o) {
    var role = NX.roleById[o.role], rnd = NX.rng(o.seed || 1), v = [], i;
    var expF = Math.min(1, (o.exp || 1) / 16);
    for (i = 0; i < NC; i++) {
      var d = CS[i].d;
      var factor = 0.60 + 0.30 * expF + (o.bias && o.bias[d] !== undefined ? o.bias[d] : 0);
      var noise = (rnd() - 0.5) * 1.15;
      v.push(clamp(role.target[i] * factor + noise, 0.6, 5));
    }
    return v;
  }

  function qualVector(o) {
    if (!o.qual || !o.qual.length) return null;
    var acc = { STAT: 0, TECH: 0, DIGI: 0, BEHV: 0 }, n = 0, i, k;
    for (i = 0; i < o.qual.length; i++) {
      var q = NX.QUALS[o.qual[i]];
      if (!q) continue;
      for (k in acc) acc[k] += q[k];
      n++;
    }
    if (!n) return null;
    var out = [];
    for (i = 0; i < NC; i++) out.push(clamp(acc[CS[i].d] / n, 0.5, 5));
    return out;
  }

  function trainingVector(o, now) {
    if (!o.trainings || !o.trainings.length) return null;
    var out = new Array(NC), any = false, i, t;
    for (i = 0; i < NC; i++) out[i] = null;
    for (t = 0; t < o.trainings.length; t++) {
      var tr = o.trainings[t], course = NX.courseById[tr.c];
      if (!course) continue;
      var yrs = (now - new Date(tr.on + '-01').getTime()) / (365.25 * 864e5);
      var recency = clamp(Math.exp(-Math.max(0, yrs) / 9), 0.45, 1);
      for (var cid in course.cov) {
        var idx = NX.compIndex[cid], w = course.cov[cid];
        var contrib = (tr.score / 100) * 5 * Math.pow(w, 0.55) * recency;
        if (out[idx] === null || contrib > out[idx]) out[idx] = contrib;
        any = true;
      }
    }
    return any ? out : null;
  }

  function assessmentVector(o) {
    if (!o.assessments || !o.assessments.length) return null;
    var sum = new Array(NC), wt = new Array(NC), i, a;
    for (i = 0; i < NC; i++) { sum[i] = 0; wt[i] = 0; }
    var any = false;
    for (a = 0; a < o.assessments.length; a++) {
      var as = o.assessments[a];
      for (i = 0; i < as.comp.length; i++) {
        var idx = NX.compIndex[as.comp[i]];
        if (idx === undefined) continue;
        sum[idx] += (as.pct / 100) * 5 * as.weight;
        wt[idx] += as.weight;
        any = true;
      }
    }
    if (!any) return null;
    var out = [];
    for (i = 0; i < NC; i++) out.push(wt[i] ? sum[i] / wt[i] : null);
    return out;
  }

  var W = { self: 0.30, qual: 0.20, train: 0.30, assess: 0.20 };

  /* Build the full competency profile for an officer. */
  E.profile = function (o, now) {
    now = now || Date.now();
    var role = NX.roleById[o.role];
    var comps = {
      self: realised(o),
      qual: qualVector(o),
      train: trainingVector(o, now),
      assess: assessmentVector(o)
    };
    var current = [], contribution = [], i, k;
    for (i = 0; i < NC; i++) {
      var num = 0, den = 0, parts = {};
      for (k in W) {
        var vec = comps[k];
        if (!vec || vec[i] === null || vec[i] === undefined) continue;
        num += vec[i] * W[k]; den += W[k]; parts[k] = vec[i];
      }
      var val = den ? num / den : comps.self[i];
      current.push(clamp(val, 0.4, 5));
      contribution.push({ parts: parts, den: den });
    }

    var gaps = [];
    for (i = 0; i < NC; i++) {
      var g = Math.max(0, role.target[i] - current[i]);
      gaps.push({
        idx: i, id: CS[i].id, name: CS[i].name, d: CS[i].d, crit: CS[i].crit,
        cur: current[i], tgt: role.target[i], gap: g, priority: g * CS[i].crit,
        sev: g >= 1.75 ? 'crit' : g >= 0.85 ? 'warn' : g > 0.25 ? 'info' : 'good'
      });
    }
    var ranked = gaps.slice().sort(function (a, b) { return b.priority - a.priority; });

    var num2 = 0, den2 = 0;
    for (i = 0; i < NC; i++) {
      num2 += Math.min(current[i], role.target[i]) * CS[i].crit;
      den2 += role.target[i] * CS[i].crit;
    }

    return {
      officer: o, role: role, current: current, target: role.target,
      components: comps, contribution: contribution,
      gaps: gaps, ranked: ranked,
      readiness: 100 * num2 / den2,
      domain: E.byDomain(current, role.target),
      totalGap: gaps.reduce(function (s, g) { return s + g.gap; }, 0),
      criticalCount: gaps.filter(function (g) { return g.sev === 'crit'; }).length
    };
  };

  E.byDomain = function (cur, tgt) {
    var m = {};
    NX.DOMAINS.forEach(function (d) { m[d.id] = { cur: 0, tgt: 0, n: 0 }; });
    for (var i = 0; i < NC; i++) {
      var b = m[CS[i].d];
      b.cur += cur[i]; b.tgt += tgt[i]; b.n++;
    }
    NX.DOMAINS.forEach(function (d) {
      var b = m[d.id];
      b.cur /= b.n; b.tgt /= b.n;
      b.pct = 100 * Math.min(b.cur, b.tgt) / b.tgt;
    });
    return m;
  };

  /* ---------- 3. Gap → query vector for semantic retrieval ---------- */
  E.gapQuery = function (prof) {
    var terms = [], i;
    for (i = 0; i < NC; i++) {
      var g = prof.gaps[i];
      var reps = Math.round(g.priority * 2.2);
      if (reps <= 0) continue;
      var txt = CS[i].name + ' ' + CS[i].kw;
      for (var r = 0; r < Math.min(reps, 8); r++) terms.push(txt);
    }
    if (!terms.length) terms.push(prof.role.name);
    return E.courseSpace.vectorise(terms.join(' '));
  };

  /* ---------- 4. Collaborative-filtering substrate ----------
     Each synthetic officer gets a deterministic completion history
     derived from their own gaps, so peer signal is genuinely
     computed rather than asserted.                                */
  var WORKFORCE = null, PEERPROF = null;

  E.workforce = function () {
    if (WORKFORCE) return WORKFORCE;
    WORKFORCE = NX.buildWorkforce(900);
    PEERPROF = WORKFORCE.map(function (w) {
      var p = E.profile(w);
      var rnd = NX.rng(w.seed + 7);
      // completions: courses that best cover this officer's top gaps
      var scored = E.MAPPED.map(function (c) {
        var s = 0, j;
        for (j = 0; j < c.covIdx.length; j++) s += c.covIdx[j][1] * p.gaps[c.covIdx[j][0]].priority;
        return { id: c.id, s: s * (0.55 + rnd()) };
      }).sort(function (a, b) { return b.s - a.s; });
      var take = 2 + Math.floor(rnd() * 5);
      var done = {}, pool = scored.slice(0, 40);
      for (var i = 0; i < take && pool.length; i++) {
        // weighted draw, so the peer signal is not a copy of the ranking
        var pick = Math.floor(Math.pow(rnd(), 1.7) * pool.length);
        done[pool[pick].id] = 1;
        pool.splice(pick, 1);
      }
      return { w: w, p: p, done: done, gapVec: p.gaps.map(function (g) { return g.gap; }) };
    });
    return WORKFORCE;
  };

  E.peerProfiles = function () { E.workforce(); return PEERPROF; };

  function gapCos(a, b) {
    var s = 0, na = 0, nb = 0;
    for (var i = 0; i < a.length; i++) { s += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return s / (Math.sqrt(na) * Math.sqrt(nb) || 1);
  }

  /* Peer cohort: the K officers whose gap signature is closest. */
  E.peerCohort = function (prof, K) {
    var peers = E.peerProfiles();
    var mine = prof.gaps.map(function (g) { return g.gap; });
    var scored = [], i;
    for (i = 0; i < peers.length; i++) {
      var sameRole = peers[i].w.role === prof.officer.role ? 0.10 : 0;
      scored.push({ p: peers[i], sim: gapCos(mine, peers[i].gapVec) + sameRole });
    }
    scored.sort(function (a, b) { return b.sim - a.sim; });
    return scored.slice(0, K || 80);
  };

  /* ---------- 5. The recommender ---------- */
  E.WEIGHTS = [
    { k: 'semantic', label: 'Semantic match to gap', w: 0.40, colour: 'var(--accent)' },
    { k: 'coverage', label: 'Gap coverage', w: 0.26, colour: 'var(--info)' },
    { k: 'roleFit', label: 'Role & level fit', w: 0.14, colour: 'var(--warn)' },
    { k: 'peer', label: 'Peer cohort signal', w: 0.12, colour: 'var(--good)' },
    { k: 'efficiency', label: 'Effort efficiency', w: 0.08, colour: 'var(--text-3)' }
  ];

  E.recommend = function (prof, opts) {
    opts = opts || {};
    var q = E.gapQuery(prof);
    var cohort = E.peerCohort(prof, 80);
    var i, c;

    // peer completion frequency
    var peerFreq = {};
    for (i = 0; i < cohort.length; i++) {
      for (var did in cohort[i].p.done) peerFreq[did] = (peerFreq[did] || 0) + 1;
    }

    var totalPriority = prof.gaps.reduce(function (s, g) { return s + g.priority; }, 0) || 1;
    var done = {};
    (prof.officer.trainings || []).forEach(function (t) { done[t.c] = 1; });

    var raw = [];
    for (i = 0; i < NX.COURSES.length; i++) {
      c = NX.COURSES[i];
      if (!c.covIdx.length) continue;   // unmapped: no defensible rationale
      var semantic = NX.nlp.cos(q, E.courseSpace.vecs[i]);

      // coverage: share of this officer's weighted gap the course addresses
      var cov = 0, hitList = [], avgTgt = 0, covW = 0;
      for (var cid in c.cov) {
        var g = prof.gaps[NX.compIndex[cid]];
        var contrib = c.cov[cid] * Math.min(g.gap, 2.5) * g.crit;
        cov += contrib;
        avgTgt += g.tgt * c.cov[cid]; covW += c.cov[cid];
        if (g.gap > 0.3) hitList.push({ id: cid, name: g.name, gap: g.gap, w: c.cov[cid] });
      }
      avgTgt = covW ? avgTgt / covW : 3;
      var coverage = cov / totalPriority;

      // role fit: does the course's difficulty match the level this
      // officer is expected to reach in the competencies it covers?
      var levelFit = 1 - Math.abs(c.level - avgTgt) / 4;
      var roleFit = clamp(0.45 * levelFit + 0.55 * clamp(covW / 1.6, 0, 1), 0, 1);

      var peer = (peerFreq[c.id] || 0) / cohort.length;
      /* The export carries no ratings or enrolment counts and we do not
         invent them. Efficiency is the planning signal we can compute
         honestly: weighted gap closed per contact hour. */
      var efficiency = cov / Math.max(1, c.hours);

      hitList.sort(function (a, b) { return b.gap * b.w - a.gap * a.w; });
      raw.push({
        course: c, parts: { semantic: semantic, coverage: coverage, roleFit: roleFit, peer: peer, efficiency: efficiency },
        hits: hitList, alreadyDone: !!done[c.id],
        terms: NX.nlp.overlapTerms(q, E.courseSpace.vecs[i], 5),
        peerCount: peerFreq[c.id] || 0, cohortSize: cohort.length
      });
    }

    // min-max normalise the unbounded components so the blend is fair
    ['semantic', 'coverage', 'efficiency'].forEach(function (k) {
      var mx = 0;
      raw.forEach(function (r) { if (r.parts[k] > mx) mx = r.parts[k]; });
      raw.forEach(function (r) { r.parts[k] = mx ? r.parts[k] / mx : 0; });
    });

    raw.forEach(function (r) {
      var s = 0, contrib = {};
      E.WEIGHTS.forEach(function (wd) {
        var v = r.parts[wd.k] * wd.w;
        contrib[wd.k] = v; s += v;
      });
      r.contrib = contrib;
      r.score = s * 100;
      if (r.alreadyDone) r.score *= 0.28;   // demote what they have already done
    });

    raw.sort(function (a, b) { return b.score - a.score; });

    if (opts.domain && opts.domain !== 'ALL') {
      raw = raw.filter(function (r) {
        return Object.keys(r.course.cov).some(function (cid) {
          return CS[NX.compIndex[cid]].d === opts.domain;
        });
      });
    }
    if (opts.maxHours) raw = raw.filter(function (r) { return r.course.hours <= opts.maxHours; });
    if (opts.hideDone) raw = raw.filter(function (r) { return !r.alreadyDone; });

    return raw;
  };

  E.byOrigin = function (recs, origin) {
    return recs.filter(function (r) { return r.course.origin === origin; });
  };

  /* Which competencies the live iGOT catalogue can serve on its own, and
     which currently depend on the TPAC supplement. A procurement output
     for NSSTA, not just a diagnostic. */
  E.catalogueCoverage = function () {
    return CS.map(function (c) {
      var igot = 0, tpac = 0, best = 0;
      NX.COURSES.forEach(function (x) {
        if (!x.cov[c.id]) return;
        if (x.origin === 'igot') {
          igot++;
          best = Math.max(best, x.cov[c.id] * (x.mapScore || 0));
        } else { tpac++; }
      });
      return {
        id: c.id, name: c.name, d: c.d, crit: c.crit, igot: igot, tpac: tpac,
        best: best,
        strength: best >= 0.22 ? 'good' : best >= 0.10 ? 'warn' : 'crit'
      };
    });
  };

  /* ---------- 6. Learning path sequencing ---------- */
  E.buildPath = function (recs, budgetHours) {
    budgetHours = budgetHours || 90;
    var picked = [], hours = 0, coveredCrit = {};
    for (var i = 0; i < recs.length && hours < budgetHours; i++) {
      var r = recs[i];
      if (r.alreadyDone) continue;
      // diversity guard: don't stack three courses on one competency
      var top = r.hits[0] ? r.hits[0].id : 'x';
      if ((coveredCrit[top] || 0) >= 2) continue;
      coveredCrit[top] = (coveredCrit[top] || 0) + 1;
      picked.push(r); hours += r.course.hours;
    }
    // order by course level so foundations come first
    picked.sort(function (a, b) { return a.course.level - b.course.level || b.score - a.score; });

    var phases = [
      { name: 'Close critical gaps', window: 'Foundation level', items: [] },
      { name: 'Build role depth', window: 'Practitioner level', items: [] },
      { name: 'Stretch & specialise', window: 'Advanced level', items: [] }
    ];
    picked.forEach(function (r, i) {
      var b = r.course.level <= 2 ? 0 : r.course.level === 3 ? 1 : 2;
      phases[b].items.push(r);
    });
    // avoid an empty phase swallowing the layout
    phases = phases.filter(function (p) { return p.items.length; });
    return { phases: phases, totalHours: hours, count: picked.length, items: picked };
  };

  /* ---------- 7. Projection: what changes if a course is completed ---------- */
  E.project = function (prof, course, assumedScore) {
    var pct = (assumedScore === undefined ? 82 : assumedScore) / 100;
    var next = prof.current.slice(), delta = [];
    for (var cid in course.cov) {
      var i = NX.compIndex[cid], w = course.cov[cid];
      var reach = pct * 5 * Math.pow(w, 0.55);
      // a course lifts you toward, but not past, its own ceiling
      var lifted = next[i] + Math.max(0, (Math.min(reach, prof.target[i]) - next[i])) * (0.55 * w + 0.2);
      lifted = clamp(lifted, next[i], 5);
      if (lifted - next[i] > 0.01) delta.push({ id: cid, name: CS[i].name, from: next[i], to: lifted });
      next[i] = lifted;
    }
    var num = 0, den = 0;
    for (var j = 0; j < NC; j++) {
      num += Math.min(next[j], prof.target[j]) * CS[j].crit;
      den += prof.target[j] * CS[j].crit;
    }
    return { readiness: 100 * num / den, delta: delta, next: next };
  };

  /* ---------- 8. Workforce-level analytics ---------- */
  E.analytics = function () {
    var peers = E.peerProfiles(), i, j;
    var byRole = {}, byStation = {}, gapSum = new Array(NC), covSum = new Array(NC);
    for (i = 0; i < NC; i++) { gapSum[i] = 0; covSum[i] = 0; }
    var readiness = 0, critTotal = 0, completions = 0;

    for (i = 0; i < peers.length; i++) {
      var p = peers[i].p, w = peers[i].w;
      readiness += p.readiness;
      critTotal += p.criticalCount;
      completions += Object.keys(peers[i].done).length;

      if (!byRole[w.role]) byRole[w.role] = { n: 0, readiness: 0, dom: { STAT: 0, TECH: 0, DIGI: 0, BEHV: 0 }, crit: 0 };
      var br = byRole[w.role];
      br.n++; br.readiness += p.readiness; br.crit += p.criticalCount;
      NX.DOMAINS.forEach(function (d) { br.dom[d.id] += p.domain[d.id].pct; });

      if (!byStation[w.station]) byStation[w.station] = { n: 0, readiness: 0, crit: 0 };
      byStation[w.station].n++;
      byStation[w.station].readiness += p.readiness;
      byStation[w.station].crit += p.criticalCount;

      for (j = 0; j < NC; j++) {
        gapSum[j] += p.gaps[j].gap;
        if (p.gaps[j].sev === 'crit') covSum[j]++;
      }
    }

    var n = peers.length;
    for (var r in byRole) {
      byRole[r].readiness /= byRole[r].n;
      byRole[r].crit /= byRole[r].n;
      NX.DOMAINS.forEach(function (d) { byRole[r].dom[d.id] /= byRole[r].n; });
    }
    for (var s in byStation) {
      byStation[s].readiness /= byStation[s].n;
      byStation[s].crit /= byStation[s].n;
    }

    var perComp = CS.map(function (c, i2) {
      return { id: c.id, name: c.name, d: c.d, crit: c.crit, trend: c.trend || 1,
        avgGap: gapSum[i2] / n, share: 100 * covSum[i2] / n };
    });
    var topGaps = perComp.slice().sort(function (a, b) { return b.avgGap * b.crit - a.avgGap * a.crit; });

    /* Forward demand: today's shortfall weighted by mission criticality and
       by how fast the competency is being adopted across the statistical
       system. The trend weight is a published input, not a model output. */
    var emerging = perComp.map(function (c) {
      return {
        id: c.id, name: c.name, d: c.d, trend: c.trend, avgGap: c.avgGap, crit: c.crit,
        demand: c.avgGap * c.crit * c.trend,
        headcount: Math.round(n * Math.min(0.98, (c.avgGap / 2.6) * c.trend))
      };
    }).sort(function (a, b) { return b.demand - a.demand; });

    // demand for each course across the whole workforce
    var demand = {};
    for (i = 0; i < peers.length; i++) {
      for (var did in peers[i].done) demand[did] = (demand[did] || 0) + 1;
    }
    var topCourses = NX.COURSES.map(function (c) {
      return { c: c, n: demand[c.id] || 0 };
    }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);

    return {
      n: n, readiness: readiness / n, critPerHead: critTotal / n,
      completions: completions, byRole: byRole, byStation: byStation,
      topGaps: topGaps, emerging: emerging, topCourses: topCourses, gapSum: gapSum
    };
  };

  /* ---------- 9. Trend series (synthetic but deterministic) ---------- */
  E.readinessTrend = function (base) {
    var rnd = NX.rng(31337), out = [], v = base - 11.5;
    var months = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    for (var i = 0; i < 12; i++) {
      v += 0.55 + rnd() * 0.85;
      out.push({ label: months[i], v: Math.min(v, base + 1) });
    }
    out[out.length - 1].v = base;
    return out;
  };
})(window.NX);
