// --- main.js (Versión FINAL: UI Completa + Corrección de Persistencia al Apagar) ---

import { createSpeechRecognition, isSpeechRecognitionSupported } from './core/speechRecognitionFactory.js';
import { RecognitionModeManager } from './core/recognitionModeManager.js';
import { SpeechSynthesisService } from './core/speechSynthesisService.js';

// Variables globales
let modeManager;
let speechService;
let voiceStatusIcon;
let listeningMode;

// Variables de Control de Flujo (Temporizadores)
let inactivityTimer = null;
let interactionState = 'NORMAL'; // Estados: 'NORMAL', 'CONFIRMATION'
const TIMEOUT_DURATION = 15000; // 15 segundos

// Variables para control de errores de red
let networkRetryCount = 0;
const MAX_NETWORK_RETRIES = 3;

/**
 * =======================================================
 * CONFIGURACIÓN VISUAL Y LIMPIEZA
 * =======================================================
 */
(function () {
    const theme = localStorage.getItem('theme') || 'dark';
    const html = document.documentElement;
    html.classList.remove('dark', 'light', 'high-contrast');
    if (theme !== 'light') html.classList.add(theme);
})();

(function () {
    const sizeMap = ['85%', '92.5%', '100%', '107.5%', '115%'];
    const savedSizeIndex = localStorage.getItem('fontSize') || '2';
    document.documentElement.style.fontSize = sizeMap[parseInt(savedSizeIndex, 10)] || '100%';
})();

