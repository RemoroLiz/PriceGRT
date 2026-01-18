// ===== KONFIGURASI SHEET =====
const SHEET_CONFIG = {
  harga: { gid: "216173443", name: "Harga" },
  runningText: { gid: "1779766141", name: "RunningText" },
  iklan: { gid: "1303897065", name: "Iklan" },
};

const SHEET_BASE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZ4Jrb5j2IVmK72GbEhHoyIzck-H-khwypavvFpGD8yxetAErp-YpE6Krtu8OtuOTMYzUozy-CrAy5/pub";

// ===== STATE APLIKASI =====
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
  isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),

  cache: {
    harga: { data: null, lastFetch: 0, expiration: 5 * 60 * 1000 },
    runningText: { data: null, lastFetch: 0, expiration: 10 * 60 * 1000 },
    iklan: { data: null, lastFetch: 0, expiration: 5 * 60 * 1000 },
  },
};

// ===== HELPER FUNCTIONS =====
function formatCurrency(amount) {
  if (!amount || amount === 0) return "-";

  // Untuk mobile, gunakan format yang lebih ringkas
  if (appState.isMobile && amount >= 1000000) {
    const formatted = (amount / 1000000).toFixed(1);
    return `Rp${formatted.replace(".", ",")}Jt`;
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function isCacheValid(cacheType) {
  const cache = appState.cache[cacheType];
  if (!cache || !cache.data) return false;
  return Date.now() - cache.lastFetch < cache.expiration;
}

function updateCache(cacheType, data) {
  appState.cache[cacheType] = {
    data: data,
    lastFetch: Date.now(),
    expiration: appState.cache[cacheType].expiration,
  };
}

// ===== INITIALIZATION =====
document.addEventListener("DOMContentLoaded", function () {
  console.log("📱 Memuat aplikasi harga emas...");

  // Deteksi device type
  detectDeviceType();

  setupUserInteractionListeners();

  // Setup navigation - tampilkan hanya jika bukan mobile
  if (!appState.isMobile) {
    document.querySelector(".left-nav").addEventListener("click", () => {
      handleUserInteraction();
      navigateTables("left");
    });

    document.querySelector(".right-nav").addEventListener("click", () => {
      handleUserInteraction();
      navigateTables("right");
    });
  }

  loadPriceData();
  loadRunningText();
  loadAdsData();

  // Sesuaikan interval untuk mobile
  if (appState.isMobile) {
    startRotationInterval(30000); // 30 detik untuk mobile
  } else {
    startRotationInterval(25000); // 25 detik untuk desktop
  }

  loadYouTubeAPI();

  // Adjust layout untuk mobile
  adjustMobileLayout();
  window.addEventListener("resize", adjustMobileLayout);
  window.addEventListener("orientationchange", adjustMobileLayout);
});

function detectDeviceType() {
  const width = window.innerWidth;
  if (width <= 480) {
    appState.deviceType = "mobile";
  } else if (width <= 768) {
    appState.deviceType = "tablet";
  } else {
    appState.deviceType = "desktop";
  }
  console.log(`📱 Device type: ${appState.deviceType}`);
}

function adjustMobileLayout() {
  detectDeviceType();

  // Toggle navigation buttons berdasarkan device
  const navButtons = document.querySelectorAll(".nav-btn");
  if (appState.deviceType === "mobile" || appState.deviceType === "tablet") {
    navButtons.forEach((btn) => {
      btn.style.display = "flex";
      btn.style.position = "fixed";
      btn.style.bottom = appState.deviceType === "mobile" ? "70px" : "100px";
      btn.style.top = "auto";
      btn.style.transform = "none";
    });

    document.querySelector(".left-nav").style.left = "15px";
    document.querySelector(".right-nav").style.right = "15px";
  } else {
    navButtons.forEach((btn) => {
      btn.style.display = "flex";
      btn.style.position = "absolute";
      btn.style.top = "50%";
      btn.style.bottom = "auto";
      btn.style.transform = "translateY(-50%)";
    });

    document.querySelector(".left-nav").style.left = "-25px";
    document.querySelector(".right-nav").style.right = "-25px";
  }

  // Adjust card heights
  adjustCardHeights();

  // Adjust table layout untuk mobile
  adjustTableLayout();
}

function adjustTableLayout() {
  const tables = document.querySelectorAll(".price-table");
  const isMobile = appState.deviceType === "mobile";

  tables.forEach((table) => {
    if (isMobile) {
      table.style.fontSize = "0.75rem";
      const ths = table.querySelectorAll("th");
      const tds = table.querySelectorAll("td");

      ths.forEach((th) => (th.style.padding = "8px 4px"));
      tds.forEach((td) => (td.style.padding = "6px 4px"));
    } else {
      table.style.fontSize = "0.85rem";
      const ths = table.querySelectorAll("th");
      const tds = table.querySelectorAll("td");

      ths.forEach((th) => (th.style.padding = "12px 8px"));
      tds.forEach((td) => (td.style.padding = "10px 8px"));
    }
  });
}

function setupUserInteractionListeners() {
  ["click", "touchstart", "keydown", "mousemove"].forEach((eventType) => {
    document.addEventListener(eventType, handleUserInteraction, {
      once: false,
      passive: true,
    });
  });
}

function handleUserInteraction() {
  if (!appState.userInteracted) {
    console.log("👆 Interaksi pengguna terdeteksi");
    appState.userInteracted = true;
    document.body.classList.add("user-interacted");

    if (
      appState.youtubePlayer &&
      document.getElementById("videoContainer").classList.contains("active")
    ) {
      setTimeout(() => playVideoWithSound(), 500);
    }
  }
}

function loadYouTubeAPI() {
  if (!appState.isYouTubeAPILoaded) {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    const firstScriptTag = document.getElementsByTagName("script")[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    appState.isYouTubeAPILoaded = true;
  }
}

// ===== LAYOUT FUNCTIONS =====
function adjustCardHeights() {
  const cards = document.querySelectorAll(".card-table");
  if (cards.length < 2) return;

  cards.forEach((card) => (card.style.height = "auto"));

  let maxHeight = 0;
  cards.forEach((card) => {
    const height = card.offsetHeight;
    if (height > maxHeight) maxHeight = height;
  });

  // Untuk mobile, batasi tinggi maksimum
  const maxAllowedHeight = appState.deviceType === "mobile" ? 350 : 400;
  maxHeight = Math.min(maxHeight, maxAllowedHeight);

  cards.forEach((card) => (card.style.height = maxHeight + "px"));

  const tables = document.querySelectorAll(".table-responsive");
  tables.forEach((table) => {
    table.style.maxHeight = maxHeight - 70 + "px"; // Account for title and padding
  });
}

// ===== TABLE ROTATION =====
function startRotationInterval(duration = 25000) {
  if (appState.rotationInterval) clearInterval(appState.rotationInterval);
  appState.rotationInterval = setInterval(
    () => navigateTables("right"),
    duration
  );
}

function navigateTables(direction) {
  const types = ["emas", "antam", "archi"];
  const currentIndex = types.indexOf(appState.currentTableType);
  let nextIndex;

  if (direction === "right") nextIndex = (currentIndex + 1) % types.length;
  else nextIndex = (currentIndex - 1 + types.length) % types.length;

  appState.currentTableType = types[nextIndex];
  displayTables(appState.currentTableType);

  if (
    appState.currentTableType === "archi" &&
    hasActiveAds() &&
    !appState.videoPlayed
  ) {
    showVideoAfterDelay();
  }
}

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

function isValidYouTubeUrl(url) {
  if (!url) return false;
  const cleanUrl = url.trim();
  if (!cleanUrl) return false;
  const youtubePattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+/;
  return youtubePattern.test(cleanUrl);
}

function showVideoAfterDelay() {
  setTimeout(() => showVideo(), 3000);
}

// ===== VIDEO FUNCTIONS (OPTIMIZED FOR MOBILE) =====
function showVideo() {
  const activeAds = appState.adsData.filter(
    (ad) =>
      ad.status &&
      ad.status.toLowerCase() === "active" &&
      ad.video_url &&
      isValidYouTubeUrl(ad.video_url)
  );

  if (activeAds.length === 0) {
    console.log("📺 Tidak ada iklan aktif");
    appState.videoPlayed = true;
    return;
  }

  if (appState.currentVideoIndex >= activeAds.length)
    appState.currentVideoIndex = 0;

  const selectedAd = activeAds[appState.currentVideoIndex];
  const videoContainer = document.getElementById("videoContainer");
  const videoWrapper = document.querySelector(".video-wrapper");

  console.log(
    `📽️ Menampilkan video ${appState.currentVideoIndex + 1} dari ${
      activeAds.length
    }`
  );

  // Hide tables
  document.getElementById("tableEmas").style.display = "none";
  document.getElementById("tableAntam").style.display = "none";

  // Clear and setup video container
  videoWrapper.innerHTML = "";

  const videoContainerDiv = document.createElement("div");
  videoContainerDiv.id = "player";
  videoContainerDiv.style.cssText = `width: 100%; height: 100%; border-radius: 8px; overflow: hidden; position: absolute; top: 0; left: 0;`;

  videoWrapper.appendChild(videoContainerDiv);
  videoContainer.classList.add("active");
  appState.videoPlayed = true;

  // Setup YouTube player
  setTimeout(() => setupYouTubePlayer(selectedAd.video_url), 500);
}

function extractVideoId(url) {
  const regExp =
    /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[7].length === 11 ? match[7] : null;
}

function setupYouTubePlayer(videoUrl) {
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    console.error("❌ Tidak dapat mengekstrak Video ID:", videoUrl);
    showVideoFallback();
    return;
  }

  appState.autoplayAttempted = false;
  appState.isVideoMuted = true;

  // Player vars khusus untuk mobile
  const playerVars = {
    autoplay: 1,
    mute: 1,
    enablejsapi: 1,
    rel: 0,
    playsinline: 1,
    controls: 1,
    modestbranding: 1,
    showinfo: 0,
    iv_load_policy: 3,
  };

  // Tambahkan parameter khusus untuk iOS
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
    playerVars.playsinline = 1;
    playerVars.fs = 0; // Nonaktifkan fullscreen button
  }

  appState.youtubePlayer = new YT.Player("player", {
    width: "100%",
    height: "100%",
    videoId: videoId,
    playerVars: playerVars,
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError,
    },
  });
}

