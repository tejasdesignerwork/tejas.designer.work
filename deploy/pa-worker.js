/* Portfolio Analytics — Cloudflare Worker + D1
   POST /e            collects events from the portfolio (public, no cookies, bots filtered)
   GET  /             the private dashboard (asks for your key)
   GET  /api/stats    numbers for the dashboard (needs:  Authorization: Bearer <DASH_KEY>)
   Bindings: D1 database as DB · secret DASH_KEY · optional var ALLOWED_ORIGIN (e.g. "https://tejas.design") */

const CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Max-Age': '86400'};
const json = (o, s = 200) => new Response(JSON.stringify(o), {status: s, headers: {'content-type': 'application/json', 'cache-control': 'no-store'}});
const str = (v, n) => v == null || v === '' ? null : String(v).slice(0, n);
const int = v => Number.isFinite(+v) ? Math.round(+v) : null;
const ID = /^[a-z0-9]{8,32}$/;
const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|monitor|pingdom|curl|wget|python|go-http/i;

function ua(s){
  const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(s) ? 'Tablet' : /Mobi|iPhone|Android/i.test(s) ? 'Mobile' : 'Desktop';
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera' : /SamsungBrowser/.test(s) ? 'Samsung Internet' : /Firefox|FxiOS/.test(s) ? 'Firefox'
    : /Instagram/.test(s) ? 'Instagram app' : /FBAN|FBAV/.test(s) ? 'Facebook app' : /LinkedInApp/.test(s) ? 'LinkedIn app' : /CriOS|Chrome/.test(s) ? 'Chrome' : /Safari/.test(s) ? 'Safari' : 'Other';
  const os = /iPhone|iPad|iPod/.test(s) ? 'iOS' : /Android/.test(s) ? 'Android' : /Mac OS X|Macintosh/.test(s) ? 'macOS' : /Windows/.test(s) ? 'Windows' : /CrOS/.test(s) ? 'ChromeOS' : /Linux/.test(s) ? 'Linux' : 'Other';
  return {device, browser, os};
}
function refHost(r){ try { const h = new URL(r).hostname.replace(/^www\.|^m\.|^l\./, ''); return h === 'lm.facebook.com' ? 'facebook.com' : h; } catch(e){ return null; } }
// Dashboard key: a DASH_KEY secret if one is set, otherwise the SHA-256 fingerprint below (the key itself is never stored here).
const KEY_SHA256 = '7fba6d46cb9868920d5cc99e7255e6bd323d86a7f21620c0e87812c7a1ebfac7';
const DEFAULT_ORIGINS = 'https://tejasdesignerwork.github.io';
async function keyOk(k, env){
  if (!k) return false;
  if (env.DASH_KEY) return safeEq(k, env.DASH_KEY);
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(k));
  return safeEq([...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''), KEY_SHA256);
}
function safeEq(a, b){ if (!a || !b || a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; }

async function collect(req, env, ctx){
  if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: CORS});
  if (req.method !== 'POST') return new Response(null, {status: 405, headers: CORS});
  const agent = req.headers.get('user-agent') || '';
  if (!agent || BOT.test(agent)) return new Response(null, {status: 204, headers: CORS});
  { const allow = env.ALLOWED_ORIGIN || DEFAULT_ORIGINS, o = req.headers.get('origin') || ''; if (!allow.split(',').map(s => s.trim()).includes(o)) return new Response(null, {status: 403, headers: CORS}); }
  const text = await req.text(); if (text.length > 20000) return new Response(null, {status: 413, headers: CORS});
  let b; try { b = JSON.parse(text); } catch(e){ return new Response(null, {status: 400, headers: CORS}); }
  if (!b || !ID.test(b.v || '') || !ID.test(b.s || '') || !Array.isArray(b.ev)) return new Response(null, {status: 400, headers: CORS});
  const cf = req.cf || {}, u = ua(agent), now = Date.now();
  const ins = env.DB.prepare('INSERT INTO events (ts,vid,sid,type,name,val,path,ref,country,city,device,browser,os,sw,sh,lang) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const rows = b.ev.slice(0, 60).filter(e => e && ['view', 'hb', 'sys', 'act'].includes(e.t)).map(e => ins.bind(
    now - Math.min(600000, Math.max(0, int(e.a) || 0)), b.v, b.s, e.t, str(e.n, 40), str(e.v, 120), str(b.p, 200), refHost(b.r), cf.country || null, str(cf.city, 60),
    u.device, u.browser, u.os, int(b.sw), int(b.sh), str(b.l, 20)));
  if (rows.length) ctx.waitUntil(env.DB.batch(rows));
  return new Response(null, {status: 204, headers: CORS});
}

