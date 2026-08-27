/* =========================================================
   PANTES GOLD & JEWELRY — script.js  v7 (TV / Digital Signage)
   ---------------------------------------------------------
   PENTING: file ini BERGANTUNG pada config.js yang harus dimuat
   LEBIH DULU di index.html (menyediakan CONFIG, PAGE_META,
   COL_LABEL, DEMO_DATA, resolveMode(), esc(), fmtRp(), fetchJSON(),
   validateAllPayload()).

   PRINSIP DESAIN:
   - 1 sheet Spreadsheet = 1 "page" website (tidak ada lagi 1 page
     yang menggabungkan 2 sheet).
   - Semua data (harga + cokim + video) diambil SEKALI saat load
     (?action=all). TIDAK ADA auto-refresh/polling — hanya tombol
     Refresh manual yang memanggil ulang data.
   - Tiap page dipecah otomatis maksimal 10 baris/slide. Jika data
     > 10 baris, dibuat slide lanjutan dengan judul yang sama +
     penanda halaman, mis. "EMASKU (2/3)".
   - Panel video berjalan independen (autoplay + loop, playlist),
     TIDAK ikut reset saat tabel harga bergeser slide.
   ========================================================= */

/* Pengaturan khusus TV (tidak dipakai oleh customer.html) —
   ditambahkan ke CONFIG bersama dari config.js. */
Object.assign(CONFIG, {
  SLIDE_DURATION: 8_000,  // ms per slide tabel harga
  ROWS_PER_PAGE:  10,     // maksimum baris per slide (wajib sesuai requirement)
});

/** Bagi array jadi beberapa chunk maksimal `size` item (khusus TV: pagination slide) */
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
/** Validasi ketat ID media (Drive file ID / YouTube video ID) — pertahanan
    berlapis di sisi klien meski server (Code.gs) sudah memvalidasi juga. */
const isValidDriveFileId   = id => /^[a-zA-Z0-9_-]{10,}$/.test(String(id || ''));
const isValidYoutubeId     = id => /^[a-zA-Z0-9_-]{11}$/.test(String(id || ''));
const isValidMediaId = v => v.platform === 'youtube' ? isValidYoutubeId(v.fileId) : isValidDriveFileId(v.fileId);

/* ═══════════════════════════════════════════════════════
   BUILD SLIDES — pecah tiap page jadi slide-slide (max 10 baris)
═══════════════════════════════════════════════════════ */
function buildTableSlides(pages) {
  const slides = [];
  PAGE_META.forEach(meta => {
    const rows = Array.isArray(pages[meta.key]) ? pages[meta.key] : [];
    if (!rows.length) return;
    const parts = chunk(rows, CONFIG.ROWS_PER_PAGE);
    parts.forEach((part, i) => {
      slides.push({
        type: 'table',
        key: meta.key,
        title: parts.length > 1 ? `${meta.title} (${i + 1}/${parts.length})` : meta.title,
        cols: meta.cols,
        accent: meta.accent,
        rows: part,
      });
    });
  });
  return slides;
}

/* ═══════════════════════════════════════════════════════
   RENDER — Topbar cokim & clock
═══════════════════════════════════════════════════════ */
function renderCokimBar(cokim) {
  const el = document.getElementById('cokimBar');
  if (!el) return;
  const g = cokim && cokim.global != null ? fmtRp(cokim.global) : '—';
  const t = cokim && cokim.trimas != null ? fmtRp(cokim.trimas) : '—';
  el.innerHTML =
    `<span class="ck-label">GLOBAL</span><span class="ck-val">${esc(g)}</span>` +
    `<span class="ck-sep">·</span>` +
    `<span class="ck-label">TRIMAS</span><span class="ck-val">${esc(t)}</span>`;
}
const pad = n => String(n).padStart(2, '0');
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  document.getElementById('date').textContent  = `${pad(now.getDate())} / ${pad(now.getMonth() + 1)} / ${now.getFullYear()}`;
}
setInterval(updateClock, 1000);
updateClock();

