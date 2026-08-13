/* ============================================================================
 *  editor.js — the board content editor
 *
 *  Purpose: let somebody in the office change what the panel shows without
 *  opening a code file, and without being able to break it.
 *
 *  Design decisions worth knowing:
 *
 *  1. NO BUILD STEP, NO FRAMEWORK, NO INTERNET. This has to keep working in
 *     five years on whatever browser is on an office PC, so it is one plain
 *     script using the DOM directly. It also has to work when opened straight
 *     off a USB stick (file://), which rules out anything fetched from a CDN.
 *
 *  2. THE OUTPUT CANNOT BE MALFORMED. The editor never lets anyone type raw
 *     JavaScript. It holds the content as a data object and serialises it with
 *     JSON.stringify, so quoting and escaping are handled by the engine. The
 *     worst a user can do is write the wrong words.
 *
 *  3. SHA-256 IS IMPLEMENTED IN THIS FILE rather than using crypto.subtle.
 *     crypto.subtle only exists in a "secure context" — it is undefined on
 *     file:// pages. Since the manifest checksums are what tell the panel to
 *     download an update, that path has to work everywhere.
 *
 *  4. FITTING IS CHECKED, NOT ASSUMED. The preview is the real board in an
 *     iframe at true 3840x2160, and after every change it reports whether any
 *     card's content now exceeds its box. Adding an 18th cleaning zone tells
 *     you immediately that it will not fit, instead of at the panel.
 * ========================================================================== */