const SESS = `SELECT sid, MIN(vid) vid, MIN(ts) s, MAX(ts) e, SUM(type='act') acts, SUM(type='view') views,
  MAX(CASE WHEN name='shot' THEN CAST(val AS INTEGER) END) depth, MAX(name='loop') looped, MAX(name='enter') entered,
  MAX(CASE WHEN name='shoot' OR name='project' THEN 1 ELSE 0 END) content, MAX(name='open') opened, MAX(name='contact') contacted,
  MIN(country) country, MIN(city) city, MIN(device) device, MIN(browser) browser, MIN(os) os, MIN(ref) ref
  FROM events WHERE ts >= ? AND ts < ? GROUP BY sid`;

function summarize(ss){
  const n = ss.length, durs = ss.map(s => (s.e - s.s) / 1000).sort((a, b) => a - b);
  const bounced = ss.filter(s => (s.e - s.s) < 10000 && !s.acts && (s.depth == null || s.depth < 1)).length;
  return {sessions: n, visitors: new Set(ss.map(s => s.vid)).size, avgTime: n ? durs.reduce((a, b) => a + b, 0) / n : 0, medTime: n ? durs[Math.floor(n / 2)] : 0, bounce: n ? Math.round(bounced / n * 100) : 0};
}
function top(ss, k, limit = 8){ const m = new Map(); ss.forEach(s => m.set(s[k] || null, (m.get(s[k] || null) || 0) + 1)); return [...m].map(([k, n]) => ({k, n})).sort((a, b) => b.n - a.n).slice(0, limit); }

async function stats(env, days, tz){
  const DB = env.DB, now = Date.now(), span = days * 864e5, since = now - span;
  const all = (sql, ...b) => DB.prepare(sql).bind(...b).all().then(r => r.results || []);
  const [ss, prevSS, acts, live, ret] = await Promise.all([
    all(SESS, since, now + 1), all(SESS, since - span, since),
    all(`SELECT name, val, COUNT(*) c, COUNT(DISTINCT sid) u FROM events WHERE ts >= ? AND type = 'act' GROUP BY name, val ORDER BY u DESC`, since),
    all(`SELECT COUNT(DISTINCT sid) c FROM events WHERE ts >= ?`, now - 60000),
    all(`SELECT DISTINCT vid FROM events WHERE ts < ? AND vid IN (SELECT DISTINCT vid FROM events WHERE ts >= ?)`, since, since)
  ]);
  const cur = summarize(ss), prev = summarize(prevSS), retSet = new Set(ret.map(r => r.vid));
  // time series in the viewer's local time
  const off = tz * 60000, hourly = days <= 1, step = hourly ? 36e5 : 864e5, series = [];
  const start = Math.floor((since - off) / step) * step, n = Math.ceil((now - off - start) / step);
  for (let i = 0; i < n; i++){ const t = start + i * step, d = new Date(t); series.push({l: hourly ? String(d.getUTCHours()).padStart(2, '0') + ':00' : d.getUTCDate() + ' ' + d.toLocaleString('en', {month: 'short', timeZone: 'UTC'}), vs: new Set(), s: 0}); }
  const hours = Array(24).fill(0), depth = Array(8).fill(0);
  ss.forEach(s => { const i = Math.floor((s.s - off - start) / step); if (series[i]){ series[i].vs.add(s.vid); series[i].s++; } hours[new Date(s.s - off).getUTCHours()]++; if (s.depth != null && s.depth >= 0 && s.depth < 8) depth[s.depth]++; });
  const pick = name => acts.filter(a => a.name === name);
  const points = {}; pick('open').forEach(a => points[a.val] = a.u);
  const recentS = [...ss].sort((a, b) => b.s - a.s).slice(0, 30), ids = recentS.map(s => s.sid);
  const ra = ids.length ? await all(`SELECT sid, name, val FROM events WHERE type = 'act' AND sid IN (${ids.map(() => '?').join(',')}) ORDER BY ts`, ...ids) : [];
  const actsBy = {}; ra.forEach(a => (actsBy[a.sid] = actsBy[a.sid] || []).push({name: a.name, val: a.val}));
  const vids = new Set(ss.map(s => s.vid)), totActs = ss.reduce((a, s) => a + (s.acts || 0), 0);
  return {
    bucket: hourly ? 'hour' : 'day', live: live[0] ? live[0].c : 0,
    series: series.map(p => ({l: p.l, v: p.vs.size, s: p.s})),
    totals: {...cur, returning: vids.size ? Math.round(retSet.size / vids.size * 100) : 0, returningN: retSet.size,
      completed: cur.sessions ? Math.round(ss.filter(s => s.depth >= 7 || s.looped).length / cur.sessions * 100) : 0, acts: totActs},
    prev: prev.sessions ? prev : null,
    depth, hours, points,
    funnel: {entered: ss.filter(s => s.entered).length, room: ss.filter(s => s.depth >= 4).length, opened: ss.filter(s => s.opened).length,
      content: ss.filter(s => s.content).length, end: ss.filter(s => s.depth >= 7 || s.looped).length, contact: ss.filter(s => s.contacted).length},
    shoots: pick('shoot').slice(0, 12), projects: pick('project'), contact: pick('contact'),
    countries: top(ss, 'country'), devices: top(ss, 'device', 3), os: top(ss, 'os', 5), browsers: top(ss, 'browser'), refs: top(ss, 'ref'),
    recent: recentS.map(s => ({s: s.s, dur: (s.e - s.s) / 1000, country: s.country, city: s.city, device: s.device, os: s.os, browser: s.browser, depth: s.depth, ref: s.ref, returning: retSet.has(s.vid), acts: actsBy[s.sid] || []}))
  };
}

