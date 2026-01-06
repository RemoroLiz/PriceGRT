// Konfigurasi Sheet
const SHEET_CONFIG = {
  harga: { gid: "216173443", name: "Harga" },
  runningText: { gid: "1779766141", name: "RunningText" },
  iklan: { gid: "1303897065", name: "Iklan" },
};

// Base URL untuk Google Sheets
const SHEET_BASE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQFH0squhL_c2KoNryfBrysWZEKTTUpthg_1XVE-fT3r7-ew1_lkbFqENefrlBLHClis53FyDdNiUkh/pub";

// State aplikasi
const appState = {
  tableData: {},
  currentTableType: "emas",
  rotationInterval: null,
  adsData: [],
  currentVideoIndex: 0,
  videoPlayed: false,
  isYouTubeAPILoaded: false,
  youtubePlayer: null,
  userInteracted: false,
  autoplayAttempted: false,
};

// Helper functions
function formatCurrency(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

// Inisialisasi aplikasi
document.addEventListener("DOMContentLoaded", function () {
  console.log("Memuat aplikasi harga emas...");

  // Setup event listeners untuk interaksi pengguna
  setupUserInteractionListeners();

  // Setup navigation
  document.querySelector(".left-nav").addEventListener("click", () => {
    handleUserInteraction();
    navigateTables("left");
  });
  document.querySelector(".right-nav").addEventListener("click", () => {
    handleUserInteraction();
    navigateTables("right");
  });

  // Load data
  loadPriceData();
  loadRunningText();
  loadAdsData();

  // Mulai rotasi
  startRotationInterval();

  // Load YouTube API
  loadYouTubeAPI();
});

// Setup listeners untuk interaksi pengguna
function setupUserInteractionListeners() {
  const interactionEvents = ["click", "touchstart", "keydown", "scroll"];

  interactionEvents.forEach((eventType) => {
    document.addEventListener(eventType, handleUserInteraction, {
      once: false, // Biarkan multiple interactions
      passive: true,
    });
  });
}

function handleUserInteraction() {
  if (!appState.userInteracted) {
    console.log(
      "Interaksi pengguna terdeteksi - autoplay dengan suara diizinkan"
    );
    appState.userInteracted = true;

    // Coba play video jika sedang ditampilkan
    if (
      appState.youtubePlayer &&
      document.getElementById("videoContainer").classList.contains("active")
    ) {
      playVideoWithSound();
    }
  }
}

// Load YouTube API
function loadYouTubeAPI() {
  if (!appState.isYouTubeAPILoaded) {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    appState.isYouTubeAPILoaded = true;
  }
}

// Mulai rotasi tabel
function startRotationInterval() {
  if (appState.rotationInterval) clearInterval(appState.rotationInterval);

  appState.rotationInterval = setInterval(() => {
    navigateTables("right");
  }, 25000);
}

// Navigasi tabel
function navigateTables(direction) {
  const types = ["emas", "antam", "archi"];
  const currentIndex = types.indexOf(appState.currentTableType);
  let nextIndex;

  if (direction === "right") {
    nextIndex = (currentIndex + 1) % types.length;
  } else {
    nextIndex = (currentIndex - 1 + types.length) % types.length;
  }

  appState.currentTableType = types[nextIndex];
  displayTables(appState.currentTableType);

  // Tampilkan video jika tipe archi dan ada iklan aktif
  if (
    appState.currentTableType === "archi" &&
    hasActiveAds() &&
    !appState.videoPlayed
  ) {
    showVideoAfterDelay();
  }
}

// Cek apakah ada iklan aktif
function hasActiveAds() {
  return (
    appState.adsData.filter(
      (ad) =>
        ad.status &&
        ad.status.toLowerCase() === "active" &&
        ad.video_url &&
        isValidYouTubeUrl(ad.video_url)
    ).length > 0
  );
}

// Validasi URL YouTube
function isValidYouTubeUrl(url) {
  if (!url) return false;
  const cleanUrl = url.trim();
  if (!cleanUrl) return false;

  const youtubePattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+/;
  return youtubePattern.test(cleanUrl);
}

// Tampilkan video setelah delay
function showVideoAfterDelay() {
  setTimeout(() => {
    showVideo();
  }, 3000);
}

// Tampilkan video
function showVideo() {
  const activeAds = appState.adsData.filter(
    (ad) =>
      ad.status &&
      ad.status.toLowerCase() === "active" &&
      ad.video_url &&
      isValidYouTubeUrl(ad.video_url)
  );

  if (activeAds.length === 0) {
    console.log("Tidak ada iklan aktif");
    appState.videoPlayed = true;
    return;
  }

  // Reset index jika melebihi jumlah video
  if (appState.currentVideoIndex >= activeAds.length) {
    appState.currentVideoIndex = 0;
  }

  const selectedAd = activeAds[appState.currentVideoIndex];
  const videoContainer = document.getElementById("videoContainer");
  const videoWrapper = document.querySelector(".video-wrapper");

  console.log(
    `Menampilkan video: ${appState.currentVideoIndex + 1} dari ${
      activeAds.length
    }`
  );

  // Sembunyikan tabel
  document.getElementById("tableEmas").style.display = "none";
  document.getElementById("tableAntam").style.display = "none";

  // Bersihkan dan buat container baru
  videoWrapper.innerHTML = "";

  // Buat container untuk video
  const videoContainerDiv = document.createElement("div");
  videoContainerDiv.id = "player";
  videoContainerDiv.style.width = "100%";
  videoContainerDiv.style.height = "400px";
  videoContainerDiv.style.borderRadius = "8px";
  videoContainerDiv.style.overflow = "hidden";
  videoContainerDiv.style.position = "relative";

  videoWrapper.appendChild(videoContainerDiv);

  // Tampilkan container video
  videoContainer.classList.add("active");
  appState.videoPlayed = true;

  // Setup YouTube Player
  setTimeout(() => {
    setupYouTubePlayer(selectedAd.video_url);
  }, 500);
}

// Setup YouTube Player untuk autoplay tanpa mute
function setupYouTubePlayer(videoUrl) {
  // Ekstrak video ID dari URL
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    console.error("Tidak dapat mengekstrak Video ID dari URL:", videoUrl);
    return;
  }

  // Reset autoplay attempt
  appState.autoplayAttempted = false;

  // Buat player YouTube TANPA mute
  appState.youtubePlayer = new YT.Player("player", {
    height: "400",
    width: "100%",
    videoId: videoId,
    playerVars: {
      autoplay: 0, // Jangan gunakan autoplay YouTube, kita handle manual
      mute: 0, // Tidak mute
      enablejsapi: 1,
      rel: 0,
      playsinline: 1,
      controls: 1,
      modestbranding: 1,
      showinfo: 0,
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError,
    },
  });
}

