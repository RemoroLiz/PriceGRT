// ============================================
// CONFIGURATION & CONSTANTS
// ============================================
const APP_CONFIG = {
    sheets: {
        harga: { gid: "216173443", name: "Harga" },
        runningText: { gid: "1779766141", name: "RunningText" },
        iklan: { gid: "1303897065", name: "Iklan" }
    },
    api: {
        baseUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZ4Jrb5j2IVmK72GbEhHoyIzck-H-khwypavvFpGD8yxetAErp-YpE6Krtu8OtuOTMYzUozy-CrAy5/pub"
    },
    cache: {
        harga: { duration: 5 * 60 * 1000 }, // 5 minutes
        runningText: { duration: 10 * 60 * 1000 }, // 10 minutes
        iklan: { duration: 5 * 60 * 1000 } // 5 minutes
    },
    video: {
        delayBeforeShow: 3000, // 3 seconds
        autoplayTimeout: 1000 // 1 second
    }
};

// ============================================
// APPLICATION STATE MANAGEMENT
// ============================================
class AppState {
    constructor() {
        this.tableData = {
            "emas-muda": [],
            "emas-tua": [],
            "antam": [],
            "archi": []
        };
        this.currentTableType = "emas-muda";
        this.adsData = [];
        this.currentVideoIndex = 0;
        this.videoPlayed = false;
        this.isYouTubeAPILoaded = false;
        this.youtubePlayer = null;
        this.userInteracted = false;
        this.autoplayAttempted = false;
        this.isVideoMuted = true;
        this.cache = {
            harga: { data: null, timestamp: 0 },
            runningText: { data: null, timestamp: 0 },
            iklan: { data: null, timestamp: 0 }
        };
    }

    // Cache Management
    isCacheValid(type) {
        const cache = this.cache[type];
        if (!cache || !cache.data) return false;
        
        const now = Date.now();
        const duration = APP_CONFIG.cache[type].duration;
        return (now - cache.timestamp) < duration;
    }

    updateCache(type, data) {
        this.cache[type] = {
            data: data,
            timestamp: Date.now()
        };
    }

    getCache(type) {
        return this.cache[type]?.data || null;
    }

    // Video Management
    hasActiveAds() {
        return this.adsData.some(ad => 
            ad.status?.toLowerCase() === "active" && 
            ad.video_url && 
            this.isValidYouTubeUrl(ad.video_url)
        );
    }

    getActiveAds() {
        return this.adsData.filter(ad => 
            ad.status?.toLowerCase() === "active" && 
            ad.video_url && 
            this.isValidYouTubeUrl(ad.video_url)
        );
    }

    isValidYouTubeUrl(url) {
        if (!url || typeof url !== 'string') return false;
        const cleanUrl = url.trim();
        if (!cleanUrl) return false;
        const youtubePattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+/;
        return youtubePattern.test(cleanUrl);
    }

    // User Interaction
    setUserInteracted() {
        if (!this.userInteracted) {
            this.userInteracted = true;
            document.body.classList.add('user-interacted');
            console.log('User interaction detected - enabling video autoplay');
        }
    }
}

// Initialize global app state
const app = new AppState();

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatCurrency(amount) {
    if (!amount && amount !== 0) return '-';
    
    const num = typeof amount === 'string' ? parseInt(amount.replace(/[^0-9]/g, '')) : amount;
    if (isNaN(num)) return '-';
    
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num).replace('Rp', 'Rp ');
}

function extractYouTubeId(url) {
    if (!url) return null;
    
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) return match[1];
    }
    
    return null;
}

function escapeHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function fetchWithTimeout(url, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// ============================================
// TABLE MANAGEMENT FUNCTIONS
// ============================================

function setupTableTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const type = button.getAttribute('data-type');
            
            // Update active tab
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update active table
            document.querySelectorAll('.price-table-card').forEach(card => {
                card.classList.remove('active');
            });
            document.getElementById(`table${type.charAt(0).toUpperCase() + type.slice(1).replace('-', '')}`)?.classList.add('active');
            
            app.currentTableType = type;
            
            // Adjust table for responsive
            setTimeout(() => {
                adjustTableResponsive();
            }, 100);
        });
    });
}

