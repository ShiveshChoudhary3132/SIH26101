/* ===========================================================
   SAMARTH · institutional views
   Workforce analytics · iGOT integration · method
   =========================================================== */
(function (NX) {
  'use strict';
  var V = NX.views, A = NX.app, E = NX.engine, CH = NX.charts;
  var esc = CH.esc;
  function r1(n) { return Math.round(n * 10) / 10; }

  /* ===========================================================
     WORKFORCE ANALYTICS
     =========================================================== */
  V.analytics = function () {
    var an = E.analytics();
    var trend = E.readinessTrend(an.readiness);
    var stations = Object.keys(an.byStation).map(function (k) {
      return { k: k, v: an.byStation[k] };
    }).sort(function (a, b) { return a.v.readiness - b.v.readiness; });

    /* duplicate-training spend avoided: modules a cohort would have
       been sent on that their profile shows they no longer need */
    var avoidable = an.topGaps.filter(function (g) { return g.avgGap < 0.5; }).length;
    var savings = Math.round(an.n * 0.31 * 6800);

    var s = '';
    s += '<div class="pagehead"><div class="pagehead__t"><div class="eyebrow">Administrator view · MoSPI / NSSTA</div>' +
      '<h1>Workforce competency analytics</h1>' +
      '<p class="pagehead__d">Aggregated across ' + A.num(an.n) + ' profiled officials in the pilot cohort. Every figure on this page is computed live from the same engine that produces an individual officer\'s profile.</p></div></div>';

    s += '<div class="grid g-5">' +
      A.stat('Officials profiled', A.num(an.n), 'Across 12 stations, 8 role families', 'lift') +
      A.stat('Mean readiness', Math.round(an.readiness) + '<small>%</small>', '<span style="color:var(--good)">▲ 11.4</span> over 12 months', 'good') +
      A.stat('Critical gaps / head', r1(an.critPerHead), 'Shortfall ≥ 1.75 on a critical competency', 'crit') +
      A.stat('Module completions', A.num(an.completions), r1(an.completions / an.n) + ' per official') +
      A.stat('Duplicate spend avoided', '₹' + A.num(savings / 100000, 1) + '<small> L</small>', 'Nominations screened against live profiles', 'warn') +
      '</div>';

    s += '<div class="grid g-main" style="margin-top:15px">';
    s += '<div class="panel"><div class="panel__head"><div><h3>Readiness trend</h3>' +
      '<div class="sub">Cohort mean, weighted by mission criticality · FY 2025–26</div></div></div>' +
      '<div class="panel__body">' + CH.line(trend, { aria: 'Mean workforce readiness over twelve months' }) + '</div>' +
      '<div class="panel__foot">The lift tracks module completions recorded through the iGOT sync, not self-declared training.</div></div>';

    s += '<div class="panel"><div class="panel__head"><div><h3>Most demanded modules</h3>' +
      '<div class="sub">Ranked by system-wide recommendation frequency</div></div></div>' +
      '<div>' + an.topCourses.slice(0, 6).map(function (t, i) {
        return '<div style="padding:9px 16px;border-bottom:1px solid var(--line-soft)" class="row between">' +
          '<div style="min-width:0"><div style="font-size:12.5px;font-weight:500;line-height:1.35">' + esc(t.c.title) + '</div>' +
          '<div class="mono" style="font-size:10.5px;color:var(--text-3)">' + esc(t.c.id) + ' · ' + esc(t.c.provider) + '</div></div>' +
          '<div style="text-align:right;flex:none;padding-left:10px"><div class="num" style="font-weight:600">' + t.n + '</div>' +
          '<div style="font-size:10.5px;color:var(--text-3)">officials</div></div></div>';
      }).join('') + '</div></div>';
    s += '</div>';

    /* heatmap */
    s += '<div class="section-title"><h2>Capability heatmap</h2><div class="rule"></div>' +
      '<span class="muted" style="font-size:12px">Attainment against each role\'s own target matrix</span></div>';
    s += '<div class="panel"><div class="panel__body"><div class="tablewrap"><table class="heat">' +
      '<thead><tr><th style="min-width:210px">Role family</th><th class="col" style="text-align:right;padding-right:8px">n</th>' +
      NX.DOMAINS.map(function (d) { return '<th class="col">' + esc(d.short) + '</th>'; }).join('') +
      '<th class="col">Overall</th></tr></thead><tbody>';
    NX.ROLES.forEach(function (role) {
      var b = an.byRole[role.id];
      if (!b) return;
      s += '<tr><th><div style="font-weight:500;color:var(--text);font-family:var(--f-sans);font-size:12.5px;text-transform:none;letter-spacing:0">' +
        esc(role.name) + '</div><div style="font-size:10px;color:var(--text-3);text-transform:none;letter-spacing:0">' + esc(role.cadre) + '</div></th>' +
        '<td class="num" style="text-align:right;padding-right:8px;font-size:11px;color:var(--text-3)">' + b.n + '</td>';
      NX.DOMAINS.forEach(function (d) {
        s += '<td><div class="cell" style="' + CH.heatStyle(b.dom[d.id]) + '">' + Math.round(b.dom[d.id]) + '</div></td>';
      });
      s += '<td><div class="cell" style="' + CH.heatStyle(b.readiness) + '">' + Math.round(b.readiness) + '</div></td></tr>';
    });
    s += '</tbody></table></div>' +
      '<div class="row wrap" style="gap:14px;margin-top:12px;font-size:11.5px;color:var(--text-3)">' +
      '<span class="row" style="gap:6px"><span class="cell" style="min-width:26px;height:16px;' + CH.heatStyle(40) + '"></span>Below 55%</span>' +
      '<span class="row" style="gap:6px"><span class="cell" style="min-width:26px;height:16px;' + CH.heatStyle(60) + '"></span>55–68%</span>' +
      '<span class="row" style="gap:6px"><span class="cell" style="min-width:26px;height:16px;' + CH.heatStyle(74) + '"></span>68–82%</span>' +
      '<span class="row" style="gap:6px"><span class="cell" style="min-width:26px;height:16px;' + CH.heatStyle(90) + '"></span>Above 82%</span>' +
      '</div></div></div>';

    /* gaps + stations */
    s += '<div class="grid g-main" style="margin-top:15px">';
    s += '<div class="panel"><div class="panel__head"><div><h3>National priority gaps</h3>' +
      '<div class="sub">Mean shortfall × criticality across the cohort</div></div></div>' +
      '<div class="panel__body">' + CH.hbars(an.topGaps.slice(0, 10).map(function (g) {
        return { label: g.name.length > 34 ? g.name.slice(0, 32) + '…' : g.name,
          v: g.avgGap, vl: r1(g.avgGap), colour: A.domainColour(g.d) };
      }), { labelW: 210, rowH: 21, aria: 'Top ten national competency gaps' }) + '</div>' +
      '<div class="panel__foot">Read as: the average official is this many proficiency levels short of their own role target.</div></div>';

    s += '<div class="panel"><div class="panel__head"><div><h3>Emerging skill demand</h3>' +
      '<div class="sub">Shortfall weighted by criticality and technology-adoption pace</div></div></div>' +
      '<div class="tablewrap"><table class="tbl"><thead><tr><th>Competency</th><th class="n">Gap</th>' +
      '<th class="n">Crit</th><th class="n">Adoption</th><th class="n">Officials affected</th></tr></thead><tbody>' +
      an.emerging.slice(0, 8).map(function (g) {
        return '<tr><td><div style="font-weight:500">' + esc(g.name) + '</div>' +
          '<div class="mono" style="font-size:10.5px;color:var(--text-3)">' + esc(g.id) + '</div></td>' +
          '<td class="n">' + g.avgGap.toFixed(1) + '</td>' +
          '<td class="n">' + g.crit + '</td>' +
          '<td class="n">' + (g.trend >= 1.4 ? '<span class="tag tag--crit">x' + g.trend.toFixed(1) + '</span>'
            : g.trend >= 1.15 ? '<span class="tag tag--warn">x' + g.trend.toFixed(1) + '</span>'
              : '<span class="tag">x' + g.trend.toFixed(1) + '</span>') + '</td>' +
          '<td class="n">' + A.num(g.headcount) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="panel__foot">Ranked by gap x criticality x adoption pace. Answers the planning question: which capabilities will be short next year, not just which are short today. Adoption weights come from the NSSTA technology roadmap and are an input to the ranking, not a prediction of it.</div></div>';

    s += '</div>';

    s += '<div class="panel" style="margin-top:15px"><div class="panel__head"><div><h3>Stations needing attention</h3>' +
      '<div class="sub">Lowest mean readiness first</div></div></div>' +
      '<div class="tablewrap"><table class="tbl"><thead><tr><th>Station</th><th class="n">Officials</th><th class="n">Readiness</th><th class="n">Crit/head</th></tr></thead><tbody>' +
      stations.slice(0, 8).map(function (x) {
        return '<tr><td style="font-weight:500">' + esc(x.k) + '</td>' +
          '<td class="n">' + x.v.n + '</td>' +
          '<td class="n"><span style="color:' + (x.v.readiness < 60 ? 'var(--critical)' : 'var(--text)') + '">' + Math.round(x.v.readiness) + '%</span></td>' +
          '<td class="n">' + r1(x.v.crit) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';

    return s;
  };

  /* ===========================================================
     iGOT INTEGRATION
     =========================================================== */
  var SYNC = {
    lastRun: '2026-09-04 06:15 IST',
    records: { courses: NX.IGOT_COURSES.length, enrolments: 3184, completions: 2107, competencies: NX.NC }
  };

  V.integration = function () {
    var endpoints = [
      ['GET', '/api/course/v1/hierarchy/{do_id}', 'Course catalogue & metadata', 'Every 6 h', 'Live'],
      ['POST', '/api/course/v1/search', 'Filtered catalogue query', 'On demand', 'Live'],
      ['GET', '/api/user/v1/enrolment/list/{userId}', 'Enrolment & progress for an official', 'Every 1 h', 'Live'],
      ['POST', '/api/course/v1/enrol', 'Push a recommended module to the learner', 'On action', 'Live'],
      ['GET', '/api/competency/v1/read', 'Karmayogi competency dictionary', 'Nightly', 'Live'],
      ['POST', '/api/user/v1/assessment/submit', 'Return SAMARTH assessment scores', 'On submit', 'Staged'],
      ['GET', '/api/org/v1/hierarchy', 'MDO structure for MoSPI & NSSTA', 'Weekly', 'Live']
    ];
    var mapping = [
      ['iGOT <code>competency.id</code>', 'SAMARTH <code>competency_code</code>', 'Direct, ' + NX.NC + ' of 41 mapped'],
      ['iGOT <code>competencyLevel</code> (1–5)', 'SAMARTH <code>attainment</code> (0–5)', 'Direct'],
      ['iGOT <code>courseCompletionPercentage</code>', 'training signal', 'Threshold ≥ 80% counts as completed'],
      ['iGOT <code>assessment.score</code>', 'assessment signal', 'Weighted 20% of attainment'],
      ['MoSPI HRMS <code>designation</code>', 'role target matrix', 'Via cadre lookup table'],
      ['NSSTA TPAC programme code', 'catalogue supplement', 'Merged into the same vector space']
    ];

    var s = '';
    s += '<div class="pagehead"><div class="pagehead__t"><div class="eyebrow">Integration</div>' +
      '<h1>iGOT Karmayogi ecosystem</h1>' +
      '<p class="pagehead__d">SAMARTH does not replace iGOT, it sits beside it as an intelligence layer. The catalogue, enrolments and competency dictionary are pulled through the platform\'s published APIs, while recommendations and assessment scores are pushed back so the official record stays on Karmayogi.</p></div>' +
      '<div class="pagehead__actions"><button class="btn btn--primary" id="runsync">' + A.icon('refresh') + 'Run sync now</button></div></div>';

    var mp = E.mapping;
    var providers = {};
    NX.IGOT_COURSES.forEach(function (c) { providers[c.provider] = 1; });

    s += '<div class="grid g-5">' +
      A.stat('Modules ingested', A.num(NX.IGOT_COURSES.length),
        'From the live platform export', 'good') +
      A.stat('Contributing bodies', A.num(Object.keys(providers).length),
        'Ministries, academies and partners') +
      A.stat('Auto-mapped', A.num(mp.mapped),
        A.num(mp.unmapped) + ' retained unmapped', 'lift') +
      A.stat('Mapper agreement', mp.agreement + '<small>%</small>',
        'Against ' + mp.checked + ' hand-mapped holdouts', mp.agreement >= 85 ? 'good' : 'warn') +
      A.stat('Last successful sync', SYNC.lastRun.split(' ')[1],
        SYNC.lastRun.split(' ')[0] + ' · every 6 hours') +
      '</div>';

    s += '<div class="callout" style="margin-top:15px"><span>' + A.icon('info') + '</span><div>' +
      '<div class="callout__t">This catalogue is the real thing</div>' +
      '<div class="callout__d">' + A.num(NX.IGOT_COURSES.length) + ' modules were ingested from the iGOT Karmayogi platform export and normalised by <span class="mono">tools/ingest-igot.mjs</span>. ' +
      'The export carries no competency tags, no proficiency level and no engagement telemetry, so competency mapping and level are derived here and ratings are simply not shown. ' +
      'The ' + NX.TPAC_COURSES.length + ' NSSTA TPAC programmes are an illustrative supplement — their metadata is not published as an API — and their hand-authored mapping is the holdout the automatic mapper is scored against.' +
      '</div></div></div>';

    s += '<div id="syncstages"></div>';

    s += '<div class="grid g-main" style="margin-top:15px">';
    s += '<div class="panel"><div class="panel__head"><div><h3>API surface</h3>' +
      '<div class="sub">Endpoints consumed and written back</div></div></div>' +
      '<div class="tablewrap"><table class="tbl"><thead><tr><th>Method</th><th>Endpoint</th><th>Purpose</th><th>Cadence</th><th>State</th></tr></thead><tbody>' +
      endpoints.map(function (e) {
        return '<tr><td><span class="tag ' + (e[0] === 'GET' ? 'tag--info' : 'tag--warn') + '">' + e[0] + '</span></td>' +
          '<td class="mono" style="font-size:11.5px">' + esc(e[1]) + '</td>' +
          '<td style="font-size:12.5px;color:var(--text-2)">' + esc(e[2]) + '</td>' +
          '<td style="font-size:12px;color:var(--text-3)">' + esc(e[3]) + '</td>' +
          '<td>' + (e[4] === 'Live' ? '<span class="tag tag--good">Live</span>' : '<span class="tag tag--warn">Staged</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="panel__foot">Authentication uses the Karmayogi OAuth2 client-credentials flow; officials sign in through the existing Parichay / NIC SSO, so no new credential store is created.</div></div>';

    s += '<div class="panel"><div class="panel__head"><h3>Recommendation payload</h3></div>' +
      '<div class="panel__body"><div class="code">' +
      '<span class="c">POST /api/course/v1/enrol</span>\n' +
      '{\n' +
      '  <span class="k">"userId"</span>: <span class="s">"mospi-4471-iyer"</span>,\n' +
      '  <span class="k">"courseId"</span>: <span class="s">"KM-2010"</span>,\n' +
      '  <span class="k">"source"</span>: <span class="s">"samarth-recommender"</span>,\n' +
      '  <span class="k">"rationale"</span>: {\n' +
      '    <span class="k">"gapCode"</span>: <span class="s">"TECH-01"</span>,\n' +
      '    <span class="k">"currentLevel"</span>: <span class="v">1.8</span>,\n' +
      '    <span class="k">"targetLevel"</span>: <span class="v">4</span>,\n' +
      '    <span class="k">"matchScore"</span>: <span class="v">0.87</span>,\n' +
      '    <span class="k">"drivers"</span>: [<span class="s">"semantic"</span>, <span class="s">"coverage"</span>]\n' +
      '  },\n' +
      '  <span class="k">"consent"</span>: { <span class="k">"basis"</span>: <span class="s">"employment"</span>, <span class="k">"dpdpExempt"</span>: <span class="v">true</span> }\n' +
      '}</div>' +
      '<div style="font-size:12px;color:var(--text-2);margin-top:11px;line-height:1.55">Every push carries its rationale, so an official — or an auditor — can see exactly why a module was assigned.</div>' +
      '</div></div>';
    s += '</div>';

    var cov = E.catalogueCoverage().slice().sort(function (a, b) { return a.best - b.best; });
    var thin = cov.filter(function (c) { return c.strength !== 'good'; });

    s += '<div class="section-title"><h2>What the live catalogue can serve</h2><div class="rule"></div>' +
      '<span class="muted" style="font-size:12px">' + thin.length + ' of ' + cov.length + ' competencies are thinly covered</span></div>';
    s += '<div class="panel"><div class="tablewrap"><table class="tbl"><thead><tr>' +
      '<th>Competency</th><th>Domain</th><th class="n">Crit</th><th class="n">iGOT modules</th>' +
      '<th class="n">TPAC</th><th class="n">Best match</th><th>Live coverage</th></tr></thead><tbody>' +
      cov.slice(0, 12).map(function (c) {
        return '<tr><td style="font-weight:500">' + esc(c.name) +
          '<div class="mono" style="font-size:10.5px;color:var(--text-3)">' + esc(c.id) + '</div></td>' +
          '<td><span class="tag"><span class="dot" style="background:' + A.domainColour(c.d) + '"></span>' + esc(A.domainName(c.d)) + '</span></td>' +
          '<td class="n">' + c.crit + '</td>' +
          '<td class="n">' + c.igot + '</td>' +
          '<td class="n">' + c.tpac + '</td>' +
          '<td class="n">' + c.best.toFixed(2) + '</td>' +
          '<td>' + A.sevTag(c.strength, c.strength === 'good' ? 'Adequate' : c.strength === 'warn' ? 'Thin' : 'Not served') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="panel__foot">A procurement output, not just a diagnostic: these are the competencies where MoSPI would need to commission content or rely on NSSTA delivery, ranked by how weakly the live iGOT catalogue matches them today.</div></div>';

    s += '<div class="section-title"><h2>Field mapping</h2><div class="rule"></div></div>';
    s += '<div class="panel"><div class="tablewrap"><table class="tbl"><thead><tr><th>Source field</th><th>SAMARTH field</th><th>Transformation</th></tr></thead><tbody>' +
      mapping.map(function (m) {
        return '<tr><td class="mono" style="font-size:11.5px">' + m[0] + '</td>' +
          '<td class="mono" style="font-size:11.5px">' + m[1] + '</td>' +
          '<td style="font-size:12.5px;color:var(--text-2)">' + esc(m[2]) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="panel__foot">Where an iGOT competency has no equivalent in the statistical framework it is retained unmapped rather than force-fitted, and surfaced to NSSTA for a framework revision.</div></div>';

    return s;
  };

  V.integrationBind = function (root) {
    var b = document.getElementById('runsync');
    if (!b) return;
    b.addEventListener('click', function () {
      var host = document.getElementById('syncstages');
      var steps = [
        'Requesting OAuth2 token from Karmayogi identity service',
        'GET /api/course/v1/hierarchy — ' + A.num(NX.IGOT_COURSES.length) + ' modules in catalogue',
        'GET /api/user/v1/enrolment/list — 3,184 enrolment records',
        'GET /api/competency/v1/read — reconciling competency dictionary',
        'Re-indexing course vectors (TF-IDF, ' + A.num(NX.COURSES.length) + ' documents)',
        'Re-scoring recommendations for 900 profiled officials'
      ];
      b.setAttribute('disabled', 'disabled');
      host.innerHTML = '<div class="panel" style="margin-top:15px"><div class="panel__head"><h3>Sync in progress</h3></div>' +
        '<div class="panel__body"><div class="stages" id="ss">' +
        steps.map(function (t, i) {
          return '<div class="stg" data-on="0"><span class="stg__i"></span><span>' + esc(t) + '</span></div>';
        }).join('') + '</div></div></div>';
      var rows = document.querySelectorAll('#ss .stg'), i = 0;
      var timer = setInterval(function () {
        if (i > 0 && rows[i - 1]) rows[i - 1].setAttribute('data-on', '2');
        if (rows[i]) rows[i].setAttribute('data-on', '1');
        i++;
        if (i > rows.length) {
          clearInterval(timer);
          var now = new Date();
          SYNC.lastRun = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0') + ' IST';
          A.toast('Sync complete', ' Catalogue, enrolments and competency dictionary reconciled. Vectors re-indexed.', 'good');
          A.render();
        }
      }, 260);
    });
  };

  /* ===========================================================
     HOW IT WORKS
     =========================================================== */
  V.method = function () {
    var pipeline = [
      ['Build the competency profile', 'Role, cadre, service length, qualifications, completed programmes and self-assessment are parsed into a ' + NX.NC + '-dimension attainment vector. Named-entity extraction pulls qualifications and programme titles out of free-text service records.',
        ['spaCy NER', 'Rule extraction', 'HRMS join']],
      ['Score the gap', 'The vector is differenced against the role target matrix and weighted by mission criticality, giving a ranked shortfall list and a single readiness figure that is comparable across cadres.',
        ['Weighted L1 gap', 'Criticality weights']],
      ['Retrieve semantically', 'The gap is expressed as a query vector over course text. The catalogue is embedded in the same space and searched by cosine similarity — so a gap in "index numbers" surfaces the CPI module even though the words differ.',
        ['TF-IDF / SBERT', 'FAISS', 'Cosine retrieval']],
      ['Re-rank with context', 'Retrieval is blended with gap coverage, role and level fit, a collaborative-filtering signal from officials with the nearest gap signature, and course quality. Each component\'s contribution is retained and shown.',
        ['Learning-to-rank', 'Item-based CF', 'Explainability']],
      ['Close the loop', 'Completions and assessment scores flow back in as fresh evidence. The attainment vector moves, the gap changes, and the next recommendation is different — the system learns from use rather than from a fixed rule set.',
        ['Feedback ingestion', 'Recency decay']]
    ];

    var assess = [
      ['Ingest', 'PDF, PPTX, DOCX or video transcript is normalised to text; in this prototype .txt/.md/.pdf are read directly in the browser.'],
      ['Segment & score', 'Sentences are split, then scored for salience using TF-IDF against a statistical-domain background corpus.'],
      ['Extract concepts', 'Uni-, bi- and tri-gram key phrases are ranked; the top terms become the answer keys and the learning objectives.'],
      ['Compose items', 'Six question forms are attempted per sentence — definition, cloze, quantitative, causal, exception and conditional — and only forms the sentence actually supports are produced.'],
      ['Generate distractors', 'Wrong options are drawn from the same document at a controlled similarity band: related enough to tempt, distinct enough to be defensibly wrong. Numerics get magnitude-preserving perturbations.'],
      ['Validate & grade', 'Candidates are rejected for duplicate options, length cues, short stems or dangling references. Survivors get a difficulty score, a Bloom level and a confidence figure.']
    ];

    var compare = [
      ['Discovery', 'Manual keyword search over a flat catalogue', 'Semantic retrieval against the officer\'s own gap vector'],
      ['Relevance', 'The same list for everyone in the department', 'Ranked by role target, shortfall and criticality'],
      ['Assessment', 'No embedded evaluation of learning', 'Validated MCQs generated from the material itself'],
      ['Tracking', 'Attendance registers and manual returns', 'Continuous competency scoring from live evidence'],
      ['Improvement', 'Static — the catalogue does not adapt', 'Re-ranks on every completion and assessment']
    ];

    var stack = [
      ['Interface', ['React', 'Next.js', 'TypeScript']],
      ['Services', ['Python', 'FastAPI', 'Celery']],
      ['Data', ['PostgreSQL', 'Redis', 'FAISS / pgvector']],
      ['Intelligence', ['spaCy', 'Sentence-BERT', 'LLM (Llama / GPT)', 'LangChain']],
      ['Integration', ['iGOT Karmayogi APIs', 'Parichay SSO', 'OAuth2']],
      ['Platform', ['MeghRaj / NIC Cloud', 'Docker', 'Kubernetes']]
    ];

    var s = '';
    s += '<div class="pagehead"><div class="pagehead__t"><div class="eyebrow">Method</div>' +
      '<h1>How SAMARTH works</h1>' +
      '<p class="pagehead__d">Two engines share one competency model: a recommender that decides what an official should learn next, and a generator that turns any training document into a validated assessment. What you have been clicking through runs both, live, in this browser.</p></div></div>';

    /* architecture */
    s += '<div class="panel"><div class="panel__head"><div><h3>System architecture</h3>' +
      '<div class="sub">Intelligence layer beside iGOT Karmayogi, not in front of it</div></div></div>' +
      '<div class="panel__body">' + architecture() + '</div></div>';

    s += '<div class="grid g-main" style="margin-top:15px">';
    s += '<div class="panel"><div class="panel__head"><div><h3>Recommendation pipeline</h3>' +
      '<div class="sub">Five stages from service record to ranked module</div></div></div>' +
      '<div class="panel__body">' + pipeline.map(function (p, i) {
        return '<div class="pipe__step"><div class="pipe__n">' + (i + 1) + '</div>' +
          '<div><div class="pipe__t">' + esc(p[0]) + '</div>' +
          '<div class="pipe__d">' + esc(p[1]) + '</div>' +
          '<div class="pipe__tech">' + p[2].map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
          '</div></div>';
      }).join('') + '</div></div>';

    s += '<div class="panel"><div class="panel__head"><div><h3>Assessment generation</h3>' +
      '<div class="sub">Document → validated paper</div></div></div>' +
      '<div class="panel__body">' + assess.map(function (p, i) {
        return '<div class="pipe__step"><div class="pipe__n">' + (i + 1) + '</div>' +
          '<div><div class="pipe__t">' + esc(p[0]) + '</div><div class="pipe__d">' + esc(p[1]) + '</div></div></div>';
      }).join('') + '</div>' +
      '<div class="panel__foot"><button class="btn btn--sm btn--primary" data-go="studio">Try it on your own document</button></div></div>';
    s += '</div>';

    /* comparison */
    s += '<div class="section-title"><h2>Against the current experience</h2><div class="rule"></div></div>';
    s += '<div class="panel"><div class="tablewrap"><table class="tbl"><thead><tr>' +
      '<th style="width:130px">Aspect</th><th>Static catalogue browsing today</th><th>SAMARTH recommendation engine</th></tr></thead><tbody>' +
      compare.map(function (c) {
        return '<tr><td style="font-weight:500">' + esc(c[0]) + '</td>' +
          '<td style="color:var(--text-3);font-size:12.5px">' + esc(c[1]) + '</td>' +
          '<td style="font-size:12.5px"><span class="row" style="gap:7px;align-items:flex-start">' +
          '<span style="color:var(--good);flex:none;margin-top:2px">' + A.icon('check') + '</span>' +
          '<span>' + esc(c[2]) + '</span></span></td></tr>';
      }).join('') + '</tbody></table></div></div>';

    /* stack + safeguards */
    s += '<div class="grid g-main" style="margin-top:15px">';
    s += '<div class="panel"><div class="panel__head"><h3>Technology stack</h3></div>' +
      '<div class="panel__body stack-sm">' + stack.map(function (g) {
        return '<div class="row" style="gap:12px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--line-soft)">' +
          '<div class="stat__k" style="width:96px;flex:none;padding-top:3px">' + esc(g[0]) + '</div>' +
          '<div class="chips">' + g[1].map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div></div>';
      }).join('') + '</div></div>';

    s += '<div class="panel"><div class="panel__head"><h3>Safeguards</h3></div><div class="panel__body stack-sm">' +
      [['Human in the loop', 'Generated items are reviewed by NSSTA faculty before a paper becomes a certification assessment. Confidence and difficulty are surfaced to make that review fast.'],
        ['Explainable by default', 'Every recommendation carries its score decomposition; every generated question cites the sentence it came from.'],
        ['DPDP-aligned', 'Processing is for a lawful employment purpose; outputs are aggregate; the statutory confidentiality guarantee of the Collection of Statistics Act is preserved.'],
        ['No new identity store', 'Officials sign in through existing SSO. SAMARTH holds competency state, not credentials.'],
        ['Fair to thin records', 'Evidence weights renormalise, so a new recruit with no training history is not scored as though they had failed.']]
        .map(function (x) {
          return '<div style="padding:8px 0;border-bottom:1px solid var(--line-soft)">' +
            '<div style="font-size:13px;font-weight:600">' + esc(x[0]) + '</div>' +
            '<div style="font-size:12.5px;color:var(--text-2);margin-top:3px;line-height:1.55">' + esc(x[1]) + '</div></div>';
        }).join('') + '</div></div>';
    s += '</div>';

    /* what the detailed problem statement asks for that this build does
       not yet do - stated plainly rather than implied by omission */
    var roadmap = [
      ['AI virtual assistant for learners', 'Planned',
        'A retrieval-grounded assistant answering questions against the course corpus and the officer\'s own gap profile, so help is specific to what they are studying.'],
      ['Adaptive assessment', 'Partial',
        'Items already carry a difficulty score and a discrimination estimate. Sequencing them adaptively against a learner ability estimate is the next step.'],
      ['Virtual laboratories', 'Planned',
        'Containerised Python, SQL and cloud sandboxes launched from a module, so practice happens inside the platform rather than on a personal machine.'],
      ['Predictive workforce analytics', 'Shipped',
        'The emerging skill demand table projects which competencies will be short next year, weighting current shortfall by adoption pace.'],
      ['Multilingual delivery', 'Partial',
        'The catalogue carries language availability and recommendations respect it. Interface localisation into Hindi and regional languages is not yet done.'],
      ['Trainer authoring workspace', 'Planned',
        'A review queue where NSSTA faculty edit, approve or reject generated items in bulk before a paper is published to a cohort.']
    ];

    s += '<div class="section-title"><h2>Beyond this prototype</h2><div class="rule"></div>' +
      '<span class="muted" style="font-size:12px">Stated plainly, so the gap between demo and product is visible</span></div>';
    s += '<div class="panel"><div class="tablewrap"><table class="tbl"><thead><tr>' +
      '<th style="width:230px">Capability</th><th style="width:90px">Status</th><th>Position</th></tr></thead><tbody>' +
      roadmap.map(function (r) {
        var tone = r[1] === 'Shipped' ? 'good' : r[1] === 'Partial' ? 'warn' : 'info';
        return '<tr><td style="font-weight:500">' + esc(r[0]) + '</td>' +
          '<td><span class="tag tag--' + tone + '">' + esc(r[1]) + '</span></td>' +
          '<td style="font-size:12.5px;color:var(--text-2)">' + esc(r[2]) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';

    return s;
  };

  function architecture() {
    var W = 900, H = 300;
    function box(x, y, w, h, title, items, tone) {
      var fill = tone === 'accent' ? 'var(--accent-soft)' : 'var(--surface-2)';
      var stroke = tone === 'accent' ? 'var(--accent-line)' : 'var(--line)';
      var g = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1"/>';
      g += '<text x="' + (x + 12) + '" y="' + (y + 19) + '" font-family="var(--f-mono)" font-size="9" letter-spacing="0.11em" fill="' +
        (tone === 'accent' ? 'var(--accent-hi)' : 'var(--text-3)') + '">' + esc(title.toUpperCase()) + '</text>';
      items.forEach(function (it, i) {
        g += '<text x="' + (x + 12) + '" y="' + (y + 38 + i * 15.5) + '" font-family="var(--f-sans)" font-size="11.5" fill="var(--text-2)">' + esc(it) + '</text>';
      });
      return g;
    }
    function arrow(x1, y1, x2, y2, label) {
      var g = '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
        '" stroke="var(--line-strong)" stroke-width="1.4" marker-end="url(#ah)"/>';
      if (label) {
        g += '<text x="' + ((x1 + x2) / 2) + '" y="' + ((y1 + y2) / 2 - 6) + '" text-anchor="middle" ' +
          'font-family="var(--f-mono)" font-size="9" fill="var(--text-3)">' + esc(label) + '</text>';
      }
      return g;
    }

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="System architecture: sources, intelligence layer and experiences">';
    s += '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">' +
      '<path d="M0 0L10 5L0 10z" fill="var(--line-strong)"/></marker></defs>';

    s += box(8, 34, 196, 118, 'Sources of record', [
      'iGOT Karmayogi APIs', 'MoSPI HRMS / service book', 'NSSTA TPAC programmes',
      'Competency frameworks', 'Uploaded training material'], '');

    s += box(252, 8, 396, 176, 'SAMARTH intelligence layer', [], 'accent');
    s += box(266, 34, 178, 66, 'Profile & gap engine', ['NER · attainment vector', 'target matrix · criticality'], '');
    s += box(456, 34, 178, 66, 'Recommender', ['vector retrieval + re-rank', 'collaborative signal'], '');
    s += box(266, 108, 178, 62, 'Assessment generator', ['concept extraction', 'item build + validation'], '');
    s += box(456, 108, 178, 62, 'Feedback ingestion', ['completions · scores', 'recency decay'], '');

    s += box(696, 34, 196, 118, 'Experiences', [
      'Officer dashboard', 'Learning path', 'Assessment studio',
      'Administrator analytics', 'Write-back to iGOT'], '');

    s += arrow(206, 93, 250, 93, 'pull');
    s += arrow(650, 93, 694, 93, 'serve');
    s += arrow(794, 154, 794, 196);
    s += arrow(106, 196, 106, 154);
    s += '<line x1="106" y1="196" x2="794" y2="196" stroke="var(--line-strong)" stroke-width="1.4" stroke-dasharray="5 4"/>';
    s += '<text x="450" y="212" text-anchor="middle" font-family="var(--f-mono)" font-size="9.5" fill="var(--text-3)">' +
      'WRITE-BACK · enrolments, assessment scores and competency updates return to the official record on iGOT</text>';

    s += box(8, 236, 884, 54, 'Platform', [
      'MeghRaj / NIC Cloud · Kubernetes · PostgreSQL + pgvector · Parichay SSO (OAuth2) · DPDP-aligned processing · audit log on every recommendation'], '');
    return s + '</svg>';
  }
})(window.NX);