window.addEventListener('beforeunload', () => {
    clearInactivityTimer();
    const alarmSound = document.getElementById('alarm-sound');
    if (alarmSound) { alarmSound.pause(); alarmSound.currentTime = 0; }
    const silentLoop = document.getElementById('silent-loop');
    if (silentLoop) silentLoop.pause();
    if (speechService) speechService.stop();
    if (modeManager) modeManager.stop({ manual: true });
});

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Priming de Audio ---
    const alarmSoundForPriming = document.getElementById('alarm-sound');
    const silentLoopSound = document.getElementById('silent-loop');

    function primeAllAudio() {
        if (sessionStorage.getItem('isAudioPrimed') === 'true' || !alarmSoundForPriming) return Promise.resolve(true);
        alarmSoundForPriming.muted = true;
        const alarmPromise = alarmSoundForPriming.play();
        let loopPromise = Promise.resolve();
        if (silentLoopSound) { silentLoopSound.muted = false; silentLoopSound.volume = 0; loopPromise = silentLoopSound.play(); }
        const speechPromise = new Promise((resolve) => {
            if (!window.speechSynthesis) return resolve();
            const utterance = new SpeechSynthesisUtterance("init");
            utterance.volume = 0; utterance.onend = () => resolve(); utterance.onerror = () => resolve();
            window.speechSynthesis.speak(utterance);
        });
        return new Promise((resolve) => {
            Promise.all([alarmPromise, loopPromise, speechPromise]).then(() => {
                alarmSoundForPriming.pause(); alarmSoundForPriming.currentTime = 0; alarmSoundForPriming.muted = false;
                if (silentLoopSound) silentLoopSound.volume = 0;
                window.speechSynthesis.cancel();
                sessionStorage.setItem('isAudioPrimed', 'true');
                resolve(true);
            }).catch(() => {
                alarmSoundForPriming.pause(); alarmSoundForPriming.muted = false;
                if (silentLoopSound) silentLoopSound.pause();
                window.speechSynthesis.cancel();
                resolve(false);
            });
        });
    }

    // --- 2. SISTEMA DE VOZ ---
    voiceStatusIcon = document.getElementById('voice-status-icon');

    if (document.getElementById('contenedor-recordatorios')) {

        if (isSpeechRecognitionSupported()) {
            speechService = new SpeechSynthesisService({ lang: 'es-ES' });
            const recognition = createSpeechRecognition({ lang: 'es-ES', continuous: true, interimResults: false });
            modeManager = new RecognitionModeManager(recognition);

            // --- Configuración del Modo de Escucha ---
            listeningMode = {
                name: 'listening',
                continuous: true,
                interimResults: false,

                onStart: () => {
                    if (voiceStatusIcon) {
                        voiceStatusIcon.classList.remove('hidden');
                        voiceStatusIcon.querySelector('span').textContent = 'record_voice_over';
                    }
                    console.log("🎙️ Escuchando...");

                    // Solo iniciamos el timer si NO existe uno ya
                    if (!inactivityTimer) {
                        startInactivityTimer();
                    } else {
                        console.log("⏳ Timer continúa activo...");
                    }
                },

                onExit: () => {
                    if (voiceStatusIcon) voiceStatusIcon.querySelector('span').textContent = 'mic_off';
                    console.log("⏸️ Pausa técnica.");
                    // NO limpiamos el timer aquí
                },

                onResult: (event) => {
                    // ¡Usuario habló! Limpiamos el timer inmediatamente.
                    clearInactivityTimer();
                    networkRetryCount = 0;

                    let finalTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
                    }

                    const command = finalTranscript.toLowerCase().trim();
                    if (command) {
                        console.log("🗣️ Comando detectado:", command);
                        if (interactionState === 'CONFIRMATION') {
                            procesarConfirmacion(command);
                        } else {
                            procesarComando(command);
                        }
                    } else {
                        // Si fue solo ruido, reiniciamos el reloj desde cero
                        startInactivityTimer();
                    }
                },

                onError: (event) => {
                    // Si es silencio (no-speech), NO matamos el timer.
                    if (event.error === 'no-speech') {
                        console.log("🤫 Silencio detectado... el timer sigue corriendo.");
                        return;
                    }

                    // Para otros errores reales, sí limpiamos
                    clearInactivityTimer();

                    if (event.error === 'network') {
                        networkRetryCount++;
                        console.warn(`⚠️ Error red (${networkRetryCount}/3).`);
                        modeManager.stop({ manual: true });
                        if (networkRetryCount < MAX_NETWORK_RETRIES) {
                            setTimeout(() => {
                                if (localStorage.getItem('voiceHelp') === 'true') modeManager.start(listeningMode);
                            }, 4000);
                        } else {
                            alert("Error de conexión. Voz desactivada.");
                            if (voiceStatusIcon) voiceStatusIcon.classList.add('hidden');
                        }
                    } else if (event.error === 'not-allowed') {
                        modeManager.stop({ manual: true });
                        alert("Micrófono bloqueado.");
                    }
                }
            };

            // --- Lógica de Bienvenida ---
            const preferenciaVoz = localStorage.getItem('voiceHelp');
            const modalBienvenida = document.getElementById('voice-prompt-modal');
            const textoBienvenida = "Bienvenido. Puede decir 'ajustes' para abrir los ajustes, o 'agregar recordatorio'.";

            if (preferenciaVoz === 'true') {
                if (voiceStatusIcon) voiceStatusIcon.classList.remove('hidden');
                setTimeout(() => {
                    interactionState = 'NORMAL';
                    speechService.speak(textoBienvenida, () => {
                        modeManager.start(listeningMode);
                    });
                }, 500);

            } else if (preferenciaVoz === 'false') {
                document.addEventListener('click', primeAllAudio, { once: true });

            } else if (modalBienvenida) {
                modalBienvenida.classList.remove('hidden');
                document.getElementById('btn-voice-activate').addEventListener('click', async () => {
                    modalBienvenida.classList.add('hidden');
                    const ok = await primeAllAudio();
                    if (ok) {
                        localStorage.setItem('voiceHelp', 'true');
                        if (voiceStatusIcon) voiceStatusIcon.classList.remove('hidden');
                        interactionState = 'NORMAL';
                        speechService.speak("Ayuda activada. " + textoBienvenida, () => {
                            modeManager.start(listeningMode);
                        });
                    } else {
                        localStorage.setItem('voiceHelp', 'false');
                    }
                });
                document.getElementById('btn-voice-deactivate').addEventListener('click', async () => {
                    modalBienvenida.classList.add('hidden');
                    await primeAllAudio();
                    localStorage.setItem('voiceHelp', 'false');
                });
            }
        }
    }

    // Inicializaciones extra
    try {
        const pending = localStorage.getItem('pendingAlarm');
        if (pending) {
            const rec = JSON.parse(pending); localStorage.removeItem('pendingAlarm'); setTimeout(() => showAlarm(rec), 100);
        }
    } catch (e) { }

    initAlarmSlider();

    const contenedorRecordatorios = document.getElementById('contenedor-recordatorios');
    if (contenedorRecordatorios) {
        mostrarRecordatoriosIndex(contenedorRecordatorios);
        contenedorRecordatorios.addEventListener('click', (e) => {
            const btnDel = e.target.closest('.btn-borrar-menu');
            if (btnDel) { e.preventDefault(); borrarRecordatorio(btnDel.dataset.id); }
        });
    }

    const btnBack = document.getElementById('btn-back');
    if (btnBack) setupProfilePage(btnBack);

    const timeBtn = document.getElementById('btn-time-picker');
    if (timeBtn) timeBtn.addEventListener('click', () => {
        try { document.getElementById('med-time').showPicker(); } catch (e) { document.getElementById('med-time').focus(); }
    });

    if (voiceStatusIcon) {
        voiceStatusIcon.addEventListener('click', () => {
            primeAllAudio().then(() => { if (modeManager) modeManager.start(listeningMode); });
        });
    }
});