function adjustTableResponsive() {
    const table = document.querySelector('.price-table-card.active .price-table');
    if (!table) return;
    
    const containerWidth = document.querySelector('.tables-container').offsetWidth;
    const isMobile = window.innerWidth <= 480;
    const isTablet = window.innerWidth <= 768;
    
    // Reset table class
    table.classList.remove('compact');
    
    // Calculate if we need compact mode
    const tableWidth = table.offsetWidth;
    const containerPadding = 32; // Approximate padding
    
    if (isMobile) {
        table.classList.add('compact');
    } else if (isTablet && tableWidth > (containerWidth - containerPadding)) {
        table.classList.add('compact');
    }
    
    // Adjust font size based on container
    const cells = table.querySelectorAll('td, th');
    cells.forEach(cell => {
        if (cell.scrollWidth > cell.offsetWidth) {
            // Text is overflowing, reduce font size slightly
            const currentSize = parseFloat(window.getComputedStyle(cell).fontSize);
            cell.style.fontSize = `${Math.max(currentSize - 1, 10)}px`;
        } else {
            cell.style.fontSize = '';
        }
    });
}

// ============================================
// VIDEO FUNCTIONS
// ============================================

function playNextVideo() {
    console.log('⏭️ Playing next video...');
    app.currentVideoIndex++;
    const activeAds = app.getActiveAds();
    
    if (app.currentVideoIndex < activeAds.length) {
        showVideo();
    } else {
        app.currentVideoIndex = 0;
        hideVideo();
    }
}

function hideVideo() {
    const videoContainer = document.getElementById('videoContainer');
    const videoWrapper = document.querySelector('.video-player-wrapper');
    
    console.log('👋 Hiding video');
    
    if (app.youtubePlayer) {
        try {
            app.youtubePlayer.stopVideo();
            app.youtubePlayer.destroy();
        } catch (error) {
            console.log('Error destroying player:', error);
        }
        app.youtubePlayer = null;
    }
    
    app.videoPlayed = false;
    app.autoplayAttempted = false;
    app.isVideoMuted = true;
    
    videoWrapper.innerHTML = `
        <div class="video-responsive-wrapper"></div>
        <div class="video-placeholder" id="videoPlaceholder">
            <div class="placeholder-content">
                <i class="fas fa-play-circle"></i>
                <p>Video Iklan Akan Ditampilkan di Sini</p>
            </div>
        </div>
    `;
    
    videoContainer.classList.remove('active');
    
    // Show tables again
    document.querySelectorAll('.price-table-card').forEach(card => {
        card.style.display = 'flex';
    });
}

function toggleVideoMute() {
    if (!app.youtubePlayer) return;
    
    try {
        if (app.isVideoMuted) {
            app.youtubePlayer.unMute();
            app.isVideoMuted = false;
            document.getElementById('muteBtn').innerHTML = '<i class="fas fa-volume-up"></i>';
            console.log('🔊 Video unmuted');
        } else {
            app.youtubePlayer.mute();
            app.isVideoMuted = true;
            document.getElementById('muteBtn').innerHTML = '<i class="fas fa-volume-mute"></i>';
            console.log('🔇 Video muted');
        }
    } catch (error) {
        console.error('❌ Failed to toggle mute:', error);
    }
}

// ============================================
// PARSER FUNCTIONS
// ============================================

