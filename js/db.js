/* ================================================================
   5 METRE SCRUM — PLAYER PROFILES DATA LAYER
   Used by onboarding.html, player-profile.html and scout-board.html.
   Talks to Supabase's REST and Storage APIs with fetch (no external
   libraries), using the keys in js/supabase-config.js. With no keys
   it runs in demo mode and keeps the profile in this browser.
   Exposes window.FiveMS.
   ================================================================ */
(function () {
  'use strict';

  var DRAFT_KEY = '5ms-cv-draft';
  var LOCAL_PROFILE_KEY = '5ms-local-profile';

  /* Columns safe to show publicly. Email is deliberately left out so
     scouts' pages never download players' email addresses. */
  var PUBLIC_COLUMNS = [
    'id', 'created_at', 'first_name', 'last_name', 'dob', 'country', 'city',
    'position', 'playing_level', 'height_cm', 'weight_kg', 'reach_cm', 'wingspan_cm',
    'bronco', 'sprint_10', 'sprint_40', 'vo2max', 'deadlift_kg', 'squat_kg',
    'bench_kg', 'vjump_cm', 'clubs', 'passports', 'video_url', 'video_title',
    'video_file_url', 'headshot_url', 'plan'
  ].join(',');

  /* Columns the CV wizard is allowed to write */
  var WRITABLE = [
    'email', 'first_name', 'last_name', 'dob', 'country', 'city', 'position',
    'playing_level', 'height_cm', 'weight_kg', 'reach_cm', 'wingspan_cm', 'bronco',
    'sprint_10', 'sprint_40', 'vo2max', 'deadlift_kg', 'squat_kg', 'bench_kg',
    'vjump_cm', 'clubs', 'passports', 'video_url', 'video_title', 'video_file_url',
    'headshot_url', 'plan'
  ];

  /* ── Config ───────────────────────────────────────────────── */
  function dbConfigured() {
    var url = window.SUPABASE_URL || '';
    var key = window.SUPABASE_ANON_KEY || '';
    return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) && key.length > 40;
  }

  function base() {
    return String(window.SUPABASE_URL || '').replace(/\/$/, '');
  }

  function headers(extra) {
    var h = {
      'apikey': window.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + window.SUPABASE_ANON_KEY
    };
    for (var k in extra) h[k] = extra[k];
    return h;
  }

  function handle(res) {
    if (res.ok) return res.status === 204 ? null : res.json();
    return res.text().then(function (text) {
      var msg = text;
      try { var j = JSON.parse(text); msg = j.message || j.error || j.msg || text; } catch (e) {}
      throw new Error(msg || ('Request failed (' + res.status + ')'));
    });
  }

  /* ── Players ──────────────────────────────────────────────── */
  function listProfiles(limit) {
    var n = Math.max(1, Math.min(Number(limit) || 50, 500));
    return fetch(base() + '/rest/v1/players?select=' + PUBLIC_COLUMNS +
      '&published=eq.true&order=created_at.desc&limit=' + n, { headers: headers() })
      .then(handle)
      .then(function (rows) { return rows || []; });
  }

  function getProfile(id) {
    if (!id) return Promise.reject(new Error('No profile id'));
    return fetch(base() + '/rest/v1/players?select=' + PUBLIC_COLUMNS +
      '&id=eq.' + encodeURIComponent(id) + '&published=eq.true&limit=1', { headers: headers() })
      .then(handle)
      .then(function (rows) {
        if (!rows || !rows.length) throw new Error('Profile not found');
        return rows[0];
      });
  }

  function clean(profile) {
    var row = {};
    WRITABLE.forEach(function (k) {
      if (!(k in profile)) return;
      var v = profile[k];
      if (typeof v === 'string') v = v.trim();
      row[k] = v === '' || v === undefined ? null : v;
    });
    if (!row.clubs) row.clubs = [];
    if (!row.passports) row.passports = [];
    return row;
  }

  /* Resolves to the new row ({ id }) */
  function saveProfile(profile) {
    return fetch(base() + '/rest/v1/players?select=id', {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json', 'Prefer': 'return=representation' }),
      body: JSON.stringify(clean(profile))
    })
      .then(handle)
      .then(function (rows) {
        if (!rows || !rows[0]) throw new Error('Profile was not saved');
        return rows[0];
      });
  }

  /* ── File uploads (Supabase Storage) ──────────────────────────
     bucket: 'headshots' or 'highlight-videos'. Resolves to the
     file's public URL. Size/type limits are enforced by the bucket. */
  function uploadFile(bucket, file) {
    if (!file) return Promise.resolve(null);
    var ext = (String(file.name || '').match(/\.([a-z0-9]{1,5})$/i) || [, 'bin'])[1].toLowerCase();
    var rand = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    var path = rand + '.' + ext;
    return fetch(base() + '/storage/v1/object/' + bucket + '/' + path, {
      method: 'POST',
      headers: headers({ 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' }),
      body: file
    }).then(function (res) {
      if (res.ok) return base() + '/storage/v1/object/public/' + bucket + '/' + path;
      return res.text().then(function (text) {
        var msg = text;
        try { var j = JSON.parse(text); msg = j.message || j.error || text; } catch (e) {}
        if (/size|large|exceed/i.test(msg)) msg = 'That file is too large.';
        if (/mime|type/i.test(msg)) msg = 'That file type is not allowed.';
        throw new Error(msg || 'Upload failed');
      });
    });
  }

  /* ── Browser storage (drafts + demo mode) ─────────────────── */
  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) { return false; }
  }

  function getDraft() { return readJSON(DRAFT_KEY); }
  function saveDraft(d) { return writeJSON(DRAFT_KEY, d); }
  function clearDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} }

  function localGetProfile() { return readJSON(LOCAL_PROFILE_KEY); }
  function localSaveProfile(p) { return writeJSON(LOCAL_PROFILE_KEY, p); }

  /* ── Helpers ──────────────────────────────────────────────── */
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function initialsAvatar(first, last) {
    var t = (String(first || '?').charAt(0) + String(last || '').charAt(0)).toUpperCase();
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">' +
      '<rect width="200" height="200" fill="#0A1628"/>' +
      '<text x="100" y="122" font-family="Arial, sans-serif" font-size="72" font-weight="700" fill="#00C853" text-anchor="middle">' +
      escapeHtml(t) + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* YouTube / Vimeo link → embeddable player URL ('' if unsupported) */
  function toEmbedUrl(url) {
    var u = String(url || '').trim();
    var m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (m) return 'https://www.youtube.com/embed/' + m[1];
    m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (m) return 'https://player.vimeo.com/video/' + m[1];
    return '';
  }

  window.FiveMS = {
    dbConfigured: dbConfigured,
    listProfiles: listProfiles,
    getProfile: getProfile,
    saveProfile: saveProfile,
    uploadFile: uploadFile,
    getDraft: getDraft,
    saveDraft: saveDraft,
    clearDraft: clearDraft,
    localGetProfile: localGetProfile,
    localSaveProfile: localSaveProfile,
    escapeHtml: escapeHtml,
    initialsAvatar: initialsAvatar,
    toEmbedUrl: toEmbedUrl
  };
})();
