// --- main.js (Versión FINAL SPA: Lógica Restaurada y Sincronizada) ---

import { createSpeechRecognition, isSpeechRecognitionSupported } from './core/speechRecognitionFactory.js';
import { RecognitionModeManager } from './core/recognitionModeManager.js';
import { SpeechSynthesisService } from './core/speechSynthesisService.js';
import { MedicationFormAssistant } from './core/medicationFormAssistant.js';

// --- Variables Globales ---
let modeManager;
let speechService;
let voiceStatusIcon;
let listeningMode;
let formAssistant;

// Control de Flujo
let inactivityTimer = null;
let interactionState = 'NORMAL';
const TIMEOUT_DURATION = 15000;

// Control de Errores de Red
let networkRetryCount = 0;
const MAX_NETWORK_RETRIES = 3;

/**
 * =======================================================
 * 1. INICIALIZACIÓN GLOBAL (DOMContentLoaded)
 * =======================================================
 */
document.addEventListener('DOMContentLoaded', () => {

    // A. Inicializar Servicios de Voz
    if (isSpeechRecognitionSupported()) {
        speechService = new SpeechSynthesisService({ lang: 'es-ES' });
        const recognition = createSpeechRecognition({ lang: 'es-ES', continuous: true, interimResults: false });
        modeManager = new RecognitionModeManager(recognition);
        formAssistant = new MedicationFormAssistant(speechService);

        setupVoiceLogic();
    }

    // B. Inicializar UI Global y Eventos
    setupGlobalUi();
    setupProfilePage(); // Configura la lógica de ajustes
    initAlarmSlider();

    // C. Cargar datos iniciales en la lista
    const contenedor = document.getElementById('contenedor-recordatorios');
    if (contenedor) mostrarRecordatoriosIndex(contenedor);

    // D. Aplicar volumen inicial (Máximo por defecto)
    const savedVol = localStorage.getItem('profileVolume') || '100';
    aplicarVolumen(savedVol);

    // E. Alarmas pendientes (Notificaciones background)
    try {
        const pending = localStorage.getItem('pendingAlarm');
        if (pending) {
            const rec = JSON.parse(pending);
            localStorage.removeItem('pendingAlarm');
            setTimeout(() => showAlarm(rec), 500);
        }
    } catch (e) { console.error(e); }

    // F. Loop Principal (Cada segundo)
    setInterval(() => {
        revisarRecordatorios();
        // Solo refrescar UI si estamos en la vista de inicio y visible
        if (!document.hidden && document.getElementById('vista-inicio').classList.contains('hidden') === false) {
            const cont = document.getElementById('contenedor-recordatorios');
            if (cont) mostrarRecordatoriosIndex(cont);
        }
    }, 1000);
});

window.addEventListener('beforeunload', () => {
    clearInactivityTimer();
    stopAllAudio();
    if (modeManager) modeManager.stop({ manual: true });
});

// Helper de navegación Global
window.irA = function (vistaId) {
    if (window.navegarA) window.navegarA(vistaId);
}

/**
 * =======================================================
 * 2. LÓGICA DE UI GLOBAL Y FORMULARIO
 * =======================================================
 */
function setupGlobalUi() {
    voiceStatusIcon = document.getElementById('voice-status-icon');

    // Botones para ir a "Agregar" -> Limpian el formulario
    const btnsAgregarVista = document.querySelectorAll('button[onclick*="vista-agregar"]');
    btnsAgregarVista.forEach(btn => {
        btn.addEventListener('click', () => prepararFormulario(null));
    });

    // Botón Guardar del formulario
    const btnGuardar = document.getElementById('btn-agregar');
    if (btnGuardar) btnGuardar.addEventListener('click', guardarRecordatorio);

    // Time Picker (Icono de reloj)
    const timeBtn = document.getElementById('btn-time-picker');
    if (timeBtn) {
        timeBtn.addEventListener('click', () => {
            try { document.getElementById('med-time').showPicker(); }
            catch (e) { document.getElementById('med-time').focus(); }
        });
    }

    // Acciones en la Lista (Delegación de eventos para botones Editar/Borrar)
    const contenedor = document.getElementById('contenedor-recordatorios');
    if (contenedor) {
        contenedor.addEventListener('click', (e) => {
            const btnDel = e.target.closest('.btn-borrar-menu');
            const btnEdit = e.target.closest('.btn-editar-menu');
            if (btnDel) { e.preventDefault(); e.stopPropagation(); borrarRecordatorio(btnDel.dataset.id); }
            if (btnEdit) { e.preventDefault(); e.stopPropagation(); editarRecordatorio(btnEdit.dataset.id); }
        });
    }
}

