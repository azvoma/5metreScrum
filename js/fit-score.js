/* ================================================================
   5 METRE SCRUM — FIT SCORE
   calculateFitScore(player, vacancy) -> 0–100

   Weighting (from the Vacancy Board spec):
     Position  40
     Passport  30
     Level     30

   Works in the browser (window.FiveMSFit) and in Node (module.exports)
   so it can be unit-tested with: node js/fit-score.test.js
   ================================================================ */
(function (root) {
  'use strict';

  /* ── Positions ────────────────────────────────────────────────
     Players register with specific names ("Tighthead Prop") but the
     demo Scout Board uses generic ones ("Prop"). Both are mapped to
     position codes so they can be compared. */
  var POSITION_CODES = {
    'loosehead prop': ['LHP'], 'tighthead prop': ['THP'], 'prop': ['LHP', 'THP'],
    'hooker': ['HK'],
    'lock': ['LOCK'], 'second row': ['LOCK'],
    'blindside flanker': ['BF'], 'openside flanker': ['OF'], 'flanker': ['BF', 'OF'],
    'number 8': ['N8'], 'no. 8': ['N8'], 'no 8': ['N8'], 'number eight': ['N8'],
    'scrum-half': ['SH'], 'scrum half': ['SH'],
    'fly-half': ['FH'], 'fly half': ['FH'],
    'inside centre': ['IC'], 'outside centre': ['OC'], 'centre': ['IC', 'OC'],
    'left wing': ['WING'], 'right wing': ['WING'], 'wing': ['WING'],
    'fullback': ['FB'], 'full-back': ['FB'], 'full back': ['FB']
  };

  var UNITS = {
    LHP: 'front-row', HK: 'front-row', THP: 'front-row',
    LOCK: 'second-row',
    BF: 'back-row', OF: 'back-row', N8: 'back-row',
    SH: 'halves', FH: 'halves',
    IC: 'midfield', OC: 'midfield',
    WING: 'back-three', FB: 'back-three'
  };

  function positionCodes(name) {
    if (!name) return [];
    return POSITION_CODES[String(name).trim().toLowerCase()] || [];
  }

  /* ── Levels ────────────────────────────────────────────────── */
  var LEVEL_RANK = { 'amateur': 1, 'semi-pro': 2, 'professional': 3, 'pro': 3 };

  function levelRank(level) {
    if (!level) return 0;
    return LEVEL_RANK[String(level).trim().toLowerCase()] || 0;
  }

  /* ── Passports ────────────────────────────────────────────────
     Values match the onboarding checkboxes: EU, UK, IRE, AUS, other.
     An Irish passport is an EU passport, and Irish citizens can also
     work in the UK without a visa, so IRE satisfies EU and UK too. */
  var PASSPORT_SATISFIES = {
    EU: ['EU', 'IRE'],
    UK: ['UK', 'IRE'],
    IRE: ['IRE'],
    AUS: ['AUS']
  };

  function normalisePassports(list) {
    if (!list) return [];
    if (typeof list === 'string') list = [list];
    return list.map(function (p) { return String(p).trim().toUpperCase(); });
  }

  /* ── Scoring ────────────────────────────────────────────────── */
  function scorePosition(player, vacancy) {
    var playerCodes = positionCodes(player.position);
    var primary = positionCodes(vacancy.primary_position);
    var secondary = positionCodes(vacancy.secondary_position);
    if (!playerCodes.length || !primary.length) {
      return { points: 0, note: 'Position not set' };
    }
    var generic = playerCodes.length > 1; // e.g. "Prop" could be either side

    function overlaps(a, b) {
      return a.some(function (c) { return b.indexOf(c) !== -1; });
    }

    if (overlaps(playerCodes, primary)) {
      return generic
        ? { points: 30, note: 'Likely matches ' + vacancy.primary_position + ' (profile says ' + player.position + ')' }
        : { points: 40, note: 'Plays ' + vacancy.primary_position };
    }
    if (secondary.length && overlaps(playerCodes, secondary)) {
      return { points: 25, note: 'Matches secondary position (' + vacancy.secondary_position + ')' };
    }
    var targetUnits = primary.concat(secondary).map(function (c) { return UNITS[c]; });
    var sameUnit = playerCodes.some(function (c) { return targetUnits.indexOf(UNITS[c]) !== -1; });
    if (sameUnit) return { points: 10, note: 'Same unit, different position' };
    return { points: 0, note: 'Different position' };
  }

  function scorePassport(player, vacancy) {
    var required = String(vacancy.required_passport || 'ANY').trim().toUpperCase();
    if (required === 'ANY' || required === '') return { points: 30, note: 'No passport requirement' };
    var held = normalisePassports(player.passports);
    var accepted = PASSPORT_SATISFIES[required] || [required];
    var ok = held.some(function (p) { return accepted.indexOf(p) !== -1; });
    return ok
      ? { points: 30, note: 'Eligible (' + required + ')' }
      : { points: 0, note: 'Needs a visa (no ' + required + ' passport)' };
  }

  function scoreLevel(player, vacancy) {
    var need = levelRank(vacancy.minimum_level);
    var has = levelRank(player.playing_level);
    if (!need) return { points: 30, note: 'No minimum level' };
    if (!has) return { points: 0, note: 'Playing level not set' };
    if (has >= need) return { points: 30, note: 'Meets level (' + player.playing_level + ')' };
    if (need - has === 1) return { points: 15, note: 'One level below (' + player.playing_level + ')' };
    return { points: 0, note: 'Below required level (' + player.playing_level + ')' };
  }

  function fitBreakdown(player, vacancy) {
    player = player || {};
    vacancy = vacancy || {};
    var position = scorePosition(player, vacancy);
    var passport = scorePassport(player, vacancy);
    var level = scoreLevel(player, vacancy);
    var total = Math.max(0, Math.min(100, position.points + passport.points + level.points));
    return { total: total, position: position, passport: passport, level: level };
  }

  function calculateFitScore(player, vacancy) {
    return fitBreakdown(player, vacancy).total;
  }

  function rankPlayers(players, vacancy) {
    return (players || [])
      .map(function (p) { return { player: p, fit: fitBreakdown(p, vacancy) }; })
      .sort(function (a, b) { return b.fit.total - a.fit.total; });
  }

  var api = {
    calculateFitScore: calculateFitScore,
    fitBreakdown: fitBreakdown,
    rankPlayers: rankPlayers,
    positionCodes: positionCodes
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FiveMSFit = api;
})(typeof window !== 'undefined' ? window : this);
