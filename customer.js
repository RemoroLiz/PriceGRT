/* =========================================================
   PANTES GOLD & JEWELRY — customer.js  v3
   ---------------------------------------------------------
   Halaman berbagi harga ke customer — TIDAK ADA video, TIDAK ADA
   slideshow otomatis. Harga ditampilkan sebagai KARTU BERTEMA per
   kategori (Antam, Lotus Archi, UBS, Trimas/Nota Luar, Harga
   Perhiasan), meniru desain story/banner toko — dan tiap kartu
   punya tombol download sendiri untuk diunduh sebagai gambar PNG
   satu per satu (WYSIWYG: tampilan di halaman = hasil unduhan,
   karena html2canvas menangkap kartu yang sama persis).

   PENTING: file ini BERGANTUNG pada:
   - config.js (dimuat SEBELUM file ini) → CONFIG, PAGE_META,
     COL_LABEL, DEMO_DATA, resolveMode(), esc(), fmtRp(),
     fetchJSONWithRetry(), validateAllPayload().
   - html2canvas (dimuat SEBELUM file ini, dari CDN) → dipakai
     untuk fitur unduh gambar per kartu.
   ========================================================= */

let lastPages = {};
let lastCokim = { global: null, trimas: null };
let lastDateLabel = '';

/* ═══════════════════════════════════════════════════════
   DEFINISI TEMPLATE — memetakan sheet (dari config.js/PAGE_META)
   ke tema visual. Satu grup bisa berisi lebih dari satu sheet
   (mis. ANTAM menggabungkan ANTAM_2026 + ANTAM_UNDER dalam satu
   kartu/gambar, seperti pada desain aslinya).
═══════════════════════════════════════════════════════ */
const TEMPLATE_GROUPS = [
  {
    id: 'ANTAM', label: 'Antam', theme: 'antam',
    sheetKeys: ['ANTAM_2026', 'ANTAM_UNDER'],
    subtitles: {
      ANTAM_2026: ['ANTAM CERTIEYE RED MARK', '2026'],
      ANTAM_UNDER: ['ANTAM CERTIEYE RED MARK', 'UNDER 2026'],
    },
    productImage: 'assets/bg_slide3.png',
  },
  { id: 'ARCHI', label: 'Lotus Archi', theme: 'archi', sheetKeys: ['ARCHI'], badgeText: 'LOTUS ARCHI', productImage: 'assets/bg_slide3.png' },
  { id: 'UBS_NEW', label: 'UBS Gold', theme: 'ubs', sheetKeys: ['UBS_NEW'], badgeText: 'UBS GOLD PRICE LIST', productImage: 'assets/bg_slide3.png' },
  { id: 'NOTA_LUAR', label: 'Nota Luar', theme: 'trimas', sheetKeys: ['NOTA_LUAR'], badgeText: 'TERIMA EMAS HARGA TINGGI', productImage: null },
  { id: 'HARGA_EMAS', label: 'Harga Perhiasan', theme: 'perhiasan', sheetKeys: ['HARGA_EMAS'], badgeText: 'Harga Perhiasan', productImage: 'assets/bg_slide2.png' },
  { id: 'EMASKU', label: 'Emasku', theme: 'antam', sheetKeys: ['EMASKU'], badgeText: ['EMASKU', ''], productImage: 'assets/bg_slide3.png' },
];

/* ═══════════════════════════════════════════════════════
   RENDER — header cokim (ringkasan umum di atas halaman)
═══════════════════════════════════════════════════════ */
function renderCustomerCokim(cokim) {
  const el = document.getElementById('csCokim');
  if (!el) return;
  const g = cokim && cokim.global != null ? fmtRp(cokim.global) : '—';
  const t = cokim && cokim.trimas != null ? fmtRp(cokim.trimas) : '—';
  el.innerHTML =
    `<span class="cs-pill"><b>PATOKAN GLOBAL</b> ${esc(g)}</span>` +
    `<span class="cs-pill"><b>PATOKAN TRIMAS</b> ${esc(t)}</span>`;
}

/* ═══════════════════════════════════════════════════════
   RENDER — quick nav chips (satu chip per grup template)
═══════════════════════════════════════════════════════ */
function buildQuickNav(pages) {
  const nav = document.getElementById('csQuickNav');
  if (!nav) return;
  nav.innerHTML = '';
  TEMPLATE_GROUPS.forEach(group => {
    const hasData = group.sheetKeys.some(k => Array.isArray(pages[k]) && pages[k].length);
    if (!hasData) return;
    const chip = document.createElement('a');
    chip.href = '#tpl-' + group.id;
    chip.className = 'cs-chip tpl-chip-' + group.theme;
    chip.textContent = group.label;
    nav.appendChild(chip);
  });
}