/* ═══════════════════════════════════════════════════════
   SYNC TINGGI TOPBAR — mencegah konten (jam/tanggal/label
   slide) terpotong. Tinggi .ctrl-bar sekarang otomatis
   mengikuti isinya (CSS: min-height, bukan height tetap);
   JS di sini hanya "memberitahu" area konten di bawahnya
   (.main-layout) berapa tinggi sebenarnya lewat CSS var
   --ctrl-h-actual, sehingga selalu pas di layar/device apapun.
═══════════════════════════════════════════════════════ */
const ctrlBar = document.getElementById('ctrlBar');
function syncCtrlBarHeight() {
  if (!ctrlBar) return;
  document.documentElement.style.setProperty('--ctrl-h-actual', ctrlBar.offsetHeight + 'px');
}
if (ctrlBar) {
  if (window.ResizeObserver) {
    new ResizeObserver(syncCtrlBarHeight).observe(ctrlBar);
  } else {
    window.addEventListener('resize', syncCtrlBarHeight);
  }
  syncCtrlBarHeight();
  // Ukur ulang setelah web font selesai dimuat (ukuran teks bisa berubah).
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncCtrlBarHeight);
}

function setStatus(state, text) {
  document.getElementById('statusDot').className = 'sdot ' + state;
  document.getElementById('statusText').textContent = text;
}

/* ═══════════════════════════════════════════════════════
   RENDER — Slide tabel (dipakai untuk SEMUA page harga)
═══════════════════════════════════════════════════════ */
function renderTableSlide(slide, index) {
  const el = document.createElement('div');
  el.className = 'slide';
  el.dataset.index = index;

  const theadCells = slide.cols.map(c => `<th>${esc(COL_LABEL[c] || c.toUpperCase())}</th>`).join('');
  const bodyRows = slide.rows.map((row, i) => {
    const cells = slide.cols.map(c => {
      const raw = row[c];
      const val = c === 'id' ? esc(String(raw ?? '—')) : fmtRp(raw);
      return `<td>${val}</td>`;
    }).join('');
    return `<tr style="animation-delay:${(i * 0.04).toFixed(2)}s">${cells}</tr>`;
  }).join('');

  el.innerHTML = `
    <div class="page-bg ${slide.accent}">
      <div class="slide-header">
        <div class="sh-brand"><img src="assets/pantesputih.png" class="brand-logo-img" alt="Pantes Logo"/></div>
        <div class="sh-center"><span class="sh-title">${esc(slide.title)}</span></div>
        <div class="sh-trimas"><img src="assets/trimas_putih.png" class="trimas-logo-img" alt="Trimas"/></div>
      </div>
      <div class="table-wrap">
        <table class="price-table">
          <thead><tr>${theadCells}</tr></thead>
          <tbody>${bodyRows || `<tr><td colspan="${slide.cols.length}" class="td-empty">Tidak ada data</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
  return el;
}

/* ═══════════════════════════════════════════════════════
   YOUTUBE IFRAME API LOADER (dimuat sekali, lazy)
   Diperlukan supaya kita bisa mengontrol mute/unmute video
   YouTube secara real-time (parameter URL "mute=1" saja hanya
   berlaku SEKALI saat video dimuat, tidak bisa diubah setelahnya
   tanpa API resmi ini).
═══════════════════════════════════════════════════════ */
let ytApiPromise = null;
function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (typeof prevCallback === 'function') prevCallback(); resolve(window.YT); };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