function parseCSVToJSON(csvText) {
    try {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) return [];
        
        const headers = lines[0]
            .split(',')
            .map(h => h.toLowerCase().replace(/\s+/g, '_').trim());
        
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            const obj = {};
            
            headers.forEach((header, index) => {
                let value = values[index] || '';
                
                // Convert numeric fields
                if (['harga_jual', 'buyback', 'harga'].includes(header)) {
                    value = parseInt(value.replace(/[^0-9]/g, '')) || 0;
                }
                
                obj[header] = value;
            });
            
            return obj;
        });
    } catch (error) {
        console.error('CSV parsing error:', error);
        return [];
    }
}

function parseRunningTextCSV(csvText) {
    try {
        const lines = csvText.trim().split('\n');
        if (lines.length === 0) return [];
        
        if (lines.length === 1) {
            return [{ teks: lines[0].trim() }];
        }
        
        const headers = lines[0]
            .split(',')
            .map(h => h.toLowerCase().replace(/\s+/g, '_').trim());
        
        const textColumn = headers.find(h => 
            h.includes('teks') || h.includes('text') || h.includes('isi')
        ) || headers[0];
        
        return lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim());
            
            if (values.length === 1) {
                return { teks: values[0] };
            }
            
            const textIndex = headers.indexOf(textColumn);
            const teks = textIndex >= 0 && textIndex < values.length 
                ? values[textIndex] 
                : values.join(' ');
            
            return { teks: teks.trim() };
        }).filter(item => item.teks && item.teks.length > 0);
    } catch (error) {
        console.error('Running text CSV error:', error);
        return [];
    }
}

function parseAdsCSV(csvText) {
    try {
        const lines = csvText.trim().split('\n');
        if (lines.length === 0) return [];
        
        if (lines.length === 1) {
            const values = lines[0].split(',').map(v => v.trim());
            if (values.length >= 7) {
                return [{
                    judul: values[0],
                    deskripsi: values[1],
                    video_url: values[2],
                    gambar_url: values[3],
                    link1: values[4],
                    link2: values[5],
                    status: values[6]
                }];
            }
            return [];
        }
        
        const headers = lines[0]
            .split(',')
            .map(h => h.toLowerCase().replace(/\s+/g, '_').trim());
        
        return lines.slice(1)
            .map(line => {
                const values = line.split(',').map(v => v.trim());
                const obj = {};
                
                headers.forEach((header, index) => {
                    if (index < values.length) {
                        obj[header] = values[index];
                    }
                });
                
                return obj;
            })
            .filter(ad => 
                ad.video_url &&
                ad.video_url.trim() !== '' &&
                ad.status &&
                ad.status.toLowerCase() === 'active'
            );
    } catch (error) {
        console.error('Ads CSV error:', error);
        return [];
    }
}

// ============================================
// DOM ELEMENTS & INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", function() {
    console.log('💰 Pantes CitiMall - Harga Emas Real-time');
    console.log('🚀 Initializing application...');
    
    // Initialize all components
    initializeApplication();
});

function initializeApplication() {
    try {
        // Setup UI event listeners
        setupEventListeners();
        
        // Setup table tabs
        setupTableTabs();
        
        // Load initial data
        loadAllData();
        
        // Load YouTube API
        loadYouTubeAPI();
        
        // Setup responsive layout
        handleResponsiveLayout();
        
        // Setup periodic refresh
        setTimeout(startPeriodicRefresh, 10000);
        
        console.log('✅ Application initialized successfully');
    } catch (error) {
        console.error('❌ Application initialization failed:', error);
        showErrorMessage('Gagal menginisialisasi aplikasi. Silakan refresh halaman.');
    }
}

function setupEventListeners() {
    // User interaction detection
    const interactionEvents = ['click', 'touchstart', 'keydown', 'scroll'];
    interactionEvents.forEach(event => {
        document.addEventListener(event, handleUserInteraction, { 
            passive: true, 
            once: false 
        });
    });

    // Responsive layout
    window.addEventListener('resize', debounce(() => {
        handleResponsiveLayout();
        adjustTableResponsive();
    }, 250));
    window.addEventListener('orientationchange', handleResponsiveLayout);

    // Video controls
    document.addEventListener('click', function(event) {
        const target = event.target;
        
        if (target.closest('#muteBtn')) {
            toggleVideoMute();
            return;
        }
        
        if (target.closest('#skipBtn')) {
            playNextVideo();
            return;
        }
        
        if (target.closest('#closeVideoBtn')) {
            hideVideo();
            return;
        }
        
        if (target.closest('#menuToggle')) {
            toggleMobileMenu();
            return;
        }
    });
}

