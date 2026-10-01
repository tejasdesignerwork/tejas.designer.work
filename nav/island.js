/* Phone-only scene keys for the portfolio: a floating glass island with a frosted orange Fwd key on top and a
   frosted blue Back key below. Each press moves the paper ball, and the camera with it, one scene (same as scrolling).
   Needs three.js r147 (global), RoundedBoxGeometry and RoomEnvironment. Loaded by index.html on phones only. */
window.PfNavIsland = function(host, api){
  const SND = (() => {
    let C = null, out = null, verb = null, noise = null, on = true;
    try { on = localStorage.getItem('pf-nav-sound') !== 'off'; } catch (e) {}
    function ctx(){
      if (C) return C; const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
      C = new A(); out = C.createDynamicsCompressor(); out.threshold.value = -16; out.ratio.value = 3; out.connect(C.destination);
      verb = C.createConvolver(); const L = C.sampleRate * 1.2, ir = C.createBuffer(2, L, C.sampleRate);
      for (let ch = 0; ch < 2; ch++){ const d = ir.getChannelData(ch); for (let k = 0; k < L; k++) d[k] = (Math.random()*2-1) * Math.pow(1 - k/L, 3.5); }
      verb.buffer = ir; const vg = C.createGain(); vg.gain.value = 0.28; verb.connect(vg); vg.connect(out);
      noise = C.createBuffer(1, C.sampleRate, C.sampleRate); const nd = noise.getChannelData(0); for (let k = 0; k < nd.length; k++) nd[k] = Math.random()*2-1;
      return C;
    }
    const go = () => { if (!on) return null; const c = ctx(); if (c && c.state !== 'running') c.resume(); return c && c.state === 'running' ? c : null; };
    ['pointerdown','keydown'].forEach(ev => addEventListener(ev, () => { if (on){ const c = ctx(); c && c.resume(); } }, {capture: true, passive: true}));
    const env = (g, t, a, p, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(p, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
    const dst = (n, w) => { n.connect(out); if (w){ const s = C.createGain(); s.gain.value = w; n.connect(s); s.connect(verb); } };
    function tone(f, t, p, d, type, w, a){ const o = C.createOscillator(), g = C.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); env(g, t, a || 0.003, p, d); o.connect(g); dst(g, w); o.start(t); o.stop(t + d + 0.1); return o; }
    function nz(t, d, p, type, f, q, w, a){ const s = C.createBufferSource(), fl = C.createBiquadFilter(), g = C.createGain(); s.buffer = noise; s.loop = true; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q || 1; env(g, t, a || 0.002, p, d); s.connect(fl); fl.connect(g); dst(g, w); s.start(t, Math.random()*.8); s.stop(t + d + 0.1); return fl; }
    return {
      toggle(){ on = !on; try { localStorage.setItem('pf-nav-sound', on ? 'on' : 'off'); } catch (e) {} if (on) go(); return on; }, get on(){ return on; },
      hover(){ const c = go(); if (!c) return; const t = c.currentTime; nz(t, 0.012, 0.025, 'highpass', 5200, 0.7, 0.05); },
      // a thick plastic keycap bottoming out: low thock, a sharp click and a little case rattle
      down(kind){ const c = go(); if (!c) return; const t = c.currentTime;
        const o = tone(kind === 'fwd' ? 150 : 128, t, 0.22, 0.09, 'sine', 0.1); o.frequency.exponentialRampToValueAtTime(58, t + 0.08);
        nz(t, 0.008, 0.16, 'highpass', 3600, 0.8, 0.1); nz(t + 0.004, 0.045, 0.07, 'bandpass', kind === 'fwd' ? 1500 : 1150, 2.5, 0.2);
        if (kind === 'fwd'){ tone(1318, t + 0.01, 0.035, 0.5, 'sine', 0.5); tone(1976, t + 0.012, 0.02, 0.35, 'sine', 0.5); tone(2637, t + 0.014, 0.008, 0.2, 'sine', 0.4); } // the resin key rings like glass
        else { tone(740, t + 0.01, 0.02, 0.18, 'triangle', 0.3); } },
      up(){ const c = go(); if (!c) return; const t = c.currentTime + 0.11; nz(t, 0.006, 0.06, 'highpass', 4200, 0.7, 0.05); tone(420, t, 0.03, 0.03, 'sine', 0); },
      // the camera travelling with the ball
      move(dir){ const c = go(); if (!c) return; const t = c.currentTime + 0.05; const f = nz(t, 0.9, 0.05, 'bandpass', dir > 0 ? 380 : 2600, 0.9, 0.35, 0.35); f.frequency.exponentialRampToValueAtTime(dir > 0 ? 2600 : 380, t + 0.9);
        const r = tone(dir > 0 ? 70 : 90, t + 0.1, 0.04, 0.9, 'sine', 0.2, 0.3); r.frequency.exponentialRampToValueAtTime(dir > 0 ? 95 : 62, t + 1); },
      // paper crumpling, then a soft chime as it loops to the start
      loop(){ const c = go(); if (!c) return; const t = c.currentTime;
        for (let k = 0; k < 22; k++) nz(t + k * 0.03 + Math.random() * 0.02, 0.03 + Math.random() * 0.05, 0.05 + Math.random() * 0.06, 'bandpass', 1800 + Math.random() * 3800, 1.2, 0.2);
        tone(659, t + 0.85, 0.05, 1.2, 'sine', 0.6, 0.01); tone(988, t + 0.92, 0.035, 1.1, 'sine', 0.6, 0.01); },
      // the island gliding in, then two keys clicking into their wells
      slide(){ const c = go(); if (!c) return; const t = c.currentTime; const f = nz(t, 0.8, 0.06, 'bandpass', 3200, 0.8, 0.35, 0.25); f.frequency.exponentialRampToValueAtTime(500, t + 0.8);
        tone(1568, t + 0.75, 0.02, 0.6, 'sine', 0.5); tone(2349, t + 0.78, 0.012, 0.5, 'sine', 0.5);
        [0.95, 1.12].forEach(d => { nz(t + d, 0.01, 0.12, 'highpass', 3600, 0.8, 0.1); const o = tone(170, t + d, 0.14, 0.07, 'sine', 0.1); o.frequency.exponentialRampToValueAtTime(70, t + d + 0.06); }); },
      blocked(){ const c = go(); if (!c) return; const t = c.currentTime; tone(180, t, 0.08, 0.06, 'square', 0.05); nz(t, 0.02, 0.05, 'lowpass', 800, 0.7, 0); }
    };
  })();

  let keys = null;
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(24, 0.5, 0.1, 50);
  camera.position.set(-2.2, 1.1, 7.4); camera.lookAt(0, 0, 0);
  // studio light like the reference: a soft top key, a dim fill, warm light leaking from the resin key
  const key = new THREE.DirectionalLight(0xfff3e6, 2.2); key.position.set(-1.5, 4, 5); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, {left: -2, right: 2, top: 2.4, bottom: -2.4, near: 1, far: 14}); key.shadow.radius = 6; key.shadow.bias = -0.0008;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fd3e0, 0.8); rim.position.set(3, -1, -1); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x101010, 0.25));

  /* keycap: a squircle swept from a wider base to a smaller dished top, with a rounded top edge.
     UVs are projected from the front so the printed legend sits on the dish. */
  function keycapGeo(sizeB, H, sizeT, fillet, dish, n){
    const N = 72, rings = [];
    const SIDE = 7, FIL = 9, TOP = 12, aSideTop = sizeT + fillet;
    for (let k = 0; k <= SIDE; k++){ const t = k / SIDE; rings.push([sizeB + (aSideTop - sizeB) * t, (H - fillet) * t]); }
    for (let k = 1; k <= FIL; k++){ const f = k / FIL * Math.PI / 2; rings.push([sizeT + fillet * Math.cos(f), H - fillet + fillet * Math.sin(f)]); }
    for (let k = 1; k <= TOP; k++){ const a = sizeT * (1 - k / TOP); rings.push([a, H - dish * (1 - (a / sizeT) ** 2)]); }
    const pos = [], uv = [], idx = [];
    const se = th => { const c = Math.cos(th), s = Math.sin(th); return [Math.sign(c) * Math.abs(c) ** (2 / n), Math.sign(s) * Math.abs(s) ** (2 / n)]; };
    rings.forEach(([a, z]) => { for (let j = 0; j < N; j++){ const [x, y] = se(j / N * Math.PI * 2); pos.push(x * a, y * a, z); uv.push(x * a / (2 * sizeB) + 0.5, y * a / (2 * sizeB) + 0.5); } });
    for (let r = 0; r < rings.length - 1; r++) for (let j = 0; j < N; j++){
      const a = r * N + j, b = r * N + (j + 1) % N, c = (r + 1) * N + j, d = (r + 1) * N + (j + 1) % N;
      idx.push(a, b, d, a, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  // fine plastic grain for roughness / bump, so the gloss isn't perfectly smooth
  function grainTex(seed){
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), im = x.createImageData(256, 256);
    let r = seed; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < im.data.length; k += 4){ const v = 120 + rnd() * 40; im.data[k] = im.data[k+1] = im.data[k+2] = v; im.data[k+3] = 255; }
    x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 3); return t;
  }
  function frostTex(seed){
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d'), im = x.createImageData(512, 512);
    let r = seed; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < im.data.length; k += 4){ const v = 150 + (rnd() - .5) * 140; im.data[k] = im.data[k+1] = im.data[k+2] = v; im.data[k+3] = 255; }
    x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
  }
  function arrowPath(x, dir, s){
    x.beginPath();
    if (dir > 0){ x.moveTo(-s, 0); x.lineTo(s, 0); x.moveTo(s * .3, -s * .7); x.lineTo(s * 1.02, 0); x.lineTo(s * .3, s * .7); }
    else { x.moveTo(s, 0); x.lineTo(-s, 0); x.moveTo(-s * .3, -s * .7); x.lineTo(-s * 1.02, 0); x.lineTo(-s * .3, s * .7); }
  }
  // one legend design for both keys: a soft white arrow over a spaced word, pad-printed on the cap
  function legend(dir, word, bg){
    const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, 512, 512);
    x.translate(256, 236); x.lineCap = 'round'; x.lineJoin = 'round';
    x.shadowColor = 'rgba(255,255,255,.55)'; x.shadowBlur = 10;
    x.strokeStyle = '#fbf7f0'; x.lineWidth = 20; arrowPath(x, dir, 62); x.stroke();
    x.font = '700 46px "Space Mono", ui-monospace, monospace'; x.textAlign = 'center'; x.fillStyle = '#fbf7f0'; x.letterSpacing = '10px';
    x.fillText(word, 5, 112);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  }

  const island = new THREE.Group(); scene.add(island);
  // base: glossy black ceramic slab
  const base = new THREE.Mesh(new THREE.RoundedBoxGeometry(1.5, 3.36, 0.36, 8, 0.17),
    new THREE.MeshPhysicalMaterial({color: 0xeef6ff, transmission: 1, thickness: 0.36, ior: 1.46, roughness: 0.14, roughnessMap: grainTex(7),
      attenuationColor: new THREE.Color(0x9fc7dc), attenuationDistance: 2.2, clearcoat: 1, clearcoatRoughness: 0.05, specularIntensity: 1, envMapIntensity: 1.2}));
  base.receiveShadow = true; island.add(base);
  // a thin bright rim so the glass reads as a solid object over the dark scene
  const rimMat = new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.14, side: THREE.BackSide, depthWrite: false});
  island.add(new THREE.Mesh(new THREE.RoundedBoxGeometry(1.53, 3.39, 0.39, 8, 0.18), rimMat));
  const FRONT = 0.18;
  // sockets: matte rubber gaskets the keys sit in
  const gasketGeo = keycapGeo(0.6, 0.02, 0.56, 0.02, 0, 6), gasketMat = new THREE.MeshStandardMaterial({color: 0x050505, roughness: 0.85});
  // screws in the corners
  const screwMat = new THREE.MeshStandardMaterial({color: 0x9a9a9a, metalness: 1, roughness: 0.32}), slotMat = new THREE.MeshStandardMaterial({color: 0x1a1a1a, roughness: 0.6});
  [[-0.56, 1.5], [0.56, 1.5], [-0.56, -1.5], [0.56, -1.5]].forEach(([sx, sy]) => {
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 20), screwMat); sc.rotation.x = Math.PI / 2; sc.position.set(sx, sy, FRONT + 0.01); island.add(sc);
    const sl = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.012, 0.012), slotMat); sl.position.set(sx, sy, FRONT + 0.021); sl.rotation.z = Math.random() * Math.PI; island.add(sl);
  });
  // status LED and a tiny amber readout of the scene number
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshStandardMaterial({color: 0x331100, emissive: 0xff8a2b, emissiveIntensity: 0.4}));
  led.position.set(0, 1.5, FRONT + 0.01); island.add(led);
  const lcdC = document.createElement('canvas'); lcdC.width = 256; lcdC.height = 96; const lcdX = lcdC.getContext('2d'), lcdT = new THREE.CanvasTexture(lcdC); lcdT.encoding = THREE.sRGBEncoding;
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.29), new THREE.MeshBasicMaterial({map: lcdT, toneMapped: false}));
  lcd.position.set(0, -1.44, FRONT + 0.004); island.add(lcd);
  function drawLcd(n){
    lcdX.fillStyle = '#140b05'; lcdX.fillRect(0, 0, 256, 96);
    lcdX.font = '64px "VT323", ui-monospace, monospace'; lcdX.textAlign = 'center'; lcdX.textBaseline = 'middle';
    lcdX.fillStyle = 'rgba(255,157,58,.12)'; lcdX.fillText('88/88', 128, 50);
    lcdX.fillStyle = '#ffa24a'; lcdX.shadowColor = '#ff8a2b'; lcdX.shadowBlur = 10; lcdX.fillText(n + '/08', 128, 50); lcdX.shadowBlur = 0;
    for (let y = 0; y < 96; y += 3){ lcdX.fillStyle = 'rgba(0,0,0,.25)'; lcdX.fillRect(0, y, 256, 1); }
    lcdT.needsUpdate = true;
  }
  // soft warm halo behind the island
  const hc = document.createElement('canvas'); hc.width = hc.height = 128; const hx = hc.getContext('2d'), gr = hx.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); hx.fillStyle = gr; hx.fillRect(0, 0, 128, 128);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 4.6), new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(hc), transparent: true, depthWrite: false}));
  halo.position.z = -0.8; island.add(halo);

  const capGeo = keycapGeo(0.5, 0.56, 0.37, 0.07, 0.035, 5);
  function makeKey(y, kind){
    const g = new THREE.Group(); g.position.set(0, y, FRONT);
    const gk = new THREE.Mesh(gasketGeo, gasketMat); gk.position.z = 0.001; g.add(gk);
    const holder = new THREE.Group(); g.add(holder);       // moves when pressed
    // glossy plastic in the scene's two colours: the room's amber for forward, the desk's blue for back
    const col = kind === 'fwd' ? 0xff6a00 : 0x0f8fff, glowCol = kind === 'fwd' ? 0xffa040 : 0x4fc3ff;
    // frosted glass tinted with the key's colour: rough, light-scattering surface with a fine sandblasted grain
    const frost = frostTex(kind === 'fwd' ? 11 : 13);
    const cap = new THREE.Mesh(capGeo, new THREE.MeshPhysicalMaterial({color: 0xffffff,
      map: legend(kind === 'fwd' ? 1 : -1, kind === 'fwd' ? 'FWD' : 'BACK', '#' + new THREE.Color(col).getHexString()),
      transmission: 1, thickness: 0.6, ior: 1.45, roughness: 0.55, roughnessMap: frost, bumpMap: frost, bumpScale: 0.004,
      attenuationColor: new THREE.Color(col).lerp(new THREE.Color(0xffffff), 0.15), attenuationDistance: 1.4, specularIntensity: 0.7, clearcoat: 0.25, clearcoatRoughness: 0.4, envMapIntensity: 0.9,
      emissive: new THREE.Color(col), emissiveIntensity: 0}));
    // a soft glowing core inside the frosted glass, so the key lights from within
    const core = new THREE.Mesh(keycapGeo(0.3, 0.16, 0.26, 0.05, 0, 5), new THREE.MeshBasicMaterial({color: glowCol, toneMapped: false}));
    core.position.z = 0.2; core.scale.setScalar(1.15); holder.add(core); g.userData.core = core;
    // light under each key glows through the glass island in the key's colour
    const glow = new THREE.PointLight(glowCol, 0.9, 1.8, 2); glow.position.set(0, 0, -0.05); g.add(glow); g.userData.glow = glow;
    cap.castShadow = true; holder.add(cap);
    // stem under the cap, seen when the key is pressed
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.1), new THREE.MeshStandardMaterial({color: kind === 'fwd' ? 0x8a3410 : 0x174a6c, roughness: 0.5})); stem.position.z = -0.03; holder.add(stem);
    g.userData = {...g.userData, cap, holder, p: 0, v: 0, flash: 0, dim: false, hover: 0};
    island.add(g); return g;
  }
  keys = { fwd: makeKey(0.62, 'fwd'), back: makeKey(-0.62, 'back') };
  // intro: after the paper ball lands on the desk, the island slides in from the right edge and the keys pop up
  const intro = {t0: -1, k: 0};
  const easeOutBack = x => { const c1 = 1.6, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  function playIntro(delay){ intro.t0 = performance.now() + (delay || 0); intro.k = 0; setTimeout(() => SND.slide(), delay || 0); }


  function size(){ const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = 2 * Math.atan(2.0 / camera.position.length()) * 180 / Math.PI; camera.updateProjectionMatrix(); }
  new ResizeObserver(size).observe(host); size();

  const press = which => { const k = keys[which]; if (!k) return; k.userData.v = -1.1; k.userData.flash = 1; SND.down(which); SND.up(); };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let tx = 0, ty = 0, hot = null;
  function pick(e){
    const w = host.clientWidth, h = host.clientHeight;
    ndc.set(e.offsetX / w * 2 - 1, -(e.offsetY / h) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([keys.fwd.userData.cap, keys.back.userData.cap], false)[0];
    return hit ? (hit.object === keys.fwd.userData.cap ? 'fwd' : 'back') : null;
  }
  function act(k){
    if (hidden || intro.k < 0.9) return;
    const idx = api.index();
    try { window.pfTrack && window.pfTrack('nav', k); } catch (e) {}
    if (k === 'back'){
      press('back');
      if (idx <= 0){ SND.blocked(); return; }
      SND.move(-1); api.back(); return;
    }
    press('fwd');
    if (api.gated()){ SND.blocked(); api.fwd(); return; }
    if (idx >= 7) SND.loop(); else SND.move(1);
    api.fwd();
  }
  host.addEventListener('pointerdown', e => { e.stopPropagation(); const k = pick(e); if (k){ e.preventDefault(); act(k); } });
  ['pointerup', 'click', 'touchstart', 'touchend', 'wheel'].forEach(ev => host.addEventListener(ev, e => e.stopPropagation(), {passive: true}));
  host.addEventListener('pointermove', e => { e.stopPropagation(); tx = e.offsetX / host.clientWidth - .5; ty = e.offsetY / host.clientHeight - .5; hot = pick(e); });
  host.addEventListener('pointerleave', () => { tx = ty = 0; hot = null; });

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, clock = new THREE.Clock();
  let ry = 0, rx = 0, ledT = 0;
  let hidden = true, lastIdx = -1, frame = 0, busy = 30;
  renderer.setAnimationLoop(() => {
    if (hidden) return;
    const idx = api.index(); if (idx !== lastIdx){ lastIdx = idx; drawLcd(String(idx + 1).padStart(2, '0')); keys.back.userData.dim = idx === 0; busy = 30; }
    // keep the main room smooth: full rate only while something moves, ~20 fps when the island just floats
    frame++;
    const moving = intro.t0 < 0 || performance.now() - intro.t0 < 1800 || hot || keys.fwd.userData.flash > 0 || keys.back.userData.flash > 0 ||
      Math.abs(keys.fwd.userData.v) + Math.abs(keys.back.userData.v) > 0.002 || keys.fwd.userData.hover + keys.back.userData.hover > 0.01;
    if (moving) busy = 20; else if (busy > 0) busy--;
    if (!busy && frame % 3) return;
    renderer.shadowMap.autoUpdate = busy > 0 || frame % 30 === 0;
    const dt = Math.min(clock.getDelta(), 1/30), t = clock.elapsedTime;
    const bob = reduce ? 0 : Math.sin(t * 1.3) * 0.05;
    ry += ((-0.36 + tx * 0.5 + (reduce ? 0 : Math.sin(t * 0.7) * 0.05)) - ry) * (1 - Math.exp(-dt * 4));
    rx += ((0.1 + ty * 0.35) - rx) * (1 - Math.exp(-dt * 4));
    // slide-in (1.2 s), then the keys pop up one after the other
    let ix = 0, extraRy = 0;
    if (intro.t0 > 0){
      const e = (performance.now() - intro.t0) / 1000;
      const p = reduce ? 1 : Math.max(0, Math.min(1, e / 1.2));
      ix = 3.6 * (1 - easeOutBack(p)); extraRy = 0.9 * (1 - p) * (1 - p); intro.k = Math.min(1, Math.max(0, e / 1.2));
      for (const [n, d] of [['fwd', 0.95], ['back', 1.12]]){ const q = reduce ? 1 : Math.max(0, Math.min(1, (e - d) / 0.45)); keys[n].userData.holder.scale.setScalar(0.001 + 0.999 * easeOutBack(q)); }
    } else { ix = 3.6; for (const n of ['fwd', 'back']) keys[n].userData.holder.scale.setScalar(0.001); }
    island.position.set(ix, bob, 0); island.rotation.set(rx, ry - extraRy, reduce ? 0 : Math.sin(t * 0.9) * 0.02);
    for (const name of ['fwd', 'back']){
      const k = keys[name], u = k.userData;
      u.v += (-u.p * 200 - u.v * 15) * dt; u.p += u.v * dt * 1.2; if (u.p < -0.13){ u.p = -0.13; u.v = Math.abs(u.v) * 0.15; }
      u.hover += (((hot === name) ? 1 : 0) - u.hover) * (1 - Math.exp(-dt * 12));
      u.holder.position.z = u.p + u.hover * 0.015;
      u.flash = Math.max(0, u.flash - dt * 2.4);
      u.glow.intensity = (0.9 + u.flash * 2.4 + Math.sin(t * 2.2 + (name === 'fwd' ? 0 : 1.6)) * 0.08) * (u.dim ? 0.35 : 1) * intro.k;
      u.cap.material.emissiveIntensity = (0.4 + u.flash * 0.4) * (u.dim ? 0.4 : 1); u.cap.material.color.setScalar(u.dim ? 0.55 : 1);
      u.core.material.color.setHex(name === 'fwd' ? 0xffa040 : 0x4fc3ff).multiplyScalar((1.1 + u.flash * 1.1 + Math.sin(t * 2.2 + (name === 'fwd' ? 0 : 1.6)) * 0.05) * (u.dim ? 0.35 : 1));
    }
    ledT = Math.max(0, ledT - dt); led.material.emissiveIntensity = 0.35 + (Math.max(keys.fwd.userData.flash, keys.back.userData.flash)) * 3 + (reduce ? 0 : (Math.sin(t * 2) > 0.96 ? 0.6 : 0));
    renderer.render(scene, camera);
  });
  drawLcd('01');
  document.fonts && document.fonts.ready.then(() => { lastIdx = -1; });
  return {
    show(delay){ hidden = false; if (intro.t0 < 0) playIntro(delay || 0); },
    setHidden(h){ hidden = h; }
  };
};
