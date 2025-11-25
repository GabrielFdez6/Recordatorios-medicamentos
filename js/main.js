// js/main.js (Entrada principal modularizada)

import { createSpeechRecognition, isSpeechRecognitionSupported } from './core/speechRecognitionFactory.js';
import { RecognitionModeManager } from './core/recognitionModeManager.js';
import { SpeechSynthesisService } from './core/speechSynthesisService.js';
import { MedicationFormAssistant } from './core/medicationFormAssistant.js';

// Módulos nuevos
import { initAlarmSlider, revisarRecordatorios, stopAllAudio, aplicarVolumen, showAlarm } from './logic/audioLogic.js';
import { initRecordatoriosUI, mostrarRecordatoriosIndex } from './ui/recordatoriosUI.js';
import { setupProfilePage } from './ui/perfilUI.js';
import { setupVoiceAssistant, anunciarOpcionesInicio, clearInactivityTimer, clearDictationTimer } from './logic/voiceAssistant.js';

// Variables de servicio globales (Se pasan a los módulos)
let modeManager = null;
let speechService = null;
let formAssistant = null;
let inactivityTimer = null; // Mantenemos referencia local si hace falta para el destroy

document.addEventListener('DOMContentLoaded', () => {

    // 1. Inicializar Servicios de Voz si están disponibles
    if (isSpeechRecognitionSupported()) {
        speechService = new SpeechSynthesisService({ lang: 'es-ES' });
        const recognition = createSpeechRecognition({ lang: 'es-ES', continuous: true, interimResults: false });
        modeManager = new RecognitionModeManager(recognition);
        formAssistant = new MedicationFormAssistant(speechService);

        // Inicializar Módulo de Voz
        setupVoiceAssistant(modeManager, speechService, formAssistant);
    }

    // 2. Configurar Navegación (Intercepta para manejar voz)
    const originalNavegar = window.navegarA;
    window.navegarA = function (vistaId) {
        if (originalNavegar) originalNavegar(vistaId);

        if (vistaId === 'vista-inicio' && localStorage.getItem('voiceHelp') === 'true') {
            setTimeout(() => {
                anunciarOpcionesInicio();
            }, 500);
        } else {
            // Si salimos del inicio, limpiar timers y cortar audio
            clearInactivityTimer();
            if (speechService) speechService.stop();

            if (modeManager && vistaId !== 'vista-agregar') {
                modeManager.stop({ manual: true });
            }
        }
    };
    // Exponer irA globalmente
    window.irA = function (vistaId) {
        if (window.navegarA) window.navegarA(vistaId);
    }

    // 3. Inicializar Módulos UI y Lógica
    initRecordatoriosUI(speechService);
    setupProfilePage(speechService, modeManager, anunciarOpcionesInicio);
    initAlarmSlider();

    // 4. Carga Inicial de Datos
    const contenedor = document.getElementById('contenedor-recordatorios');
    if (contenedor) mostrarRecordatoriosIndex(contenedor);

    const savedVol = localStorage.getItem('profileVolume') || '100';
    aplicarVolumen(savedVol);

    // 5. Verificar alarmas pendientes (si se cerró la app sonando)
    try {
        const pending = localStorage.getItem('pendingAlarm');
        if (pending) {
            const rec = JSON.parse(pending);
            localStorage.removeItem('pendingAlarm');
            setTimeout(() => showAlarm(rec), 500);
        }
    } catch (e) { console.error(e); }

    // 6. Loop Principal (Cada segundo)
    setInterval(() => {
        // Pasamos un callback para refrescar la UI si una alarma se marca completada automáticamente (opcional)
        revisarRecordatorios(() => {
            const cont = document.getElementById('contenedor-recordatorios');
            if (cont && !document.getElementById('vista-inicio').classList.contains('hidden')) {
                mostrarRecordatoriosIndex(cont);
            }
        });

        // Refresco visual constante si estamos en inicio
        if (!document.hidden && document.getElementById('vista-inicio').classList.contains('hidden') === false) {
            const cont = document.getElementById('contenedor-recordatorios');
            if (cont) mostrarRecordatoriosIndex(cont);
        }
    }, 1000);
});

window.addEventListener('beforeunload', () => {
    clearInactivityTimer();
    clearDictationTimer();
    stopAllAudio();
    if (modeManager) modeManager.stop({ manual: true });
});