/* ═══════════════════════════════════════════════════════
   HELPERS render brand mark & badge & tabel bertema
═══════════════════════════════════════════════════════ */
/** Logo ASLI (gambar) dengan cadangan teks otomatis kalau file gagal
    dimuat (mis. nama file di server berbeda) — supaya tidak pernah
    tampil ikon "gambar rusak" di kartu manapun. */
function pantesLogoHTML(theme) {
  const light = theme === 'antam';
  const src = light ? 'assets/pantes_logo.png' : 'assets/pantesputih.png';
  return `<div class="tpl-brand ${light ? 'tpl-brand-dark' : 'tpl-brand-light'}">
    <img src="${src}" alt="Pantes Gold &amp; Jewelry" class="tpl-logo-img" crossorigin="anonymous"
      onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
    <div class="tpl-brand-fallback">
      <span class="tpl-brand-name">P<span class="tpl-brand-tri">▲</span>NTES</span>
      <span class="tpl-brand-sub">Gold &amp; Jewelry</span>
    </div>
  </div>`;
}
function trimasLogoHTML() {
  return `<div class="tpl-brand tpl-brand-light tpl-brand-trimas">
    <img src="assets/trimas_putih.png" alt="Trimas — Terima Emas dari Seluruh Dunia" class="tpl-logo-img" crossorigin="anonymous"
      onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
    <div class="tpl-brand-fallback">
      <span class="tpl-brand-name">TRIM<span class="tpl-brand-tri">▲</span>S</span>
      <span class="tpl-brand-sub">Terima Emas dari Seluruh Dunia</span>
    </div>
  </div>`;
}
/** Pisahkan label 2 kata jadi baris utama + sub-label kecil di bawahnya
    (dipakai tema "perhiasan" untuk id seperti "8K KUNING" → 8K / KUNING). */
function splitKadarLabel(id) {
  const s = String(id ?? '—');
  const sp = s.indexOf(' ');
  if (sp === -1) return { main: s, sub: null };
  return { main: s.slice(0, sp), sub: s.slice(sp + 1) };
}
function renderBadgePill(theme, label) {
  if (!label) return '';
  const isArr = Array.isArray(label);
  const main = isArr ? label[0] : label;
  const sub = isArr ? label[1] : null;
  if (!main) return '';
  return `<div class="tpl-badge tpl-badge-${theme}"><span class="tpl-badge-main">${esc(main)}</span>${sub ? `<span class="tpl-badge-sub">${esc(sub)}</span>` : ''}</div>`;
}
/** Baris berbentuk pil (khusus tema Trimas / Nota Luar) — bukan tabel grid,
    mengikuti desain asli yang menampilkan tiap kadar sebagai kapsul. */