// creates the table on first use, so the database needs no manual setup
let schemaReady = null;
function ensureSchema(env){
  if (!schemaReady) schemaReady = env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, vid TEXT NOT NULL, sid TEXT NOT NULL, type TEXT NOT NULL, name TEXT, val TEXT, path TEXT, ref TEXT, country TEXT, city TEXT, device TEXT, browser TEXT, os TEXT, sw INTEGER, sh INTEGER, lang TEXT)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS ev_ts ON events(ts)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS ev_sid ON events(sid)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS ev_vid ON events(vid, ts)')
  ]).catch(e => { schemaReady = null; throw e; });
  return schemaReady;
}

// the dashboard page itself lives with the portfolio on GitHub Pages; it shows nothing without the key
const DASH_URL = 'https://tejasdesignerwork.github.io/tejas.designer.work/deploy/dashboard.html';
let dashCache = null, dashAt = 0;
async function dashboardHtml(){
  if (!dashCache || Date.now() - dashAt > 600000){ const r = await fetch(DASH_URL, {cf: {cacheTtl: 300}}); if (r.ok){ dashCache = await r.text(); dashAt = Date.now(); } }
  return dashCache || '<p>Dashboard is loading, refresh in a moment.</p>';
}

export default {
  async fetch(req, env, ctx){
    const url0 = new URL(req.url);
    if (env.DB && (url0.pathname === '/e' || url0.pathname === '/api/stats') && req.method !== 'OPTIONS') await ensureSchema(env);
    const url = new URL(req.url);
    if (url.pathname === '/e') return collect(req, env, ctx);
    if (url.pathname === '/api/stats'){
      const auth = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      if (!(await keyOk(auth, env))) return json({error: 'unauthorized'}, 401);
      const days = Math.min(365, Math.max(1, int(url.searchParams.get('days')) || 7)), tz = Math.max(-840, Math.min(840, int(url.searchParams.get('tz')) || 0));
      return json(await stats(env, days, tz));
    }
    if (url.pathname === '/' || url.pathname === '/dashboard')
      return new Response(await dashboardHtml(), {headers: {'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer'}});
    return new Response('Not found', {status: 404});
  }
};
