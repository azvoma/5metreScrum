/* ================================================================
   5 METRE SCRUM — ACCOUNTS (Supabase Auth over REST)
   Sign up, sign in, password reset and signed-in database calls
   for agent and staff accounts. No external libraries: talks to
   Supabase's Auth and REST APIs with fetch, using the keys in
   js/supabase-config.js. Exposes window.FiveMSAuth.

   Until Supabase keys are added, isLive() is false and the agent
   and staff pages run in demo mode (data kept in this browser).
   ================================================================ */
(function () {
  'use strict';

  var SESSION_KEY = '5ms-auth-session';

  function isLive() {
    var url = window.SUPABASE_URL || '';
    var key = window.SUPABASE_ANON_KEY || '';
    return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url) && key.length > 40;
  }

  function base() {
    return String(window.SUPABASE_URL || '').replace(/\/$/, '');
  }

  function readSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeSession(s) {
    try {
      if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else localStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  function toSession(data) {
    if (!data || !data.access_token) return null;
    var expiresAt = data.expires_at || (Math.floor(Date.now() / 1000) + (Number(data.expires_in) || 3600));
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Number(expiresAt),
      user: data.user || null
    };
  }

  function friendlyError(body, status) {
    var msg = (body && (body.error_description || body.msg || body.message || body.error)) || '';
    if (/invalid login credentials/i.test(msg)) return 'That email and password don\'t match.';
    if (/email not confirmed/i.test(msg)) return 'Please confirm your email first. Check your inbox for the link.';
    if (/already registered|already been registered/i.test(msg)) return 'An account with this email already exists. Try signing in.';
    if (/password/i.test(msg) && /characters|short|weak/i.test(msg)) return 'Please choose a stronger password (at least 8 characters).';
    if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
    return msg || ('Something went wrong (' + status + ').');
  }

  function call(path, options) {
    options = options || {};
    var headers = { 'apikey': window.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
    headers['Authorization'] = 'Bearer ' + (options.token || window.SUPABASE_ANON_KEY);
    if (options.prefer) headers['Prefer'] = options.prefer;
    return fetch(base() + path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (res) {
      if (res.status === 204) return null;
      return res.text().then(function (text) {
        var body = null;
        try { body = text ? JSON.parse(text) : null; } catch (e) { body = { message: text }; }
        if (!res.ok) {
          var err = new Error(friendlyError(body, res.status));
          err.status = res.status;
          throw err;
        }
        return body;
      });
    });
  }

  function redirectTo() {
    return location.origin + '/account.html';
  }

  /* ── Auth actions ─────────────────────────────────────────── */
  function signUp(details) {
    return call('/auth/v1/signup?redirect_to=' + encodeURIComponent(redirectTo()), {
      method: 'POST',
      body: {
        email: details.email,
        password: details.password,
        data: {
          account_type: details.account_type,
          display_name: details.display_name || null,
          agency_name: details.agency_name || null
        }
      }
    }).then(function (data) {
      var session = toSession(data);
      if (session) writeSession(session);
      return { session: session, needsConfirmation: !session };
    });
  }

  function signIn(email, password) {
    return call('/auth/v1/token?grant_type=password', {
      method: 'POST',
      body: { email: email, password: password }
    }).then(function (data) {
      var session = toSession(data);
      writeSession(session);
      return session;
    });
  }

  function refresh(session) {
    return call('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: { refresh_token: session.refresh_token }
    }).then(function (data) {
      var next = toSession(data);
      writeSession(next);
      return next;
    }).catch(function (err) {
      writeSession(null);
      throw err;
    });
  }

  /* Resolves to a valid session, or null when signed out */
  function getSession() {
    if (!isLive()) return Promise.resolve(null);
    var s = readSession();
    if (!s) return Promise.resolve(null);
    if (s.expires_at - 60 > Date.now() / 1000) return Promise.resolve(s);
    return refresh(s).catch(function () { return null; });
  }

  function signOut() {
    var s = readSession();
    writeSession(null);
    if (!s || !isLive()) return Promise.resolve();
    return call('/auth/v1/logout', { method: 'POST', token: s.access_token }).catch(function () {});
  }

  function requestPasswordReset(email) {
    return call('/auth/v1/recover?redirect_to=' + encodeURIComponent(redirectTo()), {
      method: 'POST',
      body: { email: email }
    });
  }

  function updatePassword(password) {
    return getSession().then(function (s) {
      if (!s) throw new Error('Your reset link has expired. Please request a new one.');
      return call('/auth/v1/user', { method: 'PUT', token: s.access_token, body: { password: password } });
    });
  }

  /* Email links (confirm sign-up, password reset) land on
     account.html with the session in the URL hash. */
  function consumeUrlHash() {
    var hash = location.hash.replace(/^#/, '');
    if (!hash) return null;
    var params = {};
    hash.split('&').forEach(function (pair) {
      var i = pair.indexOf('=');
      if (i > 0) params[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1).replace(/\+/g, ' '));
    });
    if (!params.access_token && !params.error) return null;
    history.replaceState(null, '', location.pathname + location.search);
    if (params.error) return { error: params.error_description || params.error };
    writeSession(toSession(params));
    return { type: params.type || 'signin' };
  }

  /* ── Database calls ───────────────────────────────────────── */
  /* Signed-in REST call (falls back to the public key if signed out) */
  function api(path, options) {
    options = options || {};
    return getSession().then(function (s) {
      return call('/rest/v1/' + path, {
        method: options.method,
        body: options.body,
        prefer: options.prefer,
        token: s ? s.access_token : null
      });
    });
  }

  /* Sessions from email links arrive without the user object */
  function withUser(s) {
    if (!s || s.user) return Promise.resolve(s);
    return call('/auth/v1/user', { token: s.access_token }).then(function (user) {
      s.user = user;
      writeSession(s);
      return s;
    });
  }

  function getAccount() {
    return getSession().then(withUser).then(function (s) {
      if (!s || !s.user) return null;
      return api('accounts?id=eq.' + encodeURIComponent(s.user.id) + '&select=*').then(function (rows) {
        return (rows && rows[0]) || null;
      });
    });
  }

  function homeFor(account) {
    var type = account && account.account_type;
    if (type === 'agent') return '/agent-dashboard.html';
    if (type === 'staff') return '/staff-onboarding.html';
    if (type === 'club') return '/club-dashboard.html';
    return '/dashboard.html';
  }

  /* Page guard: resolves { session, account } for the right type,
     otherwise sends the visitor to sign in. */
  function requireAccount(type) {
    return getSession().then(function (s) {
      if (!s) {
        location.href = '/account.html?next=' + encodeURIComponent(location.pathname);
        return new Promise(function () {});
      }
      return getAccount().then(function (account) {
        if (!account || (type && account.account_type !== type)) {
          location.href = account ? homeFor(account) : '/account.html';
          return new Promise(function () {});
        }
        return { session: s, account: account };
      });
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  window.FiveMSAuth = {
    isLive: isLive,
    signUp: signUp,
    signIn: signIn,
    signOut: signOut,
    getSession: getSession,
    requestPasswordReset: requestPasswordReset,
    updatePassword: updatePassword,
    consumeUrlHash: consumeUrlHash,
    api: api,
    getAccount: getAccount,
    homeFor: homeFor,
    requireAccount: requireAccount,
    escapeHtml: escapeHtml
  };
})();