// =======================================================
// SECCIÓN: TEMPORIZADOR Y LÓGICA DE CONFIRMACIÓN
// =======================================================

function startInactivityTimer() {
    clearInactivityTimer();
    console.log(`🟨 Timer iniciado (${TIMEOUT_DURATION / 1000}s)...`);
    inactivityTimer = setTimeout(() => {
        handleInactivityTimeout();
    }, TIMEOUT_DURATION);
}

function clearInactivityTimer() {
    if (inactivityTimer) {
        console.log("🟨 Timer detenido/limpiado.");
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }
}

function handleInactivityTimeout() {
    console.log("⏰ ¡TIEMPO AGOTADO!");
    inactivityTimer = null;
    modeManager.stop({ manual: true });

    if (interactionState === 'NORMAL') {
        console.log("❓ Preguntando: ¿Sigues ahí?");
        interactionState = 'CONFIRMATION';
        speechService.speak("¿Sigues ahí?", () => {
            modeManager.start(listeningMode);
        });
    } else if (interactionState === 'CONFIRMATION') {
        console.log("💤 Sin respuesta a confirmación. Apagando.");
        interactionState = 'NORMAL';

        // --- AQUÍ ESTÁ LA CORRECCIÓN ---
        // Guardamos 'false' en localStorage para que no reviva al recargar
        localStorage.setItem('voiceHelp', 'false');

        speechService.speak("Desactivando narrador.", () => {
            if (voiceStatusIcon) voiceStatusIcon.classList.add('hidden');
        });
    }
}

function procesarConfirmacion(command) {
    const cleanCommand = command.replace(/[.,!¡¿?]/g, '').trim();
    const respuestasPositivas = ['sí', 'si', 'claro', 'aquí', 'aqui', 'estoy', 'hola', 'sigo', 'yep', 'yes'];
    const esPositivo = respuestasPositivas.some(palabra => cleanCommand.includes(palabra));

    if (esPositivo) {
        console.log("✅ Confirmación recibida.");
        interactionState = 'NORMAL';
        modeManager.stop({ manual: true });

        speechService.speak("Entendido. Puede decir 'ajustes' para abrir los ajustes, o 'agregar recordatorio'.", () => {
            modeManager.start(listeningMode);
        });
    } else {
        console.log("❌ Respuesta negativa o desconocida.");

        // --- TAMBIÉN AQUÍ ---
        localStorage.setItem('voiceHelp', 'false');

        modeManager.stop({ manual: true });
        speechService.speak("Entendido, hasta luego.", () => {
            if (voiceStatusIcon) voiceStatusIcon.classList.add('hidden');
        });
    }
}


// =======================================================
// SECCIÓN: PROCESAMIENTO DE COMANDOS
// =======================================================

