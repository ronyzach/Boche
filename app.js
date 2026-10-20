/* ============================================================
   Boche.Club — app.js
   Super-app shell: member app + Business Admin module.
   UI only — every data value is read from data.js (BC_* objects).
   ============================================================ */
(function () {
  'use strict';

  /* ---------- State ----------
     Shared data (members, points, vouchers…) lives in localStorage so the member app and
     the Business Admin module, even in two tabs, see the same world.
     Session (who is signed in on THIS tab) lives in sessionStorage. */
  var LS_KEY = 'bocheclub-shared-v2', SS_KEY = 'bocheclub-session-v2';

  function freshShared() {
    var members = {};
    BC_MEMBERS.forEach(function (m) {
      members[m.id] = JSON.parse(JSON.stringify({ points: m.points, spend: m.spend, vouchers: m.vouchers, checkins: m.checkins, history: m.history }));
    });
    return { members: members, activated: [], reserved: [], bookings: [], notif: { offers: true, events: true, points: true }, staffLog: [] };
  }
  function readJSON(store, key) { try { var j = store.getItem(key); return j ? JSON.parse(j) : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {} }
  function saveSes() { try { sessionStorage.setItem(SS_KEY, JSON.stringify(SES)); } catch (e) {} }
  var S = readJSON(localStorage, LS_KEY) || freshShared();
  var SES = readJSON(sessionStorage, SS_KEY) || { authed: false, kycDone: false, staffId: null, outlet: null };

  var ui = {
    mobile: '', staffMobile: '', kycMethod: BC_KYC.methods[0].id, kycConsent: false,
    exploreFilter: 'all', actTab: 'points', actBiz: 'all', offersTab: 'offers',
    book: null, billAmt: '', sheetLock: false, bizTab: 'rewards'
  };
  function resetBook() { ui.book = { day: 0, time: null, guests: 2, occasion: BC_BOOKING.occasions[0], note: '' }; }
  resetBook();

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
  function biz(id) { return byId(BC_BUSINESSES, id); }
  function outlet(id) { return byId(BC_OUTLETS, id); }
  function liveBiz() { return BC_BUSINESSES.filter(function (b) { return b.live; }); }
  function soonBiz() { return BC_BUSINESSES.filter(function (b) { return !b.live; }); }
  function memberOf(id) { return byId(BC_MEMBERS, id); }
  function dyn(id) { return S.members[id]; }
  function ageOf(dob) {
    var d = new Date(dob), n = new Date(), a = n.getFullYear() - d.getFullYear(), m = n.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
    return a;
  }
  function totalSpend(id) { var s = dyn(id).spend, t = 0; for (var k in s) t += s[k]; return t; }
  function tierBySpend(sp) { var t = BC_TIERS[0]; BC_TIERS.forEach(function (x) { if (sp >= x.minSpend) t = x; }); return t; }
  function tierOfMember(id) { return tierBySpend(totalSpend(id)); }
  function nextTier(t) { return BC_TIERS[BC_TIERS.indexOf(t) + 1] || null; }
  function curTier() { return tierOfMember(BC_MEMBER.id); }
  function pointsOf(id, bizId) { return dyn(id).points[bizId] || 0; }
  function eligible(o, id) {
    if (!o.ageGate) return true;
    return ageOf(memberOf(id || BC_MEMBER.id).dob) >= BC_STATES[o.state].drinkingAge;
  }
  function initials(name) { return name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase(); }
  function greeting() { var h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  function todayLabel() { return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
  function timeLabel() { return new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); }
  function rand(n) { var s = ''; for (var i = 0; i < n; i++) s += 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]; return s; }
  function outletsLabel(o) {
    var b = biz(o.biz);
    return o.outlets === 'all' ? 'All ' + b.name + ' outlets' : o.outlets.map(function (id) { return outlet(id).city; }).filter(function (c, i, a) { return a.indexOf(c) === i; }).join(' · ');
  }
  function addHistory(id, bizId, title, ref, pts) { dyn(id).history.unshift({ biz: bizId, date: todayLabel(), title: title, ref: ref, pts: pts }); }
  function isStandalone() { return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent); }
  function staff() { return byId(BC_STAFF, SES.staffId); }
  function staffOutlet() { var st = staff(); return outlet(SES.outlet && st.outlets.indexOf(SES.outlet) > -1 ? SES.outlet : st.outlets[0]); }
  function earnFor(bizId, tierId, amount) { return Math.floor(amount / 100) * biz(bizId).earn[tierId]; }

  /* ---------- Icons ---------- */
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
    beer: '<path d="M5 8h10v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/><path d="M15 10h2a3 3 0 0 1 0 6h-2"/><path d="M8 3v2M12 3v2"/>',
    bed: '<path d="M2 19V6M2 15h20v4M22 15v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="2"/>',
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/>',
    open: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'
  };
  function ic(n, s) {
    return '<svg class="ic" width="' + (s || 22) + '" height="' + (s || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[n] + '</svg>';
  }
  function icInline(n, s) { return ic(n, s).replace('class="ic"', 'class="ic" style="display:inline;vertical-align:-3px"'); }

  /* ---------- Shared fragments ---------- */
  function topbar(title, parent, right) {
    return '<header class="topbar">' +
      (parent ? '<button class="iconbtn" data-go="' + parent + '" aria-label="Back">' + ic('back') + '</button>' : '') +
      '<h2>' + esc(title) + '</h2>' + (right || '') + '</header>';
  }
  function brandMark() { return 'BOCHE<b>.CLUB</b>'; }
  function cardFront(tierId, extraCls, bare) {
    var t = byId(BC_TIERS, tierId || curTier().id);
    return '<div class="mcard t-' + t.id + (bare ? ' bare ' : ' ') + (extraCls || '') + '">' +
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
      '<div class="qrbox"><div id="qrSvg"></div><span class="qr-logo">B</span></div>' +
      '<div class="mb-info"><div class="mc-label">Member ID</div><div class="mb-id">' + esc(BC_MEMBER.id) + '</div>' +
      '<div class="mb-tier">' + esc(curTier().name) + ' member</div>' +
      '<div class="mb-timer"><svg class="ring" viewBox="0 0 26 26"><circle class="bg" cx="13" cy="13" r="11"/><circle class="fg" id="qrRing" cx="13" cy="13" r="11" stroke-dasharray="' + C + '" stroke-dashoffset="0"/></svg><span><span id="qrCount">30</span>s</span></div>' +
      '<div class="mb-note">Live code · refreshes every 30 s</div></div></div>';
  }
  function eventRow(e) {
    var d = new Date(e.date + 'T00:00:00'), o = outlet(e.outlet);
    return '<button class="event-row" data-go="outlet/' + e.outlet + '">' +
      '<div class="datebox"><b>' + d.getDate() + '</b><span>' + d.toLocaleDateString('en-GB', { month: 'short' }) + '</span></div>' +
      '<div class="li-main"><div class="li-t">' + esc(e.title) + '</div><div class="li-s">' + esc(o.name) + ' · ' + esc(e.time) + '</div>' +
      '<div class="li-s gold-text">' + esc(e.price) + '</div></div>' +
      '<span class="li-chev">' + ic('chev', 18) + '</span></button>';
  }
  function offerCard(o) {
    var on = S.activated.indexOf(o.id) > -1, allowed = o.tiers.indexOf(curTier().id) > -1, b = biz(o.biz);
    var lockTier = byId(BC_TIERS, o.tiers[0]).name;
    return '<div class="surface offer"><div class="chips"><span class="badge">' + esc(o.kind) + '</span><span class="badge plain">' + esc(b.name) + '</span></div>' +
      '<h4>' + esc(o.title) + '</h4><p>' + esc(o.desc) + '</p>' +
      '<div class="offer-foot"><div class="offer-meta">' + esc(outletsLabel(o)) + '<br>' + esc(o.valid) + '</div>' +
      (allowed ? '<button class="btn btn-sm ' + (on ? 'btn-soft' : 'btn-gold') + '" data-act="activate" data-id="' + o.id + '">' + (on ? ic('check', 16) + 'Activated' : 'Activate') + '</button>'
        : '<a class="btn btn-sm btn-line" href="#/tiers">' + ic('lock', 15) + esc(lockTier) + ' & above</a>') + '</div></div>';
  }
  function outletCard(o) {
    var ok = eligible(o), b = biz(o.biz), offers = BC_OFFERS.filter(function (x) { return x.outlets !== 'all' && x.outlets.indexOf(o.id) > -1; });
    return '<div class="surface pubcard" data-go="outlet/' + o.id + '">' +
      '<div class="pub-hero tone-' + o.tone + '"><span class="pub-city">' + esc(o.city) + '</span><span class="pub-rating">' + ic('star', 12) + o.rating + '</span></div>' +
      '<div class="pub-body"><div class="pub-name">' + esc(o.name) + '</div>' +
      '<div class="pub-area">' + ic('pin', 13) + esc(o.area) + ' · ' + esc(o.distance) + '</div>' +
      '<div class="pub-tags"><span class="badge plain">' + ic(b.icon, 12) + esc(o.kind) + '</span>' +
      (o.ageGate ? '<span class="badge plain">' + BC_STATES[o.state].drinkingAge + '+</span>' : '') +
      o.tags.map(function (t) { return '<span class="badge">' + esc(t) + '</span>'; }).join('') + '</div>' +
      (offers.length ? '<div class="pub-offer">' + ic('tag', 15) + esc(offers[0].title) + '</div>' : '') +
      '</div>' + (ok ? '' : '<div class="pub-lock">' + ic('lock', 20) + 'Available from age ' + BC_STATES[o.state].drinkingAge + '</div>') + '</div>';
  }
  function otpBoxes() { var s = ''; for (var i = 0; i < 6; i++) s += '<input inputmode="numeric" maxlength="1" aria-label="Digit ' + (i + 1) + '">'; return s; }

  /* ============================================================
     MEMBER SCREENS
     ============================================================ */
  var SCREENS = {}, AFTER = {};

  SCREENS.welcome = function () {
    return '<div class="welcome">' +
      '<div class="wl-mark">BOCHE.CLUB</div>' +
      '<div class="wl-cards">' + cardFront('classic', 'c1', true) + cardFront('gold', 'c2') + '</div>' +
      '<h1 class="wl-title">' + esc(BC_BRAND.tagline) + '</h1>' +
      '<p class="wl-intro">' + esc(BC_BRAND.intro) + '</p>' +
      '<ul class="wl-points">' + BC_ONBOARD.map(function (o) {
        return '<li><span class="li-ic">' + ic(o.icon, 18) + '</span>' + esc(o.text) + '</li>';
      }).join('') + '</ul>' +
      '<div class="biz-strip">' + BC_BUSINESSES.map(function (b) { return '<span class="badge' + (b.live ? '' : ' plain') + '">' + ic(b.icon, 12) + esc(b.short) + '</span>'; }).join('') + '</div>' +
      '<div class="wl-foot"><button class="btn btn-gold" data-go="login">Join free or sign in</button>' +
      '<p class="fine center">Membership is free and open to adults of legal drinking age — verified once with Aadhaar.</p>' +
      '<button class="stafflink" data-go="staff">' + ic('scan', 15) + ' Business staff sign-in</button>' +
      '<p class="wl-group">A ' + esc(BC_BRAND.group) + ' venture</p></div></div>';
  };

  SCREENS.login = function () {
    return topbar('', 'welcome') + '<div class="auth">' +
      '<h1>Enter your mobile number</h1>' +
      '<p class="lead">We’ll send a one-time password. Your number is your key across every Boche business.</p>' +
      '<div class="field-l">Mobile number</div>' +
      '<div class="phone-field"><span class="cc">+91</span><input id="mobile" type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit number" autocomplete="tel-national" value="' + esc(ui.mobile) + '"></div>' +
      '<div class="err-text" id="mobErr"></div>' +
      '<button class="btn btn-gold mt8" id="sendOtp" data-act="sendOtp" disabled>Send OTP</button>' +
      '<p class="fine center mt16">' + icInline('shield', 14) + ' Next, a one-time Aadhaar check confirms your age.</p></div>';
  };
  function wireMobile(inpId, btnId, errId, onEnter) {
    var inp = $(inpId), btn = $(btnId);
    function check() {
      inp.value = inp.value.replace(/\D/g, '').slice(0, 10);
      btn.disabled = !/^[6-9]\d{9}$/.test(inp.value);
      $(errId).textContent = inp.value.length === 10 && btn.disabled ? 'Enter a valid Indian mobile number' : '';
      return inp.value;
    }
    inp.addEventListener('input', function () { var v = check(); if (inpId === 'mobile') ui.mobile = v; else ui.staffMobile = v; });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !btn.disabled) onEnter(); });
    check(); inp.focus();
  }
  AFTER.login = function () { wireMobile('mobile', 'sendOtp', 'mobErr', function () { ACTIONS.sendOtp(); }); };

  function wireOtp(onFull) {
    var wrap = $('otp'), ins = wrap.querySelectorAll('input'), btn = wrap.parentNode.querySelector('[data-otp-btn]');
    function code() { return Array.prototype.map.call(ins, function (x) { return x.value; }).join(''); }
    Array.prototype.forEach.call(ins, function (inp, i) {
      inp.addEventListener('input', function () {
        var v = inp.value.replace(/\D/g, '');
        if (v.length > 1) { v.split('').slice(0, 6).forEach(function (ch, k) { if (ins[k]) ins[k].value = ch; }); ins[Math.min(5, v.length - 1)].focus(); }
        else { inp.value = v; if (v && ins[i + 1]) ins[i + 1].focus(); }
        wrap.classList.remove('bad'); $('otpErr').textContent = '';
        btn.disabled = code().length !== 6;
        if (code().length === 6) onFull(code());
      });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Backspace' && !inp.value && ins[i - 1]) ins[i - 1].focus(); });
    });
    ins[0].focus();
    var left = 30;
    function tick() {
      var r = $('resend'); if (!r) return;
      if (left > 0) { r.textContent = 'Resend OTP in ' + left + 's'; left--; }
      else r.innerHTML = '<a class="link" href="javascript:void(0)" data-act="resendOtp">Resend OTP</a>';
    }
    tick(); timers.push(setInterval(tick, 1000));
  }
  function otpFail() {
    var ins = $('otp').querySelectorAll('input');
    $('otp').classList.add('bad');
    Array.prototype.forEach.call(ins, function (x) { x.value = ''; }); ins[0].focus();
    $('otp').parentNode.querySelector('[data-otp-btn]').disabled = true;
  }
  function otpScreen(back, mobile, btnAct, extra) {
    return topbar('', back) + '<div class="auth"><h1>Verify OTP</h1>' +
      '<p class="lead">Sent to +91 ' + esc(mobile.replace(/(\d{5})(\d{5})/, '$1 $2')) + ' · <a class="link" href="#/' + back + '">Change</a></p>' +
      '<div class="otp mt24" id="otp">' + otpBoxes() + '</div><div class="err-text" id="otpErr"></div>' +
      '<div class="demo-hint">Demo OTP: <b>' + esc(BC_BRAND.demoOtp) + '</b></div>' +
      (extra || '') +
      '<button class="btn btn-gold mt16" data-otp-btn data-act="' + btnAct + '" disabled>Verify & continue</button>' +
      '<p class="fine center mt16" id="resend"></p></div>';
  }
  SCREENS.otp = function () { return otpScreen('login', ui.mobile, 'verifyOtp'); };
  AFTER.otp = function () { if (!ui.mobile) { go('login'); return; } wireOtp(function () { ACTIONS.verifyOtp(); }); };

  SCREENS.kyc = function () {
    var minAge = Math.min.apply(null, Object.keys(BC_STATES).map(function (k) { return BC_STATES[k].drinkingAge; }));
    return topbar('', '') + '<div class="auth">' +
      '<span class="badge">' + ic('shield', 13) + ' One-time check</span>' +
      '<h1 class="mt12">Verify your age with Aadhaar</h1>' +
      '<p class="lead">Some Boche venues serve alcohol, so we confirm every member meets the legal drinking age (' + minAge + '+). Boche.Club keeps your verified-age flag and shares only the result with each business.</p>' +
      '<div class="age-rule">' + Object.keys(BC_STATES).map(function (k) {
        return '<div><b>' + BC_STATES[k].drinkingAge + '+</b><span>' + esc(BC_STATES[k].name) + ' venues</span></div>';
      }).join('') + '</div>' +
      '<div class="field-l">Verify using</div>' +
      BC_KYC.methods.map(function (m) {
        return '<button class="method' + (ui.kycMethod === m.id ? ' on' : '') + '" data-act="kycMethod" data-id="' + m.id + '"><span class="radio"></span>' +
          '<span class="li-main"><span class="li-t" style="display:block">' + esc(m.title) + (m.recommended ? ' <span class="badge ok">Recommended</span>' : '') + '</span>' +
          '<span class="li-s" style="display:block">' + esc(m.sub) + '</span></span></button>';
      }).join('') +
      '<label class="check mt16"><input type="checkbox" id="kycConsent"' + (ui.kycConsent ? ' checked' : '') + '><span>' + esc(BC_KYC.consent) + '</span></label>' +
      '<button class="btn btn-gold mt24" id="kycGo" data-act="kycStart"' + (ui.kycConsent ? '' : ' disabled') + '>Verify my age</button></div>';
  };
  AFTER.kyc = function () { $('kycConsent').addEventListener('change', function (e) { ui.kycConsent = e.target.checked; $('kycGo').disabled = !ui.kycConsent; }); };

  SCREENS['kyc-done'] = function () {
    var a = ageOf(BC_MEMBER.dob);
    var rows = Object.keys(BC_STATES).map(function (k) {
      var ok = a >= BC_STATES[k].drinkingAge;
      return '<div class="li"><span class="li-ic">' + ic(ok ? 'check' : 'lock', 18) + '</span><div class="li-main"><div class="li-t">' + esc(BC_STATES[k].name) + ' venues</div>' +
        '<div class="li-s">Legal age ' + BC_STATES[k].drinkingAge + '+</div></div><span class="badge ' + (ok ? 'ok' : 'err') + '">' + (ok ? 'Eligible' : 'Not yet') + '</span></div>';
    }).join('');
    return '<div class="auth"><div class="verified-hero"><div class="big-check">' + ic('check', 36) + '</div>' +
      '<h1>You’re verified</h1><p class="lead">Welcome to ' + esc(BC_BRAND.name) + ', ' + esc(BC_MEMBER.firstName) + '.</p></div>' +
      '<div class="list mt16">' +
      '<div class="li"><span class="li-ic">' + ic('user', 18) + '</span><div class="li-main"><div class="li-t">' + esc(BC_MEMBER.name) + '</div><div class="li-s">Aadhaar ' + esc(BC_MEMBER.kyc.aadhaarMasked) + '</div></div></div>' +
      '<div class="li"><span class="li-ic">' + ic('shield', 18) + '</span><div class="li-main"><div class="li-t">Age verified · ' + a + ' years</div><div class="li-s">' + esc(BC_MEMBER.kyc.method) + '</div></div></div>' +
      rows + '</div>' +
      '<p class="fine center mt12">Your Aadhaar number is never stored — only a verified-age flag.</p>' +
      '<button class="btn btn-gold mt24" data-go="home">Go to Boche.Club</button></div>';
  };

  /* ----- Home (hub): flip card + business icons ----- */
  SCREENS.home = function () {
    return '<div class="home-head"><div class="hh-left"><div class="avatar">' + initials(BC_MEMBER.name) + '</div>' +
      '<div><div class="hh-greet">' + greeting() + '</div><div class="hh-name">' + esc(BC_MEMBER.firstName) + '</div></div></div>' +
      '<button class="iconbtn" data-act="notifs" aria-label="Notifications">' + ic('bell') + '<span class="dot"></span></button></div>' +
      '<div class="pad"><div class="flip" id="flip" data-act="flip"><div class="flip-inner"><div class="face front">' + cardFront() + '</div><div class="face back">' + cardBack() + '</div></div></div>' +
      '<p class="hint">Tap the card to flip it · show the QR at any Boche venue</p></div>' +
      '<div class="sec" style="margin-top:8px"><div class="sec-h"><h3>Boche family</h3></div><div class="pad"><div class="launch">' +
      BC_BUSINESSES.map(function (b) {
        return b.live
          ? '<button class="launch-item" data-act="openApp" data-id="' + b.id + '"><span class="launch-ic">' + ic(b.icon, 26) + '</span><b>' + esc(b.name) + '</b></button>'
          : '<button class="launch-item soon-t" data-act="soonBiz" data-id="' + b.id + '"><span class="launch-ic">' + ic(b.icon, 26) + '</span><b>' + esc(b.name) + '</b><span class="soon-tag">Soon</span></button>';
      }).join('') + '</div></div></div>';
  };
  AFTER.home = function () { startQr(); };

  /* ----- Card ----- */
  SCREENS.card = function () {
    var t = curTier(), hp = outlet(BC_MEMBER.homeOutlet);
    return topbar('Membership card', '') + '<div class="pad">' +
      '<div class="flip" id="flip" data-act="flip"><div class="flip-inner"><div class="face front">' + cardFront() + '</div><div class="face back">' + cardBack() + '</div></div></div>' +
      '<p class="hint">Tap the card to flip · show the QR at any Boche venue</p>' +
      '<button class="btn btn-gold" data-act="flip" id="flipBtn">' + ic('qr') + ' Show QR code</button>' +
      '<div class="wallet-row"><button class="wallet-btn" data-act="wallet" data-id="Google Wallet">' + ic('wallet', 18) + ' Google Wallet</button>' +
      '<button class="wallet-btn" data-act="wallet" data-id="Apple Wallet">' + ic('wallet', 18) + ' Apple Wallet</button></div>' +
      '<div class="sec-h" style="padding:0;margin-top:24px"><h3>Card details</h3></div>' +
      '<div class="surface" style="padding:4px 16px">' +
      '<div class="kv"><span>Member ID</span><span>' + esc(BC_MEMBER.id) + '</span></div>' +
      '<div class="kv"><span>Mobile</span><span>+91 ' + esc(BC_MEMBER.mobile) + '</span></div>' +
      '<div class="kv"><span>Tier</span><span>' + esc(t.name) + '</span></div>' +
      '<div class="kv"><span>Member since</span><span>' + esc(BC_MEMBER.memberSince) + '</span></div>' +
      '<div class="kv"><span>Valid thru</span><span>' + esc(BC_MEMBER.validThru) + '</span></div>' +
      '<div class="kv"><span>Home venue</span><span>' + esc(hp.city) + '</span></div>' +
      '<div class="kv"><span>Age verification</span><span class="pos">Verified</span></div></div>' +
      '<div class="sec-h" style="padding:0;margin-top:24px"><h3>How it works</h3></div>' +
      '<ol class="howto"><li>Show your QR at a pub door, resort desk, restaurant or store.</li>' +
      '<li>Staff scan it with the Boche.Club business app — your identity, tier and age check are confirmed instantly.</li>' +
      '<li>Whatever you buy, the business adds its points to your mobile number automatically.</li></ol></div>';
  };
  function startQr() {
    var left = 30, C = 2 * Math.PI * 11;
    function draw() { $('qrSvg').innerHTML = BCQR.svg(BC_MEMBER.id + ':' + Math.floor(Date.now() / 30000), 200); left = 30 - Math.floor((Date.now() % 30000) / 1000); }
    function tick() {
      if (!$('qrCount')) return;
      left--; if (left <= 0) draw();
      $('qrCount').textContent = left; $('qrRing').style.strokeDashoffset = (C * (1 - left / 30)).toFixed(2);
    }
    draw(); $('qrCount').textContent = left; timers.push(setInterval(tick, 1000));
  }
  AFTER.card = function () { startQr(); };

  /* ----- Explore (all outlets) ----- */
  SCREENS.explore = function () {
    var f = ui.exploreFilter, list = BC_OUTLETS.filter(function (o) { return f === 'all' || o.biz === f; });
    return topbar('Explore', '') + '<div class="pad">' +
      '<p class="sub">Your card works at every Boche venue below.</p>' +
      '<div class="chips scroll-x" style="margin-bottom:14px"><button class="chip' + (f === 'all' ? ' on' : '') + '" data-act="exploreFilter" data-id="all">All</button>' +
      liveBiz().map(function (b) { return '<button class="chip' + (f === b.id ? ' on' : '') + '" data-act="exploreFilter" data-id="' + b.id + '">' + esc(b.name) + '</button>'; }).join('') + '</div>' +
      list.map(outletCard).join('') +
      '<div class="sec-h" style="padding:0;margin-top:8px"><h3>Coming soon</h3></div><div class="biz-grid">' +
      soonBiz().map(function (b) {
        return '<button class="biz-tile soon-t" data-act="soonBiz" data-id="' + b.id + '"><span class="badge plain">Coming soon</span><span class="li-ic">' + ic(b.icon, 20) + '</span><b>' + esc(b.name) + '</b><span class="bt-sub">' + esc(b.blurb) + '</span></button>';
      }).join('') + '</div></div>';
  };

  /* ----- Business page ----- */
  SCREENS.biz = function (id) {
    var b = biz(id); if (!b || !b.live) return SCREENS.home();
    var pts = pointsOf(BC_MEMBER.id, b.id), t = curTier(), tab = ui.bizTab;
    var myV = dyn(BC_MEMBER.id).vouchers.filter(function (v) { return v.biz === b.id && !v.used; });
    var body;
    if (tab === 'rewards') {
      body = BC_REWARDS.filter(function (r) { return r.biz === b.id; }).map(function (r) {
        var can = pts >= r.pts;
        return '<div class="reward"><span class="li-ic">' + ic(r.icon, 18) + '</span><div class="li-main"><div class="li-t">' + esc(r.title) + '</div>' +
          '<div class="li-s">' + esc(r.cat) + ' · <span class="pts">' + num(r.pts) + ' pts</span></div></div>' +
          '<button class="btn btn-sm ' + (can ? 'btn-soft' : 'btn-line') + '" data-act="redeem" data-id="' + r.id + '"' + (can ? '' : ' disabled') + '>Redeem</button></div>';
      }).join('');
      body = '<div class="list">' + body + '</div>';
    } else if (tab === 'outlets') {
      body = BC_OUTLETS.filter(function (o) { return o.biz === b.id; }).map(outletCard).join('');
    } else {
      var os = BC_OFFERS.filter(function (o) { return o.biz === b.id; });
      body = os.map(offerCard).join('');
    }
    return topbar(b.name, 'home') + '<div class="pad">' +
      '<div class="pts-hero"><div class="k">' + esc(b.short) + ' points</div><div class="row"><div><div class="v">' + num(pts) + '</div>' +
      '<div class="s">Worth ' + inr(pts * b.rupeeValue) + ' at ' + esc(b.name) + '</div></div>' +
      '<span class="btn btn-sm" style="background:rgba(255,255,255,.55);color:#2E2108">' + ic('crown', 16) + esc(t.name) + ' · ' + b.earn[t.id] + ' pts/₹100</span></div></div>' +
      (b.expiring && b.expiring.points ? '<div class="alert">' + ic('clock', 18) + '<span><b>' + num(b.expiring.points) + ' points</b> expire on ' + esc(b.expiring.date) + '.</span></div>' : '') +
      '<p class="fine">Points are earned and redeemed only at ' + esc(b.name) + ' · min ' + num(b.minRedeem) + ' pts · valid ' + b.expiryMonths + ' months.</p>' +
      '<button class="btn btn-gold mt16" data-act="openApp" data-id="' + b.id + '">' + ic('open', 18) + ' Open ' + esc(b.appName) + '</button>' +
      '<p class="fine center">Signs you in automatically with your Boche.Club identity.</p>' +
      (myV.length ? '<div class="sec-h" style="padding:0;margin-top:20px"><h3>Your vouchers</h3></div>' + myV.map(function (v) {
        return '<div class="voucher"><div class="li-t">' + esc(v.title) + '</div><div class="code">' + esc(v.code) + '</div><div class="li-s">Show at the counter · issued ' + esc(v.date) + '</div></div>';
      }).join('') : '') +
      '<div class="seg mt24"><button class="' + (tab === 'rewards' ? 'on' : '') + '" data-act="bizTab" data-id="rewards">Rewards</button>' +
      '<button class="' + (tab === 'outlets' ? 'on' : '') + '" data-act="bizTab" data-id="outlets">Venues</button>' +
      '<button class="' + (tab === 'offers' ? 'on' : '') + '" data-act="bizTab" data-id="offers">Offers</button></div>' +
      '<div class="mt16">' + body + '</div></div>';
  };

  /* ----- Outlet ----- */
  SCREENS.outlet = function (id) {
    var o = outlet(id); if (!o) return SCREENS.explore();
    var b = biz(o.biz), ok = eligible(o), offers = BC_OFFERS.filter(function (x) { return x.outlets === 'all' ? x.biz === o.biz : x.outlets.indexOf(o.id) > -1; });
    var events = BC_EVENTS.filter(function (e) { return e.outlet === o.id; });
    return topbar(o.city, 'explore') +
      '<div class="pub-hero detail-hero tone-' + o.tone + '"><span class="pub-city">' + esc(o.name) + '</span><span class="pub-rating">' + ic('star', 12) + o.rating + '</span></div>' +
      '<div class="pad mt16"><div class="list">' +
      '<div class="li"><span class="li-ic">' + ic('pin', 18) + '</span><div class="li-main"><div class="li-t">' + esc(o.area) + '</div><div class="li-s">' + esc(o.city) + ', ' + esc(BC_STATES[o.state].name) + ' · ' + esc(o.distance) + ' away</div></div></div>' +
      '<div class="li"><span class="li-ic">' + ic('clock', 18) + '</span><div class="li-main"><div class="li-t">' + esc(o.hours) + '</div><div class="li-s">' + esc(o.kind) + ' · part of ' + esc(b.name) + '</div></div></div>' +
      '<div class="li"><span class="li-ic">' + ic('phone', 18) + '</span><div class="li-main"><div class="li-t">' + esc(o.phone) + '</div><div class="li-s">Call for groups and enquiries</div></div></div>' +
      '<div class="li"><span class="li-ic">' + ic('shield', 18) + '</span><div class="li-main"><div class="li-t">' + (o.ageGate ? 'Entry ' + BC_STATES[o.state].drinkingAge + '+' : 'All ages welcome') + '</div><div class="li-s">' +
      (o.ageGate ? (ok ? 'You’re eligible — age verified' : 'Not available for your age') : 'No age restriction') + '</div></div></div>' +
      '<div class="li"><span class="li-ic">' + ic('qr', 18) + '</span><div class="li-main"><div class="li-t">' + esc(o.checkinLabel) + ' with your card</div><div class="li-s">Staff scan your Boche.Club QR</div></div></div></div>' +
      '<div class="pub-tags mt12">' + o.tags.map(function (t) { return '<span class="badge">' + esc(t) + '</span>'; }).join('') + '</div>' +
      (offers.length ? '<div class="sec-h" style="padding:0;margin-top:22px"><h3>Offers</h3></div>' + offers.map(offerCard).join('') : '') +
      (events.length ? '<div class="sec-h" style="padding:0;margin-top:22px"><h3>Events</h3></div><div class="list">' + events.map(eventRow).join('') + '</div>' : '') +
      '</div>' +
      (ok ? '<div class="sticky-cta"><div class="' + (o.bookable ? 'btn-row' : '') + '">' +
        '<button class="btn btn-line" data-act="openApp" data-id="' + b.id + '">' + ic('open', 16) + 'Open app</button>' +
        (o.bookable ? '<button class="btn btn-gold" data-go="book/' + o.id + '">Book a table</button>' : '') + '</div></div>' : '');
  };

  /* ----- Book a table ----- */
  SCREENS.book = function (id) {
    var o = outlet(id); if (!o || !o.bookable || !eligible(o)) return SCREENS.explore();
    var b = ui.book, days = [], d;
    for (var i = 0; i < 7; i++) { d = new Date(); d.setDate(d.getDate() + i); days.push(d); }
    var priority = curTier().id !== 'classic';
    return topbar('Book a table', 'outlet/' + o.id) + '<div class="pad">' +
      '<p class="sub">' + esc(o.name) + ' · ' + esc(o.area) + '</p>' +
      (priority ? '<div class="alert" style="margin-top:0">' + ic('crown', 18) + '<span>' + esc(curTier().name) + ' members get priority confirmation.</span></div>' : '') +
      '<div class="field-l">Date</div><div class="chips scroll-x">' + days.map(function (dd, k) {
        var lbl = k === 0 ? 'Today' : k === 1 ? 'Tomorrow' : dd.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
        return '<button class="chip' + (b.day === k ? ' on' : '') + '" data-act="bookDay" data-id="' + k + '">' + lbl + '</button>';
      }).join('') + '</div>' +
      '<div class="field-l">Time</div><div class="chips">' + BC_BOOKING.times.map(function (t) {
        return '<button class="chip' + (b.time === t ? ' on' : '') + '" data-act="bookTime" data-id="' + esc(t) + '">' + esc(t) + '</button>';
      }).join('') + '</div>' +
      '<div class="field-l">Guests</div><div class="stepper"><button data-act="guests" data-id="-1" aria-label="Fewer">' + ic('minus', 18) + '</button><span class="v">' + b.guests + '</span><button data-act="guests" data-id="1" aria-label="More">' + ic('plus', 18) + '</button></div>' +
      '<div class="field-l">Occasion</div><div class="chips">' + BC_BOOKING.occasions.map(function (oc) {
        return '<button class="chip' + (b.occasion === oc ? ' on' : '') + '" data-act="bookOcc" data-id="' + esc(oc) + '">' + esc(oc) + '</button>';
      }).join('') + '</div>' +
      '<div class="field-l">Note for the team (optional)</div><textarea class="input" id="bookNote" placeholder="e.g. window seat, cake arrangement">' + esc(b.note) + '</textarea>' +
      '<button class="btn btn-gold mt24" data-act="confirmBook" data-id="' + o.id + '"' + (b.time ? '' : ' disabled') + '>Confirm booking</button></div>';
  };
  AFTER.book = function () { var n = $('bookNote'); if (n) n.addEventListener('input', function () { ui.book.note = n.value; }); };

  /* ----- Child app (SSO simulation) ----- */
  SCREENS.app = function (id) {
    var b = biz(id); if (!b || !b.live) return SCREENS.home();
    return '<div class="childapp"><div class="ca-head"><span class="ca-ic">' + ic(b.icon, 22) + '</span><div><div class="ca-t">' + esc(b.name) + '</div><div class="ca-s">' + esc(b.appName) + '</div></div></div>' +
      '<div class="ca-bar">' + ic('shield', 15) + ' Signed in as <b>' + esc(BC_MEMBER.name) + '</b> · +91 ' + esc(BC_MEMBER.mobile) + ' · via Boche.Club</div></div>' +
      '<div class="pad mt16"><div class="list">' + b.appMenu.map(function (m) {
        return '<button class="li" data-act="childItem" data-id="' + esc(m.title) + '"><span class="li-ic">' + ic(m.icon, 18) + '</span><div class="li-main"><div class="li-t">' + esc(m.title) + '</div><div class="li-s">' + esc(m.sub) + '</div></div><span class="li-chev">' + ic('chev', 18) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="surface mt16" style="padding:4px 16px"><div class="kv"><span>Your ' + esc(b.short) + ' points</span><span>' + num(pointsOf(BC_MEMBER.id, b.id)) + '</span></div>' +
      '<div class="kv"><span>Tier</span><span>' + esc(curTier().name) + '</span></div></div>' +
      '<p class="fine center mt12">Prototype: this is where ' + esc(b.name) + '’s own application opens, already signed in. Bills raised here add points to your mobile number.</p>' +
      '<button class="btn btn-line mt16" data-go="biz/' + b.id + '">' + ic('gift', 18) + ' Points, rewards & venues</button>' +
      '<button class="btn btn-gold mt12" data-go="home">' + ic('back', 18) + ' Back to Boche.Club</button></div>';
  };

  /* ----- Activity ----- */
  SCREENS.activity = function () {
    var tab = ui.actTab, d = dyn(BC_MEMBER.id), body;
    if (tab === 'points') {
      var rows = d.history.filter(function (h) { return ui.actBiz === 'all' || h.biz === ui.actBiz; });
      body = '<div class="chips scroll-x mt12"><button class="chip' + (ui.actBiz === 'all' ? ' on' : '') + '" data-act="actBiz" data-id="all">All</button>' +
        liveBiz().map(function (b) { return '<button class="chip' + (ui.actBiz === b.id ? ' on' : '') + '" data-act="actBiz" data-id="' + b.id + '">' + esc(b.short) + ' · ' + num(pointsOf(BC_MEMBER.id, b.id)) + '</button>'; }).join('') + '</div>' +
        '<div class="list mt12">' + (rows.length ? rows.map(function (h) {
          return '<div class="li"><span class="li-ic">' + ic(h.pts > 0 ? 'plus' : 'minus', 16) + '</span><div class="li-main"><div class="li-t">' + esc(h.title) + '</div><div class="li-s">' + esc(biz(h.biz).short) + ' · ' + esc(h.date) + ' · ' + esc(h.ref) + '</div></div>' +
            '<span class="li-r ' + (h.pts > 0 ? 'pos' : 'neg') + '">' + (h.pts > 0 ? '+' : '−') + num(Math.abs(h.pts)) + '</span></div>';
        }).join('') : '<div class="li"><div class="li-main li-s">No activity yet</div></div>') + '</div>';
    } else if (tab === 'checkins') {
      body = '<div class="list mt12">' + (d.checkins.length ? d.checkins.map(function (c) {
        var o = outlet(c.outlet);
        return '<div class="li"><span class="li-ic">' + ic('qr', 18) + '</span><div class="li-main"><div class="li-t">' + esc(o.name) + '</div><div class="li-s">' + esc(o.checkinLabel) + ' · ' + esc(c.date) + ', ' + esc(c.time) + '</div></div><span class="badge ok">Verified</span></div>';
      }).join('') : '<div class="li"><div class="li-main li-s">No check-ins yet</div></div>') + '</div>';
    } else {
      body = '<div class="mt12">' + (d.vouchers.length ? d.vouchers.map(function (v) {
        return '<div class="voucher"' + (v.used ? ' style="opacity:.55"' : '') + '><div class="chips"><span class="badge plain">' + esc(biz(v.biz).short) + '</span>' + (v.used ? '<span class="badge">Used</span>' : '<span class="badge ok">Active</span>') + '</div>' +
          '<div class="li-t mt8">' + esc(v.title) + '</div><div class="code">' + esc(v.code) + '</div><div class="li-s">Issued ' + esc(v.date) + '</div></div>';
      }).join('') : '<div class="surface center" style="padding:28px 16px"><div class="li-ic" style="margin:0 auto 10px">' + ic('gift', 18) + '</div><div class="li-t">No vouchers yet</div><div class="li-s">Redeem a reward in any business.</div></div>') + '</div>';
    }
    return topbar('Activity', '') + '<div class="pad"><div class="seg">' +
      [['points', 'Points'], ['checkins', 'Check-ins'], ['vouchers', 'Vouchers']].map(function (t) { return '<button class="' + (tab === t[0] ? 'on' : '') + '" data-act="actTab" data-id="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' + body + '</div>';
  };

  /* ----- Tiers (ecosystem spend) ----- */
  SCREENS.tiers = function () {
    var cur = curTier(), id = BC_MEMBER.id, sp = dyn(id).spend, total = totalSpend(id);
    return topbar('Membership tiers', 'home') + '<div class="pad">' +
      '<p class="sub">Membership is free. Your tier is earned from what you spend across the whole Boche family and applies at every business.</p>' +
      '<div class="surface" style="padding:4px 16px"><div class="field-l" style="margin:12px 0 4px">Your spend this year</div>' +
      BC_BUSINESSES.map(function (b) { return '<div class="kv"><span>' + esc(b.name) + '</span><span>' + (b.live ? inr(sp[b.id] || 0) : 'Coming soon') + '</span></div>'; }).join('') +
      '<div class="kv total"><span>Total</span><span>' + inr(total) + '</span></div></div>' +
      '<div class="mt16">' + BC_TIERS.map(function (t) {
        var isCur = t.id === cur.id, reached = total >= t.minSpend;
        return '<div class="tier-card t-' + t.id + (isCur ? ' current' : '') + '"><div class="tc-head"><span class="tc-name">' + esc(t.name) + '</span><span class="tc-price">' + (t.minSpend ? inr(t.minSpend) + ' spend' : 'Everyone') + '</span></div>' +
          '<ul class="perks">' + t.perks.map(function (p) { return '<li>' + ic('check', 16) + esc(p) + '</li>'; }).join('') + '</ul>' +
          '<div class="chips">' + liveBiz().map(function (b) { return '<span class="badge plain">' + esc(b.short) + ' · ' + b.earn[t.id] + ' pts/₹100</span>'; }).join('') + '</div>' +
          '<div class="mt12">' + (isCur ? '<span class="badge ok">' + ic('check', 12) + 'Your current tier</span>' : reached ? '<span class="badge">Reached</span>' : '<span class="badge plain">' + inr(t.minSpend - total) + ' to go</span>') + '</div></div>';
      }).join('') + '</div></div>';
  };

  /* ----- Offers & events ----- */
  SCREENS.offers = function () {
    var tab = ui.offersTab, body;
    if (tab === 'offers') body = BC_OFFERS.map(offerCard).join('');
    else body = BC_EVENTS.map(function (e) {
      var d = new Date(e.date + 'T00:00:00'), res = S.reserved.indexOf(e.id) > -1, o = outlet(e.outlet), ok = eligible(o);
      return '<div class="surface offer" style="display:flex;gap:14px"><div class="datebox"><b>' + d.getDate() + '</b><span>' + d.toLocaleDateString('en-GB', { month: 'short' }) + '</span></div>' +
        '<div class="li-main"><div class="li-t" style="font-size:15px">' + esc(e.title) + '</div><div class="li-s">' + esc(o.name) + ' · ' + esc(e.time) + ' · ' + e.seats + ' seats left</div>' +
        '<div class="li-s gold-text" style="margin-top:4px">' + esc(e.price) + '</div>' +
        '<button class="btn btn-sm mt12 ' + (res ? 'btn-soft' : 'btn-gold') + '" data-act="reserve" data-id="' + e.id + '"' + (ok ? '' : ' disabled') + '>' + (res ? ic('check', 16) + 'Reserved' : ok ? 'Reserve a spot' : 'Age restricted') + '</button></div></div>';
    }).join('');
    return topbar('Offers & events', 'home') + '<div class="pad">' +
      '<div class="seg"><button class="' + (tab === 'offers' ? 'on' : '') + '" data-act="offersTab" data-id="offers">Offers</button><button class="' + (tab === 'events' ? 'on' : '') + '" data-act="offersTab" data-id="events">Events</button></div>' +
      '<p class="fine" style="margin-bottom:12px">Activated offers apply when staff scan your card at the venue.</p>' + body + '</div>';
  };

  /* ----- Profile ----- */
  SCREENS.profile = function () {
    var t = curTier();
    function tg(k, label, sub) {
      return '<div class="li"><div class="li-main"><div class="li-t">' + label + '</div><div class="li-s">' + sub + '</div></div><button class="toggle' + (S.notif[k] ? ' on' : '') + '" data-act="notif" data-id="' + k + '" aria-label="' + label + '"></button></div>';
    }
    function row(icn, title, sub, act, extra) {
      return '<button class="li" ' + act + '><span class="li-ic">' + ic(icn, 18) + '</span><div class="li-main"><div class="li-t">' + title + '</div>' + (sub ? '<div class="li-s">' + sub + '</div>' : '') + '</div>' + (extra == null ? '<span class="li-chev">' + ic('chev', 18) + '</span>' : extra) + '</button>';
    }
    return topbar('Profile', '') +
      '<div class="prof-head"><div class="avatar">' + initials(BC_MEMBER.name) + '</div><div><div class="prof-name">' + esc(BC_MEMBER.name) + '</div>' +
      '<div class="li-s">' + esc(BC_MEMBER.id) + '</div><span class="badge mt8">' + ic('crown', 12) + esc(t.name) + ' member</span></div></div>' +
      '<div class="pad"><div class="field-l" style="margin-top:0">Account</div><div class="list">' +
      row('phone', '+91 ' + esc(BC_MEMBER.mobile), 'Mobile · your key across all Boche businesses', 'disabled', '<span class="badge ok">Verified</span>') +
      row('doc', esc(BC_MEMBER.email), 'Email', 'disabled', '') +
      row('shield', 'Aadhaar ' + esc(BC_MEMBER.kyc.aadhaarMasked), 'Age verified · ' + esc(BC_MEMBER.kyc.verifiedOn), 'disabled', '<span class="badge ok">Verified</span>') +
      row('crown', 'Membership tier', esc(t.name) + ' · earned from spend', 'data-go="tiers"') + '</div>' +
      '<div class="field-l">My bookings</div><div class="list">' + (S.bookings.length ? S.bookings.map(function (b) {
        return '<div class="li"><span class="li-ic">' + ic('calendar', 18) + '</span><div class="li-main"><div class="li-t">' + esc(b.outlet) + '</div><div class="li-s">' + esc(b.when) + ' · ' + b.guests + ' guests · ' + esc(b.ref) + '</div></div><span class="badge ok">Confirmed</span></div>';
      }).join('') : '<div class="li"><span class="li-ic">' + ic('calendar', 18) + '</span><div class="li-main"><div class="li-t">No upcoming bookings</div><div class="li-s">Book a table from any venue page</div></div></div>') + '</div>' +
      '<div class="field-l">Notifications</div><div class="list">' +
      tg('offers', 'Offers & promotions', 'Deals across the Boche family') + tg('events', 'Events', 'Live nights and member events') + tg('points', 'Points activity', 'Earn, redeem and expiry alerts') + '</div>' +
      '<div class="field-l">App</div><div class="list">' +
      (isStandalone() ? '' : row('download', 'Install app', 'Add to your home screen', 'data-act="install"')) +
      row('help', 'Help & support', esc(BC_BRAND.supportPhone) + ' · ' + esc(BC_BRAND.supportEmail), 'data-act="support"') +
      row('scan', 'Business staff sign-in', 'For Boche business staff only', 'data-go="staff"') +
      row('refresh', 'Reset demo', 'Start the prototype from the beginning', 'data-act="resetDemo"', '') +
      row('logout', 'Log out', '', 'data-act="logout"', '') + '</div>' +
      '<p class="group-foot">' + esc(BC_BRAND.name) + ' · ' + esc(BC_BRAND.group) + '</p></div>';
  };

  /* ============================================================
     BUSINESS ADMIN MODULE (staff)
     ============================================================ */
  SCREENS.staff = function () {
    var hint = BC_STAFF.map(function (s) { return '<div>' + esc(s.name) + ' · ' + esc(biz(s.biz).name) + ' — <b>' + esc(s.mobile) + '</b></div>'; }).join('');
    return topbar('', 'welcome') + '<div class="auth"><span class="badge">' + ic('scan', 13) + ' Boche business app</span>' +
      '<h1 class="mt12">Business sign-in</h1><p class="lead">For staff at Boche venues. Verify members, check them in and post bills.</p>' +
      '<div class="field-l">Staff mobile number</div>' +
      '<div class="phone-field"><span class="cc">+91</span><input id="smobile" type="tel" inputmode="numeric" maxlength="10" placeholder="10-digit number" value="' + esc(ui.staffMobile) + '"></div>' +
      '<div class="err-text" id="smobErr"></div>' +
      '<button class="btn btn-gold mt8" id="sendStaffOtp" data-act="sendStaffOtp" disabled>Send OTP</button>' +
      '<div class="demo-hint">Demo staff<br>' + hint + '</div></div>';
  };
  AFTER.staff = function () { wireMobile('smobile', 'sendStaffOtp', 'smobErr', function () { ACTIONS.sendStaffOtp(); }); };

  SCREENS['staff-otp'] = function () { return otpScreen('staff', ui.staffMobile, 'verifyStaffOtp'); };
  AFTER['staff-otp'] = function () { if (!ui.staffMobile) { go('staff'); return; } wireOtp(function () { ACTIONS.verifyStaffOtp(); }); };

  function staffHead() {
    var st = staff(), b = biz(st.biz);
    return '<div class="staff-head"><span class="ca-ic">' + ic(b.icon, 22) + '</span><div class="li-main"><div class="ca-t">' + esc(b.name) + '</div><div class="ca-s">' + esc(st.name) + ' · ' + esc(st.role) + '</div></div>' +
      '<button class="iconbtn" data-act="staffLogout" aria-label="Sign out">' + ic('logout') + '</button></div>';
  }
  function outletChips() {
    var st = staff(), cur = staffOutlet();
    return '<div class="chips scroll-x">' + st.outlets.map(function (id) {
      return '<button class="chip' + (id === cur.id ? ' on' : '') + '" data-act="staffOutlet" data-id="' + id + '">' + esc(outlet(id).name.replace(/^Boche Pub /, '').replace(/^1000 Acre /, '')) + '</button>';
    }).join('') + '</div>';
  }

  SCREENS.scan = function () {
    var st = staff(), o = staffOutlet(), log = S.staffLog.filter(function (l) { return l.biz === st.biz; }).slice(0, 6);
    return staffHead() + '<div class="pad"><div class="field-l" style="margin-top:16px">Working at</div>' + outletChips() +
      '<div class="rule-note mt12">' + ic('shield', 16) + '<span>' + (o.ageGate ? esc(o.name) + ' requires age <b>' + BC_STATES[o.state].drinkingAge + '+</b> (' + esc(BC_STATES[o.state].name) + ').' : esc(o.name) + ' has no age restriction.') + '</span></div>' +
      '<div class="scanner mt16"><div class="sc-frame"><i></i><span class="sc-line"></span></div><p>' + esc(BC_STAFF_UI.scanHint) + '</p></div>' +
      '<div class="field-l">Demo: simulate scanning a member</div><div class="list">' + BC_MEMBERS.map(function (m) {
        var t = tierOfMember(m.id);
        return '<button class="li" data-go="verify/' + m.id + '"><span class="avatar" style="width:38px;height:38px;border-radius:12px;font-size:13px">' + initials(m.name) + '</span>' +
          '<div class="li-main"><div class="li-t">' + esc(m.name) + '</div><div class="li-s">Age ' + ageOf(m.dob) + ' · ' + esc(t.name) + '</div></div><span class="li-chev">' + ic('chev', 18) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="field-l">Or find by mobile number</div><div class="inline-field"><input id="lookup" class="input" inputmode="numeric" maxlength="10" placeholder="10-digit mobile"><button class="btn btn-line btn-sm" data-act="lookup">Find</button></div>' +
      '<div class="err-text" id="lookErr"></div>' +
      '<div class="field-l">Recent activity</div><div class="list">' + (log.length ? log.map(function (l) {
        return '<div class="li"><span class="li-ic">' + ic(l.icon, 16) + '</span><div class="li-main"><div class="li-t">' + esc(l.text) + '</div><div class="li-s">' + esc(l.member) + ' · ' + esc(l.outlet) + ' · ' + esc(l.time) + '</div></div></div>';
      }).join('') : '<div class="li"><div class="li-main li-s">Nothing yet today</div></div>') + '</div></div>';
  };
  AFTER.scan = function () { var l = $('lookup'); if (l) l.addEventListener('input', function () { l.value = l.value.replace(/\D/g, ''); }); };

  SCREENS.verify = function (id) {
    var m = memberOf(id); if (!m) return SCREENS.scan();
    var st = staff(), o = staffOutlet(), b = biz(st.biz), d = dyn(id), a = ageOf(m.dob), t = tierOfMember(id);
    var ok = eligible(o, id), need = o.ageGate ? BC_STATES[o.state].drinkingAge : null;
    var checked = ui.checkedIn === id + o.id;
    var vs = d.vouchers.filter(function (v) { return v.biz === b.id && !v.used; });
    var h = topbar('Verify member', 'scan');
    h += '<div class="pad">' +
      '<div class="verdict ' + (ok ? 'allow' : 'deny') + '"><span class="vd-ic">' + ic(ok ? 'check' : 'x', 30) + '</span><div><div class="vd-t">' + (ok ? 'Allowed' : 'Not allowed') + '</div>' +
      '<div class="vd-s">' + (ok ? (o.ageGate ? 'Age ' + a + ' · meets ' + need + '+ at ' + esc(o.name) : 'Verified member · ' + esc(o.name)) : 'Age ' + a + ' · ' + esc(BC_STATES[o.state].name) + ' requires ' + need + '+ at ' + esc(o.name)) + '</div></div></div>' +
      '<div class="surface mt16" style="padding:14px 16px"><div class="hh-left"><div class="avatar">' + initials(m.name) + '</div><div class="li-main"><div class="prof-name" style="font-size:19px">' + esc(m.name) + '</div>' +
      '<div class="li-s">' + esc(m.id) + ' · +91 ' + esc(m.mobile) + '</div></div><span class="badge">' + ic('crown', 12) + esc(t.name) + '</span></div>' +
      '<div class="kv mt12"><span>Identity</span><span class="pos">Verified · OTP + Aadhaar</span></div>' +
      '<div class="kv"><span>Age</span><span>' + a + ' years</span></div>' +
      '<div class="kv"><span>' + esc(b.short) + ' points</span><span>' + num(pointsOf(id, b.id)) + '</span></div>' +
      '<div class="kv"><span>Earn rate here</span><span>' + b.earn[t.id] + ' pts per ₹100</span></div></div>';
    if (ok) {
      h += '<button class="btn ' + (checked ? 'btn-soft' : 'btn-gold') + ' mt16" data-act="checkin" data-id="' + m.id + '"' + (checked ? ' disabled' : '') + '>' + (checked ? ic('check', 18) + ' Checked in' : ic('qr', 18) + ' ' + esc(o.checkinLabel) + ' · check in') + '</button>';
      h += '<div class="field-l">Post a bill — credits ' + esc(b.short) + ' points</div>' +
        '<div class="inline-field"><div class="phone-field" style="flex:1"><span class="cc">₹</span><input id="billAmt" inputmode="numeric" maxlength="7" placeholder="Bill amount" value="' + esc(ui.billAmt) + '"></div>' +
        '<button class="btn btn-gold btn-sm" id="postBill" data-act="postBill" data-id="' + m.id + '" disabled>Post</button></div>' +
        '<p class="fine" id="billPts">Enter the bill amount to see the points.</p>';
      if (vs.length) {
        h += '<div class="field-l">Member’s active vouchers</div>' + vs.map(function (v) {
          return '<div class="voucher"><div class="li-t">' + esc(v.title) + '</div><div class="code">' + esc(v.code) + '</div>' +
            '<button class="btn btn-soft btn-sm mt8" data-act="useVoucher" data-id="' + esc(v.code) + '" data-mem="' + m.id + '">Mark as redeemed</button></div>';
        }).join('');
      }
    } else {
      h += '<p class="fine center mt16">Entry should be declined. No bill can be posted for this member at this outlet.</p>';
    }
    return h + '</div>';
  };
  AFTER.verify = function (id) {
    var inp = $('billAmt'); if (!inp) return;
    var m = memberOf(id), b = biz(staff().biz);
    function upd() {
      inp.value = inp.value.replace(/\D/g, ''); ui.billAmt = inp.value;
      var amt = +inp.value, ok = amt >= BC_STAFF_UI.minBill, t = tierOfMember(id);
      $('postBill').disabled = !ok;
      $('billPts').innerHTML = ok ? 'Credits <b class="gold-text">' + num(earnFor(b.id, t.id, amt)) + ' ' + esc(b.short) + ' points</b> (' + t.name + ' · ' + b.earn[t.id] + ' per ₹100) and adds ' + inr(amt) + ' to the member’s tier spend.' : 'Enter the bill amount (min ' + inr(BC_STAFF_UI.minBill) + ') to see the points.';
    }
    inp.addEventListener('input', upd); upd();
  };

  /* ============================================================
     ACTIONS
     ============================================================ */
  var ACTIONS = {
    sendOtp: function () { if (/^[6-9]\d{9}$/.test(ui.mobile)) go('otp'); },
    sendStaffOtp: function () {
      var s = BC_STAFF.filter(function (x) { return x.mobile === ui.staffMobile; })[0];
      if (!s) { $('smobErr').textContent = 'This number is not registered as Boche business staff.'; return; }
      go('staff-otp');
    },
    resendOtp: function () { toast('OTP resent'); rerender(); },
    verifyOtp: function () {
      var code = Array.prototype.map.call($('otp').querySelectorAll('input'), function (x) { return x.value; }).join('');
      if (code === BC_BRAND.demoOtp) { SES.authed = true; saveSes(); go(SES.kycDone ? 'home' : 'kyc'); }
      else { $('otpErr').textContent = 'Incorrect OTP. Please try again.'; otpFail(); }
    },
    verifyStaffOtp: function () {
      var code = Array.prototype.map.call($('otp').querySelectorAll('input'), function (x) { return x.value; }).join('');
      var s = BC_STAFF.filter(function (x) { return x.mobile === ui.staffMobile; })[0];
      if (code === BC_BRAND.demoOtp && s) { SES.staffId = s.id; SES.outlet = s.outlets[0]; saveSes(); go('scan'); }
      else { $('otpErr').textContent = 'Incorrect OTP. Please try again.'; otpFail(); }
    },
    staffOutlet: function (el) { SES.outlet = el.dataset.id; saveSes(); rerender(); },
    staffLogout: function () { SES.staffId = null; saveSes(); ui.staffMobile = ''; go('welcome'); },
    lookup: function () {
      var v = $('lookup').value, m = BC_MEMBERS.filter(function (x) { return x.mobile.replace(/\s/g, '') === v; })[0];
      if (!m) { $('lookErr').textContent = 'No Boche.Club member with this number.'; return; }
      go('verify/' + m.id);
    },
    checkin: function (el) {
      var m = memberOf(el.dataset.id), o = staffOutlet(), st = staff();
      dyn(m.id).checkins.unshift({ outlet: o.id, date: todayLabel(), time: timeLabel() });
      S.staffLog.unshift({ biz: st.biz, icon: 'qr', text: o.checkinLabel + ' · check-in', member: m.name, outlet: o.city + ' ' + o.kind, time: timeLabel() });
      ui.checkedIn = m.id + o.id; save(); rerender(); toast(m.name + ' checked in');
    },
    postBill: function (el) {
      var m = memberOf(el.dataset.id), o = staffOutlet(), st = staff(), b = biz(st.biz), amt = +ui.billAmt;
      if (!(amt >= BC_STAFF_UI.minBill)) return;
      var before = tierOfMember(m.id), pts = earnFor(b.id, before.id, amt), ref = o.id.toUpperCase().slice(0, 3) + '-' + Math.floor(10000 + Math.random() * 89999);
      dyn(m.id).spend[b.id] += amt; dyn(m.id).points[b.id] += pts;
      addHistory(m.id, b.id, 'Bill · ' + o.name, ref, pts);
      S.staffLog.unshift({ biz: st.biz, icon: 'receipt', text: 'Bill ' + inr(amt) + ' · +' + num(pts) + ' pts', member: m.name, outlet: o.city + ' ' + o.kind, time: timeLabel() });
      save(); ui.billAmt = '';
      var after = tierOfMember(m.id);
      rerender();
      toast(after.id !== before.id ? m.firstName + ' reached ' + after.name + '! +' + num(pts) + ' pts' : '+' + num(pts) + ' ' + b.short + ' points credited to ' + m.firstName);
    },
    useVoucher: function (el) {
      var d = dyn(el.dataset.mem), st = staff(), m = memberOf(el.dataset.mem);
      d.vouchers.forEach(function (v) { if (v.code === el.dataset.id) { v.used = true; S.staffLog.unshift({ biz: st.biz, icon: 'gift', text: 'Voucher redeemed · ' + v.title, member: m.name, outlet: staffOutlet().city + ' ' + staffOutlet().kind, time: timeLabel() }); } });
      save(); rerender(); toast('Voucher marked as redeemed');
    },
    kycMethod: function (el) { ui.kycMethod = el.dataset.id; rerender(); },
    kycStart: function () {
      var m = byId(BC_KYC.methods, ui.kycMethod);
      ui.sheetLock = true;
      openSheet('<h3>' + esc(m.title) + '</h3><p class="lead">Verifying your age securely…</p><ul class="steps" id="kycSteps">' +
        BC_KYC.steps.map(function (s) { return '<li><span class="st"></span>' + esc(s) + '</li>'; }).join('') + '</ul>');
      runSteps($('kycSteps').children, function () { ui.sheetLock = false; SES.kycDone = true; saveSes(); go('kyc-done'); });
    },
    openApp: function (el) {
      var b = biz(el.dataset.id);
      ui.sheetLock = true;
      openSheet('<h3>Opening ' + esc(b.appName) + '</h3><p class="lead">Single sign-on with your Boche.Club identity</p><ul class="steps" id="ssoSteps">' +
        BC_SSO_STEPS.map(function (s) { return '<li><span class="st"></span>' + esc(s.replace('{app}', b.appName)) + '</li>'; }).join('') + '</ul>');
      runSteps($('ssoSteps').children, function () { ui.sheetLock = false; closeSheet(); go('app/' + b.id); }, 600);
    },
    childItem: function (el) { toast(el.dataset.id + ' opens in the business app'); },
    soonBiz: function (el) { toast(biz(el.dataset.id).name + ' joins Boche.Club soon'); },
    notifs: function () { toast('You’re all caught up'); },
    flip: function () {
      var f = $('flip'); f.classList.toggle('flipped');
      var b = $('flipBtn'); if (b) b.innerHTML = f.classList.contains('flipped') ? ic('card') + ' Show card front' : ic('qr') + ' Show QR code';
    },
    wallet: function (el) { toast('Membership pass added to ' + el.dataset.id + ' (demo)'); },
    exploreFilter: function (el) { ui.exploreFilter = el.dataset.id; rerender(); },
    bizTab: function (el) { ui.bizTab = el.dataset.id; rerender(); },
    actTab: function (el) { ui.actTab = el.dataset.id; rerender(); },
    actBiz: function (el) { ui.actBiz = el.dataset.id; rerender(); },
    redeem: function (el) {
      var r = byId(BC_REWARDS, el.dataset.id), b = biz(r.biz), pts = pointsOf(BC_MEMBER.id, b.id);
      if (pts < b.minRedeem) { toast('Minimum ' + num(b.minRedeem) + ' points to redeem at ' + b.name); return; }
      openSheet('<h3>Redeem reward</h3><p class="lead">' + esc(r.title) + ' · ' + esc(b.name) + '</p><div class="surface mt16" style="padding:4px 16px">' +
        '<div class="kv"><span>Cost</span><span>' + num(r.pts) + ' ' + esc(b.short) + ' pts</span></div><div class="kv"><span>Balance after</span><span>' + num(pts - r.pts) + ' pts</span></div></div>' +
        '<p class="fine">Honoured only at ' + esc(b.name) + '. Show the voucher with your card.</p>' +
        '<div class="btn-row mt16"><button class="btn btn-line" data-act="closeSheet">Cancel</button><button class="btn btn-gold" data-act="confirmRedeem" data-id="' + r.id + '">Redeem</button></div>');
    },
    confirmRedeem: function (el) {
      var r = byId(BC_REWARDS, el.dataset.id), b = biz(r.biz), d = dyn(BC_MEMBER.id);
      if (d.points[b.id] < r.pts) return;
      var code = 'BC-' + rand(6);
      d.points[b.id] -= r.pts; d.vouchers.unshift({ biz: b.id, title: r.title, code: code, date: todayLabel(), used: false });
      addHistory(BC_MEMBER.id, b.id, 'Redeemed · ' + r.title, code, -r.pts); save();
      openSheet('<div class="center"><div class="big-check">' + ic('gift', 32) + '</div><h3>Reward unlocked</h3><p class="lead">' + esc(r.title) + '</p>' +
        '<div class="voucher mt16"><div class="li-s">Voucher code</div><div class="code">' + esc(code) + '</div></div>' +
        '<p class="fine">Show this code with your card at ' + esc(b.name) + '.</p><button class="btn btn-gold mt16" data-act="closeSheetRender">Done</button></div>');
    },
    bookDay: function (el) { ui.book.day = +el.dataset.id; rerender(); },
    bookTime: function (el) { ui.book.time = el.dataset.id; rerender(); },
    bookOcc: function (el) { ui.book.occasion = el.dataset.id; rerender(); },
    guests: function (el) { ui.book.guests = Math.max(1, Math.min(BC_BOOKING.maxGuests, ui.book.guests + (+el.dataset.id))); rerender(); },
    confirmBook: function (el) {
      var o = outlet(el.dataset.id), b = ui.book, d = new Date(); d.setDate(d.getDate() + b.day);
      var when = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) + ', ' + b.time, ref = 'BK-' + rand(5);
      S.bookings.unshift({ ref: ref, outlet: o.name, when: when, guests: b.guests }); save(); resetBook();
      openSheet('<div class="center"><div class="big-check">' + ic('calendar', 32) + '</div><h3>Table booked</h3><p class="lead">' + esc(o.name) + '</p></div>' +
        '<div class="surface mt16" style="padding:4px 16px"><div class="kv"><span>When</span><span>' + esc(when) + '</span></div><div class="kv"><span>Guests</span><span>' + b.guests + '</span></div>' +
        '<div class="kv"><span>Booking ref</span><span>' + esc(ref) + '</span></div></div>' +
        '<p class="fine center">Sent to ' + esc(biz(o.biz).appName) + '. Show your card on arrival.</p><button class="btn btn-gold mt16" data-act="bookDone" data-id="' + o.id + '">Done</button>');
    },
    bookDone: function (el) { closeSheet(); go('outlet/' + el.dataset.id); },
    offersTab: function (el) { ui.offersTab = el.dataset.id; rerender(); },
    openEvents: function () { ui.offersTab = 'events'; go('offers'); },
    activate: function (el) {
      var i = S.activated.indexOf(el.dataset.id);
      if (i > -1) { S.activated.splice(i, 1); toast('Offer deactivated'); }
      else { S.activated.push(el.dataset.id); toast('Offer activated — applies when staff scan your card'); }
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
      openSheet('<h3>Add to home screen</h3><p class="lead">Boche.Club installs straight from your browser — no app store needed.</p>' +
        '<div class="field-l">' + (ios ? 'On iPhone (Safari)' : 'On Android (Chrome)') + '</div><ol class="howto">' +
        (ios ? '<li>Tap the Share button ' + icInline('share', 16) + ' at the bottom of Safari.</li><li>Scroll and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b> — Boche.Club appears with your apps.</li>'
          : '<li>Tap the ⋮ menu at the top right of Chrome.</li><li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li><li>Confirm — Boche.Club opens full-screen like any app.</li>') +
        '</ol><button class="btn btn-gold mt24" data-act="closeSheet">Got it</button>');
    },
    support: function () { toast('Call ' + BC_BRAND.supportPhone + ' or write to ' + BC_BRAND.supportEmail); },
    resetDemo: function () {
      S = freshShared(); save(); SES = { authed: false, kycDone: false, staffId: null, outlet: null }; saveSes();
      ui.mobile = ''; ui.staffMobile = ''; ui.kycConsent = false; ui.billAmt = ''; resetBook(); toast('Demo reset'); go('welcome');
    },
    logout: function () { SES.authed = false; saveSes(); go('welcome'); },
    closeSheet: function () { closeSheet(); },
    closeSheetRender: function () { closeSheet(); rerender(); }
  };

  function runSteps(lis, done, gap) {
    var i = 0; gap = gap || 750;
    (function step() {
      if (i > 0) { lis[i - 1].className = 'done'; lis[i - 1].firstChild.innerHTML = ic('check', 14); }
      if (i < lis.length) { lis[i].className = 'active'; i++; timers.push(setTimeout(step, gap)); }
      else timers.push(setTimeout(done, 450));
    })();
  }

  /* ============================================================
     SHELL: router, sheet, toast, tabs
     ============================================================ */
  var MEMBER_PUBLIC = { welcome: 1, login: 1, otp: 1 };
  var STAFF_PUBLIC = { staff: 1, 'staff-otp': 1 };
  var STAFF_APP = { scan: 1, verify: 1 };
  var TABS = { home: 1, explore: 1, card: 1, activity: 1, profile: 1 };
  var timers = [];
  function clearTimers() { timers.forEach(function (t) { clearInterval(t); clearTimeout(t); }); timers = []; }
  function parse() { var p = (location.hash || '').replace(/^#\/?/, '').split('/'); return { name: p[0] || '', arg: decodeURIComponent(p[1] || '') }; }
  function go(path) { if (location.hash === '#/' + path) render(); else location.hash = '#/' + path; }
  function resolve(r) {
    if (STAFF_PUBLIC[r.name]) return SES.staffId ? { name: 'scan', arg: '' } : r;
    if (STAFF_APP[r.name]) return SES.staffId ? r : { name: 'staff', arg: '' };
    if (!SES.authed) return MEMBER_PUBLIC[r.name] ? r : { name: 'welcome', arg: '' };
    if (!SES.kycDone) return (r.name === 'kyc') ? r : { name: 'kyc', arg: '' };
    if (MEMBER_PUBLIC[r.name] || r.name === 'kyc' || !SCREENS[r.name]) return { name: 'home', arg: '' };
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
    var items = [['home', 'Home', 'home'], ['explore', 'Explore', 'pin'], ['card', 'Card', 'qr'], ['activity', 'Activity', 'receipt'], ['profile', 'Profile', 'user']];
    $('tabbar').innerHTML = items.map(function (t) {
      var on = active === t[0] ? ' on' : '';
      if (t[0] === 'card') return '<button class="tab tab-card' + on + '" data-go="card"><span class="fab">' + ic('qr', 26) + '</span><span>Card</span></button>';
      return '<button class="tab' + on + '" data-go="' + t[0] + '">' + ic(t[2]) + '<span>' + t[1] + '</span></button>';
    }).join('');
  }

  function openSheet(html) { $('sheet').innerHTML = '<div class="sheet-grip"></div>' + html; $('sheet').classList.add('open'); $('sheetBackdrop').classList.add('open'); }
  function closeSheet(force) {
    if (ui.sheetLock && !force) return;
    $('sheet').classList.remove('open'); $('sheetBackdrop').classList.remove('open');
  }
  var toastT;
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2800);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-act]');
    if (a && !a.disabled && ACTIONS[a.dataset.act]) { e.preventDefault(); e.stopPropagation(); ACTIONS[a.dataset.act](a); return; }
    var g = e.target.closest('[data-go]');
    if (g && !g.disabled) { e.preventDefault(); go(g.dataset.go); }
  });
  $('sheetBackdrop').addEventListener('click', function () { closeSheet(); });
  window.addEventListener('hashchange', function () { render(); });
  /* Another tab (member app / Business Admin) changed shared data → refresh this one */
  window.addEventListener('storage', function (e) {
    if (e.key !== LS_KEY || !e.newValue) return;
    try { S = JSON.parse(e.newValue); } catch (x) { return; }
    var ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA)$/.test(ae.tagName)) return;
    rerender();
  });

  /* ---------- PWA ---------- */
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; });
  if (/^https?:$/.test(location.protocol)) {
    var lk = document.createElement('link'); lk.rel = 'manifest'; lk.href = 'manifest.json'; document.head.appendChild(lk);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  render();
})();
