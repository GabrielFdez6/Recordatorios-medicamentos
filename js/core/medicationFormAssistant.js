// js/core/medicationFormAssistant.js

export class MedicationFormAssistant {
    constructor(speechService) {
        this.speechService = speechService;

        // Referencias al DOM
        this.inputs = {
            name: document.getElementById('med-name'),
            dose: document.getElementById('med-dose'),
            frequency: document.getElementById('med-frequency'),
            date: document.getElementById('med-date'),
            time: document.getElementById('med-time')
        };

        // Estado interno para saber qué falta
        this.state = {
            step: 'idle', // idle, filling, confirming
            missingFields: []
        };
    }

    /**
     * Entrada principal: Recibe el texto del usuario y decide qué hacer
     */
    processInput(text, onCompleteCallback, onAskCallback) {
        const command = text.toLowerCase();

        // 1. Intentar extraer datos del texto
        const extracted = this.parseNaturalLanguage(command);

        // 2. Rellenar el formulario con lo encontrado
        this.fillForm(extracted);

        // 3. Verificar qué falta
        const missing = this.checkMissingFields();

        if (missing.length === 0) {
            // Todo listo
            onCompleteCallback("He capturado todos los datos. ¿Deseas guardar el recordatorio?");
        } else {
            // Falta información
            const nextField = missing[0]; // Preguntamos por el primero que falte
            let prompt = "";

            switch (nextField) {
                case 'name': prompt = "¿Cuál es el nombre del medicamento?"; break;
                case 'dose': prompt = "¿Cuál es la dosis? Por ejemplo: 500 miligramos o 1 pastilla."; break;
                case 'frequency': prompt = "¿Cada cuánto tiempo debes tomarlo?"; break;
                case 'time': prompt = "¿A qué hora es la primera toma?"; break;
            }

            onAskCallback(prompt);
        }
    }

    /**
     * Analizador Heurístico (Regex) para extraer datos
     */
    parseNaturalLanguage(text) {
        const data = {};

        // --- A. FRECUENCIA ---
        if (text.includes('8 hora') || text.includes('8 hrs')) data.frequency = '480';
        else if (text.includes('12 hora') || text.includes('12 hrs')) data.frequency = '720';
        else if (text.includes('24 hora') || text.includes('una vez') || text.includes('diario') || text.includes('cada día')) data.frequency = '1440';
        // (Añadimos prueba de 1 min si es necesario para debug)
        else if (text.includes('prueba') || text.includes('minuto')) data.frequency = '1';

        // --- B. DOSIS (Detecta mg, g, pastillas, tabletas) ---
        // Ej: "500 mg", "1 pastilla", "2.5 ml"
        const doseRegex = /(\d+(?:[.,]\d+)?)\s*(mg|miligramos|gr|gramos|ml|pastillas?|tabletas?|capsulas?|gotas?)/i;
        const doseMatch = text.match(doseRegex);
        if (doseMatch) {
            data.dose = doseMatch[0]; // Guarda todo "500 mg"
        }

        // --- C. HORA (Detecta formatos: 8 am, 20:00, a las 8, etc) ---
        const timeRegex = /(?:a las|a la)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|p\.m\.|a\.m\.)?/i;
        const timeMatch = text.match(timeRegex);

        if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            let minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            const period = timeMatch[3] ? timeMatch[3].toLowerCase().replace(/\./g, '') : null;

            // Conversión 12h a 24h
            if (period === 'pm' && hours < 12) hours += 12;
            if (period === 'am' && hours === 12) hours = 0;

            // Formatear HH:MM para el input type="time"
            data.time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }

        // --- D. FECHA (Detecta "hoy", "mañana") ---
        const today = new Date();
        if (text.includes('mañana')) {
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            data.date = tomorrow.toISOString().split('T')[0];
        } else if (text.includes('hoy')) {
            data.date = today.toISOString().split('T')[0];
        }
        // Si no dice nada, por defecto no ponemos fecha para obligar a confirmar o asumimos hoy en checkMissingFields

        // --- E. NOMBRE (Lo más difícil: asume que es lo que NO son comandos) ---
        // Estrategia simple: Si el input de nombre está vacío, y la frase no empieza por comandos típicos
        // intentamos limpiar la frase de las otras partes detectadas.
        // Por robustez, preferimos que si no está el nombre, preguntarlo explícitamente.
        // Pero si el usuario dice "Paracetamol de 500mg", "Paracetamol" es el nombre.

        const cleanText = text
            .replace(doseRegex, '')
            .replace(/(?:cada|una vez al|diario)\s*(?:\d+\s*horas?|día|dia)?/g, '') // Quitar frecuencia aprox
            .replace(timeRegex, '')
            .replace(/mañana|hoy|tomar|agregar|recordar|medicamento/g, '')
            .trim();

        if (cleanText.length > 2 && !this.inputs.name.value) {
            // Capitalizar primera letra
            data.name = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
        }

        return data;
    }

    fillForm(data) {
        if (data.name && !this.inputs.name.value) this.inputs.name.value = data.name;
        if (data.dose) this.inputs.dose.value = data.dose; // Sobrescribe para corregir
        if (data.frequency) this.inputs.frequency.value = data.frequency;
        if (data.time) this.inputs.time.value = data.time;
        if (data.date && !this.inputs.date.value) this.inputs.date.value = data.date;

        // Si falta fecha pero tenemos hora, asumimos HOY por defecto visualmente
        if (!this.inputs.date.value) {
            const today = new Date().toISOString().split('T')[0];
            this.inputs.date.value = today;
        }
    }

    checkMissingFields() {
        const missing = [];
        if (!this.inputs.name.value) missing.push('name');
        if (!this.inputs.dose.value) missing.push('dose');
        if (!this.inputs.frequency.value) missing.push('frequency');
        if (!this.inputs.time.value) missing.push('time');
        // La fecha ya la pre-rellenamos con "hoy" si falta, así que no suele faltar
        return missing;
    }
}