function procesarComando(command) {
    if (!modeManager || !speechService) return;
    interactionState = 'NORMAL';

    if (command.includes('agregar')) {
        modeManager.stop({ manual: true });
        speechService.speak("Abriendo agregar.", () => window.location.href = 'agregar.html');
    } else if (command.includes('ajustes') || command.includes('perfil')) {
        modeManager.stop({ manual: true });
        speechService.speak("Abriendo ajustes.", () => window.location.href = 'perfil.html');
    } else if (command.includes('escuchar') || command.includes('recordatorios')) {
        modeManager.stop({ manual: true });
        const texto = obtenerTextoRecordatorios();
        speechService.speak(texto, () => {
            speechService.speak("¿Algo más?", () => {
                modeManager.start(listeningMode);
            });
        });
    } else {
        modeManager.stop({ manual: true });
        speechService.speak("No entendí. Intenta de nuevo.", () => {
            modeManager.start(listeningMode);
        });
    }
}

function obtenerTextoRecordatorios() {
    const r = JSON.parse(localStorage.getItem('recordatorios')) || [];
    const act = r.filter(x => !x.completado);
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
    const finHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59).getTime();
    const hoy = act.filter(x => x.proximaDosis >= inicioHoy && x.proximaDosis <= finHoy);

    if (hoy.length === 0) return "No tienes recordatorios pendientes para hoy.";
    let texto = `Tienes ${hoy.length} recordatorios para hoy. `;
    hoy.forEach(med => {
        const hora = new Date(med.proximaDosis).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        texto += `${med.nombre} a las ${hora}. `;
    });
    return texto;
}

// --- HELPERS UI ---
const botonAgregar = document.getElementById('btn-agregar');
if (botonAgregar) setupAgregarPage();

