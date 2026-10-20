/* PAVEO — калькулятор, прайс, разрез основания, меню. Все цены — в #calc-data (index.html). */
(function () {
  'use strict';
  var RO = document.documentElement.lang === 'ro';
  var T = RO ? {
    cur: 'lei', m2: 'm²', days: function (n) { return n === 1 ? '1 zi' : n + ' zile'; },
    perM: function (v) { return '≈ ' + v + ' lei/m² la cheie'; },
    unit: { 'м²': 'm²', 'м.п.': 'm.l.', 'шт.': 'buc.', 'м³': 'm³' },
    noWalk: 'doar pentru alei',
    msg: function (d) {
      return 'Bună ziua! Am calculat pe site PAVEO:\n' +
        '• Suprafață: ' + d.area + ' m²\n• Ce pavăm: ' + d.use + '\n• Baza: ' + d.base + '\n• Acum pe teren: ' + d.old + '\n• Pavaj: ' + d.tile +
        (d.extras ? '\n• ' + d.extras : '') +
        '\nManoperă ≈ ' + d.work + ', materiale ≈ ' + d.mat + '\nTotal orientativ: ' + d.total + '\nAș dori o măsurare gratuită.';
    },
    depth: { walk: '25–30 cm', car: '35–45 cm', otm: 'circa 35 cm' }
  } : {
    cur: 'лей', m2: 'м²', days: function (n) { var m = n % 10, h = n % 100; return n + (m === 1 && h !== 11 ? ' день' : (m >= 2 && m <= 4 && (h < 12 || h > 14)) ? ' дня' : ' дней'); },
    perM: function (v) { return '≈ ' + v + ' лей/м² под ключ'; },
    unit: {},
    noWalk: 'только для дорожек',
    msg: function (d) {
      return 'Здравствуйте! Посчитал на сайте PAVEO:\n' +
        '• Площадь: ' + d.area + ' м²\n• Что укладываем: ' + d.use + '\n• Основание: ' + d.base + '\n• Сейчас на участке: ' + d.old + '\n• Плитка: ' + d.tile +
        (d.extras ? '\n• ' + d.extras : '') +
        '\nРабота ≈ ' + d.work + ', материалы ≈ ' + d.mat + '\nИтого ориентир: ' + d.total + '\nХочу бесплатный замер.';
    },
    depth: { walk: '25–30 см', car: '35–45 см', otm: 'около 35 см' }
  };

  var D = JSON.parse(document.getElementById('calc-data').textContent);
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var fmt = function (n) { return Math.round(n).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ' + T.cur; };
  var round = function (n, s) { return Math.round(n / s) * s; };

  /* ---------- меню ---------- */
  var burger = $('#burger'), nav = $('#nav');
  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', open);
  });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') { nav.classList.remove('is-open'); burger.setAttribute('aria-expanded', 'false'); }
  });

  /* ---------- калькулятор ---------- */
  var state = { area: 80, extras: {} };
  function pick(list) { var on = list.filter(function (x) { return x.on; })[0]; return (on || list[0]).id; }
  state.use = pick(D.uses); state.base = pick(D.bases); state.old = pick(D.olds); state.tile = pick(D.tiles);
  var byId = function (list, id) { return list.filter(function (x) { return x.id === id; })[0]; };

  function seg(group, list) {
    var box = $('.seg[data-group="' + group + '"]');
    list.forEach(function (x) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = x.t; b.dataset.id = x.id;
      if (x.s) b.title = x.s;
      b.setAttribute('aria-pressed', x.id === state[group]);
      b.addEventListener('click', function () {
        state[group] = x.id;
        [].forEach.call(box.children, function (c) { c.setAttribute('aria-pressed', c.dataset.id === x.id); });
        if (group === 'use') fixTile();
        calc();
      });
      box.appendChild(b);
    });
  }
  seg('use', D.uses); seg('base', D.bases); seg('old', D.olds);

  var tileSel = $('#tile');
  D.tiles.forEach(function (x) {
    var o = document.createElement('option'); o.value = x.id; o.textContent = x.t; o.selected = x.id === state.tile; tileSel.appendChild(o);
  });
  tileSel.addEventListener('change', function () { state.tile = tileSel.value; calc(); });
  function fixTile() {
    [].forEach.call(tileSel.options, function (o) {
      var t = byId(D.tiles, o.value);
      o.disabled = !!(t.walkOnly && state.use === 'car');
      o.textContent = t.t + (o.disabled ? ' — ' + T.noWalk : '');
    });
    if (tileSel.selectedOptions[0].disabled) { state.tile = 'v6'; tileSel.value = 'v6'; }
  }

  var ex = $('#extras');
  D.extras.forEach(function (x) {
    var row = document.createElement('label');
    row.className = 'extra';
    var u = T.unit[x.unit] || x.unit;
    row.innerHTML = '<span>' + x.t + '<small>' + (x.work + x.mat) + ' ' + T.cur + '/' + u + '</small></span>' +
      '<span class="area__num"><input type="number" min="0" max="2000" value="0" inputmode="numeric" data-ex="' + x.id + '"><span>' + u + '</span></span>';
    ex.appendChild(row);
  });
  ex.addEventListener('input', function (e) {
    if (e.target.dataset.ex) { state.extras[e.target.dataset.ex] = Math.max(0, +e.target.value || 0); calc(); }
  });

  var range = $('#areaRange'), num = $('#area');
  range.addEventListener('input', function () { num.value = range.value; state.area = +range.value; calc(); });
  num.addEventListener('input', function () {
    var v = Math.max(0, +num.value || 0); state.area = v;
    range.value = Math.min(+range.max, Math.max(+range.min, v)); calc();
  });

  var last = {};
  function calc() {
    var u = byId(D.uses, state.use), b = byId(D.bases, state.base), o = byId(D.olds, state.old), t = byId(D.tiles, state.tile);
    var area = Math.max(state.area || 0, D.minArea);
    var work = area * (u.work + b.work[u.id] + o.work + (t.workAdd || 0));
    var mat = area * (b.mat[u.id] + t.mat * 1.05);
    var exTxt = [];
    D.extras.forEach(function (x) {
      var q = state.extras[x.id] || 0;
      if (q) { work += q * x.work; mat += q * x.mat; exTxt.push(x.t + ': ' + q + ' ' + (T.unit[x.unit] || x.unit)); }
    });
    var total = work + mat, s = D.spread;
    var days = Math.ceil(area / D.perDay) + (b.id === 'ready' ? 0 : 1) + (o.work ? 1 : 0) + (b.days || 0);
    $('#sWork').textContent = fmt(round(work, 100));
    $('#sMat').textContent = mat ? fmt(round(mat, 100)) : '—';
    $('#sDays').textContent = T.days(days);
    var lo = round(total * (1 - s), 500), hi = round(total * (1 + s), 500);
    $('#sTotal').textContent = fmt(lo).replace(' ' + T.cur, '') + ' – ' + fmt(hi);
    $('#sPerM').textContent = T.perM(round(total / area, 5));
    last = { area: area, use: u.t, base: b.t, old: o.t, tile: t.t, extras: exTxt.join(', '), work: fmt(round(work, 100)), mat: fmt(round(mat, 100)), total: $('#sTotal').textContent };
    $('#sendWa').href = 'https://wa.me/' + D.phone + '?text=' + encodeURIComponent(T.msg(last));
  }
  fixTile(); calc();

  var toast = $('#toast');
  $('#sendViber').addEventListener('click', function () {
    var txt = T.msg(last);
    var go = function () { toast.hidden = false; setTimeout(function () { toast.hidden = true; }, 6000); location.href = 'viber://chat?number=%2B' + D.phone; };
    if (navigator.clipboard) navigator.clipboard.writeText(txt).then(go, go); else go();
  });

  /* ---------- прайс из того же JSON ---------- */
  var pt = $('#priceTable');
  if (pt) D.price.forEach(function (g) {
    var box = document.createElement('div'); box.className = 'price__grp';
    box.innerHTML = '<h3>' + g.g + '</h3>' + g.rows.map(function (r) {
      return '<p class="price__row"><span>' + r[0] + '</span><b>' + (RO ? 'de la ' : 'от ') + r[2] + ' ' + T.cur + '/' + (T.unit[r[1]] || r[1]) + '</b></p>';
    }).join('');
    pt.appendChild(box);
  });

  /* ---------- что под плиткой: вкладки дорожка / машина / отмостка ---------- */
  [].forEach.call(document.querySelectorAll('.tabs button'), function (btn, i, all) {
    btn.addEventListener('click', function () {
      var l = btn.dataset.load;
      [].forEach.call(all, function (b) { b.setAttribute('aria-selected', b === btn); });
      [].forEach.call(document.querySelectorAll('.pie[data-pie]'), function (p) { p.hidden = p.dataset.pie !== l; });
      $('#depth').textContent = T.depth[l];
    });
  });
})();