function prepararFormulario(editData) {
    // Limpieza inicial
    document.getElementById('med-name').value = '';
    document.getElementById('med-dose').value = '';
    document.getElementById('med-frequency').value = '480';
    document.getElementById('med-date').value = '';
    document.getElementById('med-date-end').value = '';
    document.getElementById('med-time').value = '';

    const btnSpan = document.getElementById('btn-agregar').querySelector('span');

    if (editData) {
        // MODO EDICIÓN
        localStorage.setItem('currentEditId', editData.id);
        document.getElementById('med-name').value = editData.nombre;
        document.getElementById('med-dose').value = editData.dosis || '';
        document.getElementById('med-frequency').value = editData.frecuencia;

        const nextDate = new Date(editData.proximaDosis);
        const yyyy = nextDate.getFullYear();
        const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
        const dd = String(nextDate.getDate()).padStart(2, '0');
        document.getElementById('med-date').value = `${yyyy}-${mm}-${dd}`;

        const hh = String(nextDate.getHours()).padStart(2, '0');
        const min = String(nextDate.getMinutes()).padStart(2, '0');
        document.getElementById('med-time').value = `${hh}:${min}`;

        if (btnSpan) btnSpan.textContent = 'Guardar Cambios';
    } else {
        // MODO NUEVO
        localStorage.removeItem('currentEditId');
        if (btnSpan) btnSpan.textContent = 'Agregar';

        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, '0');
        const dd = String(hoy.getDate()).padStart(2, '0');
        document.getElementById('med-date').value = `${yyyy}-${mm}-${dd}`;
    }
}

function guardarRecordatorio() {
    const nombre = document.getElementById('med-name').value;
    const frecuencia = document.getElementById('med-frequency').value;
    const fecha = document.getElementById('med-date').value;
    const hora = document.getElementById('med-time').value;
    const dosis = document.getElementById('med-dose').value;
    const fechaFin = document.getElementById('med-date-end').value;

    if (!nombre || !fecha || !hora) {
        alert("Por favor completa el nombre, fecha y hora.");
        return;
    }

    let records = JSON.parse(localStorage.getItem('recordatorios')) || [];

    // Calcular timestamp base
    const partesFecha = fecha.split('-').map(Number);
    const partesHora = hora.split(':').map(Number);
    const fechaObj = new Date();
    fechaObj.setFullYear(partesFecha[0], partesFecha[1] - 1, partesFecha[2]);
    fechaObj.setHours(partesHora[0], partesHora[1], 0, 0);

    let prox = fechaObj.getTime();

    // [CORRECCIÓN] Lógica restaurada: Si la fecha ya pasó, sumar frecuencia hasta que sea futuro.
    // Esto evita que la alarma suene inmediatamente si configuras una hora pasada,
    // o peor, que se quede "atascada" en el pasado si el check es muy estricto.
    if (prox <= Date.now()) {
        prox += (parseInt(frecuencia) * 60000);
    }

    const editId = localStorage.getItem('currentEditId');
    const nuevoItem = {
        id: editId ? parseInt(editId) : Date.now(),
        nombre,
        dosis,
        frecuencia: parseInt(frecuencia),
        proximaDosis: prox,
        fechaFin: fechaFin ? new Date(fechaFin).getTime() : null,
        completado: false
    };

    if (editId) {
        const index = records.findIndex(r => r.id == editId);
        if (index !== -1) records[index] = nuevoItem;
        localStorage.removeItem('currentEditId');
    } else {
        records.push(nuevoItem);
    }

    localStorage.setItem('recordatorios', JSON.stringify(records));

    // Actualizar y volver
    const cont = document.getElementById('contenedor-recordatorios');
    if (cont) mostrarRecordatoriosIndex(cont);

    irA('vista-inicio');

    if (speechService && localStorage.getItem('voiceHelp') === 'true') {
        speechService.speak("Recordatorio guardado correctamente.");
    }
}

