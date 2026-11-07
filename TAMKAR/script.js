let mode = 'skill'; 
let participants = [];
let teams = [];
let activeUser = null;
const AUTH_USERS_KEY = 'teamMixerUsers';
const AUTH_SESSION_KEY = 'teamMixerSession';

let draftPlayers = [];
let draftTeams = [];
let currentTeamIndex = 0;
let isAnimating = false;

let activeRoulettePlayerIndex = 0;
let activeDicePlayerIndex = 0;
let activeWheelMode = 'auto';

// Global Ses ve Efekt Tanımlamaları
const sfxDice = new Audio('https://actions.google.com/sounds/v1/foley/rolling_dice.ogg');
const sfxRoulette = new Audio('https://actions.google.com/sounds/v1/sports/bowling_ball_roll.ogg');
let audioCtx = null;
let lastTick = 0;

function initAudio() {
    if(!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if(AC) audioCtx = new AC();
    }
    if(audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playTick() {
    if(!audioCtx) return;
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
        
        const pointer = document.querySelector('.wheel-pointer');
        if(pointer) {
            pointer.classList.add('tick');
            setTimeout(() => pointer.classList.remove('tick'), 50);
        }
    } catch(e) {}
}

// Tam %10 Yeşil, %45 Kırmızı, %45 Siyah oranı (20 dilimde 2 Yeşil)
const rouletteSlots = ['green', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'green', 'black', 'red', 'black', 'red', 'black', 'red', 'black', 'red', 'black'];

const modeNames = {
    'normal': 'Hızlı (Rastgele)',
    'skill': 'Beceriye Göre',
    'wheel': 'Çarkıfelek',
    'dice': 'Zar Masası',
    'roulette': 'Rulet'
};

const diceRotations = [
    { x: 0, y: 0 }, { x: -90, y: 0 }, { x: 0, y: -90 }, { x: 0, y: 90 }, { x: 90, y: 0 }, { x: 180, y: 0 }
];

const initialProfiles = [];

const settingsCatalog = [
    {
        id: 'screen',
        label: 'Ekran Ayarları',
        items: [
            ['Monitor', 'monitor'],
            ['Gama', 'gamma'],
            ['Brightness', 'brightness'],
            ['Display Mode', 'displayMode']
        ]
    },
    {
        id: 'sensitivity',
        label: 'Sensitivity Ayarları',
        items: [
            ['Mouse Sensitivity', 'mouseSensitivity'],
            ['Polling Rate', 'pollingRate']
        ]
    },
    {
        id: 'crosshair',
        label: 'Crosshair Ayarları',
        items: [
            ['Style', 'crosshairStyle'],
            ['Color', 'crosshairColor'],
            ['Size', 'crosshairSize'],
            ['Gap', 'crosshairGap']
        ]
    },
    {
        id: 'viewmodel',
        label: 'Viewmodel Ayarları',
        items: [
            ['X', 'viewX'],
            ['Y', 'viewY'],
            ['Z', 'viewZ'],
            ['FOV', 'viewFov']
        ]
    }
];

const PROFILE_STORAGE_KEY = 'teamMixerProfiles';

function getDefaultProfileData() {
    return {
        monitor: '',
        gamma: '',
        brightness: '',
        displayMode: '',
        mouseSensitivity: '',
        pollingRate: '',
        crosshairStyle: '',
        crosshairColor: '',
        crosshairSize: '',
        crosshairGap: '',
        viewX: '',
        viewY: '',
        viewZ: '',
        viewFov: ''
    };
}

function getStoredProfileData(userId) {
    if (!userId) return getDefaultProfileData();
    try {
        const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
        const profiles = raw ? JSON.parse(raw) : {};
        const saved = profiles[userId] || {};
        return { ...getDefaultProfileData(), ...saved };
    } catch (error) {
        return getDefaultProfileData();
    }
}

function saveStoredProfileData(userId, profileData) {
    if (!userId) return;
    try {
        const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
        const profiles = raw ? JSON.parse(raw) : {};
        profiles[userId] = { ...getDefaultProfileData(), ...profileData };
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
    } catch (error) {
        // Ignore storage failures silently.
    }
}

const proPresetCatalog = [
    { name: 'FaZe Clan', logo: 'FZ', accent: '#d11b35' },
    { name: 'G2 Esports', logo: 'G2', accent: '#f78b1f' },
    { name: 'Team Liquid', logo: 'TL', accent: '#3a8dff' },
    { name: 'Cloud9', logo: 'C9', accent: '#0ec5d8' },
    { name: 'FNATIC', logo: 'FN', accent: '#d81b60' },
    { name: 'Vitality', logo: 'VIT', accent: '#ffb703' },
    { name: 'OG', logo: 'OG', accent: '#8a5cf6' },
    { name: 'Astralis', logo: 'AST', accent: '#d4af37' },
    { name: 'Natus Vincere', logo: 'NAVI', accent: '#f2c14e' },
    { name: 'Team Spirit', logo: 'SP', accent: '#cc0000' },
    { name: 'Complexity', logo: 'CPLX', accent: '#5d8aa8' },
    { name: '100 Thieves', logo: '100', accent: '#d13f3f' },
    { name: 'Heroic', logo: 'H', accent: '#c9f2ff' },
    { name: 'Gen.G', logo: 'GG', accent: '#7bff8d' },
    { name: 'mousesports', logo: 'MS', accent: '#c7d2fe' },
    { name: 'Sentinels', logo: 'S', accent: '#ff5d8f' },
    { name: 'Evil Geniuses', logo: 'EG', accent: '#7bdff2' },
    { name: 'Shopify Rebellion', logo: 'SR', accent: '#6ee7b7' },
    { name: 'NIP', logo: 'NIP', accent: '#f0f4f8' },
    { name: 'BIG', logo: 'BIG', accent: '#a7f3d0' },
    { name: 'Leviatan', logo: 'LEV', accent: '#f59e0b' },
    { name: 'KOI', logo: 'KOI', accent: '#42a5f5' },
    { name: 'FlyQuest', logo: 'FQ', accent: '#38bdf8' },
    { name: 'The MongolZ', logo: 'MZ', accent: '#ff7a18' },
    { name: 'ALTERNATE', logo: 'ALT', accent: '#f472b6' },
    { name: 'FURIA', logo: 'FUR', accent: '#f97316' },
    { name: 'Apex', logo: 'APX', accent: '#22c55e' },
    { name: 'Guild', logo: 'G', accent: '#8b5cf6' },
    { name: 'PaiN Gaming', logo: 'PAIN', accent: '#a78bfa' },
    { name: 'Bilibili Gaming', logo: 'BLG', accent: '#eab308' },
    { name: 'LYC', logo: 'LYC', accent: '#a3e635' }
];

let customPresets = [
    {
        name: 'Kendi Temel Ayarım',
        dpi: '400',
        sensitivity: '1.9',
        ads: '0.85',
        crosshair: 'Static Dot',
        viewX: '1.4',
        viewY: '-2.2',
        viewZ: '-3.6'
    }
];

let matchHistory = [];

let currentPlayerProfile = null;
let profileEditMode = false;
let profileDraftData = null;

function ensureProfileSpinnerStyles() {
    if (document.getElementById('profile-spinner-style')) return;
    const style = document.createElement('style');
    style.id = 'profile-spinner-style';
    style.textContent = `
        @keyframes profile-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

function normalizeUserNameParts(displayName) {
    const fullName = String(displayName || '').trim();
    if (!fullName) {
        return { fullName: '', firstName: '', lastName: '' };
    }

    const parts = fullName.split(/\s+/).filter(Boolean);
    const firstName = parts.shift() || '';
    const lastName = parts.join(' ');

    return {
        fullName,
        firstName,
        lastName
    };
}

function getStoredUsers() {
    try {
        const raw = localStorage.getItem(AUTH_USERS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];

        if (!Array.isArray(parsed)) return [];

        return parsed.map(user => ({
            id: user.id || genId(),
            username: String(user.username || '').trim(),
            password: String(user.password || ''),
            displayName: String(user.displayName || user.fullName || '').trim(),
            fullName: String(user.fullName || user.displayName || '').trim(),
            firstName: String(user.firstName || '').trim(),
            lastName: String(user.lastName || '').trim()
        }));
    } catch (error) {
        return [];
    }
}

function saveStoredUsers(users) {
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

function syncRegisteredPlayerToParticipants(newUser) {
    const name = (newUser.firstName || newUser.displayName || '').trim();
    const surname = (newUser.lastName || '').trim();
    const nickname = (newUser.username || '').trim();

    if (!name && !nickname) return;

    const existing = participants.some(player =>
        (player.name === name && player.surname === surname) ||
        (player.nickname && player.nickname.toLowerCase() === nickname.toLowerCase())
    );

    if (existing) return;

    participants.push({
        id: newUser.id || genId(),
        name,
        surname,
        nickname,
        rating: 5
    });
    renderInputs();
}

function getActiveUser() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY));
    } catch (error) {
        return null;
    }
}

function setActiveUser(user) {
    activeUser = user;
    if (user) {
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
    } else {
        localStorage.removeItem(AUTH_SESSION_KEY);
    }
    renderAuthState();
}

function renderAuthState() {
    const user = getActiveUser() || activeUser;
    const authBox = document.getElementById('auth-user-box');
    const authName = document.getElementById('auth-user-name');
    const loginBtn = document.getElementById('hub-login-btn');
    const signupBtn = document.getElementById('hub-signup-btn');

    if (!authBox || !authName || !loginBtn || !signupBtn) return;

    if (user) {
        authName.textContent = user.displayName || user.username;
        authBox.classList.add('visible');
        signupBtn.style.display = 'none';
        loginBtn.style.display = 'none';
    } else {
        authBox.classList.remove('visible');
        signupBtn.style.display = 'inline-flex';
        loginBtn.style.display = 'inline-flex';
    }
}

function openAuthModal(mode) {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    switchAuthMode(mode);
}

function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    const message = document.getElementById('auth-message');
    if (!modal) return;
    modal.style.display = 'none';
    if (message) {
        message.textContent = '';
        message.className = 'auth-message';
    }
    const form = document.getElementById('auth-form');
    if (form) form.reset();
}

function switchAuthMode(mode) {
    const displayWrap = document.getElementById('auth-display-name-wrap');
    const title = document.getElementById('auth-modal-title');
    const submitBtn = document.getElementById('auth-submit-btn');
    const tabs = document.querySelectorAll('.auth-tab');

    const isSignup = mode === 'signup';
    if (displayWrap) displayWrap.style.display = isSignup ? 'flex' : 'none';
    if (title) title.textContent = isSignup ? 'Kayıt Ol' : 'Giriş Yap';
    if (submitBtn) submitBtn.textContent = isSignup ? 'Kayıt Ol' : 'Giriş Yap';

    tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));
}

function handleAuthSubmit(event) {
    event.preventDefault();
    const message = document.getElementById('auth-message');
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const displayName = document.getElementById('auth-display-name')?.value.trim() || '';
    const mode = document.querySelector('.auth-tab.active')?.dataset.mode || 'login';
    const users = getStoredUsers();

    if (!username || !password) {
        if (message) {
            message.textContent = 'Kullanıcı adı ve şifre alanları zorunludur.';
            message.className = 'auth-message error';
        }
        return;
    }

    if (mode === 'signup') {
        if (!displayName) {
            if (message) {
                message.textContent = 'Lütfen ad soyad bilgisi girin.';
                message.className = 'auth-message error';
            }
            return;
        }

        if (users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
            if (message) {
                message.textContent = 'Bu kullanıcı adı zaten kayıtlı.';
                message.className = 'auth-message error';
            }
            return;
        }

        const { fullName, firstName, lastName } = normalizeUserNameParts(displayName);
        const newUser = {
            id: genId(),
            username,
            password,
            displayName: fullName,
            fullName,
            firstName,
            lastName
        };

        users.push(newUser);
        saveStoredUsers(users);
        syncRegisteredPlayerToParticipants(newUser);
        setActiveUser(newUser);
        closeAuthModal();
        if (message) {
            message.textContent = 'Kayıt başarılı.';
            message.className = 'auth-message success';
        }
        return;
    }

    const matchedUser = users.find(user => user.username.toLowerCase() === username.toLowerCase() && user.password === password);
    if (!matchedUser) {
        if (message) {
            message.textContent = 'Böyle bir hesap yok. Kayıt olmayı deneyin veya kullanıcı adını ve şifreyi kontrol edin.';
            message.className = 'auth-message error';
        }
        return;
    }

    setActiveUser(matchedUser);
    closeAuthModal();
}

function logoutUser() {
    setActiveUser(null);
}

function bindRangeValue(id, outputId) {
    const slider = document.getElementById(id);
    const output = document.getElementById(outputId);
    if (!slider || !output) return;
    const sync = () => {
        output.textContent = Number(slider.value).toFixed(slider.step && slider.step.includes('.') ? 1 : 0);
    };
    slider.addEventListener('input', sync);
    sync();
}

function init() {
    activeUser = getActiveUser();
    initialProfiles.forEach(profile => {
        participants.push({
            id: genId(),
            name: profile.name,
            surname: profile.surname || '',
            nickname: profile.nickname || '',
            rating: profile.rating || 5
        });
    });
    teams.push({ id: genId(), name: "Terrorists", color: "var(--team-3)" });
    teams.push({ id: genId(), name: "Counter-Terrorists", color: "var(--team-1)" });
    bindRangeValue('custom-view-x', 'custom-view-x-value');
    bindRangeValue('custom-view-y', 'custom-view-y-value');
    bindRangeValue('custom-view-z', 'custom-view-z-value');
    bindRangeValue('custom-view-fov', 'custom-view-fov-value');
    bindConfigNameInput();
    renderInputs();
    renderPlayersMenu();
    renderAuthState();
    showWelcome();
}

function getDisplayName(player) {
    if (!player) return 'Oyuncu';
    const parts = [];
    if (player.name) parts.push(player.name);
    if (player.nickname) parts.push(`"${player.nickname}"`);
    if (player.surname) parts.push(player.surname);
    return parts.join(' ');
}

function setHeaderVisibility(isVisible) {
    const header = document.getElementById('app-header');
    if (!header) return;
    header.classList.toggle('hidden', !isVisible);
}

function activateScreen(screenId) {
    const screenIds = ['welcome-screen', 'hub-screen', 'players-screen', 'preset-screen', 'custom-preset-screen', 'history-screen', 'player-settings-screen', 'main-inputs'];
    screenIds.forEach(id => {
        const element = document.getElementById(id);
        if (!element) return;
        element.classList.remove('visible');
        if (id !== screenId) {
            element.style.display = 'none';
        }
    });

    const target = document.getElementById(screenId);
    if (!target) return;
    if (screenId === 'welcome-screen') {
        target.style.display = 'flex';
    } else {
        target.style.display = 'block';
    }
    requestAnimationFrame(() => target.classList.add('visible'));
}

function showWelcome() {
    setHeaderVisibility(false);
    activateScreen('welcome-screen');
    hideAllStageScreens();
}

function showHub() {
    setHeaderVisibility(false);
    activateScreen('hub-screen');
    hideAllStageScreens();
}

function showPlayersScreen() {
    setHeaderVisibility(false);
    activateScreen('players-screen');
    hideAllStageScreens();
    renderPlayersMenu();
}

function showPresetScreen() {
    setHeaderVisibility(false);
    activateScreen('preset-screen');
    renderProPresets();
}

function showCustomPresetScreen() {
    setHeaderVisibility(false);
    activateScreen('custom-preset-screen');
    renderCustomPresets();
}

function showHistoryScreen() {
    setHeaderVisibility(false);
    activateScreen('history-screen');
    renderHistory();
}

function showGeneratorScreen() {
    setHeaderVisibility(false);
    activateScreen('main-inputs');
    hideAllStageScreens();
}

function hideAllStageScreens() {
    document.getElementById('wheel-screen').style.display = 'none';
    document.getElementById('dice-screen').style.display = 'none';
    document.getElementById('roulette-screen').style.display = 'none';
    document.getElementById('results-screen').style.display = 'none';
}

function renderPlayersMenu() {
    const grid = document.getElementById('players-grid');
    if (!grid) return;

    if (!participants.length) {
        grid.innerHTML = `
            <div class="history-card">
                <h4>Henüz oyuncu yok</h4>
                <div class="meta">İlk oyuncuyu ekleyerek burada görünmesini sağlayabilirsiniz.</div>
            </div>
        `;
        return;
    }

    grid.innerHTML = participants.map(player => `
        <button class="player-card" type="button" onclick="openPlayerProfile('${player.id}')">
            <div class="name">
                <span>${player.name}</span>
                <span>›</span>
            </div>
            <div class="nickname">${player.nickname ? `"${player.nickname}"` : 'Takma ad yok'}</div>
            <div class="meta">${player.surname ? player.surname : 'Kayıtlı oyuncu'}</div>
        </button>
    `).join('');
}

function renderProPresets() {
    const grid = document.getElementById('preset-grid');
    if (!grid) return;

    grid.innerHTML = proPresetCatalog.map(preset => `
        <button class="preset-card team-card" type="button" onclick="openPresetDetails('${preset.name}')" style="--team-accent:${preset.accent || '#5eead4'};">
            <div class="team-badge" style="background:${preset.accent || '#5eead4'};">${preset.logo}</div>
            <div class="team-name">${preset.name}</div>
        </button>
    `).join('');
}

function openPresetDetails(presetName) {
    const preset = proPresetCatalog.find(item => item.name === presetName);
    if (!preset) return;

    const wrapper = document.getElementById('preset-screen');
    const details = document.createElement('div');
    details.className = 'settings-content';
    details.style.marginTop = '24px';
    details.innerHTML = `
        <h3>${preset.name}</h3>
        <ul class="settings-list">
            <li><span>Takım</span><strong>${preset.name}</strong></li>
            <li><span>Logo</span><strong>${preset.logo}</strong></li>
            <li><span>Durum</span><strong>Hazır takım listesi</strong></li>
        </ul>
    `;

    const existing = wrapper.querySelector('.settings-content');
    if (existing) existing.remove();
    wrapper.appendChild(details);
}

function sanitizeConfigName(value) {
    return String(value || '').replace(/[^A-Za-z0-9]/g, '');
}

function bindConfigNameInput() {
    const input = document.getElementById('custom-preset-name');
    if (!input) return;

    input.addEventListener('input', () => {
        input.value = sanitizeConfigName(input.value);
    });
}

function getValidConfigName() {
    const input = document.getElementById('custom-preset-name');
    const sanitized = sanitizeConfigName(input ? input.value : '');
    if (input) {
        input.value = sanitized || 'Config1';
    }
    return sanitized || 'Config1';
}

function renderCustomPresets() {
    const list = document.getElementById('custom-preset-list');
    if (!list) return;

    list.innerHTML = customPresets.map(preset => `
        <div class="history-card">
            <h4>${preset.name}</h4>
            <div class="meta">Crosshair ${preset.crosshair}</div>
            <div class="result">View ${preset.viewX} / ${preset.viewY} / ${preset.viewZ} · FOV ${preset.fov}</div>
        </div>
    `).join('');
}

function saveCustomPreset() {
    const name = getValidConfigName();
    const preset = {
        name,
        crosshair: document.getElementById('custom-crosshair').value || 'Varsayılan Dinamik',
        viewX: document.getElementById('custom-view-x').value || '1.5',
        viewY: document.getElementById('custom-view-y').value || '-1.0',
        viewZ: document.getElementById('custom-view-z').value || '1.0',
        fov: document.getElementById('custom-view-fov').value || '60'
    };

    customPresets.unshift(preset);
    renderCustomPresets();
}

function renderHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;

    if (!matchHistory.length) {
        list.innerHTML = `
            <div class="history-card">
                <h4>Henüz maç geçmişi yok</h4>
                <div class="meta">Kayıtlı maç görünümü burada listelenecek.</div>
            </div>
        `;
        return;
    }

    list.innerHTML = matchHistory.map(item => `
        <div class="history-card">
            <h4>${item.title}</h4>
            <div class="meta">${item.date} · ${item.mode}</div>
            <span class="result">${item.result}</span>
        </div>
    `).join('');
}

function canEditCurrentProfile() {
    return !!activeUser && !!currentPlayerProfile && String(currentPlayerProfile.id) === String(activeUser.id);
}

function openPlayerProfile(playerId) {
    resetProfileEditState();
    setHeaderVisibility(false);
    currentPlayerProfile = participants.find(p => p.id === playerId) || participants[0];
    const menu = document.getElementById('settings-menu');
    const title = document.getElementById('player-name-title');

    const screenIds = ['welcome-screen', 'hub-screen', 'players-screen', 'preset-screen', 'custom-preset-screen', 'history-screen', 'player-settings-screen', 'main-inputs'];
    screenIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('visible');
        if (id !== 'player-settings-screen') el.style.display = 'none';
    });

    const settingsScreen = document.getElementById('player-settings-screen');
    settingsScreen.style.display = 'block';
    requestAnimationFrame(() => settingsScreen.classList.add('visible'));

    title.textContent = getDisplayName(currentPlayerProfile);

    const activeSection = settingsCatalog[0];

    menu.innerHTML = settingsCatalog.map((section, idx) => `
        <button class="settings-tab ${idx === 0 ? 'active' : ''}" type="button" onclick="renderSettingsSection('${section.id}')">
            ${section.label}
        </button>
    `).join('');

    renderSettingsSection(activeSection.id);
}

function resetProfileEditState() {
    profileEditMode = false;
    profileDraftData = null;
}

function startProfileEditMode() {
    if (!canEditCurrentProfile()) return;
    profileEditMode = true;
    profileDraftData = getStoredProfileData(currentPlayerProfile.id);
    renderSettingsSection('screen');
}

function cancelProfileEditMode() {
    if (!canEditCurrentProfile()) return;
    profileEditMode = false;
    profileDraftData = null;
    renderSettingsSection('screen');
}

function saveProfileSettings() {
    if (!canEditCurrentProfile()) return;

    const form = document.getElementById('profile-settings-form');
    if (!form) return;

    const profileData = getStoredProfileData(activeUser.id);
    form.querySelectorAll('[data-profile-key]').forEach(input => {
        const key = input.dataset.profileKey;
        profileData[key] = input.value || '';
    });

    saveStoredProfileData(activeUser.id, profileData);
    ensureProfileSpinnerStyles();

    const saveBtn = document.getElementById('profile-save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span style="display:inline-block; animation: profile-spin 0.7s linear infinite;">⟳</span> Kaydedildi';
    }

    setTimeout(() => {
        profileEditMode = false;
        profileDraftData = null;
        renderSettingsSection('screen');
    }, 900);
}

function renderSettingsSection(sectionId) {
    const menuButtons = document.querySelectorAll('.settings-tab');
    menuButtons.forEach(btn => btn.classList.remove('active'));
    const activeButton = Array.from(menuButtons).find(btn => btn.textContent.trim() === (settingsCatalog.find(s => s.id === sectionId)?.label || ''));
    if (activeButton) activeButton.classList.add('active');

    const section = settingsCatalog.find(s => s.id === sectionId) || settingsCatalog[0];
    const detail = document.getElementById('settings-detail');
    if (!detail || !currentPlayerProfile) return;

    const savedProfileData = getStoredProfileData(currentPlayerProfile.id);
    const profileData = profileEditMode && profileDraftData ? profileDraftData : savedProfileData;
    const canEdit = canEditCurrentProfile();

    if (!canEdit) {
        detail.innerHTML = `
            <li>
                <span>Durum</span>
                <strong>Sadece kendi profilini düzenleyebilirsiniz.</strong>
            </li>
            ${section.items.map(([label, key]) => `
                <li>
                    <span>${label}</span>
                    <strong>${profileData[key] || '—'}</strong>
                </li>
            `).join('')}
        `;
        return;
    }

    if (!profileEditMode) {
        detail.innerHTML = `
            <div style="display:flex; justify-content:flex-end; margin-bottom: 12px;">
                <button type="button" class="save-btn" onclick="startProfileEditMode()" style="margin:0; width:auto; min-width:180px;">Profili Düzenle</button>
            </div>
            ${section.items.map(([label, key]) => `
                <li>
                    <span>${label}</span>
                    <strong>${profileData[key] || '—'}</strong>
                </li>
            `).join('')}
        `;
        return;
    }

    detail.innerHTML = `
        <form id="profile-settings-form">
            ${section.items.map(([label, key]) => `
                <li>
                    <span>${label}</span>
                    <input type="text" data-profile-key="${key}" value="${profileData[key] || ''}" style="max-width: 180px; padding: 8px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: rgba(15,23,42,0.9); color: var(--text-main); font-size: 14px;" />
                </li>
            `).join('')}
            <li style="display:flex; justify-content:flex-end; gap: 10px; padding-top: 12px;">
                <button type="button" class="save-btn" onclick="cancelProfileEditMode()" style="margin:0; width:auto; min-width:120px; background: rgba(148,163,184,0.2); border: 1px solid rgba(255,255,255,0.12); color: var(--text-main);">İptal</button>
                <button id="profile-save-btn" type="button" class="save-btn" onclick="saveProfileSettings()" style="margin:0; width:auto; min-width:180px;">Profili Kaydet</button>
            </li>
        </form>
    `;
}

function genId() { return Math.random().toString(36).substr(2, 9); }

function changeTheme(color) {
    document.documentElement.style.setProperty('--accent', color);
}

function toggleDarkMode() {
    const body = document.body;
    body.classList.toggle('light-mode');
    const btn = document.getElementById('darkModeToggle');
    if(body.classList.contains('light-mode')) {
        btn.innerText = '🌙';
    } else {
        btn.innerText = '☀️';
    }
}

function getRatingColor(rating) {
    if (rating === 10) return '#ef4444'; // Kırmızı
    if (rating === 9 || rating === 8) return '#f97316'; // Turuncu
    if (rating >= 4 && rating <= 7) return '#eab308'; // Sarı
    if (rating === 3 || rating === 2) return '#22c55e'; // Yeşil
    return '#f8fafc'; // Beyaz (1. Seviye)
}

function setMode(newMode) {
    mode = newMode;
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    const modeButton = document.getElementById('btn' + mode.charAt(0).toUpperCase() + mode.slice(1));
    if (modeButton) modeButton.classList.add('active');

    document.querySelectorAll('.generator-mode-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === newMode);
    });

    document.getElementById('logo-text').innerText = modeNames[mode];

    if(mode === 'normal' || mode === 'skill') {
        document.getElementById('forceEqualContainer').style.display = 'flex';
    } else {
        document.getElementById('forceEqualContainer').style.display = 'none';
    }

    renderInputs();
}

// Seçimleri silmeden ana menüye dönmeyi sağlayan fonksiyon
function resetToMenu() {
    if(isAnimating) return; 

    document.getElementById('wheel-screen').style.display = 'none';
    document.getElementById('dice-screen').style.display = 'none';
    document.getElementById('roulette-screen').style.display = 'none';
    document.getElementById('results-screen').style.display = 'none';
    document.getElementById('main-inputs').style.display = 'none';

    const navModes = document.getElementById('nav-modes');
    navModes.style.pointerEvents = 'auto';
    navModes.style.opacity = '1';
    
    const themeSwitch = document.getElementById('theme-switcher');
    themeSwitch.style.pointerEvents = 'auto';
    themeSwitch.style.opacity = '1';

    showHub();
}

function renderInputs() {
    const pList = document.getElementById('participants-list');
    pList.innerHTML = '';
    document.getElementById('playerCount').innerText = participants.length;
    
    participants.forEach(p => {
        const row = document.createElement('div');
        row.className = 'row';
        
        const input = document.createElement('input');
        input.className = 'input-text';
        input.value = p.name;
        input.oninput = (e) => p.name = e.target.value;
        
        const ratingDiv = document.createElement('div');
        ratingDiv.className = 'rating-dots';
        if(mode !== 'skill') ratingDiv.style.opacity = '0.2'; 
        
        for(let i=1; i<=10; i++) {
            const dot = document.createElement('div');
            dot.className = `rating-box ${i <= p.rating ? 'active' : ''}`;
            dot.innerText = i;
            
            if (i <= p.rating) {
                const color = getRatingColor(p.rating);
                dot.style.background = color;
                dot.style.boxShadow = `0 0 6px ${color}`;
            }

            if(mode === 'skill') dot.onclick = () => { p.rating = i; renderInputs(); };
            ratingDiv.appendChild(dot);
        }

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-icon';
        delBtn.innerHTML = '✖';
        delBtn.onclick = () => { participants = participants.filter(x => x.id !== p.id); renderInputs(); };

        row.appendChild(input);
        row.appendChild(ratingDiv);
        row.appendChild(delBtn);
        pList.appendChild(row);
    });

    const tList = document.getElementById('teams-list');
    tList.innerHTML = '';
    document.getElementById('teamCountBadge').innerText = teams.length;

    teams.forEach((t) => {
        const row = document.createElement('div');
        row.className = 'row';
        
        const input = document.createElement('input');
        input.className = 'input-text';
        input.value = t.name;
        input.oninput = (e) => t.name = e.target.value;

        const delBtn = document.createElement('button');
        delBtn.className = 'btn-icon';
        delBtn.innerHTML = '✖';
        delBtn.onclick = () => { teams = teams.filter(x => x.id !== t.id); renderInputs(); };

        row.appendChild(input);
        row.appendChild(delBtn);
        tList.appendChild(row);
    });
}

function addParticipant() { participants.push({ id: genId(), name: "Yeni Oyuncu", rating: 5 }); renderInputs(); }
function addTeam() { teams.push({ id: genId(), name: `Takım ${teams.length+1}`, color: "var(--team-4)" }); renderInputs(); }

function startGeneration() {
    const validP = participants.filter(p => p.name.trim() !== "");
    if(validP.length < teams.length) return alert("Oyuncu sayısı takım sayısından az olamaz!");
    if(teams.length < 2) return alert("En az 2 takım olmalı!");
    if(mode === 'roulette' && teams.length !== 2) return alert("Rulet modu tam olarak 2 takım gerektirir! Lütfen takım sayısını 2'ye ayarlayın.");

    const navModes = document.getElementById('nav-modes');
    navModes.style.pointerEvents = 'none';
    navModes.style.opacity = '0.3';
    
    const themeSwitch = document.getElementById('theme-switcher');
    themeSwitch.style.pointerEvents = 'none';
    themeSwitch.style.opacity = '0.3';

    document.getElementById('main-inputs').style.display = 'none';

    if(mode === 'normal' || mode === 'skill') {
        generateInstant(validP);
    } else if (mode === 'wheel') {
        initWheel(validP);
    } else if (mode === 'dice') {
        initDice(validP);
    } else if (mode === 'roulette') {
        initRoulette(validP);
    }
}

// 1. HIZLI DAĞITIM
function generateInstant(validP) {
    const forceEqual = document.getElementById('forceEqual').checked;
    const maxPerTeam = Math.ceil(validP.length / teams.length);

    let finalTeams = teams.map(t => ({ ...t, members: [], score: 0 }));
    let pool = [...validP];

    if(mode === 'normal') {
        pool.sort(() => Math.random() - 0.5);
        if(forceEqual) {
            pool.forEach((p, i) => finalTeams[i % finalTeams.length].members.push(p));
        } else {
            pool.forEach(p => finalTeams[Math.floor(Math.random() * finalTeams.length)].members.push(p));
        }
    } else {
        pool.sort(() => Math.random() - 0.5);
        pool.sort((a,b) => b.rating - a.rating);
        
        if(forceEqual) {
            pool.forEach(p => {
                let availableTeams = finalTeams.filter(t => t.members.length < maxPerTeam);
                if(availableTeams.length === 0) availableTeams = finalTeams;
                
                let minScore = Math.min(...availableTeams.map(t => t.score));
                let candidates = availableTeams.filter(t => t.score === minScore);
                let chosenTeam = candidates[Math.floor(Math.random() * candidates.length)];
                
                chosenTeam.members.push(p);
                chosenTeam.score += p.rating;
            });
        } else {
            pool.forEach(p => {
                let minScore = Math.min(...finalTeams.map(t => t.score));
                let candidates = finalTeams.filter(t => t.score === minScore);
                let chosenTeam = candidates[Math.floor(Math.random() * candidates.length)];
                
                chosenTeam.members.push(p);
                chosenTeam.score += p.rating;
            });
        }
    }
    renderTeamsGrid(finalTeams, 'final-teams-grid', mode === 'skill');
    document.getElementById('results-screen').style.display = 'block';
}

// 2. ÇARKIFELEK
let currentAngle = 0;
let spinSpeed = 0;
const wheelColors = ['#3b82f6', '#f43f5e', '#eab308', '#a855f7', '#00e676'];

function initWheel(validP) {
    document.getElementById('wheel-screen').style.display = 'block';
    draftPlayers = [...validP].sort(() => Math.random() - 0.5);
    draftTeams = teams.map(t => ({ ...t, members: [] }));
    currentTeamIndex = 0;
    document.getElementById('wheel-team-select').innerHTML = '';
    updateWheelUI();
    drawWheel();
}

function drawWheel() {
    const canvas = document.getElementById('wheel-canvas');
    if(!canvas || draftPlayers.length === 0) return;
    const ctx = canvas.getContext('2d');
    const size = 320;
    const radius = 150;
    const center = size / 2;
    const arc = Math.PI * 2 / draftPlayers.length;
    ctx.clearRect(0,0,size,size);
    
    for(let i=0; i<draftPlayers.length; i++) {
        const angle = currentAngle + i * arc;
        ctx.beginPath();
        ctx.fillStyle = wheelColors[i % wheelColors.length];
        if(i === draftPlayers.length-1 && draftPlayers.length % wheelColors.length === 1 && draftPlayers.length > 1) ctx.fillStyle = '#ff7a00';
        ctx.moveTo(center, center);
        ctx.arc(center, center, radius, angle, angle + arc);
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(angle + arc/2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Poppins';
        ctx.fillText(draftPlayers[i].name, radius - 25, 6);
        ctx.restore();
    }
    ctx.beginPath(); ctx.arc(center,center,18,0,Math.PI*2); ctx.fillStyle="#1e293b"; ctx.fill();
}

function spinWheel() {
    if(isAnimating || draftPlayers.length === 0) return;
    isAnimating = true;
    
    const selectEl = document.getElementById('wheel-team-select');
    activeWheelMode = selectEl.value;
    selectEl.disabled = true;

    initAudio();
    lastTick = Math.floor(currentAngle / (Math.PI * 2 / draftPlayers.length));

    document.getElementById('spinBtn').disabled = true;
    spinSpeed = Math.random() * 0.15 + 0.20; 
    requestAnimationFrame(animateWheel);
}

function animateWheel() {
    currentAngle += spinSpeed;
    if (spinSpeed < 0.02) {
        spinSpeed *= 0.993;
    } else {
        spinSpeed *= 0.985;
    }
    drawWheel();
    
    let arc = 2 * Math.PI / draftPlayers.length;
    let currentTick = Math.floor(currentAngle / arc);
    if(currentTick !== lastTick) {
        playTick();
        lastTick = currentTick;
    }
    
    if(spinSpeed < 0.001) {
        let normalized = currentAngle % (2 * Math.PI);
        if(normalized < 0) normalized += 2 * Math.PI;
        let winIdx = Math.floor((2 * Math.PI - normalized) / arc) % draftPlayers.length;
        
        let winner = draftPlayers[winIdx];
        document.getElementById('spinBtn').innerText = `${winner.name} Geldi! Bekleniyor...`;
        
        setTimeout(() => {
            let targetTeamIdx;
            if (activeWheelMode === 'auto') {
                targetTeamIdx = currentTeamIndex;
                currentTeamIndex = (currentTeamIndex + 1) % draftTeams.length;
            } else {
                targetTeamIdx = parseInt(activeWheelMode);
            }
            draftTeams[targetTeamIdx].members.push(winner);
            draftPlayers.splice(winIdx, 1);
            
            updateWheelUI();
            drawWheel();

            if(draftPlayers.length === 0) {
                document.getElementById('spinBtn').innerText = "Kura Bitti!";
                isAnimating = false;
            } else {
                isAnimating = false;
                document.getElementById('spinBtn').disabled = false;
                document.getElementById('spinBtn').innerText = "Çarkı Çevir";
            }
        }, 1000); 
    } else {
        requestAnimationFrame(animateWheel);
    }
}

function checkWheelAutoAssign() {
    if (draftPlayers.length === 0 || draftTeams.length !== 2) return false;
    
    const totalPlayers = draftPlayers.length + draftTeams[0].members.length + draftTeams[1].members.length;
    const maxPerTeam = Math.ceil(totalPlayers / 2);
    
    if (draftTeams[0].members.length >= maxPerTeam) {
        draftTeams[1].members.push(...draftPlayers);
        draftPlayers = [];
        return true;
    }
    if (draftTeams[1].members.length >= maxPerTeam) {
        draftTeams[0].members.push(...draftPlayers);
        draftPlayers = [];
        return true;
    }
    return false;
}

function updateWheelUI() {
    const wasAutoAssigned = checkWheelAutoAssign();

    const statusText = document.getElementById('wheel-status-text');
    const selectEl = document.getElementById('wheel-team-select');

    if(draftPlayers.length > 0) {
        statusText.innerText = "Dağıtım Modu:";
        selectEl.style.display = 'inline-block';
        selectEl.disabled = false;
        if(selectEl.options.length === 0) {
            selectEl.innerHTML = '<option value="auto">Sıralı (Otomatik)</option>';
            draftTeams.forEach((t, index) => {
                const opt = document.createElement('option');
                opt.value = index;
                opt.innerText = `Sadece ${t.name}`;
                selectEl.appendChild(opt);
            });
        }
    } else {
        statusText.innerText = wasAutoAssigned ? "Kalan Oyuncular Otomatik Atandı!" : "Kura Tamamlandı!";
        selectEl.style.display = 'none';
    }
    drawWheel();
    renderTeamsGrid(draftTeams, 'wheel-teams-grid', false);
}

// 3. ZAR MODU
function initDice(validP) {
    document.getElementById('dice-screen').style.display = 'block';
    draftPlayers = [...validP].sort(() => Math.random() - 0.5); 
    draftTeams = teams.map(t => ({ ...t, members: [] }));
    
    for(let i=0; i<6; i++) {
        const team = draftTeams[i % draftTeams.length];
        document.getElementById(`face-${i}`).innerText = team.name;
    }
    
    updateDiceUI();
}

function checkDiceAutoAssign() {
    if (draftPlayers.length === 0 || draftTeams.length !== 2) return false;
    
    const totalPlayers = draftPlayers.length + draftTeams[0].members.length + draftTeams[1].members.length;
    const maxPerTeam = Math.ceil(totalPlayers / 2);
    
    if (draftTeams[0].members.length >= maxPerTeam) {
        draftTeams[1].members.push(...draftPlayers);
        draftPlayers = [];
        return true;
    }
    if (draftTeams[1].members.length >= maxPerTeam) {
        draftTeams[0].members.push(...draftPlayers);
        draftPlayers = [];
        return true;
    }
    return false;
}

function updateDiceUI() {
    const wasAutoAssigned = checkDiceAutoAssign();

    const statusText = document.getElementById('dice-status-text');
    const selectEl = document.getElementById('dice-player-select');
    const btn = document.getElementById('dice-roll-btn');
    
    if(draftPlayers.length > 0) {
        statusText.innerText = "Sıradaki:";
        selectEl.style.display = 'inline-block';
        selectEl.disabled = false;
        selectEl.innerHTML = '';
        draftPlayers.forEach((p, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.innerText = p.name;
            selectEl.appendChild(opt);
        });
        btn.disabled = false;
        btn.innerText = "Zarı At";
    } else {
        statusText.innerText = wasAutoAssigned ? "Kalan Oyuncular Otomatik Atandı!" : "Kura Tamamlandı!";
        selectEl.style.display = 'none';
        btn.disabled = true;
        btn.innerText = "Bitti";
    }
    renderTeamsGrid(draftTeams, 'dice-teams-grid', false);
}

function rollDice() {
    if(isAnimating || draftPlayers.length === 0) return;
    isAnimating = true;
    
    const selectEl = document.getElementById('dice-player-select');
    activeDicePlayerIndex = parseInt(selectEl.value);
    selectEl.disabled = true;

    const currentPlayer = draftPlayers[activeDicePlayerIndex];
    const btn = document.getElementById('dice-roll-btn');
    btn.disabled = true;
    btn.innerText = "Atılıyor...";
    
    try {
        sfxDice.currentTime = 0;
        sfxDice.play();
    } catch(e) {}
    
    const cube = document.getElementById('dice-cube');
    const diceFace = Math.floor(Math.random() * 6); 
    
    const teamFaces = [];
    for(let i=0; i<6; i++) teamFaces.push(draftTeams[i % draftTeams.length]);
    teamFaces.sort(() => Math.random() - 0.5);
    for(let i=0; i<6; i++) document.getElementById(`face-${i}`).innerText = teamFaces[i].name;
    
    const winnerTeam = teamFaces[diceFace];

    cube.style.transition = 'none';
    cube.classList.add('rolling');

    setTimeout(() => {
        cube.classList.remove('rolling');
        cube.style.transition = 'transform 1s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        
        const rot = diceRotations[diceFace];
        cube.style.transform = `translateZ(-60px) rotateX(${rot.x}deg) rotateY(${rot.y}deg)`;
        
        btn.innerText = `${winnerTeam.name} - Bekleniyor...`;
        
        setTimeout(() => {
            winnerTeam.members.push(currentPlayer);
            draftPlayers.splice(activeDicePlayerIndex, 1); 
            
            isAnimating = false;
            updateDiceUI();
        }, 2500);

    }, 1000);
}

// 4. RULET MODU
let wheelAngle = 0;
let ballAngle = -Math.PI / 2;
let ballSpinSpeed = 0;

function initRoulette(validP) {
    document.getElementById('roulette-screen').style.display = 'block';
    draftPlayers = [...validP].sort(() => Math.random() - 0.5);
    draftTeams = teams.map(t => ({ ...t, members: [] }));
    wheelAngle = 0;
    ballAngle = -Math.PI / 2;
    updateRouletteUI();
}

function checkRouletteAutoAssign() {
    if (draftPlayers.length === 0) return false;
    
    const totalPlayers = draftPlayers.length + draftTeams[0].members.length + draftTeams[1].members.length;
    const maxPerTeam = Math.ceil(totalPlayers / 2);
    
    if (draftTeams[0].members.length >= maxPerTeam) {
        draftTeams[1].members.push(...draftPlayers);
        draftPlayers = [];
        return true;
    }
    if (draftTeams[1].members.length >= maxPerTeam) {
        draftTeams[0].members.push(...draftPlayers);
        draftPlayers = [];
        return true;
    }
    return false;
}

function updateRouletteUI() {
    const wasAutoAssigned = checkRouletteAutoAssign();
    
    const statusText = document.getElementById('roulette-status-text');
    const selectEl = document.getElementById('roulette-player-select');
    const btn = document.getElementById('roulette-roll-btn');
    document.getElementById('roulette-controls').style.display = 'block';
    document.getElementById('roulette-choice').style.display = 'none';
    
    if(draftPlayers.length > 0) {
        statusText.innerText = "Sıradaki:";
        selectEl.style.display = 'inline-block';
        selectEl.disabled = false;
        selectEl.innerHTML = '';
        draftPlayers.forEach((p, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.innerText = p.name;
            selectEl.appendChild(opt);
        });
        btn.disabled = false;
        btn.innerText = "Çevir";
    } else {
        statusText.innerText = wasAutoAssigned ? "Kalan Oyuncular Otomatik Atandı!" : "Kura Tamamlandı!";
        selectEl.style.display = 'none';
        btn.disabled = true;
        btn.innerText = "Bitti";
    }
    drawRouletteWheel();
    renderTeamsGrid(draftTeams, 'roulette-teams-grid', false);
}

function drawRouletteWheel() {
    const canvas = document.getElementById('roulette-canvas');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = cx;
    const numSlots = rouletteSlots.length;
    const arc = Math.PI * 2 / numSlots;

    ctx.clearRect(0,0,canvas.width,canvas.height);
    
    for(let i=0; i<numSlots; i++) {
        const angle = wheelAngle + i * arc;
        ctx.beginPath();
        if(rouletteSlots[i] === 'green') ctx.fillStyle = '#16a34a';
        else if(rouletteSlots[i] === 'red') ctx.fillStyle = '#dc2626';
        else ctx.fillStyle = '#111827';
        
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, angle, angle + arc);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        if(rouletteSlots[i] === 'green') {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle + arc/2);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Poppins';
            ctx.fillText('★', radius - 8, 5);
            ctx.restore();
        }
    }
    
    ctx.beginPath(); ctx.arc(cx, cy, radius * 0.65, 0, Math.PI*2); 
    ctx.fillStyle = '#1e293b'; ctx.fill(); ctx.lineWidth=3; ctx.strokeStyle='#eab308'; ctx.stroke();
    
    ctx.beginPath(); ctx.arc(cx, cy, radius * 0.25, 0, Math.PI*2); 
    ctx.fillStyle = '#33201c'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.stroke();
    
    ctx.beginPath(); ctx.arc(cx, cy, radius * 0.1, 0, Math.PI*2); 
    ctx.fillStyle = '#eab308'; ctx.fill();
    
    let speedFactor = Math.min(ballSpinSpeed / 0.15, 1);
    let currentBallRadius = radius * 0.70 + (radius * 0.20 * speedFactor);
    
    const bx = cx + Math.cos(ballAngle) * currentBallRadius;
    const by = cy + Math.sin(ballAngle) * currentBallRadius;
    
    ctx.beginPath();
    ctx.arc(bx, by, 7, 0, Math.PI*2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#333';
    ctx.stroke();
}

function spinRoulette() {
    if(isAnimating || draftPlayers.length === 0) return;
    isAnimating = true;
    
    const selectEl = document.getElementById('roulette-player-select');
    activeRoulettePlayerIndex = parseInt(selectEl.value);
    selectEl.disabled = true;

    const btn = document.getElementById('roulette-roll-btn');
    btn.disabled = true;
    btn.innerText = "Dönüyor...";
    
    ballSpinSpeed = Math.random() * 0.15 + 0.35;
    requestAnimationFrame(animateRoulette);
    
    try {
        sfxRoulette.currentTime = 0;
        sfxRoulette.play();
    } catch(e) {}
}

function animateRoulette() {
    wheelAngle -= 0.005;
    ballAngle += ballSpinSpeed;
    ballSpinSpeed *= 0.991;
    
    drawRouletteWheel();
    
    if(ballSpinSpeed < 0.001) {
        try { sfxRoulette.pause(); } catch(e) {}
        let relativeAngle = (ballAngle - wheelAngle) % (2 * Math.PI);
        if(relativeAngle < 0) relativeAngle += 2 * Math.PI;
        let arc = 2 * Math.PI / rouletteSlots.length;
        let winIdx = Math.floor(relativeAngle / arc) % rouletteSlots.length;
        
        let winnerColor = rouletteSlots[winIdx];
        handleRouletteResult(winnerColor);
    } else {
        requestAnimationFrame(animateRoulette);
    }
}

function handleRouletteResult(color) {
    const btn = document.getElementById('roulette-roll-btn');
    
    if(color === 'black') {
        btn.innerText = `Siyah! ${draftTeams[0].name} Kazandı.`;
        setTimeout(() => { finishRouletteTurn(0); }, 2000);
    } else if (color === 'red') {
        btn.innerText = `Kırmızı! ${draftTeams[1].name} Kazandı.`;
        setTimeout(() => { finishRouletteTurn(1); }, 2000);
    } else if (color === 'green') {
        document.getElementById('roulette-controls').style.display = 'none';
        const choiceBox = document.getElementById('roulette-choice');
        choiceBox.style.display = 'flex';
        choiceBox.innerHTML = `
            <div style="width:100%; text-align:center; color:#16a34a; font-weight:800; font-size:24px; text-transform:uppercase; letter-spacing:1px;">Yeşil Geldi! Takımını Seç:</div>
            <button class="start-btn" style="margin:0; width:auto; flex:1; background:var(--panel-bg); color:white; border:3px solid ${draftTeams[0].color || '#3b82f6'}" onclick="finishRouletteTurn(0)">${draftTeams[0].name}</button>
            <button class="start-btn" style="margin:0; width:auto; flex:1; background:var(--panel-bg); color:white; border:3px solid ${draftTeams[1].color || '#f43f5e'}" onclick="finishRouletteTurn(1)">${draftTeams[1].name}</button>
        `;
    }
}

function finishRouletteTurn(teamIndex) {
    draftTeams[teamIndex].members.push(draftPlayers[activeRoulettePlayerIndex]);
    draftPlayers.splice(activeRoulettePlayerIndex, 1);
    isAnimating = false;
    updateRouletteUI();
}

// ORTAK UI METODU
function renderTeamsGrid(teamsArray, containerId, showScores) {
    const grid = document.getElementById(containerId);
    grid.innerHTML = '';
    
    teamsArray.forEach(t => {
        const card = document.createElement('div');
        card.className = 'team-card';
        if(t.color) card.style.borderTopColor = t.color;

        const scoreHtml = showScores ? `<div class="team-stats">Toplam Güç: ${t.score}</div>` : `<div class="team-stats">${t.members.length} Kişi</div>`;
        
        let membersHtml = t.members.map(m => `
            <li>
                <span>${m.name}</span>
                ${showScores ? `<span class="p-rating" style="color:${getRatingColor(m.rating)}">${m.rating} Puan</span>` : ''}
            </li>
        `).join('');

        card.innerHTML = `
            <div class="team-header">
                <h3>${t.name}</h3>
                ${scoreHtml}
            </div>
            <ul class="team-members">
                ${membersHtml}
            </ul>
        `;
        grid.appendChild(card);
    });
}

window.onload = init;