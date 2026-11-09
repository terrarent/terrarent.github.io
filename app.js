// TerraRent: óra, falukereső és térkép, kapumérő, talicskaszámoló, munkalap, kupac. Külső könyvtár nincs.
(() => {
  const $ = (id) => document.getElementById(id);
  const mozoghat = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TEL = '+36209677647', OLDAL = 'https://terrarent.github.io/';
  const SMS = (szoveg) => `sms:${TEL}?&body=${encodeURIComponent(szoveg)}`;

  /* --- Óra: Balassagyarmat, elérhetőség, napnyugta --- */
  const SZEL = 48.07, HOSSZ = 19.3;
  // Hétvégén is dolgoznak. PRÓBA: a 7–18 feltételezett, Bencével egyeztetendő
  const MUNKAIDO = { tol: 7, ig: 18, napok: [0, 1, 2, 3, 4, 5, 6] };
  function napnyugta(d) {
    const rad = Math.PI / 180;
    const n = Math.floor(d.getTime() / 864e5 + 2440587.5 - 2451545.0 + 0.0008);
    const js = n - HOSSZ / 360;
    const m = (357.5291 + 0.98560028 * js) % 360;
    const c = 1.9148 * Math.sin(m * rad) + 0.02 * Math.sin(2 * m * rad) + 0.0003 * Math.sin(3 * m * rad);
    const l = (m + c + 180 + 102.9372) % 360;
    const tr = 2451545.0 + js + 0.0053 * Math.sin(m * rad) - 0.0069 * Math.sin(2 * l * rad);
    const dek = Math.asin(Math.sin(l * rad) * Math.sin(23.44 * rad));
    const om = Math.acos((Math.sin(-0.83 * rad) - Math.sin(SZEL * rad) * Math.sin(dek)) / (Math.cos(SZEL * rad) * Math.cos(dek)));
    return new Date((tr + om / (2 * Math.PI) - 2440587.5) * 864e5);
  }
  function ora() {
    const most = new Date();
    const r = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false, timeZone: 'Europe/Budapest' }).formatToParts(most).map((p) => [p.type, p.value]));
    const nap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(r.weekday);
    const hivhato = MUNKAIDO.napok.includes(nap) && +r.hour >= MUNKAIDO.tol && +r.hour < MUNKAIDO.ig;
    const perc = Math.round((napnyugta(most) - most) / 6e4);
    const nyugta = perc > 0 ? ` Napnyugtáig ${Math.floor(perc / 60)} ó ${perc % 60} p.` : '';
    $('allapot').textContent = `Balassagyarmat, ${r.hour}:${r.minute}. ${hivhato ? 'Most hívható.' : 'Írj SMS-t, reggel visszahívunk.'}${nyugta}`;
  }
  ora();
  setInterval(ora, 3e4);

  /* --- Következő szabad nap. PRÓBA: ezt majd egy Google-táblázatból olvassa, most kitalált --- */
  const NAPNEV = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
  const szabad = new Date(Date.now() + 2 * 864e5);
  $('szabadnap').textContent = NAPNEV[szabad.getDay()];

  /* --- Falukereső és térkép --- */
  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
  const FALU = (window.TERKEP ? window.TERKEP.falvak : []).map(([nev, x, y, km, zona, mas]) => ({ nev, x, y, km, zona, mas, kulcs: norm(nev), kulcs2: norm(mas || '') }));

  const svg = $('terkep'), NS = 'http://www.w3.org/2000/svg';
  let jelolo = null;
  function el(nev, attr, szulo) {
    const e = document.createElementNS(NS, nev);
    for (const k in attr) e.setAttribute(k, attr[k]);
    if (szulo) szulo.appendChild(e);
    return e;
  }
  if (window.TERKEP) {
    const T = window.TERKEP;
    svg.setAttribute('viewBox', `0 0 ${T.w} ${T.h}`);
    el('image', { href: 'kep/terkep.svg', x: 0, y: 0, width: T.w, height: T.h }, svg);
    const orszag = (hol, nev) => { const t = el('text', { x: hol[0], y: hol[1], 'text-anchor': 'middle', 'font-size': 24, opacity: .7 }, svg); t.textContent = nev; };
    orszag(T.sk, 'Szlovákia');
    orszag(T.hu, 'Magyarország');
    // Az ingyenes zóna kiemelve: a Nyugat-Nógrád-pontok burka
    const burok = (p) => {
      const s = [...p].sort((a, b) => a[0] - b[0] || a[1] - b[1]), ker = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const fel = (l) => { const h = []; for (const q of l) { while (h.length > 1 && ker(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); } h.pop(); return h; };
      return [...fel(s), ...fel([...s].reverse())];
    };
    const zonaP = burok(FALU.filter((f) => f.zona === 1).map((f) => [f.x, f.y]));
    el('feGaussianBlur', { stdDeviation: 16 }, el('filter', { id: 'lagy', x: '-20%', y: '-20%', width: '140%', height: '140%' }, el('defs', {}, svg)));
    el('path', { class: 'zona', filter: 'url(#lagy)', d: `M${zonaP.map((q) => q.join(' ')).join('L')}Z` }, svg);
    for (const f of FALU) {
      f.pont = el('circle', { class: 'pont', cx: f.x, cy: f.y, r: 5.5, fill: f.zona === 1 ? '#F0A020' : '#fff' }, svg);
      f.pont.addEventListener('click', () => { $('falu').value = f.nev; valaszt(f); });
    }
    // Nagyobb települések nevei; a varos2 csak asztalon látszik, telefonon nem férne el
    const NEVEK = [['Salgótarján', 1, 'f'], ['Vác', 1, 'k'], ['Hatvan', 1, 'j'], ['Losonc', 1, 'k'], ['Fülek', 2, 'j'], ['Ipolyság', 1, 'k'], ['Nagykürtös', 1, 'k'], ['Rétság', 2, 'k'], ['Szécsény', 1, 'j'], ['Pásztó', 2, 'j'], ['Dunakeszi', 1, 'k'], ['Gödöllő', 2, 'j'], ['Gyöngyöspata', 2, 'j'], ['Szob', 2, 'k'], ['Bátonyterenye', 2, 'k'], ['Aszód', 2, 'k'], ['Letkés', 2, 'j']];
    for (const [nev, szint, old] of NEVEK) {
      const f = FALU.find((x) => x.nev === nev);
      if (!f) continue;
      el('circle', { class: szint === 2 ? 'varos2' : '', cx: f.x, cy: f.y, r: 8.5, fill: 'none', stroke: '#fff', 'stroke-width': 2 }, svg);
      const t = el('text', { class: `varos varos${szint}`, x: f.x + (old === 'j' ? 13 : old === 'f' ? 10 : -13), y: old === 'f' ? f.y - 20 : f.y + 7, 'text-anchor': old === 'j' ? 'start' : 'end' }, svg);
      t.textContent = nev;
      t.style.pointerEvents = 'none';
    }
    const kp = el('circle', { cx: T.kx, cy: T.ky, r: 12, fill: '#F0A020', stroke: '#141414', 'stroke-width': 3 }, svg);
    kp.style.pointerEvents = 'none';
    const kpt = el('text', { x: T.kx - 18, y: T.ky - 14, 'font-size': 28, 'font-weight': 900, 'text-anchor': 'end' }, svg);
    kpt.textContent = 'Balassagyarmat';
    jelolo = el('g', { visibility: 'hidden' }, svg);
    el('circle', { r: 16, fill: 'none', stroke: '#fff', 'stroke-width': 4 }, jelolo);
    el('text', { x: 24, y: 40, 'font-size': 32, 'font-weight': 900 }, jelolo);
  }

  function valaszt(f) {
    $('valasz').hidden = false;
    $('talalat').hidden = true;
    $('falu').setAttribute('aria-expanded', 'false');
    const km = Math.round(f.km);
    $('v1').textContent = `${f.nev}: igen.`;
    if (f.zona === 1) $('v2').textContent = 'Ingyenes kiszállás.';
    else $('v2').textContent = `Kb. ${km} km a balassagyarmati teleptől, légvonalban. A kiszállásról megállapodunk.`;
    $('v3').textContent = f.nev === 'Balassagyarmat' ? '' : 'Itt még nem ástunk, legyél az első.';
    if (jelolo) {
      jelolo.setAttribute('visibility', 'visible');
      const jobbra = f.x < window.TERKEP.w * .62;
      jelolo.setAttribute('transform', `translate(${f.x} ${f.y})`);
      const t = jelolo.querySelector('text');
      t.textContent = f.nev;
      t.setAttribute('x', jobbra ? 24 : -24);
      t.setAttribute('text-anchor', jobbra ? 'start' : 'end');
    }
    $('hely').value = f.nev;
    frissit();
  }
  function ismeretlen(szo) {
    $('valasz').hidden = false;
    $('v1').textContent = 'Ezt a falut nem találjuk.';
    $('v2').textContent = `„${szo}": hívj, a közelben valószínűleg kimegyünk.`;
    $('v3').textContent = '';
    if (jelolo) jelolo.setAttribute('visibility', 'hidden');
  }
  let talalatok = [], akt = -1;
  function listaz() {
    const q = norm($('falu').value), ul = $('talalat');
    ul.innerHTML = '';
    akt = -1;
    if (!q) { ul.hidden = true; $('falu').setAttribute('aria-expanded', 'false'); return; }
    talalatok = FALU.filter((f) => f.kulcs.includes(q) || f.kulcs2.includes(q))
      .sort((a, b) => (b.kulcs.startsWith(q) - a.kulcs.startsWith(q)) || a.km - b.km).slice(0, 5);
    for (const f of talalatok) {
      const li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.append(Object.assign(document.createElement('span'), { textContent: f.nev }), Object.assign(document.createElement('small'), { textContent: f.mas || `${Math.round(f.km)} km` }));
      li.addEventListener('pointerdown', (e) => { e.preventDefault(); $('falu').value = f.nev; valaszt(f); });
      ul.appendChild(li);
    }
    ul.hidden = !talalatok.length;
    $('falu').setAttribute('aria-expanded', String(!!talalatok.length));
  }
  $('falu').addEventListener('input', listaz);
  $('falu').addEventListener('blur', () => setTimeout(() => { $('talalat').hidden = true; }, 80));
  $('falu').addEventListener('keydown', (e) => {
    const lik = [...$('talalat').children];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!lik.length) return;
      akt = (akt + (e.key === 'ArrowDown' ? 1 : -1) + lik.length) % lik.length;
      lik.forEach((l, i) => l.setAttribute('aria-selected', i === akt));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const f = talalatok[akt] || talalatok[0], ertek = $('falu').value.trim();
      if (f && ertek) { $('falu').value = f.nev; valaszt(f); $('falu').blur(); }
      else if (ertek) ismeretlen(ertek);
    } else if (e.key === 'Escape') $('talalat').hidden = true;
  });

  /* --- Munkalap: SMS, Viber, email --- */
  const NEV = { arok: 'Árok', alap: 'Alap', kerites: 'Kerítés', rakodas: 'Föld, sóder, sitt', terep: 'Tereprendezés', komuves: 'Kőműves munka', bontas: 'Bontás', mas: 'Valami más' };
  const TANACS = {
    arok: 'Ehhez a kotró kell. 110 cm széles, befér a kapun.',
    alap: 'Ehhez a kotró kell. 2,2 méterig ér le.',
    kerites: 'Az alapot géppel ássuk ki, a kerítést felhúzzuk.',
    rakodas: 'Ehhez a homlokrakodó kell. A földet el is szállítjuk és elhelyezzük.',
    terep: 'A kotró és a homlokrakodó együtt, ha kell.',
    komuves: 'Falazás, vakolás, gipszkarton, betonozás. Írd le, mi kell.',
    bontas: 'Épületbontás. A fotó sokat segít.',
    mas: 'Írd le, megnézzük. Kis munkára is kimegyünk.',
  };
  const lap = $('lap'), cs = $('cs');
  let kapuMozgott = false, lapSzoveg = '';
  // A Viber-link nem visz magával szöveget, ezért vágólapra tesszük. A link ettől még megnyílik.
  $('viber').addEventListener('click', () => {
    const k = $('lapkesz');
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(lapSzoveg).then(() => {
      k.hidden = false;
      k.textContent = 'Kimásoltuk, amit kitöltöttél. A Viberben csak illeszd be.';
    }).catch(() => { /* másolás nélkül is megnyílik a Viber */ });
  });
  $('level').addEventListener('click', () => {
    const k = $('lapkesz');
    k.hidden = false;
    k.textContent = 'Ha nem nyílt meg a levelező, írj ide: terrarentbgy@gmail.com';
  });
  function frissit() {
    const adat = new FormData(lap);
    const munka = adat.get('munka');
    $('tanacs').textContent = munka ? TANACS[munka] : '';
    const sorok = ['Szia! Ezt kérném:', `Munka: ${munka ? NEV[munka] : ''}`, `Hely: ${(adat.get('hely') || '').trim()}`, `Mikor: ${adat.get('mikor') || ''}`];
    if (kapuMozgott) sorok.push(`Kapu szélessége: ${cs.value} cm`);
    const szoveg = sorok.join('\n');
    lapSzoveg = szoveg;
    $('sms').href = SMS(szoveg);
    $('level').href = `mailto:terrarentbgy@gmail.com?subject=${encodeURIComponent(`Ajánlatkérés: ${munka ? NEV[munka] : 'munka'}`)}&body=${encodeURIComponent(`${szoveg}\n\nA telefonszámom: `)}`;
  }
  lap.addEventListener('input', frissit);
  frissit();

  /* --- Szomszéd-üzenet --- */
  $('uzen').addEventListener('click', async () => {
    const szoveg = `Szia! Földmunkát csináltatok a TerraRenttel. Ha neked is kell valami, egy napra jönnek, és a megspórolt gépmozgatás a miénk. 06 70 856 6191, ${OLDAL}`;
    if (navigator.share) { try { await navigator.share({ text: szoveg }); } catch (e) { /* a látogató meggondolta magát */ } return; }
    try {
      await navigator.clipboard.writeText(szoveg);
      const k = $('uzenkesz'); k.hidden = false; k.textContent = 'Kimásoltuk az üzenetet, csak illeszd be.';
    } catch (e) { location.href = `sms:?&body=${encodeURIComponent(szoveg)}`; }
  });

  /* --- Kapumérő: minden ugyanabban a léptékben, a jelenet 290 cm széles, így a 250 cm-es kapu is kifér --- */
  const GEP = 110, JELENET = 290;
  function kapu() {
    const c = +cs.value, w = $('kapuk').clientWidth, p = w / JELENET, kozep = w / 2;
    $('bal').style.left = `${kozep - c / 2 * p - 16}px`;
    $('jobb').style.left = `${kozep + c / 2 * p}px`;
    $('szembol').style.width = `${GEP * p}px`;
    $('szembol').style.height = `${230 * p}px`;
    $('bal').style.height = $('jobb').style.height = `${200 * p}px`;
    $('kapuk').style.height = `${230 * p + 30}px`;
    $('meret').textContent = `${c} cm`;
    $('meret').style.left = `${kozep - c / 2 * p}px`;
    $('meret').style.width = `${c * p}px`;
    const f = c - GEP, it = $('itelet'), ma = $('magy');
    it.classList.toggle('rossz', f < 0);
    $('bal').classList.toggle('rossz', f < 0);
    $('jobb').classList.toggle('rossz', f < 0);
    if (f >= 5) { it.textContent = 'Átfér.'; ma.textContent = `Marad még ${f} cm.`; }
    else if (f >= 0) { it.textContent = 'Épp hogy.'; ma.textContent = 'Szoros, de átfér. Nézzük meg együtt.'; }
    else { it.textContent = 'Nem fér át.'; ma.textContent = `Hiányzik ${-f} cm. Hívj, megnézzük, van-e másik út.`; }
  }
  cs.addEventListener('input', () => { kapuMozgott = true; kapu(); frissit(); });
  // Érintésre a sáv bármely pontja működjön, ne csak a fogantyú (iPhone-on a natív csúszka ezt nem tudja)
  function csuszkaHuz(e) {
    const b = cs.getBoundingClientRect(), felgomb = 17;
    const t = Math.max(0, Math.min(1, (e.clientX - b.left - felgomb) / (b.width - 2 * felgomb)));
    cs.value = Math.round(+cs.min + t * (+cs.max - +cs.min));
    cs.dispatchEvent(new Event('input', { bubbles: true }));
  }
  cs.addEventListener('pointerdown', (e) => { cs.setPointerCapture(e.pointerId); csuszkaHuz(e); e.preventDefault(); });
  cs.addEventListener('pointermove', (e) => { if (cs.hasPointerCapture(e.pointerId)) csuszkaHuz(e); });
  addEventListener('resize', kapu);
  kapu();

  /* --- Talicskaszámoló: 60 literes talicska, lazulás nélkül --- */
  const szam = (id) => { const n = parseFloat($(id).value.replace(',', '.')); return n > 0 ? n : 0; };
  function szamol() {
    const m3 = szam('sz-h') * szam('sz-sz') * szam('sz-m');
    $('sz-m3').textContent = m3.toLocaleString('hu-HU', { maximumFractionDigits: 2 });
    $('sz-db').textContent = Math.ceil(m3 * 1000 / 60 - 1e-9).toLocaleString('hu-HU');
  }
  ['sz-h', 'sz-sz', 'sz-m'].forEach((i) => $(i).addEventListener('input', szamol));
  szamol();

  /* --- Kerítések: oszlop, tartó, kitöltés sorrendben épülnek fel, ha odaérsz --- */
  function kerites(nev, rajzol) {
    const fig = document.createElement('figure');
    fig.className = 'ker';
    const s = el('svg', { viewBox: '0 0 240 132', role: 'img', 'aria-label': nev }, fig);
    const elem = (tipus, attr, osztaly, kesleltet) => {
      const e = el(tipus, attr, s);
      e.setAttribute('class', `k ${osztaly}`);
      e.style.setProperty('--d', `${kesleltet}s`);
      return e;
    };
    rajzol(elem);
    for (const [i, x] of [12, 116, 220].entries()) elem('rect', { x, y: 16, width: 8, height: 106, fill: '#8C8E92' }, 'k-no', i * .12);
    el('path', { d: 'M0 122H240', stroke: '#6B5233', 'stroke-width': 4 }, s);
    fig.appendChild(Object.assign(document.createElement('figcaption'), { textContent: nev }));
    $('keritesek').appendChild(fig);
  }
  const SZAK = [[20, 116], [124, 220]];
  kerites('Lemezkerítés', (elem) => {
    let i = 0;
    for (const [a, b] of SZAK) for (let x = a; x < b; x += 12, i++) {
      elem('rect', { x, y: 26, width: Math.min(12, b - x), height: 94, fill: i % 2 ? '#D8880A' : '#F0A020' }, 'k-emel', .45 + i * .06);
      elem('rect', { x: x + 8, y: 26, width: 2, height: 94, fill: '#FBC765' }, 'k-emel', .45 + i * .06);
    }
  });
  kerites('Drótfonat', (elem) => {
    for (const y of [28, 118]) elem('path', { d: `M16 ${y}H224`, pathLength: 1, fill: 'none', stroke: '#C9C7C1', 'stroke-width': 2.4 }, 'k-huz', .4);
    let i = 0;
    for (const [a, b] of SZAK) for (let x = a - 76; x < b; x += 14, i++) {
      const vonal = (x1, y1, x2, y2) => {
        // A szemeket a két oszlop közé vágjuk
        const v = (t) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
        let t0 = 0, t1 = 1;
        if (x1 < a) t0 = (a - x1) / (x2 - x1);
        if (x2 > b) t1 = (b - x1) / (x2 - x1);
        if (t0 >= t1) return;
        const [p, q] = [v(t0), v(t1)];
        elem('path', { d: `M${p[0]} ${p[1]}L${q[0]} ${q[1]}`, pathLength: 1, fill: 'none', stroke: '#E8E6DF', 'stroke-width': 1.2 }, 'k-huz', .55 + i * .025);
      };
      vonal(x, 118, x + 90, 28);
      vonal(x, 28, x + 90, 118);
    }
  });
  kerites('Táblás kerítés', (elem) => {
    SZAK.forEach(([a, b], n) => {
      const d = .5 + n * .55, szin = '#A9B8AD', g = [];
      for (let x = a + 4; x < b - 2; x += 8) g.push(`M${x} 30V116`);
      for (const y of [32, 64, 68, 114]) g.push(`M${a} ${y}H${b}`);
      elem('path', { d: g.join(''), fill: 'none', stroke: szin, 'stroke-width': 2.2 }, 'k-hull', d);
    });
  });
  kerites('Fa kerítés', (elem) => {
    for (const y of [46, 100]) elem('rect', { x: 16, y, width: 208, height: 6, fill: '#7A5A36' }, 'k-no', .35);
    let i = 0;
    for (const [a, b] of SZAK) for (let x = a + 1; x < b - 9; x += 13, i++) {
      elem('path', { d: `M${x} 120V36l5-8 5 8V120z`, fill: i % 3 ? '#B98A55' : '#A87946' }, 'k-hull', .5 + i * .07);
    }
  });
  const ker = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('epul', e.isIntersecting)), { threshold: .35 });
  document.querySelectorAll('.ker').forEach((f) => ker.observe(f));

  /* --- Kupac a láblécben: Verlet-fizika, a kövek megnyugszanak, utána leáll. Koppintásra még egy lapátnyi jön. --- */
  const vas = $('kupac'), ctx = vas.getContext('2d');
  const SZIN = ['#6B5233', '#55432B', '#7D6342', '#3F3022', '#8C7350', '#F0A020'];
  const G = .2, MAX_ALLAS = 600;
  let W = 0, H = 0, R = 0, kovek = [], fut = false, lathato = false, szunet = 0, nyugalom = 0, keret = 0, utana = 0;
  function meretez() {
    const d = Math.min(devicePixelRatio || 1, 2), b = vas.getBoundingClientRect();
    W = b.width; H = b.height; R = Math.max(7, W / 62);
    vas.width = W * d; vas.height = H * d;
    ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  function uj(x, y) {
    const r = R * (.55 + Math.random() * .75);
    kovek.push({ x, y, px: x - (Math.random() - .5) * 1.4, py: y - 2 - Math.random() * 2, r, s: Math.random() < .07 ? SZIN[5] : SZIN[Math.floor(Math.random() * 5)], f: Math.random() * 6 });
  }
  function lepes() {
    for (const k of kovek) {
      if (k.alszik) continue;
      const vx = (k.x - k.px) * .992, vy = (k.y - k.py) * .992;
      k.px = k.x; k.py = k.y;
      k.x += vx; k.y += vy + G;
      k.tamasz = false;
    }
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < kovek.length; i++) for (let j = i + 1; j < kovek.length; j++) {
        const a = kovek[i], b = kovek[j];
        if (a.alszik && b.alszik) continue;
        const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r, t2 = dx * dx + dy * dy;
        if (t2 >= min * min || t2 < 1e-6) continue;
        const t = Math.sqrt(t2), atf = (min - t) * .85, nx = dx / t, ny = dy / t;
        // Az alvó kő nem mozdul, az ébert tolja el teljesen
        const sa = a.alszik ? 0 : b.alszik ? 1 : .5, sb = b.alszik ? 0 : a.alszik ? 1 : .5;
        a.x -= nx * atf * sa; a.y -= ny * atf * sa; b.x += nx * atf * sb; b.y += ny * atf * sb;
        // Súrlódás: az érintkező kövek lassulnak, ezért halom marad, nem terülnek szét
        if (!a.alszik) { a.px += (a.x - a.px) * .07; a.py += (a.y - a.py) * .07; if (dy > 0 && (b.alszik || b.tamasz)) a.tamasz = true; }
        if (!b.alszik) { b.px += (b.x - b.px) * .07; b.py += (b.y - b.py) * .07; if (dy < 0 && (a.alszik || a.tamasz)) b.tamasz = true; }
      }
      for (const k of kovek) {
        if (k.alszik) continue;
        if (k.y + k.r > H) { k.y = H - k.r; k.py = k.y; k.px += (k.x - k.px) * .35; k.tamasz = true; }
        if (k.x < k.r) { k.x = k.r; k.px = k.x; }
        if (k.x > W - k.r) { k.x = W - k.r; k.px = k.x; }
      }
    }
    // Ami megállt és alátámasztott, elalszik: így véget ér a mozgás, és nincs remegés
    for (const k of kovek) {
      if (k.alszik) continue;
      const seb = Math.max(Math.abs(k.x - k.px), Math.abs(k.y - k.py));
      k.csend = seb < .22 && k.tamasz ? (k.csend || 0) + 1 : 0;
      if (k.csend > 14) { k.alszik = true; k.px = k.x; k.py = k.y; }
    }
  }
  function mozgas() {
    let m = 0;
    for (const k of kovek) if (!k.alszik) m = Math.max(m, Math.abs(k.x - k.px), Math.abs(k.y - k.py), .2);
    return m;
  }
  function rajz() {
    ctx.clearRect(0, 0, W, H);
    for (const k of kovek) {
      ctx.fillStyle = k.s;
      ctx.beginPath();
      for (let a = 0; a < 7; a++) {
        const sz = a / 7 * Math.PI * 2, rr = k.r * (.84 + .18 * Math.sin(k.f + a * 2.3));
        const px = k.x + Math.cos(sz) * rr, py = k.y + Math.sin(sz) * rr;
        a ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  function szoras() {
    // Szélesen szórjuk, két kocka összeadva: középen több, a széleken kevesebb, így alacsony halom lesz
    const x = W * (.12 + .28 * (Math.random() + Math.random()) + .04);
    if (kovek.some((k) => Math.hypot(k.x - x, k.y) < k.r + R * 1.3)) { szunet -= .1; return; }
    szunet--;
    uj(x, -R);
  }
  function ciklus() {
    if (!lathato) { fut = false; return; }
    if (szunet > 0) szoras();
    keret++;
    lepes();
    rajz();
    nyugalom = mozgas() < .07 && szunet <= 0 ? nyugalom + 1 : 0;
    // Ha pár kő még billeg, a szórás után nem sokkal mind megáll
    utana = szunet <= 0 ? utana + 1 : 0;
    if (utana > 240) for (const k of kovek) k.alszik = true;
    if (nyugalom > 5 || keret > MAX_ALLAS) { fut = false; return; }
    requestAnimationFrame(ciklus);
  }
  function indit() { if (!fut && lathato) { fut = true; nyugalom = 0; keret = 0; utana = 0; requestAnimationFrame(ciklus); } }
  function felold() {
    if (kovek.length) return;
    const cel = Math.round(Math.min(120, W * H * .24 / (Math.PI * R * R * .85)));
    if (mozoghat) { szunet = cel; indit(); return; }
    szunet = cel;
    for (let i = 0; i < 1200; i++) { if (szunet > 0) szoras(); lepes(); }
    rajz();
  }
  new IntersectionObserver((es) => {
    lathato = es[0].isIntersecting;
    if (lathato) { felold(); indit(); }
  }, { threshold: .2 }).observe(vas);
  vas.addEventListener('pointerdown', (e) => {
    const b = vas.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
    for (const k of kovek) {
      const dx = k.x - x, dy = k.y - y, t = Math.hypot(dx, dy) || 1;
      if (t < R * 7) { const lok = (R * 7 - t) / (R * 7) * 7; k.alszik = false; k.csend = 0; k.px -= dx / t * lok; k.py -= dy / t * lok + 2; }
    }
    if (kovek.length < 200) for (let i = 0; i < 5; i++) uj(x + (Math.random() - .5) * R * 4, -R - i * R * 2);
    indit();
  });
  meretez();
  rajz();
  // Telefonon a címsor elrejtése is resize: csak valódi méretváltásnál rajzolunk újra
  addEventListener('resize', () => {
    const b = vas.getBoundingClientRect();
    if (Math.abs(b.width - W) < 1 && Math.abs(b.height - H) < 1) return;
    meretez();
    for (const k of kovek) { k.x = Math.min(k.x, W - k.r); k.y = Math.min(k.y, H - k.r); k.px = k.x; k.py = k.y; k.alszik = false; k.csend = 0; }
    if (kovek.length) indit();
    rajz();
  });
})();