function editarRecordatorio(id) {
    const records = JSON.parse(localStorage.getItem('recordatorios')) || [];
    const item = records.find(r => r.id == id);
    if (item) {
        prepararFormulario(item);
        irA('vista-agregar');
    }
}

function borrarRecordatorio(id) {
    if (!confirm("¿Seguro que quieres borrar este recordatorio?")) return;
    let r = JSON.parse(localStorage.getItem('recordatorios')) || [];
    r = r.filter(x => x.id != id);
    localStorage.setItem('recordatorios', JSON.stringify(r));
    const cont = document.getElementById('contenedor-recordatorios');
    if (cont) mostrarRecordatoriosIndex(cont);
}

/**
 * =======================================================
 * 3. LÓGICA DE VOZ (BIENVENIDA LARGA)
 * =======================================================
 */

function setupVoiceLogic() {
    listeningMode = {
        name: 'listening',
        continuous: true,
        interimResults: false,
        onStart: () => {
            if (voiceStatusIcon) {
                voiceStatusIcon.classList.remove('hidden');
                voiceStatusIcon.querySelector('span').textContent = 'record_voice_over';
            }
            if (!inactivityTimer) startInactivityTimer();
        },
        onExit: () => {
            if (voiceStatusIcon) voiceStatusIcon.querySelector('span').textContent = 'mic_off';
        },
        onResult: (event) => {
            clearInactivityTimer();
            networkRetryCount = 0;
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
            }
            const command = finalTranscript.toLowerCase().trim();
            if (command) {
                console.log("🗣️ Comando:", command);
                if (interactionState === 'CONFIRMATION') {
                    procesarConfirmacion(command);
                } else {
                    const vistaAgregar = document.getElementById('vista-agregar');
                    if (vistaAgregar && !vistaAgregar.classList.contains('hidden')) {
                        handleFormVoiceInteraction(command);
                    } else {
                        procesarComando(command);
                    }
                }
            } else {
                startInactivityTimer();
            }
        },
        onError: (event) => {
            if (event.error === 'no-speech') return;
            clearInactivityTimer();
            if (event.error === 'network') {
                networkRetryCount++;
                modeManager.stop({ manual: true });
                if (networkRetryCount < MAX_NETWORK_RETRIES) {
                    setTimeout(() => {
                        if (localStorage.getItem('voiceHelp') === 'true') modeManager.start(listeningMode);
                    }, 4000);
                }
            }
        }
    };

    if (voiceStatusIcon) {
        voiceStatusIcon.addEventListener('click', () => {
            const vistaAgregar = document.getElementById('vista-agregar');
            if (vistaAgregar && !vistaAgregar.classList.contains('hidden')) {
                abrirLienzoDeVoz();
            } else {
                primeAllAudio().then(() => { if (modeManager) modeManager.start(listeningMode); });
            }
        });
    }

    checkWelcomeVoice();
    setupDictationOverlay();
    setupAutocompleteSuggestions();
}

function checkWelcomeVoice() {
    const preferenciaVoz = localStorage.getItem('voiceHelp');
    const modalBienvenida = document.getElementById('voice-prompt-modal');

    // [CORRECCIÓN] Mensaje restaurado al texto largo original
    const textoBienvenida = "Bienvenido. Puedes decir: 'ajustes', 'agregar recordatorio' o 'escuchar recordatorios'.";

    if (preferenciaVoz === 'true') {
        if (voiceStatusIcon) voiceStatusIcon.classList.remove('hidden');
        setTimeout(() => {
            interactionState = 'NORMAL';
            if (!document.getElementById('vista-inicio').classList.contains('hidden')) {
                speechService.speak(textoBienvenida, () => { modeManager.start(listeningMode); });
            }
        }, 1000);
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

                // Actualizar UI de toggle si existe en el DOM
                const toggle = document.getElementById('voice-toggle');
                if (toggle) {
                    toggle.setAttribute('aria-checked', 'true');
                    toggle.classList.add('bg-primary');
                    toggle.querySelector('span').classList.add('translate-x-6');
                }

                speechService.speak("Ayuda activada. " + textoBienvenida, () => { modeManager.start(listeningMode); });
            }
        });

        document.getElementById('btn-voice-deactivate').addEventListener('click', () => {
            modalBienvenida.classList.add('hidden');
            primeAllAudio();
            localStorage.setItem('voiceHelp', 'false');
        });
    }
}