function onPlayerReady(event) {
  console.log("✅ YouTube Player siap");
  attemptSmartAutoplay(event.target);
}

function attemptSmartAutoplay(player) {
  if (appState.autoplayAttempted) return;
  appState.autoplayAttempted = true;

  console.log("🔊 Status interaksi user:", appState.userInteracted);

  if (appState.userInteracted) {
    try {
      player.unMute();
      player.playVideo();
      appState.isVideoMuted = false;
      console.log("🎬 Video diputar dengan suara");
      return;
    } catch (error) {
      console.log("⚠️ Gagal play dengan suara:", error);
    }
  }

  try {
    player.mute();
    player.playVideo();
    appState.isVideoMuted = true;
    console.log("🔇 Muted autoplay berhasil");
    showUnmuteButton(player);
  } catch (error) {
    console.log("❌ Muted autoplay diblokir:", error);
    showInteractivePlayButton(player);
  }
}

function playVideoWithSound() {
  if (appState.youtubePlayer && appState.youtubePlayer.playVideo) {
    try {
      if (appState.isVideoMuted) {
        appState.youtubePlayer.unMute();
        appState.isVideoMuted = false;
        console.log("🔊 Video di-unmute");
      }

      if (appState.youtubePlayer.getPlayerState() !== YT.PlayerState.PLAYING) {
        appState.youtubePlayer.playVideo();
        console.log("▶️ Video diputar");
      }

      const unmuteBtn = document.querySelector(".unmute-btn");
      if (unmuteBtn) unmuteBtn.style.display = "none";
    } catch (error) {
      console.log("⚠️ Gagal memutar video dengan suara:", error);
    }
  }
}

