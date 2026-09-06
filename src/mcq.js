/* ===========================================================
   SAMARTH · assessment generation engine
   Extracts concepts from an uploaded document and composes
   multiple-choice items with plausible distractors, then runs
   every candidate through a validator before it is shipped.
   =========================================================== */
(function (NX) {
  'use strict';
  var M = {}, nlp = NX.nlp;
  NX.mcq = M;

  var LETTERS = ['A', 'B', 'C', 'D', 'E'];

  function hash(s) {
    var h = 2166136261, i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function shuffle(arr, rnd) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(rnd() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function words(s) { return (s || '').trim().split(/\s+/).filter(Boolean); }

  /* Token-overlap similarity between two surface phrases. */
  function simTerm(a, b) {
    var ta = nlp.tokens(a), tb = nlp.tokens(b), i, set = {}, hit = 0;
    if (!ta.length || !tb.length) return 0;
    for (i = 0; i < ta.length; i++) set[ta[i]] = 1;
    for (i = 0; i < tb.length; i++) if (set[tb[i]]) hit++;
    var jac = hit / (ta.length + tb.length - hit);
    var lenPen = 1 - Math.min(1, Math.abs(ta.length - tb.length) / 3) * 0.4;
    return jac * 0.75 + lenPen * 0.25;
  }

  /* ---------- distractor selection ----------
     We want options that are *nearby but wrong*: same register,
     same length class, related enough to be tempting, distinct
     enough to be defensibly incorrect.                          */
  function pickDistractors(answer, pool, rnd, k) {
    var ansTok = nlp.tokens(answer).join(' ');
    var scored = [];
    for (var i = 0; i < pool.length; i++) {
      var cand = pool[i];
      if (!cand) continue;
      var ck = nlp.tokens(cand).join(' ');
      if (!ck || ck === ansTok) continue;
      if (ck.indexOf(ansTok) >= 0 || ansTok.indexOf(ck) >= 0) continue; // substring ⇒ arguably correct
      var s = simTerm(answer, cand);
      if (s > 0.62) continue;                       // too close to be wrong
      // ideal band ≈ 0.18–0.45 — related, clearly distinct
      var band = 1 - Math.abs(s - 0.30) / 0.45;
      var lenFit = 1 - Math.min(1, Math.abs(words(cand).length - words(answer).length) / 4);
      scored.push({ t: cand, s: band * 0.62 + lenFit * 0.38 + rnd() * 0.08 });
    }
    scored.sort(function (a, b) { return b.s - a.s; });
    var out = [], seen = {};
    for (i = 0; i < scored.length && out.length < k; i++) {
      var key = nlp.tokens(scored[i].t).join(' ');
      if (seen[key]) continue;
      seen[key] = 1; out.push(scored[i].t);
    }
    return out;
  }

  /* ---------- numeric distractors ---------- */
  function numberVariants(raw, rnd) {
    var m = /^([^\d]*)([\d,]+(?:\.\d+)?)(.*)$/.exec(raw);
    if (!m) return [];
    var pre = m[1], numStr = m[2], post = m[3];
    var hasComma = numStr.indexOf(',') >= 0;
    var v = parseFloat(numStr.replace(/,/g, ''));
    if (!isFinite(v)) return [];
    var dec = (numStr.split('.')[1] || '').length;
    var cands = [v * 2, v / 2, v * 1.5, v + Math.max(1, Math.round(v * 0.25)),
      Math.max(0, v - Math.max(1, Math.round(v * 0.22))), v * 10, v / 10];
    var out = [], seen = { };
    seen[v] = 1;
    var shuffled = shuffle(cands, rnd);
    for (var i = 0; i < shuffled.length; i++) {
      var x = shuffled[i];
      if (!isFinite(x) || x <= 0) continue;
      x = dec ? Math.round(x * Math.pow(10, dec)) / Math.pow(10, dec) : Math.round(x);
      if (seen[x] || x === v) continue;
      seen[x] = 1;
      var s = dec ? x.toFixed(dec) : String(x);
      if (hasComma) s = Number(s).toLocaleString('en-IN');
      out.push(pre + s + post);
    }
    return out;
  }

  /* ---------- word-form helpers ---------- */
  function stripLead(s) {
    return s.replace(/^(?:The|A|An|This|That|These|Those|It|In|On|Under|Every|Each|Within)\s+/i, '');
  }
  function lower1(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  function clean(s) { return s.replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').trim(); }
  function noPeriod(s) { return clean(s).replace(/\.$/, ''); }

  /* ===========================================================
     Item constructors — each returns null when the source
     sentence does not actually support that question form.
     =========================================================== */

  /* A · Definition — "X is/means/refers to Y" */
  function makeDefinition(sent, ctx, rnd) {
    var re = /^((?:The|A|An)\s+)?([A-Za-z][A-Za-z0-9 ,'’-]{4,58}?)\s+(is|are|means|refers to|is called|is defined as|is the|is any)\s+(.{25,220})$/;
    var m = re.exec(noPeriod(sent.text));
    if (!m) return null;
    // keep the leading article so the stem reads "the ultimate stage unit"
    var core = clean(m[2]), subject = clean((m[1] || '') + core), predicate = clean(m[4]);
    if (words(core).length > 5 || words(predicate).length < 5) return null;
    if (/^(?:it|this|that|they|there|these|he|she)$/i.test(core)) return null;
    // reject clause-like subjects ("over editing occurs when resources"),
    // which produce stems that read as nonsense
    if (/\b(?:occurs|arises|happens|when|which|that|where|while|because|if|unless|after|before|since|whether|although)\b/i.test(core)) return null;

    var answer = nlp.sentenceCase(predicate);
    var pool = ctx.predicates.filter(function (p) { return p.from !== sent.idx; })
      .map(function (p) { return p.text; });
    var ds = pickDistractors(answer, pool, rnd, 3);
    if (ds.length < 3) return null;

    return {
      type: 'definition', typeLabel: 'Concept definition', bloom: 'Understand',
      stem: 'Which of the following best describes ' + lower1(subject) + '?',
      answer: answer, options: ds.concat([answer]),
      source: sent, focus: core
    };
  }

  /* B · Cloze — blank the highest-value key phrase in the sentence */
  function makeCloze(sent, ctx, rnd) {
    var best = null, i;
    for (i = 0; i < ctx.phrases.length; i++) {
      var kp = ctx.phrases[i];
      // a one-word blank only works when the word carries real weight;
      // blanking "value" or "right" makes an unanswerable item
      if (kp.len === 1 && kp.phrase.length < 7) continue;
      var span = nlp.findSpan(sent.text, kp.phrase);
      if (!span) continue;
      // don't blank the very first words — the stem loses its anchor
      if (span.start < 12) continue;
      if (!best || kp.score > best.kp.score) best = { kp: kp, span: span };
    }
    if (!best) return null;
    var span = best.span;
    var before = sent.text.slice(0, span.start), after = sent.text.slice(span.end);
    if (words(before).length + words(after).length < 8) return null;

    var answer = span.text;
    var pool = ctx.phrases.map(function (p) { return p.phrase; })
      .concat(ctx.foreign);
    var ds = pickDistractors(answer, pool, rnd, 3);
    if (ds.length < 3) return null;
    // present distractors in the same case as the answer
    var isLower = answer === answer.toLowerCase();
    ds = ds.map(function (d) { return isLower ? d.toLowerCase() : nlp.sentenceCase(d); });

    return {
      type: 'cloze', typeLabel: 'Term recall', bloom: 'Remember',
      stem: clean(before + ' ⟦____⟧ ' + after),
      isCloze: true, answer: answer, options: ds.concat([answer]),
      source: sent, focus: answer
    };
  }

  /* C · Numeric fact */
  function makeNumeric(sent, ctx, rnd) {
    var txt = noPeriod(sent.text);
    var re = /(\b(?:[\d][\d,]*(?:\.\d+)?)\s*(?:per cent|percent|%|crore|lakh|rupees|items|pages|villages|markets|days|months|years|minutes)?)/g;
    var hits = [], m;
    while ((m = re.exec(txt)) !== null) {
      var t = m[1].trim();
      if (/^[12]\b/.test(t) && words(t).length === 1 && t.length <= 2) continue; // skip bare 1 / 2
      if (/^(?:19|20)\d{2}$/.test(t)) continue;                                  // skip plain years
      hits.push({ t: t, at: m.index });
    }
    if (!hits.length) return null;
    var pick = hits.sort(function (a, b) { return b.t.length - a.t.length; })[0];
    var variants = numberVariants(pick.t, rnd);
    if (variants.length < 3) return null;

    var before = txt.slice(0, pick.at), after = txt.slice(pick.at + pick.t.length);
    if (words(before).length + words(after).length < 8) return null;

    return {
      type: 'numeric', typeLabel: 'Quantitative fact', bloom: 'Remember',
      stem: clean(before + ' ⟦____⟧ ' + after) + '.',
      isCloze: true, answer: pick.t, options: variants.slice(0, 3).concat([pick.t]),
      source: sent, focus: pick.t
    };
  }

  /* D · Purpose / consequence — "because", "so that", "in order to" */
  function makePurpose(sent, ctx, rnd) {
    var re = /^(.{25,150}?)\s+(because|so that|in order to|since|therefore|which means that|as a result)\s+(.{20,180})$/i;
    var m = re.exec(noPeriod(sent.text));
    if (!m) return null;
    var head = clean(m[1]), conn = m[2].toLowerCase(), tail = clean(m[3]);
    if (words(tail).length < 5) return null;

    var forward = /^(?:therefore|as a result|which means that|so that|in order to)$/.test(conn);
    var answer = nlp.sentenceCase(tail);
    // "Why is it the case that X?" only reads when the head is a full clause;
    // otherwise fall back to completing the sentence, which always reads.
    var hasVerb = /\b(is|are|was|were|has|have|had|does|do|did|can|must|should|may|will|depends|arises|requires|reduces|allows|permits|gives|improves|uses|includes|occurs|attracts|means|remains|carries|forms|becomes|applies|holds|varies|falls|rises)\b/i.test(head);
    var stem = (!forward && hasVerb)
      ? 'Why is it the case that ' + lower1(head) + '?'
      : 'Complete the statement from the material: “' + nlp.sentenceCase(head) + ' ' + conn + ' …”';
    var pool = ctx.clauses.filter(function (c) { return c.from !== sent.idx; }).map(function (c) { return c.text; });
    var ds = pickDistractors(answer, pool, rnd, 3);
    if (ds.length < 3) return null;

    return {
      type: 'purpose', typeLabel: forward ? 'Consequence' : 'Causal reasoning', bloom: 'Understand',
      stem: stem, answer: answer, options: ds.concat([answer]),
      source: sent, focus: head
    };
  }

  /* E · Exception — from an enumeration "A, B and C" */
  function makeException(sent, ctx, rnd) {
    var txt = noPeriod(sent.text);
    var m = /^(.{12,120}?)\s*(?::|\binclude\b|\bincluding\b|\bsuch as\b|\bnamely\b)\s+(.+)$/i.exec(txt);
    if (!m) return null;
    var lead = clean(m[1]).replace(/[,;:]$/, ''), listRaw = m[2];
    if (words(lead).length < 4) return null;
    var items = listRaw.split(/,\s*(?:and\s+)?|\s+and\s+/).map(clean)
      .filter(function (s) { return words(s).length >= 2 && words(s).length <= 9; });
    if (items.length < 3) return null;
    items = items.slice(0, 3);

    // The false option must read like a member of the same list: drawn from
    // the document's own concepts, and of comparable length — a one-word
    // outlier among three phrases gives the answer away.
    var lens = items.map(function (it) { return words(it).length; });
    var meanLen = lens.reduce(function (a, b) { return a + b; }, 0) / lens.length;
    var pool = ctx.phrases.filter(function (p) { return p.len >= 2; })
      .map(function (p) { return p.phrase; });
    var wrong = pickDistractors(items.join(' '), pool, rnd, 6)
      .filter(function (w) {
        if (Math.abs(words(w).length - meanLen) > 1.4) return false;
        return !items.some(function (it) { return simTerm(it, w) > 0.32; });
      });
    if (!wrong.length) return null;

    return {
      type: 'exception', typeLabel: 'Exception identification', bloom: 'Analyse',
      stem: 'The material states that ' + lower1(stripLead(lead)) +
        '. Which of the following is NOT among the items it lists?',
      answer: nlp.sentenceCase(wrong[0]),
      options: items.map(nlp.sentenceCase).concat([nlp.sentenceCase(wrong[0])]),
      source: sent, focus: lead, negative: true
    };
  }

  /* F · Conditional application — "When X, Y" / "If X, Y" */
  function makeConditional(sent, ctx, rnd) {
    var m = /^(?:If|When|Where|Unless)\s+(.{18,140}?),\s+(.{20,180})$/i.exec(noPeriod(sent.text));
    if (!m) return null;
    var cond = clean(m[1]), act = clean(m[2]);
    if (words(act).length < 5) return null;
    var answer = nlp.sentenceCase(act);
    var pool = ctx.clauses.filter(function (c) { return c.from !== sent.idx; }).map(function (c) { return c.text; });
    var ds = pickDistractors(answer, pool, rnd, 3);
    if (ds.length < 3) return null;
    return {
      type: 'conditional', typeLabel: 'Applied judgement', bloom: 'Apply',
      stem: 'In practice, when ' + lower1(cond) + ', what does the material require?',
      answer: answer, options: ds.concat([answer]), source: sent, focus: cond
    };
  }

  var BUILDERS = [
    { fn: makeDefinition, cap: 5 },
    { fn: makeConditional, cap: 3 },
    { fn: makePurpose, cap: 4 },
    { fn: makeNumeric, cap: 4 },
    { fn: makeException, cap: 3 },
    { fn: makeCloze, cap: 8 }
  ];

  /* ---------- validator ---------- */
  function validate(item) {
    var reasons = [], opts = item.options, i, j;
    if (!opts || opts.length !== 4) reasons.push('option count');
    var norm = opts.map(function (o) { return nlp.tokens(o).join(' '); });
    for (i = 0; i < norm.length; i++) {
      if (!norm[i]) reasons.push('empty option');
      for (j = i + 1; j < norm.length; j++) if (norm[i] === norm[j]) reasons.push('duplicate options');
    }
    var stemWords = words(item.stem.replace('⟦____⟧', '')).length;
    if (stemWords < 7) reasons.push('stem too short');
    if (stemWords > 62) reasons.push('stem too long');

    // "longest option is the answer" is the classic test-wiseness leak
    var lens = opts.map(function (o) { return words(o).length; });
    var ansLen = words(item.answer).length;
    var maxLen = Math.max.apply(null, lens), minLen = Math.min.apply(null, lens);
    var leak = 0;
    if (maxLen > minLen && ansLen === maxLen && maxLen - minLen >= 4) { leak = 1; reasons.push('length cue'); }
    if (/\b(?:it|this|they|these|such)\b/i.test(item.stem.slice(0, 14))) reasons.push('dangling reference');

    return { ok: reasons.length === 0, reasons: reasons, leak: leak };
  }

  /* ---------- difficulty & confidence ---------- */
  function grade(item, ctx, leak) {
    var ans = item.answer;
    var toks = nlp.tokens(ans);
    var rarity = 0;
    for (var i = 0; i < toks.length; i++) rarity += ctx.bg.idf(toks[i]);
    rarity = toks.length ? rarity / toks.length : 3;

    var closeness = 0;
    item.options.forEach(function (o) { if (o !== ans) closeness += simTerm(o, ans); });
    closeness /= 3;

    var ease = nlp.readingEase(item.source.text);
    var complexity = NX.engine.clamp((55 - ease) / 55, 0, 1);
    var typeW = { cloze: 0.10, numeric: 0.22, definition: 0.34, purpose: 0.48, exception: 0.62, conditional: 0.66 }[item.type] || 0.3;

    var d = 0.30 * NX.engine.clamp((rarity - 2.2) / 2.6, 0, 1)
      + 0.26 * NX.engine.clamp(closeness / 0.5, 0, 1)
      + 0.20 * complexity
      + 0.24 * typeW;

    item.difficultyScore = d;
    item.difficulty = d < 0.34 ? 'Easy' : d < 0.56 ? 'Moderate' : 'Hard';
    item.discrimination = Math.round((0.34 + closeness * 0.9 + (item.negative ? 0.08 : 0)) * 100) / 100;

    /* Confidence answers "how much would a reviewer trust this item
       unedited?" — it blends how central the source sentence is, how
       reliable this question form has proved, how well the distractors
       landed in the plausibility band, and whether the validator saw a
       structural cue. */
    var salNorm = NX.engine.clamp((item.source.salience || 0) / (ctx.maxSalience || 1), 0, 1);
    var typeRel = { cloze: 0.95, numeric: 0.92, definition: 0.82,
      purpose: 0.66, conditional: 0.62, exception: 0.58 }[item.type] || 0.7;
    var dFit = NX.engine.clamp(1 - Math.abs(closeness - 0.30) / 0.34, 0, 1);
    item.confidence = Math.round(100 * NX.engine.clamp(
      0.46 + 0.20 * salNorm + 0.16 * typeRel + 0.10 * dFit + 0.08 * (1 - (leak || 0)),
      0.52, 0.97));
    return d;
  }

  /* ===========================================================
     Public API
     =========================================================== */

  /* Map a document onto the competency framework by scoring each
     competency's vocabulary against the document vector. */
  M.mapCompetencies = function (text) {
    var space = NX.engine.bgSpace;
    var dv = space.vectorise(text);
    var scored = NX.COMPETENCIES.map(function (c) {
      return { id: c.id, name: c.name, d: c.d, s: NX.nlp.cos(dv, space.vectorise(c.name + ' ' + c.kw)) };
    }).sort(function (a, b) { return b.s - a.s; });
    var mx = scored[0].s || 1;
    return scored.slice(0, 4).map(function (x) {
      return { id: x.id, name: x.name, d: x.d, conf: Math.round(100 * x.s / mx) };
    }).filter(function (x) { return x.conf >= 34; });
  };

  M.analyse = function (text) {
    var bg = NX.engine.bgSpace;
    var sents = nlp.sentences(text);
    var phrases = nlp.keyphrases(text, bg, 40);

    // predicate bank — right-hand sides of definitional sentences,
    // reused as distractors for other definition items
    var predicates = [], clauses = [];
    sents.forEach(function (s) {
      var m = /^(?:The\s+|A\s+|An\s+)?[A-Za-z][A-Za-z0-9 ,'’-]{4,58}?\s+(?:is|are|means|refers to|is called|is defined as|is the|is any)\s+(.{25,200})$/.exec(noPeriod(s.text));
      if (m) predicates.push({ text: nlp.sentenceCase(clean(m[1])), from: s.idx });
      var c = /\s+(?:because|so that|in order to|since|therefore|which means that|as a result)\s+(.{20,180})$/i.exec(noPeriod(s.text));
      if (c) clauses.push({ text: nlp.sentenceCase(clean(c[1])), from: s.idx });
      // also mine main clauses so causal items always have a pool
      var mc = /^(.{25,150}?)(?:,|\s+and\s+)(.{25,170})$/.exec(noPeriod(s.text));
      if (mc && clauses.length < 40) clauses.push({ text: nlp.sentenceCase(clean(mc[2])), from: s.idx });
    });

    // vocabulary from the wider catalogue, used sparingly as
    // "foreign" distractors when the document's own pool is thin
    var foreign = [];
    NX.COMPETENCIES.forEach(function (c) {
      c.kw.split(' ').forEach(function (w) { if (w.length > 5) foreign.push(w); });
    });

    // sentence salience
    var phraseScore = {};
    phrases.forEach(function (p) { phraseScore[p.key] = p.score; });
    sents.forEach(function (s) {
      var toks = nlp.tokens(s.text), sc = 0, i;
      for (i = 0; i < toks.length; i++) sc += bg.idf(toks[i]);
      var kp = 0;
      phrases.forEach(function (p) { if (nlp.findSpan(s.text, p.phrase)) kp += p.score; });
      s.salience = (sc / Math.sqrt(toks.length || 1)) * 0.4 + kp * 0.6;
      s.hasNumber = /\d/.test(s.text);
    });

    var maxSal = sents.reduce(function (m2, x) { return Math.max(m2, x.salience || 0); }, 0);

    return {
      sents: sents, phrases: phrases, predicates: predicates,
      clauses: clauses, foreign: foreign, bg: bg, maxSalience: maxSal,
      readingEase: nlp.readingEase(text),
      words: nlp.words(text).length,
      competencies: M.mapCompetencies(text)
    };
  };

  /* Objectives, phrased from the highest-value concepts. */
  M.objectives = function (ctx) {
    var verbs = ['Explain', 'Identify', 'Apply the concept of', 'Distinguish'];
    return ctx.phrases.slice(0, 4).map(function (p, i) {
      return verbs[i % verbs.length] + ' ' + p.phrase + '.';
    }).map(nlp.sentenceCase);
  };

  /* Generate a validated question set.
     opts: {count, mix:'balanced'|'recall'|'applied', seedText} */
  M.generate = function (text, opts) {
    opts = opts || {};
    var ctx = M.analyse(text);
    var rnd = NX.rng(hash(text.slice(0, 4000)) + (opts.salt || 0));
    var want = opts.count || 10;

    var ranked = ctx.sents.slice().sort(function (a, b) { return b.salience - a.salience; });

    var made = [], counts = {}, rejected = [], usedSent = {}, usedFocus = {};
    var b, s, item, v;

    for (b = 0; b < BUILDERS.length; b++) {
      var builder = BUILDERS[b];
      counts[builder.fn.name] = 0;
      for (s = 0; s < ranked.length; s++) {
        if (counts[builder.fn.name] >= builder.cap) break;
        var sent = ranked[s];
        if ((usedSent[sent.idx] || 0) >= 1) continue;
        try { item = builder.fn(sent, ctx, rnd); } catch (e) { item = null; }
        if (!item) continue;

        var fkey = nlp.tokens(item.focus || item.answer).join(' ');
        if (usedFocus[fkey]) continue;

        v = validate(item);
        if (!v.ok) {
          var uniq = v.reasons.filter(function (x, ix) { return v.reasons.indexOf(x) === ix; });
          rejected.push({ stem: item.stem, why: uniq.join(', '), reasons: uniq });
          continue;
        }

        grade(item, ctx, v.leak);
        item.options = shuffle(item.options, rnd);
        item.correctIndex = item.options.indexOf(item.answer);
        usedSent[sent.idx] = 1;
        usedFocus[fkey] = 1;
        counts[builder.fn.name]++;
        made.push(item);
      }
    }

    // ---- select the final set against the requested cognitive mix
    var order = { recall: ['Remember', 'Understand', 'Apply', 'Analyse'],
      applied: ['Apply', 'Analyse', 'Understand', 'Remember'],
      balanced: null }[opts.mix || 'balanced'];

    made.sort(function (a, b2) {
      if (order) {
        var da = order.indexOf(a.bloom), db = order.indexOf(b2.bloom);
        if (da !== db) return da - db;
      }
      return (b2.confidence * 0.6 + b2.source.salience * 0.4) - (a.confidence * 0.6 + a.source.salience * 0.4);
    });

    if (!order) {
      // balanced: interleave types so the paper does not open with
      // six cloze items in a row
      var buckets = {}, out = [];
      made.forEach(function (m2) { (buckets[m2.type] = buckets[m2.type] || []).push(m2); });
      var keys = Object.keys(buckets), guard = 0;
      while (out.length < made.length && guard++ < 500) {
        for (var ki = 0; ki < keys.length; ki++) {
          var arr = buckets[keys[ki]];
          if (arr && arr.length) out.push(arr.shift());
        }
      }
      made = out;
    }

    var final = made.slice(0, want);
    final.forEach(function (q, i) { q.n = i + 1; });

    var rejMap = {};
    rejected.forEach(function (r) {
      (r.reasons || []).forEach(function (x) { rejMap[x] = (rejMap[x] || 0) + 1; });
    });
    var rejectSummary = Object.keys(rejMap)
      .sort(function (a, b) { return rejMap[b] - rejMap[a]; })
      .map(function (k) { return { why: k, n: rejMap[k] }; });

    return {
      items: final, ctx: ctx, generated: made.length, rejected: rejected,
      rejectSummary: rejectSummary,
      objectives: M.objectives(ctx),
      stats: {
        words: ctx.words, sentences: ctx.sents.length,
        concepts: ctx.phrases.length, readingEase: Math.round(ctx.readingEase),
        candidates: made.length + rejected.length, shipped: final.length,
        avgDifficulty: final.length ? final.reduce(function (s2, q) { return s2 + q.difficultyScore; }, 0) / final.length : 0,
        avgConfidence: final.length ? Math.round(final.reduce(function (s2, q) { return s2 + q.confidence; }, 0) / final.length) : 0,
        bloom: final.reduce(function (m2, q) { m2[q.bloom] = (m2[q.bloom] || 0) + 1; return m2; }, {}),
        types: final.reduce(function (m2, q) { m2[q.typeLabel] = (m2[q.typeLabel] || 0) + 1; return m2; }, {})
      }
    };
  };

  M.LETTERS = LETTERS;
})(window.NX);