function procesarComando(command) {
    if (!modeManager || !speechService) return;
    interactionState = 'NORMAL';
    const cmd = command.toLowerCase();

    if (cmd.includes('agregar') || cmd.includes('añadir')) {
        modeManager.stop({ manual: true });
        speechService.speak("Abriendo pantalla para añadir.", () => {
            prepararFormulario(null);
            irA('vista-agregar');
            setTimeout(abrirLienzoDeVoz, 1000);
        });
    } else if (cmd.includes('ajustes') || cmd.includes('perfil')) {
        modeManager.stop({ manual: true });
        speechService.speak("Abriendo tus ajustes.", () => {
            // Truco: Simular click para forzar refresco de estado
            const btn = document.querySelector('button[onclick*="vista-perfil"]');
            if (btn) btn.click(); else irA('vista-perfil');
        });
    } else if (cmd.includes('escuchar') || cmd.includes('leer')) {
        modeManager.stop({ manual: true });
        const texto = obtenerTextoRecordatorios();
        speechService.speak(texto, () => {
            speechService.speak("¿Deseas algo más?", () => { modeManager.start(listeningMode); });
        });
    }
}

function handleFormVoiceInteraction(command) {
    if (!formAssistant) return;
    if (command.includes('cancelar') || command.includes('volver') || command.includes('atras')) {
        modeManager.stop({ manual: true });
        speechService.speak("Cancelando.", () => irA('vista-inicio'));
        return;
    }
    if (command.includes('guardar')) {
        modeManager.stop({ manual: true });
        document.getElementById('btn-agregar').click();
        return;
    }
    if (command.includes('dictar') || command.includes('escribir')) {
        modeManager.stop({ manual: true });
        abrirLienzoDeVoz();
        return;
    }
}

// =======================================================
// 4. LÓGICA DE PERFIL (SINCRONIZADA AL ENTRAR)
// =======================================================

function setupProfilePage() {
    const btnBack = document.getElementById('btn-back-perfil');
    if (!btnBack) return;

    // [CORRECCIÓN] Listener para refrescar ajustes al entrar
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
            volume: localStorage.getItem('profileVolume') || '100', // Default 100
            voice: localStorage.getItem('voiceHelp') === 'true'
        };
        currentState = { ...initialState };
    }

    function applyUi(state) {
        // Tema
        document.documentElement.classList.remove('dark', 'light', 'high-contrast');
        if (state.theme !== 'light') document.documentElement.classList.add(state.theme);

        // Botones de Tema visuales
        [btnLight, btnDark, btnContrast].forEach(btn => {
            if (btn) { btn.classList.remove(...classActive); btn.classList.add(...classInactive); }
        });
        let activeBtn = state.theme === 'light' ? btnLight : (state.theme === 'high-contrast' ? btnContrast : btnDark);
        if (activeBtn) { activeBtn.classList.remove(...classInactive); activeBtn.classList.add(...classActive); }

        // Fuente
        document.documentElement.style.fontSize = sizeMap[state.fontSize] || '100%';
        if (fontSizeSlider) fontSizeSlider.value = state.fontSize;

        // Datos
        if (inputFullName) inputFullName.value = state.name;
        if (headerName) headerName.textContent = state.name;

        // Volumen
        if (volumeSlider) volumeSlider.value = state.volume;
        aplicarVolumen(state.volume);

        // Toggle Voz
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
            irA('vista-inicio');
        }
    };

    modalBtnSave.onclick = () => {
        localStorage.setItem('theme', currentState.theme);
        localStorage.setItem('fontSize', currentState.fontSize);
        localStorage.setItem('profileName', currentState.name);
        localStorage.setItem('profileVolume', currentState.volume);
        localStorage.setItem('voiceHelp', currentState.voice.toString());

        // Actualizar icono global
        if (voiceStatusIcon) {
            if (currentState.voice) {
                voiceStatusIcon.classList.remove('hidden');
                if (modeManager && !modeManager.isRunning()) modeManager.start(listeningMode);
            } else {
                voiceStatusIcon.classList.add('hidden');
                if (modeManager) modeManager.stop({ manual: true });
            }
        }

        initialState = { ...currentState };
        modalBackdrop.classList.add('hidden');
        irA('vista-inicio');
    };

    modalBtnDiscard.onclick = () => {
        currentState = { ...initialState };
        applyUi(currentState);

        if (voiceStatusIcon) {
            if (initialState.voice) voiceStatusIcon.classList.remove('hidden');
            else voiceStatusIcon.classList.add('hidden');
        }

        modalBackdrop.classList.add('hidden');
        irA('vista-inicio');
    };

    loadInitialState();
    applyUi(initialState);
}