function setupAgregarPage() {
    const medNameInput = document.getElementById('med-name');
    const medSuggestionsBox = document.getElementById('med-suggestions');
    const medNameContainer = medNameInput.parentElement;
    const medNameButton = medNameContainer.querySelector('button');
    const MEDICAMENTOS_COMUNES = [
        'Aciclovir', 'Ácido acetilsalicílico', 'Ácido clavulánico', 'Ácido fusídico', 'Ácido valproico',
        'Albendazol', 'Alprazolam', 'Amitriptilina', 'Amlodipino', 'Amoxicilina', 'Ampicilina', 'Aripiprazol',
        'Aspirina', 'Atenolol', 'Atorvastatina', 'Azatioprina', 'Azitromicina', 'Betametasona', 'Bupropión',
        'Buspirona', 'Captopril', 'Carbamazepina', 'Cefalexina', 'Ceftriaxona', 'Celecoxib', 'Cetirizina',
        'Ciclosporina', 'Ciprofloxacino', 'Ciprofloxacino oftálmico', 'Cisplatino', 'Citalopram', 'Claritromicina',
        'Clindamicina', 'Clonazepam', 'Clopidogrel', 'Clorfenamina', 'Clotrimazol', 'Clozapina', 'Codeína',
        'Desloratadina', 'Dexametasona', 'Diazepam', 'Diclofenaco', 'Difenhidramina', 'Digoxina', 'Domperidona',
        'Donepezilo', 'Doxorrubicina', 'Doxiciclina', 'Duloxetina', 'Dutasterida', 'Empagliflozina', 'Enalapril',
        'Eritromicina', 'Escitalopram', 'Esomeprazol', 'Espironolactona', 'Estradiol', 'Etoricoxib', 'Famotidina',
        'Fenitoína', 'Fexofenadina', 'Finasterida', 'Fluconazol', 'Fluoxetina', 'Furosemida', 'Gabapentina',
        'Gentamicina', 'Glibenclamida', 'Haloperidol', 'Heparina', 'Hidroclorotiazida', 'Hidrocodona',
        'Hidrocortisona', 'Hidroxicina', 'Ibuprofeno', 'Indometacina', 'Insulina', 'Isoniazida', 'Itraconazol',
        'Ivermectina', 'Ketoconazol', 'Ketorolaco', 'Lamivudina', 'Lamotrigina', 'Lansoprazol', 'Latanoprost',
        'Levetiracetam', 'Levocetirizina', 'Levofloxacino', 'Levotiroxina', 'Loperamida', 'Lorazepam',
        'Loratadina', 'Losartán', 'Mebendazol', 'Meloxicam', 'Metamizol', 'Metformina', 'Metilprednisolona',
        'Metoclopramida', 'Metoprolol', 'Metotrexato', 'Metronidazol', 'Miconazol', 'Midazolam', 'Mirtazapina',
        'Morfina', 'Naproxeno', 'Neomicina', 'Nifedipino', 'Nistatina', 'Nitazoxanida', 'Olanzapina', 'Omeprazol',
        'Ondansetrón', 'Oseltamivir', 'Oxicodona', 'Pantoprazol', 'Paracetamol', 'Paroxetina', 'Penicilina G / V',
        'Permetrina', 'Pioglitazona', 'Piroxicam', 'Praziquantel', 'Prednisona', 'Pregabalina', 'Propranolol',
        'Quetiapina', 'Ramipril', 'Ranitidina', 'Remdesivir', 'Rifampicina', 'Risperidona', 'Rosuvastatina',
        'Salbutamol', 'Sales de rehidratación oral', 'Sertralina', 'Sildenafil', 'Simvastatina', 'Sitagliptina',
        'Sucralfato', 'Sulindaco', 'Tacrolimus', 'Tadalafilo', 'Tamoxifeno', 'Tamsulosina', 'Tenofovir',
        'Testosterona', 'Timolol', 'Tobramicina', 'Tramadol', 'Valaciclovir', 'Vancomicina', 'Venlafaxina',
        'Warfarina', 'Zanamivir', 'Zidovudina', 'Zolpidem'
    ];
    function showSuggestions() { medNameContainer.classList.remove('rounded-xl'); medNameContainer.classList.add('rounded-t-xl'); medNameInput.classList.remove('rounded-l-xl'); medNameInput.classList.add('rounded-tl-xl'); medNameButton.classList.remove('rounded-r-xl'); medNameButton.classList.add('rounded-tr-xl'); medSuggestionsBox.classList.remove('hidden'); }
    function hideSuggestions() { medNameContainer.classList.remove('rounded-t-xl'); medNameContainer.classList.add('rounded-xl'); medNameInput.classList.remove('rounded-tl-xl'); medNameInput.classList.add('rounded-l-xl'); medNameButton.classList.remove('rounded-tr-xl'); medNameButton.classList.add('rounded-r-xl'); medSuggestionsBox.classList.add('hidden'); }

    medNameInput.addEventListener('input', () => {
        const inputText = medNameInput.value.toLowerCase().trim();
        medSuggestionsBox.innerHTML = '';
        if (inputText.length === 0) { hideSuggestions(); return; }
        const suggestions = MEDICAMENTOS_COMUNES.filter(med => med.toLowerCase().startsWith(inputText));
        if (suggestions.length === 0) { hideSuggestions(); return; }
        suggestions.forEach(med => {
            const el = document.createElement('div'); el.className = 'p-4 text-white text-lg bg-gray-900 border-b border-gray-700 last:border-b-0 hover:bg-surface-dark cursor-pointer'; el.textContent = med; el.dataset.name = med; medSuggestionsBox.appendChild(el);
        });
        showSuggestions();
    });
    medSuggestionsBox.addEventListener('click', (event) => { const clicked = event.target.closest('[data-name]'); if (clicked) { medNameInput.value = clicked.dataset.name; medSuggestionsBox.innerHTML = ''; hideSuggestions(); medNameInput.focus(); } });
    medNameInput.addEventListener('blur', () => setTimeout(hideSuggestions, 150));
    botonAgregar.addEventListener('click', async () => {
        const nombre = document.getElementById('med-name').value; const frecuencia = document.getElementById('med-frequency').value; const fecha = document.getElementById('med-date').value; const hora = document.getElementById('med-time').value;
        if (!nombre || !fecha || !hora) { alert("Faltan datos"); return; }
        let records = JSON.parse(localStorage.getItem('recordatorios')) || [];
        const partesFecha = fecha.split('-').map(Number); const partesHora = hora.split(':').map(Number);
        const fechaObj = new Date(); fechaObj.setFullYear(partesFecha[0], partesFecha[1] - 1, partesFecha[2]); fechaObj.setHours(partesHora[0], partesHora[1], 0, 0);
        let prox = fechaObj.getTime(); if (prox <= Date.now()) prox += (parseInt(frecuencia) * 60000);
        records.push({ id: Date.now(), nombre: nombre, dosis: document.getElementById('med-dose').value, frecuencia: parseInt(frecuencia), proximaDosis: prox, completado: false });
        localStorage.setItem('recordatorios', JSON.stringify(records)); window.location.href = "index.html";
    });
}