function onPlayerStateChange(event) {
  console.log("📊 Status Player:", event.data);

  if (event.data === YT.PlayerState.ENDED) {
    console.log("🎬 Video selesai");
    playNextVideo();
  }

  if (
    event.data === YT.PlayerState.PLAYING &&
    appState.userInteracted &&
    appState.isVideoMuted
  ) {
    setTimeout(() => {
      try {
        event.target.unMute();
        appState.isVideoMuted = false;
        console.log("🔊 Video di-unmute otomatis");

        const unmuteBtn = document.querySelector(".unmute-btn");
        if (unmuteBtn) unmuteBtn.style.display = "none";
      } catch (error) {
        console.log("⚠️ Tidak bisa unmute:", error);
      }
    }, 1000);
  }
}

function onPlayerError(event) {
  console.error("❌ Error YouTube Player:", event.data);
  showVideoFallback();
}

function showUnmuteButton(player) {
  const videoWrapper = document.querySelector(".video-wrapper");
  const existingBtn = videoWrapper.querySelector(".unmute-btn");
  if (existingBtn) existingBtn.remove();

  const unmuteBtn = document.createElement("button");
  unmuteBtn.className = "unmute-btn";
  unmuteBtn.innerHTML = `<i class="fas fa-volume-mute"></i><span>Nyalakan Suara</span>`;
  unmuteBtn.onclick = function () {
    handleUserInteraction();
    playVideoWithSound();
  };

  videoWrapper.appendChild(unmuteBtn);
}

