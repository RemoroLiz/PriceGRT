// Konfigurasi Sheet
const SHEET_CONFIG = {
  harga: { gid: "216173443", name: "Harga" },
  runningText: { gid: "1779766141", name: "RunningText" },
  iklan: { gid: "1303897065", name: "Iklan" },
};

// Base URL untuk Google Sheets
const SHEET_BASE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZ4Jrb5j2IVmK72GbEhHoyIzck-H-khwypavvFpGD8yxetAErp-YpE6Krtu8OtuOTMYzUozy-CrAy5/pub";

// State aplikasi dengan cache
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
  isVideoMuted: true,
  
  // CACHE SYSTEM: Tambahkan properti cache
  cache: {
    harga: {
      data: null,
      lastFetch: 0,
      expiration: 5 * 60 * 1000 // 5 menit
    },
    runningText: {
      data: null,
      lastFetch: 0,
      expiration: 10 * 60 * 1000 // 10 menit
    },
    iklan: {
      data: null,
      lastFetch: 0,
      expiration: 5 * 60 * 1000 // 5 menit
    }
  }
};

// Helper functions
function formatCurrency(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

// Helper: Cek apakah cache masih valid
function isCacheValid(cacheType) {
  const cache = appState.cache[cacheType];
  if (!cache || !cache.data) return false;
  
  const now = Date.now();
  const timeSinceLastFetch = now - cache.lastFetch;
  
  return timeSinceLastFetch < cache.expiration;
}

// Helper: Update cache
function updateCache(cacheType, data) {
  appState.cache[cacheType] = {
    data: data,
    lastFetch: Date.now(),
    expiration: appState.cache[cacheType].expiration
  };
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
  
  // Panggil responsive layout handler
  setTimeout(handleResponsiveLayout, 100);
});

// Setup listeners untuk interaksi pengguna
function setupUserInteractionListeners() {
  const interactionEvents = ["click", "touchstart", "keydown", "scroll"];

  interactionEvents.forEach((eventType) => {
    document.addEventListener(eventType, handleUserInteraction, {
      once: false,
      passive: true,
    });
  });
}

