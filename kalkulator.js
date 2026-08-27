/* =========================================================
   PANTES GOLD & JEWELRY — kalkulator.js
   ---------------------------------------------------------
   Kalkulator harga JUAL & BUYBACK (BELI), berdiri sendiri (tidak
   ditautkan dari index.html/customer.html manapun). Hanya menarik
   cokim_global dari Spreadsheet — semua input lain (rate, berat,
   spread, selisih BB) diisi manual oleh kasir/staff per transaksi.

   RUMUS:
   JUAL:
     harga_pergram = CEILING(cokim_global × rate%, 500)
     sub_harga     = CEILING(harga_pergram × berat, 500)
   BELI (buyback):
     harga_pergram = FLOOR(cokim_global × rate%, 500) − spread − selisih_bb
     sub_harga     = FLOOR(harga_pergram × berat, 500)
   GRAND TOTAL = jumlah semua sub_harga pada daftar barang yang ditambahkan.

   PENTING: file ini BERGANTUNG pada config.js (dimuat SEBELUM file
   ini) → CONFIG, DEMO_DATA, resolveMode(), fmtRp(), fetchJSONWithRetry().
   ========================================================= */

/* ═══════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════ */
let cokimGlobal = null;
let jualItems = [];   // { id, rate, berat }
let beliItems = [];   // { id, rate, spread, selisihBB, berat }
let jualIdSeq = 1;
let beliIdSeq = 1;

const bodyJual = document.getElementById('bodyJual');
const bodyBeli = document.getElementById('bodyBeli');

/* ═══════════════════════════════════════════════════════
   RUMUS PEMBULATAN
═══════════════════════════════════════════════════════ */
const ceilTo500  = n => Math.ceil(n / 500) * 500;
const floorTo500 = n => Math.floor(n / 500) * 500;
const num = v => { const n = Number(v); return isNaN(n) ? 0 : n; };

function computeJual(item) {
  if (cokimGlobal == null) return { hargaPergram: null, subHarga: null };
  const rate = num(item.rate);
  const berat = num(item.berat);
  const hargaPergram = ceilTo500(cokimGlobal * (rate / 100));
  const subHarga = ceilTo500(hargaPergram * berat);
  return { hargaPergram, subHarga };
}
function computeBeli(item) {
  if (cokimGlobal == null) return { hargaPergram: null, subHarga: null };
  const rate = num(item.rate);
  const spread = num(item.spread);
  const selisih = num(item.selisihBB);
  const berat = num(item.berat);
  const hargaPergram = floorTo500(cokimGlobal * (rate / 100)) - spread - selisih;
  const subHarga = floorTo500(hargaPergram * berat);
  return { hargaPergram, subHarga };
}
const fmtCell = v => v == null ? '—' : fmtRp(v);

/* ═══════════════════════════════════════════════════════
   RENDER BARIS — JUAL
═══════════════════════════════════════════════════════ */
function renderJualRow(item) {
  const tr = document.createElement('tr');
  tr.dataset.id = item.id;
  tr.innerHTML = `
    <td><input type="number" inputmode="decimal" step="0.01" min="0" class="kal-input" data-field="rate" placeholder="0"></td>
    <td class="kal-cell-computed" data-cell="hargaPergram">—</td>
    <td><input type="number" inputmode="decimal" step="0.001" min="0" class="kal-input" data-field="berat" placeholder="0"></td>
    <td class="kal-cell-computed" data-cell="subHarga">—</td>
    <td><button class="kal-del-btn" data-action="delete" title="Hapus baris">✕</button></td>`;
  bodyJual.appendChild(tr);
  updateJualRow(tr, item);
}
function updateJualRow(tr, item) {
  const { hargaPergram, subHarga } = computeJual(item);
  tr.querySelector('[data-cell="hargaPergram"]').textContent = fmtCell(hargaPergram);
  tr.querySelector('[data-cell="subHarga"]').textContent = fmtCell(subHarga);
}
function updateGrandTotalJual() {
  const total = jualItems.reduce((sum, it) => sum + (computeJual(it).subHarga || 0), 0);
  document.getElementById('grandTotalJual').textContent = fmtRp(total);
}

/* ═══════════════════════════════════════════════════════
   RENDER BARIS — BELI
═══════════════════════════════════════════════════════ */
function renderBeliRow(item) {
  const tr = document.createElement('tr');
  tr.dataset.id = item.id;
  tr.innerHTML = `
    <td><input type="number" inputmode="decimal" step="0.01" min="0" class="kal-input" data-field="rate" placeholder="0"></td>
    <td><input type="number" inputmode="decimal" step="1" class="kal-input" data-field="spread" placeholder="0"></td>
    <td><input type="number" inputmode="decimal" step="1" class="kal-input" data-field="selisihBB" placeholder="0"></td>
    <td class="kal-cell-computed" data-cell="hargaPergram">—</td>
    <td><input type="number" inputmode="decimal" step="0.001" min="0" class="kal-input" data-field="berat" placeholder="0"></td>
    <td class="kal-cell-computed" data-cell="subHarga">—</td>
    <td><button class="kal-del-btn" data-action="delete" title="Hapus baris">✕</button></td>`;
  bodyBeli.appendChild(tr);
  updateBeliRow(tr, item);
}
function updateBeliRow(tr, item) {
  const { hargaPergram, subHarga } = computeBeli(item);
  tr.querySelector('[data-cell="hargaPergram"]').textContent = fmtCell(hargaPergram);
  tr.querySelector('[data-cell="subHarga"]').textContent = fmtCell(subHarga);
}
function updateGrandTotalBeli() {
  const total = beliItems.reduce((sum, it) => sum + (computeBeli(it).subHarga || 0), 0);
  document.getElementById('grandTotalBeli').textContent = fmtRp(total);
}

