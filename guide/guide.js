/* Site guide: an optional 30-second tour. It moves the camera through the room, says what each stop is,
   and waits for the viewer at the two steps that need them (moving, and the human check).
   Always available from the "? Guide" button (or the ? key). Works on desktop and the rotated phone layout. */
(function () {
  if (window.__pfGuideLoaded) return; window.__pfGuideLoaded = true;

  var coarse = matchMedia('(pointer: coarse)').matches;
  var phone = coarse && Math.min(innerWidth, innerHeight) <= 560;
  var KEY = 'pf-guide-seen';
  function seen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function markSeen() { try { localStorage.setItem(KEY, '1'); } catch (e) {} }
  function track(a, b) { try { window.pfTrack && window.pfTrack(a, b); } catch (e) {} }
  function seq() { return window.__seq; }
  function state() { try { return seq().getState(); } catch (e) { return { index: 0, verified: false }; } }
  function reachable(i) { return !!state().verified || i <= 1; }       // the human check at scene 1 gates everything after it

  var K = function (t) { return '<kbd>' + t + '</kbd>'; };
  var BACK = ' ' + (phone ? 'Tap Close to come back.' : 'Esc or Close brings you back.');
  var STEPS = [
    { k: 'Welcome', t: 'A room full of work', b: 'This 3D room holds my portfolio. A 30-second tour shows you how to move and what is inside. You stay in control the whole time.' },
    { k: 'Move', t: 'Roll the paper ball',
      b: phone ? 'Swipe, or tap the glowing <b>FWD</b> and <b>BACK</b> keys on the right edge. The ball rolls and the camera follows it.'
               : 'Scroll, or press ' + K('↑') + ' to go forward and ' + K('↓') + ' to go back. The ball rolls and the camera follows it.',
      wait: 'move', ask: 'Your turn: move one step', done: 'Nice, you are moving' },
    { k: 'Check', t: 'Quick human check', scene: 1, wait: 'verify',
      b: 'Pick every photo that matches the word on the tray, then press <b>VERIFY</b>. The photos change on every visit. It unlocks the rest of the room.',
      ask: 'Waiting for you to solve it', done: 'Access granted' },
    { k: 'Door', t: 'Into the box', scene: 3, b: 'Keep going. The ball drops into the box and the shutter lifts. That is the door into the room.' },
    { k: 'Room', t: 'Inside the room', scene: 4, b: 'Glowing rings mark what you can open: <b>Camera</b>, <b>Main system</b> and <b>Phone booth</b>. Keep moving to reach each one.' },
    { k: 'Camera', t: 'Camera · Photography', scene: 5, spot: 'Camera',
      b: 'Tap the glowing ring to open a sphere of photoshoots. Drag to spin it, tap a tile to see the full set.' + BACK },
    { k: 'System', t: 'Main system · Selected work', scene: 6, spot: 'Main system',
      b: 'Two case studies. <b>Thesis</b>: Kalari, an interactive screenplay with 18 frames and a film. <b>Application design</b>: UDIPI, a restaurant back-office app with an interactive 3D tour.' + BACK },
    { k: 'Booth', t: 'Phone booth · Contact', scene: 7, spot: 'Phone booth',
      b: 'Press the keys or lift the handset. Email and Instagram are inside.' + BACK },
    { k: 'End', t: 'That is the whole room', chips: true,
      b: 'Keep going past the booth: the paper crumples and the room loops back to the desk. Jump straight to a stop:' }
  ];
  var CHIPS = [['Camera', 5], ['Main system', 6], ['Phone booth', 7], ['Start over', 0]];

  /* ---------- styles ---------- */
  var css = [
    "#pf-guide{position:fixed;inset:0;z-index:26;pointer-events:none;font-family:'Space Mono',ui-monospace,Menlo,monospace;color:#e8e2d4;-webkit-font-smoothing:antialiased}",
    "#pf-guide.in-rot{position:absolute}",
    "#pf-guide.g-off{display:none}",
    "#pf-guide *{box-sizing:border-box}",
    ":where(#pf-guide) button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}",
    "#pf-guide button:focus-visible{outline:2px solid #ffb15c;outline-offset:2px}",
    "#pf-guide kbd{font:inherit;font-size:.92em;display:inline-block;min-width:1.7em;padding:1px 6px;text-align:center;border:1px solid rgba(232,226,212,.4);border-bottom-width:2px;border-radius:4px;color:#ffb15c}",
    "#pf-guide b{color:#ffb15c;font-weight:700}",
    ".g-fab{position:absolute;left:18px;top:18px;pointer-events:auto;display:flex;align-items:center;gap:9px;height:34px;padding:0 14px 0 6px;border:1px solid rgba(255,138,43,.55);border-radius:999px;background:rgba(8,7,6,.72);font-size:10px;letter-spacing:.2em;text-transform:uppercase;transition:border-color .2s,background .2s}",
    ".g-fab:hover{border-color:#ffb15c;background:rgba(22,13,6,.88)}",
    ".g-fab i{width:22px;height:22px;border-radius:50%;background:#ff8a2b;color:#150a02;display:grid;place-items:center;font:normal 700 13px/1 'Space Mono',monospace;letter-spacing:0}",
    ".g-fab.new i{animation:g-pulse 2s ease-out infinite}",
    "@keyframes g-pulse{0%{box-shadow:0 0 0 0 rgba(255,138,43,.75)}100%{box-shadow:0 0 0 12px rgba(255,138,43,0)}}",
    ".g-card{position:absolute;left:18px;bottom:64px;width:min(340px,calc(100% - 36px));max-height:calc(100% - 140px);overflow:auto;pointer-events:auto;padding:16px 16px 14px;background:rgba(8,7,6,.88);border:1px solid rgba(232,226,212,.14);border-left:2px solid #ff8a2b;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);box-shadow:0 18px 50px rgba(0,0,0,.5);animation:g-rise .35s cubic-bezier(.2,.8,.3,1)}",
    "@keyframes g-rise{from{transform:translateY(14px);opacity:0}}",
    "@keyframes g-fade{from{opacity:0;transform:translateY(5px)}}",
    ".g-body{animation:g-fade .3s ease}",
    ".g-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}",
    ".g-k{font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:#ff8a2b}",
    ".g-x{font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:#8d8578;padding:4px 0 4px 10px}",
    ".g-x:hover{color:#ff8a2b}",
    ".g-t{margin:0 0 8px;font:400 30px/1.05 'VT323','Space Mono',monospace;letter-spacing:.04em;color:#e8e2d4}",
    ".g-b{margin:0;font-size:12px;line-height:1.6;color:#cfc8b8}",
    ".g-s{margin-top:12px;display:flex;align-items:center;gap:9px;font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:#ffb15c}",
    ".g-s .d{width:7px;height:7px;border-radius:50%;background:#ff8a2b;animation:g-blink 1.1s ease-in-out infinite}",
    ".g-s.ok{color:#7fd39a}.g-s.ok .d{background:#7fd39a;animation:none}",
    "@keyframes g-blink{50%{opacity:.25}}",
    ".g-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}",
    ".g-chip{padding:7px 11px;border:1px solid rgba(255,138,43,.6);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:#ffb15c}",
    ".g-chip:hover:not(:disabled){background:rgba(255,138,43,.16)}",
    ".g-chip:disabled{opacity:.35;cursor:not-allowed}",
    ".g-note{margin-top:8px;font-size:10px;color:#8d8578}",
    ".g-bar{display:flex;gap:3px;margin:14px 0 12px}",
    ".g-bar i{flex:1;height:2px;background:rgba(232,226,212,.18);transition:background .3s}",
    ".g-bar i.on{background:#ff8a2b}",
    ".g-nav{display:flex;align-items:center;justify-content:space-between;gap:8px}",
    ".g-back{padding:9px 4px;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#8d8578}",
    ".g-back:hover:not(:disabled){color:#e8e2d4}.g-back:disabled{opacity:0;pointer-events:none}",
    ".g-next{padding:10px 16px;background:#ff8a2b;color:#150a02;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase}",
    ".g-next:hover:not(:disabled){background:#ffb15c}",
    ".g-next:disabled{opacity:.3;cursor:not-allowed}",
    ".g-bubble{position:absolute;left:18px;top:62px;max-width:min(280px,calc(100% - 36px));pointer-events:auto;padding:12px 14px;background:rgba(8,7,6,.92);border:1px solid rgba(255,138,43,.5);font-size:11px;line-height:1.55;animation:g-rise .35s cubic-bezier(.2,.8,.3,1)}",
    ".g-bubble b{display:block;margin-bottom:2px}",
    ".g-bubble .r{display:flex;gap:14px;margin-top:9px}",
    ".g-bubble button{font-size:10px;letter-spacing:.16em;text-transform:uppercase}",
    ".g-bubble .go{color:#ffb15c}.g-bubble .no{color:#8d8578}",
    /* phone: smaller, no blur */
    "#pf-guide.phone .g-fab{left:10px;top:10px;height:30px;padding:0 11px 0 5px;font-size:9px;letter-spacing:.16em;gap:7px}",
    "#pf-guide.phone .g-fab i{width:20px;height:20px;font-size:12px}",
    "#pf-guide.phone .g-card{left:10px;bottom:10px;width:min(262px,46%);max-height:calc(100% - 56px);padding:11px 12px 10px;-webkit-backdrop-filter:none;backdrop-filter:none;background:rgba(8,7,6,.92)}",
    "#pf-guide.phone .g-t{font-size:23px;margin-bottom:5px}",
    "#pf-guide.phone .g-b{font-size:10.5px;line-height:1.5}",
    "#pf-guide.phone .g-bar{margin:9px 0 8px}",
    "#pf-guide.phone .g-s{margin-top:8px;font-size:9px}",
    "#pf-guide.phone .g-bubble{left:10px;top:48px;font-size:10px}",
    "html.pf-guide #scroll-cue{opacity:0!important;pointer-events:none}",
    /* ring highlight on the 3D room's own markers */
    ".ts-spot.pf-tour-hl .ring{border-color:#ffb15c;transform:scale(1.5);box-shadow:0 0 0 3px rgba(255,177,92,.55),0 0 34px rgba(255,138,43,.95);transition:transform .3s ease}",
    ".ts-spot.pf-tour-hl label{opacity:1!important}",
    "@media (prefers-reduced-motion:reduce){#pf-guide *{animation:none!important}}"
  ].join('\n');
  var st = document.createElement('style'); st.id = 'pf-guide-css'; st.textContent = css; document.head.appendChild(st);

  /* ---------- dom ---------- */
  var root = document.createElement('div'); root.id = 'pf-guide'; root.className = 'g-off' + (phone ? ' phone' : '');
  var fab = document.createElement('button'); fab.className = 'g-fab'; fab.type = 'button'; fab.setAttribute('aria-label', 'Open the site guide');
  fab.innerHTML = '<i aria-hidden="true">?</i><span>Guide</span>';
  root.appendChild(fab);
  var card = null, bubble = null;
  ['wheel', 'touchstart', 'touchmove', 'touchend', 'pointerdown', 'pointerup', 'click', 'keydown'].forEach(function (ev) {
    root.addEventListener(ev, function (e) { e.stopPropagation(); }, { passive: true });
  });

  /* ---------- logic ---------- */
  var open = false, step = 0, landed = false, timer = 0, wasDone = false;
  function cur() { return STEPS[step]; }
  function isDone(s) {
    if (s.wait === 'move') return state().index >= 1;
    if (s.wait === 'verify') return !!state().verified || state().index > 1;
    return true;
  }
  function highlight(label) {
    var all = document.querySelectorAll('.ts-spot'), want = (label || '').toLowerCase();
    for (var i = 0; i < all.length; i++) {
      var on = !!want && all[i].textContent.toLowerCase().indexOf(want) === 0;
      all[i].classList.toggle('pf-tour-hl', on);
    }
  }
  function goScene(i) {
    if (i == null || !reachable(i)) return;
    try { if (state().index !== i) seq().goTo(i); } catch (e) {}
  }
  function hideBubble() { if (bubble) { bubble.remove(); bubble = null; } }

  function render() {
    if (!open) { if (card) { card.remove(); card = null; } return; }
    var s = cur(), n = STEPS.length, done = isDone(s);
    wasDone = done;
    if (!card) { card = document.createElement('div'); card.className = 'g-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-label', 'Site guide'); root.appendChild(card); }
    var last = step === n - 1, first = step === 0;
    var bar = ''; for (var i = 0; i < n; i++) bar += '<i' + (i <= step ? ' class="on"' : '') + '></i>';
    var status = '';
    if (s.wait) status = '<div class="g-s' + (done ? ' ok' : '') + '"><span class="d"></span><span>' + (done ? s.done : s.ask) + '</span></div>';
    var chips = '';
    if (s.chips) {
      chips = '<div class="g-chips">' + CHIPS.map(function (c) { return '<button class="g-chip" type="button" data-i="' + c[1] + '"' + (reachable(c[1]) ? '' : ' disabled') + '>' + c[0] + '</button>'; }).join('') + '</div>';
      if (!reachable(5)) chips += '<div class="g-note">Solve the human check to unlock the stops.</div>';
      else chips += '<div class="g-note">Reopen this guide any time with the ? button' + (phone ? '' : ' or the ? key') + '.</div>';
    }
    var nextLabel = first ? 'Start tour' : last ? 'Done' : (s.wait === 'move' && !done) ? 'Do it for me' : 'Next';
    var nextOff = s.wait === 'verify' && !done;
    card.innerHTML =
      '<div class="g-body">' +
      '<div class="g-top"><span class="g-k">Guide · ' + String(step + 1).padStart(2, '0') + '/' + String(n).padStart(2, '0') + '</span><button class="g-x" type="button" data-a="close">Close</button></div>' +
      '<h3 class="g-t">' + s.t + '</h3><p class="g-b">' + s.b + '</p>' + status + chips + '</div>' +
      '<div class="g-bar" aria-hidden="true">' + bar + '</div>' +
      '<div class="g-nav"><button class="g-back" type="button" data-a="back"' + (first ? ' disabled' : '') + '>Back</button>' +
      '<button class="g-next" type="button" data-a="next"' + (nextOff ? ' disabled' : '') + '>' + nextLabel + '</button></div>';
  }

  function go(n) {
    clearTimeout(timer);
    step = Math.max(0, Math.min(STEPS.length - 1, n));
    var s = cur(); render();
    goScene(s.scene); highlight(s.spot);
    track('guide', 'step-' + step);
  }
  function openGuide() {
    hideBubble(); markSeen(); fab.classList.remove('new');
    open = true; document.documentElement.classList.add('pf-guide');
    track('guide', 'open'); go(0);
  }
  function closeGuide(finished) {
    clearTimeout(timer); highlight(null);
    track('guide', finished ? 'done' : 'closed-at-' + step);
    open = false; document.documentElement.classList.remove('pf-guide'); render();
  }
  function next() {
    var s = cur();
    if (step === STEPS.length - 1) return closeGuide(true);
    if (s.wait === 'move' && !isDone(s)) { try { seq().advance(); } catch (e) {} return; }
    if (s.wait === 'verify' && !isDone(s)) return;
    go(step + 1);
  }

  root.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button'); if (!b) return;
    var a = b.getAttribute('data-a');
    if (b === fab) { open ? closeGuide(false) : openGuide(); }
    else if (a === 'close') closeGuide(false);
    else if (a === 'back') go(step - 1);
    else if (a === 'next') next();
    else if (a === 'bub-go') openGuide();
    else if (a === 'bub-no') { hideBubble(); markSeen(); fab.classList.remove('new'); }
    else if (b.classList.contains('g-chip')) { var i = +b.getAttribute('data-i'); track('guide', 'jump-' + i); goScene(i); }
  });

  /* react to the room: moving on, passing the check */
  function refresh() {
    if (!open) return;
    var s = cur(), d = isDone(s);
    if (s.wait && d && !wasDone) {                       // just completed: show the tick, then carry on
      render();
      var at = step; timer = setTimeout(function () { if (open && step === at) go(step + 1); }, 1500);
    } else if (s.chips) render();                        // chips depend on the gate
  }
  var hooked = false;
  function hook() {
    if (hooked || !seq() || !seq().on) return; hooked = true;
    ['shot', 'verified', 'loop'].forEach(function (n) { try { seq().on(n, function () { setTimeout(refresh, 30); }); } catch (e) {} });
  }

  /* ---------- placement and visibility ---------- */
  var enteredTicks = 0;
  function place() {
    hook();
    // safety net: if the ball-landed signal was missed, show the guide 16 s after the viewer entered
    if (!landed && state().entered && ++enteredTicks > 40) { landed = true; }
    var rot = document.querySelector('.ts-rotate-inner'), parent = rot || document.body;
    if (root.parentNode !== parent) parent.appendChild(root);
    root.classList.toggle('in-rot', !!rot);
    var blocked = !landed || document.querySelector('.ts-entry:not(.off)') || document.documentElement.classList.contains('idcard-on') ||
      document.querySelector('.ts-ovl, .ts-sphere-full, .ts-cam, .ts-crt, .ts-booth-full');
    root.classList.toggle('g-off', !!blocked);
    if (open && cur().spot && !blocked) highlight(cur().spot);
  }
  setInterval(place, 400);
  addEventListener('resize', place);

  window.addEventListener('pf-ball-land', function () {
    var first = !landed; landed = true; place();
    if (first && !seen()) {
      fab.classList.add('new');
      setTimeout(function () {
        if (open || seen() || bubble) return;
        bubble = document.createElement('div'); bubble.className = 'g-bubble';
        bubble.innerHTML = '<b>New here?</b>Take the 30-second tour of the room.<div class="r"><button type="button" class="go" data-a="bub-go">Start tour</button><button type="button" class="no" data-a="bub-no">Not now</button></div>';
        root.appendChild(bubble); markSeen();
        setTimeout(hideBubble, 14000);
      }, 7000);
    }
  });

  /* keyboard: ? toggles, Esc closes (only when no project is open) */
  addEventListener('keydown', function (e) {
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    var modal = document.querySelector('.ts-ovl, .ts-sphere-full, .ts-cam, .ts-crt, .ts-booth-full');
    if (typing || modal || root.classList.contains('g-off')) return;
    if (e.key === '?') { e.preventDefault(); open ? closeGuide(false) : openGuide(); }
    else if (e.key === 'Escape' && open) closeGuide(false);
  });
})();
