// js/ui/perfilUI.js
import { aplicarVolumen } from '../logic/audioLogic.js';

export function setupProfilePage(speechService, modeManager, anunciarOpcionesInicioCallback) {
    const btnBack = document.getElementById('btn-back-perfil');
    if (!btnBack) return;

    const btnOpenSettings = document.querySelector('button[onclick*="vista-perfil"]');
    if (btnOpenSettings) {
        btnOpenSettings.addEventListener('click', () => {
            loadInitialState();
            applyUi(currentState);
        });
    }

    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalBtnSave = document.getElementById('modal-btn-save');
    const modalBtnDiscard = document.getElementById('modal-btn-discard');

    const inputFullName = document.getElementById('fullName');
    const headerName = document.getElementById('header-name');
    const fontSizeSlider = document.getElementById('fontSize');
    const volumeSlider = document.getElementById('volumeSlider');
    const voiceToggle = document.getElementById('voice-toggle');
    const btnLight = document.getElementById('btn-theme-light');
    const btnDark = document.getElementById('btn-theme-dark');
    const btnContrast = document.getElementById('btn-theme-contrast');
    const voiceStatusIcon = document.getElementById('voice-status-icon');

    let initialState = {};
    let currentState = {};
    const sizeMap = ['85%', '92.5%', '100%', '107.5%', '115%'];
    const classActive = ['border-primary', 'bg-primary/10'];
    const classInactive = ['border-slate-700'];

    function loadInitialState() {
        initialState = {
            theme: localStorage.getItem('theme') || 'dark',
            fontSize: localStorage.getItem('fontSize') || '2',
            name: localStorage.getItem('profileName') || 'Usuario',
            volume: localStorage.getItem('profileVolume') || '100',
            voice: localStorage.getItem('voiceHelp') === 'true'
        };
        currentState = { ...initialState };
    }

    function applyUi(state) {
        document.documentElement.classList.remove('dark', 'light', 'high-contrast');
        if (state.theme !== 'light') document.documentElement.classList.add(state.theme);

        [btnLight, btnDark, btnContrast].forEach(btn => {
            if (btn) { btn.classList.remove(...classActive); btn.classList.add(...classInactive); }
        });
        let activeBtn = state.theme === 'light' ? btnLight : (state.theme === 'high-contrast' ? btnContrast : btnDark);
        if (activeBtn) { activeBtn.classList.remove(...classInactive); activeBtn.classList.add(...classActive); }

        document.documentElement.style.fontSize = sizeMap[state.fontSize] || '100%';
        if (fontSizeSlider) fontSizeSlider.value = state.fontSize;

        if (inputFullName) inputFullName.value = state.name;
        if (headerName) headerName.textContent = state.name;

        if (volumeSlider) volumeSlider.value = state.volume;
        aplicarVolumen(state.volume);

        if (voiceToggle) {
            const span = voiceToggle.querySelector('span');
            voiceToggle.setAttribute('aria-checked', state.voice);
            if (state.voice) {
                span.classList.add('translate-x-6'); voiceToggle.classList.add('bg-primary');
            } else {
                span.classList.remove('translate-x-6'); voiceToggle.classList.remove('bg-primary');
            }
        }
    }

    // Listeners
    if (btnLight) btnLight.onclick = () => { currentState.theme = 'light'; applyUi(currentState); };
    if (btnDark) btnDark.onclick = () => { currentState.theme = 'dark'; applyUi(currentState); };
    if (btnContrast) btnContrast.onclick = () => { currentState.theme = 'high-contrast'; applyUi(currentState); };
    if (fontSizeSlider) fontSizeSlider.addEventListener('input', () => {
        currentState.fontSize = fontSizeSlider.value;
        document.documentElement.style.fontSize = sizeMap[currentState.fontSize];
    });
    if (inputFullName) inputFullName.addEventListener('input', () => {
        currentState.name = inputFullName.value;
        headerName.textContent = inputFullName.value;
    });
    if (volumeSlider) volumeSlider.addEventListener('input', () => {
        currentState.volume = volumeSlider.value;
        aplicarVolumen(currentState.volume);
    });
    if (voiceToggle) voiceToggle.addEventListener('click', () => {
        currentState.voice = !currentState.voice;
        applyUi(currentState);
    });

    btnBack.onclick = (e) => {
        const changed = JSON.stringify(initialState) !== JSON.stringify(currentState);
        if (changed) {
            e.preventDefault(); e.stopPropagation();
            modalBackdrop.classList.remove('hidden');
        } else {
            if (window.navegarA) window.navegarA('vista-inicio');
        }
    };

    modalBtnSave.onclick = () => {
        localStorage.setItem('theme', currentState.theme);
        localStorage.setItem('fontSize', currentState.fontSize);
        localStorage.setItem('profileName', currentState.name);
        localStorage.setItem('profileVolume', currentState.volume);
        localStorage.setItem('voiceHelp', currentState.voice.toString());

        if (voiceStatusIcon) {
            if (currentState.voice) {
                voiceStatusIcon.classList.remove('hidden');
                if (modeManager && !modeManager.isRunning()) {
                    if (anunciarOpcionesInicioCallback) anunciarOpcionesInicioCallback();
                }
            } else {
                voiceStatusIcon.classList.add('hidden');
                if (modeManager) modeManager.stop({ manual: true });
                // Parar audio inmediatamente si se desactiva
                if (speechService) speechService.stop();
            }
        }

        initialState = { ...currentState };
        modalBackdrop.classList.add('hidden');
        if (window.navegarA) window.navegarA('vista-inicio');
    };

    modalBtnDiscard.onclick = () => {
        currentState = { ...initialState };
        applyUi(currentState);

        if (voiceStatusIcon) {
            if (initialState.voice) voiceStatusIcon.classList.remove('hidden');
            else voiceStatusIcon.classList.add('hidden');
        }

        modalBackdrop.classList.add('hidden');
        if (window.navegarA) window.navegarA('vista-inicio');
    };

    loadInitialState();
    applyUi(initialState);
}