function aplicarVolumen(valor) {
    const audio = document.getElementById('alarm-sound');
    if (audio) {
        audio.volume = parseInt(valor) / 100;
    }
}

// =======================================================
// 5. FUNCIONES DE ALARMA Y HELPERS
// =======================================================

function primeAllAudio() {
    if (sessionStorage.getItem('isAudioPrimed') === 'true') return Promise.resolve(true);
    const alarm = document.getElementById('alarm-sound');
    const silent = document.getElementById('silent-loop');
    if (!alarm) return Promise.resolve(false);

    alarm.muted = true;
    const p1 = alarm.play().then(() => {
        alarm.pause(); alarm.currentTime = 0; alarm.muted = false;
    }).catch(e => console.log("Audio block", e));

    let p2 = Promise.resolve();
    if (silent) {
        silent.muted = false; silent.volume = 0;
        p2 = silent.play();
    }

    return Promise.all([p1, p2]).then(() => {
        sessionStorage.setItem('isAudioPrimed', 'true');
        return true;
    });
}

function stopAllAudio() {
    const alarm = document.getElementById('alarm-sound');
    const silent = document.getElementById('silent-loop');
    if (alarm) { alarm.pause(); alarm.currentTime = 0; }
    if (silent) silent.pause();
}

function showAlarm(r) {
    const alarmModal = document.getElementById('alarm-modal');
    if (!alarmModal) return;

    document.getElementById('alarm-name').textContent = r.nombre;
    document.getElementById('alarm-time').textContent = new Date(r.proximaDosis).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    document.getElementById('alarm-dose').textContent = r.dosis || '';

    alarmModal.classList.remove('hidden');
    const alarmSound = document.getElementById('alarm-sound');
    if (alarmSound) {
        const vol = localStorage.getItem('profileVolume') || '100';
        alarmSound.volume = parseInt(vol) / 100;
        alarmSound.loop = true;
        alarmSound.play().catch(e => console.error(e));
    }
}

function initAlarmSlider() {
    const track = document.getElementById('slider-track');
    const thumb = document.getElementById('slider-thumb');
    const text = document.getElementById('slider-text');
    if (!track || !thumb) return;

    let isDragging = false;
    let startX = 0;
    let maxDragX = 0;

    const endDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        const currentTransform = thumb.style.transform;
        const currentX = parseFloat(currentTransform.replace('translateX(', '').replace('px)', '')) || 0;

        if (currentX > maxDragX * 0.8) {
            document.getElementById('alarm-modal').classList.add('hidden');
            stopAllAudio();
            setTimeout(() => {
                thumb.style.transform = `translateX(0px)`;
                text.style.opacity = '1';
            }, 300);
        } else {
            thumb.style.transition = 'transform 0.3s ease';
            thumb.style.transform = `translateX(0px)`;
            text.style.opacity = '1';
        }
    };

    const startDrag = (e) => {
        isDragging = true;
        startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        thumb.style.transition = 'none';
        maxDragX = track.offsetWidth - thumb.offsetWidth - 4;
    };

    const moveDrag = (e) => {
        if (!isDragging) return;
        const currentX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        let deltaX = currentX - startX;
        if (deltaX < 0) deltaX = 0;
        if (deltaX > maxDragX) deltaX = maxDragX;
        thumb.style.transform = `translateX(${deltaX}px)`;
        text.style.opacity = Math.max(0, 1 - (deltaX / (maxDragX / 2)));
    };

    thumb.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', moveDrag);
    document.addEventListener('touchend', endDrag);
    thumb.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('mouseup', endDrag);
}