// =======================================================
// LÓGICA DE PERFIL (RESTAURADA Y COMPLETA)
// =======================================================
function setupProfilePage(btnBack) {
    let initialState = {}; let currentState = {};

    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalBtnSave = document.getElementById('modal-btn-save');
    const modalBtnDiscard = document.getElementById('modal-btn-discard');

    // Botones de Tema
    const lightBtn = document.getElementById('btn-theme-light');
    const darkBtn = document.getElementById('btn-theme-dark');
    const contrastBtn = document.getElementById('btn-theme-contrast');
    const themeButtons = [lightBtn, darkBtn, contrastBtn];
    const inactiveClasses = 'border-slate-700';
    const activeClasses = 'border-primary bg-primary/10';

    // Elementos de Datos
    const fontSizeSlider = document.getElementById('fontSize');
    const sizeMap = ['85%', '92.5%', '100%', '107.5%', '115%'];
    const inputFullName = document.getElementById('fullName');
    const inputEmail = document.getElementById('email');
    const headerName = document.getElementById('header-name');
    const headerEmail = document.getElementById('header-email');
    const volumeSlider = document.getElementById('volumeSlider');
    const voiceToggle = document.getElementById('voice-toggle');

    function loadInitialState() {
        initialState = {
            theme: localStorage.getItem('theme') || 'dark',
            fontSize: localStorage.getItem('fontSize') || '2',
            name: localStorage.getItem('profileName') || 'Carlos Pérez',
            email: localStorage.getItem('profileEmail') || 'carlos.perez@ejemplo.com',
            volume: localStorage.getItem('profileVolume') || '75',
            voice: localStorage.getItem('voiceHelp') === 'true'
        };
        currentState = { ...initialState };
    }

    function loadUiFromState(state) {
        // Tema
        document.documentElement.classList.remove('dark', 'light', 'high-contrast');
        if (state.theme !== 'light') document.documentElement.classList.add(state.theme);
        updateButtonState(state.theme);

        // Fuente
        document.documentElement.style.fontSize = sizeMap[state.fontSize];
        if (fontSizeSlider) fontSizeSlider.value = state.fontSize;

        // Datos
        if (inputFullName) inputFullName.value = state.name;
        if (inputEmail) inputEmail.value = state.email;
        if (headerName) headerName.textContent = state.name;
        if (headerEmail) headerEmail.textContent = state.email;
        if (volumeSlider) volumeSlider.value = state.volume;

        // Toggle Voz
        if (voiceToggle) {
            const voiceToggleSpan = voiceToggle.querySelector('span');
            voiceToggle.setAttribute('aria-checked', state.voice);
            if (state.voice) {
                voiceToggleSpan.classList.add('translate-x-6');
                voiceToggle.classList.add('bg-primary');
            } else {
                voiceToggleSpan.classList.remove('translate-x-6');
                voiceToggle.classList.remove('bg-primary');
            }
        }
    }

    function saveCurrentState() {
        localStorage.setItem('theme', currentState.theme);
        localStorage.setItem('fontSize', currentState.fontSize);
        localStorage.setItem('profileName', currentState.name);
        localStorage.setItem('profileEmail', currentState.email);
        localStorage.setItem('profileVolume', currentState.volume);
        localStorage.setItem('voiceHelp', currentState.voice);
        initialState = { ...currentState };
    }

    function updateButtonState(currentTheme) {
        if (!lightBtn) return;
        const activeClassesArray = activeClasses.split(' ');
        themeButtons.forEach(btn => {
            btn.classList.remove(...activeClassesArray);
            btn.classList.add(inactiveClasses);
        });
        if (currentTheme === 'light') { lightBtn.classList.add(...activeClassesArray); lightBtn.classList.remove(inactiveClasses); }
        else if (currentTheme === 'dark') { darkBtn.classList.add(...activeClassesArray); darkBtn.classList.remove(inactiveClasses); }
        else if (currentTheme === 'high-contrast') { contrastBtn.classList.add(...activeClassesArray); contrastBtn.classList.remove(inactiveClasses); }
    }

    // Inicializar
    loadInitialState();
    loadUiFromState(initialState);

    // Listeners
    if (lightBtn) lightBtn.addEventListener('click', () => { currentState.theme = 'light'; loadUiFromState(currentState); });
    if (darkBtn) darkBtn.addEventListener('click', () => { currentState.theme = 'dark'; loadUiFromState(currentState); });
    if (contrastBtn) contrastBtn.addEventListener('click', () => { currentState.theme = 'high-contrast'; loadUiFromState(currentState); });
    if (fontSizeSlider) fontSizeSlider.addEventListener('input', () => { currentState.fontSize = fontSizeSlider.value; document.documentElement.style.fontSize = sizeMap[fontSizeSlider.value]; });
    if (inputFullName) inputFullName.addEventListener('input', () => { currentState.name = inputFullName.value; headerName.textContent = inputFullName.value; });
    if (inputEmail) inputEmail.addEventListener('input', () => { currentState.email = inputEmail.value; headerEmail.textContent = inputEmail.value; });
    if (volumeSlider) volumeSlider.addEventListener('input', () => { currentState.volume = volumeSlider.value; });
    if (voiceToggle) voiceToggle.addEventListener('click', () => { currentState.voice = !currentState.voice; loadUiFromState(currentState); });

    btnBack.addEventListener('click', (event) => {
        const hasChanges =
            initialState.theme !== currentState.theme ||
            initialState.fontSize !== currentState.fontSize ||
            initialState.name !== currentState.name ||
            initialState.email !== currentState.email ||
            initialState.volume !== currentState.volume ||
            initialState.voice !== currentState.voice;

        if (hasChanges) {
            event.preventDefault();
            modalBackdrop.classList.remove('hidden');
        }
    });

    if (modalBtnSave) modalBtnSave.addEventListener('click', () => { saveCurrentState(); modalBackdrop.classList.add('hidden'); window.location.href = btnBack.href; });
    if (modalBtnDiscard) modalBtnDiscard.addEventListener('click', () => { loadUiFromState(initialState); currentState = { ...initialState }; modalBackdrop.classList.add('hidden'); });
}