function handleUserInteraction() {
  if (!appState.userInteracted) {
    console.log("Interaksi pengguna terdeteksi - autoplay diizinkan");
    appState.userInteracted = true;
    
    // Update status user interaction untuk video
    document.body.classList.add('user-interacted');
    
    // Coba unmute dan play video jika sedang ditampilkan
    if (appState.youtubePlayer && 
        document.getElementById("videoContainer").classList.contains("active")) {
      setTimeout(() => {
        playVideoWithSound();
      }, 500);
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

  if (appState.currentVideoIndex >= activeAds.length) {
    appState.currentVideoIndex = 0;
  }

  const selectedAd = activeAds[appState.currentVideoIndex];
  const videoContainer = document.getElementById("videoContainer");
  const videoWrapper = document.querySelector(".video-wrapper");

  console.log(`Menampilkan video: ${appState.currentVideoIndex + 1} dari ${activeAds.length}`);

  document.getElementById("tableEmas").style.display = "none";
  document.getElementById("tableAntam").style.display = "none";

  videoWrapper.innerHTML = "";

  const videoContainerDiv = document.createElement("div");
  videoContainerDiv.id = "player";
  videoContainerDiv.style.width = "100%";
  videoContainerDiv.style.height = "100%";
  videoContainerDiv.style.position = "absolute";
  videoContainerDiv.style.top = "0";
  videoContainerDiv.style.left = "0";

  videoWrapper.appendChild(videoContainerDiv);

  videoContainer.classList.add("active");
  appState.videoPlayed = true;

  setTimeout(() => {
    setupYouTubePlayer(selectedAd.video_url);
  }, 500);
}

// Setup YouTube Player dengan strategi autoplay yang lebih baik
function setupYouTubePlayer(videoUrl) {
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    console.error("Tidak dapat mengekstrak Video ID dari URL:", videoUrl);
    showVideoFallback();
    return;
  }

  appState.autoplayAttempted = false;
  appState.isVideoMuted = true;

  // Gunakan muted autoplay dulu, baru unmute setelah interaksi
  appState.youtubePlayer = new YT.Player("player", {
    height: "100%",
    width: "100%",
    videoId: videoId,
    playerVars: {
      autoplay: 1,
      mute: 1,
      enablejsapi: 1,
      rel: 0,
      playsinline: 1,
      controls: 1,
      modestbranding: 1,
      showinfo: 0,
      iv_load_policy: 3,
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
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[7].length === 11 ? match[7] : null;
}

// YouTube Player Callbacks
function onPlayerReady(event) {
  console.log("YouTube Player siap, mencoba autoplay...");
  
  // Coba play dengan strategi bertahap
  attemptSmartAutoplay(event.target);
}

function attemptSmartAutoplay(player) {
  if (appState.autoplayAttempted) return;
  appState.autoplayAttempted = true;

  console.log("Status interaksi user:", appState.userInteracted);
  
  // Strategi 1: Jika user sudah interaksi, langsung play dengan suara
  if (appState.userInteracted) {
    console.log("User sudah interaksi, mencoba play dengan suara...");
    try {
      player.unMute();
      player.playVideo();
      appState.isVideoMuted = false;
      console.log("Video diputar dengan suara setelah interaksi");
      return;
    } catch (error) {
      console.log("Gagal play dengan suara:", error);
    }
  }
  
  // Strategi 2: Muted autoplay (biasanya diizinkan browser)
  console.log("Mencoba muted autoplay...");
  try {
    player.mute();
    player.playVideo();
    appState.isVideoMuted = true;
    console.log("Muted autoplay berhasil");
    
    // Tampilkan tombol untuk unmute
    showUnmuteButton(player);
    
  } catch (error) {
    console.log("Muted autoplay juga diblokir:", error);
    
    // Strategi 3: Tampilkan tombol play interaktif
    showInteractivePlayButton(player);
  }
}

function playVideoWithSound() {
  if (appState.youtubePlayer && appState.youtubePlayer.playVideo) {
    try {
      // Pastikan unmute dulu
      if (appState.isVideoMuted) {
        appState.youtubePlayer.unMute();
        appState.isVideoMuted = false;
        console.log("Video di-unmute");
      }
      
      // Coba play jika belum playing
      if (appState.youtubePlayer.getPlayerState() !== YT.PlayerState.PLAYING) {
        appState.youtubePlayer.playVideo();
        console.log("Video diputar dengan suara");
      }
      
      // Sembunyikan tombol unmute jika ada
      const unmuteBtn = document.querySelector(".unmute-btn");
      if (unmuteBtn) {
        unmuteBtn.style.display = "none";
      }
      
    } catch (error) {
      console.log("Gagal memutar video dengan suara:", error);
    }
  }
}

function onPlayerStateChange(event) {
  console.log("Status Player berubah:", event.data);

  if (event.data === YT.PlayerState.ENDED) {
    console.log("Video selesai, melanjutkan ke video berikutnya...");
    playNextVideo();
  }

  // Unmute otomatis saat video mulai diputar
  if (event.data === YT.PlayerState.PLAYING && appState.userInteracted && appState.isVideoMuted) {
    setTimeout(() => {
      try {
        event.target.unMute();
        appState.isVideoMuted = false;
        console.log("Video di-unmute otomatis saat playing");
        
        // Sembunyikan tombol unmute
        const unmuteBtn = document.querySelector(".unmute-btn");
        if (unmuteBtn) {
          unmuteBtn.style.display = "none";
        }
      } catch (error) {
        console.log("Tidak bisa unmute:", error);
      }
    }, 1000);
  }
}

function onPlayerError(event) {
  console.error("Error YouTube Player:", event.data);
  showVideoFallback();
}

// Tampilkan tombol unmute untuk muted video
function showUnmuteButton(player) {
  const videoWrapper = document.querySelector(".video-wrapper");
  
  // Hapus tombol yang sudah ada
  const existingBtn = videoWrapper.querySelector(".unmute-btn");
  if (existingBtn) existingBtn.remove();

  const unmuteBtn = document.createElement("button");
  unmuteBtn.className = "unmute-btn";
  unmuteBtn.innerHTML = `
    <i class="fas fa-volume-mute" style="margin-right: 8px;"></i>
    Klik untuk Menyalakan Suara
  `;

  unmuteBtn.onclick = function () {
    handleUserInteraction();
    playVideoWithSound();
  };

  videoWrapper.appendChild(unmuteBtn);
}

// Tampilkan tombol play interaktif
function showInteractivePlayButton(player) {
  const videoWrapper = document.querySelector(".video-wrapper");

  const existingBtn = videoWrapper.querySelector(".play-btn");
  if (existingBtn) existingBtn.remove();

  const playBtn = document.createElement("button");
  playBtn.className = "play-btn";
  playBtn.innerHTML = `
    <i class="fas fa-play" style="margin-right: 8px;"></i>
    Klik untuk Memutar Video
  `;

  playBtn.onclick = function () {
    handleUserInteraction();
    playVideoWithSound();
  };

  // Tambahkan instruksi
  const instruction = document.createElement("div");
  instruction.className = "play-instruction";
  instruction.innerHTML = "Browser memerlukan interaksi untuk memutar video";

  videoWrapper.appendChild(playBtn);
  videoWrapper.appendChild(instruction);
}

// Fallback jika video error
function showVideoFallback() {
  console.log("Menampilkan fallback untuk video yang error");
  const videoWrapper = document.querySelector(".video-wrapper");
  
  videoWrapper.innerHTML = `
    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 20px; color: white; background: rgba(0,0,0,0.7); border-radius: 8px;">
      <i class="fas fa-video-slash" style="font-size: 48px; margin-bottom: 20px;"></i>
      <h3>Video Tidak Dapat Diputar</h3>
      <p>Video iklan sedang tidak tersedia</p>
      <button onclick="hideVideo()" style="margin-top: 20px; padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;">
        Lanjutkan Ke Harga Emas
      </button>
    </div>
  `;
}

// Putar video berikutnya
function playNextVideo() {
  console.log("Memainkan video berikutnya...");

  appState.currentVideoIndex++;

  const activeAds = appState.adsData.filter(
    (ad) =>
      ad.status &&
      ad.status.toLowerCase() === "active" &&
      ad.video_url &&
      isValidYouTubeUrl(ad.video_url)
  );

  if (appState.currentVideoIndex < activeAds.length) {
    showVideo();
  } else {
    appState.currentVideoIndex = 0;
    hideVideo();
  }
}

// Sembunyikan video
function hideVideo() {
  const videoContainer = document.getElementById("videoContainer");
  const videoWrapper = document.querySelector(".video-wrapper");

  console.log("Menyembunyikan video");

  if (appState.youtubePlayer) {
    try {
      appState.youtubePlayer.stopVideo();
      appState.youtubePlayer.destroy();
    } catch (error) {
      console.log("Tidak dapat menghentikan video:", error);
    }
    appState.youtubePlayer = null;
  }

  appState.videoPlayed = false;
  appState.autoplayAttempted = false;
  appState.isVideoMuted = true;

  videoWrapper.innerHTML = "";
  videoContainer.classList.remove("active");

  document.getElementById("tableEmas").style.display = "block";
  document.getElementById("tableAntam").style.display = "block";
}

// Load data harga dengan caching
async function loadPriceData() {
  try {
    console.log("Memuat data harga...");
    
    if (isCacheValid('harga')) {
      console.log("Menggunakan data harga dari cache");
      const cachedData = appState.cache.harga.data;
      
      appState.tableData.emas = cachedData.filter(
        (row) => row.tipe && row.tipe.toLowerCase() === "emas"
      );
      appState.tableData.antam = cachedData.filter(
        (row) => row.tipe && row.tipe.toLowerCase() === "antam"
      );
      appState.tableData.archi = cachedData.filter(
        (row) => row.tipe && row.tipe.toLowerCase() === "archi"
      );

      console.log(`Data loaded from cache - Emas: ${appState.tableData.emas.length}, Antam: ${appState.tableData.antam.length}, Archi: ${appState.tableData.archi.length}`);
      displayTables("emas");
      
      // Setelah data dimuat, update layout
      setTimeout(handleResponsiveLayout, 50);
      return;
    }
    
    const url = `${SHEET_BASE_URL}?gid=${SHEET_CONFIG.harga.gid}&single=true&output=csv`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvText = await response.text();
    const data = parseCSVToJSON(csvText);
    
    updateCache('harga', data);
    
    appState.tableData.emas = data.filter(
      (row) => row.tipe && row.tipe.toLowerCase() === "emas"
    );
    appState.tableData.antam = data.filter(
      (row) => row.tipe && row.tipe.toLowerCase() === "antam"
    );
    appState.tableData.archi = data.filter(
      (row) => row.tipe && row.tipe.toLowerCase() === "archi"
    );

    console.log(`Data loaded from API - Emas: ${appState.tableData.emas.length}, Antam: ${appState.tableData.antam.length}, Archi: ${appState.tableData.archi.length}`);
    displayTables("emas");
    
    // Setelah data dimuat, update layout
    setTimeout(handleResponsiveLayout, 50);
  } catch (error) {
    console.error("Error loading CSV data:", error);
    
    if (appState.cache.harga.data) {
      console.log("Menggunakan data cache yang kadaluwarsa sebagai fallback");
      const cachedData = appState.cache.harga.data;
      
      appState.tableData.emas = cachedData.filter(
        (row) => row.tipe && row.tipe.toLowerCase() === "emas"
      );
      appState.tableData.antam = cachedData.filter(
        (row) => row.tipe && row.tipe.toLowerCase() === "antam"
      );
      appState.tableData.archi = cachedData.filter(
        (row) => row.tipe && row.tipe.toLowerCase() === "archi"
      );
      
      displayTables("emas");
    } else {
      showError();
    }
    
    // Tetap update layout meskipun error
    setTimeout(handleResponsiveLayout, 50);
  }
}

// Load running text dengan caching
async function loadRunningText() {
  try {
    console.log("Memuat running text...");
    
    if (isCacheValid('runningText')) {
      console.log("Menggunakan running text dari cache");
      const cachedData = appState.cache.runningText.data;
      processRunningTextData(cachedData);
      return;
    }
    
    const url = `${SHEET_BASE_URL}?gid=${SHEET_CONFIG.runningText.gid}&single=true&output=csv`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvText = await response.text();
    const data = parseRunningTextCSV(csvText);
    
    updateCache('runningText', data);
    
    processRunningTextData(data);
  } catch (error) {
    console.error("Error loading running text:", error);
    
    if (appState.cache.runningText.data) {
      console.log("Menggunakan running text cache sebagai fallback");
      processRunningTextData(appState.cache.runningText.data);
    } else {
      document.getElementById("marqueeText").textContent =
        "Harga emas terkini - Informasi terupdate setiap hari";
    }
  }
}

// Load data iklan dengan caching
async function loadAdsData() {
  try {
    console.log("Memuat data iklan...");
    
    if (isCacheValid('iklan')) {
      console.log("Menggunakan data iklan dari cache");
      appState.adsData = appState.cache.iklan.data;
      console.log("Ads data loaded from cache:", appState.adsData.length, "iklan");
      return;
    }
    
    const url = `${SHEET_BASE_URL}?gid=${SHEET_CONFIG.iklan.gid}&single=true&output=csv`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvText = await response.text();
    const data = parseAdsCSV(csvText);
    
    updateCache('iklan', data);
    
    appState.adsData = data;
    console.log("Ads data loaded from API:", appState.adsData.length, "iklan");
  } catch (error) {
    console.error("Error loading ads data:", error);
    
    if (appState.cache.iklan.data) {
      console.log("Menggunakan data iklan cache sebagai fallback");
      appState.adsData = appState.cache.iklan.data;
    }
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
        <td class="highlight">${item.harga_jual ? formatCurrency(item.harga_jual) : "-"}</td>
        <td class="highlight">${item.buyback ? formatCurrency(item.buyback) : "-"}</td>
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
  appState.isVideoMuted = true;
});

// Handle visibility change
document.addEventListener("visibilitychange", function () {
  if (document.hidden) {
    if (appState.rotationInterval) clearInterval(appState.rotationInterval);
  } else {
    startRotationInterval();
  }
});

// Fungsi untuk handle responsive layout
function handleResponsiveLayout() {
  const isMobile = window.innerWidth <= 768;
  const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
  const isTV = window.innerWidth > 1920;
  
  // Sesuaikan font size untuk TV besar
  if (isTV) {
    document.documentElement.style.fontSize = '18px';
  } else {
    document.documentElement.style.fontSize = '';
  }
  
  // Sesuaikan tinggi tabel
  const tables = document.querySelectorAll('.table-wrapper');
  const viewportHeight = window.innerHeight;
  const availableHeight = viewportHeight - 200; // Kurangi header dan footer
  
  tables.forEach(table => {
    if (isMobile) {
      table.style.minHeight = '300px';
    } else if (isTablet) {
      table.style.minHeight = '350px';
    } else {
      table.style.minHeight = '400px';
    }
    
    // Pastikan tidak melebihi viewport
    if (table.offsetHeight > availableHeight) {
      table.style.minHeight = availableHeight + 'px';
    }
  });
  
  // Sesuaikan marquee speed berdasarkan lebar layar
  const marqueeText = document.getElementById('marqueeText');
  if (marqueeText) {
    const textLength = marqueeText.textContent.length;
    const baseDuration = isMobile ? 120 : isTablet ? 90 : 60;
    const duration = Math.max(baseDuration, textLength / 8);
    
    marqueeText.style.animation = 'none';
    setTimeout(() => {
      marqueeText.style.animation = `marquee ${duration}s linear infinite`;
    }, 10);
  }
}

// Event listener untuk resize
window.addEventListener('resize', handleResponsiveLayout);
window.addEventListener('orientationchange', handleResponsiveLayout);

// Fungsi untuk refresh data secara periodik
function startPeriodicRefresh() {
  setInterval(() => {
    console.log("Memperbarui data dari server...");
    loadPriceData();
    loadRunningText();
    loadAdsData();
  }, 5 * 60 * 1000);
}

// Start periodic refresh setelah semua komponen siap
setTimeout(() => {
  startPeriodicRefresh();
}, 10000);

// YouTube API callback global
window.onYouTubeIframeAPIReady = function () {
  console.log("YouTube API siap digunakan");
};

// Initialize responsive layout
handleResponsiveLayout();
