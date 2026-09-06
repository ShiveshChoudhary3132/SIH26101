/* ===========================================================
   SAMARTH · NLP core
   A small, dependency-free text-analytics layer: tokenisation,
   stemming, TF-IDF vector space, cosine similarity, key-phrase
   extraction and sentence segmentation.
   Shared by the recommendation engine and the MCQ generator.
   =========================================================== */
(function (NX) {
  'use strict';
  var N = {};
  NX.nlp = N;

  N.STOP = (
    'a about above after again against all am an and any are as at be because been before being below ' +
    'between both but by can cannot could did do does doing down during each few for from further had has ' +
    'have having he her here hers herself him himself his how i if in into is it its itself me more most my ' +
    'myself no nor not of off on once only or other ought our ours ourselves out over own same she should so ' +
    'some such than that the their theirs them themselves then there these they this those through to too ' +
    'under until up very was we were what when where which while who whom why will with would you your yours ' +
    'also may many much used using use may must shall upon within without across among per etc ie eg thus ' +
    'however therefore whether given whose them made make makes take taken taking well one two three four ' +
    'five six seven eight nine ten first second third new old case cases part parts way ways time times ' +
    'number numbers form forms level levels'
  ).split(' ').reduce(function (m, w) { m[w] = 1; return m; }, {});

  /* Light suffix stemmer — enough to collapse morphological variants
     without the weight of a full Porter implementation. */
  N.stem = function (w) {
    if (w.length < 5) return w;
    var s = w;
    s = s.replace(/(ational|ization|isation)$/, 'ate');
    s = s.replace(/(fulness|ousness|iveness)$/, '');
    s = s.replace(/(ability|ibility)$/, 'able');
    s = s.replace(/(ements|ement)$/, '');
    s = s.replace(/(ations|ation)$/, 'ate');
    s = s.replace(/(ingly|edly)$/, '');
    s = s.replace(/(ically|ical)$/, 'ic');
    s = s.replace(/(iness)$/, 'y');
    s = s.replace(/(ies)$/, 'y');
    s = s.replace(/(sses)$/, 'ss');
    s = s.replace(/([^s])s$/, '$1');
    s = s.replace(/(ing|ed)$/, function (m, g, off) { return s.length - m.length >= 4 ? '' : m; });
    s = s.replace(/(ly)$/, '');
    return s.length >= 3 ? s : w;
  };

  N.words = function (t) {
    return (t || '').toLowerCase().replace(/[’']/g, '').match(/[a-z][a-z0-9-]*/g) || [];
  };

  N.tokens = function (t, keepStop) {
    var out = [], w = N.words(t), i;
    for (i = 0; i < w.length; i++) {
      if (w[i].length < 3) continue;
      if (!keepStop && N.STOP[w[i]]) continue;
      out.push(N.stem(w[i]));
    }
    return out;
  };

  /* ---------- TF-IDF vector space ---------- */
  N.Space = function (docs) {
    // docs: [{id, text}]
    this.docs = docs;
    this.df = {};
    this.tf = [];
    var i, j, t, toks, seen, counts;
    for (i = 0; i < docs.length; i++) {
      toks = N.tokens(docs[i].text);
      counts = {}; seen = {};
      for (j = 0; j < toks.length; j++) {
        t = toks[j];
        counts[t] = (counts[t] || 0) + 1;
        if (!seen[t]) { seen[t] = 1; this.df[t] = (this.df[t] || 0) + 1; }
      }
      this.tf.push(counts);
    }
    this.Ndocs = docs.length;
    this.vecs = [];
    for (i = 0; i < docs.length; i++) this.vecs.push(this.weight(this.tf[i]));
  };

  N.Space.prototype.idf = function (t) {
    var d = this.df[t] || 0;
    return Math.log((this.Ndocs + 1) / (d + 1)) + 1;
  };

  N.Space.prototype.weight = function (counts) {
    var v = {}, t, norm = 0;
    for (t in counts) {
      if (!Object.prototype.hasOwnProperty.call(counts, t)) continue;
      var w = (1 + Math.log(counts[t])) * this.idf(t);
      v[t] = w; norm += w * w;
    }
    norm = Math.sqrt(norm) || 1;
    for (t in v) v[t] /= norm;
    return v;
  };

  N.Space.prototype.vectorise = function (text) {
    var toks = N.tokens(text), counts = {}, i;
    for (i = 0; i < toks.length; i++) counts[toks[i]] = (counts[toks[i]] || 0) + 1;
    return this.weight(counts);
  };

  N.cos = function (a, b) {
    var s = 0, t, small = a, big = b;
    if (Object.keys(a).length > Object.keys(b).length) { small = b; big = a; }
    for (t in small) if (big[t]) s += small[t] * big[t];
    return s;
  };

  /* Terms shared by two vectors, ranked by joint contribution —
     used to explain *why* a course matched. */
  N.overlapTerms = function (a, b, k) {
    var arr = [], t;
    for (t in a) if (b[t]) arr.push([t, a[t] * b[t]]);
    arr.sort(function (x, y) { return y[1] - x[1]; });
    return arr.slice(0, k || 5).map(function (x) { return x[0]; });
  };

  /* ---------- Sentence segmentation ---------- */
  var ABBR = /\b(?:Dr|Mr|Mrs|Ms|Prof|Sh|Smt|No|Fig|Vol|approx|etc|viz|e\.g|i\.e|St|Govt|Ltd|Pvt)\.$/i;

  N.sentences = function (text) {
    var paras = (text || '').split(/\n+/), out = [], p, i, k;
    for (p = 0; p < paras.length; p++) {
      var raw = paras[p].trim();
      if (!raw) continue;
      var parts = raw.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/);
      if (parts.length === 1) parts = raw.split(/(?<=[.!?])\s+/);
      var buf = '';
      for (i = 0; i < parts.length; i++) {
        var s = parts[i].trim();
        if (!s) continue;
        buf = buf ? buf + ' ' + s : s;
        if (ABBR.test(buf)) continue;
        out.push({ text: buf, para: p, idx: out.length });
        buf = '';
      }
      if (buf) out.push({ text: buf, para: p, idx: out.length });
    }
    // discard fragments that are not real sentences
    return out.filter(function (s) {
      var w = N.words(s.text).length;
      return w >= 6 && w <= 70;
    }).map(function (s, k2) { s.idx = k2; return s; });
  };

  /* ---------- Key-phrase extraction ----------
     Unigrams and noun-ish bigrams/trigrams scored by TF-IDF against
     a background corpus, boosted for capitalisation and repetition. */
  N.keyphrases = function (text, bgSpace, limit) {
    var sents = N.sentences(text);
    var wordsAll = N.words(text);
    var i, j;

    // ---- candidate n-grams from each sentence
    var cand = {};   // stemKey -> {surface, count, len, firstAt, capped}
    function add(surface, len, at, capped) {
      var key = N.tokens(surface).join(' ');
      if (!key) return;
      if (!cand[key]) cand[key] = { surface: surface, count: 0, len: len, firstAt: at, capped: 0 };
      cand[key].count++;
      if (capped) cand[key].capped++;
      // prefer the shortest clean surface form seen
      if (surface.length < cand[key].surface.length) cand[key].surface = surface;
    }

    for (i = 0; i < sents.length; i++) {
      var raw = sents[i].text.replace(/[()]/g, ' ');
      var seq = raw.match(/[A-Za-z][A-Za-z0-9-]*/g) || [];
      for (j = 0; j < seq.length; j++) {
        var w1 = seq[j], l1 = w1.toLowerCase();
        var isCap = /^[A-Z]/.test(w1) && j > 0;
        if (l1.length >= 4 && !N.STOP[l1]) add(l1, 1, i, isCap);
        if (j + 1 < seq.length) {
          var w2 = seq[j + 1], l2 = w2.toLowerCase();
          if (!N.STOP[l1] && !N.STOP[l2] && l1.length >= 3 && l2.length >= 3) {
            add(l1 + ' ' + l2, 2, i, isCap && /^[A-Z]/.test(w2));
          }
          if (j + 2 < seq.length) {
            var w3 = seq[j + 2], l3 = w3.toLowerCase();
            if (!N.STOP[l1] && l3.length >= 3 && !N.STOP[l3] && l1.length >= 3) {
              add(l1 + ' ' + l2 + ' ' + l3, 3, i, false);
            }
          }
        }
      }
    }

    // ---- score
    var total = wordsAll.length || 1;
    var out = [];
    for (var key in cand) {
      var c = cand[key];
      var parts = key.split(' ');
      var idf = 0;
      for (i = 0; i < parts.length; i++) idf += bgSpace ? bgSpace.idf(parts[i]) : 3;
      idf /= parts.length;
      // length bonus: multi-word phrases carry more meaning
      var lenB = c.len === 1 ? 1 : c.len === 2 ? 1.55 : 1.25;
      // frequency, sub-linear
      var tf = 1 + Math.log(c.count);
      // phrases that recur across the document matter more than
      // ones that appear twice in the same sentence
      var score = tf * idf * lenB * (1 + 0.22 * (c.capped / c.count));
      // very common single words get suppressed
      if (c.len === 1 && c.count / total > 0.035) score *= 0.55;
      if (c.count < 2 && c.len === 1) score *= 0.7;
      out.push({ phrase: c.surface, key: key, count: c.count, len: c.len, score: score, firstAt: c.firstAt });
    }
    out.sort(function (a, b) { return b.score - a.score; });

    // ---- de-duplicate: drop a phrase fully contained in a better one
    var kept = [];
    for (i = 0; i < out.length; i++) {
      var dup = false;
      for (j = 0; j < kept.length; j++) {
        if (kept[j].key.indexOf(out[i].key) >= 0 || out[i].key.indexOf(kept[j].key) >= 0) { dup = true; break; }
      }
      if (!dup) kept.push(out[i]);
      if (kept.length >= (limit || 24)) break;
    }
    return kept;
  };

  /* ---------- Readability (Flesch reading ease, approximated) ---------- */
  N.syllables = function (w) {
    w = w.toLowerCase().replace(/[^a-z]/g, '');
    if (w.length <= 3) return 1;
    w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    var m = w.match(/[aeiouy]{1,2}/g);
    return m ? m.length : 1;
  };

  N.readingEase = function (text) {
    var sents = N.sentences(text), w = N.words(text), i, syl = 0;
    if (!sents.length || !w.length) return 50;
    for (i = 0; i < w.length; i++) syl += N.syllables(w[i]);
    return 206.835 - 1.015 * (w.length / sents.length) - 84.6 * (syl / w.length);
  };

  /* ---------- Small helpers used by the generator ---------- */
  N.titleCase = function (s) {
    return s.replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
  };

  N.sentenceCase = function (s) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  /* Does `phrase` occur in `sentence` as whole words? Returns the
     matched surface span so we can blank it out precisely. */
  N.findSpan = function (sentence, phrase) {
    var esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    var re = new RegExp('(^|[^A-Za-z0-9-])(' + esc + ')(?![A-Za-z0-9-])', 'i');
    var m = re.exec(sentence);
    if (!m) return null;
    return { start: m.index + m[1].length, end: m.index + m[1].length + m[2].length, text: m[2] };
  };
})(window.NX);