function showInteractivePlayButton(player) {
  const videoWrapper = document.querySelector(".video-wrapper");
  const existingBtn = videoWrapper.querySelector(".play-btn");
  if (existingBtn) existingBtn.remove();

  const playBtn = document.createElement("button");
  playBtn.className = "play-btn";
  playBtn.innerHTML = `<i class="fas fa-play"></i><span>Putar Video</span>`;
  playBtn.onclick = function () {
    handleUserInteraction();
    playVideoWithSound();
  };

  videoWrapper.appendChild(playBtn);
}

function showVideoFallback() {
  console.log("🔄 Menampilkan fallback");
  const videoWrapper = document.querySelector(".video-wrapper");

  videoWrapper.innerHTML = `
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,0.8); color: white; padding: 20px; text-align: center; border-radius: 8px;">
            <i class="fas fa-video-slash" style="font-size: 48px; margin-bottom: 15px; color: var(--primary);"></i>
            <h3 style="margin-bottom: 10px; font-size: 1.2rem;">Video Tidak Dapat Diputar</h3>
            <p style="margin-bottom: 20px; opacity: 0.8; font-size: 0.9rem;">Video iklan sedang tidak tersedia</p>
            <button onclick="hideVideo()" style="padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 0.9rem; transition: all 0.3s ease;">
                Lanjutkan Ke Harga Emas
            </button>
        </div>
    `;
}

function playNextVideo() {
  console.log("⏭️ Memainkan video berikutnya");

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

function hideVideo() {
  const videoContainer = document.getElementById("videoContainer");
  const videoWrapper = document.querySelector(".video-wrapper");

  console.log("⏹️ Menyembunyikan video");

  if (appState.youtubePlayer) {
    try {
      appState.youtubePlayer.stopVideo();
      appState.youtubePlayer.destroy();
    } catch (error) {
      console.log("⚠️ Tidak dapat menghentikan video:", error);
    }
    appState.youtubePlayer = null;
  }

  appState.videoPlayed = false;
  appState.autoplayAttempted = false;
  appState.isVideoMuted = true;

  videoWrapper.innerHTML = "";
  videoContainer.classList.remove("active");

  document.getElementById("tableEmas").style.display = "flex";
  document.getElementById("tableAntam").style.display = "flex";

  // Re-adjust layout
  setTimeout(adjustCardHeights, 100);
}

// ===== DATA LOADING FUNCTIONS =====
async function loadPriceData() {
  try {
    console.log("📊 Memuat data harga...");

    if (isCacheValid("harga")) {
      console.log("💾 Menggunakan data harga dari cache");
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
      setTimeout(() => {
        adjustCardHeights();
        adjustTableLayout();
      }, 100);
      return;
    }

    const url = `${SHEET_BASE_URL}?gid=${SHEET_CONFIG.harga.gid}&single=true&output=csv`;
    const response = await fetch(url);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const csvText = await response.text();
    const data = parseCSVToJSON(csvText);

    updateCache("harga", data);

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
      `✅ Data loaded: Emas(${appState.tableData.emas.length}), Antam(${appState.tableData.antam.length}), Archi(${appState.tableData.archi.length})`
    );
    displayTables("emas");
    setTimeout(() => {
      adjustCardHeights();
      adjustTableLayout();
    }, 100);
  } catch (error) {
    console.error("❌ Error loading CSV data:", error);

    if (appState.cache.harga.data) {
      console.log("🔄 Menggunakan data cache sebagai fallback");
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
      setTimeout(() => {
        adjustCardHeights();
        adjustTableLayout();
      }, 100);
    } else {
      showError();
    }
  }
}

