/* ================================================================
   5 METRE SCRUM — VACANCY BOARD DATA LAYER
   Talks to Supabase over its REST API when js/supabase-config.js
   has real keys; otherwise runs in demo mode and keeps the club and
   its vacancies in this browser (localStorage), like the CV wizard.
   Exposes window.FiveMSVacancies.
   ================================================================ */
(function () {
  'use strict';

  var CLUB_KEY = '5ms-club';
  var VAC_KEY = '5ms-vacancies';

  /* Demo players mirror the Scout Board demo rows. Playing levels are
     illustrative so the Fit Score has something to rank on. */
  var DEMO_PLAYERS = [
    { id: 'demo-1', first_name: 'Conor', last_name: 'Fitzgerald', position: 'Fly-Half', passports: ['EU'], playing_level: 'Professional', country: 'Ireland', href: '/player-profile-1.html' },
    { id: 'demo-2', first_name: 'Sione', last_name: 'Taufa', position: 'Number 8', passports: ['EU'], playing_level: 'Professional', country: 'Tonga', href: '/scout-board.html' },
    { id: 'demo-3', first_name: 'Manaia', last_name: 'Ropata', position: 'Lock', passports: [], playing_level: 'Semi-Pro', country: 'New Zealand', href: '/player-profile-3.html' },
    { id: 'demo-4', first_name: 'Diego', last_name: 'Fernández', position: 'Inside Centre', passports: ['EU'], playing_level: 'Professional', country: 'Argentina', href: '/player-profile-4.html' },
    { id: 'demo-5', first_name: 'Marcus', last_name: 'Bailey', position: 'Wing', passports: ['UK'], playing_level: 'Semi-Pro', country: 'England', href: '/player-profile-5.html' },
    { id: 'demo-6', first_name: 'Isaiah', last_name: 'Thompson', position: 'Fullback', passports: ['UK'], playing_level: 'Semi-Pro', country: 'England', href: '/player-profile-6.html' },
    { id: 'demo-7', first_name: 'Harry', last_name: 'Nolan', position: 'Openside Flanker', passports: ['UK'], playing_level: 'Amateur', country: 'England', href: '/player-profile-7.html' },
    { id: 'demo-8', first_name: 'Oliver', last_name: 'Stanton', position: 'Blindside Flanker', passports: ['UK'], playing_level: 'Semi-Pro', country: 'England', href: '/player-profile-8.html' },
    { id: 'demo-9', first_name: 'Callum', last_name: 'Reid', position: 'Hooker', passports: ['UK'], playing_level: 'Amateur', country: 'Scotland', href: '/player-profile-9.html' },
    { id: 'demo-10', first_name: 'Jayden', last_name: 'Roberts', position: 'Scrum-Half', passports: ['UK'], playing_level: 'Semi-Pro', country: 'Wales', href: '/player-profile-10.html' }
  ];

  function isLive() {
    var url = window.SUPABASE_URL || '';
    var key = window.SUPABASE_ANON_KEY || '';
    return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) && key.length > 40;
  }

  function rest(path, options) {
    options = options || {};
    var base = window.SUPABASE_URL.replace(/\/$/, '');
    var headers = {
      'apikey': window.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + window.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    };
    if (options.prefer) headers['Prefer'] = options.prefer;
    return fetch(base + '/rest/v1/' + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) { throw new Error('Database error (' + res.status + '): ' + t); });
      }
      return res.status === 204 ? [] : res.json();
    });
  }

  function readLocal(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function writeLocal(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function localId() {
    return 'local-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ── Club ─────────────────────────────────────────────────────
     Until club logins exist, the club this browser registered is
     remembered in this browser. */
  function getClub() {
    var club = readLocal(CLUB_KEY, null);
    /* A club saved in demo mode doesn't exist in the database */
    if (club && isLive() && String(club.id).indexOf('local-') === 0) return null;
    return club;
  }

  function saveClub(club) {
    if (isLive()) {
      return rest('clubs', { method: 'POST', body: club, prefer: 'return=representation' })
        .then(function (rows) {
          var saved = rows[0];
          writeLocal(CLUB_KEY, saved);
          return saved;
        });
    }
    var local = Object.assign({ id: localId(), created_at: new Date().toISOString() }, club);
    writeLocal(CLUB_KEY, local);
    return Promise.resolve(local);
  }

  function forgetClub() {
    try { localStorage.removeItem(CLUB_KEY); } catch (e) {}
  }

  /* ── Vacancies ────────────────────────────────────────────── */
  function listVacancies(clubId) {
    if (isLive()) {
      return rest('vacancies?club_id=eq.' + encodeURIComponent(clubId) + '&order=created_at.desc');
    }
    var all = readLocal(VAC_KEY, []);
    return Promise.resolve(all.filter(function (v) { return v.club_id === clubId; }));
  }

  function createVacancy(vacancy) {
    if (isLive()) {
      return rest('vacancies', { method: 'POST', body: vacancy, prefer: 'return=representation' })
        .then(function (rows) { return rows[0]; });
    }
    var local = Object.assign({ id: localId(), created_at: new Date().toISOString(), status: 'open' }, vacancy);
    var all = readLocal(VAC_KEY, []);
    all.unshift(local);
    writeLocal(VAC_KEY, all);
    return Promise.resolve(local);
  }

  /* ── Players ──────────────────────────────────────────────── */
  function listPlayers() {
    if (isLive()) {
      var cols = 'id,first_name,last_name,position,passports,playing_level,city,country,headshot_url';
      return rest('players?select=' + cols + '&published=eq.true&limit=500').then(function (rows) {
        return rows.map(function (p) {
          p.href = '/player-profile.html?id=' + encodeURIComponent(p.id);
          return p;
        });
      });
    }
    var players = DEMO_PLAYERS.slice();
    if (window.FiveMS && typeof FiveMS.localGetProfile === 'function') {
      var mine = FiveMS.localGetProfile();
      if (mine) players.unshift(Object.assign({ id: 'local-profile', href: '/player-profile.html?local=1' }, mine));
    }
    return Promise.resolve(players);
  }

  window.FiveMSVacancies = {
    isLive: isLive,
    getClub: getClub,
    saveClub: saveClub,
    forgetClub: forgetClub,
    listVacancies: listVacancies,
    createVacancy: createVacancy,
    listPlayers: listPlayers
  };
})();