// ============================================
// DATA LOADING & MANAGEMENT
// ============================================

async function loadAllData() {
    try {
        console.log('📥 Loading all data...');
        
        // Load data in parallel
        await Promise.all([
            loadPriceData(),
            loadRunningText(),
            loadAdsData()
        ]);
        
        console.log('✅ All data loaded successfully');
    } catch (error) {
        console.error('❌ Failed to load data:', error);
    }
}

async function loadPriceData() {
    try {
        console.log('📊 Loading price data...');
        
        // Check cache first
        if (app.isCacheValid('harga')) {
            console.log('📦 Using cached price data');
            const cachedData = app.getCache('harga');
            processPriceData(cachedData);
            return;
        }
        
        // Fetch from API
        const url = `${APP_CONFIG.api.baseUrl}?gid=${APP_CONFIG.sheets.harga.gid}&single=true&output=csv`;
        const response = await fetchWithTimeout(url, 10000);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const csvText = await response.text();
        const data = parseCSVToJSON(csvText);
        
        // Update cache
        app.updateCache('harga', data);
        
        // Process data
        processPriceData(data);
        
        console.log(`✅ Price data loaded: ${data.length} entries`);
    } catch (error) {
        console.error('❌ Failed to load price data:', error);
        
        // Try to use expired cache as fallback
        const cachedData = app.getCache('harga');
        if (cachedData) {
            console.log('⚠️ Using expired cache as fallback');
            processPriceData(cachedData);
        } else {
            showErrorState('priceTableEmasMuda', 'Gagal memuat data harga');
        }
    }
}

function processPriceData(data) {
    if (!Array.isArray(data) || data.length === 0) {
        showNoDataState();
        return;
    }
    
    // Reset all table data
    app.tableData = {
        "emas-muda": [],
        "emas-tua": [],
        "antam": [],
        "archi": []
    };
    
    // Filter data by type - assuming tipe column exists
    data.forEach(row => {
        const tipe = (row.tipe || '').toLowerCase().trim();
        
        if (tipe.includes('muda') || tipe.includes('70') || tipe.includes('75') || tipe.includes('80') || tipe.includes('85')) {
            app.tableData["emas-muda"].push(row);
        } else if (tipe.includes('tua') || tipe.includes('86') || tipe.includes('90') || tipe.includes('95') || tipe.includes('99')) {
            app.tableData["emas-tua"].push(row);
        } else if (tipe.includes('antam')) {
            app.tableData["antam"].push(row);
        } else if (tipe.includes('archi')) {
            app.tableData["archi"].push(row);
        }
    });
    
    console.log(`📊 Processed: Emas Muda(${app.tableData["emas-muda"].length}), Emas Tua(${app.tableData["emas-tua"].length}), Antam(${app.tableData["antam"].length}), Archie(${app.tableData["archi"].length})`);
    
    // Display all tables
    displayAllTables();
    
    // Adjust responsive layout
    setTimeout(() => {
        adjustTableResponsive();
    }, 100);
}

function displayAllTables() {
    // Update all tables
    Object.keys(app.tableData).forEach(type => {
        const elementId = `priceTable${type.charAt(0).toUpperCase() + type.slice(1).replace('-', '')}`;
        const data = app.tableData[type];
        updateTable(elementId, data, type);
    });
}

function updateTable(elementId, data, type) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    if (!data || data.length === 0) {
        element.innerHTML = createNoDataHTML();
        return;
    }
    
    element.innerHTML = createTableHTML(data, type);
    
    // Adjust table after rendering
    setTimeout(() => {
        adjustTableResponsive();
    }, 50);
}