// =======================================================
// LÓGICA DE ALARMA Y RENDERIZADO (RESTAURADA)
// =======================================================
function revisarRecordatorios() {
    const ahora = Date.now(); const alarmModal = document.getElementById('alarm-modal'); if (!alarmModal || !alarmModal.classList.contains('hidden')) return;
    let records = JSON.parse(localStorage.getItem('recordatorios')) || []; let changed = false;
    records.forEach(r => {
        if (r.completado) return; if (r.fechaFin && r.proximaDosis > r.fechaFin) { r.completado = true; changed = true; return; }
        if (r.proximaDosis <= ahora && (ahora - r.proximaDosis) < 1000) {
            if (document.hidden) { localStorage.setItem('pendingAlarm', JSON.stringify(r)); new Notification(`¡Hora de medicina!`, { body: r.nombre, tag: `med-${r.id}` }); }
            else { showAlarm(r); }
            r.proximaDosis += (r.frecuencia * 60000); changed = true;
        }
    });
    if (changed) localStorage.setItem('recordatorios', JSON.stringify(records));
}
setInterval(() => { revisarRecordatorios(); const cont = document.getElementById('contenedor-recordatorios'); if (cont) mostrarRecordatoriosIndex(cont); }, 1000);

function mostrarRecordatoriosIndex(contenedor) {
    const records = JSON.parse(localStorage.getItem('recordatorios')) || []; contenedor.innerHTML = '';
    const active = records.filter(r => !r.completado);
    if (active.length === 0) { contenedor.innerHTML = `<div class="rounded-xl bg-card-dark p-5 text-center"><p class="text-xl text-zinc-400">No tienes recordatorios.</p></div>`; return; }
    active.sort((a, b) => a.proximaDosis - b.proximaDosis);
    let html = `<h2 class="text-3xl font-bold text-white pt-6">Próximos</h2>`;
    active.forEach(r => html += crearTarjetaRecordatorio(r)); contenedor.innerHTML = html;
}

