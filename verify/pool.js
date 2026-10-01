/* Verification puzzle pool.
   Every visit pulls fresh photos from Wikimedia Commons (free, CORS-enabled, no key) for a few
   random categories, keeps the ones that load, and adds them to this browser's own pool so the
   gallery keeps growing visit after visit. Falls back to the built-in images when offline. */
(function () {
  var GROUPS = [
    [['cats', 'Q146', 'cat'], ['dogs', 'Q144', 'dog']],
    [['bicycles', 'Q11442', 'bicycle'], ['motorcycles', 'Q34493', 'motorcycle'], ['trams', 'Q3407658', 'tram'],
     ['sailboats', 'Q1075310', 'sailboat'], ['hot air balloons', 'Q1551574', 'balloon']],
    [['guitars', 'Q6607', 'guitar'], ['violins', 'Q8355', 'violin'], ['pianos', 'Q5994', 'piano'],
     ['vinyl records', 'Q178588', 'record'], ['headphones', 'Q186819', 'headphones']],
    [['cameras', 'Q15328', 'camera'], ['typewriters', 'Q46335', 'typewriter']],
    [['lighthouses', 'Q39715', 'lighthouse'], ['windmills', 'Q38720', 'windmill']],
    [['sunflowers', 'Q171497', 'sunflower'], ['cacti', 'Q14560', 'cactus']],
    [['lanterns', 'Q862454', 'lantern'], ['teapots', 'Q245005', 'teapot']]
  ];
  var KEY = 'pf-cap-v1', CAP = 48, API = 'https://commons.wikimedia.org/w/api.php';
  var BAD = /diagram|logo|map|drawing|patent|stamp|icon|svg|chart|plan|scheme|poster|coat of arms|banknote|coin/i;

  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }
  function timeout(ms) { return new Promise(function (r) { setTimeout(function () { r(null); }, ms); }); }

  function search(q, word, withWord) {
    var s = (withWord ? word + ' ' : '') + 'haswbstatement:P180=' + q + ' filemime:image/jpeg';
    var u = API + '?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=24&gsrsort=random' +
      '&gsrsearch=' + encodeURIComponent(s) + '&prop=imageinfo&iiprop=url|size&iiurlwidth=320';
    return fetch(u).then(function (r) { return r.json(); }).then(function (j) {
      var pages = (j.query && j.query.pages) ? Object.values(j.query.pages) : [];
      return pages.filter(function (p) {
        var i = p.imageinfo && p.imageinfo[0]; if (!i || !i.thumburl || BAD.test(p.title)) return false;
        var r = i.width / i.height; return r > 0.6 && r < 1.9 && i.width >= 400;
      }).map(function (p) { return p.imageinfo[0].thumburl; });
    }).catch(function () { return []; });
  }
  function fetchCat(c) {
    return search(c[1], c[2], true).then(function (a) { return a.length >= 8 ? a : search(c[1], c[2], false).then(function (b) { return a.concat(b); }); });
  }
  function probe(url) {
    return new Promise(function (res) {
      var im = new Image(), done = false; im.crossOrigin = 'anonymous';
      im.onload = function () { if (!done) { done = true; res(im.naturalWidth > 0 ? url : null); } };
      im.onerror = function () { if (!done) { done = true; res(null); } };
      setTimeout(function () { if (!done) { done = true; res(null); } }, 7000);
      im.src = url;
    });
  }

  var promise = null;
  function build() {
    var pool = load(), picks = shuffle(GROUPS).slice(0, 4).map(function (g) { return g[Math.floor(Math.random() * g.length)]; });
    return Promise.all(picks.map(function (c) {
      return fetchCat(c).then(function (fresh) {
        var old = shuffle(pool[c[0]] || []).slice(0, 6);
        var cand = shuffle(fresh).slice(0, 7).concat(old).filter(function (u, i, a) { return a.indexOf(u) === i; });
        return Promise.all(cand.map(probe)).then(function (ok) {
          ok = ok.filter(Boolean);
          var merged = ok.concat(pool[c[0]] || []).filter(function (u, i, a) { return a.indexOf(u) === i; }).slice(0, CAP);
          if (ok.length) pool[c[0]] = merged;   // the pool grows with every visit
          return [c[0], ok];
        });
      });
    })).then(function (rows) {
      save(pool);
      var cats = {}; rows.forEach(function (r) { if (r[1].length >= 5) cats[r[0]] = r[1]; });
      return Object.keys(cats).length >= 3 ? { cats: cats, extra: [] } : null;
    });
  }
  window.__pfCapPool = function () {
    if (!promise) promise = Promise.race([build(), timeout(15000)]).catch(function () { return null; });
    return promise;
  };
  // start early so the photos are ready before the viewer reaches the tray
  setTimeout(window.__pfCapPool, 1500);
})();
