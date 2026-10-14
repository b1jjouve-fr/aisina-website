/* AISINA - logique des pages (moteur support.js).
   Les reglages de taille et de zoom (--H, --W, --sS, --iz, --hw et zoom)
   sont calcules ici, dans measure(), et nulle part ailleurs. */
window.AISINA = window.AISINA || {};

/* ---------------------------------------------------------------
   Accueil (index.html) - defilement ecran par ecran, zoom, parallaxe
   --------------------------------------------------------------- */
window.AISINA.accueil = function (DCLogic) {
  /* Largeur en dessous de laquelle la page passe en mise en page mobile
     (doit rester en accord avec la requete media de css/mobile.css). */
  const MOBILE_MAX = 760;
  /* Identifiants des fiches equipe, dans l'ordre d'affichage.
     Genere depuis content/equipe.json : voir outils/generer.py. */
  /* contenu:equipe-identifiants */
  const MEMBRES = ['m0', 'm1', 'm2', 'm3', 'm4'];
  /* /contenu:equipe-identifiants */
  return class Component extends DCLogic {
    constructor(...args) {
    super(...args);
    this.state = { fade: false, flat: false, mobile: false, menu: false, still: false, z: 1, vhd: 900, vwd: 1440, sS: 1, open: false, leaving: false, nav: 'studio', p: 0, slide: 0, ar: 0, active: -2, who: 0, sent: false,
      seenM: false, seenJ: false, seenE: false, seenC: false, offH: false, offM: true, offE: true, offC: true };
    this.auto = 0;
    this.inJ = false;
    this.raf = 0;
    this.onScr = () => { if (this.raf) return; this.raf = requestAnimationFrame(() => { this.raf = 0; this.measure(); }); };
    this.SC = ['hero', 'metier', 'jeux', 'jeux-b', 'eq-title', ...MEMBRES, 'missions', 'contact'];
    this.lock = 0; this.lastW = 0; this.lastAbs = 0; this.lastSy = 0; this.down = true;
    this.onWheel = (ev) => {
    if (this.state.flat || this.state.mobile) return;
    if (ev.ctrlKey || Math.abs(ev.deltaY) < Math.abs(ev.deltaX)) return;
    const tg = ev.target;
    if (tg && tg.closest && tg.closest('textarea')) return;
    ev.preventDefault();
    const now = Date.now();
    const ab = Math.abs(ev.deltaY);
    const fresh = now - this.lastW > 160 || ab > this.lastAbs * 1.6 + 4;
    this.lastW = now; this.lastAbs = ab;
    if (now < this.lock || !fresh || ab < 4) return;
    this.lock = now + 900;
    this.step(ev.deltaY > 0 ? 1 : -1);
    };
    this.onKey = (ev) => {
    if (ev.key === 'Escape' && this.state.menu) { this.setState({ menu: false }); return; }
    if (this.state.flat || this.state.mobile) return;
    if (ev.key === 'Escape' && this.state.open) { this.setState({ open: false }); return; }
    const tg = ev.target;
    if (tg && tg.closest && tg.closest('input,textarea,select,button,a')) return;
    const k = ev.key;
    let dir = 0;
    if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !ev.shiftKey)) dir = 1;
    else if (k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && ev.shiftKey)) dir = -1;
    if (k === 'Home') { ev.preventDefault(); this.go(this.SC[0]); return; }
    if (k === 'End') { ev.preventDefault(); this.go(this.SC[this.SC.length - 1]); return; }
    if (!dir) return;
    ev.preventDefault();
    const now = Date.now();
    if (now < this.lock) return;
    this.lock = now + 700;
    this.step(dir);
    };
    }
    componentDidMount() {
    window.addEventListener('scroll', this.onScr, true);
    window.addEventListener('resize', this.onScr);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    this.measure();
    this.t1 = setTimeout(() => this.measure(), 400);
    this.t2 = setTimeout(() => this.measure(), 1600);
    this.rejoindreAncre();
    if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => this.onScr()); this.ro.observe(document.documentElement); }
    }
    /* La page est construite par le moteur apres le chargement : quand on arrive
       avec une adresse du type index.html#jeux, le navigateur cherche l'ancre
       avant qu'elle existe et reste sur le hero. On la rejoint donc nous-memes,
       puis a nouveau une fois la mise en page stabilisee (images, polices).
       Toute action de l'utilisateur annule ce rattrapage. */
    rejoindreAncre() {
    const nom = (window.location.hash || '').slice(1);
    if (!nom || !document.getElementById(nom)) return;
    let abandon = false;
    const stop = () => { abandon = true; };
    window.addEventListener('wheel', stop, { once: true, passive: true });
    window.addEventListener('touchstart', stop, { once: true, passive: true });
    window.addEventListener('keydown', stop, { once: true });
    const poser = () => {
    if (abandon) return;
    const el = document.getElementById(nom);
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
    };
    poser();
    this.t3 = setTimeout(poser, 500);
    this.t4 = setTimeout(poser, 1700);
    }
    /* Le voile du menu couvre l'ecran : on bloque le defilement de la page
       tant qu'il est ouvert. La classe doit etre sur <html>, que le gabarit
       ne touche pas. */
    componentDidUpdate() {
    document.documentElement.classList.toggle('menu-ouvert', !!this.state.menu);
    }
    componentWillUnmount() {
    window.removeEventListener('scroll', this.onScr, true);
    window.removeEventListener('resize', this.onScr);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('wheel', this.onWheel);
    clearTimeout(this.t1);
    clearTimeout(this.t2);
    clearTimeout(this.t3);
    clearTimeout(this.t4);
    clearTimeout(this.stillT);
    if (this.ro) this.ro.disconnect();
    document.documentElement.classList.remove('menu-ouvert');
    }
    measure() {
    const d = document;
    const iw = window.innerWidth || 1440, ih = window.innerHeight || 900;
    const flat = ih / iw > 3;
    // Sous MOBILE_MAX, la page quitte le modele "toile fixe mise a l'echelle" :
    // le texte reprend sa taille reelle (z = 1) et seules les scenes peintes
    // restent mises a l'echelle, via --cz. Voir css/mobile.css.
    const cssMobilePret = getComputedStyle(document.documentElement)
      .getPropertyValue('--mobile-css').trim() === '1';
    const mob = !flat && iw <= MOBILE_MAX && cssMobilePret;
    const z = mob ? 1 : flat ? Math.min(1, iw / 1440) : Math.min(1, iw / 1200);
    const vh = mob ? ih : flat ? 900 : Math.round(ih / z);
    const rs = document.documentElement.style;
    if (rs.getPropertyValue('--H') !== vh + 'px') rs.setProperty('--H', vh + 'px');
    const vw = Math.round(iw / z);
    const sSv = Math.round(Math.max(1, vh / 900, vw / 1440) * 1000) / 1000;
    if (rs.getPropertyValue('--sS') !== String(sSv)) rs.setProperty('--sS', String(sSv));
    const czv = Math.round((mob ? iw / 1440 : 1) * 10000) / 10000;
    if (rs.getPropertyValue('--cz') !== String(czv)) rs.setProperty('--cz', String(czv));
    // L'en-tete garde l'aspect qu'il a aujourd'hui : une barre de 1440 px mise a l'echelle.
    const he = mob ? 1 : flat ? z : Math.min(1, z / 0.7);
    const hiz = Math.round(he / z * 10000) / 10000, hhw = Math.round(iw / he);
    if (rs.getPropertyValue('--iz') !== String(hiz)) rs.setProperty('--iz', String(hiz));
    if (rs.getPropertyValue('--hw') !== hhw + 'px') rs.setProperty('--hw', hhw + 'px');
    if (rs.getPropertyValue('--W') !== vw + 'px') rs.setProperty('--W', vw + 'px');
    const R = (id) => { const el = d.getElementById(id); if (!el) return null; const b = el.getBoundingClientRect(); return { top: b.top / z, bottom: b.bottom / z, height: b.height / z }; };
    const h = R('hero'), m = R('metier'), j = R('jeux'), e = R('equipe'), c = R('contact');
    if (!h || !m || !j || !e || !c) return;
    if (!(h.height > 0) || !(iw > 0) || !(ih > 0)) return;
    if (!mob && this.state.mobile) this.setState({ mobile: false, menu: false });
    if (flat) {
    if (!this.stillT) this.stillT = setTimeout(() => this.setState({ still: true }), 5500);
    const fl = { flat: true, z: Math.round(z * 10000) / 10000, vhd: 900, vwd: vw, sS: 1, nav: 'studio', leaving: false, p: 0, slide: 0, active: 0, open: false,
      seenM: true, seenJ: true, seenE: true, seenC: true, offH: true, offM: true, offE: true, offC: true };
    let chf = false;
    for (const k in fl) { if (fl[k] !== this.state[k]) { chf = true; break; } }
    if (chf) this.setState(fl);
    return;
    }
    const line = vh * 0.5;
    let nav = 'studio';
    if (j.top <= line) nav = 'jeux';
    if (e.top <= line) nav = 'equipe';
    if (c.top <= line) nav = 'contact';
    const sy0 = Math.max(window.pageYOffset || 0, document.documentElement.scrollTop || 0);
    const leaving = sy0 > 2 && h.top < -vh * 0.12;
    const cl = (x) => Math.max(0, Math.min(1, x));
    const sh = vh;
    const p = Math.round(cl(-j.top / Math.max(1, j.height - sh)) * 1000) / 1000;
    let slide = this.state.slide;
    const want = p >= 0.52 ? 1 : 0;
    if (want !== this.auto) { this.auto = want; slide = want; }
    const sy = Math.max(window.pageYOffset || 0, document.documentElement.scrollTop || 0);
    if (sy > this.lastSy + 1) this.down = true; else if (sy < this.lastSy - 1) this.down = false;
    this.lastSy = sy;
    let active = this.state.active;
    const secs = d.querySelectorAll('#equipe .mbr');
    if (secs.length) {
    active = -2;
    secs.forEach((s, i) => { if (s.getBoundingClientRect().top / z <= vh * 0.5) active = i; });
    const ms = d.getElementById('missions');
    if (ms && ms.getBoundingClientRect().top / z <= vh * (this.down ? 0.97 : 0.03)) active = -1;
    }
    const vis = (b) => b.bottom > 0 && b.top < vh;
    if (mob) {
    /* Mode mobile : on garde les mesures de visibilité calculées plus haut, pour
       que les titres et les textes s'animent à l'arrivée de chaque section comme
       sur ordinateur, et que les portraits d'équipe gardent leur apparition. */
    /* Sur téléphone, chaque photo est posée juste au-dessus de sa fiche : le
       portrait doit apparaître quand la photo entre dans l'écran, et non quand
       la fiche passe le milieu comme sur ordinateur. */
    let actifMob = -2;
    d.querySelectorAll('#equipe .ph').forEach((ph, i) => {
    if (ph.getBoundingClientRect().top <= vh * 0.75) actifMob = i;
    });
    const mo = { mobile: true, flat: false, still: false, z: 1, vhd: vh, vwd: vw, sS: 1, nav: 'studio',
      leaving: false, p: 0, slide: 0,
      active: actifMob,
      /* le manifeste reste sous le contrôle de son bouton : ne pas le refermer
         à chaque mesure, sinon il se referme seul dès qu'on défile */
      open: this.state.open,
      seenM: vis(m) && (this.state.seenM || m.top < vh * 0.75),
      seenJ: vis(j) && (this.state.seenJ || j.top < vh * 0.6),
      seenE: vis(e) && (this.state.seenE || e.top < vh * 0.7),
      seenC: vis(c) && (this.state.seenC || c.top < vh * 0.7),
      offH: !vis(h), offM: !vis(m), offE: !vis(e), offC: !vis(c) };
    let chm = false;
    for (const k in mo) { if (mo[k] !== this.state[k]) { chm = true; break; } }
    if (chm) this.setState(mo);
    return;
    }
    const next = {
    flat: false, still: false, z: Math.round(z * 10000) / 10000, vhd: vh, vwd: vw, sS: Math.round(Math.max(1, vh / 900, (iw / z) / 1440) * 1000) / 1000,
    nav, leaving, p, slide, active,
    open: this.state.open && h.top > -40,
    seenM: vis(m) && (this.state.seenM || m.top < vh * 0.75),
    seenJ: vis(j) && (this.state.seenJ || j.top < vh * 0.6),
    seenE: vis(e) && (this.state.seenE || e.top < vh * 0.7),
    seenC: vis(c) && (this.state.seenC || c.top < vh * 0.7),
    offH: !vis(h), offM: !vis(m), offE: !vis(e), offC: !vis(c)
    };
    const inJ = vis(j);
    if (inJ && !this.inJ) next.ar = 1 - this.state.ar;
    this.inJ = inJ;
    let ch = false;
    for (const k in next) { if (next[k] !== this.state[k]) { ch = true; break; } }
    if (ch) this.setState(next);
    }
    step(dir) {
    let best = 0, bd = 1e9;
    this.SC.forEach((id, i) => { const el = document.getElementById(id); if (!el) return; const dd = Math.abs(el.getBoundingClientRect().top); if (dd < bd) { bd = dd; best = i; } });
    const t = Math.max(0, Math.min(this.SC.length - 1, best + dir));
    this.go(this.SC[t]);
    }
    go(id, block) {
    const el = document.getElementById(id);
    if (!el) return;
    const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: block || 'start' });
    }
    renderVals() {
    const cl = (x) => Math.max(0, Math.min(1, x));
    const sm = (x) => { x = cl(x); return x * x * (3 - 2 * x); };
    const S = this.state;
    const p = S.p;
    const mkSt = (p) => {
    const F = [['wolf', 0.45], ['farmer', 0.8], ['skullcat', 1.0], ['bluecat', 1.0]];
    const T = [['portrait', 0.45], ['redhat', 0.65], ['judgestand', 0.5], ['bluehat', 0.85], ['judgeclose', 1.0]];
    const fo = sm((p - 0.36) / 0.26);
    const ti = sm((p - 0.38) / 0.28);
    const q = cl((p - 0.45) / 0.55);
    const st = {};
    st.foret = 'transform: scale(' + (1.02 + fo * 0.25 + p * 0.04).toFixed(4) + '); opacity: ' + (1 - sm((fo - 0.35) / 0.65)).toFixed(3) + '; filter: blur(' + (fo * 4).toFixed(1) + 'px);';
    st.tribunal = 'transform: scale(' + (1.22 - ti * 0.14 + q * 0.03).toFixed(4) + '); opacity: ' + sm(ti * 1.8).toFixed(3) + '; filter: brightness(0.82) saturate(0.95) blur(' + ((1 - ti) * 5).toFixed(1) + 'px);';
    F.forEach(([k, dd]) => {
    const sc = 1 + fo * (0.12 + 0.55 * dd);
    const tx = -p * 80 * (dd - 0.3);
    const ty = -p * 30 * dd;
    st[k] = 'transform: translate(' + tx.toFixed(1) + 'px, ' + ty.toFixed(1) + 'px) scale(' + sc.toFixed(4) + '); opacity: ' + (1 - sm((fo - 0.1) / 0.7)).toFixed(3) + '; filter: blur(' + (fo * (1.5 + 6 * dd)).toFixed(1) + 'px);';
    });
    T.forEach(([k, dd]) => {
    const sc = 0.78 + 0.22 * ti + 0.0;
    const tx = -q * 70 * (dd - 0.3);
    const ty = -q * 30 * dd;
    const op = cl((ti - (1 - Math.min(dd, 1)) * 0.25) / 0.5);
    st[k] = 'transform: translate(' + tx.toFixed(1) + 'px, ' + ty.toFixed(1) + 'px) scale(' + (sc + q * 0.04 * dd).toFixed(4) + '); opacity: ' + op.toFixed(3) + '; filter: blur(' + ((1 - ti) * (2 + 6 * dd)).toFixed(1) + 'px);';
    });
    st.dot = 'top: ' + (p * 232).toFixed(1) + 'px;';
    st.cue = 'opacity: ' + (1 - cl(p / 0.08)).toFixed(3) + ';';
    st.scrim = 'opacity: ' + (1 - 0.6 * sm((p - 0.35) / 0.3)).toFixed(3) + ';';
    return st;
    };
    const st = mkSt(p);
    const stB = mkSt(1);
    const on = (k) => 'opacity: ' + (k ? 1 : 0) + '; visibility: ' + (k ? 'visible' : 'hidden') + ';';
    const dot = (k) => 'background-color: ' + (k ? '#F3EEE3' : 'rgba(201, 191, 174, 0.45)') + ';';
    const cur = S.slide === 1 ? 1 : 0;
    const sl = { a: on(!cur), b: on(cur), da: dot(!cur), db: dot(cur), next: cur ? '← Le jeu' : 'La fabrication →' };
    const slB = { a: on(false), b: on(true), da: dot(false), db: dot(true), next: '' };

    const act = S.active;
    const pv = {};
    const bgi = act === -2 ? 0 : act;
    for (let i = 0; i < MEMBRES.length; i++) { const on = i === act; pv['p' + i] = 'opacity: ' + (i === bgi ? 1 : 0) + '; --po: ' + (on ? 1 : 0) + '; --py: ' + (on ? '0px' : '20px') + '; --pd: ' + (on ? '.2s' : '0s') + ';' + (act === -1 ? ' transition-duration: 0.28s;' : ''); }

    const w = S.who;
    const base = "cursor: pointer; padding: 10px 16px; border-radius: 999px; font-family: 'Space Mono', monospace; text-transform: uppercase; letter-spacing: 0.12em; font-size: 11px; ";
    const chip = (k) => base + (w === k ? 'background: rgba(243, 238, 227, 0.16); border: 1px solid #F3EEE3; color: #F3EEE3;' : 'background: transparent; border: 1px solid rgba(201, 191, 174, 0.5); color: #C9BFAE;');

    const L = S.leaving, nv = S.nav;
    const to = (id, blk) => (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); if (this.state.menu) this.setState({ menu: false }); this.go(id, blk); };
    const sec = (seen, off) => 'g snap' + (seen ? ' in' : '') + (off ? ' off' : '');
    const jgo = (k) => (ev) => {
    if (ev && ev.preventDefault) ev.preventDefault();
    this.setState({ slide: k });
    this.go(k ? 'jeux-b' : 'jeux-a');
    };
    return {
    ...pv,
    st, sl, stB, slB,
    rootStyle: S.z < 1 ? 'zoom: ' + S.z + ';' : '',
    jScale: 'transform: scale(' + S.sS + ');',
    frameD: 'M28.5 28.5 H' + (S.vwd - 28.5) + ' V' + (S.vhd - 28.5) + ' H84.5 A56 56 0 0 1 28.5 ' + (S.vhd - 84.5) + ' Z',
    rootClass: (S.open ? 'is-open' : '') + (L ? ' is-leaving' : '') + (S.mobile ? ' mobile' : '') + (S.menu ? ' menu-ouvert' : '') + (S.flat ? ' flat' : '') + (S.flat && S.still ? ' still' : ''),
    c1: L && nv === 'studio' ? 'cur' : '',
    c2: L && nv === 'jeux' ? 'cur' : '',
    c3: L && nv === 'equipe' ? 'cur' : '',
    c4: L && nv === 'contact' ? 'cur' : '',
    go1: to('metier'), go2: to('jeux'), go3: to('equipe'), go4: to('contact'), goTop: to('hero'),
    expanded: S.open ? 'true' : 'false',
    cartelLabel: S.open ? 'Refermer le manifeste' : 'Lire le manifeste',
    no: false,
    toggle: () => this.setState({ open: !this.state.open }),
    /* position du bouton manifeste : sur téléphone il se pose au-dessus du
       cartouche, et descend à 24 px du bord quand le manifeste est ouvert */
    cartelBas: S.mobile ? (S.open ? '24px' : '172px') : '82px',
    menuVisible: S.mobile,
    menuOuvert: S.menu ? 'true' : 'false',
    menuMot: S.menu ? 'Fermer' : 'Menu',
    menuLabel: S.menu ? 'Fermer le menu' : 'Ouvrir le menu',
    menuToggle: () => this.setState({ menu: !this.state.menu }),
    gM: sec(S.seenM, S.offM), gJ: sec(S.seenJ, false), gE: sec(S.seenE, S.offE), gC: sec(S.seenC, S.offC),
    fcls: 'fa' + S.ar,
    goA: jgo(0), goB: jgo(1),
    jtoggle: jgo(S.slide === 1 ? 0 : 1),
    goScroll: to('jeux-b'),
    toMissions: to('missions'),
    askMission: (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); this.setState({ who: 1, sent: false }); this.go('contact'); },
    ph: w === 1 ? 'Parlez-nous de votre studio, du profil ou de la mission que vous cherchez.' : 'Votre message',
    chip0: chip(0), chip1: chip(1), chip2: chip(2), chip3: chip(3),
    pick0: () => this.setState({ who: 0 }), pick1: () => this.setState({ who: 1 }), pick2: () => this.setState({ who: 2 }), pick3: () => this.setState({ who: 3 }),
    send: () => this.setState({ sent: true }),
    taChk: (e) => { const t = e && e.target; if (!t) return; const over = t.scrollHeight > t.clientHeight + 2 && t.scrollTop + t.clientHeight < t.scrollHeight - 2; if (over !== !!this.state.fade) this.setState({ fade: over }); },
    fadeO: this.state.fade ? 1 : 0,
    noop: (ev) => { if (ev && ev.preventDefault) ev.preventDefault(); },
    again: () => this.setState({ sent: false }),
    formStyle: S.sent ? 'display: none;' : '',
    doneStyle: S.sent ? '' : 'display: none;'
    };
    }
  };
};