async function loadRunningText() {
  try {
    console.log("📜 Memuat running text...");

    if (isCacheValid("runningText")) {
      console.log("💾 Menggunakan running text dari cache");
      const cachedData = appState.cache.runningText.data;
      processRunningTextData(cachedData);
      return;
    }

    const url = `${SHEET_BASE_URL}?gid=${SHEET_CONFIG.runningText.gid}&single=true&output=csv`;
    const response = await fetch(url);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const csvText = await response.text();
    const data = parseRunningTextCSV(csvText);

    updateCache("runningText", data);
    processRunningTextData(data);
  } catch (error) {
    console.error("❌ Error loading running text:", error);

    if (appState.cache.runningText.data) {
      console.log("🔄 Menggunakan running text cache");
      processRunningTextData(appState.cache.runningText.data);
    } else {
      document.getElementById("marqueeText").textContent =
        "Harga emas terkini - Informasi terupdate setiap hari";
    }
  }
}

async function loadAdsData() {
  try {
    console.log("🎬 Memuat data iklan...");

    if (isCacheValid("iklan")) {
      console.log("💾 Menggunakan data iklan dari cache");
      appState.adsData = appState.cache.iklan.data;
      console.log(`✅ ${appState.adsData.length} iklan loaded from cache`);
      return;
    }

    const url = `${SHEET_BASE_URL}?gid=${SHEET_CONFIG.iklan.gid}&single=true&output=csv`;
    const response = await fetch(url);

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const csvText = await response.text();
    const data = parseAdsCSV(csvText);

    updateCache("iklan", data);
    appState.adsData = data;
    console.log(`✅ ${appState.adsData.length} iklan loaded from API`);
  } catch (error) {
    console.error("❌ Error loading ads data:", error);

    if (appState.cache.iklan.data) {
      console.log("🔄 Menggunakan data iklan cache");
      appState.adsData = appState.cache.iklan.data;
    }
  }
}

// ===== DATA PARSERS =====
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
        if (index < values.length) obj[header] = values[index];
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

function parseRunningTextCSV(csvText) {
  const lines = csvText.trim().split("\n");
  if (lines.length < 1) return [];
  if (lines.length === 1) return [{ teks: lines[0].trim() }];

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
      if (values.length === 1) return { teks: values[0] };

      const textIndex = headers.indexOf(textColumn);
      const teks =
        textIndex >= 0 && textIndex < values.length
          ? values[textIndex]
          : values.join(" ");
      return { teks };
    })
    .filter((item) => item.teks && item.teks.trim() !== "");
}

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

  // Untuk mobile, batasi panjang text
  const maxLength = appState.deviceType === "mobile" ? 100 : 200;
  const truncatedTexts = runningTexts.map((text) => {
    if (text.length > maxLength) return text.substring(0, maxLength) + "...";
    return text;
  });

  const marqueeContent = truncatedTexts.join(" | ");
  const marqueeElement = document.getElementById("marqueeText");
  marqueeElement.textContent = marqueeContent;

  // Adjust speed berdasarkan device
  const baseDuration = appState.deviceType === "mobile" ? 90 : 60;
  const duration = Math.max(baseDuration, marqueeContent.length / 8);

  marqueeElement.style.animation = "none";
  setTimeout(
    () =>
      (marqueeElement.style.animation = `marquee ${duration}s linear infinite`),
    10
  );
}

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

