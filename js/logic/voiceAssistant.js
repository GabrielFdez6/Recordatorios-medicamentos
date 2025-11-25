// js/logic/voiceAssistant.js
import { primeAllAudio } from './audioLogic.js';
import { obtenerTextoRecordatorios, prepararFormulario } from '../ui/recordatoriosUI.js';

// Constantes
const TEXTO_BIENVENIDA = "Estás en el inicio. Puedes decir: 'ajustes', 'agregar recordatorio' o 'escuchar recordatorios'.";
const EJEMPLO_DICTADO = "Dime el nombre, dosis, frecuencia, fecha y hora. Por ejemplo: Paracetamol de 500, cada 8 horas, empezando hoy a las 4 de la tarde.";
const TIMEOUT_DURATION = 15000;

let inactivityTimer = null;
let interactionState = 'NORMAL';
let dictationTimer = null;
let dictationState = 'LISTENING_DATA';
let networkRetryCount = 0;
const MAX_NETWORK_RETRIES = 3;

// Referencias internas
let _modeManager, _speechService, _formAssistant, _voiceStatusIcon, _listeningMode;

export function setupVoiceAssistant(modeManager, speechService, formAssistant) {
    _modeManager = modeManager;
    _speechService = speechService;
    _formAssistant = formAssistant;
    _voiceStatusIcon = document.getElementById('voice-status-icon');

    _listeningMode = {
        name: 'listening',
        continuous: true,
        interimResults: false,
        onStart: () => {
            if (_voiceStatusIcon) {
                _voiceStatusIcon.classList.remove('hidden');
                _voiceStatusIcon.querySelector('span').textContent = 'record_voice_over';
            }
            startInactivityTimer();
        },
        onExit: () => {
            if (_voiceStatusIcon) _voiceStatusIcon.querySelector('span').textContent = 'mic_off';
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
                _modeManager.stop({ manual: true });
                if (networkRetryCount < MAX_NETWORK_RETRIES) {
                    setTimeout(() => {
                        if (localStorage.getItem('voiceHelp') === 'true') _modeManager.start(_listeningMode);
                    }, 4000);
                }
            }
        }
    };

    if (_voiceStatusIcon) {
        _voiceStatusIcon.addEventListener('click', () => {
            const vistaAgregar = document.getElementById('vista-agregar');
            if (vistaAgregar && !vistaAgregar.classList.contains('hidden')) {
                abrirLienzoDeVoz();
            } else {
                interactionState = 'NORMAL';
                primeAllAudio().then(() => {
                    anunciarOpcionesInicio();
                });
            }
        });
    }

    checkWelcomeVoice();
    setupDictationOverlay();
}

export function anunciarOpcionesInicio() {
    if (document.getElementById('vista-inicio').classList.contains('hidden')) return;

    _modeManager.stop({ manual: true });
    interactionState = 'NORMAL';
    clearInactivityTimer();

    _speechService.speak(TEXTO_BIENVENIDA, () => {
        const voiceEnabled = localStorage.getItem('voiceHelp') === 'true';
        const isHomeVisible = !document.getElementById('vista-inicio').classList.contains('hidden');

        if (voiceEnabled && isHomeVisible) {
            if (_voiceStatusIcon) _voiceStatusIcon.classList.remove('hidden');
            _modeManager.start(_listeningMode);
        }
    });
}

export function clearInactivityTimer() {
    if (inactivityTimer) { clearTimeout(inactivityTimer); inactivityTimer = null; }
}

export function clearDictationTimer() {
    if (dictationTimer) { clearTimeout(dictationTimer); dictationTimer = null; }
}

function startInactivityTimer() {
    clearInactivityTimer();
    inactivityTimer = setTimeout(handleInactivityTimeout, TIMEOUT_DURATION);
}