/* ═══════════════════════════════════════════════════════
   TAMBAH / HAPUS / CLEAR — JUAL
═══════════════════════════════════════════════════════ */
function addJualItem() {
  const item = { id: jualIdSeq++, rate: '', berat: '' };
  jualItems.push(item);
  renderJualRow(item);
  updateGrandTotalJual();
}
function clearJual() {
  jualItems = [];
  bodyJual.innerHTML = '';
  updateGrandTotalJual();
}
document.getElementById('btnAddJual').addEventListener('click', addJualItem);
document.getElementById('btnClearJual').addEventListener('click', clearJual);

bodyJual.addEventListener('input', (e) => {
  const input = e.target.closest('.kal-input');
  if (!input) return;
  const tr = input.closest('tr');
  const item = jualItems.find(it => it.id === Number(tr.dataset.id));
  if (!item) return;
  item[input.dataset.field] = input.value;
  updateJualRow(tr, item);
  updateGrandTotalJual();
});
bodyJual.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="delete"]');
  if (!btn) return;
  const tr = btn.closest('tr');
  const id = Number(tr.dataset.id);
  jualItems = jualItems.filter(it => it.id !== id);
  tr.remove();
  updateGrandTotalJual();
});

/* ═══════════════════════════════════════════════════════
   TAMBAH / HAPUS / CLEAR — BELI
═══════════════════════════════════════════════════════ */
function addBeliItem() {
  const item = { id: beliIdSeq++, rate: '', spread: '', selisihBB: '', berat: '' };
  beliItems.push(item);
  renderBeliRow(item);
  updateGrandTotalBeli();
}
function clearBeli() {
  beliItems = [];
  bodyBeli.innerHTML = '';
  updateGrandTotalBeli();
}
document.getElementById('btnAddBeli').addEventListener('click', addBeliItem);
document.getElementById('btnClearBeli').addEventListener('click', clearBeli);

bodyBeli.addEventListener('input', (e) => {
  const input = e.target.closest('.kal-input');
  if (!input) return;
  const tr = input.closest('tr');
  const item = beliItems.find(it => it.id === Number(tr.dataset.id));
  if (!item) return;
  item[input.dataset.field] = input.value;
  updateBeliRow(tr, item);
  updateGrandTotalBeli();
});
bodyBeli.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="delete"]');
  if (!btn) return;
  const tr = btn.closest('tr');
  const id = Number(tr.dataset.id);
  beliItems = beliItems.filter(it => it.id !== id);
  tr.remove();
  updateGrandTotalBeli();
});

/* ═══════════════════════════════════════════════════════
   TAB SWITCHER
═══════════════════════════════════════════════════════ */
document.querySelectorAll('.kal-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.kal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.kal-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panelId = tab.dataset.tab === 'jual' ? 'panelJual' : 'panelBeli';
    document.getElementById(panelId).classList.add('active');
  });
});

/* ═══════════════════════════════════════════════════════
   MUAT COKIM GLOBAL DARI SPREADSHEET
═══════════════════════════════════════════════════════ */
async function loadCokim() {
  const cokimEl = document.getElementById('cokimValue');
  const btn = document.getElementById('btnRefreshCokim');
  cokimEl.textContent = 'Memuat…';
  btn.classList.add('spinning');
  const { mode } = resolveMode();

  try {
    let global;
    if (mode === 'demo') {
      await new Promise(r => setTimeout(r, 200));
      global = DEMO_DATA.cokim.global;
    } else {
      const data = await fetchJSONWithRetry(`${CONFIG.GAS_URL}?action=cokim`, CONFIG.FETCH_TIMEOUT);
      global = data && data.global != null ? Number(data.global) : null;
    }
    if (global == null || isNaN(global)) throw new Error('Nilai cokim_global tidak ditemukan di sheet COKIM.');
    cokimGlobal = global;
    cokimEl.textContent = fmtRp(cokimGlobal) + (mode === 'demo' ? ' (Demo)' : '');
  } catch (err) {
    console.error('loadCokim error:', err);
    cokimGlobal = null;
    cokimEl.textContent = 'Gagal memuat — tekan refresh';
  } finally {
    btn.classList.remove('spinning');
    // Hitung ulang semua baris yang sudah ada (kalau cokim baru berhasil
    // dimuat/di-refresh setelah user sempat mengisi rate/berat duluan).
    document.querySelectorAll('#bodyJual tr').forEach(tr => {
      const item = jualItems.find(it => it.id === Number(tr.dataset.id));
      if (item) updateJualRow(tr, item);
    });
    document.querySelectorAll('#bodyBeli tr').forEach(tr => {
      const item = beliItems.find(it => it.id === Number(tr.dataset.id));
      if (item) updateBeliRow(tr, item);
    });
    updateGrandTotalJual();
    updateGrandTotalBeli();
  }
}
document.getElementById('btnRefreshCokim').addEventListener('click', loadCokim);

/* ═══════════════════════════════════════════════════════
   INIT — muat cokim + siapkan 1 baris kosong di tiap halaman
═══════════════════════════════════════════════════════ */
loadCokim();
addJualItem();
addBeliItem();