// Ekstrak Video ID dari URL YouTube
function extractVideoId(url) {
  const regExp =
    /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[7].length === 11 ? match[7] : null;
}

// YouTube Player Callbacks
function onPlayerReady(event) {
  console.log("YouTube Player siap");

  // Coba autoplay tanpa mute
  attemptAutoplayWithSound(event.target);
}

function attemptAutoplayWithSound(player) {
  if (appState.autoplayAttempted) return;

  appState.autoplayAttempted = true;

  // Strategi 1: Langsung coba play dengan suara
  setTimeout(() => {
    try {
      player.playVideo();
      console.log("Mencoba autoplay dengan suara...");
    } catch (error) {
      console.log("Autoplay dengan suara diblokir:", error);

      // Strategi 2: Tunggu interaksi pengguna
      if (appState.userInteracted) {
        try {
          player.playVideo();
          console.log("Video diputar setelah interaksi pengguna");
        } catch (error2) {
          console.log("Masih tidak bisa memutar video:", error2);
          showInteractivePlayButton(player);
        }
      } else {
        showInteractivePlayButton(player);
      }
    }
  }, 1000);
}

function playVideoWithSound() {
  if (appState.youtubePlayer && appState.youtubePlayer.playVideo) {
    try {
      appState.youtubePlayer.playVideo();
      console.log("Memutar video dengan suara setelah interaksi");

      // Sembunyikan tombol play jika ada
      const playBtn = document.querySelector(".play-btn");
      if (playBtn) {
        playBtn.style.display = "none";
      }
    } catch (error) {
      console.log("Gagal memutar video dengan suara:", error);
    }
  }
}