function createTableHTML(data, type) {
    // Sort data by kode if available
    const sortedData = [...data].sort((a, b) => {
        const kodeA = (a.kode || '').toLowerCase();
        const kodeB = (b.kode || '').toLowerCase();
        return kodeA.localeCompare(kodeB);
    });
    
    return `
        <table class="price-table">
            <thead>
                <tr>
                    <th>Kode</th>
                    <th>Harga Jual</th>
                    <th>Buyback</th>
                </tr>
            </thead>
            <tbody>
                ${sortedData.map(item => `
                    <tr>
                        <td class="code-cell">${escapeHTML(item.kode || '-')}</td>
                        <td class="highlight">${formatCurrency(item.harga_jual || item.harga)}</td>
                        <td class="highlight">${formatCurrency(item.buyback)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function createNoDataHTML() {
    return `
        <div class="no-data-message">
            <i class="fas fa-database" style="font-size: 48px; margin-bottom: 20px; color: var(--dark-gray);"></i>
            <h3 style="margin-bottom: 10px; color: var(--text-dark);">Data Tidak Tersedia</h3>
            <p style="color: var(--text-light);">Tidak ada data untuk ditampilkan</p>
        </div>
    `;
}

async function loadRunningText() {
    try {
        console.log('📜 Loading running text...');
        
        if (app.isCacheValid('runningText')) {
            console.log('📦 Using cached running text');
            const cachedData = app.getCache('runningText');
            updateRunningText(cachedData);
            return;
        }
        
        const url = `${APP_CONFIG.api.baseUrl}?gid=${APP_CONFIG.sheets.runningText.gid}&single=true&output=csv`;
        const response = await fetchWithTimeout(url, 5000);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const csvText = await response.text();
        const data = parseRunningTextCSV(csvText);
        
        app.updateCache('runningText', data);
        updateRunningText(data);
        
        console.log('✅ Running text loaded');
    } catch (error) {
        console.error('❌ Failed to load running text:', error);
        const cachedData = app.getCache('runningText');
        if (cachedData) {
            updateRunningText(cachedData);
        } else {
            updateRunningText([{ teks: "Harga emas terkini - Informasi terupdate setiap hari" }]);
        }
    }
}

function updateRunningText(data) {
    const marqueeElement = document.getElementById('marqueeText');
    if (!marqueeElement) return;
    
    if (!data || !Array.isArray(data) || data.length === 0) {
        marqueeElement.innerHTML = "Harga emas terkini - Informasi terupdate setiap hari";
        return;
    }
    
    const texts = data
        .map(item => item.teks?.trim())
        .filter(text => text && text.length > 0);
    
    if (texts.length === 0) {
        marqueeElement.innerHTML = "Harga emas terkini - Informasi terupdate setiap hari";
        return;
    }
    
    const combinedText = texts.join(' • ');
    marqueeElement.innerHTML = escapeHTML(combinedText);
    
    // Adjust marquee speed
    const speed = Math.max(2, Math.min(5, Math.floor(150 / combinedText.length)));
    marqueeElement.setAttribute('scrollamount', speed);
}

async function loadAdsData() {
    try {
        console.log('🎬 Loading ads data...');
        
        if (app.isCacheValid('iklan')) {
            console.log('📦 Using cached ads data');
            app.adsData = app.getCache('iklan') || [];
            return;
        }
        
        const url = `${APP_CONFIG.api.baseUrl}?gid=${APP_CONFIG.sheets.iklan.gid}&single=true&output=csv`;
        const response = await fetchWithTimeout(url, 5000);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const csvText = await response.text();
        const data = parseAdsCSV(csvText);
        
        app.updateCache('iklan', data);
        app.adsData = data;
        
        console.log(`✅ Ads data loaded: ${data.length} active ads`);
    } catch (error) {
        console.error('❌ Failed to load ads data:', error);
        const cachedData = app.getCache('iklan');
        if (cachedData) {
            app.adsData = cachedData;
        }
    }
}

// ============================================
// VIDEO PLAYER MANAGEMENT
// ============================================

function showVideo() {
    const activeAds = app.getActiveAds();
    if (activeAds.length === 0) {
        console.log('No active ads available');
        app.videoPlayed = true;
        return;
    }
    
    // Reset index if out of bounds
    if (app.currentVideoIndex >= activeAds.length) {
        app.currentVideoIndex = 0;
    }
    
    const selectedAd = activeAds[app.currentVideoIndex];
    const videoContainer = document.getElementById('videoContainer');
    const videoWrapper = document.querySelector('.video-player-wrapper');
    
    console.log(`🎥 Showing video ${app.currentVideoIndex + 1}/${activeAds.length}`);
    
    // Hide tables
    document.querySelectorAll('.price-table-card').forEach(card => {
        card.style.display = 'none';
    });
    
    // Clear and setup video container
    videoWrapper.innerHTML = '';
    
    const videoResponsiveWrapper = document.createElement('div');
    videoResponsiveWrapper.className = 'video-responsive-wrapper';
    
    const videoDiv = document.createElement('div');
    videoDiv.id = 'player';
    
    videoResponsiveWrapper.appendChild(videoDiv);
    videoWrapper.appendChild(videoResponsiveWrapper);
    
    // Show video container
    videoContainer.classList.add('active');
    app.videoPlayed = true;
    
    // Setup YouTube player after a short delay
    setTimeout(() => {
        setupYouTubePlayer(selectedAd.video_url);
    }, 500);
}

function setupYouTubePlayer(videoUrl) {
    const videoId = extractYouTubeId(videoUrl);
    
    if (!videoId) {
        console.error('Invalid YouTube URL:', videoUrl);
        showVideoError();
        return;
    }
    
    app.autoplayAttempted = false;
    app.isVideoMuted = true;
    
    // Create YouTube player with optimal settings
    app.youtubePlayer = new YT.Player('player', {
        width: '100%',
        height: '100%',
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
            iv_load_policy: 3
        },
        events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
        }
    });
}

