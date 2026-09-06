/* ===========================================================
   SAMARTH · Assessment Studio
   Upload or paste learning material, generate a validated MCQ
   paper, sit it, and push the result into the competency vector.
   =========================================================== */
(function (NX) {
  'use strict';
  var V = NX.views, A = NX.app, CH = NX.charts, M = NX.mcq;
  var esc = CH.esc;
  function r1(n) { return Math.round(n * 10) / 10; }

  var STAGES = [
    'Reading document & segmenting sentences',
    'Extracting key concepts (TF-IDF + n-gram scoring)',
    'Mapping content onto the competency framework',
    'Composing candidate items across six question forms',
    'Generating distractors in the plausibility band',
    'Validating: duplicates, length cues, dangling stems'
  ];

  function sourceText() {
    var st = A.state.studio;
    if (st.custom && st.custom.trim().length > 200) return st.custom;
    var m = NX.MATERIALS.filter(function (x) { return x.id === st.matId; })[0];
    return m ? m.text : '';
  }
  function sourceMeta() {
    var st = A.state.studio;
    if (st.custom && st.custom.trim().length > 200) {
      return { title: st.srcTitle || 'Uploaded material', src: st.srcMeta || 'Pasted text', kind: 'Text' };
    }
    var m = NX.MATERIALS.filter(function (x) { return x.id === st.matId; })[0];
    return m || { title: '—', src: '', kind: '' };
  }

  V.studio = function () {
    var st = A.state.studio, o = A.officer();
    var meta = sourceMeta();

    var s = '';
    s += '<div class="pagehead"><div class="pagehead__t"><div class="eyebrow">Assessment Studio</div>' +
      '<h1>Generate a quiz from any training material</h1>' +
      '<p class="pagehead__d">The engine reads the document, extracts its concepts and composes multiple-choice items with distractors drawn from the same subject vocabulary. Every candidate item is validated before it ships; the score then updates ' + esc(o.name.split(' ')[0]) + '\'s competency vector.</p></div></div>';

    s += '<div class="grid g-side">';

    /* ---------------- left: source & controls ---------------- */
    s += '<div class="stack">';

    s += '<div class="panel"><div class="panel__head"><div><h3>Source material</h3>' +
      '<div class="sub">Sample corpus, or bring your own</div></div></div><div class="panel__body stack-sm">';
    NX.MATERIALS.forEach(function (m) {
      var on = !st.custom && st.matId === m.id;
      s += '<button class="opt" data-mat="' + m.id + '" data-state="' + (on ? 'picked' : '') + '" style="align-items:center">' +
        A.icon('file', 'ico--md') +
        '<div style="min-width:0"><div style="font-weight:500;font-size:13px">' + esc(m.title) + '</div>' +
        '<div class="mono" style="font-size:10.5px;color:var(--text-3);margin-top:2px">' + esc(m.src) + ' · ' + esc(m.kind) + '</div></div>' +
        '</button>';
    });
    s += '</div>';

    s += '<div class="panel__body" style="border-top:1px solid var(--line-soft)">' +
      '<div class="drop" id="drop"><h4>Drop a file, or paste below</h4>' +
      '<p>.txt and .md read directly · .pdf parsed in the browser</p>' +
      '<div style="margin-top:10px"><label class="btn btn--sm" style="cursor:pointer">Choose file' +
      '<input type="file" id="fileinput" accept=".txt,.md,.markdown,.csv,.pdf" style="display:none"></label></div></div>' +
      '<div class="field" style="margin-top:11px"><span class="field__l">Or paste material</span>' +
      '<textarea class="textarea" id="custom" placeholder="Paste at least a few hundred words of training material…">' + esc(st.custom) + '</textarea></div>' +
      (st.custom && st.custom.trim().length > 200
        ? '<div class="row" style="margin-top:8px"><span class="tag tag--good">Using your material · ' + NX.nlp.words(st.custom).length + ' words</span>' +
          '<button class="btn btn--sm btn--ghost" id="clearcustom">Clear</button></div>' : '') +
      '</div></div>';

    s += '<div class="panel"><div class="panel__head"><h3>Paper settings</h3></div><div class="panel__body stack-sm">' +
      '<div><div class="row between"><span class="field__l">Questions</span><span class="num" style="font-size:11px">' + st.count + '</span></div>' +
      '<input type="range" id="qcount" min="5" max="16" step="1" value="' + st.count + '"></div>' +
      '<div class="field"><span class="field__l">Cognitive mix</span><div class="seg" style="width:100%">' +
      [['balanced', 'Balanced'], ['recall', 'Recall-led'], ['applied', 'Application-led']].map(function (x) {
        return '<button data-mix="' + x[0] + '" aria-pressed="' + (st.mix === x[0]) + '" style="flex:1">' + esc(x[1]) + '</button>';
      }).join('') + '</div></div>' +
      '<button class="btn btn--primary btn--lg" id="gen" style="width:100%;margin-top:4px">' +
      A.icon('bolt') + (st.result ? 'Regenerate paper' : 'Generate assessment') + '</button>' +
      '<div style="font-size:11.5px;color:var(--text-3);line-height:1.5">Runs entirely in this browser — the document never leaves the machine. In production the same pipeline runs server-side with an LLM re-writing stems for fluency.</div>' +
      '</div></div>';

    s += '</div>';

    /* ---------------- right: results ---------------- */
    s += '<div class="stack" id="resultcol">';
    if (st.busy) {
      s += '<div class="panel"><div class="panel__head"><h3>Generating…</h3></div><div class="panel__body">' +
        '<div class="stages" id="stages">' + STAGES.map(function (t, i) {
          return '<div class="stg" data-on="0" data-i="' + i + '"><span class="stg__i"></span><span>' + esc(t) + '</span></div>';
        }).join('') + '</div></div></div>';
    } else if (!st.result) {
      s += '<div class="panel"><div class="panel__body" style="padding:40px 24px;text-align:center">' +
        '<div style="color:var(--text-3);margin-bottom:10px;display:flex;justify-content:center">' + A.icon('quiz', 'ico--lg') + '</div>' +
        '<h3 style="font-size:16px">Pick a document and generate</h3>' +
        '<p style="font-size:13px;color:var(--text-3);margin-top:6px;max-width:46ch;margin-inline:auto">' +
        esc(meta.title) + ' is selected. Press <b>Generate assessment</b> to see the extraction summary, the concept map and the validated paper.</p></div></div>';
    } else {
      s += renderResult(st.result, meta);
    }
    s += '</div>';

    s += '</div>';
    return s;
  };

  function renderResult(res, meta) {
    var st = A.state.studio, stats = res.stats;
    var s = '';

    /* --- extraction summary --- */
    s += '<div class="panel"><div class="panel__head"><div><h3>' + esc(meta.title) + '</h3>' +
      '<div class="sub">' + esc(meta.src) + (meta.kind ? ' · ' + esc(meta.kind) : '') + '</div></div>' +
      '<span class="tag tag--accent hstretch">' + stats.shipped + ' items shipped</span></div>' +
      '<div class="panel__body"><div class="grid g-4" style="gap:10px">' +
      [['Words', A.num(stats.words)], ['Sentences', stats.sentences],
        ['Concepts found', stats.concepts], ['Reading ease', stats.readingEase]]
        .map(function (x) {
          return '<div><div class="stat__k">' + esc(x[0]) + '</div><div class="num" style="font-size:19px;font-weight:600">' + x[1] + '</div></div>';
        }).join('') + '</div>';

    s += '<div class="grid g-3" style="gap:10px;margin-top:14px;padding-top:13px;border-top:1px solid var(--line-soft)">' +
      '<div><div class="stat__k">Candidates built</div><div class="num" style="font-size:19px;font-weight:600">' + stats.candidates + '</div></div>' +
      '<div><div class="stat__k">Rejected by validator</div><div class="num" style="font-size:19px;font-weight:600;color:var(--critical)">' + res.rejected.length + '</div></div>' +
      '<div><div class="stat__k">Mean confidence</div><div class="num" style="font-size:19px;font-weight:600;color:var(--good)">' + stats.avgConfidence + '%</div></div>' +
      '</div>';

    if (res.rejectSummary && res.rejectSummary.length) {
      s += '<div style="margin-top:12px;padding-top:11px;border-top:1px solid var(--line-soft)">' +
        '<div class="stat__k" style="margin-bottom:6px">Why candidates were rejected</div>' +
        '<div class="chips">' + res.rejectSummary.map(function (r) {
          return '<span class="tag tag--crit">' + esc(r.why) + ' × ' + r.n + '</span>';
        }).join('') + '</div></div>';
    }
    s += '</div></div>';

    /* --- concepts + competency mapping --- */
    s += '<div class="grid g-2">';
    s += '<div class="panel"><div class="panel__head"><div><h3>Key concepts</h3>' +
      '<div class="sub">Top-weighted terms, TF-IDF against the domain corpus</div></div></div>' +
      '<div class="panel__body"><div class="chips">' +
      res.ctx.phrases.slice(0, 12).map(function (p) {
        return '<span class="concept">' + esc(p.phrase) + ' <i>' + r1(p.score) + '</i></span>';
      }).join('') + '</div>' +
      '<div style="margin-top:13px;padding-top:12px;border-top:1px solid var(--line-soft)">' +
      '<div class="stat__k" style="margin-bottom:6px">Learning objectives derived</div>' +
      '<ul style="margin:0;padding-left:17px;font-size:12.5px;color:var(--text-2);line-height:1.65">' +
      res.objectives.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
      '</div></div>';

    s += '<div class="panel"><div class="panel__head"><div><h3>Competency mapping</h3>' +
      '<div class="sub">Where this score will be applied</div></div></div>' +
      '<div class="panel__body stack-sm">' +
      res.ctx.competencies.map(function (c) {
        return '<div><div class="row between"><span style="font-size:12.5px;font-weight:500">' + esc(c.name) + '</span>' +
          '<span class="num" style="font-size:11px;color:var(--text-3)">' + c.conf + '%</span></div>' +
          '<div class="meter" style="margin-top:4px"><div class="meter__fill" style="width:' + c.conf + '%;background:' + A.domainColour(c.d) + '"></div></div>' +
          '<div class="mono" style="font-size:10.5px;color:var(--text-3);margin-top:3px">' + esc(c.id) + '</div></div>';
      }).join('') +
      '<div style="margin-top:6px;padding-top:11px;border-top:1px solid var(--line-soft)">' +
      '<div class="stat__k" style="margin-bottom:7px">Paper composition</div>' +
      '<div class="chips">' + Object.keys(stats.bloom).map(function (k) {
        return '<span class="tag tag--info">' + esc(k) + ' × ' + stats.bloom[k] + '</span>';
      }).join('') + '</div>' +
      '<div class="chips" style="margin-top:6px">' + Object.keys(stats.types).map(function (k) {
        return '<span class="tag">' + esc(k) + ' × ' + stats.types[k] + '</span>';
      }).join('') + '</div></div>' +
      '</div></div>';
    s += '</div>';

    /* --- the paper --- */
    var answered = Object.keys(st.answers).length;
    s += '<div class="section-title"><h2>Assessment paper</h2><div class="rule"></div>' +
      '<span class="muted" style="font-size:12px">' + answered + ' / ' + res.items.length + ' answered</span>' +
      (st.submitted ? '' : '<button class="btn btn--sm btn--primary" id="submitquiz"' + (answered < res.items.length ? ' disabled' : '') + '>Submit paper</button>') +
      '</div>';

    if (st.submitted) s += renderScore(res);

    s += '<div class="stack">';
    res.items.forEach(function (q, qi) {
      var picked = st.answers[qi];
      var stem = esc(q.stem).replace('⟦____⟧', '<span class="blank">________</span>');
      s += '<div class="q"><div class="q__head"><span class="q__n">' + String(q.n).padStart(2, '0') + '</span>' +
        '<div class="q__stem">' + stem + '</div></div>' +
        '<div class="q__meta">' +
        '<span class="tag tag--accent">' + esc(q.typeLabel) + '</span>' +
        '<span class="tag tag--info">' + esc(q.bloom) + '</span>' +
        '<span class="tag ' + (q.difficulty === 'Hard' ? 'tag--crit' : q.difficulty === 'Moderate' ? 'tag--warn' : 'tag--good') + '">' + esc(q.difficulty) + '</span>' +
        '<span class="tag">confidence ' + q.confidence + '%</span>' +
        '<span class="tag">discrimination ' + q.discrimination.toFixed(2) + '</span>' +
        '</div><div class="q__opts">';
      q.options.forEach(function (opt, oi) {
        var state = '';
        if (st.submitted) {
          if (oi === q.correctIndex) state = 'right';
          else if (picked === oi) state = 'wrong';
        } else if (picked === oi) state = 'picked';
        s += '<button class="opt" data-q="' + qi + '" data-o="' + oi + '" data-state="' + state + '"' +
          (st.submitted ? ' disabled' : '') + '>' +
          '<span class="opt__k">' + M.LETTERS[oi] + '</span><span>' + esc(opt) + '</span></button>';
      });
      s += '</div>';
      if (st.submitted) {
        s += '<div class="explain"><b>' + (picked === q.correctIndex ? 'Correct.' : 'Correct answer: ' + M.LETTERS[q.correctIndex] + '.') + '</b> ' +
          esc(q.answer) + '<span class="cite">Source · sentence ' + (q.source.idx + 1) + ': “' + esc(q.source.text) + '”</span></div>';
      }
      s += '</div>';
    });
    s += '</div>';
    return s;
  }

  function renderScore(res) {
    var st = A.state.studio, correct = 0;
    res.items.forEach(function (q, i) { if (st.answers[i] === q.correctIndex) correct++; });
    var pct = Math.round((correct / res.items.length) * 100);

    var byDiff = { Easy: [0, 0], Moderate: [0, 0], Hard: [0, 0] };
    res.items.forEach(function (q, i) {
      byDiff[q.difficulty][1]++;
      if (st.answers[i] === q.correctIndex) byDiff[q.difficulty][0]++;
    });

    var applied = st.applied;
    var s = '<div class="panel" style="margin-bottom:15px;border-color:var(--accent-line)">' +
      '<div class="panel__head"><div><h3>Result</h3><div class="sub">Instant scoring with per-item feedback below</div></div></div>' +
      '<div class="panel__body"><div class="grid g-4" style="align-items:center;gap:14px">' +
      '<div>' + CH.gauge(pct, { label: 'SCORE' }) + '</div>' +
      '<div class="stack-sm">' + Object.keys(byDiff).map(function (k) {
        var b = byDiff[k];
        if (!b[1]) return '';
        return '<div><div class="row between"><span style="font-size:12px">' + k + '</span>' +
          '<span class="num" style="font-size:11px">' + b[0] + '/' + b[1] + '</span></div>' +
          '<div class="meter" style="margin-top:3px"><div class="meter__fill" style="width:' + (100 * b[0] / b[1]) + '%"></div></div></div>';
      }).join('') + '</div>' +
      '<div><div class="stat__k">Competencies evidenced</div>' +
      '<div class="chips" style="margin-top:6px">' + res.ctx.competencies.map(function (c) {
        return '<span class="tag tag--accent">' + esc(c.id) + '</span>';
      }).join('') + '</div>' +
      '<div style="font-size:11.5px;color:var(--text-3);margin-top:8px;line-height:1.5">This result carries a 20% weight in the attainment estimate for these competencies.</div></div>' +
      '<div>' + (applied
        ? '<div class="callout"><span>' + A.icon('check') + '</span><div><div class="callout__t">Applied to profile</div>' +
          '<div class="callout__d">Readiness moved from ' + r1(applied.before) + '% to ' + r1(applied.after) + '%.</div></div></div>' +
          '<button class="btn btn--sm" data-go="competency" style="margin-top:8px;width:100%">Open profile</button>'
        : '<button class="btn btn--primary" id="applyscore" style="width:100%">' + A.icon('down') + 'Apply to competency profile</button>' +
          '<div style="font-size:11.5px;color:var(--text-3);margin-top:8px;line-height:1.5">Closes the loop — the assessment becomes evidence and the next recommendation changes.</div>') +
      '</div>' +
      '</div></div></div>';
    return s;
  }

  /* ---------------- behaviour ---------------- */
  V.studioBind = function (root) {
    var st = A.state.studio;

    root.querySelectorAll('[data-mat]').forEach(function (b) {
      b.addEventListener('click', function () {
        st.matId = b.getAttribute('data-mat'); st.custom = '';
        st.result = null; st.answers = {}; st.submitted = false; st.applied = null;
        A.render();
      });
    });

    var ta = document.getElementById('custom');
    if (ta) ta.addEventListener('change', function () {
      st.custom = ta.value; st.srcTitle = 'Pasted material'; st.srcMeta = 'Provided in session';
      st.result = null; st.answers = {}; st.submitted = false; st.applied = null;
      A.render();
    });
    var cc = document.getElementById('clearcustom');
    if (cc) cc.addEventListener('click', function () {
      st.custom = ''; st.result = null; st.answers = {}; st.submitted = false; st.applied = null; A.render();
    });

    var qc = document.getElementById('qcount');
    if (qc) qc.addEventListener('input', function () {
      st.count = +qc.value;
      var lbl = qc.parentNode.querySelector('.num');
      if (lbl) lbl.textContent = st.count;
    });

    root.querySelectorAll('[data-mix]').forEach(function (b) {
      b.addEventListener('click', function () {
        st.mix = b.getAttribute('data-mix');
        root.querySelectorAll('[data-mix]').forEach(function (x) {
          x.setAttribute('aria-pressed', String(x.getAttribute('data-mix') === st.mix));
        });
      });
    });

    var gen = document.getElementById('gen');
    if (gen) gen.addEventListener('click', run);

    /* file input / drag & drop */
    var fi = document.getElementById('fileinput');
    if (fi) fi.addEventListener('change', function () { if (fi.files[0]) readFile(fi.files[0]); });
    var drop = document.getElementById('drop');
    if (drop) {
      ['dragenter', 'dragover'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.setAttribute('data-over', '1'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.setAttribute('data-over', '0'); });
      });
      drop.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
      });
    }

    /* answering */
    root.querySelectorAll('[data-q]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (st.submitted) return;
        var qi = +b.getAttribute('data-q');
        st.answers[qi] = +b.getAttribute('data-o');
        A.render();
      });
    });

    var sub = document.getElementById('submitquiz');
    if (sub) sub.addEventListener('click', function () {
      st.submitted = true; A.render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    var ap = document.getElementById('applyscore');
    if (ap) ap.addEventListener('click', applyScore);
  };

  function run() {
    var st = A.state.studio, text = sourceText();
    if (!text || NX.nlp.words(text).length < 120) {
      A.toast('Not enough text', ' Provide at least ~150 words so the extractor has something to work with.', 'warn');
      return;
    }
    st.busy = true; st.result = null; st.answers = {}; st.submitted = false; st.applied = null;
    st.salt = (st.salt + 1) % 97;
    A.render();

    /* The pipeline below is the real work; the staged reveal simply
       shows which step is running. */
    var i = 0;
    var host = document.getElementById('stages');
    var timer = setInterval(function () {
      if (!host) { clearInterval(timer); return; }
      var rows = host.querySelectorAll('.stg');
      if (i > 0 && rows[i - 1]) rows[i - 1].setAttribute('data-on', '2');
      if (rows[i]) rows[i].setAttribute('data-on', '1');
      i++;
      if (i > rows.length) {
        clearInterval(timer);
        var res;
        try {
          res = NX.mcq.generate(text, { count: st.count, mix: st.mix, salt: st.salt });
        } catch (e) {
          st.busy = false; A.render();
          A.toast('Generation failed', ' ' + e.message, 'warn');
          return;
        }
        st.busy = false; st.result = res;
        A.render();
        A.toast('Paper ready', ' ' + res.stats.shipped + ' items shipped from ' + res.stats.candidates +
          ' candidates; ' + res.rejected.length + ' rejected by the validator.', 'good');
      }
    }, 190);
  }

  function applyScore() {
    var st = A.state.studio, res = st.result, o = A.officer();
    var correct = 0;
    res.items.forEach(function (q, i) { if (st.answers[i] === q.correctIndex) correct++; });
    var pct = Math.round((correct / res.items.length) * 100);
    var before = A.profile().readiness;

    o.assessments = o.assessments || [];
    var record = {
      title: sourceMeta().title,
      comp: res.ctx.competencies.map(function (c) { return c.id; }),
      pct: pct,
      weight: 0.6 + Math.min(0.4, res.items.length / 40),
      itemCount: res.items.length
    };
    o.assessments.push(record);
    if (NX.api) NX.api.saveAssessment(o.id, record);
    var after = A.profile().readiness;
    st.applied = { before: before, after: after, pct: pct };
    A.render();
    A.toast('Profile updated', ' Assessment evidence recorded — readiness ' + r1(before) + '% → ' + r1(after) + '%.', 'good');
  }

  /* ---------------- file reading ---------------- */
  function readFile(file) {
    var st = A.state.studio;
    var name = file.name || 'uploaded file';
    var ext = (name.split('.').pop() || '').toLowerCase();

    if (ext === 'pdf') {
      if (!window.pdfjsLib) {
        A.toast('PDF reader unavailable', ' The in-browser PDF parser did not load. Paste the text instead — everything else works identically.', 'warn');
        return;
      }
      A.toast('Reading PDF', ' Extracting the text layer from ' + name + '…');
      var fr = new FileReader();
      fr.onload = function () {
        window.pdfjsLib.getDocument({ data: new Uint8Array(fr.result) }).promise.then(function (pdf) {
          var pages = [], i;
          for (i = 1; i <= pdf.numPages; i++) pages.push(pdf.getPage(i));
          return Promise.all(pages).then(function (ps) {
            return Promise.all(ps.map(function (p) { return p.getTextContent(); }));
          });
        }).then(function (contents) {
          var text = contents.map(function (c) {
            return c.items.map(function (it) { return it.str; }).join(' ');
          }).join('\n\n').replace(/\s+\n/g, '\n').replace(/[ \t]{2,}/g, ' ');
          accept(text, name, 'PDF · ' + Math.round(file.size / 1024) + ' KB');
        }).catch(function (e) {
          A.toast('Could not read that PDF', ' It may be a scanned image with no text layer. Paste the text instead.', 'warn');
        });
      };
      fr.readAsArrayBuffer(file);
      return;
    }

    var fr2 = new FileReader();
    fr2.onload = function () { accept(String(fr2.result), name, ext.toUpperCase() + ' · ' + Math.round(file.size / 1024) + ' KB'); };
    fr2.onerror = function () { A.toast('Could not read the file', ' Try a plain .txt or paste the text.', 'warn'); };
    fr2.readAsText(file);

    function accept(text, title, kind) {
      if (NX.nlp.words(text).length < 120) {
        A.toast('Too little text', ' ' + title + ' yielded only ' + NX.nlp.words(text).length + ' words.', 'warn');
        return;
      }
      st.custom = text; st.srcTitle = title; st.srcMeta = kind;
      st.result = null; st.answers = {}; st.submitted = false; st.applied = null;
      A.render();
      A.toast('File loaded', ' ' + title + ' · ' + NX.nlp.words(text).length + ' words ready to process.', 'good');
    }
  }
})(window.NX);