function handleInactivityTimeout() {
    _modeManager.stop({ manual: true });
    if (interactionState === 'NORMAL') {
        interactionState = 'CONFIRMATION';
        _speechService.speak("¿Sigues ahí?", () => {
            _modeManager.start(_listeningMode);
        });
    } else if (interactionState === 'CONFIRMATION') {
        interactionState = 'NORMAL';
        if (_voiceStatusIcon) _voiceStatusIcon.classList.add('hidden');
        localStorage.setItem('voiceHelp', 'false');
        const toggle = document.getElementById('voice-toggle');
        if (toggle) {
            toggle.setAttribute('aria-checked', 'false');
            toggle.classList.remove('bg-primary');
            const span = toggle.querySelector('span');
            if (span) span.classList.remove('translate-x-6');
        }
    }
}

function checkWelcomeVoice() {
    const preferenciaVoz = localStorage.getItem('voiceHelp');
    const modalBienvenida = document.getElementById('voice-prompt-modal');
    if (preferenciaVoz === 'true') {
        if (_voiceStatusIcon) _voiceStatusIcon.classList.remove('hidden');
        setTimeout(() => { anunciarOpcionesInicio(); }, 1000);
    } else if (preferenciaVoz === 'false') {
        document.addEventListener('click', primeAllAudio, { once: true });
    } else if (modalBienvenida) {
        modalBienvenida.classList.remove('hidden');
        document.getElementById('btn-voice-activate').addEventListener('click', async () => {
            modalBienvenida.classList.add('hidden');
            const ok = await primeAllAudio();
            if (ok) {
                localStorage.setItem('voiceHelp', 'true');
                if (_voiceStatusIcon) _voiceStatusIcon.classList.remove('hidden');
                const toggle = document.getElementById('voice-toggle');
                if (toggle) {
                    toggle.setAttribute('aria-checked', 'true');
                    toggle.classList.add('bg-primary');
                    toggle.querySelector('span').classList.add('translate-x-6');
                }
                _speechService.speak("Ayuda activada.", () => { anunciarOpcionesInicio(); });
            }
        });
        document.getElementById('btn-voice-deactivate').addEventListener('click', () => {
            modalBienvenida.classList.add('hidden');
            primeAllAudio();
            localStorage.setItem('voiceHelp', 'false');
        });
    }
}

// --- Procesamiento de Comandos ---
function procesarConfirmacion(command) {
    const cmd = command.toLowerCase();
    if (cmd.includes('si') || cmd.includes('sí') || cmd.includes('estoy') || cmd.includes('aquí') || cmd.includes('claro')) {
        anunciarOpcionesInicio();
    }
}

function procesarComando(command) {
    if (!_modeManager || !_speechService) return;
    interactionState = 'NORMAL';
    const cmd = command.toLowerCase();
    if (cmd.includes('agregar') || cmd.includes('añadir')) {
        _modeManager.stop({ manual: true });
        _speechService.speak("Abriendo pantalla para añadir.", () => {
            prepararFormulario(null);
            window.navegarA('vista-agregar');
            setTimeout(abrirLienzoDeVoz, 800);
        });
    } else if (cmd.includes('ajustes') || cmd.includes('perfil')) {
        _modeManager.stop({ manual: true });
        _speechService.speak("Abriendo tus ajustes.", () => {
            const btn = document.querySelector('button[onclick*="vista-perfil"]');
            if (btn) btn.click(); else window.navegarA('vista-perfil');
        });
    } else if (cmd.includes('escuchar') || cmd.includes('leer')) {
        _modeManager.stop({ manual: true });
        const texto = obtenerTextoRecordatorios();
        _speechService.speak(texto, () => {
            _speechService.speak("¿Deseas algo más?", () => {
                _modeManager.start(_listeningMode);
            });
        });
    }
}

function handleFormVoiceInteraction(command) {
    if (!_formAssistant) return;
    if (command.includes('cancelar') || command.includes('volver') || command.includes('atras')) {
        _modeManager.stop({ manual: true });
        _speechService.speak("Cancelando.", () => window.navegarA('vista-inicio'));
        return;
    }
    if (command.includes('guardar')) {
        _modeManager.stop({ manual: true });
        document.getElementById('btn-agregar').click();
        return;
    }
    if (command.includes('dictar') || command.includes('escribir')) {
        _modeManager.stop({ manual: true });
        abrirLienzoDeVoz();
        return;
    }
}

