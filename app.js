/* ============================================================
   BocheClub — app.js
   App shell: router, screens, actions. UI only — every data value
   is read from data.js (BC_* objects).
   ============================================================ */
(function () {
  'use strict';

  /* ---------- Runtime state (seeded from data.js, saved on this device) ---------- */
  var LS_KEY = 'bocheclub-demo-v1';

  function freshState() {
    return {
      authed: false,
      kycDone: false,
      points: BC_MEMBER.points,
      tier: BC_MEMBER.tier,
      history: BC_POINTS_HISTORY.slice(),
      vouchers: [],
      bookings: [],
      activated: [],
      reserved: [],
      notif: { offers: true, events: true, points: true },
      lastPayment: null
    };
  }
  function loadState() { try { var j = localStorage.getItem(LS_KEY); return j ? JSON.parse(j) : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {} }
  var S = loadState() || freshState();

  /* Transient UI state (not persisted) */
  var ui = {
    mobile: '',
    kycMethod: BC_KYC.methods[0].id,
    kycConsent: false,
    pubFilter: 'all',
    rewardsTab: 'catalogue',
    offersTab: 'offers',
    pay: null,
    book: null,
    sheetMethod: BC_PAY_METHODS[0].id,
    sheetLock: false
  };
  function resetPay(pubId) {
    ui.pay = { pub: pubId || BC_MEMBER.homePub, table: '', fetched: false, usePts: false, method: BC_PAY_METHODS[0].id };
  }
  function resetBook() { ui.book = { day: 0, time: null, guests: 2, occasion: BC_BOOKING.occasions[0], note: '' }; }
  resetPay(); resetBook();

  /* ---------- Helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(n) { return Math.round(n).toLocaleString('en-IN'); }
  function inr(n) { return '₹' + num(n); }
  function byId(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }
  function tier(id) { return byId(BC_TIERS, id || S.tier); }
  function nextTier(t) { var i = BC_TIERS.indexOf(t); return BC_TIERS[i + 1] || null; }
  function pub(id) { return byId(BC_PUBS, id); }
  function ageOf(dob) {
    var d = new Date(dob), n = new Date(), a = n.getFullYear() - d.getFullYear(), m = n.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
    return a;
  }
  function memberAge() { return ageOf(BC_MEMBER.dob); }
  function eligible(p) { return memberAge() >= BC_STATES[p.state].drinkingAge; }
  function initials(name) { return name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(); }
  function greeting() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  function todayLabel() { return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function rand(n) { var s = ''; for (var i = 0; i < n; i++) s += 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]; return s; }
  function pubsLabel(p) { return p === 'all' ? 'All pubs' : p.map(function (id) { return pub(id).city; }).join(' · '); }
  function addHistory(title, ref, pts) { S.history.unshift({ date: todayLabel(), title: title, ref: ref, pts: pts }); }
  function isStandalone() { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }

  /* ---------- Icons (stroke, 24px grid) ---------- */
  var ICONS = {
    home: '<path d="M3 9.5l9-7 9 7V20a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5" rx="1"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    back: '<polyline points="15 18 9 12 15 6"/>',
    chev: '<polyline points="9 18 15 12 9 6"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    star: '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
    phone: '<rect x="5" y="2" width="14" height="20" rx="2.5"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
    crown: '<path d="M3 18h18M4 8l4 4 4-7 4 7 4-4-2 10H6z"/>',
    tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
    receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-1 .7-3-2-3 2-3-2-3 2-3-2z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z"/><path d="M2 21c0-3 1.9-5.4 5.1-6C9.5 14.5 12 13 13 12"/>',
    gem: '<path d="M6 3h12l4 6-10 13L2 9z"/><path d="M2 9h20M12 22L8 9l4-6 4 6z"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
    wallet: '<path d="M20 7H5a2 2 0 0 1 0-4h13v4"/><path d="M3 5v14a2 2 0 0 0 2 2h15V7"/><circle cx="16" cy="14" r="1"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    rupee: '<path d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10"/>'
  };
  function ic(n, s) {
    return '<svg class="ic" width="' + (s || 22) + '" height="' + (s || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + '</svg>';
  }

  /* ---------- Shared fragments ---------- */
  function topbar(title, parent, right) {
    return '<header class="topbar">' +
      (parent ? '<button class="iconbtn" data-go="' + parent + '" aria-label="Back">' + ic('back') + '</button>' : '') +
      '<h2>' + esc(title) + '</h2>' + (right || '') + '</header>';
  }
  function brandMark() { return 'BOCHE<b>CLUB</b>'; }
  function cardFront(tierId, extraCls) {
    var t = tier(tierId);
    return '<div class="mcard t-' + t.id + ' ' + (extraCls || '') + '">' +
      '<div class="mc-top"><div class="mc-brand">' + brandMark() + '</div><span class="mc-tier">' + esc(t.name) + '</span></div>' +
      '<div class="mc-chip"></div>' +
      '<div class="mc-num">' + esc(BC_MEMBER.cardNo) + '</div>' +
      '<div class="mc-bottom"><div><div class="mc-label">Member</div><div class="mc-val">' + esc(BC_MEMBER.name) + '</div></div>' +
      '<div class="mc-right"><div class="mc-label">Valid thru</div><div class="mc-val">' + esc(BC_MEMBER.validThru) + '</div></div></div>' +
      '</div>';
  }
  function cardBack() {
    var C = 2 * Math.PI * 11;
    return '<div class="mcard mback">' +
      '<div class="qrbox"><div id="qrSvg"></div><span class="qr-logo">BC</span></div>' +
      '<div class="mb-info"><div class="mc-label">Member ID</div><div class="mb-id">' + esc(BC_MEMBER.id) + '</div>' +
      '<div class="mb-tier">' + esc(tier().name) + ' member</div>' +
      '<div class="mb-timer"><svg class="ring" viewBox="0 0 26 26"><circle class="bg" cx="13" cy="13" r="11"/><circle class="fg" id="qrRing" cx="13" cy="13" r="11" stroke-dasharray="' + C + '" stroke-dashoffset="0"/></svg><span><span id="qrCount">30</span>s</span></div>' +
      '<div class="mb-note">Live code · refreshes every 30 s</div></div></div>';
  }
  function eventRow(e) {
    var d = new Date(e.date + 'T00:00:00');
    return '<button class="event-row" data-go="pub/' + e.pub + '">' +
      '<div class="datebox"><b>' + d.getDate() + '</b><span>' + d.toLocaleDateString('en-GB', { month: 'short' }) + '</span></div>' +
      '<div class="li-main"><div class="li-t">' + esc(e.title) + '</div><div class="li-s">' + esc(pub(e.pub).city) + ' · ' + esc(e.time) + '</div>' +
      '<div class="li-s gold-text">' + esc(e.price) + '</div></div>' +
      '<span class="li-chev">' + ic('chev', 18) + '</span></button>';
  }
  function methodList(selected, act) {
    return BC_PAY_METHODS.map(function (m) {
      return '<button class="method' + (m.id === selected ? ' on' : '') + '" data-act="' + act + '" data-id="' + m.id + '">' +
        '<span class="radio"></span><span class="li-main"><span class="li-t" style="display:block">' + esc(m.label) + '</span>' +
        '<span class="li-s" style="display:block">' + esc(m.sub) + '</span></span></button>';
    }).join('');
  }

  /* ============================================================
     SCREENS
     ============================================================ */
  var SCREENS = {}, AFTER = {};

  /* ----- Welcome ----- */
  SCREENS.welcome = function () {
    return '<div class="welcome">' +
      '<div class="wl-mark">BOCHECLUB</div>' +
      '<div class="wl-cards">' + cardFront('classic', 'c1') + cardFront('gold', 'c2') + '</div>' +
      '<h1 class="wl-title">' + esc(BC_BRAND.tagline) + '</h1>' +
      '<p class="wl-intro">' + esc(BC_BRAND.intro) + '</p>' +
      '<ul class="wl-points">' + BC_ONBOARD.map(function (o) {
        return '<li><span class="li-ic">' + ic(o.icon, 18) + '</span>' + esc(o.text) + '</li>';
      }).join('') + '</ul>' +
      '<div class="wl-foot"><button class="btn btn-gold" data-go="login">Join free or sign in</button>' +
      '<p class="fine center">Membership is open to adults of legal drinking age — verified once with Aadhaar.</p>' +
      '<p class="wl-group">A ' + esc(BC_BRAND.group) + ' venture</p></div>' +
      '</div>';
  };

  /* ----- Login (mobile) ----- */
  SCREENS.login = function () {
    return topbar('', 'welcome') + '<div class="auth">' +
      '<h1>Enter your mobile number</h1>' +
      '<p class="lead">We\'ll send a one-time password to verify it’s you.</p>' +
      '<div class="field-l">Mobile number</div>' +
      '<div class="phone-field"><span class="cc">+91</span><input id="mobile" type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit number" autocomplete="tel-national" value="' + esc(ui.mobile) + '"></div>' +
      '<div class="err-text" id="mobErr"></div>' +
      '<button class="btn btn-gold mt8" id="sendOtp" data-act="sendOtp" disabled>Send OTP</button>' +
      '<p class="fine center mt16">' + ic('shield', 14).replace('class="ic"', 'class="ic" style="display:inline;vertical-align:-2px"') + ' Next, a one-time Aadhaar check confirms your age.</p>' +
      '</div>';
  };
  AFTER.login = function () {
    var inp = $('mobile'), btn = $('sendOtp');
    function check() {
      inp.value = inp.value.replace(/\D/g, '').slice(0, 10);
      ui.mobile = inp.value;
      btn.disabled = !/^[6-9]\d{9}$/.test(inp.value);
      $('mobErr').textContent = inp.value.length === 10 && btn.disabled ? 'Enter a valid Indian mobile number' : '';
    }
    inp.addEventListener('input', check);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !btn.disabled) ACTIONS.sendOtp(); });
    check(); inp.focus();
  };

  /* ----- OTP ----- */
  SCREENS.otp = function () {
    var boxes = '';
    for (var i = 0; i < 6; i++) boxes += '<input inputmode="numeric" maxlength="1" aria-label="Digit ' + (i + 1) + '">';
    return topbar('', 'login') + '<div class="auth">' +
      '<h1>Verify OTP</h1>' +
      '<p class="lead">Sent to +91 ' + esc(ui.mobile.replace(/(\d{5})(\d{5})/, '$1 $2')) + ' · <a class="link" href="#/login">Change</a></p>' +
      '<div class="otp mt24" id="otp">' + boxes + '</div>' +
      '<div class="err-text" id="otpErr"></div>' +
      '<div class="demo-hint">Demo OTP: <b>' + esc(BC_BRAND.demoOtp) + '</b></div>' +
      '<button class="btn btn-gold mt16" id="verifyOtp" data-act="verifyOtp" disabled>Verify & continue</button>' +
      '<p class="fine center mt16" id="resend"></p>' +
      '</div>';
  };
  AFTER.otp = function () {
    if (!ui.mobile) { go('login'); return; }
    var wrap = $('otp'), ins = wrap.querySelectorAll('input'), btn = $('verifyOtp');
    function code() { return Array.prototype.map.call(ins, function (x) { return x.value; }).join(''); }
    Array.prototype.forEach.call(ins, function (inp, i) {
      inp.addEventListener('input', function () {
        var v = inp.value.replace(/\D/g, '');
        if (v.length > 1) { // pasted full code
          v.split('').slice(0, 6).forEach(function (ch, k) { if (ins[k]) ins[k].value = ch; });
          ins[Math.min(5, v.length - 1)].focus();
        } else {
          inp.value = v;
          if (v && ins[i + 1]) ins[i + 1].focus();
        }
        wrap.classList.remove('bad'); $('otpErr').textContent = '';
        btn.disabled = code().length !== 6;
        if (code().length === 6) ACTIONS.verifyOtp();
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Backspace' && !inp.value && ins[i - 1]) ins[i - 1].focus(); });
    });
    ins[0].focus();
    var left = 30;
    function tick() {
      var r = $('resend'); if (!r) return;
      if (left > 0) { r.textContent = 'Resend OTP in ' + left + 's'; left--; }
      else { r.innerHTML = '<a class="link" href="javascript:void(0)" data-act="resendOtp">Resend OTP</a>'; }
    }
    tick(); timers.push(setInterval(tick, 1000));
  };

  /* ----- Aadhaar age verification ----- */
  SCREENS.kyc = function () {
    var minAge = Math.min.apply(null, Object.keys(BC_STATES).map(function (k) { return BC_STATES[k].drinkingAge; }));
    return topbar('', '') + '<div class="auth">' +
      '<span class="badge">' + ic('shield', 13) + ' One-time check</span>' +
      '<h1 class="mt12">Verify your age with Aadhaar</h1>' +
      '<p class="lead">Our pubs serve alcohol, so we confirm every member meets the legal drinking age (' + minAge + '+) of the state they visit.</p>' +
      '<div class="age-rule">' + Object.keys(BC_STATES).map(function (k) {
        return '<div><b>' + BC_STATES[k].drinkingAge + '+</b><span>' + esc(BC_STATES[k].name) + ' pubs</span></div>';
      }).join('') + '</div>' +
      '<div class="field-l">Verify using</div>' +
      BC_KYC.methods.map(function (m) {
        return '<button class="method' + (ui.kycMethod === m.id ? ' on' : '') + '" data-act="kycMethod" data-id="' + m.id + '"><span class="radio"></span>' +
          '<span class="li-main"><span class="li-t" style="display:block">' + esc(m.title) + (m.recommended ? ' <span class="badge ok">Recommended</span>' : '') + '</span>' +
          '<span class="li-s" style="display:block">' + esc(m.sub) + '</span></span></button>';
      }).join('') +
      '<label class="check mt16"><input type="checkbox" id="kycConsent"' + (ui.kycConsent ? ' checked' : '') + '><span>' + esc(BC_KYC.consent) + '</span></label>' +
      '<button class="btn btn-gold mt24" id="kycGo" data-act="kycStart"' + (ui.kycConsent ? '' : ' disabled') + '>Verify my age</button>' +
      '</div>';
  };
  AFTER.kyc = function () {
    $('kycConsent').addEventListener('change', function (e) { ui.kycConsent = e.target.checked; $('kycGo').disabled = !ui.kycConsent; });
  };

  SCREENS['kyc-done'] = function () {
    var a = memberAge();
    var rows = Object.keys(BC_STATES).map(function (k) {
      var ok = a >= BC_STATES[k].drinkingAge;
      return '<div class="li"><span class="li-ic">' + ic(ok ? 'check' : 'lock', 18) + '</span><div class="li-main"><div class="li-t">' + esc(BC_STATES[k].name) + ' pubs</div>' +
        '<div class="li-s">Legal age ' + BC_STATES[k].drinkingAge + '+</div></div><span class="badge ' + (ok ? 'ok' : 'err') + '">' + (ok ? 'Eligible' : 'Not yet') + '</span></div>';
    }).join('');
    return '<div class="auth"><div class="verified-hero"><div class="big-check">' + ic('check', 36) + '</div>' +
      '<h1>You’re verified</h1><p class="lead">Welcome to ' + esc(BC_BRAND.name) + ', ' + esc(BC_MEMBER.firstName) + '.</p></div>' +
      '<div class="list mt16">' +
      '<div class="li"><span class="li-ic">' + ic('user', 18) + '</span><div class="li-main"><div class="li-t">' + esc(BC_MEMBER.name) + '</div><div class="li-s">Aadhaar ' + esc(BC_MEMBER.kyc.aadhaarMasked) + '</div></div></div>' +
      '<div class="li"><span class="li-ic">' + ic('shield', 18) + '</span><div class="li-main"><div class="li-t">Age verified · ' + a + ' years</div><div class="li-s">' + esc(BC_MEMBER.kyc.method) + '</div></div></div>' +
      rows + '</div>' +
      '<p class="fine center mt12">Your Aadhaar number is never stored — only a verified-age flag.</p>' +
      '<button class="btn btn-gold mt24" data-go="home">Show my membership card</button></div>';
  };

  /* ----- Home ----- */
  SCREENS.home = function () {
    var t = tier(), nt = nextTier(t), R = BC_POINTS_RULES;
    var h = '<div class="home-head"><div class="hh-left"><div class="avatar">' + initials(BC_MEMBER.name) + '</div>' +
      '<div><div class="hh-greet">' + greeting() + '</div><div class="hh-name">' + esc(BC_MEMBER.firstName) + '</div></div></div>' +
      '<button class="iconbtn" data-act="notifs" aria-label="Notifications">' + ic('bell') + '<span class="dot"></span></button></div>';

    h += '<div class="pad"><div class="tap" data-go="card">' + cardFront() + '</div>';

    h += '<div class="surface stats-wrap mt16"><div class="stats">' +
      '<div class="stat"><div class="stat-k">Points</div><div class="stat-v">' + num(S.points) + '</div><div class="stat-s">Worth ' + inr(S.points * R.rupeeValue) + '</div></div>' +
      '<div class="stat-div"></div>' +
      '<div class="stat"><div class="stat-k">Tier</div><div class="stat-v">' + esc(t.name) + '</div><div class="stat-s">' + t.earnRate + ' pts per ₹100</div></div></div>';
    if (nt) {
      var spent = BC_MEMBER.tierSpendYear, pct = Math.min(100, spent / nt.qualifySpend * 100);
      h += '<div class="progress"><div class="progress-t"><span>' + inr(spent) + ' spent this year</span><span>' + esc(nt.name) + ' at ' + inr(nt.qualifySpend) + '</span></div>' +
        '<div class="bar"><i style="width:' + pct.toFixed(1) + '%"></i></div>' +
        '<div class="progress-t mt8" style="margin-bottom:0"><span>' + inr(Math.max(0, nt.qualifySpend - spent)) + ' more for a free upgrade</span><a class="link" href="#/tiers">Upgrade now</a></div></div>';
    }
    h += '</div>';

    if (R.expiring && R.expiring.points) {
      h += '<div class="alert">' + ic('clock', 18) + '<span><b>' + num(R.expiring.points) + ' points</b> expire on ' + esc(R.expiring.date) + '. <a class="link" href="#/rewards">Redeem</a></span></div>';
    }

    h += '<div class="qa">' +
      '<button data-go="card"><span class="qa-ic">' + ic('qr') + '</span>Show card</button>' +
      '<button data-act="payAt" data-id=""><span class="qa-ic">' + ic('receipt') + '</span>Pay bill</button>' +
      '<button data-go="pubs"><span class="qa-ic">' + ic('calendar') + '</span>Book table</button>' +
      '<button data-go="rewards"><span class="qa-ic">' + ic('gift') + '</span>Rewards</button></div>';

    if (!isStandalone()) {
      h += '<button class="install-banner" data-act="install"><span class="li-ic">' + ic('download', 18) + '</span>' +
        '<span class="li-main"><span class="li-t" style="display:block">Add BocheClub to your home screen</span><span class="li-s" style="display:block">Opens like an app · works without signal at the bar</span></span>' +
        '<span class="li-chev">' + ic('chev', 18) + '</span></button>';
    }
    h += '</div>';

    h += '<div class="sec"><div class="sec-h"><h3>Offers for you</h3><a class="link" href="#/offers">See all</a></div><div class="offers-row">' +
      BC_OFFERS.slice(0, 4).map(function (o, i) {
        return '<button class="offer-mini' + (i === 0 ? ' hl' : '') + '" data-go="offers"><span class="badge' + (i === 0 ? '' : ' plain') + '">' + esc(o.kind) + '</span>' +
          '<h4>' + esc(o.title) + '</h4><p>' + esc(o.desc) + '</p><div class="om-foot">' + ic('pin', 13) + esc(pubsLabel(o.pubs)) + '</div></button>';
      }).join('') + '</div></div>';

    h += '<div class="sec"><div class="sec-h"><h3>Upcoming at our pubs</h3><a class="link" href="javascript:void(0)" data-act="openEvents">All events</a></div>' +
      '<div class="pad"><div class="list">' + BC_EVENTS.slice(0, 2).map(eventRow).join('') + '</div></div></div>';

    h += '<div class="sec"><div class="sec-h"><h3>Coming soon to ' + esc(BC_BRAND.superApp) + '</h3></div><div class="pad"><div class="soon-grid">' +
      BC_COMING_SOON.map(function (c) {
        return '<div class="soon"><span class="badge plain">Soon</span><div class="li-ic">' + ic(c.icon, 18) + '</div><h4>' + esc(c.title) + '</h4><p>' + esc(c.desc) + '</p></div>';
      }).join('') + '</div></div></div>';
    return h;
  };

  /* ----- Membership card ----- */
  SCREENS.card = function () {
    var t = tier(), hp = pub(BC_MEMBER.homePub);
    return topbar('Membership card', '') + '<div class="pad">' +
      '<div class="flip" id="flip" data-act="flip"><div class="flip-inner"><div class="face front">' + cardFront() + '</div><div class="face back">' + cardBack() + '</div></div></div>' +
      '<p class="hint">Tap the card to flip · show the QR at the counter</p>' +
      '<button class="btn btn-gold" data-act="flip" id="flipBtn">' + ic('qr') + ' Show QR code</button>' +
      '<div class="wallet-row"><button class="wallet-btn" data-act="wallet" data-id="Google Wallet">' + ic('wallet', 18) + ' Google Wallet</button>' +
      '<button class="wallet-btn" data-act="wallet" data-id="Apple Wallet">' + ic('wallet', 18) + ' Apple Wallet</button></div>' +
      '<div class="sec-h" style="padding:0;margin-top:24px"><h3>Card details</h3></div>' +
      '<div class="surface" style="padding:4px 16px">' +
      '<div class="kv"><span>Member ID</span><span>' + esc(BC_MEMBER.id) + '</span></div>' +
      '<div class="kv"><span>Tier</span><span>' + esc(t.name) + '</span></div>' +
      '<div class="kv"><span>Member since</span><span>' + esc(BC_MEMBER.memberSince) + '</span></div>' +
      '<div class="kv"><span>Valid thru</span><span>' + esc(BC_MEMBER.validThru) + '</span></div>' +
      '<div class="kv"><span>Home pub</span><span>' + esc(hp.city) + '</span></div>' +
      '<div class="kv"><span>Age verification</span><span class="pos">Verified</span></div></div>' +
      '<div class="sec-h" style="padding:0;margin-top:24px"><h3>How it works</h3></div>' +
      '<ol class="howto"><li>Show your QR when you order or at billing.</li><li>Staff scan it — your bill is linked from the pub’s billing system.</li>' +
      '<li>Points land in your account automatically. Pay in-app or at the counter.</li></ol>' +
      '</div>';
  };
  AFTER.card = function () {
    var left = 30, C = 2 * Math.PI * 11;
    function draw() {
      var win = Math.floor(Date.now() / 30000);
      $('qrSvg').innerHTML = BCQR.svg(BC_MEMBER.id + ':' + win, 200);
      left = 30 - Math.floor((Date.now() % 30000) / 1000);
    }
    function tick() {
      if (!$('qrCount')) return;
      left--;
      if (left <= 0) draw();
      $('qrCount').textContent = left;
      $('qrRing').style.strokeDashoffset = (C * (1 - left / 30)).toFixed(2);
    }
    draw(); $('qrCount').textContent = left;
    timers.push(setInterval(tick, 1000));
  };

  /* ----- Pubs ----- */
  SCREENS.pubs = function () {
    var states = Object.keys(BC_STATES);
    var list = BC_PUBS.filter(function (p) { return ui.pubFilter === 'all' || p.state === ui.pubFilter; });
    return topbar('Our pubs', '') + '<div class="pad">' +
      '<p class="sub">' + BC_PUBS.length + ' pubs across ' + states.map(function (k) { return BC_STATES[k].name; }).join(' & ') + '. Your card works at every one.</p>' +
      '<div class="chips" style="margin-bottom:14px"><button class="chip' + (ui.pubFilter === 'all' ? ' on' : '') + '" data-act="pubFilter" data-id="all">All</button>' +
      states.map(function (k) { return '<button class="chip' + (ui.pubFilter === k ? ' on' : '') + '" data-act="pubFilter" data-id="' + k + '">' + esc(BC_STATES[k].name) + '</button>'; }).join('') + '</div>' +
      list.map(pubCard).join('') + '</div>';
  };
  function pubOffers(p) { return BC_OFFERS.filter(function (o) { return o.pubs === 'all' || o.pubs.indexOf(p.id) > -1; }); }
  function pubCard(p) {
    var ok = eligible(p), offers = pubOffers(p).filter(function (o) { return o.pubs !== 'all'; });
    return '<div class="surface pubcard" data-go="pub/' + p.id + '">' +
      '<div class="pub-hero tone-' + p.tone + '"><span class="pub-city">' + esc(p.city) + '</span><span class="pub-rating">' + ic('star', 12) + p.rating + '</span></div>' +
      '<div class="pub-body"><div class="pub-name">' + esc(p.name) + '</div>' +
      '<div class="pub-area">' + ic('pin', 13) + esc(p.area) + ' · ' + esc(p.distance) + '</div>' +
      '<div class="pub-tags"><span class="badge plain">' + esc(BC_STATES[p.state].name) + '</span><span class="badge plain">' + BC_STATES[p.state].drinkingAge + '+</span>' +
      p.tags.map(function (t) { return '<span class="badge">' + esc(t) + '</span>'; }).join('') + '</div>' +
      (offers.length ? '<div class="pub-offer">' + ic('tag', 15) + esc(offers[0].title) + '</div>' : '') +
      '</div>' + (ok ? '' : '<div class="pub-lock">' + ic('lock', 20) + 'Available from age ' + BC_STATES[p.state].drinkingAge + '</div>') + '</div>';
  }

  SCREENS.pub = function (id) {
    var p = pub(id); if (!p) return SCREENS.pubs();
    var ok = eligible(p), offers = pubOffers(p), events = BC_EVENTS.filter(function (e) { return e.pub === p.id; });
    return topbar(p.city, 'pubs') +
      '<div class="pub-hero detail-hero tone-' + p.tone + '"><span class="pub-city">' + esc(p.name) + '</span><span class="pub-rating">' + ic('star', 12) + p.rating + '</span></div>' +
      '<div class="pad mt16"><div class="list">' +
      '<div class="li"><span class="li-ic">' + ic('pin', 18) + '</span><div class="li-main"><div class="li-t">' + esc(p.area) + '</div><div class="li-s">' + esc(p.city) + ', ' + esc(BC_STATES[p.state].name) + ' · ' + esc(p.distance) + ' away</div></div></div>' +
      '<div class="li"><span class="li-ic">' + ic('clock', 18) + '</span><div class="li-main"><div class="li-t">' + esc(p.hours) + '</div><div class="li-s">Open today</div></div></div>' +
      '<div class="li"><span class="li-ic">' + ic('phone', 18) + '</span><div class="li-main"><div class="li-t">' + esc(p.phone) + '</div><div class="li-s">Call for large groups</div></div></div>' +
      '<div class="li"><span class="li-ic">' + ic('shield', 18) + '</span><div class="li-main"><div class="li-t">Entry ' + BC_STATES[p.state].drinkingAge + '+</div><div class="li-s">' + (ok ? 'You’re eligible — age verified' : 'Not available for your age') + '</div></div></div></div>' +
      '<div class="pub-tags mt12">' + p.tags.map(function (t) { return '<span class="badge">' + esc(t) + '</span>'; }).join('') + '</div>' +
      (offers.length ? '<div class="sec-h" style="padding:0;margin-top:22px"><h3>Offers here</h3></div>' + offers.map(offerCard).join('') : '') +
      (events.length ? '<div class="sec-h" style="padding:0;margin-top:22px"><h3>Events</h3></div><div class="list">' + events.map(eventRow).join('') + '</div>' : '') +
      '</div>' +
      (ok ? '<div class="sticky-cta"><div class="btn-row"><button class="btn btn-line" data-act="payAt" data-id="' + p.id + '">Pay bill</button><button class="btn btn-gold" data-go="book/' + p.id + '">Book a table</button></div></div>' : '');
  };

  /* ----- Book a table ----- */
  SCREENS.book = function (id) {
    var p = pub(id); if (!p || !eligible(p)) return SCREENS.pubs();
    var b = ui.book, days = [], d;
    for (var i = 0; i < 7; i++) { d = new Date(); d.setDate(d.getDate() + i); days.push(d); }
    var priority = tier().id !== 'classic';
    return topbar('Book a table', 'pub/' + p.id) + '<div class="pad">' +
      '<p class="sub">' + esc(p.name) + ' · ' + esc(p.area) + '</p>' +
      (priority ? '<div class="alert" style="margin-top:0">' + ic('crown', 18) + '<span>' + esc(tier().name) + ' members get priority confirmation.</span></div>' : '') +
      '<div class="field-l">Date</div><div class="chips scroll-x">' + days.map(function (dd, k) {
        var lbl = k === 0 ? 'Today' : k === 1 ? 'Tomorrow' : dd.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
        return '<button class="chip' + (b.day === k ? ' on' : '') + '" data-act="bookDay" data-id="' + k + '">' + lbl + '</button>';
      }).join('') + '</div>' +
      '<div class="field-l">Time</div><div class="chips">' + BC_BOOKING.times.map(function (t) {
        return '<button class="chip' + (b.time === t ? ' on' : '') + '" data-act="bookTime" data-id="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('') + '</div>' +
      '<div class="field-l">Guests</div><div class="stepper"><button data-act="guests" data-id="-1" aria-label="Fewer">' + ic('minus', 18) + '</button><span class="v">' + b.guests + '</span><button data-act="guests" data-id="1" aria-label="More">' + ic('plus', 18) + '</button></div>' +
      '<div class="field-l">Occasion</div><div class="chips">' + BC_BOOKING.occasions.map(function (o) {
        return '<button class="chip' + (b.occasion === o ? ' on' : '') + '" data-act="bookOcc" data-id="' + esc(o) + '">' + esc(o) + '</button>';
      }).join('') + '</div>' +
      '<div class="field-l">Note for the team (optional)</div><textarea class="input" id="bookNote" placeholder="e.g. window seat, cake arrangement">' + esc(b.note) + '</textarea>' +
      '<button class="btn btn-gold mt24" data-act="confirmBook" data-id="' + p.id + '"' + (b.time ? '' : ' disabled') + '>Confirm booking</button>' +
      '</div>';
  };
  AFTER.book = function () { var n = $('bookNote'); if (n) n.addEventListener('input', function () { ui.book.note = n.value; }); };

  /* ----- Rewards ----- */
  SCREENS.rewards = function () {
    var R = BC_POINTS_RULES, tab = ui.rewardsTab, body = '';
    if (tab === 'catalogue') {
      body = '<div class="list">' + BC_REWARDS.map(function (r) {
        var can = S.points >= r.pts;
        return '<div class="reward"><span class="li-ic">' + ic(r.icon, 18) + '</span><div class="li-main"><div class="li-t">' + esc(r.title) + '</div>' +
          '<div class="li-s">' + esc(r.cat) + ' · <span class="pts">' + num(r.pts) + ' pts</span></div></div>' +
          '<button class="btn btn-sm ' + (can ? 'btn-soft' : 'btn-line') + '" data-act="redeem" data-id="' + r.id + '"' + (can ? '' : ' disabled') + '>Redeem</button></div>';
      }).join('') + '</div>';
    } else if (tab === 'history') {
      body = '<div class="list">' + S.history.map(function (h) {
        return '<div class="li"><span class="li-ic">' + ic(h.pts > 0 ? 'plus' : 'minus', 16) + '</span><div class="li-main"><div class="li-t">' + esc(h.title) + '</div><div class="li-s">' + esc(h.date) + ' · ' + esc(h.ref) + '</div></div>' +
          '<span class="li-r ' + (h.pts > 0 ? 'pos' : 'neg') + '">' + (h.pts > 0 ? '+' : '−') + num(Math.abs(h.pts)) + '</span></div>';
      }).join('') + '</div>';
    } else {
      body = S.vouchers.length ? S.vouchers.map(function (v) {
        return '<div class="voucher"><div class="li-t">' + esc(v.title) + '</div><div class="code">' + esc(v.code) + '</div><div class="li-s">Issued ' + esc(v.date) + ' · show at the counter</div></div>';
      }).join('') : '<div class="surface center" style="padding:28px 16px"><div class="li-ic" style="margin:0 auto 10px">' + ic('gift', 18) + '</div><div class="li-t">No vouchers yet</div><div class="li-s">Redeem a reward and it will appear here.</div></div>';
    }
    return topbar('Rewards', '') + '<div class="pad">' +
      '<div class="pts-hero"><div class="k">Available points</div><div class="row"><div><div class="v">' + num(S.points) + '</div><div class="s">Worth ' + inr(S.points * R.rupeeValue) + ' · 1 pt = ' + inr(R.rupeeValue * 100) + '/100 pts</div></div>' +
      '<a class="btn btn-sm" style="background:rgba(255,255,255,.55);color:#2E2108" href="#/tiers">' + ic('crown', 16) + esc(tier().name) + '</a></div></div>' +
      '<p class="fine">Min ' + num(R.minRedeem) + ' pts per redemption · points cover up to ' + R.maxBillPct + '% of a bill · valid ' + R.expiryMonths + ' months.</p>' +
      '<div class="seg mt16"><button class="' + (tab === 'catalogue' ? 'on' : '') + '" data-act="rewardsTab" data-id="catalogue">Rewards</button>' +
      '<button class="' + (tab === 'history' ? 'on' : '') + '" data-act="rewardsTab" data-id="history">History</button>' +
      '<button class="' + (tab === 'vouchers' ? 'on' : '') + '" data-act="rewardsTab" data-id="vouchers">Vouchers' + (S.vouchers.length ? ' (' + S.vouchers.length + ')' : '') + '</button></div>' +
      '<div class="mt16">' + body + '</div></div>';
  };

  /* ----- Tiers ----- */
  SCREENS.tiers = function () {
    var cur = tier(), curIdx = BC_TIERS.indexOf(cur);
    return topbar('Membership tiers', 'rewards') + '<div class="pad">' +
      '<p class="sub">Join free as Classic. Upgrade any time, or spend your way up for a complimentary upgrade.</p>' +
      BC_TIERS.map(function (t, i) {
        var isCur = t.id === cur.id;
        var cta = isCur ? '<button class="btn btn-line" disabled>Your current tier</button>'
          : i > curIdx ? '<button class="btn btn-gold" data-act="upgrade" data-id="' + t.id + '">Upgrade · ' + esc(t.priceLabel) + '</button>'
          : '';
        return '<div class="tier-card t-' + t.id + (isCur ? ' current' : '') + '"><div class="tc-head"><span class="tc-name">' + esc(t.name) + '</span><span class="tc-price">' + esc(t.priceLabel) + '</span></div>' +
          '<ul class="perks">' + t.perks.map(function (p) { return '<li>' + ic('check', 16) + esc(p) + '</li>'; }).join('') + '</ul>' +
          (t.qualifySpend ? '<p class="fine" style="margin:-4px 0 12px">Complimentary when you spend ' + inr(t.qualifySpend) + ' in a year</p>' : '') + cta + '</div>';
      }).join('') + '</div>';
  };

  /* ----- Pay bill ----- */
  function billCalc() {
    var b = BC_POS_SAMPLE, R = BC_POINTS_RULES;
    var sub = b.items.reduce(function (a, i) { return a + i.qty * i.price; }, 0), total = sub + b.taxes;
    var maxPts = Math.floor(Math.min(S.points, total * R.maxBillPct / 100 / R.rupeeValue) / 10) * 10;
    var canUse = maxPts >= R.minRedeem;
    var ptsUsed = ui.pay.usePts && canUse ? maxPts : 0;
    var disc = ptsUsed * R.rupeeValue, payable = total - disc;
    return { sub: sub, total: total, maxPts: maxPts, canUse: canUse, ptsUsed: ptsUsed, disc: disc, payable: payable,
      earn: Math.floor(payable / 100) * tier().earnRate };
  }
  SCREENS.pay = function () {
    var p = ui.pay, P = pub(p.pub), pubs = BC_PUBS.filter(eligible);
    var h = topbar('Pay bill', 'home') + '<div class="pad">' +
      '<div class="field-l" style="margin-top:4px">Pub</div><div class="chips scroll-x">' + pubs.map(function (x) {
        return '<button class="chip' + (x.id === p.pub ? ' on' : '') + '" data-act="payPub" data-id="' + x.id + '">' + esc(x.city) + '</button>';
      }).join('') + '</div>' +
      '<div class="field-l">Table number</div><div class="inline-field"><input id="tableNo" class="input" inputmode="numeric" maxlength="3" placeholder="e.g. ' + esc(BC_POS_SAMPLE.table) + '" value="' + esc(p.table) + '">' +
      '<button class="btn btn-line btn-sm" data-act="fetchBill" id="fetchBtn">' + ic('refresh', 16) + (p.fetched ? 'Refresh' : 'Fetch bill') + '</button></div>' +
      '<p class="fine">Your bill is pulled live from ' + esc(P.name) + '’s billing system.</p>';
    if (p.fetched) {
      var c = billCalc(), R = BC_POINTS_RULES;
      h += '<div class="surface bill"><div class="bill-h"><span class="li-t">Table ' + esc(p.table) + ' · ' + esc(P.city) + '</span><span class="badge ok">Live from POS</span></div>' +
        BC_POS_SAMPLE.items.map(function (i) { return '<div class="kv"><span>' + esc(i.name) + (i.qty > 1 ? ' × ' + i.qty : '') + '</span><span>' + inr(i.qty * i.price) + '</span></div>'; }).join('') +
        '<div class="kv"><span>Taxes & charges</span><span>' + inr(BC_POS_SAMPLE.taxes) + '</span></div>' +
        (c.ptsUsed ? '<div class="kv"><span>Points (' + num(c.ptsUsed) + ' pts)</span><span class="pos">−' + inr(c.disc) + '</span></div>' : '') +
        '<div class="kv total"><span>To pay</span><span>' + inr(c.payable) + '</span></div></div>' +
        '<div class="surface redeem-box"><span class="li-ic">' + ic('gift', 18) + '</span><div class="li-main"><div class="li-t">Use points</div><div class="li-s">' +
        (c.canUse ? 'Use ' + num(c.maxPts) + ' of ' + num(S.points) + ' pts · save ' + inr(c.maxPts * R.rupeeValue) : 'Need at least ' + num(R.minRedeem) + ' pts to redeem') + '</div></div>' +
        '<button class="toggle' + (c.ptsUsed ? ' on' : '') + (c.canUse ? '' : ' dis') + '" data-act="usePts" aria-label="Use points"></button></div>' +
        '<div class="field-l">Pay with</div>' + methodList(p.method, 'payMethod') +
        '<p class="fine">You’ll earn <b class="gold-text">' + num(c.earn) + ' points</b> on this bill. Paid directly to the pub via secure gateway — no wallet balance is held.</p>' +
        '<button class="btn btn-gold mt16" data-act="payNow">Pay ' + inr(c.payable) + '</button>';
    }
    return h + '</div>';
  };
  AFTER.pay = function () { var t = $('tableNo'); t.addEventListener('input', function () { t.value = t.value.replace(/\D/g, ''); ui.pay.table = t.value; }); };

  SCREENS['pay-success'] = function () {
    var L = S.lastPayment; if (!L) return SCREENS.home();
    return '<div class="success"><div class="big-check">' + ic('check', 36) + '</div><h1>Payment successful</h1>' +
      '<div class="amt">' + inr(L.paid) + '</div><p class="sub" style="margin:4px 0 0">' + esc(L.pub) + ' · ' + esc(L.billNo) + '</p>' +
      '<div class="earned">' + ic('sparkle', 18) + '+' + num(L.earned) + ' points earned</div></div>' +
      '<div class="pad mt16"><div class="surface" style="padding:4px 16px">' +
      '<div class="kv"><span>Paid via</span><span>' + esc(L.method) + '</span></div>' +
      (L.ptsUsed ? '<div class="kv"><span>Points used</span><span class="neg">−' + num(L.ptsUsed) + '</span></div>' : '') +
      '<div class="kv"><span>Points earned</span><span class="pos">+' + num(L.earned) + '</span></div>' +
      '<div class="kv"><span>New balance</span><span>' + num(S.points) + ' pts</span></div>' +
      '<div class="kv"><span>Date</span><span>' + esc(L.date) + '</span></div></div>' +
      '<div class="btn-row mt24"><button class="btn btn-line" data-go="rewards">View points</button><button class="btn btn-gold" data-go="home">Done</button></div></div>';
  };

  /* ----- Offers & events ----- */
  function offerCard(o) {
    var on = S.activated.indexOf(o.id) > -1, allowed = o.tiers.indexOf(S.tier) > -1;
    return '<div class="surface offer"><span class="badge">' + esc(o.kind) + '</span><h4>' + esc(o.title) + '</h4><p>' + esc(o.desc) + '</p>' +
      '<div class="offer-foot"><div class="offer-meta">' + esc(pubsLabel(o.pubs)) + '<br>' + esc(o.valid) + '</div>' +
      (allowed ? '<button class="btn btn-sm ' + (on ? 'btn-soft' : 'btn-gold') + '" data-act="activate" data-id="' + o.id + '">' + (on ? ic('check', 16) + 'Activated' : 'Activate') + '</button>'
        : '<a class="btn btn-sm btn-line" href="#/tiers">' + ic('lock', 15) + 'Gold & above</a>') + '</div></div>';
  }
  SCREENS.offers = function () {
    var tab = ui.offersTab, body;
    if (tab === 'offers') body = BC_OFFERS.map(offerCard).join('');
    else body = BC_EVENTS.map(function (e) {
      var d = new Date(e.date + 'T00:00:00'), res = S.reserved.indexOf(e.id) > -1, ok = eligible(pub(e.pub));
      return '<div class="surface offer" style="display:flex;gap:14px"><div class="datebox"><b>' + d.getDate() + '</b><span>' + d.toLocaleDateString('en-GB', { month: 'short' }) + '</span></div>' +
        '<div class="li-main"><div class="li-t" style="font-size:15px">' + esc(e.title) + '</div><div class="li-s">' + esc(pub(e.pub).city) + ' · ' + esc(e.time) + ' · ' + e.seats + ' seats left</div>' +
        '<div class="li-s gold-text" style="margin-top:4px">' + esc(e.price) + '</div>' +
        '<button class="btn btn-sm mt12 ' + (res ? 'btn-soft' : 'btn-gold') + '" data-act="reserve" data-id="' + e.id + '"' + (ok ? '' : ' disabled') + '>' + (res ? ic('check', 16) + 'Reserved' : 'Reserve a spot') + '</button></div></div>';
    }).join('');
    return topbar('Offers & events', 'home') + '<div class="pad">' +
      '<div class="seg"><button class="' + (tab === 'offers' ? 'on' : '') + '" data-act="offersTab" data-id="offers">Offers</button><button class="' + (tab === 'events' ? 'on' : '') + '" data-act="offersTab" data-id="events">Events</button></div>' +
      '<p class="fine" style="margin-bottom:12px">Activated offers apply automatically when staff scan your card.</p>' + body + '</div>';
  };

  /* ----- Profile ----- */
  SCREENS.profile = function () {
    var t = tier();
    function tg(k, label, sub) {
      return '<div class="li"><div class="li-main"><div class="li-t">' + label + '</div><div class="li-s">' + sub + '</div></div><button class="toggle' + (S.notif[k] ? ' on' : '') + '" data-act="notif" data-id="' + k + '" aria-label="' + label + '"></button></div>';
    }
    function row(icn, title, sub, act, extra) {
      return '<button class="li" ' + act + '><span class="li-ic">' + ic(icn, 18) + '</span><div class="li-main"><div class="li-t">' + title + '</div>' + (sub ? '<div class="li-s">' + sub + '</div>' : '') + '</div>' + (extra || '<span class="li-chev">' + ic('chev', 18) + '</span>') + '</button>';
    }
    return topbar('Profile', '') +
      '<div class="prof-head"><div class="avatar">' + initials(BC_MEMBER.name) + '</div><div><div class="prof-name">' + esc(BC_MEMBER.name) + '</div>' +
      '<div class="li-s">' + esc(BC_MEMBER.id) + '</div><span class="badge mt8">' + ic('crown', 12) + esc(t.name) + ' member</span></div></div>' +
      '<div class="pad">' +
      '<div class="field-l" style="margin-top:0">Account</div><div class="list">' +
      row('phone', '+91 ' + esc(BC_MEMBER.mobile), 'Mobile · OTP verified', 'disabled', '<span class="badge ok">Verified</span>') +
      row('doc', esc(BC_MEMBER.email), 'Email', 'disabled', '') +
      row('shield', 'Aadhaar ' + esc(BC_MEMBER.kyc.aadhaarMasked), 'Age verified · ' + esc(BC_MEMBER.kyc.verifiedOn), 'disabled', '<span class="badge ok">Verified</span>') +
      row('crown', 'Membership tier', esc(t.name) + ' · valid thru ' + esc(BC_MEMBER.validThru), 'data-go="tiers"') + '</div>' +
      '<div class="field-l">My bookings</div><div class="list">' + (S.bookings.length ? S.bookings.map(function (b) {
        return '<div class="li"><span class="li-ic">' + ic('calendar', 18) + '</span><div class="li-main"><div class="li-t">' + esc(b.pub) + '</div><div class="li-s">' + esc(b.when) + ' · ' + b.guests + ' guests · ' + esc(b.ref) + '</div></div><span class="badge ok">Confirmed</span></div>';
      }).join('') : '<div class="li"><span class="li-ic">' + ic('calendar', 18) + '</span><div class="li-main"><div class="li-t">No upcoming bookings</div><div class="li-s">Book a table from any pub page</div></div></div>') + '</div>' +
      '<div class="field-l">Notifications</div><div class="list">' +
      tg('offers', 'Offers & promotions', 'Cross-pub deals and bonus points') + tg('events', 'Events', 'Live nights and member events') + tg('points', 'Points activity', 'Earn, redeem and expiry alerts') + '</div>' +
      '<div class="field-l">App</div><div class="list">' +
      (isStandalone() ? '' : row('download', 'Install app', 'Add to your home screen', 'data-act="install"')) +
      row('help', 'Help & support', esc(BC_BRAND.supportPhone) + ' · ' + esc(BC_BRAND.supportEmail), 'data-act="support"') +
      row('refresh', 'Reset demo', 'Start the prototype from the beginning', 'data-act="resetDemo"', '') +
      row('logout', 'Log out', '', 'data-act="logout"', '') + '</div>' +
      '<p class="group-foot">' + esc(BC_BRAND.name) + ' · ' + esc(BC_BRAND.group) + '</p></div>';
  };

  /* ============================================================
     ACTIONS
     ============================================================ */
  var ACTIONS = {
    sendOtp: function () { if (/^[6-9]\d{9}$/.test(ui.mobile)) go('otp'); },
    resendOtp: function () { toast('OTP resent to +91 ' + ui.mobile); rerender(); },
    verifyOtp: function () {
      var ins = $('otp').querySelectorAll('input');
      var code = Array.prototype.map.call(ins, function (x) { return x.value; }).join('');
      if (code === BC_BRAND.demoOtp) { S.authed = true; save(); go(S.kycDone ? 'home' : 'kyc'); }
      else {
        $('otp').classList.add('bad'); $('otpErr').textContent = 'Incorrect OTP. Please try again.';
        Array.prototype.forEach.call(ins, function (x) { x.value = ''; }); ins[0].focus(); $('verifyOtp').disabled = true;
      }
    },
    kycMethod: function (el) { ui.kycMethod = el.dataset.id; rerender(); },
    kycStart: function () {
      var m = byId(BC_KYC.methods, ui.kycMethod);
      ui.sheetLock = true;
      openSheet('<h3>' + esc(m.title) + '</h3><p class="lead">Verifying your age securely…</p><ul class="steps" id="kycSteps">' +
        BC_KYC.steps.map(function (s) { return '<li><span class="st"></span>' + esc(s) + '</li>'; }).join('') + '</ul>');
      var lis = $('kycSteps').children, i = 0;
      (function step() {
        if (i > 0) { lis[i - 1].className = 'done'; lis[i - 1].firstChild.innerHTML = ic('check', 14); }
        if (i < lis.length) { lis[i].className = 'active'; i++; timers.push(setTimeout(step, 750)); }
        else timers.push(setTimeout(function () { ui.sheetLock = false; S.kycDone = true; save(); go('kyc-done'); }, 500));
      })();
    },
    notifs: function () { toast('You’re all caught up'); },
    flip: function () {
      var f = $('flip'); f.classList.toggle('flipped');
      var b = $('flipBtn'); if (b) b.innerHTML = f.classList.contains('flipped') ? ic('card') + ' Show card front' : ic('qr') + ' Show QR code';
    },
    wallet: function (el) { toast('Membership pass added to ' + el.dataset.id + ' (demo)'); },
    pubFilter: function (el) { ui.pubFilter = el.dataset.id; rerender(); },
    payAt: function (el) { resetPay(el.dataset.id || undefined); go('pay'); },
    payPub: function (el) { ui.pay.pub = el.dataset.id; ui.pay.fetched = false; rerender(); },
    fetchBill: function () {
      if (!ui.pay.table) { toast('Enter your table number'); $('tableNo').focus(); return; }
      var b = $('fetchBtn'); b.disabled = true; b.textContent = 'Fetching…';
      timers.push(setTimeout(function () { ui.pay.fetched = true; ui.pay.usePts = false; rerender(); }, 800));
    },
    usePts: function () { ui.pay.usePts = !ui.pay.usePts; rerender(); },
    payMethod: function (el) { ui.pay.method = el.dataset.id; rerender(); },
    payNow: function () {
      var c = billCalc(), P = pub(ui.pay.pub), m = byId(BC_PAY_METHODS, ui.pay.method);
      ui.sheetLock = true;
      openSheet('<div class="center"><div class="spinner"></div><h3>Processing payment</h3><p class="lead">' + (m.id === 'upi' ? 'Approve the request in your UPI app' : 'Connecting to secure gateway') + ' · ' + inr(c.payable) + '</p></div>');
      timers.push(setTimeout(function () {
        var billNo = P.id.toUpperCase().slice(0, 3) + '-' + Math.floor(10000 + Math.random() * 89999);
        if (c.ptsUsed) { S.points -= c.ptsUsed; addHistory('Points used · ' + P.name, billNo, -c.ptsUsed); }
        S.points += c.earn; addHistory('Bill · ' + P.name, billNo, c.earn);
        S.lastPayment = { paid: c.payable, pub: P.name, billNo: billNo, earned: c.earn, ptsUsed: c.ptsUsed, method: m.label, date: todayLabel() };
        save(); ui.sheetLock = false; resetPay(); go('pay-success');
      }, 1800));
    },
    rewardsTab: function (el) { ui.rewardsTab = el.dataset.id; rerender(); },
    redeem: function (el) {
      var r = byId(BC_REWARDS, el.dataset.id);
      openSheet('<h3>Redeem reward</h3><p class="lead">' + esc(r.title) + '</p><div class="surface mt16" style="padding:4px 16px">' +
        '<div class="kv"><span>Cost</span><span>' + num(r.pts) + ' pts</span></div><div class="kv"><span>Balance after</span><span>' + num(S.points - r.pts) + ' pts</span></div></div>' +
        '<p class="fine">Usable at any BocheClub pub within 30 days.</p>' +
        '<div class="btn-row mt16"><button class="btn btn-line" data-act="closeSheet">Cancel</button><button class="btn btn-gold" data-act="confirmRedeem" data-id="' + r.id + '">Redeem</button></div>');
    },
    confirmRedeem: function (el) {
      var r = byId(BC_REWARDS, el.dataset.id);
      if (S.points < r.pts) return;
      var code = 'BC-' + rand(6);
      S.points -= r.pts; S.vouchers.unshift({ title: r.title, code: code, date: todayLabel() });
      addHistory('Redeemed · ' + r.title, code, -r.pts); save();
      openSheet('<div class="center"><div class="big-check">' + ic('gift', 32) + '</div><h3>Reward unlocked</h3><p class="lead">' + esc(r.title) + '</p>' +
        '<div class="voucher mt16"><div class="li-s">Voucher code</div><div class="code">' + esc(code) + '</div></div>' +
        '<p class="fine">Show this code with your card at the counter.</p><button class="btn btn-gold mt16" data-act="closeSheetRender">Done</button></div>');
    },
    upgrade: function (el) { ui.sheetMethod = BC_PAY_METHODS[0].id; upgradeSheet(el.dataset.id); },
    upMethod: function (el) { ui.sheetMethod = el.dataset.id; upgradeSheet($('upTier').dataset.id); },
    confirmUpgrade: function (el) {
      var t = tier(el.dataset.id);
      ui.sheetLock = true;
      openSheet('<div class="center"><div class="spinner"></div><h3>Processing payment</h3><p class="lead">' + esc(t.name) + ' membership · ' + inr(t.price) + '</p></div>');
      timers.push(setTimeout(function () {
        S.tier = t.id;
        if (t.welcomeBonus) { S.points += t.welcomeBonus; addHistory(t.name + ' welcome bonus', 'TIER-' + t.id.toUpperCase(), t.welcomeBonus); }
        save(); ui.sheetLock = false; closeSheet(); rerender();
        toast('Welcome to ' + t.name + '! +' + num(t.welcomeBonus) + ' points');
      }, 1800));
    },
    bookDay: function (el) { ui.book.day = +el.dataset.id; rerender(); },
    bookTime: function (el) { ui.book.time = el.dataset.id; rerender(); },
    bookOcc: function (el) { ui.book.occasion = el.dataset.id; rerender(); },
    guests: function (el) { ui.book.guests = Math.max(1, Math.min(BC_BOOKING.maxGuests, ui.book.guests + (+el.dataset.id))); rerender(); },
    confirmBook: function (el) {
      var p = pub(el.dataset.id), b = ui.book, d = new Date(); d.setDate(d.getDate() + b.day);
      var when = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + b.time;
      var ref = 'BK-' + rand(5);
      S.bookings.unshift({ ref: ref, pub: p.name, when: when, guests: b.guests }); save();
      resetBook();
      openSheet('<div class="center"><div class="big-check">' + ic('calendar', 32) + '</div><h3>Table booked</h3><p class="lead">' + esc(p.name) + '</p></div>' +
        '<div class="surface mt16" style="padding:4px 16px"><div class="kv"><span>When</span><span>' + esc(when) + '</span></div><div class="kv"><span>Guests</span><span>' + (b.guests) + '</span></div>' +
        '<div class="kv"><span>Booking ref</span><span>' + esc(ref) + '</span></div></div>' +
        '<p class="fine center">Show your membership card on arrival.</p><button class="btn btn-gold mt16" data-act="bookDone" data-id="' + p.id + '">Done</button>');
    },
    bookDone: function (el) { closeSheet(); go('pub/' + el.dataset.id); },
    offersTab: function (el) { ui.offersTab = el.dataset.id; rerender(); },
    openEvents: function () { ui.offersTab = 'events'; go('offers'); },
    activate: function (el) {
      var i = S.activated.indexOf(el.dataset.id);
      if (i > -1) { S.activated.splice(i, 1); toast('Offer deactivated'); }
      else { S.activated.push(el.dataset.id); toast('Offer activated — applies automatically at billing'); }
      save(); rerender();
    },
    reserve: function (el) {
      var i = S.reserved.indexOf(el.dataset.id);
      if (i > -1) { S.reserved.splice(i, 1); toast('Reservation cancelled'); }
      else { S.reserved.push(el.dataset.id); toast('Spot reserved — see you there!'); }
      save(); rerender();
    },
    notif: function (el) { var k = el.dataset.id; S.notif[k] = !S.notif[k]; save(); el.classList.toggle('on', S.notif[k]); },
    install: function () {
      if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt.userChoice.then(function () { deferredPrompt = null; }); return; }
      var ios = isIOS();
      openSheet('<h3>Add to home screen</h3><p class="lead">BocheClub installs straight from your browser — no app store needed.</p>' +
        '<div class="field-l">' + (ios ? 'On iPhone (Safari)' : 'On Android (Chrome)') + '</div><ol class="howto">' +
        (ios ? '<li>Tap the Share button ' + ic('share', 16).replace('class="ic"', 'class="ic" style="display:inline;vertical-align:-3px"') + ' at the bottom of Safari.</li><li>Scroll and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b> — BocheClub appears with your apps.</li>'
          : '<li>Tap the ⋮ menu at the top right of Chrome.</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li><li>Confirm — BocheClub opens full-screen like any app.</li>') +
        '</ol><button class="btn btn-gold mt24" data-act="closeSheet">Got it</button>');
    },
    support: function () { toast('Call ' + BC_BRAND.supportPhone + ' or write to ' + BC_BRAND.supportEmail); },
    resetDemo: function () { S = freshState(); save(); ui.mobile = ''; ui.kycConsent = false; resetPay(); resetBook(); toast('Demo reset'); go('welcome'); },
    logout: function () { S.authed = false; save(); go('welcome'); },
    closeSheet: function () { closeSheet(); },
    closeSheetRender: function () { closeSheet(); rerender(); }
  };

  function upgradeSheet(id) {
    var t = tier(id);
    openSheet('<h3 id="upTier" data-id="' + t.id + '">Upgrade to ' + esc(t.name) + '</h3><p class="lead">' + esc(t.priceLabel) + ' · renews yearly</p>' +
      '<ul class="perks">' + t.perks.slice(0, 4).map(function (p) { return '<li>' + ic('check', 16) + esc(p) + '</li>'; }).join('') + '</ul>' +
      '<div class="field-l">Pay with</div>' + methodList(ui.sheetMethod, 'upMethod') +
      '<button class="btn btn-gold mt16" data-act="confirmUpgrade" data-id="' + t.id + '">Pay ' + inr(t.price) + '</button>');
  }

  /* ============================================================
     SHELL: router, sheet, toast, tabs
     ============================================================ */
  var PUBLIC = { welcome: 1, login: 1, otp: 1 };
  var TABS = { home: 1, pubs: 1, card: 1, rewards: 1, profile: 1 };
  var timers = [];
  function clearTimers() { timers.forEach(function (t) { clearInterval(t); clearTimeout(t); }); timers = []; }
  function parse() { var p = (location.hash || '').replace(/^#\/?/, '').split('/'); return { name: p[0] || '', arg: decodeURIComponent(p[1] || '') }; }
  function go(path) { if (location.hash === '#/' + path) render(); else location.hash = '#/' + path; }
  function resolve(r) {
    if (!S.authed) return PUBLIC[r.name] ? r : { name: 'welcome', arg: '' };
    if (!S.kycDone) return { name: 'kyc', arg: '' };
    if (PUBLIC[r.name] || r.name === 'kyc' || !SCREENS[r.name]) return { name: 'home', arg: '' };
    return r;
  }
  function render(keepScroll) {
    var r = resolve(parse()), scr = $('screen'), top = scr.scrollTop;
    if (!keepScroll) { clearTimers(); closeSheet(true); }
    $('device').classList.toggle('has-tabs', !!TABS[r.name]);
    scr.innerHTML = SCREENS[r.name](r.arg);
    scr.scrollTop = keepScroll ? top : 0;
    renderTabs(r.name);
    if (AFTER[r.name]) AFTER[r.name](r.arg);
  }
  function rerender() { clearTimers(); render(true); }

  function renderTabs(active) {
    var items = [['home', 'Home', 'home'], ['pubs', 'Pubs', 'pin'], ['card', 'Card', 'qr'], ['rewards', 'Rewards', 'gift'], ['profile', 'Profile', 'user']];
    $('tabbar').innerHTML = items.map(function (t) {
      var on = active === t[0] ? ' on' : '';
      if (t[0] === 'card') return '<button class="tab tab-card' + on + '" data-go="card"><span class="fab">' + ic('qr', 26) + '</span><span>Card</span></button>';
      return '<button class="tab' + on + '" data-go="' + t[0] + '">' + ic(t[2]) + '<span>' + t[1] + '</span></button>';
    }).join('');
  }

  function openSheet(html) {
    $('sheet').innerHTML = '<div class="sheet-grip"></div>' + html;
    $('sheet').classList.add('open'); $('sheetBackdrop').classList.add('open');
  }
  function closeSheet(force) {
    if (ui.sheetLock && !force) return;
    $('sheet').classList.remove('open'); $('sheetBackdrop').classList.remove('open');
  }
  var toastT;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]');
    if (a && !a.disabled && ACTIONS[a.dataset.act]) { e.preventDefault(); e.stopPropagation(); ACTIONS[a.dataset.act](a); return; }
    var g = e.target.closest('[data-go]');
    if (g && !g.disabled) { e.preventDefault(); go(g.dataset.go); }
  });
  $('sheetBackdrop').addEventListener('click', function () { closeSheet(); });
  window.addEventListener('hashchange', function () { render(); });

  /* ---------- PWA: manifest, service worker, install prompt (http/https only) ---------- */
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; });
  if (/^https?:$/.test(location.protocol)) {
    var lk = document.createElement('link'); lk.rel = 'manifest'; lk.href = 'manifest.json'; document.head.appendChild(lk);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  render();
})();
