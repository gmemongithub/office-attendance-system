(function () {

  const API_BASE = 'http://localhost:4000/api'; // BACKEND NOTE: change to your VPS URL after deploy

  var icons = {
    enter: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>`,
    exit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
    coffee: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>`,
    walk: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>`,
    chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px; color:var(--text-muted)"><polyline points="9 18 15 12 9 6"></polyline></svg>`,
    settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px"><circle cx="12" cy="12" r="3"></circle></svg>`,
  };

  function getToken(){ return localStorage.getItem('token'); }
  function setToken(t){ localStorage.setItem('token', t); }
  function clearToken(){ localStorage.removeItem('token'); }

  async function api(path, options) {
    options = options || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    var res = await fetch(API_BASE + path, Object.assign({}, options, { headers: headers }));
    var data = await res.json().catch(function(){ return {}; });
    if (!res.ok) {
      var err = new Error(data.error || 'Request failed');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function formatDuration(totalSeconds){
    var h = Math.floor(totalSeconds / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    return h + 'h ' + m + 'm';
  }

  // ==========================================================
  // DARK MODE
  // ==========================================================
  var moonIcon = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
  var sunIcon = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
  document.querySelectorAll('.mode-switch').forEach(function(btn){
    btn.addEventListener('click', function () {
      var isDark = document.documentElement.classList.toggle('dark');
      document.querySelectorAll('.moon-icon').forEach(function(icon){ icon.innerHTML = isDark ? sunIcon : moonIcon; });
    });
  });

  // ==========================================================
  // LOGIN / SESSION
  // ==========================================================
  var loginApp = document.getElementById('login-app');
  var employeeApp = document.getElementById('employee-app');
  var adminApp = document.getElementById('admin-app');
  var btnLogin = document.getElementById('btn-login');
  var loginUsername = document.getElementById('login-username');
  var loginPassword = document.getElementById('login-password');
  var loginError = document.getElementById('login-error');
  var modalForceLogout = document.getElementById('modal-force-logout');
  var btnLogout = document.getElementById('btn-logout');

  var currentUser = null; // { id, name, email, type }

  function showLoggedOut(){
    loginApp.style.display = 'flex';
    employeeApp.style.display = 'none';
    adminApp.style.display = 'none';
  }

  // Admin goes STRAIGHT to the admin panel — admins have no personal
  // attendance record, so they should never see the employee Today
  // screen (that was the source of the check-in crash).
  function showLoggedIn(){
    loginApp.style.display = 'none';
    if (currentUser.type === 'ADMIN') {
      document.body.classList.add('is-admin');
      employeeApp.style.display = 'none';
      adminApp.style.display = 'flex';
    } else {
      document.body.classList.remove('is-admin');
      employeeApp.style.display = 'flex';
      adminApp.style.display = 'none';
    }
  }

  async function tryRestoreSession(){
    if (!getToken()) { showLoggedOut(); return; }
    try {
      var res = await api('/auth/me');
      currentUser = res.user;
      showLoggedIn();
      setDateLabel();
      afterLogin();
    } catch (e) {
      clearToken();
      showLoggedOut();
    }
  }

  async function doLogin(force){
    var email = loginUsername.value.trim();
    var password = loginPassword.value.trim();
    if (!email || !password){ loginError.classList.add('show'); return; }
    loginError.classList.remove('show');

    try {
      var res = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email, password: password, force: !!force }),
      });
      setToken(res.token);
      currentUser = res.user;
      loginUsername.value = ''; loginPassword.value = '';
      showLoggedIn();
      setDateLabel();
      afterLogin();
    } catch (e) {
      if (e.data && e.data.error === 'ALREADY_LOGGED_IN') {
        modalForceLogout.classList.add('open');
      } else {
        loginError.textContent = e.message || 'Login failed';
        loginError.classList.add('show');
      }
    }
  }

  btnLogin.addEventListener('click', function(){ doLogin(false); });
  document.getElementById('btn-cancel-force-logout').addEventListener('click', function(){ modalForceLogout.classList.remove('open'); });
  document.getElementById('btn-confirm-force-logout').addEventListener('click', function(){
    modalForceLogout.classList.remove('open');
    doLogin(true);
  });

  if (btnLogout) {
    btnLogout.addEventListener('click', async function(){
      try { await api('/auth/logout', { method: 'POST' }); } catch (e) {}
      clearToken();
      document.body.classList.remove('is-admin');
      showLoggedOut();
    });
  }

  function afterLogin(){
    if (currentUser.type === 'EMPLOYEE') {
      refreshTodayStatus();
      setupPushSubscription();
    } else {
      loadAdminDashboard();
    }
  }

  var btnOpenAdmin = document.getElementById('btn-open-admin');
  var btnBackToEmployee = document.getElementById('btn-back-to-employee');
  if (btnOpenAdmin) btnOpenAdmin.addEventListener('click', function(){ employeeApp.style.display = 'none'; adminApp.style.display = 'flex'; });
  if (btnBackToEmployee) btnBackToEmployee.addEventListener('click', function(){ adminApp.style.display = 'none'; employeeApp.style.display = 'flex'; });

  // ==========================================================
  // PUSH SUBSCRIPTION
  // ==========================================================
  var VAPID_PUBLIC_KEY = 'BD2VX_cuABSn3Ze1wN4LNp0H3gHOrKycnaPBaUCr35hDfvaOq21PriCaGNYE3VtgG_84QEpFWbTmbeoBPPTepB8';

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  async function setupPushSubscription(){
    if (!currentUser || currentUser.type !== 'EMPLOYEE') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      var reg = await navigator.serviceWorker.register('/service-worker.js');
      var permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      var sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
      }
      var subJson = sub.toJSON();
      await api('/employee/push-subscribe', { method: 'POST', body: JSON.stringify({ endpoint: subJson.endpoint, keys: subJson.keys }) });
    } catch (e) { console.warn('Push subscription failed (non-fatal):', e); }
  }

  // ==========================================================================================
  // ================================  EMPLOYEE APP LOGIC  ======================================
  // ==========================================================================================

  function setDateLabel(){
    var options = { weekday: 'long', day: 'numeric', month: 'long' };
    document.getElementById('greeting-date').textContent = new Date().toLocaleDateString('en-US', options);
    if (currentUser) document.getElementById('greeting-text').textContent = currentUser.name;
  }

  var elTimer = document.getElementById('timer');
  var progressRing = document.getElementById('progress-ring');
  var elStatusLabel = document.getElementById('status-label');
  var elStatusSub = document.getElementById('status-sub');
  var elStatusCard = document.getElementById('status-card');
  var btnCheckin = document.getElementById('btn-checkin');
  var btnBreak = document.getElementById('btn-break');
  var btnCheckout = document.getElementById('btn-checkout');
  var breakLabel = document.getElementById('break-label');
  var breakIcon = document.getElementById('break-icon');
  var logRows = document.getElementById('log-rows');
  var notesBox = document.getElementById('notes-box');
  var notesList = document.getElementById('notes-list');

  var workGoalSeconds = 8 * 60 * 60;
  var displaySeconds = 0;
  var tickInterval = null;
  var currentState = 'OUT';

  function fmt(n){ return n < 10 ? '0' + n : '' + n; }
  function fmtTime(iso){
    var d = new Date(iso);
    var h = d.getHours(), m = d.getMinutes();
    var ampm = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + fmt(m) + ' ' + ampm;
  }

  function renderTimerDisplay(){
    var h = Math.floor(displaySeconds / 3600);
    var m = Math.floor((displaySeconds % 3600) / 60);
    var s = displaySeconds % 60;
    elTimer.textContent = fmt(h) + ':' + fmt(m) + ':' + fmt(s);
    var circumference = 339.29;
    var offset = Math.max(0, circumference - (displaySeconds / workGoalSeconds) * circumference);
    progressRing.style.strokeDashoffset = offset;
  }

  function startLocalTicking(baseSeconds){
    displaySeconds = baseSeconds;
    renderTimerDisplay();
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = setInterval(function(){ displaySeconds++; renderTimerDisplay(); }, 1000);
  }
  function stopLocalTicking(){ if (tickInterval) clearInterval(tickInterval); tickInterval = null; }

  function eventIconKey(ev){
    if (ev.type === 'CHECK_IN') return 'enter';
    if (ev.type === 'CHECK_OUT') return 'exit';
    if (ev.type === 'BREAK_START') return ev.breakReason === 'LUNCH' ? 'coffee' : 'walk';
    return 'enter';
  }
  function eventLabel(ev){
    if (ev.type === 'CHECK_IN') return 'Checked in';
    if (ev.type === 'CHECK_OUT') return ev.isAutoGenerated ? 'Auto checked out' : 'Checked out';
    if (ev.type === 'BREAK_START') return ev.breakReason === 'LUNCH' ? 'Lunch break started' : 'Break started';
    return 'Back to work';
  }

  function renderTodayLog(events){
    logRows.innerHTML = '';
    notesList.innerHTML = '';
    var hasNotes = false;
    events.slice().reverse().forEach(function(ev){
      var row = document.createElement('div');
      row.className = 'log-row';
      row.innerHTML = `<div class="left"><div class="icon-wrap">${icons[eventIconKey(ev)]}</div><p class="text-body">${eventLabel(ev)}</p></div><span class="text-small">${fmtTime(ev.serverTimestamp)}</span>`;
      logRows.appendChild(row);
    });
    events.forEach(function(ev){
      if (ev.note) {
        hasNotes = true;
        var tag = ev.type === 'CHECK_OUT' ? 'Checkout' : (ev.breakReason === 'OTHER' ? 'Other break' : 'Note');
        var item = document.createElement('div');
        item.className = 'note-item';
        item.innerHTML = `<p class="note-tag">${tag}</p><p class="text-body">${ev.note}</p>`;
        notesList.appendChild(item);
      }
    });
    notesBox.style.display = hasNotes ? 'block' : 'none';
  }

  function applyStateUI(state, checkinEvent){
    currentState = state;
    if (state === 'OUT') {
      elStatusCard.className = 'status-card state-waiting';
      elStatusLabel.textContent = 'Not checked in';
      elStatusSub.textContent = 'Tap check in to start your day';
      btnCheckin.disabled = false; btnBreak.disabled = true; btnCheckout.disabled = true;
      breakLabel.textContent = 'Break'; breakIcon.innerHTML = icons.coffee;
      stopLocalTicking();
    } else if (state === 'DONE') {
      elStatusCard.className = 'status-card state-done';
      elStatusLabel.textContent = 'Done for today';
      elStatusSub.textContent = 'See you tomorrow';
      btnCheckin.disabled = true; btnBreak.disabled = true; btnCheckout.disabled = true;
      stopLocalTicking();
    } else if (state === 'IN_OFFICE') {
      elStatusCard.className = 'status-card state-active';
      elStatusLabel.textContent = 'Working';
      elStatusSub.textContent = checkinEvent ? ('Checked in at ' + fmtTime(checkinEvent.serverTimestamp)) : 'Working';
      btnCheckin.disabled = true; btnBreak.disabled = false; btnCheckout.disabled = false;
      breakLabel.textContent = 'Break'; breakIcon.innerHTML = icons.coffee;
    } else {
      elStatusCard.className = 'status-card state-break';
      elStatusLabel.textContent = state === 'ON_LUNCH' ? 'On lunch' : 'On break';
      elStatusSub.textContent = 'Tap to resume working';
      btnCheckin.disabled = true; btnBreak.disabled = false; btnCheckout.disabled = true;
      breakLabel.textContent = 'Back in'; breakIcon.innerHTML = icons.enter;
    }
  }

  var isRefreshing = false;
  async function refreshTodayStatus(){
    if (isRefreshing) return;
    isRefreshing = true;
    try {
      var res = await api('/attendance/today');
      var checkinEvent = res.events.find(function(e){ return e.type === 'CHECK_IN'; });
      applyStateUI(res.state, checkinEvent);
      renderTodayLog(res.events);
      if (res.state === 'IN_OFFICE') startLocalTicking(res.workedSeconds);
      else { displaySeconds = res.workedSeconds; renderTimerDisplay(); stopLocalTicking(); }
    } catch (e) { console.error('Failed to load today status:', e); }
    finally { isRefreshing = false; }
  }

  btnCheckin.addEventListener('click', async function(){
    btnCheckin.disabled = true;
    try { await api('/attendance/check-in', { method: 'POST' }); await refreshTodayStatus(); }
    catch (e) { alert(e.message); btnCheckin.disabled = (currentState !== 'OUT'); }
  });

  var overlayBreak = document.getElementById('overlay-break');
  var reasonLunch = document.getElementById('reason-lunch');
  var reasonOther = document.getElementById('reason-other');
  var lunchUsedNote = document.getElementById('lunch-used-note');
  var otherNoteWrap = document.getElementById('other-note-wrap');
  var otherNote = document.getElementById('other-note');
  var otherNoteError = document.getElementById('other-note-error');
  var breakConfirm = document.getElementById('break-confirm');

  function resetBreakModal(){
    reasonLunch.classList.remove('selected'); reasonOther.classList.remove('selected');
    otherNoteWrap.style.display = 'none'; otherNote.value = '';
    otherNoteError.classList.remove('show'); breakConfirm.style.display = 'none';
    reasonLunch.disabled = false; lunchUsedNote.style.display = 'none';
  }

  btnBreak.addEventListener('click', async function(){
    if (currentState === 'ON_LUNCH' || currentState === 'ON_OTHER_BREAK') {
      btnBreak.disabled = true;
      try { await api('/attendance/break/end', { method: 'POST' }); currentState = 'IN_OFFICE'; await refreshTodayStatus(); }
      catch (e) { alert(e.message); await refreshTodayStatus(); }
      return;
    }
    if (currentState !== 'IN_OFFICE') return;
    resetBreakModal();
    overlayBreak.classList.add('open');
  });

  document.getElementById('break-cancel').addEventListener('click', function(){ overlayBreak.classList.remove('open'); });

  reasonLunch.addEventListener('click', async function(){
    if (reasonLunch.disabled) return;
    reasonLunch.classList.add('selected'); reasonLunch.disabled = true;
    try {
      await api('/attendance/break/start', { method: 'POST', body: JSON.stringify({ reason: 'LUNCH' }) });
      currentState = 'ON_LUNCH';
      overlayBreak.classList.remove('open');
      await refreshTodayStatus();
    } catch (e) { overlayBreak.classList.remove('open'); alert(e.message); await refreshTodayStatus(); }
  });

  reasonOther.addEventListener('click', function(){
    reasonOther.classList.add('selected'); reasonLunch.classList.remove('selected');
    otherNoteWrap.style.display = 'block'; breakConfirm.style.display = 'flex';
  });

  breakConfirm.addEventListener('click', async function(){
    var note = otherNote.value.trim();
    if (!note){ otherNoteError.classList.add('show'); return; }
    otherNoteError.classList.remove('show');
    breakConfirm.disabled = true;
    try {
      await api('/attendance/break/start', { method: 'POST', body: JSON.stringify({ reason: 'OTHER', note: note }) });
      currentState = 'ON_OTHER_BREAK';
      overlayBreak.classList.remove('open');
      await refreshTodayStatus();
    } catch (e) { overlayBreak.classList.remove('open'); alert(e.message); await refreshTodayStatus(); }
    finally { breakConfirm.disabled = false; }
  });

  var overlayCheckout = document.getElementById('overlay-checkout');
  var checkoutNote = document.getElementById('checkout-note');

  btnCheckout.addEventListener('click', function(){
    if (currentState !== 'IN_OFFICE') return;
    checkoutNote.value = ''; overlayCheckout.classList.add('open');
  });
  document.getElementById('checkout-cancel').addEventListener('click', function(){ overlayCheckout.classList.remove('open'); });

  document.getElementById('checkout-confirm').addEventListener('click', async function(){
    var note = checkoutNote.value.trim();
    var confirmBtn = document.getElementById('checkout-confirm');
    confirmBtn.disabled = true;
    try {
      await api('/attendance/check-out', { method: 'POST', body: JSON.stringify({ note: note || undefined }) });
      currentState = 'DONE';
      overlayCheckout.classList.remove('open');
      await refreshTodayStatus();
    } catch (e) { overlayCheckout.classList.remove('open'); alert(e.message); await refreshTodayStatus(); }
    finally { confirmBtn.disabled = false; }
  });

  var employeeScreens = {
    'today': document.getElementById('screen-today'),
    'history-months': document.getElementById('screen-history-months'),
    'history-days': document.getElementById('screen-history-days'),
    'day-detail': document.getElementById('screen-day-detail'),
    'notices': document.getElementById('screen-notices'),
    'profile': document.getElementById('screen-profile')
  };
  function showEmployeeScreen(key){
    Object.keys(employeeScreens).forEach(function(k){ if(employeeScreens[k]) employeeScreens[k].classList.toggle('active', k === key); });
  }
  var employeeNavItems = document.querySelectorAll('#employee-app .sidebar > .nav-item[data-tab]');
  employeeNavItems.forEach(function(btn){
    btn.addEventListener('click', function(){
      var target = btn.getAttribute('data-tab');
      if (target === 'history-months') loadMyMonths();
      if (target === 'notices') loadActiveNotices();
      if (target === 'profile') loadMyProfileScreen();
      showEmployeeScreen(target);
      employeeNavItems.forEach(function(b){
        var groupKey = b.getAttribute('data-tab');
        var isActiveGroup = (groupKey === target) || (groupKey === 'history-months' && (target === 'history-days' || target === 'day-detail'));
        b.classList.toggle('active', isActiveGroup);
      });
    });
  });

  async function loadMyProfileScreen(){
    var screen = document.getElementById('screen-profile');
    screen.querySelector('.text-title').textContent = currentUser.name;
    screen.querySelector('.avatar').textContent = currentUser.name.split(' ').map(function(n){return n[0];}).join('').slice(0,2).toUpperCase();
    screen.querySelectorAll('.text-small')[0].textContent = currentUser.email;
    try {
      var res = await api('/employee/me');
      var rows = screen.querySelectorAll('.list-row');
      rows[0].querySelector('.text-body').textContent = res.employee.dutyStartTimeOverride || 'Default (set by admin)';
      rows[1].querySelector('.text-body').textContent = res.employee.id.slice(0, 8).toUpperCase();
    } catch (e) { console.error(e); }
  }

  var selectedMyMonth = null;

  async function loadMyMonths(){
    var container = document.getElementById('screen-history-months').querySelector('.content-wrapper');
    container.innerHTML = '<p class="text-section">My History</p>';
    try {
      var res = await api('/reports/me/months');
      res.months.forEach(function(m){
        var row = document.createElement('div');
        row.className = 'list-row';
        row.innerHTML = `<div><span class="text-body list-title">${m.label}</span></div>${icons.chevron}`;
        row.addEventListener('click', function(){ selectedMyMonth = m; loadMyDays(m); });
        container.appendChild(row);
      });
      if (res.months.length === 0) container.innerHTML += '<p class="text-small">No history yet.</p>';
    } catch (e) { console.error(e); }
  }

  async function loadMyDays(month){
    document.getElementById('month-title').textContent = month.label;
    var dayList = document.getElementById('day-list');
    dayList.innerHTML = '';
    try {
      var res = await api('/reports/me/months/' + month.year + '/' + month.month);
      var weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      res.days.forEach(function(d){
        var dateObj = new Date(Date.UTC(month.year, month.month - 1, d.day));
        var weekday = weekdays[dateObj.getUTCDay()];
        var flagged = d.flags && d.flags.length > 0;
        var sub = d.isHoliday ? 'Holiday' : (flagged ? d.flags.join(' + ') : (d.hasData ? formatDuration(d.workedSeconds) + ' worked' : 'No data'));
        var row = document.createElement('div');
        row.className = 'list-row' + (flagged ? ' flag' : '');
        row.innerHTML = `<div class="left" style="flex-direction:column; align-items:flex-start; gap:4px"><span class="text-body list-title" style="font-weight:700">${d.day} ${weekday}</span><span class="text-small">${sub}</span></div>${icons.chevron}`;
        row.addEventListener('click', function(){ loadMyDayDetail(month, d.day); });
        dayList.appendChild(row);
      });
      showEmployeeScreen('history-days');
    } catch (e) { console.error(e); }
  }

  async function loadMyDayDetail(month, day){
    document.getElementById('day-title').textContent = day + ' ' + month.label;
    var flagListEl = document.getElementById('day-flag-list');
    var timeline = document.getElementById('day-timeline');
    var totalEl = document.getElementById('day-total');
    var dayNotesBox = document.getElementById('day-notes-box');
    var dayNotesList = document.getElementById('day-notes-list');
    timeline.innerHTML = ''; dayNotesList.innerHTML = ''; dayNotesBox.style.display = 'none'; flagListEl.innerHTML = '';
    try {
      var res = await api('/reports/me/day/' + month.year + '/' + month.month + '/' + day);
      if (res.isHoliday) { totalEl.textContent = 'Holiday'; showEmployeeScreen('day-detail'); return; }
      totalEl.textContent = formatDuration(res.workedSeconds);
      res.events.forEach(function(ev){
        if (ev.isForgotFlag || ev.isLunchOverrun) {
          var box = document.createElement('div');
          box.className = 'detail-flag';
          box.innerHTML = `<span>${ev.isForgotFlag ? 'Forgot to check out' : 'Lunch overrun'}</span>`;
          flagListEl.appendChild(box);
        }
        var r = document.createElement('div');
        r.className = 'log-row';
        r.innerHTML = `<div class="left"><div class="icon-wrap">${icons[eventIconKey(ev)]}</div><p class="text-body">${eventLabel(ev)}</p></div><span class="text-small">${fmtTime(ev.serverTimestamp)}</span>`;
        timeline.appendChild(r);
        if (ev.note) {
          dayNotesBox.style.display = 'block';
          var item = document.createElement('div');
          item.className = 'note-item';
          item.innerHTML = `<p class="note-tag">${ev.type === 'CHECK_OUT' ? 'Checkout' : 'Other break'}</p><p class="text-body">${ev.note}</p>`;
          dayNotesList.appendChild(item);
        }
      });
      showEmployeeScreen('day-detail');
    } catch (e) { console.error(e); }
  }

  document.getElementById('btn-back-to-months').addEventListener('click', function(){ showEmployeeScreen('history-months'); });
  document.getElementById('btn-back-to-days').addEventListener('click', function(){ showEmployeeScreen('history-days'); });

  async function loadActiveNotices(){
    var container = document.getElementById('screen-notices').querySelector('.content-wrapper');
    container.innerHTML = '<p class="text-section">Notices</p>';
    try {
      var res = await api('/notices/active');
      if (res.notices.length === 0) container.innerHTML += '<p class="text-small">No active notices.</p>';
      res.notices.forEach(function(n){
        var card = document.createElement('div');
        card.className = 'notice-card notice-warning';
        card.innerHTML = `<p class="text-body" style="margin-bottom:4px; font-weight:700;">${n.title}</p><p class="text-small">${n.body}</p>`;
        container.appendChild(card);
      });
    } catch (e) { console.error(e); }
  }

  // ==========================================================================================
  // ==================================  ADMIN PANEL LOGIC  =====================================
  // ==========================================================================================

  var adminTitles = {
    'dashboard': ['Live Dashboard', 'Real-time attendance monitor'],
    'staff': ['Staff & Accounts', 'Manage employees and individual settings'],
    'reports-emp': ['Reports & History', 'Drill-down attendance data'],
    'broadcast': ['Broadcast Notices', 'Send push notifications to all apps'],
    'settings': ['Global Settings', 'Configure default office rules']
  };
  var adminScreens = [
    'dashboard', 'staff', 'staff-create', 'staff-manage',
    'reports-emp', 'reports-months', 'reports-days', 'reports-detail',
    'reports-date-months', 'reports-date-days', 'reports-date-employees',
    'broadcast', 'settings'
  ];
  var detailScreenBackTarget = 'reports-days';

  function showAdminScreen(screenId){
    adminScreens.forEach(function(s){ var el = document.getElementById('admin-screen-' + s); if (el) el.classList.remove('active'); });
    var targetEl = document.getElementById('admin-screen-' + screenId);
    if (targetEl) targetEl.classList.add('active');
    if (adminTitles[screenId]) {
      document.getElementById('admin-screen-title').textContent = adminTitles[screenId][0];
      document.getElementById('admin-screen-sub').textContent = adminTitles[screenId][1];
    }
    document.querySelectorAll('#admin-app .admin-sidebar > .nav-item[data-admin-tab]').forEach(function(btn){
      var tab = btn.getAttribute('data-admin-tab');
      var active = screenId.startsWith(tab) || (tab === 'reports' && screenId.startsWith('reports-')) || (tab === 'staff' && screenId.startsWith('staff-'));
      btn.classList.toggle('active', active);
    });
  }

  document.querySelectorAll('#admin-app .admin-sidebar > .nav-item[data-admin-tab]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var tab = btn.getAttribute('data-admin-tab');
      if (tab === 'reports') tab = 'reports-emp';
      showAdminScreen(tab);
      if (tab === 'dashboard') loadAdminDashboard();
      if (tab === 'staff') loadStaffList();
      if (tab === 'reports-emp') loadReportEmployeeList('');
      if (tab === 'broadcast') loadBroadcastScreen();
      if (tab === 'settings') loadSettingsScreen();
    });
  });

  /* ---------- Dashboard ---------- */
  async function loadAdminDashboard(){
    var grid = document.getElementById('dashboard-grid');
    grid.innerHTML = '';
    try {
      var res = await api('/admin/dashboard');
      var counts = { working: 0, onBreak: 0, other: 0 };
      res.employees.forEach(function(emp){
        var stateClass = 'state-waiting', stateLabel = 'Not checked in';
        if (emp.state === 'IN_OFFICE') { stateClass = 'state-active'; stateLabel = 'In Office'; counts.working++; }
        else if (emp.state === 'ON_LUNCH' || emp.state === 'ON_OTHER_BREAK') { stateClass = 'state-break'; stateLabel = emp.state === 'ON_LUNCH' ? 'On Lunch' : 'On Break'; counts.onBreak++; }
        else if (emp.state === 'DONE') { stateClass = 'state-done'; stateLabel = 'Checked Out'; counts.working++; }
        else { counts.other++; }

        var initials = emp.name.split(' ').map(function(n){ return n[0]; }).join('').slice(0,2).toUpperCase();
        var card = document.createElement('div');
        card.className = 'emp-card ' + stateClass;
        card.innerHTML = `
          <div class="emp-header"><div class="emp-avatar">${initials}</div></div>
          <p class="text-body">${emp.name}</p>
          <p class="emp-time">${formatDuration(emp.workedSeconds)}</p>
          <p class="text-small" style="font-weight:700">${stateLabel}</p>
        `;
        grid.appendChild(card);
      });
      var numbers = document.querySelectorAll('.summary-card .number');
      if (numbers[0]) numbers[0].textContent = counts.working;
      if (numbers[1]) numbers[1].textContent = counts.onBreak;
      if (numbers[2]) numbers[2].textContent = counts.other;
    } catch (e) { console.error(e); }
  }

  /* ---------- Staff & Accounts ---------- */
  var currentManagedEmployeeId = null;

  async function loadStaffList(){
    var listEl = document.getElementById('staff-list');
    listEl.innerHTML = '';
    try {
      var res = await api('/admin/employees');
      document.querySelector('#admin-screen-staff .text-title').textContent = 'Total ' + res.employees.length + ' Employees';
      res.employees.forEach(function(emp){
        var initials = emp.name.split(' ').map(function(n){ return n[0]; }).join('').slice(0,2).toUpperCase();
        var row = document.createElement('div');
        row.className = 'list-row';
        row.style.padding = '16px 24px';
        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:16px">
            <div class="emp-avatar" style="background:var(--surface-muted); color:var(--text-main); width:48px; height:48px; border: 1px solid var(--border-soft);">${initials}</div>
            <div><p class="text-body" style="font-weight:700">${emp.name}${emp.active ? '' : ' (Deactivated)'}</p><p class="text-small">${emp.email}</p></div>
          </div>
          <button class="btn-secondary" style="margin:0; padding:8px 16px">Manage</button>
        `;
        row.addEventListener('click', function(){ openManageEmployee(emp.id); });
        listEl.appendChild(row);
      });
    } catch (e) { console.error(e); }
  }

  async function openManageEmployee(id){
    currentManagedEmployeeId = id;
    try {
      var res = await api('/admin/employees/' + id);
      var emp = res.employee;
      var screen = document.getElementById('admin-screen-staff-manage');
      screen.querySelector('.text-title').textContent = emp.name;
      screen.querySelectorAll('.text-small')[0].textContent = emp.email;
      screen.querySelector('#admin-profile-avatar').textContent = emp.name.split(' ').map(function(n){return n[0];}).join('').slice(0,2).toUpperCase();
      screen.querySelector('input.input-field[type="text"]').value = emp.name;
      screen.querySelector('input[type="time"]').value = emp.dutyStartTimeOverride || '';
      document.getElementById('btn-deactivate-account').textContent = emp.active ? 'Deactivate Account' : 'Reactivate Account';
      showAdminScreen('staff-manage');
    } catch (e) { alert(e.message); }
  }

  document.getElementById('btn-add-employee').addEventListener('click', function(){ showAdminScreen('staff-create'); });
  document.getElementById('btn-back-staff-create').addEventListener('click', function(){ showAdminScreen('staff'); });
  document.getElementById('btn-back-staff-manage').addEventListener('click', function(){ showAdminScreen('staff'); loadStaffList(); });

  document.querySelector('#admin-screen-staff-create .btn-primary').addEventListener('click', async function(){
    var inputs = document.querySelectorAll('#admin-screen-staff-create input');
    var name = inputs[0].value.trim(), email = inputs[1].value.trim(), password = inputs[2].value.trim();
    if (!name || !email || !password) { alert('All fields are required'); return; }
    try {
      await api('/admin/employees', { method: 'POST', body: JSON.stringify({ name: name, email: email, password: password }) });
      inputs[0].value = ''; inputs[1].value = ''; inputs[2].value = '';
      showAdminScreen('staff'); loadStaffList();
    } catch (e) { alert(e.message); }
  });

  document.querySelector('#admin-screen-staff-manage .timeline-box .btn-primary').addEventListener('click', async function(){
    var name = document.querySelector('#admin-screen-staff-manage input.input-field[type="text"]').value.trim();
    try {
      await api('/admin/employees/' + currentManagedEmployeeId, { method: 'PATCH', body: JSON.stringify({ name: name }) });
      alert('Profile updated'); loadStaffList();
    } catch (e) { alert(e.message); }
  });

  document.querySelectorAll('#admin-screen-staff-manage .btn-primary')[1].addEventListener('click', async function(){
    var dutyTime = document.querySelector('#admin-screen-staff-manage input[type="time"]').value;
    try {
      await api('/admin/employees/' + currentManagedEmployeeId, { method: 'PATCH', body: JSON.stringify({ dutyStartTimeOverride: dutyTime || null }) });
      alert('Duty time override saved');
    } catch (e) { alert(e.message); }
  });

  document.getElementById('btn-deactivate-account').addEventListener('click', async function(){
    try {
      var res = await api('/admin/employees/' + currentManagedEmployeeId);
      var action = res.employee.active ? 'deactivate' : 'reactivate';
      if (!confirm('Are you sure you want to ' + action + ' this account?')) return;
      await api('/admin/employees/' + currentManagedEmployeeId + '/' + action, { method: 'POST' });
      openManageEmployee(currentManagedEmployeeId); loadStaffList();
    } catch (e) { alert(e.message); }
  });

  document.getElementById('btn-delete-account').addEventListener('click', function(){
    alert('Accounts are never permanently deleted, to keep attendance history intact. Use Deactivate instead to disable login.');
  });

  var modalResetPassword = document.getElementById('modal-reset-password');
  var resetPasswordInput = document.getElementById('reset-password-input');
  var resetPasswordError = document.getElementById('reset-password-error');
  document.getElementById('btn-open-reset-password').addEventListener('click', function(){
    resetPasswordInput.value = ''; resetPasswordError.classList.remove('show'); modalResetPassword.classList.add('open');
  });
  document.getElementById('btn-cancel-reset-password').addEventListener('click', function(){ modalResetPassword.classList.remove('open'); });
  document.getElementById('btn-save-reset-password').addEventListener('click', async function(){
    var pass = resetPasswordInput.value.trim();
    if (pass.length < 6){ resetPasswordError.classList.add('show'); return; }
    resetPasswordError.classList.remove('show');
    try {
      await api('/admin/employees/' + currentManagedEmployeeId + '/reset-password', { method: 'POST', body: JSON.stringify({ newPassword: pass }) });
      modalResetPassword.classList.remove('open');
      alert('Password reset successfully');
    } catch (e) { alert(e.message); }
  });

  /* ---------- Reports: By Employee ---------- */
  var selectedReportEmployee = null;

  async function loadReportEmployeeList(query){
    var listEl = document.getElementById('report-emp-list');
    listEl.innerHTML = '';
    try {
      var res = await api('/admin/employees');
      var employees = res.employees;
      if (query) employees = employees.filter(function(e){ return e.name.toLowerCase().indexOf(query.toLowerCase()) !== -1; });
      if (employees.length === 0) { listEl.innerHTML = '<p class="text-small" style="text-align:center; padding:24px;">No employee found.</p>'; return; }
      employees.forEach(function(emp){
        var initials = emp.name.split(' ').map(function(n){ return n[0]; }).join('').slice(0,2).toUpperCase();
        var row = document.createElement('div');
        row.className = 'list-row';
        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:16px">
            <div class="emp-avatar" style="background:var(--surface-muted); color:var(--text-main); width:40px; height:40px; font-size:14px; border: 1px solid var(--border-soft);">${initials}</div>
            <p class="text-body">${emp.name}</p>
          </div>
          ${icons.chevron}
        `;
        row.addEventListener('click', function(){ selectedReportEmployee = emp; loadReportMonths(emp); });
        listEl.appendChild(row);
      });
    } catch (e) { console.error(e); }
  }
  document.getElementById('search-emp').addEventListener('keyup', function(){ loadReportEmployeeList(this.value); });

  async function loadReportMonths(emp){
    document.getElementById('month-list-header').textContent = emp.name + "'s History";
    var listEl = document.getElementById('report-months-list');
    listEl.innerHTML = '';
    try {
      var res = await api('/reports/employees/' + emp.id + '/months');
      if (res.months.length === 0) listEl.innerHTML = '<p class="text-small">No history yet.</p>';
      res.months.forEach(function(m){
        var row = document.createElement('div');
        row.className = 'list-row';
        row.innerHTML = `<p class="text-body">${m.label}</p>${icons.chevron}`;
        row.addEventListener('click', function(){ loadReportDays(emp, m); });
        listEl.appendChild(row);
      });
      showAdminScreen('reports-months');
    } catch (e) { console.error(e); }
  }

  async function loadReportDays(emp, month){
    document.querySelector('#admin-screen-reports-days .text-section').textContent = month.label;
    var listEl = document.getElementById('report-days-list');
    listEl.innerHTML = '';
    try {
      var res = await api('/reports/employees/' + emp.id + '/months/' + month.year + '/' + month.month);
      var weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      res.days.forEach(function(d){
        var dateObj = new Date(Date.UTC(month.year, month.month - 1, d.day));
        var weekday = weekdays[dateObj.getUTCDay()];
        var flagged = d.flags && d.flags.length > 0;
        var sub = d.isHoliday ? 'Holiday' : (flagged ? d.flags.join(' + ') : (d.hasData ? formatDuration(d.workedSeconds) + ' worked' : 'No data'));
        var row = document.createElement('div');
        row.className = 'list-row' + (flagged ? ' flag' : '');
        row.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:4px">
            <p class="text-body" style="font-weight:700">${d.day} ${weekday}</p>
            <p class="text-small">${sub}</p>
          </div>
          ${icons.chevron}
        `;
        row.addEventListener('click', function(){ openReportDayDetail(emp, month, d.day, 'reports-days'); });
        listEl.appendChild(row);
      });
      showAdminScreen('reports-days');
    } catch (e) { console.error(e); }
  }

  async function openReportDayDetail(emp, month, day, backTarget){
    detailScreenBackTarget = backTarget;
    document.getElementById('detail-date-header').textContent = day + ' ' + month.label + ' — ' + emp.name;
    try {
      var res = await api('/reports/employees/' + emp.id + '/day/' + month.year + '/' + month.month + '/' + day);
      var totalHeader = document.querySelectorAll('#admin-screen-reports-detail .text-title')[1];
      totalHeader.innerHTML = 'Total: <span style="color:var(--text-main)">' + (res.isHoliday ? 'Holiday' : formatDuration(res.workedSeconds)) + '</span>';

      var timeline = document.getElementById('detail-timeline');
      timeline.innerHTML = '';
      res.events.forEach(function(ev){
        var noteHtml = ev.note ? `<div class="note-box"><p class="text-small" style="font-weight:700; margin-bottom:4px">Note:</p><p class="text-small">${ev.note}</p></div>` : '';
        var r = document.createElement('div');
        r.className = 'log-row';
        r.dataset.eventId = ev.id;
        r.innerHTML = `
          <div style="width:100%">
            <div style="display:flex; align-items:center; justify-content:space-between; width:100%">
              <div class="left"><div class="icon-wrap">${icons[eventIconKey(ev)]}</div><p class="text-body">${eventLabel(ev)}</p></div>
              <span class="text-small" style="font-weight:700">${fmtTime(ev.serverTimestamp)}</span>
            </div>
            ${noteHtml}
          </div>
        `;
        timeline.appendChild(r);
      });

      var auditBox = document.querySelector('#admin-screen-reports-detail .audit-log');
      if (res.auditLogs && res.auditLogs.length > 0) {
        auditBox.style.display = 'flex';
        auditBox.querySelector('div').innerHTML = res.auditLogs.map(function(log){
          return `<p style="margin-bottom:4px;"><strong>${log.admin.name}:</strong> ${log.action} — ${log.reason} (${new Date(log.createdAt).toLocaleString()})</p>`;
        }).join('');
      } else {
        auditBox.style.display = 'none';
      }

      window.__currentReportDay = { emp: emp, month: month, day: day };
      showAdminScreen('reports-detail');
    } catch (e) { console.error(e); }
  }

  document.getElementById('btn-back-reports-months').addEventListener('click', function(){ showAdminScreen('reports-emp'); });
  document.getElementById('btn-back-reports-days').addEventListener('click', function(){ showAdminScreen('reports-months'); });
  document.getElementById('btn-back-from-detail').addEventListener('click', function(){ showAdminScreen(detailScreenBackTarget); });

  /* ---------- Reports: By Date ---------- */
  var tabByEmployee = document.getElementById('tab-by-employee');
  var tabByDate = document.getElementById('tab-by-date');

  tabByEmployee.addEventListener('click', function(){
    tabByEmployee.classList.add('active'); tabByDate.classList.remove('active');
    showAdminScreen('reports-emp');
  });
  tabByDate.addEventListener('click', function(){
    tabByDate.classList.add('active'); tabByEmployee.classList.remove('active');
    loadDateMonths();
  });

  async function loadDateMonths(){
    var listEl = document.getElementById('report-date-months-list');
    listEl.innerHTML = '';
    try {
      var res = await api('/reports/months');
      if (res.months.length === 0) listEl.innerHTML = '<p class="text-small">No history yet.</p>';
      res.months.forEach(function(m){
        var row = document.createElement('div');
        row.className = 'list-row';
        row.innerHTML = `<p class="text-body">${m.label}</p>${icons.chevron}`;
        row.addEventListener('click', function(){ loadDateDays(m); });
        listEl.appendChild(row);
      });
      showAdminScreen('reports-date-months');
    } catch (e) { console.error(e); }
  }

  async function loadDateDays(month){
    document.getElementById('date-days-header').textContent = month.label;
    var listEl = document.getElementById('report-date-days-list');
    listEl.innerHTML = '';
    var today = new Date();
    var isCurrentMonth = (month.year === today.getFullYear() && month.month === today.getMonth() + 1);
    var lastDay = isCurrentMonth ? today.getDate() : new Date(Date.UTC(month.year, month.month, 0)).getUTCDate();
    var weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    for (var d = 1; d <= lastDay; d++){
      (function(dayNum){
        var dateObj = new Date(Date.UTC(month.year, month.month - 1, dayNum));
        var weekday = weekdays[dateObj.getUTCDay()];
        var row = document.createElement('div');
        row.className = 'list-row';
        row.innerHTML = `<div style="display:flex; flex-direction:column; gap:4px"><p class="text-body" style="font-weight:700">${dayNum} ${weekday}</p></div>${icons.chevron}`;
        row.addEventListener('click', function(){ loadDateEmployees(month, dayNum); });
        listEl.appendChild(row);
      })(d);
    }
    showAdminScreen('reports-date-days');
  }

  async function loadDateEmployees(month, day){
    document.getElementById('date-employees-header').textContent = day + ' ' + month.label;
    var listEl = document.getElementById('report-date-employees-list');
    listEl.innerHTML = '';
    try {
      var res = await api('/reports/date/' + month.year + '/' + month.month + '/' + day);
      if (res.isHoliday) { listEl.innerHTML = '<p class="text-small">This is a holiday.</p>'; showAdminScreen('reports-date-employees'); return; }
      res.employees.forEach(function(emp){
        var initials = emp.name.split(' ').map(function(n){ return n[0]; }).join('').slice(0,2).toUpperCase();
        var flagged = emp.flags && emp.flags.length > 0;
        var sub = flagged ? emp.flags.join(' + ') : (emp.hasData ? formatDuration(emp.workedSeconds) + ' worked' : 'No data');
        var row = document.createElement('div');
        row.className = 'list-row' + (flagged ? ' flag' : '');
        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:16px">
            <div class="emp-avatar" style="background:var(--surface-muted); color:var(--text-main); width:40px; height:40px; font-size:14px; border: 1px solid var(--border-soft);">${initials}</div>
            <div><p class="text-body">${emp.name}</p><p class="text-small">${sub}</p></div>
          </div>
          ${icons.chevron}
        `;
        row.addEventListener('click', function(){ openReportDayDetail({ id: emp.employeeId, name: emp.name }, month, day, 'reports-date-employees'); });
        listEl.appendChild(row);
      });
      showAdminScreen('reports-date-employees');
    } catch (e) { console.error(e); }
  }

  document.getElementById('btn-back-date-months').addEventListener('click', function(){
    tabByDate.classList.remove('active'); tabByEmployee.classList.add('active'); showAdminScreen('reports-emp');
  });
  document.getElementById('btn-back-date-days').addEventListener('click', function(){ showAdminScreen('reports-date-months'); });
  document.getElementById('btn-back-date-employees').addEventListener('click', function(){ showAdminScreen('reports-date-days'); });

  /* ---------- Manual Edit modal ----------
     NOTE (known simplification): this edits whichever event's row was last
     rendered in the timeline — in practice the last event of the day
     (usually the checkout), which is the most common real-world fix
     (clearing a "forgot to check out" auto-checkout). Editing an
     arbitrary middle event isn't wired yet. */
  var modalEdit = document.getElementById('modal-edit');
  var editingEventId = null;

  document.getElementById('btn-open-edit-modal').addEventListener('click', function(){
    var rows = document.getElementById('detail-timeline').querySelectorAll('.log-row');
    if (rows.length === 0) { alert('No events to edit for this day'); return; }
    editingEventId = rows[rows.length - 1].dataset.eventId;
    modalEdit.classList.add('open');
  });
  document.getElementById('btn-cancel-edit').addEventListener('click', function(){ modalEdit.classList.remove('open'); });

  document.getElementById('btn-save-edit').addEventListener('click', async function(){
    var timeInputs = modalEdit.querySelectorAll('input[type="time"]');
    var newTime = timeInputs[1].value; // used as the corrected time for the selected event
    var reason = modalEdit.querySelector('textarea').value.trim();
    if (!newTime || !reason) { alert('Time and a reason note are both required'); return; }

    var d = window.__currentReportDay;
    var parts = newTime.split(':');
    // BD is UTC+6: subtract 6 hours to store the correct UTC instant for that BD local time.
    var newTimestamp = new Date(Date.UTC(d.month.year, d.month.month - 1, d.day, parseInt(parts[0], 10) - 6, parseInt(parts[1], 10)));

    try {
      await api('/reports/events/' + editingEventId, { method: 'PATCH', body: JSON.stringify({ newTimestamp: newTimestamp.toISOString(), reason: reason }) });
      modalEdit.classList.remove('open');
      openReportDayDetail(d.emp, d.month, d.day, detailScreenBackTarget);
    } catch (e) { alert(e.message); }
  });

  /* ---------- Broadcast Notices ---------- */
  async function loadBroadcastScreen(){
    var titleInput = document.querySelector('#admin-screen-broadcast input[type="text"]');
    var bodyInput = document.querySelector('#admin-screen-broadcast textarea');
    var durationSelect = document.querySelector('#admin-screen-broadcast select');
    var publishBtn = document.querySelector('#admin-screen-broadcast .btn-primary');
    var listContainer = document.querySelectorAll('#admin-screen-broadcast .two-col > div')[1];

    async function loadNoticeList(){
      listContainer.querySelectorAll('.list-row').forEach(function(r){ r.remove(); });
      try {
        var res = await api('/notices');
        var now = new Date();
        res.notices.forEach(function(n){
          var expired = new Date(n.expiresAt) < now;
          var status = n.revoked ? 'Revoked' : (expired ? 'Expired' : 'Expires ' + new Date(n.expiresAt).toLocaleString());
          var row = document.createElement('div');
          row.className = 'list-row';
          row.innerHTML = `
            <div style="display:flex; flex-direction:column; gap:4px">
              <p class="text-body" style="font-weight:700">${n.title}</p>
              <p class="text-small">${status}</p>
            </div>
            ${(!n.revoked && !expired) ? '<button class="btn-secondary revoke-btn" style="border-color:var(--accent-error); color:var(--accent-error)">Revoke</button>' : ''}
          `;
          var revokeBtn = row.querySelector('.revoke-btn');
          if (revokeBtn) revokeBtn.addEventListener('click', async function(){
            try { await api('/notices/' + n.id + '/revoke', { method: 'POST' }); loadNoticeList(); }
            catch (e) { alert(e.message); }
          });
          listContainer.appendChild(row);
        });
      } catch (e) { console.error(e); }
    }

    publishBtn.onclick = async function(){
      var title = titleInput.value.trim();
      var body = bodyInput.value.trim();
      var durationMap = { 0: 24, 1: 48, 2: 168 };
      var durationHours = durationMap[durationSelect.selectedIndex];
      if (!title || !body) { alert('Title and details are required'); return; }
      try {
        await api('/notices', { method: 'POST', body: JSON.stringify({ title: title, body: body, durationHours: durationHours }) });
        titleInput.value = ''; bodyInput.value = '';
        loadNoticeList();
      } catch (e) { alert(e.message); }
    };

    loadNoticeList();
  }

  /* ---------- Global Settings ---------- */
  async function loadSettingsScreen(){
    try {
      var res = await api('/admin/settings');
      document.querySelector('#admin-screen-settings input[type="time"]').value = res.settings.defaultDutyStartTime;
    } catch (e) { console.error(e); }

    try {
      var holidayRes = await api('/holidays');
      var weeklyDays = holidayRes.holidays.filter(function(h){ return h.type === 'WEEKLY'; }).map(function(h){ return h.dayOfWeek; });
      var checkboxes = document.querySelectorAll('.settings-holiday .checkbox-group input[type="checkbox"]');
      checkboxes.forEach(function(cb, idx){ cb.checked = weeklyDays.indexOf(idx) !== -1; });
      renderCustomHolidayList(holidayRes.holidays.filter(function(h){ return h.type === 'CUSTOM'; }));
    } catch (e) { console.error(e); }
  }

  function renderCustomHolidayList(customHolidays){
    var container = document.getElementById('custom-holiday-list');
    if (!container) {
      container = document.createElement('div');
      container.id = 'custom-holiday-list';
      container.style.marginTop = '16px';
      document.querySelector('.settings-holiday .form-group:last-child').appendChild(container);
    }
    container.innerHTML = '';
    customHolidays.forEach(function(h){
      var start = new Date(h.startDate).toLocaleDateString();
      var end = new Date(h.endDate).toLocaleDateString();
      var label = start === end ? start : (start + ' – ' + end);
      var row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `
        <div><p class="text-body">${h.title}</p><p class="text-small">${label}</p></div>
        <button class="btn-secondary" style="border-color:var(--accent-error); color:var(--accent-error)">Remove</button>
      `;
      row.querySelector('button').addEventListener('click', async function(){
        try { await api('/holidays/custom/' + h.id, { method: 'DELETE' }); loadSettingsScreen(); }
        catch (e) { alert(e.message); }
      });
      container.appendChild(row);
    });
  }

  document.querySelector('.settings-work-rules .btn-primary').addEventListener('click', async function(){
    var time = document.querySelector('#admin-screen-settings input[type="time"]').value;
    try {
      await api('/admin/settings', { method: 'PATCH', body: JSON.stringify({ defaultDutyStartTime: time }) });
      alert('Global duty time saved');
    } catch (e) { alert(e.message); }
  });

  document.querySelectorAll('.settings-holiday .checkbox-group input[type="checkbox"]').forEach(function(cb, dayOfWeek){
    cb.addEventListener('change', async function(){
      try {
        if (cb.checked) await api('/holidays/weekly', { method: 'POST', body: JSON.stringify({ dayOfWeek: dayOfWeek }) });
        else await api('/holidays/weekly/' + dayOfWeek, { method: 'DELETE' });
      } catch (e) { alert(e.message); cb.checked = !cb.checked; }
    });
  });

  document.querySelector('.settings-holiday .btn-secondary').addEventListener('click', async function(){
    var titleInput = document.querySelector('.settings-holiday input[type="text"]');
    var dateInputs = document.querySelectorAll('.settings-holiday input[type="date"]');
    var title = titleInput.value.trim();
    var startDate = dateInputs[0].value;
    var endDate = dateInputs[1].value;
    if (!title || !startDate) { alert('Holiday title and start date are required'); return; }
    try {
      await api('/holidays/custom', { method: 'POST', body: JSON.stringify({ title: title, startDate: startDate, endDate: endDate || undefined }) });
      titleInput.value = ''; dateInputs[0].value = ''; dateInputs[1].value = '';
      loadSettingsScreen();
    } catch (e) { alert(e.message); }
  });

  // ==========================================================================================
  setDateLabel();
  tryRestoreSession();

})();