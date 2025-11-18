export function isSpeechSynthesisSupported() {
    return 'speechSynthesis' in window;
}

export class SpeechSynthesisService {
    constructor(options = {}) {
        const { lang = 'es-ES' } = options;
        this.lang = lang;
    }

    speak(text, onEndCallback) {
        if (!isSpeechSynthesisSupported()) {
            console.warn('La síntesis de voz no está disponible en este navegador.');
            if (onEndCallback) onEndCallback();
            return;
        }

        if (!text) {
            if (onEndCallback) onEndCallback();
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.lang;

        if (onEndCallback) {
            utterance.onend = onEndCallback;
        }

        window.speechSynthesis.speak(utterance);
    }

    stop() {
        if (isSpeechSynthesisSupported()) {
            window.speechSynthesis.cancel();
        }
    }
}