/* ═══════════════════════════════════════════════════════
   VIDEO PANEL — playlist independen, autoplay + loop
   Video TIDAK dibuat ulang saat tabel berganti slide, sehingga
   pemutaran tidak pernah terputus oleh transisi slideshow tabel.

   CATATAN SUARA: browser modern MEWAJIBKAN video autoplay dalam
   keadaan muted (tanpa suara) — ini kebijakan browser, bukan bug,
   supaya video tidak tiba-tiba bersuara keras tanpa interaksi
   pengguna. Karena ini adalah layar signage tanpa interaksi rutin,
   video akan tetap default MUTED, tapi operator toko bisa menekan
   tombol 🔊 di topbar untuk mengaktifkan suara kapan saja.
═══════════════════════════════════════════════════════ */
const VideoPanel = (() => {
  let list = [];
  let idx = 0;
  let rotateTimer = null;
  let muted = true;          // status suara berlaku untuk video manapun yang sedang/akan diputar
  let ytPlayer = null;       // instance YT.Player aktif (jika platform === 'youtube')
  let currentVideoEl = null; // elemen <video> aktif (jika platform === 'drive')

  function driveStreamSrc(fileId)  { return `https://drive.google.com/uc?export=download&id=${fileId}`; }
  function drivePreviewSrc(fileId) { return `https://drive.google.com/file/d/${fileId}/preview`; }

  function destroyCurrentPlayer() {
    if (ytPlayer) { try { ytPlayer.destroy(); } catch (e) {} ytPlayer = null; }
    currentVideoEl = null;
  }

  function mount(videos) {
    stopRotate();
    destroyCurrentPlayer();
    list = (videos || []).filter(v => v.platform && isValidMediaId(v));
    const panel = document.getElementById('videoPanel');
    if (!panel) return;
    if (!list.length) { panel.classList.add('empty'); panel.innerHTML = ''; refreshMuteButtonUI(); return; }
    panel.classList.remove('empty');
    idx = 0;
    playCurrent(panel);
  }

  /** Sembunyikan cover loading dengan transisi halus — dipanggil hanya saat
      video BENAR-BENAR mulai diputar (event asli), bukan tebakan waktu,
      supaya tidak ada lagi kedipan tombol play/nama channel YouTube yang
      sempat terlihat sebelum video mulai. Idempotent (aman dipanggil 2x). */
  function revealVideo(panel) {
    const cover = panel && panel.querySelector('.video-loading-cover');
    if (cover) cover.classList.add('hide');
  }

  function playCurrent(panel) {
    stopRotate();
    destroyCurrentPlayer();
    const v = list[idx];
    if (!v) return;
    const requestToken = Symbol('video-request'); // guard: pastikan hasil async masih relevan
    playCurrent._token = requestToken;
    const coverHTML = '<div class="video-loading-cover"></div>';

    if (v.platform === 'youtube') {
      panel.innerHTML = `
        <div class="video-frame">
          <div id="ytPlayerHost"></div>
          ${coverHTML}
          <div class="video-caption">${esc(v.judul)}</div>
        </div>`;
      const loopSingle = list.length <= 1;
      // Timer cadangan: kalau event 'ended' resmi dari YouTube gagal terpicu
      // (kadang terjadi pada video dengan pembatasan tertentu), rotasi tetap
      // jalan berdasarkan durasi dari sheet VIDEO supaya tidak macet.
      if (list.length > 1) rotateTimer = setTimeout(next, v.durasi * 1000);
      // Jaring pengaman: paksa buka cover setelah 4 detik meski event
      // 'playing' resmi tidak kunjung terpicu, supaya panel tidak macet hitam.
      const coverFailsafe = setTimeout(() => revealVideo(panel), 4_000);

      loadYouTubeAPI().then(YT => {
        if (playCurrent._token !== requestToken) return; // sudah pindah video lain, batalkan
        const host = document.getElementById('ytPlayerHost');
        if (!host) return;
        ytPlayer = new YT.Player(host, {
          width: '100%', height: '100%', videoId: v.fileId,
          playerVars: {
            autoplay: 1, mute: 1, controls: 0, modestbranding: 1, rel: 0,
            iv_load_policy: 3, playsinline: 1, fs: 0, disablekb: 1,
            loop: loopSingle ? 1 : 0, playlist: loopSingle ? v.fileId : undefined,
          },
          events: {
            onReady: (e) => {
              if (playCurrent._token !== requestToken) return;
              muted ? e.target.mute() : e.target.unMute();
              e.target.playVideo();
              refreshMuteButtonUI();
            },
            onStateChange: (e) => {
              if (playCurrent._token !== requestToken) return;
              // state 1 = PLAYING → video benar-benar sudah tampil, aman buka cover.
              if (e.data === YT.PlayerState.PLAYING) { clearTimeout(coverFailsafe); revealVideo(panel); }
              if (e.data === YT.PlayerState.ENDED && list.length > 1) { stopRotate(); next(); }
            },
            onError: () => { if (playCurrent._token === requestToken) { clearTimeout(coverFailsafe); fallbackToIframe(panel, v); } },
          },
        });
      });
      return;
    }

    // platform === 'drive'
    panel.innerHTML = `
      <div class="video-frame">
        <video id="signageVideo" autoplay muted playsinline ${list.length <= 1 ? 'loop' : ''}></video>
        ${coverHTML}
        <div class="video-caption">${esc(v.judul)}</div>
      </div>`;
    const videoEl = document.getElementById('signageVideo');
    currentVideoEl = videoEl;
    videoEl.muted = muted;
    const source = document.createElement('source');
    source.src = driveStreamSrc(v.fileId);
    source.type = 'video/mp4';
    videoEl.appendChild(source);

    const coverFailsafe = setTimeout(() => revealVideo(panel), 4_000);
    videoEl.addEventListener('playing', () => { clearTimeout(coverFailsafe); revealVideo(panel); }, { once: true });
    videoEl.addEventListener('ended', next, { once: true });
    videoEl.addEventListener('error', () => { clearTimeout(coverFailsafe); fallbackToIframe(panel, v); }, { once: true });
    videoEl.play().then(refreshMuteButtonUI).catch(() => {
      // Autoplay dengan suara diblokir browser: paksa muted lalu coba lagi
      // supaya video tetap jalan (tanpa suara) daripada diam sama sekali.
      videoEl.muted = true;
      videoEl.play().catch(() => {});
      refreshMuteButtonUI();
    });
  }

  function fallbackToIframe(panel, v) {
    // Jika pemutaran langsung gagal (mis. file Drive besar / video di-nonaktifkan
    // embed-nya), gunakan mode pratinjau sebagai cadangan (tanpa kontrol suara —
    // tombol mute disembunyikan otomatis selama mode ini aktif).
    destroyCurrentPlayer();
    const src = v.platform === 'youtube'
      ? `https://www.youtube.com/embed/${v.fileId}?autoplay=1&mute=1&controls=0`
      : drivePreviewSrc(v.fileId);
    panel.innerHTML = `
      <div class="video-frame">
        <iframe id="signageVideoFrame" src="${src}"
          allow="autoplay" referrerpolicy="strict-origin-when-cross-origin" frameborder="0" allowfullscreen></iframe>
        <div class="video-loading-cover"></div>
        <div class="video-caption">${esc(v.judul)}</div>
      </div>`;
    // Iframe cadangan tidak bisa dideteksi statusnya secara pasti (beda origin),
    // jadi cover dibuka setelah jeda singkat tetap (praktik wajar untuk fallback).
    setTimeout(() => revealVideo(panel), 1_500);
    refreshMuteButtonUI();
    if (list.length > 1) rotateTimer = setTimeout(next, v.durasi * 1000);
  }

  function stopRotate() { if (rotateTimer) { clearTimeout(rotateTimer); rotateTimer = null; } }

  function next() {
    if (!list.length) return;
    idx = (idx + 1) % list.length;
    const panel = document.getElementById('videoPanel');
    if (panel) playCurrent(panel);
  }

  /** Bisa dikontrol dari fallback iframe (tidak ada API) → sembunyikan tombol mute. */
  function isControllable() { return !!(ytPlayer || currentVideoEl); }

  function toggleMute() {
    muted = !muted;
    applyMute();
    return muted;
  }
  function applyMute() {
    if (ytPlayer && typeof ytPlayer.mute === 'function') {
      try { muted ? ytPlayer.mute() : ytPlayer.unMute(); } catch (e) {}
    }
    if (currentVideoEl) currentVideoEl.muted = muted;
  }
  function isMuted() { return muted; }

  return { mount, toggleMute, isMuted, isControllable };
})();