(function () {
  'use strict';

  const SCHEMA = window.BOARD_SCHEMA;
  const DRAFT_KEY = 'septona-board-draft-v1';

  // Working copy. Structured clone so edits never touch the loaded content.js.
  let data = deepCopy(window.BOARD);
  let baseline = JSON.stringify(data);   // to detect "has anything changed"
  let activeSection = SCHEMA.sections[0].key;
  let manifest = null;                   // existing manifest.json, once loaded

  const $ = (sel) => document.querySelector(sel);
  const form   = $('#form');
  const navEl  = $('#nav');
  const statusEl = $('#status');
  const frame  = $('#pvFrame');
  const fitEl  = $('#fitReport');

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  // ==========================================================================
  //  SHA-256 (see note 3 above)
  // ==========================================================================
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];

  function sha256Hex(bytes) {
    const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const len = bytes.length;
    // Pad to a multiple of 64 with room for the 0x80 byte and the 8-byte
    // length: ceil((len + 9) / 64) * 64.
    const withPad = new Uint8Array(((len + 9 + 63) >> 6) << 6);
    withPad.set(bytes);
    withPad[len] = 0x80;
    const bitLen = len * 8;
    // Length is written as a 64-bit big-endian value; 32 bits is plenty here
    // but write the high word too so the padding is strictly correct.
    const dv = new DataView(withPad.buffer);
    dv.setUint32(withPad.length - 8, Math.floor(bitLen / 4294967296));
    dv.setUint32(withPad.length - 4, bitLen >>> 0);

    const w = new Uint32Array(64);
    for (let off = 0; off < withPad.length; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15] >>> 3);
        const s1 = rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2] >>> 10);
        w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
      }
      let [a,b,c,d,e,f,g,hh] = h;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
        const mj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + mj) >>> 0;
        hh = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h[0]=(h[0]+a)>>>0; h[1]=(h[1]+b)>>>0; h[2]=(h[2]+c)>>>0; h[3]=(h[3]+d)>>>0;
      h[4]=(h[4]+e)>>>0; h[5]=(h[5]+f)>>>0; h[6]=(h[6]+g)>>>0; h[7]=(h[7]+hh)>>>0;
    }
    return h.map((x) => x.toString(16).padStart(8, '0')).join('');
  }
  function rotr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }
  function utf8(str) { return new TextEncoder().encode(str); }

  // ==========================================================================
  //  Serialise back to content.js
  // ==========================================================================
  //  Section comments are regenerated from this table, so the produced file
  //  stays as readable by hand as the original was. Data itself is emitted by
  //  JSON.stringify: valid JavaScript, and impossible to mis-quote.
  const SECTION_COMMENTS = {
    header:      'Заглавен ред на таблото / Board header',
    emergency:   'Спешни телефони — показват се най-горе / Emergency numbers',
    rules:       'Правила за шофьори и посетители (Заповед № 17) / Site rules',
    waste:       'Разделно събиране на отпадъци (Заповед № 16) / Waste separation',
    directory:   'Служебни телефони по отдели / Internal phone directory',
    committee:   'Комитет по условия на труд / Health & safety committee',
    fireSafety:  'Служители със сертификат по пожарна безопасност / Fire-safety certified staff',
    training:    'Годишна програма за обучение (E.160-1) / Annual training programme',
    inspections: 'Годишна програма за вътрешни инспекции (E.140-1/2) / Internal inspections',
    cleaning:    'Програма за почистване и дезинфекция (E.810-1/2) / Cleaning schedule',
    kiosk:       'Долна лента — насочва към тъч-киоска / Footer pointing to the kiosk',
  };

  function serialize(obj) {
    const now = new Date();
    const stamp = now.toLocaleString('bg-BG', { dateStyle: 'long', timeStyle: 'short' });
    let out = '';
    out += '/* ==========================================================================\n';
    out += ' *  content.js — ЦЯЛОТО СЪДЪРЖАНИЕ НА ТАБЛОТО / ALL BOARD CONTENT\n';
    out += ' *\n';
    out += ' *  Този файл беше създаден от редактора (editor.html) на ' + stamp + '.\n';
    out += ' *  This file was generated by the editor (editor.html).\n';
    out += ' *\n';
    out += ' *  Може да го редактирате и на ръка — променяйте само текста между\n';
    out += ' *  кавичките. Запазете всяка кавичка и всяка запетая на място.\n';
    out += ' *  You may also edit it by hand: change only the text inside the quotes\n';
    out += ' *  and keep every quote and comma exactly where it is.\n';
    out += ' *\n';
    out += ' *  СЛЕД ПРОМЯНА качете този файл И новия manifest.json в /ii/ на сървъра.\n';
    out += ' *  Без новия manifest.json панелът няма да забележи промяната.\n';
    out += ' * ======================================================================== */\n';
    out += 'window.BOARD = {\n';

    const keys = Object.keys(obj);
    keys.forEach((k, i) => {
      const cmt = SECTION_COMMENTS[k];
      out += '\n';
      if (cmt) {
        out += '  /* ---------------------------------------------------------------------\n';
        out += '     ' + cmt + '\n';
        out += '     --------------------------------------------------------------------- */\n';
      }
      const body = JSON.stringify(obj[k], null, 2)
        .split('\n').map((l, n) => (n === 0 ? l : '  ' + l)).join('\n');
      out += '  ' + JSON.stringify(k) + ': ' + body + (i < keys.length - 1 ? ',' : '') + '\n';
    });

    out += '};\n';
    return out;
  }

  // ==========================================================================
  //  Manifest regeneration
  // ==========================================================================
  //  Mirrors tools/build-manifest.py exactly: per-file sha256 + size, and a
  //  combined hash over (path + digest) in list order, truncated to 12 hex.
  //  Only content.js changes here, so the other entries are carried over.
  function rebuildManifest(contentText) {
    if (!manifest) return null;
    const m = deepCopy(manifest);
    const bytes = utf8(contentText);
    const entry = m.files.find((f) => f.path === 'content.js');
    if (!entry) throw new Error('manifest.json няма запис за content.js');
    entry.sha256 = sha256Hex(bytes);
    entry.size = bytes.length;

    let combined = '';
    m.files.forEach((f) => { combined += f.path + f.sha256; });
    m.version = sha256Hex(utf8(combined)).slice(0, 12);
    m.generatedAt = new Date().toISOString().replace(/\.\d+Z$/, '+00:00');
    return JSON.stringify(m, null, 2) + '\n';
  }

  // ==========================================================================
  //  Form building
  // ==========================================================================
  function icon(name, cls) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', cls || '');
    s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.8');
    s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    u.setAttribute('href', '#i-' + name);
    s.appendChild(u);
    return s;
  }

  function countItems(sec) {
    const d = data[sec.key] || {};
    let n = 0;
    (sec.lists || []).forEach((l) => { n += (d[l.key] || []).length; });
    if (sec.groups) (d[sec.groups.key] || []).forEach((g) => { n += (g[sec.groups.list.key] || []).length; });
    return n;
  }

  function buildNav() {
    navEl.innerHTML = '';
    SCHEMA.sections.forEach((sec) => {
      const b = document.createElement('button');
      b.className = sec.key === activeSection ? 'is-active' : '';
      b.appendChild(icon(sec.icon));
      const lbl = document.createElement('span');
      lbl.textContent = sec.label;
      b.appendChild(lbl);
      const n = countItems(sec);
      if (n) {
        const c = document.createElement('span');
        c.className = 'nav-count'; c.textContent = String(n);
        b.appendChild(c);
      }
      b.onclick = () => { activeSection = sec.key; buildNav(); buildForm(); form.scrollIntoView({ block: 'start' }); };
      navEl.appendChild(b);
    });
  }

  function makeInput(field, obj) {
    const isArea = field.type === 'area';
    const inp = document.createElement(isArea ? 'textarea' : 'input');
    if (!isArea) inp.type = 'text';
    inp.value = obj[field.key] != null ? obj[field.key] : '';
    // A table cell is narrower than most of its content, so keep the full value
    // available on hover as well as on focus.
    inp.title = inp.value;
    inp.oninput = () => { obj[field.key] = inp.value; inp.title = inp.value; touched(); };
    return inp;
  }

  function makeIconSelect(obj, key) {
    const sel = document.createElement('select');
    SCHEMA.icons.forEach(([val, name]) => {
      const o = document.createElement('option');
      o.value = val; o.textContent = name;
      if (obj[key] === val) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => { obj[key] = sel.value; touched(); };
    return sel;
  }

  // Column sizing. Fixed widths for short values (dates, phones) so the long
  // free-text columns get the room they need to be read while typing.
  const WIDTHS = { xs: '86px', sm: '150px', md: '190px', lg: 'minmax(0, 2fr)' };
  function widthOf(col) {
    return WIDTHS[col.width] || 'minmax(0, 1fr)';
  }

  // Renders one editable list: header row, the rows themselves, and an add
  // button that disables itself at the layout's practical maximum.
  function buildList(listDef, holder, parent) {
    const arr = holder[listDef.key] || (holder[listDef.key] = []);

    const h3 = document.createElement('h3');
    h3.textContent = listDef.label + ' (' + arr.length + ')';
    parent.appendChild(h3);

    const template = '28px ' + listDef.columns.map(widthOf).join(' ') + ' 68px';

    const head = document.createElement('div');
    head.className = 'col-head';
    head.style.gridTemplateColumns = template;
    head.appendChild(document.createElement('span'));
    listDef.columns.forEach((c) => {
      const s = document.createElement('span'); s.textContent = c.label; head.appendChild(s);
    });
    head.appendChild(document.createElement('span'));
    parent.appendChild(head);

    const rows = document.createElement('div');
    rows.className = 'rows';
    parent.appendChild(rows);

    arr.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.style.gridTemplateColumns = template;

      const n = document.createElement('span');
      n.className = 'row-n'; n.textContent = String(idx + 1);
      row.appendChild(n);

      listDef.columns.forEach((col) => {
        if (col.type === 'icon') {
          row.appendChild(makeIconSelect(item, col.key));
        } else if (col.type === 'check') {
          const wrap = document.createElement('span');
          wrap.className = 'chk';
          const cb = document.createElement('input');
          cb.type = 'checkbox'; cb.checked = !!item[col.key];
          cb.title = 'Показва правилото в червено';
          cb.onchange = () => { item[col.key] = cb.checked; if (!cb.checked) delete item[col.key]; touched(); };
          wrap.appendChild(cb);
          row.appendChild(wrap);
        } else {
          row.appendChild(makeInput(col, item));
        }
      });

      const acts = document.createElement('span');
      acts.className = 'row-acts';
      acts.appendChild(iconBtn('↑', 'Премести нагоре', idx === 0, () => { move(arr, idx, -1); }));
      acts.appendChild(iconBtn('↓', 'Премести надолу', idx === arr.length - 1, () => { move(arr, idx, 1); }));
      acts.appendChild(iconBtn('✕', 'Изтрий реда', false, () => {
        arr.splice(idx, 1); touched(); buildNav(); buildForm();
      }, 'btn-del'));
      row.appendChild(acts);

      rows.appendChild(row);
    });

    const add = document.createElement('button');
    add.className = 'btn btn-sm row-add';
    add.textContent = '+ Добави ред';
    add.disabled = arr.length >= listDef.max;
    add.onclick = () => { arr.push(deepCopy(listDef.blank)); touched(); buildNav(); buildForm(); };
    parent.appendChild(add);

    if (arr.length >= listDef.max) {
      const p = document.createElement('p');
      p.className = 'row-full';
      p.textContent = 'Достигнат е максимумът от ' + listDef.max +
        ' реда за тази секция — повече няма да се поберат на екрана.';
      parent.appendChild(p);
    }
  }

  function iconBtn(glyph, title, disabled, fn, extra) {
    const b = document.createElement('button');
    b.className = 'btn btn-icon' + (extra ? ' ' + extra : '');
    b.textContent = glyph; b.title = title; b.disabled = !!disabled;
    b.onclick = fn;
    return b;
  }

  function move(arr, idx, dir) {
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    const tmp = arr[idx]; arr[idx] = arr[j]; arr[j] = tmp;
    touched(); buildForm();
  }

  function buildForm() {
    const sec = SCHEMA.sections.find((s) => s.key === activeSection);
    const obj = data[sec.key] || (data[sec.key] = {});

    form.innerHTML = '';
    const panel = document.createElement('div');
    panel.className = 'panel';

    const h2 = document.createElement('h2'); h2.textContent = sec.label;
    panel.appendChild(h2);
    if (sec.hint) {
      const p = document.createElement('p'); p.className = 'hint'; p.textContent = sec.hint;
      panel.appendChild(p);
    }

    if (sec.fields && sec.fields.length) {
      const grid = document.createElement('div');
      grid.className = 'fields';
      sec.fields.forEach((f) => {
        const wrap = document.createElement('div');
        wrap.className = 'field' + (f.type === 'area' ? ' is-wide' : '');
        const lab = document.createElement('label');
        lab.textContent = f.label;
        wrap.appendChild(lab);
        wrap.appendChild(makeInput(f, obj));
        grid.appendChild(wrap);
      });
      panel.appendChild(grid);
    }

    (sec.lists || []).forEach((l) => buildList(l, obj, panel));

    // Directory: groups of people, each group itself a small editable block.
    if (sec.groups) {
      const g = sec.groups;
      const arr = obj[g.key] || (obj[g.key] = []);
      const h3 = document.createElement('h3');
      h3.textContent = g.label + ' (' + arr.length + ')';
      panel.appendChild(h3);

      arr.forEach((grp, gi) => {
        const box = document.createElement('div');
        box.className = 'group';
        const hd = document.createElement('div');
        hd.className = 'group-hd';
        g.header.forEach((f) => {
          const wrap = document.createElement('div');
          wrap.className = 'field';
          const lab = document.createElement('label'); lab.textContent = f.label;
          wrap.appendChild(lab); wrap.appendChild(makeInput(f, grp));
          hd.appendChild(wrap);
        });
        const acts = document.createElement('span');
        acts.className = 'row-acts';
        acts.appendChild(iconBtn('↑', 'Премести групата нагоре', gi === 0, () => move(arr, gi, -1)));
        acts.appendChild(iconBtn('↓', 'Премести групата надолу', gi === arr.length - 1, () => move(arr, gi, 1)));
        acts.appendChild(iconBtn('✕', 'Изтрий целия отдел', false, () => {
          if (!confirm('Да изтрия отдел „' + (grp.bg || '') + '“ с всички служители в него?')) return;
          arr.splice(gi, 1); touched(); buildNav(); buildForm();
        }, 'btn-del'));
        hd.appendChild(acts);
        box.appendChild(hd);
        buildList(g.list, grp, box);
        panel.appendChild(box);
      });

      const add = document.createElement('button');
      add.className = 'btn btn-sm row-add';
      add.textContent = '+ Добави отдел';
      add.disabled = arr.length >= g.max;
      add.onclick = () => { arr.push(deepCopy(g.blank)); touched(); buildNav(); buildForm(); };
      panel.appendChild(add);
    }

    form.appendChild(panel);
  }

  // ==========================================================================
  //  Live preview + fit checking
  // ==========================================================================
  let previewTimer = null;
  function pushPreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      if (!frame.contentWindow) return;
      frame.contentWindow.postMessage({ type: 'board:preview', board: deepCopy(data) }, '*');
    }, 220);
  }

  window.addEventListener('message', (ev) => {
    if (!ev.data) return;
    if (ev.data.type === 'board:report') showFit(ev.data.problems);
    if (ev.data.type === 'board:error') {
      fitEl.className = 'alert alert-err';
      fitEl.textContent = 'Грешка при показване: ' + ev.data.message;
    }
  });

  function showFit(problems) {
    if (!problems || !problems.length) {
      fitEl.className = 'alert alert-ok';
      fitEl.textContent = '✓ Всичко се побира на екрана 3840 × 2160.';
      return;
    }
    fitEl.className = 'alert alert-warn';
    fitEl.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = 'Внимание: текстът не се побира и част от него ще бъде отрязана на панела.';
    fitEl.appendChild(b);
    const ul = document.createElement('ul');
    problems.forEach((p) => {
      const li = document.createElement('li');
      li.textContent = p.label + ' — надвишава мястото с около ' + Math.round(p.over) + ' пиксела.';
      ul.appendChild(li);
    });
    fitEl.appendChild(ul);
    const note = document.createElement('div');
    note.style.marginTop = '6px';
    note.textContent = 'Премахнете ред или скратете текста в тази секция.';
    fitEl.appendChild(note);
  }

  function fitPreview() {
    const box = frame.parentElement;
    frame.style.transform = 'scale(' + (box.clientWidth / 3840) + ')';
  }
  window.addEventListener('resize', fitPreview);

  // ==========================================================================
  //  Dirty state + draft autosave
  // ==========================================================================
  function touched() {
    const changed = JSON.stringify(data) !== baseline;
    statusEl.className = 'status' + (changed ? ' is-dirty' : '');
    statusEl.textContent = changed ? '● Има незапазени промени' : 'Няма промени';
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(data)); } catch (e) {}
    pushPreview();
  }

  window.addEventListener('beforeunload', (e) => {
    if (JSON.stringify(data) === baseline) return;
    e.preventDefault(); e.returnValue = '';
  });

  // ==========================================================================
  //  Download / publish
  // ==========================================================================
  function download(name, text, mime) {
    const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  $('#btnDownload').onclick = () => {
    const content = serialize(data);
    let man = null, err = null;
    try { man = rebuildManifest(content); } catch (e) { err = e.message; }

    const dlg = $('#dlgDownload');
    const box = $('#dlFiles');
    box.innerHTML = '';

    addFileRow(box, 'content.js', 'Съдържанието на таблото', () => download('content.js', content, 'application/javascript'));
    if (man) {
      addFileRow(box, 'manifest.json', 'Списък с контролни суми — качете го ПОСЛЕДЕН',
        () => download('manifest.json', man, 'application/json'));
    }
    $('#dlWarn').style.display = man ? 'none' : 'block';
    if (err) $('#dlWarn').textContent = 'manifest.json не може да се обнови автоматично: ' + err;

    $('#btnDownloadBoth').onclick = () => {
      download('content.js', content, 'application/javascript');
      if (man) setTimeout(() => download('manifest.json', man, 'application/json'), 700);
      baseline = JSON.stringify(data);
      statusEl.className = 'status is-saved';
      statusEl.textContent = '✓ Файловете са изтеглени';
    };
    dlg.showModal();
  };

  function addFileRow(box, name, desc, fn) {
    const row = document.createElement('div');
    row.className = 'file-row';
    const b = document.createElement('b'); b.textContent = name;
    const d = document.createElement('span');
    d.style.cssText = 'flex:2;color:#5B6478;font-size:13px'; d.textContent = desc;
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm'; btn.textContent = 'Изтегли'; btn.onclick = fn;
    row.appendChild(b); row.appendChild(d); row.appendChild(btn);
    box.appendChild(row);
  }

  // Optional one-click publish, if save.php was uploaded to the server.
  $('#btnPublish').onclick = () => {
    const content = serialize(data);
    let man;
    try { man = rebuildManifest(content); } catch (e) {
      alert('Не мога да обновя manifest.json: ' + e.message); return;
    }
    if (!man) { alert('Първо трябва да се зареди manifest.json (отворете редактора от сървъра).'); return; }
    const pass = $('#pubPass').value;
    if (!pass) { $('#pubPass').focus(); return; }

    const out = $('#pubResult');
    out.className = 'alert'; out.textContent = 'Изпращам…';
    fetch('save.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass, 'content.js': content, 'manifest.json': man }),
    })
      .then((r) => r.json().catch(() => { throw new Error('Сървърът не отговори с JSON. save.php качен ли е и работи ли PHP?'); }))
      .then((j) => {
        if (!j.ok) throw new Error(j.error || 'неизвестна грешка');
        out.className = 'alert alert-ok';
        out.textContent = '✓ Публикувано. Панелът ще се обнови до 5 минути. Версия: ' + (j.version || '');
        baseline = JSON.stringify(data);
        statusEl.className = 'status is-saved';
        statusEl.textContent = '✓ Публикувано';
      })
      .catch((e) => {
        out.className = 'alert alert-err';
        out.textContent = 'Неуспешно: ' + e.message + ' — използвайте „Изтегли файловете“ и качете ръчно.';
      });
  };

  $('#btnPublishOpen').onclick = () => { $('#pubResult').textContent = ''; $('#dlgPublish').showModal(); };
  document.querySelectorAll('[data-close]').forEach((b) => {
    b.onclick = () => b.closest('dialog').close();
  });

  // Load a content.js from disk (e.g. restoring last year's version).
  $('#fileOpen').onchange = (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const scope = {};
        new Function('window', String(r.result))(scope);
        if (!scope.BOARD) throw new Error('файлът не съдържа window.BOARD');
        data = scope.BOARD;
        baseline = '';
        buildNav(); buildForm(); touched();
        alert('Файлът е зареден.');
      } catch (e) {
        alert('Не мога да прочета файла: ' + e.message);
      }
    };
    r.readAsText(f, 'utf-8');
  };

  // manifest.json picker, for when the editor runs from file:// and cannot fetch.
  $('#fileManifest').onchange = (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        manifest = JSON.parse(String(r.result));
        markManifest(true, 'зареден от файл');
      } catch (e) { alert('manifest.json не е валиден: ' + e.message); }
    };
    r.readAsText(f, 'utf-8');
  };

  function markManifest(ok, how) {
    const el = $('#manState');
    el.textContent = ok ? 'manifest.json: ' + how : 'manifest.json: не е зареден';
    el.style.color = ok ? '#1C7A48' : '#8A93A6';
    $('#manPick').style.display = ok ? 'none' : 'inline-block';
  }

  // ==========================================================================
  //  Start
  // ==========================================================================
  // Restore an interrupted session so a closed tab does not lose an hour of work.
  try {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft && draft !== JSON.stringify(data)) {
      if (confirm('Намерен е незавършен чернови вариант от предишна сесия.\n\nДа го възстановя?')) {
        data = JSON.parse(draft);
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  } catch (e) {}

  // manifest.json is needed to produce an updated one. Over http(s) we can just
  // fetch it; on file:// fetch is blocked, so fall back to a file picker.
  fetch('manifest.json', { cache: 'no-store' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((j) => { manifest = j; markManifest(true, 'зареден (версия ' + j.version + ')'); })
    .catch(() => markManifest(false));

  // The board page is index.html here and in the APK, but it is served as
  // 1.html on skuytov.eu/ii/. Probe for it so the preview works either way.
  (function resolvePreview() {
    const q = '?docs=86400&splash=1';
    fetch('index.html', { method: 'HEAD' })
      .then((r) => { frame.src = (r.ok ? 'index.html' : '1.html') + q; })
      .catch(() => { frame.src = 'index.html' + q; });   // file://: fetch blocked
  })();

  buildNav();
  buildForm();
  fitPreview();
  frame.addEventListener('load', () => { fitPreview(); pushPreview(); });
  statusEl.textContent = 'Няма промени';
})();