function crearTarjetaRecordatorio(r) {
    const date = new Date(r.proximaDosis).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); const color = r.frecuencia === 1 ? 'bg-warning' : 'bg-primary';
    return `<div class="flex rounded-xl bg-card-dark overflow-hidden mb-4"><div class="w-1.5 ${color}"></div><div class="flex-1 p-6"><p class="text-4xl font-bold text-white">${date}</p><p class="text-2xl text-zinc-200">${r.nombre}</p><div class="flex gap-4 mt-4"><button class="btn-borrar-menu flex-1 rounded-lg border border-zinc-600 py-3 text-red-400 font-bold" data-id="${r.id}">Eliminar</button></div></div></div>`;
}

function borrarRecordatorio(id) {
    if (!confirm("¿Borrar?")) return; let r = JSON.parse(localStorage.getItem('recordatorios')) || []; r = r.filter(x => x.id != id); localStorage.setItem('recordatorios', JSON.stringify(r)); const c = document.getElementById('contenedor-recordatorios'); if (c) mostrarRecordatoriosIndex(c);
}

let alarmModal, alarmSound;
function showAlarm(r) {
    alarmModal = document.getElementById('alarm-modal'); alarmSound = document.getElementById('alarm-sound');
    if (alarmModal) { document.getElementById('alarm-name').textContent = r.nombre; document.getElementById('alarm-time').textContent = new Date(r.proximaDosis).toLocaleTimeString(); alarmModal.classList.remove('hidden'); try { alarmSound.play(); } catch (e) { } }
}

// Slider Restaurado con Física de Arrastre
function initAlarmSlider() {
    const track = document.getElementById('slider-track');
    const thumb = document.getElementById('slider-thumb');
    const text = document.getElementById('slider-text');
    if (!track || !thumb) return;

    let isDragging = false;
    let startX = 0;
    let maxDragX = 0;

    function onDragStart(e) {
        e.preventDefault();
        isDragging = true;
        startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        thumb.style.transition = 'none';
        maxDragX = track.offsetWidth - thumb.offsetWidth - 4;
    }

    function onDragMove(e) {
        if (!isDragging) return;
        const currentX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        let deltaX = currentX - startX;
        if (deltaX < 0) deltaX = 0;
        if (deltaX > maxDragX) deltaX = maxDragX;
        thumb.style.transform = `translateX(${deltaX}px)`;
        text.style.opacity = Math.max(0, 1 - (deltaX / (maxDragX / 2)));
    }

    function onDragEnd(e) {
        if (!isDragging) return;
        isDragging = false;
        const currentTransform = thumb.style.transform;
        const currentX = parseFloat(currentTransform.replace('translateX(', '').replace('px)', '')) || 0;

        if (currentX > maxDragX * 0.8) {
            document.getElementById('alarm-modal').classList.add('hidden');
            const s = document.getElementById('alarm-sound');
            if (s) { s.pause(); s.currentTime = 0; }
            setTimeout(() => {
                thumb.style.transform = `translateX(0px)`;
                text.style.opacity = '1';
            }, 300);
        } else {
            thumb.style.transition = 'transform 0.3s ease';
            thumb.style.transform = `translateX(0px)`;
            text.style.opacity = '1';
        }
    }

    thumb.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
    thumb.addEventListener('touchstart', onDragStart, { passive: false });
    document.addEventListener('touchmove', onDragMove);
    document.addEventListener('touchend', onDragEnd);
}