function refreshMuteButtonUI() {
  const btn = document.getElementById('btnMute');
  if (!btn) return;
  const controllable = VideoPanel.isControllable();
  btn.style.display = controllable ? '' : 'none';
  btn.classList.toggle('is-unmuted', !VideoPanel.isMuted());
  btn.title = VideoPanel.isMuted() ? 'Aktifkan suara video' : 'Matikan suara video';
}
document.getElementById('btnMute').addEventListener('click', () => {
  VideoPanel.toggleMute();
  refreshMuteButtonUI();
});

/* ═══════════════════════════════════════════════════════
   SLIDESHOW ENGINE (tabel harga saja — video tidak ikut)
   Indikator memakai "story progress" bersegmen (gaya Instagram/TikTok
   Stories) — tiap segmen mewakili 1 slide, otomatis menyesuaikan
   jumlah slide berapapun banyaknya, jauh lebih rapi daripada dots.
═══════════════════════════════════════════════════════ */
let slides = [];
let currentIdx = 0;
let paused = false;
let progressRAF = null;
let progStart = null;

function renderSlideshow(tableSlides) {
  const wrap = document.getElementById('slideshowWrap');
  const segWrap = document.getElementById('storyProgress');
  wrap.innerHTML = '';
  segWrap.innerHTML = '';
  slides = tableSlides;

  if (!slides.length) {
    wrap.innerHTML = '<div class="empty-state">Belum ada data harga. Cek Spreadsheet / klik Refresh.</div>';
    updateNowLabel(null);
    return;
  }

  slides.forEach((s, i) => {
    const el = renderTableSlide(s, i);
    if (i === 0) el.classList.add('active');
    wrap.appendChild(el);

    const seg = document.createElement('button');
    seg.className = 'seg' + (i === 0 ? ' seg-active' : '');
    seg.title = s.title;
    seg.innerHTML = '<span class="seg-fill"></span>';
    seg.addEventListener('click', () => { stopProgress(); goTo(i, i > currentIdx ? 'next' : 'prev'); if (!paused) startProgress(); });
    segWrap.appendChild(seg);
  });

  currentIdx = 0;
  updateNowLabel(slides[0]);
  startProgress();
}