/* ---------------------------------------------------------------
   Team building (team-building.html) - formulaire de contact
   --------------------------------------------------------------- */
window.AISINA.teamBuilding = function (DCLogic) {
  return class Component extends DCLogic {
    constructor(...args) {
    super(...args);
    this.state = { n: 0, sent: false, fade: false, menu: false };
    this.onEchap = (ev) => {
    if (ev.key === 'Escape' && this.state.menu) this.setState({ menu: false });
    };
    }
    componentDidMount() {
    window.addEventListener('keydown', this.onEchap);
    }
    componentWillUnmount() {
    window.removeEventListener('keydown', this.onEchap);
    document.documentElement.classList.remove('menu-ouvert');
    }
    /* le voile du menu couvre l'ecran : on bloque le defilement de la page */
    componentDidUpdate() {
    document.documentElement.classList.toggle('menu-ouvert', !!this.state.menu);
    }
    renderVals() {
    const n = this.state.n;
    const base = "cursor: pointer; padding: 9px 14px; border-radius: 999px; font-family: 'Space Mono', monospace; text-transform: uppercase; letter-spacing: 0.1em; font-size: 10px; ";
    const chip = (k) => base + (n === k ? 'background: rgba(243, 238, 227, 0.16); border: 1px solid #F3EEE3; color: #F3EEE3;' : 'background: transparent; border: 1px solid rgba(201, 191, 174, 0.5); color: #C9BFAE;');
    const sent = this.state.sent;
    return {
    rootClass: this.state.menu ? 'menu-ouvert' : '',
    menuOuvert: this.state.menu ? 'true' : 'false',
    menuMot: this.state.menu ? 'Fermer' : 'Menu',
    menuLabel: this.state.menu ? 'Fermer le menu' : 'Ouvrir le menu',
    menuToggle: () => this.setState({ menu: !this.state.menu }),
    chip0: chip(0), chip1: chip(1), chip2: chip(2), chip3: chip(3),
    pick0: () => this.setState({ n: 0 }),
    pick1: () => this.setState({ n: 1 }),
    pick2: () => this.setState({ n: 2 }),
    pick3: () => this.setState({ n: 3 }),
    send: () => this.setState({ sent: true }),
    taChk: (e) => { const t = e && e.target; if (!t) return; const over = t.scrollHeight > t.clientHeight + 2 && t.scrollTop + t.clientHeight < t.scrollHeight - 2; if (over !== !!this.state.fade) this.setState({ fade: over }); },
    fadeO: this.state.fade ? 1 : 0,
    again: () => this.setState({ sent: false }),
    formStyle: sent ? 'display: none;' : '',
    doneStyle: sent ? '' : 'display: none;'
    };
    }
  };
};