// ===== TABLE DISPLAY FUNCTIONS =====
function displayTables(type) {
  const data = appState.tableData[type];
  if (!data || data.length === 0) {
    showError();
    return;
  }

  updateTableTitles(type);

  // Untuk mobile, tampilkan semua data dalam satu tabel
  if (appState.deviceType === "mobile") {
    updateTable("priceTableLeft", data, type);
    document.getElementById("tableAntam").style.display = "none";
  } else {
    const half = Math.ceil(data.length / 2);
    const leftData = data.slice(0, half);
    const rightData = data.slice(half);

    updateTable("priceTableLeft", leftData, type);
    updateTable("priceTableRight", rightData, type);
    document.getElementById("tableAntam").style.display = "flex";
  }

  setTimeout(() => {
    adjustCardHeights();
    adjustTableLayout();
  }, 50);
}

function updateTableTitles(type) {
  const tableTitles = document.querySelectorAll(".card-title");

  if (type === "emas") {
    tableTitles[0].textContent = "Harga Emas";
    if (tableTitles[1]) tableTitles[1].textContent = "Harga Emas";
  } else if (type === "antam") {
    tableTitles[0].textContent = "Harga Antam";
    if (tableTitles[1]) tableTitles[1].textContent = "Harga Antam";
  } else if (type === "archi") {
    tableTitles[0].textContent = "Harga Archi";
    if (tableTitles[1]) tableTitles[1].textContent = "Harga Archi";
  }
}

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
                    <th>Harga Jual</th>
                    <th>Harga Beli</th>
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

function showError() {
  const errorHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Gagal memuat data. Silakan coba lagi.</p>
            <button onclick="loadPriceData()" style="margin-top: 15px; padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer; font-family: 'Poppins', sans-serif; font-size: 0.9rem;">
                Muat Ulang Data
            </button>
        </div>
    `;

  document.getElementById("priceTableLeft").innerHTML = errorHTML;
  document.getElementById("priceTableRight").innerHTML = errorHTML;
}

// ===== PERIODIC REFRESH =====
function startPeriodicRefresh() {
  setInterval(() => {
    console.log("🔄 Memperbarui data dari server...");
    loadPriceData();
    loadRunningText();
    loadAdsData();
  }, 5 * 60 * 1000);
}

// Start refresh after everything is loaded
setTimeout(() => {
  startPeriodicRefresh();
}, 10000);

// ===== GLOBAL CALLBACKS =====
window.onYouTubeIframeAPIReady = function () {
  console.log("✅ YouTube API Ready");
};

// ===== PAGE VISIBILITY HANDLING =====
document.addEventListener("visibilitychange", function () {
  if (document.hidden) {
    console.log("⏸️ Halaman tidak aktif");
    if (appState.rotationInterval) clearInterval(appState.rotationInterval);
  } else {
    console.log("▶️ Halaman aktif");
    if (appState.isMobile) {
      startRotationInterval(30000);
    } else {
      startRotationInterval(25000);
    }
  }
});

// ===== CLEANUP ON UNLOAD =====
window.addEventListener("beforeunload", function () {
  appState.currentVideoIndex = 0;
  appState.videoPlayed = false;
  appState.userInteracted = false;
  appState.autoplayAttempted = false;
  appState.isVideoMuted = true;

  if (appState.youtubePlayer) {
    try {
      appState.youtubePlayer.stopVideo();
    } catch (error) {}
  }
});

// ===== TOUCH EVENT FOR MOBILE =====
document.addEventListener(
  "touchstart",
  function () {
    // Prevent zoom on double tap
    if (appState.deviceType === "mobile") {
      document.documentElement.style.touchAction = "pan-y";
    }
  },
  { passive: true }
);

// ===== INITIAL ADJUSTMENT =====
setTimeout(() => {
  adjustCardHeights();
  adjustTableLayout();
}, 1000);
