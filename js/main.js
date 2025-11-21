// --- main.js (Versión FINAL: Corregida y Completa) ---

import { createSpeechRecognition, isSpeechRecognitionSupported } from './core/speechRecognitionFactory.js';
import { RecognitionModeManager } from './core/recognitionModeManager.js';
import { SpeechSynthesisService } from './core/speechSynthesisService.js';
import { MedicationFormAssistant } from './core/medicationFormAssistant.js';

// Variables globales
let modeManager;
let speechService;
let voiceStatusIcon;
let listeningMode;
let formAssistant = null;

// Variables de Control de Flujo (Temporizadores)
let inactivityTimer = null;
let interactionState = 'NORMAL'; // Estados: 'NORMAL', 'CONFIRMATION'
const TIMEOUT_DURATION = 15000; // 15 segundos para comandos normales

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

    // Verificamos si hay contenedor de recordatorios (Index) O si estamos en Agregar (Formulario)
    if (document.getElementById('contenedor-recordatorios') || document.getElementById('med-name')) {

        if (isSpeechRecognitionSupported()) {
            speechService = new SpeechSynthesisService({ lang: 'es-ES' });
            const recognition = createSpeechRecognition({ lang: 'es-ES', continuous: true, interimResults: false });
            modeManager = new RecognitionModeManager(recognition);

            // --- INICIALIZACIÓN DEL ASISTENTE DE FORMULARIO ---
            if (document.getElementById('med-name')) {
                formAssistant = new MedicationFormAssistant(speechService);
            }

            // --- Configuración del Modo de Escucha (Comandos Generales) ---
            listeningMode = {
                name: 'listening',
                continuous: true,
                interimResults: false,

                onStart: () => {
                    if (voiceStatusIcon) {
                        voiceStatusIcon.classList.remove('hidden');
                        voiceStatusIcon.querySelector('span').textContent = 'record_voice_over';
                    }
                    console.log("🎙️ Escuchando (Comandos)...");
                    if (!inactivityTimer) startInactivityTimer();
                },

                onExit: () => {
                    if (voiceStatusIcon) voiceStatusIcon.querySelector('span').textContent = 'mic_off';
                    console.log("⏸️ Pausa técnica.");
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
                        console.log("🗣️ Comando detectado:", command);
                        if (interactionState === 'CONFIRMATION') {
                            procesarConfirmacion(command);
                        } else if (formAssistant) {
                            handleFormVoiceInteraction(command);
                        } else {
                            procesarComando(command);
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
                            setTimeout(() => { if (localStorage.getItem('voiceHelp') === 'true') modeManager.start(listeningMode); }, 4000);
                        } else {
                            alert("Error de conexión.");
                            if (voiceStatusIcon) voiceStatusIcon.classList.add('hidden');
                        }
                    } else if (event.error === 'not-allowed') {
                        modeManager.stop({ manual: true });
                        alert("Micrófono bloqueado.");
                    }
                }
            };

            // --- Lógica de Bienvenida (Index) ---
            const preferenciaVoz = localStorage.getItem('voiceHelp');
            const modalBienvenida = document.getElementById('voice-prompt-modal');
            const textoBienvenida = "Bienvenido. Puedes decir: 'ajustes', 'agregar recordatorio' o 'escuchar recordatorios'.";

            if (preferenciaVoz === 'true') {
                if (voiceStatusIcon) voiceStatusIcon.classList.remove('hidden');
                setTimeout(() => {
                    interactionState = 'NORMAL';
                    // Solo damos la bienvenida general si NO estamos en el formulario
                    if (!formAssistant) {
                        speechService.speak(textoBienvenida, () => { modeManager.start(listeningMode); });
                    }
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
                        speechService.speak("Ayuda activada. " + textoBienvenida, () => { modeManager.start(listeningMode); });
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
        mostrarRecordatoriosIndex(contenedorRecordatorios); // <--- Aquí daba el error porque faltaba la función
        contenedorRecordatorios.addEventListener('click', (e) => {
            const btnDel = e.target.closest('.btn-borrar-menu');
            const btnEdit = e.target.closest('.btn-editar-menu');
            if (btnDel) { e.preventDefault(); borrarRecordatorio(btnDel.dataset.id); }
            if (btnEdit) { e.preventDefault(); editarRecordatorio(btnEdit.dataset.id); }
        });
    }

    const btnBack = document.getElementById('btn-back');
    if (btnBack) setupProfilePage(btnBack);

    const timeBtn = document.getElementById('btn-time-picker');
    if (timeBtn) timeBtn.addEventListener('click', () => {
        try { document.getElementById('med-time').showPicker(); } catch (e) { document.getElementById('med-time').focus(); }
    });

    // Listener global para el icono (SOLO si NO estamos en la página de agregar)
    if (voiceStatusIcon && !document.getElementById('med-name')) {
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
        interactionState = 'CONFIRMATION';
        speechService.speak("¿Sigues ahí?", () => {
            modeManager.start(listeningMode);
        });
    } else if (interactionState === 'CONFIRMATION') {
        interactionState = 'NORMAL';
        localStorage.setItem('voiceHelp', 'false');
        speechService.speak("Desactivando narrador.", () => {
            if (voiceStatusIcon) voiceStatusIcon.classList.add('hidden');
        });
    }
}

// =======================================================
// SECCIÓN: LÓGICA DE CONFIRMACIÓN (REFINADA)
// =======================================================

function procesarConfirmacion(command) {
    const cleanCommand = command.toLowerCase().replace(/[.,!¡¿?]/g, '').trim();
    const respuestasPositivas = ['sí', 'si', 'claro', 'aquí', 'aqui', 'estoy', 'hola', 'sigo', 'yep', 'yes', 'correcto', 'afirmativo', 'vale', 'ok', 'escucho'];
    const esPositivo = respuestasPositivas.some(palabra => cleanCommand.includes(palabra));

    if (esPositivo) {
        interactionState = 'NORMAL';
        modeManager.stop({ manual: true });
        speechService.speak("Entendido. Te escucho.", () => {
            modeManager.start(listeningMode);
        });
    } else {
        localStorage.setItem('voiceHelp', 'false');
        modeManager.stop({ manual: true });
        speechService.speak("Entendido, hasta luego.", () => {
            if (voiceStatusIcon) voiceStatusIcon.classList.add('hidden');
        });
    }
}

function procesarComando(command) {
    if (!modeManager || !speechService) return;
    interactionState = 'NORMAL';
    const cmd = command.toLowerCase();

    if (cmd.includes('agregar') || cmd.includes('añadir')) {
        modeManager.stop({ manual: true });
        speechService.speak("Abriendo pantalla para añadir.", () => window.location.href = 'agregar.html');
    } else if (cmd.includes('ajustes') || cmd.includes('perfil')) {
        modeManager.stop({ manual: true });
        speechService.speak("Abriendo tus ajustes.", () => window.location.href = 'perfil.html');
    } else if (cmd.includes('escuchar') || cmd.includes('recordatorios') || cmd.includes('leer')) {
        modeManager.stop({ manual: true });
        const texto = obtenerTextoRecordatorios();
        speechService.speak(texto, () => {
            speechService.speak("¿Deseas algo más?", () => { modeManager.start(listeningMode); });
        });
    } else {
        modeManager.stop({ manual: true });
        speechService.speak("No te entendí bien. ¿Puedes repetir?", () => { modeManager.start(listeningMode); });
    }
}

// =======================================================
// NUEVO: MANEJO INTELIGENTE DEL FORMULARIO (FALLBACK)
// =======================================================
function handleFormVoiceInteraction(command) {
    if (!formAssistant) return;
    modeManager.stop({ manual: true });
    if (command.includes('cancelar') || command.includes('volver')) {
        speechService.speak("Cancelando.", () => window.location.href = 'index.html');
        return;
    }
    if (command.includes('guardar')) {
        document.getElementById('btn-agregar').click();
        return;
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
    const medNameContainer = medNameInput.parentElement;
    const botonAgregar = document.getElementById('btn-agregar');

    // --- Elementos del Overlay ---
    const voiceOverlay = document.getElementById('voice-overlay');
    const voiceTextarea = document.getElementById('voice-transcript-box');
    const btnCloseVoice = document.getElementById('btn-close-voice');
    const btnProcessVoice = document.getElementById('btn-process-voice');

    // Referencia al botón flotante (FAB)
    const voiceTrigger = document.getElementById('voice-status-icon');

    // --- LÓGICA DE EDICIÓN ---
    const editData = JSON.parse(localStorage.getItem('tempEditMed'));
    if (editData) {
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
        const btnSpan = botonAgregar.querySelector('span');
        if (btnSpan) btnSpan.textContent = 'Guardar Cambios';
    }

    // =======================================================
    //  NUEVA LÓGICA: DICTADO + TEMPORIZADOR + EJEMPLO
    // =======================================================

    let dictationSilenceTimer = null;

    // --- Función para procesar y cerrar (reutilizable) ---
    const procesarDictado = (intentarGuardar = false) => {
        cerrarLienzo();

        const textoDictado = voiceTextarea.value;
        const resultado = formAssistant.fillFromText(textoDictado);

        // Si intentamos guardar automáticamente (porque el usuario dijo "Sí")
        if (intentarGuardar && resultado.missing.length === 0) {
            speechService.speak("Entendido, guardando recordatorio.", () => {
                document.getElementById('btn-agregar').click();
            });
            return;
        }

        // Feedback normal
        let mensaje = "Datos copiados.";
        if (resultado.missing.length > 0) {
            mensaje += " Falta: " + resultado.missing.join(" y ");
        } else {
            mensaje += " Todo listo. Revisa y guarda.";
        }
        speechService.speak(mensaje);
    };

    // --- Modo Confirmación (Pregunta ¿Terminaste?) ---
    const dictationConfirmationMode = {
        name: 'dictation_confirmation',
        continuous: false,
        interimResults: false,
        onStart: () => console.log("❓ Esperando confirmación..."),
        onResult: (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            console.log("🗣️ Respuesta confirmación:", transcript);

            if (transcript.includes('sí') || transcript.includes('si') || transcript.includes('claro') || transcript.includes('listo')) {
                // Usuario confirma -> Procesar y Guardar
                procesarDictado(true);
            } else {
                // Usuario niega -> Volver al dictado
                speechService.speak("Te sigo escuchando.", () => {
                    modeManager.start(dictationMode);
                });
            }
        },
        onError: () => {
            modeManager.start(dictationMode);
        }
    };

    // --- Función que se ejecuta a los 15s de silencio ---
    const handleDictationTimeout = () => {
        modeManager.stop({ manual: true });
        speechService.speak("No escucho nada. ¿Has terminado?", () => {
            modeManager.start(dictationConfirmationMode);
        });
    };

    // --- Función para reiniciar el reloj (15s) ---
    const resetDictationTimer = () => {
        clearTimeout(dictationSilenceTimer);
        dictationSilenceTimer = setTimeout(handleDictationTimeout, 15000); // 15 segundos
    };

    // --- MODO DICTADO PRINCIPAL ---
    const dictationMode = {
        name: 'dictation',
        continuous: true,
        interimResults: true,
        onStart: () => {
            clearInactivityTimer(); // Matar timer global
            if (!dictationSilenceTimer) resetDictationTimer();
            console.log("🎙️ Modo Dictado (Overlay)");
        },
        onResult: (event) => {
            clearInactivityTimer();
            resetDictationTimer(); // Cada palabra resetea los 15s

            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript) {
                const currentText = voiceTextarea.value.trim();
                voiceTextarea.value = currentText ? currentText + " " + finalTranscript : finalTranscript;
                voiceTextarea.scrollTop = voiceTextarea.scrollHeight;
            }
        },
        onError: (event) => {
            console.warn("Error dictado:", event.error);
            clearInactivityTimer();
        }
    };

    const abrirLienzoDeVoz = () => {
        if (!speechService || !modeManager || !formAssistant) {
            alert("Voz no disponible.");
            return;
        }

        voiceTextarea.value = "";
        voiceOverlay.classList.remove('hidden');
        voiceOverlay.classList.add('flex');
        clearTimeout(dictationSilenceTimer);
        dictationSilenceTimer = null;

        modeManager.stop({ manual: true });
        speechService.stop();
        clearInactivityTimer();

        // 1. EJEMPLO DE VOZ AL ABRIR (TEXTO ACTUALIZADO)
        const ejemplo = "Te escucho. Puedes decir algo como: 'Paracetamol de 500 miligramos 8 de la noche cada 8 horas, empezando el 18 del noviembre del 2025'.";

        speechService.speak(ejemplo, () => {
            // Iniciar timer de 15s justo al empezar a escuchar
            resetDictationTimer();
            modeManager.start(dictationMode);
        });
    };

    const cerrarLienzo = () => {
        modeManager.stop({ manual: true });
        clearInactivityTimer();
        clearTimeout(dictationSilenceTimer); // Limpiar timer local
        voiceOverlay.classList.add('hidden');
        voiceOverlay.classList.remove('flex');
    };

    if (btnCloseVoice) btnCloseVoice.addEventListener('click', cerrarLienzo);

    if (btnProcessVoice) {
        btnProcessVoice.addEventListener('click', () => procesarDictado(false)); // Click manual solo procesa
    }

    if (voiceTrigger) {
        voiceTrigger.classList.remove('hidden');
        voiceTrigger.addEventListener('click', abrirLienzoDeVoz);
    }

    // --- Sugerencias y Guardado ---
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

    function showSuggestions() {
        medNameContainer.classList.remove('rounded-xl'); medNameContainer.classList.add('rounded-t-xl');
        medNameInput.classList.remove('rounded-l-xl'); medNameInput.classList.add('rounded-tl-xl');
        document.getElementById('med-suggestions').classList.remove('hidden');
    }
    function hideSuggestions() {
        medNameContainer.classList.remove('rounded-t-xl'); medNameContainer.classList.add('rounded-xl');
        medNameInput.classList.remove('rounded-tl-xl'); medNameInput.classList.add('rounded-l-xl');
        document.getElementById('med-suggestions').classList.add('hidden');
    }

    medNameInput.addEventListener('input', () => {
        const inputText = medNameInput.value.toLowerCase().trim();
        const box = document.getElementById('med-suggestions'); box.innerHTML = '';
        if (inputText.length === 0) { hideSuggestions(); return; }
        const suggestions = MEDICAMENTOS_COMUNES.filter(med => med.toLowerCase().startsWith(inputText));
        if (suggestions.length === 0) { hideSuggestions(); return; }
        suggestions.forEach(med => {
            const el = document.createElement('div');
            el.className = 'p-4 text-white text-lg bg-gray-900 border-b border-gray-700 last:border-b-0 hover:bg-surface-dark cursor-pointer';
            el.textContent = med;
            el.dataset.name = med;
            box.appendChild(el);
        });
        showSuggestions();
    });

    document.getElementById('med-suggestions').addEventListener('click', (e) => {
        const c = e.target.closest('[data-name]');
        if (c) { medNameInput.value = c.dataset.name; hideSuggestions(); }
    });
    medNameInput.addEventListener('blur', () => setTimeout(hideSuggestions, 150));

    botonAgregar.addEventListener('click', async () => {
        const nombre = document.getElementById('med-name').value;
        const frecuencia = document.getElementById('med-frequency').value;
        const fecha = document.getElementById('med-date').value;
        const hora = document.getElementById('med-time').value;
        const dosis = document.getElementById('med-dose').value;

        if (!nombre || !fecha || !hora) { alert("Faltan datos"); return; }

        let records = JSON.parse(localStorage.getItem('recordatorios')) || [];
        const partesFecha = fecha.split('-').map(Number);
        const partesHora = hora.split(':').map(Number);
        const fechaObj = new Date();
        fechaObj.setFullYear(partesFecha[0], partesFecha[1] - 1, partesFecha[2]);
        fechaObj.setHours(partesHora[0], partesHora[1], 0, 0);

        let prox = fechaObj.getTime();
        if (prox <= Date.now()) prox += (parseInt(frecuencia) * 60000);

        if (editData) {
            const index = records.findIndex(r => r.id === editData.id);
            if (index !== -1) {
                records[index] = { ...records[index], nombre, dosis, frecuencia: parseInt(frecuencia), proximaDosis: prox, completado: false };
            }
            localStorage.removeItem('tempEditMed');
        } else {
            records.push({ id: Date.now(), nombre, dosis, frecuencia: parseInt(frecuencia), proximaDosis: prox, completado: false });
        }
        localStorage.setItem('recordatorios', JSON.stringify(records));
        window.location.href = "index.html";
    });
}

// =======================================================
// FUNCIONES DE UTILIDAD RESTAURADAS (Para Index y Alarmas)
// =======================================================

function setupProfilePage(btnBack) {
    let initialState = {}; let currentState = {};
    const modalBackdrop = document.getElementById('modal-backdrop');
    const modalBtnSave = document.getElementById('modal-btn-save');
    const modalBtnDiscard = document.getElementById('modal-btn-discard');
    const lightBtn = document.getElementById('btn-theme-light');
    const darkBtn = document.getElementById('btn-theme-dark');
    const contrastBtn = document.getElementById('btn-theme-contrast');
    const themeButtons = [lightBtn, darkBtn, contrastBtn];
    const inactiveClasses = 'border-slate-700';
    const activeClasses = 'border-primary bg-primary/10';
    const fontSizeSlider = document.getElementById('fontSize');
    const sizeMap = ['85%', '92.5%', '100%', '107.5%', '115%'];
    const inputFullName = document.getElementById('fullName');
    const headerName = document.getElementById('header-name');
    const volumeSlider = document.getElementById('volumeSlider');
    const voiceToggle = document.getElementById('voice-toggle');

    function loadInitialState() {
        initialState = {
            theme: localStorage.getItem('theme') || 'dark',
            fontSize: localStorage.getItem('fontSize') || '2',
            name: localStorage.getItem('profileName') || 'Carlos Pérez',
            volume: localStorage.getItem('profileVolume') || '75',
            voice: localStorage.getItem('voiceHelp') === 'true'
        };
        currentState = { ...initialState };
    }

    function loadUiFromState(state) {
        document.documentElement.classList.remove('dark', 'light', 'high-contrast');
        if (state.theme !== 'light') document.documentElement.classList.add(state.theme);
        updateButtonState(state.theme);
        document.documentElement.style.fontSize = sizeMap[state.fontSize];
        if (fontSizeSlider) fontSizeSlider.value = state.fontSize;
        if (inputFullName) inputFullName.value = state.name;
        if (headerName) headerName.textContent = state.name;
        if (volumeSlider) volumeSlider.value = state.volume;
        if (voiceToggle) {
            const voiceToggleSpan = voiceToggle.querySelector('span');
            voiceToggle.setAttribute('aria-checked', state.voice);
            if (state.voice) { voiceToggleSpan.classList.add('translate-x-6'); voiceToggle.classList.add('bg-primary'); }
            else { voiceToggleSpan.classList.remove('translate-x-6'); voiceToggle.classList.remove('bg-primary'); }
        }
    }

    function saveCurrentState() {
        localStorage.setItem('theme', currentState.theme);
        localStorage.setItem('fontSize', currentState.fontSize);
        localStorage.setItem('profileName', currentState.name);
        localStorage.setItem('profileVolume', currentState.volume);
        localStorage.setItem('voiceHelp', currentState.voice);
        initialState = { ...currentState };
    }

    function updateButtonState(currentTheme) {
        if (!lightBtn) return;
        const activeClassesArray = activeClasses.split(' ');
        themeButtons.forEach(btn => { btn.classList.remove(...activeClassesArray); btn.classList.add(inactiveClasses); });
        if (currentTheme === 'light') { lightBtn.classList.add(...activeClassesArray); lightBtn.classList.remove(inactiveClasses); }
        else if (currentTheme === 'dark') { darkBtn.classList.add(...activeClassesArray); darkBtn.classList.remove(inactiveClasses); }
        else if (currentTheme === 'high-contrast') { contrastBtn.classList.add(...activeClassesArray); contrastBtn.classList.remove(inactiveClasses); }
    }

    loadInitialState(); loadUiFromState(initialState);

    if (lightBtn) lightBtn.addEventListener('click', () => { currentState.theme = 'light'; loadUiFromState(currentState); });
    if (darkBtn) darkBtn.addEventListener('click', () => { currentState.theme = 'dark'; loadUiFromState(currentState); });
    if (contrastBtn) contrastBtn.addEventListener('click', () => { currentState.theme = 'high-contrast'; loadUiFromState(currentState); });
    if (fontSizeSlider) fontSizeSlider.addEventListener('input', () => { currentState.fontSize = fontSizeSlider.value; document.documentElement.style.fontSize = sizeMap[fontSizeSlider.value]; });
    if (inputFullName) inputFullName.addEventListener('input', () => { currentState.name = inputFullName.value; headerName.textContent = inputFullName.value; });
    if (volumeSlider) volumeSlider.addEventListener('input', () => { currentState.volume = volumeSlider.value; });
    if (voiceToggle) voiceToggle.addEventListener('click', () => { currentState.voice = !currentState.voice; loadUiFromState(currentState); });

    btnBack.addEventListener('click', (event) => {
        const hasChanges = initialState.theme !== currentState.theme || initialState.fontSize !== currentState.fontSize || initialState.name !== currentState.name || initialState.volume !== currentState.volume || initialState.voice !== currentState.voice;
        if (hasChanges) { event.preventDefault(); modalBackdrop.classList.remove('hidden'); }
    });

    if (modalBtnSave) modalBtnSave.addEventListener('click', () => { saveCurrentState(); modalBackdrop.classList.add('hidden'); window.location.href = btnBack.href; });
    if (modalBtnDiscard) modalBtnDiscard.addEventListener('click', () => { loadUiFromState(initialState); currentState = { ...initialState }; modalBackdrop.classList.add('hidden'); });
}

// --- FUNCIONES FALTANTES (RESTORED) ---

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
// Intervalo para revisar alarmas cada segundo
setInterval(() => { revisarRecordatorios(); const cont = document.getElementById('contenedor-recordatorios'); if (cont) mostrarRecordatoriosIndex(cont); }, 1000);

function mostrarRecordatoriosIndex(contenedor) {
    const records = JSON.parse(localStorage.getItem('recordatorios')) || [];
    contenedor.innerHTML = '';

    const active = records.filter(r => !r.completado);

    if (active.length === 0) {
        contenedor.innerHTML = `<div class="rounded-xl bg-card-dark p-5 text-center"><p class="text-xl text-zinc-400">No tienes recordatorios.</p></div>`;
        return;
    }

    active.sort((a, b) => a.proximaDosis - b.proximaDosis);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = todayStart + (24 * 60 * 60 * 1000);
    const dayAfterStart = tomorrowStart + (24 * 60 * 60 * 1000);
    const futureStart = dayAfterStart + (24 * 60 * 60 * 1000);

    let html = '';
    let currentGroup = null;

    active.forEach(r => {
        let group = '';
        if (r.proximaDosis < tomorrowStart) group = 'Hoy';
        else if (r.proximaDosis < dayAfterStart) group = 'Mañana';
        else if (r.proximaDosis < futureStart) group = 'Pasado Mañana';
        else group = 'Más adelante';

        if (group !== currentGroup) {
            html += `<h2 class="text-3xl font-bold text-white pt-6 pb-2">${group}</h2>`;
            currentGroup = group;
        }
        html += crearTarjetaRecordatorio(r);
    });
    contenedor.innerHTML = html;
}

function crearTarjetaRecordatorio(r) {
    const date = new Date(r.proximaDosis).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const color = r.frecuencia === 1 ? 'bg-warning' : 'bg-primary';
    const dosisHtml = r.dosis ? `<p class="text-xl text-zinc-400 mt-1">${r.dosis}</p>` : '';

    return `
    <div class="flex rounded-xl bg-card-dark overflow-hidden mb-4">
        <div class="w-1.5 ${color}"></div>
        <div class="flex-1 p-6">
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-4xl font-bold text-white">${date}</p>
                    <p class="text-2xl text-zinc-200 font-medium mt-1">${r.nombre}</p>
                    ${dosisHtml}
                </div>
            </div>
            <div class="flex gap-4 mt-4">
                <button class="btn-editar-menu flex-1 rounded-lg border border-zinc-600 py-3 text-primary font-bold transition-colors hover:bg-zinc-800" data-id="${r.id}">Editar</button>
                <button class="btn-borrar-menu flex-1 rounded-lg border border-zinc-600 py-3 text-red-400 font-bold transition-colors hover:bg-zinc-800" data-id="${r.id}">Eliminar</button>
            </div>
        </div>
    </div>`;
}

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

function showAlarm(r) {
    const alarmModal = document.getElementById('alarm-modal');
    const alarmSound = document.getElementById('alarm-sound');

    if (alarmModal) {
        document.getElementById('alarm-name').textContent = r.nombre;
        document.getElementById('alarm-time').textContent = new Date(r.proximaDosis).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const doseElement = document.getElementById('alarm-dose');
        if (doseElement) doseElement.textContent = r.dosis || '';

        alarmModal.classList.remove('hidden');
        try { alarmSound.play(); } catch (e) { }
    }
}

function borrarRecordatorio(id) {
    if (!confirm("¿Borrar?")) return;
    let r = JSON.parse(localStorage.getItem('recordatorios')) || [];
    r = r.filter(x => x.id != id);
    localStorage.setItem('recordatorios', JSON.stringify(r));
    const c = document.getElementById('contenedor-recordatorios');
    if (c) mostrarRecordatoriosIndex(c);
}

function editarRecordatorio(id) {
    const records = JSON.parse(localStorage.getItem('recordatorios')) || [];
    const item = records.find(r => r.id == id);
    if (item) {
        localStorage.setItem('tempEditMed', JSON.stringify(item));
        window.location.href = 'agregar.html';
    }
}