function onPlayerReady(event) {
    console.log('✅ YouTube Player ready');
    attemptSmartAutoplay(event.target);
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        console.log('Video ended, playing next...');
        playNextVideo();
    }
    
    if (event.data === YT.PlayerState.PLAYING && app.userInteracted && app.isVideoMuted) {
        setTimeout(() => {
            try {
                event.target.unMute();
                app.isVideoMuted = false;
                console.log('🔊 Video unmuted automatically');
                
                // Update mute button
                const muteBtn = document.getElementById('muteBtn');
                if (muteBtn) {
                    muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
                }
            } catch (error) {
                console.log('Cannot unmute:', error);
            }
        }, 1000);
    }
}

function onPlayerError(event) {
    console.error('❌ YouTube Player error:', event.data);
    showVideoError();
}

function attemptSmartAutoplay(player) {
    if (app.autoplayAttempted) return;
    app.autoplayAttempted = true;
    
    if (app.userInteracted) {
        console.log('👤 User interacted, attempting unmuted autoplay...');
        try {
            player.unMute();
            player.playVideo();
            app.isVideoMuted = false;
            console.log('✅ Unmuted autoplay successful');
        } catch (error) {
            console.log('❌ Unmuted autoplay failed:', error);
        }
    } else {
        console.log('🔇 Starting with muted autoplay...');
        try {
            player.mute();
            player.playVideo();
            app.isVideoMuted = true;
            console.log('✅ Muted autoplay successful');
        } catch (error) {
            console.log('❌ Muted autoplay failed:', error);
        }
    }
}

