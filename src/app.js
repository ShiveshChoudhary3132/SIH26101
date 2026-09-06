/* ===========================================================
   SAMARTH · application shell, state and router
   =========================================================== */
(function (NX) {
  'use strict';
  var A = {};
  NX.app = A;
  var esc = NX.charts.esc;
  A.esc = esc;

  /* ---------- icons (stroke, 24-grid) ---------- */
  var I = {
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    target: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8zM12 11.5a.5.5 0 100 1 .5.5 0 000-1z',
    route: 'M6 20V9a3 3 0 013-3h6a3 3 0 003-3M6 20a2 2 0 100-4 2 2 0 000 4zM18 6a2 2 0 100-4 2 2 0 000 4zM12 12h6',
    quiz: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 13l2 2 4-4',
    chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    plug: 'M9 3v6M15 3v6M7 9h10v4a5 5 0 01-10 0zM12 18v3',
    layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
    sun: 'M12 5V3M12 21v-2M5 12H3M21 12h-2M6.3 6.3L4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
    moon: 'M20 14.5A8.5 8.5 0 019.5 4a8.5 8.5 0 1010.5 10.5z',
    menu: 'M4 7h16M4 12h16M4 17h16',
    bolt: 'M13 2L4 14h6l-1 8 9-12h-6l1-8z',
    info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v5M12 8h.01',
    refresh: 'M20 11a8 8 0 10-2.3 5.7M20 5v6h-6',
    check: 'M4 12l5 5L20 6',
    down: 'M12 4v14M6 13l6 6 6-6',
    spark: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z',
    file: 'M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5M9 13h6M9 17h4'
  };
  A.icon = function (n, cls) {
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + I[n] + '"/></svg>';
  };

  /* ---------- state ---------- */
  A.state = {
    view: 'overview',
    officerId: 'OFF-001',
    compFilter: 'ALL',
    recDomain: 'ALL',
    recHideDone: true,
    budget: 90,
    studio: { matId: 'MAT-01', custom: '', count: 10, mix: 'balanced', result: null, answers: {}, submitted: false, busy: false, salt: 0, srcTitle: '', srcMeta: '' },
    analyticsRole: 'ALL',
    railOpen: false
  };

  A.officer = function () {
    return NX.OFFICERS.filter(function (o) { return o.id === A.state.officerId; })[0];
  };
  A.profile = function () { return NX.engine.profile(A.officer()); };

  /* ---------- toasts ---------- */
  A.toast = function (title, body, kind) {
    var host = document.getElementById('toasts');
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast--' + kind : '');
    el.innerHTML = A.icon(kind === 'good' ? 'check' : 'info') +
      '<div><b>' + esc(title) + '</b>' + (body ? esc(body) : '') + '</div>';
    host.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0'; el.style.transform = 'translateY(6px)';
      setTimeout(function () { el.remove(); }, 320);
    }, 4200);
  };

  /* ---------- shared fragments ---------- */
  A.stat = function (k, v, d, mod) {
    return '<div class="stat' + (mod ? ' stat--' + mod : '') + '">' +
      '<div class="stat__k">' + esc(k) + '</div>' +
      '<div class="stat__v">' + v + '</div>' +
      (d ? '<div class="stat__d">' + d + '</div>' : '') + '</div>';
  };

  A.sevTag = function (sev, text) {
    var m = { crit: 'crit', warn: 'warn', info: 'info', good: 'good' };
    return '<span class="tag tag--' + m[sev] + '">' + esc(text) + '</span>';
  };

  A.domainName = function (id) {
    var d = NX.DOMAINS.filter(function (x) { return x.id === id; })[0];
    return d ? d.short : id;
  };
  A.domainColour = function (id) {
    return { STAT: 'var(--accent)', TECH: 'var(--info)', DIGI: 'var(--amber-hi)', BEHV: 'var(--good)' }[id];
  };

  A.pips = function (cur, tgt) {
    var s = '', i;
    for (i = 1; i <= 5; i++) {
      var cls = i <= Math.round(cur) ? 'pip pip--on' : (i <= tgt ? 'pip pip--gap' : 'pip');
      s += '<span class="' + cls + '"></span>';
    }
    return '<span class="levelpips" title="Current ' + (Math.round(cur * 10) / 10) + ' of target ' + tgt + '">' + s + '</span>';
  };

  /* Real iGOT identifiers are long; show a verifiable prefix. */
  A.courseCode = function (c) {
    return c.origin === 'igot' && c.id.length > 14 ? c.id.slice(0, 12) + '\u2026' : c.id;
  };
  A.originTag = function (c) {
    return c.origin === 'igot'
      ? '<span class="tag tag--info">Live iGOT</span>'
      : '<span class="tag tag--accent">NSSTA TPAC</span>';
  };

  A.num = function (n, d) {
    return Number(n).toLocaleString('en-IN', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  };

  /* ---------- navigation ---------- */
  A.NAV = [
    { group: 'Officer', items: [
      { id: 'overview', label: 'Overview', icon: 'grid' },
      { id: 'competency', label: 'Competency Profile', icon: 'target' },
      { id: 'path', label: 'Learning Path', icon: 'route' },
      { id: 'studio', label: 'Assessment Studio', icon: 'quiz' }
    ] },
    { group: 'Institution', items: [
      { id: 'analytics', label: 'Workforce Analytics', icon: 'chart' },
      { id: 'integration', label: 'iGOT Integration', icon: 'plug' },
      { id: 'method', label: 'How It Works', icon: 'layers' }
    ] }
  ];

  A.go = function (view) {
    A.state.view = view;
    A.state.railOpen = false;
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'auto' : 'auto' });
    A.render();
  };

  /* ---------- theme ---------- */
  A.toggleTheme = function () {
    var cur = document.documentElement.getAttribute('data-theme');
    if (!cur) {
      var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      cur = prefersDark ? 'dark' : 'light';
    }
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('samarth-theme', next); } catch (e) { /* private mode */ }
    A.render();
  };

  A.isDark = function () {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t === 'dark';
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  };

  /* ---------- shell render ---------- */
  function rail() {
    var s = '<aside class="rail" id="rail" data-open="' + (A.state.railOpen ? 1 : 0) + '">';
    s += '<div class="rail__brand"><div class="brand">' +
      '<svg class="brand__mark" viewBox="0 0 40 40" aria-hidden="true">' +
      '<rect x="1" y="1" width="38" height="38" rx="10" fill="var(--accent)"/>' +
      '<path d="M10 28V20M16 28V14M22 28V23" stroke="var(--on-accent)" stroke-width="2.8" stroke-linecap="round"/>' +
      '<path d="M28 28V11" stroke="var(--amber)" stroke-width="2.8" stroke-linecap="round"/>' +
      '<circle cx="28" cy="10" r="3.6" fill="var(--amber)"/></svg>' +
      '<div><div class="brand__name">SAMARTH</div>' +
      '<div class="brand__sub">MoSPI · NSSTA</div></div></div></div>';

    s += '<nav class="rail__nav">';
    A.NAV.forEach(function (g) {
      s += '<div class="navgroup"><div class="navgroup__label">' + esc(g.group) + '</div>';
      g.items.forEach(function (it) {
        var badge = '';
        if (it.id === 'competency') {
          var p = A.profile();
          if (p.criticalCount) badge = '<span class="navitem__badge">' + p.criticalCount + '</span>';
        }
        s += '<button class="navitem" data-go="' + it.id + '" aria-label="' + esc(it.label) + '"' +
          (A.state.view === it.id ? ' aria-current="page"' : '') + '>' +
          A.icon(it.icon, 'navitem__ico') + '<span>' + esc(it.label) + '</span>' + badge + '</button>';
      });
      s += '</div>';
    });
    s += '</nav>';

    s += '<div class="rail__foot">';
    if (window.SAMARTH_IGOT_LOGO) {
      s += '<div class="partner"><span class="partner__k">Built to integrate with</span>' +
        '<img class="partner__logo" src="' + window.SAMARTH_IGOT_LOGO + '" alt="iGOT Karmayogi Bharat"></div>';
    }
    s += '<div class="tricolour"></div>' +
      '<div class="rail__meta"><b>SIH 2026 · SIH26101</b><br>Team SPARK · TH108<br>' +
      '<span class="mono" style="font-size:10px">Prototype build 0.9.4</span></div></div>';
    return s + '</aside>';
  }

  function topbar() {
    var o = A.officer(), role = NX.roleById[o.role];
    var initials = o.name.split(' ').map(function (x) { return x[0]; }).slice(0, 2).join('');
    var titles = { overview: 'Overview', competency: 'Competency Profile', path: 'Learning Path',
      studio: 'Assessment Studio', analytics: 'Workforce Analytics', integration: 'iGOT Integration', method: 'How It Works' };

    var s = '<header class="topbar">';
    s += '<button class="iconbtn menubtn" id="menubtn" aria-label="Open navigation">' + A.icon('menu') + '</button>';
    s += '<span class="crumb">SAMARTH / ' + esc(titles[A.state.view]) + '</span>';
    s += '<div class="topbar__spacer"></div>';
    s += '<span class="syncchip" id="syncchip"><span class="pulse"></span>iGOT synced · ' + A.num(NX.IGOT_COURSES.length) + ' modules</span>';
    if (NX.api) {
      var st = NX.api.state;
      var tone = st === 'online' ? 'good' : st === 'connecting' ? 'warn' : 'text-3';
      s += '<span class="tag tag--' + (st === 'online' ? 'good' : st === 'connecting' ? 'warn' : '') +
        '" title="' + esc(NX.api.enabled ? (NX.api.base + ' — ' + (NX.api.detail || st)) : 'No API configured; state lives in this browser session') + '">' +
        esc(NX.api.label()) + '</span>';
    }
    s += '<div class="officer-switch"><span class="avatar">' + esc(initials) + '</span>' +
      '<select id="offsel" aria-label="Switch officer profile">';
    NX.OFFICERS.forEach(function (x) {
      s += '<option value="' + x.id + '"' + (x.id === A.state.officerId ? ' selected' : '') + '>' +
        esc(x.name) + ' — ' + esc(NX.roleById[x.role].name) + '</option>';
    });
    s += '</select></div>';
    s += '<button class="iconbtn" id="themebtn" aria-label="Switch colour theme">' + A.icon(A.isDark() ? 'sun' : 'moon') + '</button>';
    return s + '</header>';
  }

  A.render = function () {
    var root = document.getElementById('root');
    var view = NX.views[A.state.view];
    root.innerHTML = '<div class="app">' + rail() +
      '<div class="main">' + topbar() +
      '<main class="view" id="viewroot">' + view() + '</main></div></div>';
    A.bind();
    if (NX.views[A.state.view + 'After']) NX.views[A.state.view + 'After']();
  };

  /* ---------- event binding (delegated where possible) ---------- */
  A.bind = function () {
    var root = document.getElementById('root');

    root.querySelectorAll('[data-go]').forEach(function (b) {
      b.addEventListener('click', function () { A.go(b.getAttribute('data-go')); });
    });

    var sel = document.getElementById('offsel');
    if (sel) sel.addEventListener('change', function () {
      A.state.officerId = sel.value;
      A.state.studio.result = null; A.state.studio.answers = {}; A.state.studio.submitted = false;
      A.render();
      A.toast('Profile switched', ' Competency vector recomputed for ' + A.officer().name + '.');
    });

    var tb = document.getElementById('themebtn');
    if (tb) tb.addEventListener('click', A.toggleTheme);

    var mb = document.getElementById('menubtn');
    if (mb) mb.addEventListener('click', function () {
      A.state.railOpen = !A.state.railOpen;
      var r = document.getElementById('rail');
      if (r) r.setAttribute('data-open', A.state.railOpen ? '1' : '0');
    });

    if (NX.views[A.state.view + 'Bind']) NX.views[A.state.view + 'Bind'](root);
  };

  /* ---------- boot ---------- */
  A.boot = function () {
    try {
      var t = localStorage.getItem('samarth-theme');
      if (t) document.documentElement.setAttribute('data-theme', t);
    } catch (e) { /* storage unavailable — fall back to system theme */ }
    NX.engine.workforce();          // warm the analytics substrate
    A.render();

    /* Persistence is optional. Paint first, then try the API; if it is
       absent, asleep or failing, the session simply stays local. */
    if (NX.api && NX.api.enabled) {
      NX.api.hydrate().then(function (restored) {
        A.render();
        if (restored) {
          A.toast('Service record restored', ' ' + NX.api.detail + '.', 'good');
        } else if (NX.api.state === 'offline') {
          A.toast('Running locally', ' ' + NX.api.detail + '. Changes stay in this browser session.', 'warn');
        }
      });
    }
  };
})(window.NX);