// --- LÓGICA DE DICTADO ---
export function abrirLienzoDeVoz() {
    const overlay = document.getElementById('voice-overlay');
    const txt = document.getElementById('voice-transcript-box');

    if (!overlay) return;
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    txt.value = '';
    dictationState = 'LISTENING_DATA';

    const dictationConfig = {
        name: 'dictation',
        continuous: true,
        interimResults: true,
        onStart: () => {
            console.log("Dictado ON - Esperando datos");
            startDictationTimer();
        },
        onResult: (e) => {
            clearDictationTimer();
            let interim = '';
            let final = '';
            for (let i = e.resultIndex; i < e.results.length; ++i) {
                if (e.results[i].isFinal) final += e.results[i][0].transcript;
                else interim += e.results[i][0].transcript;
            }

            if (dictationState === 'WAITING_CONFIRMATION' && final.length > 0) {
                processDictationConfirmation(final.toLowerCase());
                return;
            }

            if (dictationState === 'LISTENING_DATA') {
                if (final) {
                    txt.value = (txt.value + ' ' + final).trim();
                }
            }
            startDictationTimer();
        }
    };

    _modeManager.stop({ manual: true });
    _speechService.speak(EJEMPLO_DICTADO, () => {
        _modeManager.start(dictationConfig);
    });
}

function setupDictationOverlay() {
    const overlay = document.getElementById('voice-overlay');
    const txt = document.getElementById('voice-transcript-box');
    const btnClose = document.getElementById('btn-close-voice');
    const btnProcess = document.getElementById('btn-process-voice');

    if (!overlay) return;

    // Exponer globalmente para llamarlo desde el HTML o UI si hace falta
    window.abrirLienzoDeVoz = abrirLienzoDeVoz;

    btnClose.onclick = cerrarDictado;
    btnProcess.onclick = intentarGuardarDictado;
}

function startDictationTimer() {
    clearDictationTimer();
    dictationTimer = setTimeout(handleDictationTimeout, 15000);
}

function handleDictationTimeout() {
    _modeManager.stop({ manual: true });
    if (dictationState === 'LISTENING_DATA') {
        dictationState = 'WAITING_CONFIRMATION';
        _speechService.speak("¿Ya terminaste?", () => {
            _modeManager.start({ ..._modeManager.currentMode, continuous: false });
            startDictationTimer();
        });
    } else {
        _speechService.speak("Se ha cancelado por inactividad.", () => {
            cerrarDictado();
        });
    }
}

function processDictationConfirmation(response) {
    const isYes = response.includes('si') || response.includes('sí') || response.includes('ya') || response.includes('termin');
    const isNo = response.includes('no') || response.includes('falta') || response.includes('espera');

    _modeManager.stop({ manual: true });

    if (isNo) {
        dictationState = 'LISTENING_DATA';
        _speechService.speak("Entendido. Repito el ejemplo: " + EJEMPLO_DICTADO, () => {
            _modeManager.start({ ..._modeManager.currentMode, continuous: true });
            startDictationTimer();
        });
    } else if (isYes) {
        intentarGuardarDictado();
    } else {
        dictationState = 'LISTENING_DATA';
        _speechService.speak("Sigo escuchando datos.", () => {
            _modeManager.start({ ..._modeManager.currentMode, continuous: true });
            startDictationTimer();
        });
    }
}

function intentarGuardarDictado() {
    const txt = document.getElementById('voice-transcript-box');
    const res = _formAssistant.fillFromText(txt.value);
    if (res.success) {
        _speechService.speak("Datos completos. Guardando recordatorio.", () => {
            document.getElementById('btn-agregar').click();
            cerrarDictado();
        });
    } else {
        const faltantes = res.missing.join(', ');
        _speechService.speak("Falta información: " + faltantes + ". Por favor, dímelos.", () => {
            dictationState = 'LISTENING_DATA';
            _modeManager.start({ ..._modeManager.currentMode, continuous: true });
            startDictationTimer();
        });
    }
}

function cerrarDictado() {
    clearDictationTimer();
    _modeManager.stop({ manual: true });
    const overlay = document.getElementById('voice-overlay');
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');
}