function showVideoError() {
    const videoWrapper = document.querySelector('.video-player-wrapper');
    if (!videoWrapper) return;
    
    videoWrapper.innerHTML = `
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(26, 43, 60, 0.9); color: white; text-align: center; padding: 20px;">
            <i class="fas fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px; color: #E74C3C;"></i>
            <h3 style="margin-bottom: 10px; font-size: 20px;">Video Tidak Tersedia</h3>
            <p style="margin-bottom: 20px; opacity: 0.9;">Video iklan sedang tidak dapat diputar</p>
            <button onclick="hideVideo()" style="padding: 10px 20px; background: var(--primary-gold); color: white; border: none; border-radius: 6px; cursor: pointer; font-family: 'Poppins', sans-serif; font-weight: 600;">
                <i class="fas fa-arrow-left" style="margin-right: 8px;"></i>
                Kembali ke Harga Emas
            </button>
        </div>
    `;
}

// ============================================
// RESPONSIVE LAYOUT MANAGEMENT
// ============================================

function handleResponsiveLayout() {
    const width = window.innerWidth;
    
    console.log(`📱 Responsive: ${width}x${window.innerHeight}`);
    
    // Adjust table responsive
    adjustTableResponsive();
    
    // Handle mobile menu
    if (width <= 768) {
        const hamburgerBtn = document.querySelector('.hamburger-btn');
        if (hamburgerBtn) {
            hamburgerBtn.style.display = 'flex';
        }
    } else {
        const hamburgerBtn = document.querySelector('.hamburger-btn');
        if (hamburgerBtn) {
            hamburgerBtn.style.display = 'none';
        }
    }
}

// ============================================
// ERROR HANDLING & UI STATES
// ============================================

function showNoDataState() {
    const html = createNoDataHTML();
    
    document.getElementById('priceTableEmasMuda').innerHTML = html;
    document.getElementById('priceTableEmasTua').innerHTML = html;
    document.getElementById('priceTableAntam').innerHTML = html;
    document.getElementById('priceTableArchie').innerHTML = html;
}

function showErrorState(elementId, message) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Terjadi Kesalahan</h3>
            <p>${escapeHTML(message)}</p>
            <button onclick="loadPriceData()" style="margin-top: 20px; padding: 10px 20px; background: var(--primary-gold); color: white; border: none; border-radius: 6px; cursor: pointer; font-family: 'Poppins', sans-serif;">
                <i class="fas fa-redo" style="margin-right: 8px;"></i>
                Coba Lagi
            </button>
        </div>
    `;
}

function showErrorMessage(message) {
    // Create error toast
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--error);
        color: white;
        padding: 12px 16px;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);
        z-index: 9999;
        font-family: 'Poppins', sans-serif;
        max-width: 250px;
        font-size: 14px;
    `;
    
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-exclamation-circle"></i>
            <span>${escapeHTML(message)}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// ============================================
// USER INTERACTION
// ============================================

function handleUserInteraction() {
    app.setUserInteracted();
}

function loadYouTubeAPI() {
    if (app.isYouTubeAPILoaded || window.YT) return;
    
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    app.isYouTubeAPILoaded = true;
    
    console.log('📺 YouTube API loading...');
}

// YouTube API global callback
window.onYouTubeIframeAPIReady = function() {
    console.log('✅ YouTube API ready');
};

// ============================================
// PERIODIC REFRESH
// ============================================

function startPeriodicRefresh() {
    // Refresh data every 5 minutes
    setInterval(() => {
        console.log('🔄 Refreshing data from server...');
        loadAllData();
    }, 5 * 60 * 1000);
}

// ============================================
// MOBILE MENU
// ============================================

function toggleMobileMenu() {
    const header = document.querySelector('.main-header');
    header.classList.toggle('menu-open');
}

// ============================================
// GLOBAL EXPORTS
// ============================================

// Make functions globally available
window.playNextVideo = playNextVideo;
window.hideVideo = hideVideo;
window.toggleVideoMute = toggleVideoMute;
window.loadPriceData = loadPriceData;

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApplication);
} else {
    initializeApplication();
}
