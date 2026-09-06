/* ===========================================================
   SAMARTH · optional persistence client

   The application is complete without this file. If no API base is
   configured, or the service is asleep, unreachable or erroring, every
   call here fails quietly and the app behaves exactly as it does offline:
   state lives in memory for the session.

   That is deliberate. A conference demo must never depend on the venue
   network, so the API is additive — it remembers things between sessions,
   it is not required to compute anything.
   =========================================================== */
(function (NX) {
  'use strict';
  var API = {};
  NX.api = API;

  API.base = String(window.SAMARTH_API || '').replace(/\/+$/, '');
  API.enabled = !!API.base;
  API.state = API.enabled ? 'connecting' : 'off';   // off | connecting | online | offline
  API.detail = '';

  function req(path, opts, timeoutMs) {
    opts = opts || {};
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || 12000);
    return fetch(API.base + path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).catch(function (e) {
      clearTimeout(timer);
      throw e;
    });
  }
  API.req = req;

  /* ---------- hydrate officer service records ----------
     Render's free tier sleeps after inactivity and can take the better
     part of a minute to wake, so this gets a long timeout and never
     blocks first paint. */
  API.hydrate = function () {
    if (!API.enabled) return Promise.resolve(false);
    API.state = 'connecting';

    return req('/health', {}, 75000).then(function (h) {
      if (h.database !== 'connected') throw new Error(h.detail || 'database unavailable');
      return Promise.all(NX.OFFICERS.map(function (o) {
        return req('/api/officers/' + encodeURIComponent(o.id), {}, 20000)
          .then(function (rec) { return { o: o, rec: rec }; })
          .catch(function () { return null; });          // one officer failing is not fatal
      }));
    }).then(function (results) {
      var loaded = 0;
      results.forEach(function (r) {
        if (!r || !r.rec) return;
        var o = r.o, rec = r.rec;
        if (Array.isArray(rec.trainings)) {
          o.trainings = rec.trainings.map(function (t) {
            return { c: t.course_id, on: String(t.completed_on).slice(0, 7), score: t.score };
          });
        }
        if (Array.isArray(rec.assessments) && rec.assessments.length) {
          o.assessments = rec.assessments.map(function (a) {
            return { title: a.title, comp: a.competencies || [], pct: a.pct, weight: a.weight };
          });
        }
        loaded++;
      });
      API.state = 'online';
      API.detail = loaded + ' officer records restored';
      return loaded > 0;
    }).catch(function (e) {
      API.state = 'offline';
      API.detail = e && e.name === 'AbortError' ? 'service did not respond' : String(e && e.message || e);
      return false;
    });
  };

  /* ---------- writes: optimistic, never blocking ---------- */
  API.saveCompletion = function (officerId, courseId, score, on) {
    if (!API.enabled || API.state !== 'online') return Promise.resolve(false);
    return req('/api/officers/' + encodeURIComponent(officerId) + '/completions', {
      method: 'POST',
      body: { course_id: courseId, score: score, completed_on: on }
    }).then(function () { return true; }).catch(function () { return false; });
  };

  API.saveAssessment = function (officerId, rec) {
    if (!API.enabled || API.state !== 'online') return Promise.resolve(false);
    return req('/api/officers/' + encodeURIComponent(officerId) + '/assessments', {
      method: 'POST',
      body: {
        title: rec.title, competencies: rec.comp, pct: rec.pct,
        weight: rec.weight, item_count: rec.itemCount || 0
      }
    }).then(function () { return true; }).catch(function () { return false; });
  };

  API.label = function () {
    return { off: 'Local session', connecting: 'Connecting…', online: 'Synced', offline: 'Local session' }[API.state];
  };
})(window.NX);
