/* =========================================================
   PANTES GOLD & JEWELRY — config.js
   ---------------------------------------------------------
   FILE INI DIPAKAI BERSAMA oleh 2 halaman:
     - index.html    → TV / Digital Signage (slideshow + video)
     - customer.html → halaman berbagi harga ke customer

   TUJUAN: satu sumber kebenaran untuk GAS_URL, daftar sheet/page,
   dan helper umum — supaya tidak ada lagi kasus "URL sudah diganti
   di 1 file tapi lupa di file lain". Cukup edit GAS_URL di SINI,
   otomatis berlaku untuk kedua halaman.

   WAJIB dimuat SEBELUM script.js / customer.js:
     <script src="config.js"></script>
     <script src="script.js"></script>     (atau customer.js)
   ========================================================= */

/* ═══════════════════════════════════════════════════════
   CONFIG
═══════════════════════════════════════════════════════ */
const CONFIG = {
  FETCH_TIMEOUT: 20_000,     // ms — batas waktu tunggu SATU percobaan (dinaikkan dari 12s karena
                              // cold-start Apps Script / spreadsheet besar kadang butuh waktu lebih)
  RETRY_ATTEMPTS: 3,         // jumlah percobaan total (termasuk percobaan pertama) sebelum menyerah
  RETRY_DELAYS: [2_000, 5_000], // jeda (ms) sebelum percobaan ke-2 dan ke-3
  /* Paksa selalu pakai data contoh lokal walau GAS_URL sudah diisi benar.
     Biarkan `false` untuk pemakaian normal — mode live/demo akan
     TERDETEKSI OTOMATIS dari GAS_URL di bawah (tidak perlu diubah manual). */
  FORCE_DEMO: false,
  /* URL deployment Google Apps Script (Web App /exec).
     PENTING: setiap kali Deploy > New version/deployment baru, Apps Script
     BISA membuat URL /exec baru — selalu perbarui baris ini setelahnya.
     Berlaku untuk index.html (TV) MAUPUN customer.html (berbagi harga). */
  GAS_URL: 'https://script.google.com/macros/s/AKfycbysDWm9-r_IJcveMuD_TfZitM3IiZqhlI9cMaoOQUAF4xH87_YHF6dcSrg8AGatJ26WHQ/exec',
};

/** Tentukan mode live/demo secara otomatis dari isi GAS_URL — ini mencegah
    kasus umum "URL sudah diganti tapi web masih Demo Mode" karena dulu
    ada 2 pengaturan terpisah (URL & toggle) yang mudah lupa disinkronkan. */
function resolveMode() {
  if (CONFIG.FORCE_DEMO) return { mode: 'demo', reason: 'FORCE_DEMO aktif di CONFIG' };
  const url = String(CONFIG.GAS_URL || '').trim();
  const isPlaceholder = !url || url.includes('GANTI_DENGAN');
  const looksValid = /^https:\/\/script\.google(usercontent)?\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec\/?$/.test(url);
  if (isPlaceholder) return { mode: 'demo', reason: 'GAS_URL belum diisi (masih placeholder)' };
  if (!looksValid)   return { mode: 'demo', reason: 'GAS_URL tidak sesuai format .../exec — cek kembali URL deployment' };
  return { mode: 'live', reason: '' };
}

/* Urutan & judul page (harus selaras dengan SHEET_PAGES di Code.gs) */
const PAGE_META = [
  { key: 'NOTA_LUAR',   title: 'HARGA NOTA LUAR',                      cols: ['id', 'harga_terima'], accent: 'accent-gold'  },
  { key: 'HARGA_EMAS',  title: 'HARGA EMAS PERHIASAN',                 cols: ['id', 'jual', 'beli'],  accent: 'accent-brown' },
  { key: 'ANTAM_2026',  title: 'LM ANTAM CERTIEYE REDMARK 2026',       cols: ['id', 'jual', 'beli'],  accent: 'accent-gold'  },
  { key: 'ANTAM_UNDER', title: 'LM ANTAM CERTIEYE REDMARK UNDER 2026', cols: ['id', 'jual', 'beli'],  accent: 'accent-green' },
  { key: 'ARCHI',       title: 'LM LOTUS ARCHI',                       cols: ['id', 'jual', 'beli'],  accent: 'accent-red'   },
  { key: 'UBS_NEW',     title: 'LM UBS SNI (BARU)',                    cols: ['id', 'jual', 'beli'],  accent: 'accent-blue'  },
  { key: 'EMASKU',      title: 'EMASKU',                               cols: ['id', 'jual', 'beli'],  accent: 'accent-gold'  },
];
const COL_LABEL = { id: 'KADAR / GRAM', harga_terima: 'HARGA TERIMA', jual: 'HARGA JUAL', beli: 'HARGA BELI' };

