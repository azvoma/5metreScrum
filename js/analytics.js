/* ================================================================
   5 METRE SCRUM — COOKIELESS ANALYTICS
   Off until you fill in ONE of the options below. Both are
   cookieless, so the cookie notice ("no tracking cookies") stays true.

   Option A — Plausible (paid, supports funnel events):
     1. Add the site at plausible.io (domain: 5metrescrum.com)
     2. Set PROVIDER = 'plausible' and DOMAIN = '5metrescrum.com'

   Option B — Cloudflare Web Analytics (free, page views only):
     1. Cloudflare dashboard → Analytics & Logs → Web Analytics → Add site
     2. Copy the token from the snippet it shows you
     3. Set PROVIDER = 'cloudflare' and TOKEN = '<that token>'

   Funnel events sent (Plausible only): CV Started, CV Completed,
   Account Created, Waitlist Joined.
   ================================================================ */
(function () {
  'use strict';

  var PROVIDER = '';            // 'plausible' or 'cloudflare'
  var DOMAIN = '5metrescrum.com'; // Plausible site domain
  var TOKEN = '';               // Cloudflare Web Analytics token

  var queue = [];
  window.FiveMSTrack = function (name, props) {
    if (window.plausible) window.plausible(name, props ? { props: props } : undefined);
    else queue.push([name, props]);
  };

  function load(src, attrs) {
    var s = document.createElement('script');
    s.defer = true; s.src = src;
    for (var k in attrs) s.setAttribute(k, attrs[k]);
    document.head.appendChild(s);
    return s;
  }

  if (PROVIDER === 'plausible' && DOMAIN) {
    window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
    load('https://plausible.io/js/script.js', { 'data-domain': DOMAIN });
    queue.forEach(function (e) { window.FiveMSTrack(e[0], e[1]); });
    queue = [];
  } else if (PROVIDER === 'cloudflare' && TOKEN) {
    load('https://static.cloudflareinsights.com/beacon.min.js', { 'data-cf-beacon': JSON.stringify({ token: TOKEN }) });
  }
})();