function mostrarRecordatoriosIndex(contenedor) {
    const records = JSON.parse(localStorage.getItem('recordatorios')) || [];
    contenedor.innerHTML = '';
    const active = records.filter(r => !r.completado);

    if (active.length === 0) {
        contenedor.innerHTML = `<div class="rounded-xl bg-card-dark p-8 text-center border border-zinc-800"><p class="text-xl text-zinc-500">No hay recordatorios pendientes.<br>¡Añade uno!</p></div>`;
        return;
    }

    active.sort((a, b) => a.proximaDosis - b.proximaDosis);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = todayStart + 86400000;
    const dayAfterStart = tomorrowStart + 86400000;
    let html = '';
    let currentGroup = null;

    active.forEach(r => {
        let group = '';
        if (r.proximaDosis < tomorrowStart) group = 'Hoy';
        else if (r.proximaDosis < dayAfterStart) group = 'Mañana';
        else group = 'Más adelante';

        if (group !== currentGroup) {
            html += `<h2 class="text-2xl font-bold text-white pt-4 pb-2 sticky top-0 bg-background-dark/95 backdrop-blur-sm z-10">${group}</h2>`;
            currentGroup = group;
        }

        const date = new Date(r.proximaDosis).toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true });
        const color = r.frecuencia === 1 ? 'bg-warning' : 'bg-primary';

        html += `
        <div class="flex rounded-xl bg-card-dark overflow-hidden mb-3 border border-white/5 shadow-sm">
            <div class="w-2 ${color}"></div>
            <div class="flex-1 p-5">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="flex items-baseline gap-2">
                            <p class="text-3xl font-bold text-white">${date}</p>
                            ${r.dosis ? `<span class="text-lg text-zinc-400 font-medium">${r.dosis}</span>` : ''}
                        </div>
                        <p class="text-xl text-zinc-200 mt-1">${r.nombre}</p>
                    </div>
                </div>
                <div class="flex gap-3 mt-4">
                    <button class="btn-editar-menu flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 py-2 text-primary font-bold transition-colors hover:bg-zinc-700" data-id="${r.id}">Editar</button>
                    <button class="btn-borrar-menu flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 py-2 text-red-400 font-bold transition-colors hover:bg-zinc-700" data-id="${r.id}">Borrar</button>
                </div>
            </div>
        </div>`;
    });
    contenedor.innerHTML = html;
}

function revisarRecordatorios() {
    const ahora = Date.now();
    const alarmModal = document.getElementById('alarm-modal');
    if (!alarmModal || !alarmModal.classList.contains('hidden')) return;

    let records = JSON.parse(localStorage.getItem('recordatorios')) || [];
    let changed = false;

    records.forEach(r => {
        if (r.completado) return;
        if (r.fechaFin && r.proximaDosis > r.fechaFin) {
            r.completado = true; changed = true; return;
        }

        // [CORRECCIÓN] Ventana de tiempo ampliada a 2 segundos para evitar pérdidas
        if (r.proximaDosis <= ahora && (ahora - r.proximaDosis) < 2000) {
            if (document.hidden) {
                new Notification(`Hora de medicina`, { body: `${r.nombre} - ${r.dosis}`, tag: `med-${r.id}` });
                localStorage.setItem('pendingAlarm', JSON.stringify(r));
            } else {
                showAlarm(r);
            }
            r.proximaDosis += (r.frecuencia * 60000); changed = true;
        }
    });

    if (changed) {
        localStorage.setItem('recordatorios', JSON.stringify(records));
        const cont = document.getElementById('contenedor-recordatorios');
        if (cont) mostrarRecordatoriosIndex(cont);
    }
}