/* ═══════════════════════════════════════════════════════
   DATA CONTOH (dipakai otomatis kalau GAS_URL belum diisi/valid)
═══════════════════════════════════════════════════════ */
const DEMO_DATA = {
  cokim: { global: 1820000, trimas: 1800000 },
  videos: [
    { id: 'DEMO1', judul: 'Contoh Video Promo (Demo Mode)', platform: 'youtube', fileId: 'aqz-KE-bpKQ', urutan: 1, durasi: 30 },
  ],
  pages: {
    NOTA_LUAR: [
      { id: '6K',  harga_terima: 450000 }, { id: '7K',  harga_terima: 450000 },
      { id: '8K',  harga_terima: 504000 }, { id: '9K',  harga_terima: 576000 },
      { id: '16K', harga_terima: 1260000 }, { id: '17K', harga_terima: 1314000 },
      { id: '18K', harga_terima: 1404000 },
    ],
    HARGA_EMAS: [
      { id: '6K',  jual: 673000,  beli: 609500 }, { id: '7K',  jual: 728000,  beli: 728000 },
      { id: '8K',  jual: 874000,  beli: 819000 }, { id: '9K',  jual: 947000,  beli: 891500 },
      { id: '16K', jual: 1420000, beli: 1373500 }, { id: '17K', jual: 1583000, beli: 1564000 },
      { id: '18K', jual: 1602000, beli: 1582500 },
    ],
    ANTAM_2026: [
      { id: '0.5', jual: 955000, beli: 830000 }, { id: '1', jual: 1872000, beli: 1770000 },
      { id: '2', jual: 3722000, beli: 3520000 }, { id: '5', jual: 9260000, beli: 8770000 },
      { id: '10', jual: 18490000, beli: 17510000 }, { id: '25', jual: 46125000, beli: 43700000 },
      { id: '50', jual: 92150000, beli: 87250000 }, { id: '100', jual: 184100000, beli: 174400000 },
    ],
    ANTAM_UNDER: [
      { id: '0.5', jual: 940000, beli: 815000 }, { id: '1', jual: 1845000, beli: 1745000 },
      { id: '2', jual: 3668000, beli: 3468000 }, { id: '5', jual: 9120000, beli: 8630000 },
      { id: '10', jual: 18200000, beli: 17220000 }, { id: '25', jual: 45400000, beli: 43000000 },
      { id: '50', jual: 90700000, beli: 85900000 }, { id: '100', jual: 181200000, beli: 166060000 },
    ],
    ARCHI: [
      { id: '0.5', jual: 940000, beli: 815000 }, { id: '1', jual: 1845000, beli: 1745000 },
      { id: '2', jual: 3668000, beli: 3468000 }, { id: '5', jual: 9120000, beli: 8630000 },
    ],
    UBS_NEW: [
      { id: '0.5', jual: 920000, beli: 800000 }, { id: '1', jual: 1820000, beli: 1720000 },
      { id: '2', jual: 3620000, beli: 3420000 }, { id: '5', jual: 9020000, beli: 8520000 },
    ],
    EMASKU: [
      { id: '1', jual: 1850000, beli: 1750000 }, { id: '2', jual: 3670000, beli: 3470000 },
    ],
  },
};

/* ═══════════════════════════════════════════════════════
   HELPERS UMUM (dipakai script.js & customer.js)
═══════════════════════════════════════════════════════ */
const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmtRp = v => {
  if (v === '' || v === null || v === undefined) return '—';
  const n = Number(v);
  return isNaN(n) ? esc(String(v)) : 'Rp ' + n.toLocaleString('id-ID');
};

async function fetchJSON(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 12_000);
  let res;
  try {
    res = await fetch(url, { cache: 'no-store', signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Waktu tunggu habis (server tidak merespons). Cek koneksi internet.');
    throw new Error('Tidak bisa terhubung ke server (' + err.message + '). Cek koneksi internet.');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Server merespons error HTTP ${res.status}`);

  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    // Respons bukan JSON — biasanya karena deployment butuh login (redirect ke halaman HTML).
    throw new Error('Respons server bukan JSON. Pastikan deployment Apps Script diatur "Who has access: Anyone".');
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}

/** Pastikan payload dari action=all punya bentuk yang diharapkan, supaya
    kesalahan struktur data tidak menyebabkan layar putih tanpa penjelasan. */
function validateAllPayload(data) {
  if (!data || typeof data !== 'object') throw new Error('Data dari server kosong / tidak valid.');
  if (!data.pages || typeof data.pages !== 'object') throw new Error('Field "pages" tidak ditemukan pada respons server.');
  if (!Array.isArray(data.videos)) data.videos = [];
  if (!data.cokim || typeof data.cokim !== 'object') data.cokim = { global: null, trimas: null };
  return data;
}

/** fetchJSON dengan retry otomatis + backoff — mengatasi kelambatan sesaat
    (cold-start Apps Script, koneksi WiFi TV yang sempat lemot, dsb) supaya
    tidak langsung menampilkan "gagal dimuat" hanya karena satu percobaan
    telat sedikit. Percobaan ke-2/3 memberi jeda sebelum mencoba lagi. */
async function fetchJSONWithRetry(url, timeoutMs, attempts, delays) {
  const maxAttempts = attempts || CONFIG.RETRY_ATTEMPTS || 1;
  const waits = delays || CONFIG.RETRY_DELAYS || [];
  let lastErr;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fetchJSON(url, timeoutMs);
    } catch (err) {
      lastErr = err;
      const isLastTry = i === maxAttempts - 1;
      if (isLastTry) break;
      const wait = waits[i] != null ? waits[i] : 3_000;
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw lastErr;
}