function onPlayerStateChange(event) {
  console.log("Status Player berubah:", event.data);

  // Jika video selesai, lanjut ke video berikutnya
  if (event.data === YT.PlayerState.ENDED) {
    console.log("Video selesai, melanjutkan ke video berikutnya...");
    playNextVideo();
  }

  // Jika video sedang diputar, pastikan tidak mute
  if (event.data === YT.PlayerState.PLAYING) {
    try {
      event.target.unMute();
      console.log("Video diputar tanpa mute");
    } catch (error) {
      // Ignore errors
    }
  }
}

function onPlayerError(event) {
  console.error("Error YouTube Player:", event.data);
}

// Tampilkan tombol play interaktif
function showInteractivePlayButton(player) {
  const videoWrapper = document.querySelector(".video-wrapper");

  // Hapus tombol play yang sudah ada
  const existingBtn = videoWrapper.querySelector(".play-btn");
  if (existingBtn) existingBtn.remove();

  const playBtn = document.createElement("button");
  playBtn.className = "play-btn";
  playBtn.innerHTML = `
        <i class="fas fa-volume-up" style="margin-right: 8px;"></i>
        Klik untuk Memutar Video dengan Suara
    `;
  playBtn.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, var(--primary), #b8860b);
        color: white;
        border: none;
        padding: 18px 30px;
        border-radius: 12px;
        cursor: pointer;
        z-index: 90;
        font-family: 'Poppins', sans-serif;
        font-size: 16px;
        font-weight: 600;
        box-shadow: 0 6px 20px rgba(212, 175, 55, 0.4);
        transition: all 0.3s ease;
        text-align: center;
        min-width: 280px;
    `;

  // Hover effect
  playBtn.addEventListener("mouseenter", function () {
    this.style.background = "linear-gradient(135deg, #b8860b, var(--primary))";
    this.style.transform = "translate(-50%, -50%) scale(1.05)";
    this.style.boxShadow = "0 8px 25px rgba(212, 175, 55, 0.6)";
  });

  playBtn.addEventListener("mouseleave", function () {
    this.style.background = "linear-gradient(135deg, var(--primary), #b8860b)";
    this.style.transform = "translate(-50%, -50%) scale(1)";
    this.style.boxShadow = "0 6px 20px rgba(212, 175, 55, 0.4)";
  });

  playBtn.onclick = function () {
    handleUserInteraction(); // Tandai sebagai interaksi pengguna
    playVideoWithSound();
  };

  // Tambahkan instruksi
  const instruction = document.createElement("div");
  instruction.className = "play-instruction";
  instruction.innerHTML =
    "Browser memerlukan interaksi untuk memutar video dengan suara";
  instruction.style.cssText = `
        position: absolute;
        top: calc(50% + 60px);
        left: 50%;
        transform: translateX(-50%);
        color: white;
        background: rgba(0, 0, 0, 0.7);
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 14px;
        text-align: center;
        z-index: 90;
        font-family: 'Poppins', sans-serif;
    `;

  videoWrapper.appendChild(playBtn);
  videoWrapper.appendChild(instruction);
}

// Putar video berikutnya
function playNextVideo() {
  console.log("Memainkan video berikutnya...");

  // Pindah ke video berikutnya
  appState.currentVideoIndex++;

  const activeAds = appState.adsData.filter(
    (ad) =>
      ad.status &&
      ad.status.toLowerCase() === "active" &&
      ad.video_url &&
      isValidYouTubeUrl(ad.video_url)
  );

  if (appState.currentVideoIndex < activeAds.length) {
    // Masih ada video berikutnya, tampilkan
    showVideo();
  } else {
    // Semua video sudah ditampilkan, reset dan sembunyikan
    appState.currentVideoIndex = 0;
    hideVideo();
  }
}

// Sembunyikan video
function hideVideo() {
  const videoContainer = document.getElementById("videoContainer");
  const videoWrapper = document.querySelector(".video-wrapper");

  console.log("Menyembunyikan video");

  // Hentikan video jika sedang diputar
  if (appState.youtubePlayer) {
    try {
      appState.youtubePlayer.stopVideo();
      appState.youtubePlayer.destroy();
    } catch (error) {
      console.log("Tidak dapat menghentikan video:", error);
    }
    appState.youtubePlayer = null;
  }

  // Reset status video
  appState.videoPlayed = false;
  appState.autoplayAttempted = false;

  // Bersihkan container video
  videoWrapper.innerHTML = "";

  // Sembunyikan container video
  videoContainer.classList.remove("active");

  // Tampilkan kembali tabel
  document.getElementById("tableEmas").style.display = "block";
  document.getElementById("tableAntam").style.display = "block";
}

// ... (Fungsi-fungsi lainnya tetap sama: loadPriceData, loadRunningText, loadAdsData, dll.)

// Load data harga
async function loadPriceData() {
  try {
    console.log("Memuat data harga...");
    const url = `${SHEET_BASE_URL}?gid=${SHEET_CONFIG.harga.gid}&single=true&output=csv`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvText = await response.text();
    const data = parseCSVToJSON(csvText);

    appState.tableData.emas = data.filter(
      (row) => row.tipe && row.tipe.toLowerCase() === "emas"
    );
    appState.tableData.antam = data.filter(
      (row) => row.tipe && row.tipe.toLowerCase() === "antam"
    );
    appState.tableData.archi = data.filter(
      (row) => row.tipe && row.tipe.toLowerCase() === "archi"
    );

    console.log(
      `Data loaded - Emas: ${appState.tableData.emas.length}, Antam: ${appState.tableData.antam.length}, Archi: ${appState.tableData.archi.length}`
    );

    displayTables("emas");
  } catch (error) {
    console.error("Error loading CSV data:", error);
    showError();
  }
}

// Load running text
async function loadRunningText() {
  try {
    console.log("Memuat running text...");
    const url = `${SHEET_BASE_URL}?gid=${SHEET_CONFIG.runningText.gid}&single=true&output=csv`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvText = await response.text();
    const data = parseRunningTextCSV(csvText);

    processRunningTextData(data);
  } catch (error) {
    console.error("Error loading running text:", error);
    document.getElementById("marqueeText").textContent =
      "Harga emas terkini - Informasi terupdate setiap hari";
  }
}

// Load data iklan
async function loadAdsData() {
  try {
    console.log("Memuat data iklan...");
    const url = `${SHEET_BASE_URL}?gid=${SHEET_CONFIG.iklan.gid}&single=true&output=csv`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvText = await response.text();
    appState.adsData = parseAdsCSV(csvText);
    console.log("Ads data loaded:", appState.adsData.length, "iklan");
  } catch (error) {
    console.error("Error loading ads data:", error);
  }
}

// Parser untuk data iklan
function parseAdsCSV(csvText) {
  const lines = csvText.trim().split("\n");

  if (lines.length < 1) return [];

  if (lines.length === 1) {
    const values = lines[0].split(",").map((v) => v.trim());
    if (values.length >= 7) {
      return [
        {
          judul: values[0],
          deskripsi: values[1],
          video_url: values[2],
          gambar_url: values[3],
          link1: values[4],
          link2: values[5],
          status: values[6],
        },
      ];
    }
    return [];
  }

  const headers = lines[0]
    .split(",")
    .map((h) => h.toLowerCase().trim().replace(/\s+/g, "_"));

  return lines
    .slice(1)
    .map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const obj = {};

      headers.forEach((header, index) => {
        if (index < values.length) {
          obj[header] = values[index];
        }
      });

      return obj;
    })
    .filter(
      (ad) =>
        ad.video_url &&
        ad.video_url.trim() !== "" &&
        ad.status &&
        ad.status.toLowerCase() === "active"
    );
}

// Parser untuk running text
function parseRunningTextCSV(csvText) {
  const lines = csvText.trim().split("\n");

  if (lines.length < 1) return [];

  if (lines.length === 1) {
    return [{ teks: lines[0].trim() }];
  }

  const headers = lines[0]
    .split(",")
    .map((h) => h.toLowerCase().trim().replace(/\s+/g, "_"));

  const textColumn =
    headers.find(
      (h) =>
        h.includes("teks") ||
        h.includes("text") ||
        h.includes("isi") ||
        h.includes("running")
    ) || headers[0];

  return lines
    .slice(1)
    .map((line) => {
      const values = line.split(",").map((v) => v.trim());

      if (values.length === 1) {
        return { teks: values[0] };
      }

      const textIndex = headers.indexOf(textColumn);
      const teks =
        textIndex >= 0 && textIndex < values.length
          ? values[textIndex]
          : values.join(" ");

      return { teks };
    })
    .filter((item) => item.teks && item.teks.trim() !== "");
}

// Proses data running text
function processRunningTextData(data) {
  if (!data || data.length === 0) {
    document.getElementById("marqueeText").textContent =
      "Harga emas terkini - Informasi terupdate setiap hari";
    return;
  }

  const runningTexts = data
    .map((item) => item.teks)
    .filter((teks) => teks && teks.trim() !== "");

  if (runningTexts.length === 0) {
    document.getElementById("marqueeText").textContent =
      "Harga emas terkini - Informasi terupdate setiap hari";
    return;
  }

  const marqueeContent = runningTexts.join(" | ");
  const marqueeElement = document.getElementById("marqueeText");
  marqueeElement.textContent = marqueeContent;

  adjustMarqueeSpeed(marqueeContent.length);
}

// Sesuaikan kecepatan marquee
function adjustMarqueeSpeed(textLength) {
  const marqueeElement = document.getElementById("marqueeText");
  const baseDuration = 60;
  const duration = Math.max(baseDuration, textLength / 10);

  marqueeElement.style.animation = "none";

  setTimeout(() => {
    marqueeElement.style.animation = `marquee ${duration}s linear infinite`;
  }, 10);
}

// Parser CSV ke JSON
function parseCSVToJSON(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const obj = {};
    headers.forEach((header, index) => {
      let value = values[index] || "";
      if (["harga_jual", "buyback"].includes(header)) {
        value = parseInt(value.replace(/[^0-9]/g, ""), 10) || 0;
      }
      obj[header] = value;
    });
    return obj;
  });
}

// Tampilkan tabel
function displayTables(type) {
  const data = appState.tableData[type];
  if (!data || data.length === 0) {
    showError();
    return;
  }

  updateTableTitles(type);

  const half = Math.ceil(data.length / 2);
  const leftData = data.slice(0, half);
  const rightData = data.slice(half);

  updateTable("priceTableLeft", leftData, type);
  updateTable("priceTableRight", rightData, type);
}

// Update judul tabel
function updateTableTitles(type) {
  const tableTitles = document.querySelectorAll(".table-title");

  if (type === "emas") {
    tableTitles[0].textContent = "Harga Emas";
    tableTitles[1].textContent = "Harga Emas";
  } else if (type === "antam") {
    tableTitles[0].textContent = "Harga Antam";
    tableTitles[1].textContent = "Harga Antam";
  } else if (type === "archi") {
    tableTitles[0].textContent = "Harga Archi";
    tableTitles[1].textContent = "Harga Archi";
  }
}

// Update tabel
function updateTable(elementId, data, type) {
  const tableElement = document.getElementById(elementId);

  if (data.length === 0) {
    tableElement.innerHTML = '<div class="no-data">Data tidak tersedia</div>';
    return;
  }

  let tableHTML = `
        <table class="price-table">
            <thead>
                <tr>
                    <th>Kode</th>
                    <th>Jual</th>
                    <th>Buyback</th>
                </tr>
            </thead>
            <tbody>
    `;

  data.forEach((item) => {
    tableHTML += `
            <tr>
                <td>${item.kode || "-"}</td>
                <td class="highlight">${
                  item.harga_jual ? formatCurrency(item.harga_jual) : "-"
                }</td>
                <td class="highlight">${
                  item.buyback ? formatCurrency(item.buyback) : "-"
                }</td>
            </tr>
        `;
  });

  tableHTML += `
            </tbody>
        </table>
    `;

  tableElement.innerHTML = tableHTML;
}

// Tampilkan error
function showError() {
  const errorHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Gagal memuat data. Silakan coba lagi.</p>
        </div>
    `;
  document.getElementById("priceTableLeft").innerHTML = errorHTML;
  document.getElementById("priceTableRight").innerHTML = errorHTML;
}

// Reset state ketika halaman di-refresh
window.addEventListener("beforeunload", function () {
  appState.currentVideoIndex = 0;
  appState.videoPlayed = false;
  appState.userInteracted = false;
  appState.autoplayAttempted = false;
});

// Handle visibility change
document.addEventListener("visibilitychange", function () {
  if (document.hidden) {
    if (appState.rotationInterval) clearInterval(appState.rotationInterval);
  } else {
    startRotationInterval();
  }
});

// YouTube API callback global
window.onYouTubeIframeAPIReady = function () {
  console.log("YouTube API siap digunakan");
};