function renderPillRows(rows, meta) {
  const priceCol = meta.cols.find(c => c !== 'id');
  const pills = rows.map(row => `
    <div class="tpl-pill-row">
      <span class="tpl-pill-label">${esc(String(row.id ?? '—'))}</span>
      <span class="tpl-pill-value">${fmtRp(row[priceCol])}</span>
    </div>`).join('');
  return `<div class="tpl-pill-list">${pills}</div>`;
}
function renderThemedTable(theme, meta, rows, badgeLabel) {
  if (theme === 'trimas') return renderPillRows(rows, meta);

  const theadCells = meta.cols.map(c => `<th>${esc(COL_LABEL[c] || c.toUpperCase())}</th>`).join('');
  const bodyRows = rows.map(row => {
    const cells = meta.cols.map(c => {
      const raw = row[c];
      if (c === 'id') {
        if (theme === 'perhiasan') {
          const { main, sub } = splitKadarLabel(raw);
          return `<td>${esc(main)}${sub ? `<br><span class="tpl-sub-label">${esc(sub)}</span>` : ''}</td>`;
        }
        return `<td>${esc(String(raw ?? '—'))}</td>`;
      }
      return `<td>${fmtRp(raw)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const badgeHTML = (theme === 'antam' || theme === 'archi' || theme === 'ubs') ? renderBadgePill(theme, badgeLabel) : '';
  return `${badgeHTML}<div class="tpl-table-wrap"><table class="tpl-table"><thead><tr>${theadCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`;
}

/* ═══════════════════════════════════════════════════════
   RENDER — satu kartu template per grup kategori
═══════════════════════════════════════════════════════ */
function buildGroupCardHTML(group, pages) {
  const sheetsWithData = group.sheetKeys.filter(k => Array.isArray(pages[k]) && pages[k].length);
  if (!sheetsWithData.length) return '';

  const tablesHTML = sheetsWithData.map(key => {
    const meta = PAGE_META.find(p => p.key === key);
    if (!meta) return '';
    const rows = pages[key];
    const badge = group.subtitles ? group.subtitles[key] : null;
    return renderThemedTable(group.theme, meta, rows, badge);
  }).join('');

  const showCardBadge = group.theme === 'archi' || group.theme === 'ubs';
  const showGlowTitle = group.theme === 'trimas';
  const showScriptTitle = group.theme === 'perhiasan';

  const productShotHTML = group.productImage
    ? `<div class="tpl-product-shot"><img src="${group.productImage}" alt="${esc(group.label)}" loading="eager" crossorigin="anonymous" onerror="this.parentElement.style.display='none';"></div>`
    : '';

  return `
    <section class="tpl-card tpl-${group.theme}" id="tpl-${group.id}">
      ${group.theme !== 'antam' ? '<div class="tpl-border tpl-border-top" aria-hidden="true"></div>' : ''}
      <button class="tpl-download-btn" data-group="${group.id}" data-label="${esc(group.label)}" title="Unduh gambar ${esc(group.label)}">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </button>
      <div class="tpl-inner">
        ${group.theme === 'trimas' ? trimasLogoHTML() : pantesLogoHTML(group.theme)}
        <div class="tpl-date-pill">${esc(lastDateLabel || '')}</div>
        ${showCardBadge ? renderBadgePill(group.theme, group.badgeText) : ''}
        ${showGlowTitle ? `<h2 class="tpl-title-glow">${esc(group.badgeText)}</h2>` : ''}
        ${showScriptTitle ? `<h2 class="tpl-title-script">${esc(group.badgeText)}</h2>` : ''}
        ${tablesHTML}
        ${productShotHTML}
      </div>
      ${group.theme !== 'antam' ? '<div class="tpl-border tpl-border-bottom" aria-hidden="true"></div>' : ''}
    </section>`;
}

/* ═══════════════════════════════════════════════════════
   RENDER — seluruh kartu template
═══════════════════════════════════════════════════════ */
function renderCustomerTables(pages) {
  const main = document.getElementById('csMain');
  if (!main) return;
  let html = '';
  TEMPLATE_GROUPS.forEach(group => { html += buildGroupCardHTML(group, pages); });
  main.innerHTML = html || '<p class="cs-empty">Belum ada data harga. Coba tekan Refresh, atau hubungi toko.</p>';
}

/* ═══════════════════════════════════════════════════════
   TOAST kecil (konfirmasi aksi)
═══════════════════════════════════════════════════════ */
function showToast(msg) {
  const t = document.getElementById('csToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ═══════════════════════════════════════════════════════
   SINKRONISASI TINGGI FOOTER (footer sticky, tinggi bisa berubah)
═══════════════════════════════════════════════════════ */
const csFooter = document.getElementById('csFooter');
function syncFooterHeight() {
  if (!csFooter) return;
  document.documentElement.style.setProperty('--cs-footer-h', csFooter.offsetHeight + 'px');
}
if (csFooter) {
  if (window.ResizeObserver) new ResizeObserver(syncFooterHeight).observe(csFooter);
  else window.addEventListener('resize', syncFooterHeight);
  syncFooterHeight();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncFooterHeight);
}

/* ═══════════════════════════════════════════════════════
   AKSI: Cetak
═══════════════════════════════════════════════════════ */
document.getElementById('csPrint').addEventListener('click', () => window.print());

/* ═══════════════════════════════════════════════════════
   AKSI: Bagikan
═══════════════════════════════════════════════════════ */
document.getElementById('csShare').addEventListener('click', async () => {
  const url = window.location.href;
  const text = 'Cek daftar harga emas & perhiasan terbaru Pantes Gold & Jewelry:';
  if (navigator.share) {
    try { await navigator.share({ title: 'Daftar Harga — Pantes Gold & Jewelry', text, url }); }
    catch (e) { /* pengguna membatalkan share sheet — tidak perlu ditangani */ }
    return;
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    showToast('Link berhasil disalin ✓');
  } catch (e) {
    window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank', 'noopener,noreferrer');
  }
});

/* ═══════════════════════════════════════════════════════
   AKSI: Unduh Gambar PER KARTU — menangkap kartu template yang
   sedang tampil (WYSIWYG) lewat html2canvas, satu per satu sesuai
   tombol yang ditekan. Event delegation dipakai karena #csMain
   dirender ulang tiap loadCustomer(), jadi listener langsung pada
   tombol akan hilang setelah re-render kalau tidak didelegasikan.
═══════════════════════════════════════════════════════ */
/** Pastikan semua gambar di dalam node sudah selesai dimuat sebelum
    di-capture — mencegah foto produk/logo yang belum sempat render
    (terutama saat koneksi lambat) membuat hasil unduhan terlihat
    kosong/tidak lengkap. */
function waitForImages(node) {
  const imgs = Array.from(node.querySelectorAll('img'));
  return Promise.all(imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise(resolve => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true }); // tetap lanjut walau 1 gambar gagal
    });
  }));
}

async function downloadTemplateImage(groupId, label) {
  if (typeof html2canvas !== 'function') {
    showToast('Fitur unduh gambar belum siap, coba lagi sebentar…');
    return;
  }
  const card = document.getElementById('tpl-' + groupId);
  if (!card) return;
  const btn = card.querySelector('.tpl-download-btn');
  if (btn) btn.style.visibility = 'hidden'; // sembunyikan tombol saat pengambilan gambar
  showToast('Menyiapkan gambar ' + label + '…');
  try {
    // Tunggu semua gambar (logo + foto produk) & font selesai dimuat —
    // ini memperbaiki masalah "data/foto belum lengkap" pada hasil unduhan.
    await waitForImages(card);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;

    // PENTING: kompensasi posisi scroll halaman. html2canvas secara default
    // menangkap berdasarkan posisi scroll saat ini — kalau kartu berada di
    // bawah (sudah di-scroll), tanpa kompensasi ini sebagian konten kartu
    // bisa terpotong/tidak lengkap di hasil gambar. Ini penyebab utama
    // laporan "data tidak lengkap saat didownload".
    const canvas = await html2canvas(card, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      imageTimeout: 15000,
      scrollX: 0,
      scrollY: -window.scrollY,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
    });
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    const safeLabel = String(label || groupId).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    link.download = `harga-${safeLabel}-${stamp}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Gambar ' + label + ' berhasil diunduh ✓');
  } catch (err) {
    console.error('Gagal membuat gambar:', err);
    showToast('Gagal membuat gambar: ' + err.message);
  } finally {
    if (btn) btn.style.visibility = '';
  }
}
document.getElementById('csMain').addEventListener('click', (e) => {
  const btn = e.target.closest('.tpl-download-btn');
  if (!btn) return;
  downloadTemplateImage(btn.dataset.group, btn.dataset.label);
});

/* ═══════════════════════════════════════════════════════
   LOAD DATA — sekali saat halaman dibuka + tombol Refresh manual
═══════════════════════════════════════════════════════ */
async function loadCustomer() {
  const updatedEl = document.getElementById('csUpdated');
  updatedEl.textContent = 'Memuat data…';
  const { mode, reason } = resolveMode();

  try {
    let data;
    if (mode === 'demo') {
      await new Promise(r => setTimeout(r, 200));
      data = DEMO_DATA;
    } else {
      data = validateAllPayload(await fetchJSONWithRetry(`${CONFIG.GAS_URL}?action=all`, CONFIG.FETCH_TIMEOUT));
    }

    lastPages = data.pages || {};
    lastCokim = data.cokim || { global: null, trimas: null };

    const now = new Date();
    const jam = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const tgl = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    lastDateLabel = tgl;

    renderCustomerCokim(lastCokim);
    buildQuickNav(lastPages);
    renderCustomerTables(lastPages);

    document.getElementById('csDate').textContent = tgl;
    updatedEl.textContent = (mode === 'demo' ? '🔵 Demo Mode — ' : '') + `Update terakhir: ${jam}`;
  } catch (err) {
    console.error('loadCustomer error:', err);
    updatedEl.textContent = 'Gagal memuat data terbaru — menampilkan data contoh. (' + err.message + ')';
    lastPages = DEMO_DATA.pages;
    lastCokim = DEMO_DATA.cokim;
    lastDateLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    renderCustomerCokim(lastCokim);
    buildQuickNav(lastPages);
    renderCustomerTables(lastPages);
    document.getElementById('csDate').textContent = lastDateLabel;
  } finally {
    syncFooterHeight();
  }
}
document.getElementById('csRefresh').addEventListener('click', loadCustomer);

loadCustomer();