function updateNowLabel(slide) {
  const el = document.getElementById('ctrlNow');
  if (!el) return;
  el.classList.remove('show');
  window.clearTimeout(updateNowLabel._t);
  updateNowLabel._t = window.setTimeout(() => {
    el.textContent = slide ? slide.title : '';
    el.classList.add('show');
  }, 120);
}

function goTo(idx, dir = 'next') {
  const segs  = Array.from(document.querySelectorAll('.seg'));
  const nodes = Array.from(document.querySelectorAll('#slideshowWrap .slide'));
  if (!nodes.length || idx === currentIdx) return;
  const prev = currentIdx;
  currentIdx = ((idx % nodes.length) + nodes.length) % nodes.length;
  nodes[prev].classList.remove('active');
  nodes[prev].classList.add(dir === 'next' ? 'exit-left' : 'exit-right');
  setTimeout(() => nodes[prev].classList.remove('exit-left', 'exit-right'), 700);
  nodes[currentIdx].classList.add('active');
  segs.forEach((s, i) => {
    s.classList.toggle('seg-active', i === currentIdx);
    s.classList.toggle('seg-done', i < currentIdx);
    const fill = s.querySelector('.seg-fill');
    if (fill) { fill.style.transition = 'none'; fill.style.width = i < currentIdx ? '100%' : (i === currentIdx ? '0%' : '0%'); }
  });
  updateNowLabel(slides[currentIdx]);
}
const nextSlide = () => goTo(currentIdx + 1, 'next');
const prevSlide = () => goTo(currentIdx - 1, 'prev');

function startProgress() {
  cancelAnimationFrame(progressRAF);
  if (!slides.length) return;
  const fill = document.querySelector(`.seg:nth-child(${currentIdx + 1}) .seg-fill`);
  if (fill) { fill.style.transition = 'none'; fill.style.width = '0%'; }
  progStart = performance.now();
  function tick(now) {
    const pct = Math.min(((now - progStart) / CONFIG.SLIDE_DURATION) * 100, 100);
    if (fill) fill.style.width = pct + '%';
    if (pct < 100) {
      progressRAF = requestAnimationFrame(tick);
    } else {
      nextSlide();
      progStart = performance.now();
      progressRAF = requestAnimationFrame(tick);
    }
  }
  progressRAF = requestAnimationFrame(tick);
}
const stopProgress = () => cancelAnimationFrame(progressRAF);
function togglePause() {
  paused = !paused;
  const btn = document.getElementById('btnPause');
  if (paused) { stopProgress(); btn.textContent = '▶'; btn.title = 'Lanjutkan'; }
  else { startProgress(); btn.innerHTML = '&#9646;&#9646;'; btn.title = 'Pause'; }
}
document.getElementById('btnNext').addEventListener('click', () => { stopProgress(); nextSlide(); if (!paused) startProgress(); });
document.getElementById('btnPrev').addEventListener('click', () => { stopProgress(); prevSlide(); if (!paused) startProgress(); });
document.getElementById('btnPause').addEventListener('click', togglePause);
document.addEventListener('keydown', e => {
  if (['ArrowRight', 'ArrowDown'].includes(e.key)) { stopProgress(); nextSlide(); if (!paused) startProgress(); }
  if (['ArrowLeft', 'ArrowUp'].includes(e.key))   { stopProgress(); prevSlide(); if (!paused) startProgress(); }
  if (e.key === ' ') { e.preventDefault(); togglePause(); }
});
let touchX = 0;
const sw = document.getElementById('slideshowWrap');
sw.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
sw.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) { stopProgress(); dx < 0 ? nextSlide() : prevSlide(); if (!paused) startProgress(); }
});