// --- Helpers de voz (Dictado y Autocomplete) ---
function setupAutocompleteSuggestions() {
    const input = document.getElementById('med-name');
    const box = document.getElementById('med-suggestions');
    if (!input || !box) return;

    const MEDICAMENTOS_COMUNES = ['Paracetamol', 'Ibuprofeno', 'Aspirina', 'Omeprazol', 'Amoxicilina', 'Loratadina', 'Metformina', 'Losartán', 'Atorvastatina', 'Salbutamol'];

    const hide = () => {
        box.classList.add('hidden');
        input.parentElement.classList.remove('rounded-t-xl');
    };

    input.addEventListener('input', () => {
        const val = input.value.toLowerCase().trim();
        box.innerHTML = '';
        if (val.length < 2) { hide(); return; }
        const matches = MEDICAMENTOS_COMUNES.filter(m => m.toLowerCase().startsWith(val));
        if (matches.length === 0) { hide(); return; }
        box.classList.remove('hidden');
        matches.forEach(m => {
            const div = document.createElement('div');
            div.className = 'p-4 text-white hover:bg-surface-dark cursor-pointer border-b border-gray-700 last:border-0';
            div.textContent = m;
            div.onclick = () => { input.value = m; hide(); };
            box.appendChild(div);
        });
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !box.contains(e.target)) hide();
    });
}

function obtenerTextoRecordatorios() {
    const r = JSON.parse(localStorage.getItem('recordatorios')) || [];
    const hoy = r.filter(x => !x.completado && new Date(x.proximaDosis).getDate() === new Date().getDate());
    if (hoy.length === 0) return "No tienes nada pendiente para hoy.";
    return `Tienes ${hoy.length} medicinas hoy. ` + hoy.map(m => `${m.nombre} a las ${new Date(m.proximaDosis).getHours()} horas`).join('. ');
}

let dictationTimer = null;
function setupDictationOverlay() {
    const overlay = document.getElementById('voice-overlay');
    const txt = document.getElementById('voice-transcript-box');
    const btnClose = document.getElementById('btn-close-voice');
    const btnProcess = document.getElementById('btn-process-voice');

    if (!overlay) return;

    window.abrirLienzoDeVoz = () => {
        overlay.classList.remove('hidden');
        overlay.classList.add('flex');
        txt.value = '';
        const config = {
            name: 'dictation',
            continuous: true,
            interimResults: true,
            onStart: () => console.log("Dictado ON"),
            onResult: (e) => {
                let final = '';
                for (let i = e.resultIndex; i < e.results.length; ++i) {
                    if (e.results[i].isFinal) final += e.results[i][0].transcript;
                }
                if (final) txt.value = (txt.value + ' ' + final).trim();
            }
        };
        modeManager.stop({ manual: true });
        if (speechService) speechService.speak("Dime los datos...", () => modeManager.start(config));
    };

    const cerrar = () => {
        modeManager.stop({ manual: true });
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
        if (localStorage.getItem('voiceHelp') === 'true') modeManager.start(listeningMode);
    };

    btnClose.onclick = cerrar;
    btnProcess.onclick = () => {
        const res = formAssistant.fillFromText(txt.value);
        if (res.missing.length === 0) speechService.speak("Datos completos.");
        else speechService.speak("Faltó: " + res.missing.join(', '));
        cerrar();
    };
}

function startInactivityTimer() {
    clearInactivityTimer();
    inactivityTimer = setTimeout(handleInactivityTimeout, TIMEOUT_DURATION);
}

function clearInactivityTimer() {
    if (inactivityTimer) { clearTimeout(inactivityTimer); inactivityTimer = null; }
}

function handleInactivityTimeout() {
    modeManager.stop({ manual: true });
    if (interactionState === 'NORMAL') {
        interactionState = 'CONFIRMATION';
        speechService.speak("¿Sigues ahí?", () => modeManager.start(listeningMode));
    } else {
        interactionState = 'NORMAL';
        if (voiceStatusIcon) voiceStatusIcon.classList.add('hidden');
    }
}

function procesarConfirmacion(command) {
    if (command.includes('si') || command.includes('estoy')) {
        interactionState = 'NORMAL';
        speechService.speak("Te escucho.", () => modeManager.start(listeningMode));
    } else {
        if (voiceStatusIcon) voiceStatusIcon.classList.add('hidden');
    }
}