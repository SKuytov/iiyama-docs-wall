/* ============================================================================
 *  render.js  —  builds the board DOM from window.BOARD (content.js)
 *
 *  You should not need to edit this file to change what the board says.
 *  All content lives in content.js.
 *
 *  Why render in JS rather than hand-write the HTML: the board is now ~150
 *  discrete facts across nine source documents. Hand-maintaining that markup
 *  guarantees that an edit eventually breaks the layout. Here the shape of
 *  every row is defined exactly once, so a content edit cannot produce
 *  malformed markup — worst case it is a JS syntax error, which the guard at
 *  the bottom catches and reports on screen instead of showing a blank panel.
 * ========================================================================== */
(function () {
  'use strict';

  // ---- tiny DOM helpers ---------------------------------------------------
  //  el('div.card > ...') style: tag + className, children, text
  function el(spec, attrs, children) {
    const parts = String(spec).split('.');
    const node = document.createElement(parts[0] || 'div');
    if (parts.length > 1) node.className = parts.slice(1).join(' ');
    if (attrs) {
      for (const k in attrs) {
        if (k === 'lang') node.lang = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach(function (c) {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }
  function t(spec, text, attrs) {
    const n = el(spec, attrs);
    if (text != null) n.textContent = text;
    return n;
  }
  // SVG <use> reference into the inline sprite
  function icon(name, cls) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', cls || 'ico');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#i-' + name);
    svg.appendChild(use);
    return svg;
  }
  // Card header: icon + BG title + EN subtitle + optional document reference
  function cardHead(ico, titleBg, titleEn, ref, refDate) {
    return el('div.card-hd', null, [
      icon(ico, 'card-ico'),
      el('div.card-hd-txt', null, [
        t('h2', titleBg),
        titleEn ? t('p', titleEn, { lang: 'en' }) : null,
      ]),
      ref ? el('span.doc-ref', null, [
        document.createTextNode(ref),
        refDate ? t('em', refDate) : null,
      ]) : null,
    ]);
  }

  // ======================================================================
  //  Sections
  // ======================================================================

  function buildHeader(B) {
    const logo = el('img.hdr-logo', { src: 'assets/septona-logo.png', alt: 'Septona Bulgaria' });
    return el('header.hdr', null, [
      logo,
      el('div.hdr-title', null, [
        t('h1', B.header.title),
        t('p', B.header.subtitle, { lang: 'en' }),
      ]),
      el('div.hdr-meta', null, [
        t('div.hdr-clock', '--:--', { id: 'boardTime' }),
        t('div.hdr-date', '', { id: 'boardDate' }),
      ]),
    ]);
  }

  function emgColumn(titleBg, titleEn, rows) {
    return el('div.emg-col', null, [
      el('div.emg-col-hd', null, [
        document.createTextNode(titleBg + ' '),
        t('span', '/ ' + titleEn, { lang: 'en' }),
      ]),
    ].concat(rows.map(function (r) {
      return el('div.emg-row', null, [
        t('span.emg-num', r.tel),
        el('span.emg-who', null, [
          document.createTextNode(r.bg),
          r.en ? t('em', r.en, { lang: 'en' }) : null,
        ]),
      ]);
    })));
  }

  function buildEmergency(B) {
    const e = B.emergency;
    return el('section.emg', { 'aria-label': 'Спешни телефони' }, [
      el('div.emg-112', null, [
        icon('phone', 'emg-112-ico'),
        el('div.emg-112-body', null, [
          t('div.emg-112-num', e.bigNumber),
          t('div.emg-112-lbl', e.bigLabelBg),
          t('div.emg-112-lbl-en', e.bigLabelEn, { lang: 'en' }),
        ]),
      ]),
      el('div.emg-grid', null, [
        emgColumn(e.externalTitleBg, e.externalTitleEn, e.external),
        emgColumn(e.internalTitleBg, e.internalTitleEn, e.internal),
      ]),
    ]);
  }

  function buildRules(B) {
    const r = B.rules;
    const list = el('ul.rules');
    r.items.forEach(function (it) {
      list.appendChild(el('li', it.danger ? { class: 'is-danger' } : null, [
        icon(it.icon, 'r-ico'),
        t('span.r-bg', it.bg),
        it.en ? t('span.r-en', it.en, { lang: 'en' }) : null,
      ]));
    });
    return el('section.card.card-rules', null, [
      cardHead('vest', r.titleBg, r.titleEn, r.docRef, r.docDate),
      list,
      el('p.rules-warn', null, [
        icon('alert', 'warn-ico'),
        el('span', null, [
          document.createTextNode(r.warnBg),
          r.warnEn ? t('em', r.warnEn, { lang: 'en' }) : null,
        ]),
      ]),
    ]);
  }

  function buildDirectory(B) {
    const d = B.directory;
    const wrap = el('div.dir');
    d.groups.forEach(function (g) {
      const grp = el('div.dir-grp', null, [
        el('h3', null, [
          document.createTextNode(g.bg + ' '),
          g.en ? t('span', '/ ' + g.en, { lang: 'en' }) : null,
        ]),
      ]);
      g.people.forEach(function (p) {
        grp.appendChild(el('div.dir-row', null, [
          t('b', p.name),
          t('i', p.role),
          t('span', p.tel),
        ]));
      });
      wrap.appendChild(grp);
    });
    return el('section.card.card-dir', null, [
      cardHead('phone', d.titleBg, d.titleEn),
      wrap,
    ]);
  }

  function buildWaste(B) {
    const w = B.waste;
    function block(cls, lblBg, lblEn, items) {
      const ul = el('ul');
      items.forEach(function (i) {
        ul.appendChild(el('li', null, [
          document.createTextNode(i.bg),
          i.en ? t('em', i.en, { lang: 'en' }) : null,
        ]));
      });
      return el('div.wst-block.' + cls, null, [
        el('div.wst-lbl', null, [
          document.createTextNode(lblBg + ' '),
          t('span', '/ ' + lblEn, { lang: 'en' }),
        ]),
        ul,
      ]);
    }
    return el('section.card.card-waste', null, [
      cardHead('waste', w.titleBg, w.titleEn, w.docRef, w.docDate),
      block('wst-ban', 'Забранено', 'Prohibited', w.prohibited),
      block('wst-req', 'Задължително', 'Required', w.required),
      w.legal ? t('p.wst-legal', w.legal) : null,
    ]);
  }

  // Training + Inspections share a row shape: date badge + label (+ who)
  function dateList(items, opts) {
    const wrap = el('div.dlist' + (opts && opts.cols ? '.is-2col' : ''));
    items.forEach(function (i) {
      wrap.appendChild(el('div.dl-row', null, [
        t('span.dl-date', i.date),
        el('span.dl-txt', null, [
          document.createTextNode(i.bg),
          i.who ? t('em', i.who) : null,
        ]),
      ]));
    });
    return wrap;
  }

  function buildTraining(B) {
    const p = B.training;
    return el('section.card.card-train', null, [
      cardHead('list', p.titleBg, p.titleEn, p.docRef),
      dateList(p.items),
    ]);
  }

  function buildInspections(B) {
    const p = B.inspections;
    return el('section.card.card-insp', null, [
      cardHead('check', p.titleBg, p.titleEn, p.docRef),
      dateList(p.items, { cols: 2 }),
      p.noteBg ? el('p.card-note', null, [
        document.createTextNode(p.noteBg),
        p.noteEn ? t('em', p.noteEn, { lang: 'en' }) : null,
      ]) : null,
    ]);
  }

  function buildCleaning(B) {
    const c = B.cleaning;
    const wrap = el('div.clean');
    c.items.forEach(function (i) {
      wrap.appendChild(el('div.cl-row', null, [
        el('span.cl-zone', null, [
          document.createTextNode(i.zone),
          i.who ? t('em', i.who) : null,
        ]),
        t('span.cl-freq', i.freq),
      ]));
    });
    return el('section.card.card-clean', null, [
      cardHead('clean', c.titleBg, c.titleEn, c.docRef, c.validBg),
      wrap,
    ]);
  }

  // Bottom band: committee (6) + every fire-safety certified employee (15)
  function buildPeopleBand(B) {
    const k = B.committee, f = B.fireSafety;

    function side(titleBg, titleEn, people) {
      const box = el('div.kut-side', null, [
        el('h3', null, [
          document.createTextNode(titleBg + ' '),
          t('span', '/ ' + titleEn, { lang: 'en' }),
        ]),
      ]);
      people.forEach(function (p) {
        box.appendChild(el('p', null, [
          document.createTextNode(p.name),
          t('i', p.role),
        ]));
      });
      return box;
    }

    const names = el('div.fire-grid');
    f.people.forEach(function (p, idx) {
      names.appendChild(el('div.fire-row', null, [
        t('span.fire-n', String(idx + 1)),
        el('span.fire-who', null, [
          document.createTextNode(p.name),
          t('em', p.role),
        ]),
      ]));
    });

    return el('div.pband', null, [
      el('section.card.card-kut', null, [
        cardHead('people', k.titleBg, k.titleEn),
        el('div.kut', null, [
          side(k.employerBg, k.employerEn, k.employer),
          side(k.workersBg, k.workersEn, k.workers),
        ]),
      ]),
      el('section.card.card-fire', null, [
        cardHead('fire', f.titleBg, f.titleEn),
        names,
      ]),
    ]);
  }

  function buildKiosk(B) {
    const k = B.kiosk;
    return el('footer.cta', null, [
      icon('kiosk', 'cta-ico'),
      el('div.cta-txt', null, [
        t('div.cta-bg', k.mainBg),
        t('div.cta-en', k.mainEn, { lang: 'en' }),
      ]),
      el('div.cta-hint', null, [
        t('span', k.hintBg),
        t('em', k.hintEn, { lang: 'en' }),
      ]),
    ]);
  }

  // ======================================================================
  //  Assemble
  // ======================================================================
  function build(override) {
    const B = override || window.BOARD;
    if (!B) throw new Error('content.js did not load — window.BOARD is undefined');

    const board = el('div.board', { id: 'board' }, [
      buildHeader(B),
      buildEmergency(B),
      el('div.band', null, [
        buildRules(B),
        buildDirectory(B),
        // Column pairing is chosen so each stack's natural height lands inside
        // the band: inspections+cleaning are both dense tables, training+waste
        // are both short. Pairing the two tall ones together overflowed.
        el('div.stack', null, [buildInspections(B), buildCleaning(B)]),
        el('div.stack', null, [buildTraining(B), buildWaste(B)]),
      ]),
      buildPeopleBand(B),
      buildKiosk(B),
    ]);

    const host = document.getElementById('docsView');
    host.innerHTML = '';
    host.appendChild(board);
  }

  // ======================================================================
  //  Public hook — used by editor.html for the live preview
  // ======================================================================
  //  The editor renders the real board in an iframe and re-renders it on every
  //  keystroke, so the person editing sees the actual panel output rather than
  //  a mock-up. It also asks for an overflow report, which is what turns "looks
  //  fine on my laptop" into "this will still fit on the 65-inch panel".
  window.BoardRender = {
    render: build,
    // Anything whose content is taller than its box would be clipped on the
    // panel. Report it by human-readable card name so a non-technical editor
    // gets "Вътрешни инспекции: текстът не се побира" and not a CSS selector.
    report: function () {
      const NAMES = {
        'card-rules': 'Правила за шофьори',
        'card-dir': 'Служебни телефони',
        'card-insp': 'Вътрешни инспекции',
        'card-train': 'Програма за обучение',
        'card-clean': 'Почистване и дезинфекция',
        'card-waste': 'Отпадъци',
        'card-kut': 'Комитет по условия на труд',
        'card-fire': 'Сертификати пожарна безопасност',
      };
      const worst = {};   // label -> px, keeping the largest per card
      function note(cardEl, over) {
        let label = null;
        for (const k in NAMES) if (cardEl.classList.contains(k)) label = NAMES[k];
        label = label || 'Таблото';
        if (!worst[label] || worst[label] < over) worst[label] = over;
      }

      // Attribute the problem to the specific card at fault, never to the
      // container. A stack reporting 155px over tells the editor nothing; "the
      // cleaning schedule is 155px too tall" tells them exactly what to trim.
      document.querySelectorAll('.card').forEach(function (card) {
        // (a) the card's own content is taller than the card
        const inner = card.scrollHeight - card.clientHeight;
        if (inner > 2) note(card, inner);

        // (b) the card is taller than the column it sits in, so it spills past
        //     the bottom of the band and over whatever is underneath
        const holder = card.closest('.stack') || card.closest('.band') || card.closest('.pband');
        if (holder) {
          const spill = card.getBoundingClientRect().bottom - holder.getBoundingClientRect().bottom;
          if (spill > 2) note(card, spill);
        }
      });

      // Finally, the board as a whole must not exceed the panel.
      const bd = document.getElementById('board');
      if (bd && bd.scrollHeight - bd.clientHeight > 2) {
        const over = bd.scrollHeight - bd.clientHeight;
        if (!Object.keys(worst).length) worst['Таблото'] = over;
      }

      const out = [];
      for (const k in worst) out.push({ label: k, over: worst[k] });
      out.sort(function (a, b) { return b.over - a.over; });
      return out;
    },
  };

  // Live preview channel. Only same-origin editor pages talk to this.
  window.addEventListener('message', function (ev) {
    if (!ev.data || ev.data.type !== 'board:preview') return;
    try {
      build(ev.data.board);
      // Layout settles after fonts/reflow; measure on the next frame.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          ev.source.postMessage({ type: 'board:report', problems: window.BoardRender.report() }, '*');
        });
      });
    } catch (err) {
      ev.source.postMessage({ type: 'board:error', message: String(err && err.message || err) }, '*');
    }
  });

  // A content typo must not leave a blank panel in a factory corridor. Show
  // exactly what broke, on screen, in a form somebody can act on.
  try {
    build();
  } catch (err) {
    const host = document.getElementById('docsView') || document.body;
    host.innerHTML =
      '<div style="position:absolute;inset:0;display:flex;align-items:center;' +
      'justify-content:center;padding:8vw;background:#0B1022;color:#FF5C6B;' +
      'font:700 2.2vw/1.5 monospace;text-align:center;white-space:pre-wrap">' +
      'ГРЕШКА В content.js / ERROR IN content.js\n\n' +
      String(err && err.message ? err.message : err).replace(/[<>&]/g, '') +
      '\n\nПроверете за липсваща запетая или кавичка.\nCheck for a missing comma or quote.' +
      '</div>';
    if (window.console) console.error(err);
  }
})();