/* ═══════════════════════════════════════════════════════
   LOAD DATA — HANYA dipanggil saat load awal & klik Refresh manual
   (tidak ada setInterval polling, sesuai permintaan)
═══════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════
   AUTO-RECOVERY (khusus TV, layar tanpa pengawasan)
   Jika load gagal total (setelah retry bawaan fetchJSONWithRetry),
   TV dijadwalkan mencoba lagi otomatis di latar belakang dengan
   jeda yang membesar bertahap (30d → 60d → 2m → 5m, lalu tetap di
   5 menit) — supaya layar tidak macet menampilkan pesan error
   selamanya sampai ada orang yang menekan Refresh manual.
   Ini BUKAN polling data rutin (prinsip "load sekali" tetap berlaku
   selama data berhasil dimuat) — ini murni pemulihan dari kegagalan.
═══════════════════════════════════════════════════════ */
let autoRetryTimer = null;
let autoRetryDelayIdx = 0;
const AUTO_RETRY_DELAYS = [30_000, 60_000, 120_000, 300_000]; // ms, nilai terakhir diulang seterusnya

function clearAutoRetry() {
  if (autoRetryTimer) { clearTimeout(autoRetryTimer); autoRetryTimer = null; }
  autoRetryDelayIdx = 0;
}
function scheduleAutoRetry() {
  if (autoRetryTimer) return; // sudah ada jadwal berjalan, jangan tumpuk
  const delay = AUTO_RETRY_DELAYS[Math.min(autoRetryDelayIdx, AUTO_RETRY_DELAYS.length - 1)];
  autoRetryDelayIdx++;
  autoRetryTimer = setTimeout(() => { autoRetryTimer = null; loadAll(true); }, delay);
}

async function loadAll(isAutoRetry) {
  if (!isAutoRetry) clearAutoRetry(); // permintaan manual membatalkan jadwal auto-retry lama
  setStatus('loading', 'Memuat data…');
  document.getElementById('btnRefresh').classList.add('spinning');
  const { mode, reason } = resolveMode();

  try {
    let data;
    if (mode === 'demo') {
      await new Promise(r => setTimeout(r, 250));
      data = DEMO_DATA;
    } else {
      data = validateAllPayload(await fetchJSONWithRetry(`${CONFIG.GAS_URL}?action=all`, CONFIG.FETCH_TIMEOUT));
    }

    renderCokimBar(data.cokim);
    renderSlideshow(buildTableSlides(data.pages || {}));
    VideoPanel.mount(data.videos || []);

    if (mode === 'demo') {
      setStatus('demo', 'Demo Mode' + (reason ? ' — ' + reason : ''));
    } else {
      setStatus('online', 'Online — data dimuat sekali saat halaman dibuka');
    }
    clearAutoRetry(); // berhasil → reset, tidak perlu auto-retry lagi
  } catch (err) {
    console.error('loadAll error:', err);
    setStatus('error', 'Gagal memuat data: ' + err.message + ' — mencoba lagi otomatis…');
    // Tampilkan data demo sebagai fallback supaya layar TV tidak kosong total,
    // sambil status tetap jelas menunjukkan bahwa ini BUKAN data live.
    renderCokimBar(DEMO_DATA.cokim);
    renderSlideshow(buildTableSlides(DEMO_DATA.pages));
    VideoPanel.mount(DEMO_DATA.videos);
    if (mode !== 'demo') scheduleAutoRetry();
  } finally {
    document.getElementById('btnRefresh').classList.remove('spinning');
  }
}
document.getElementById('btnRefresh').addEventListener('click', () => loadAll(false));

/* ═══════════════════════════════════════════════════════
   INIT — load sekali, TIDAK ADA auto-refresh/polling
═══════════════════════════════════════════════════════ */
loadAll();
