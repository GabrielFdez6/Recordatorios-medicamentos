export class MedicationFormAssistant {
    constructor(speechService) { // Recibimos speechService si hace falta, aunque aquí procesamos texto
        this.inputs = {
            name: document.getElementById('med-name'),
            frequency: document.getElementById('med-frequency'),
            time: document.getElementById('med-time'),
            date: document.getElementById('med-date'),
            dose: document.getElementById('med-dose') // Agregamos dosis al mapeo
        };
    }

    /**
     * Procesa el texto completo del dictado
     */
    fillFromText(fullText) {
        if (!fullText) return { success: false, missing: ['Todo'] };

        // 1. Normalizar texto
        let processingText = fullText.toLowerCase();
        processingText = this.wordsToNumbers(processingText);

        const data = {};

        // --- PASO A: EXTRAER Y BORRAR HORA ---
        const timeResult = this.extractTime(processingText);
        if (timeResult.found) {
            data.time = timeResult.value;
            processingText = timeResult.remainingText;
        }

        // --- PASO B: EXTRAER Y BORRAR FECHA ---
        const dateResult = this.extractDate(processingText);
        if (dateResult.found) {
            data.date = dateResult.value;
            processingText = dateResult.remainingText;
        } else {
            // Si no dicen fecha, por defecto HOY, pero validaremos si el usuario quiere ser estricto
            // Para este caso, lo llenamos pero podríamos marcarlo como pendiente si quisieras obligar a decirlo.
            // Dejaremos la fecha actual por defecto para facilitar la UX, salvo que esté vacía en el input.
            if (!this.inputs.date.value) {
                data.date = new Date().toISOString().split('T')[0];
            }
        }

        // --- PASO C: EXTRAER Y BORRAR FRECUENCIA ---
        const freqResult = this.extractFrequency(processingText);
        if (freqResult.found) {
            data.frequency = freqResult.value;
            processingText = freqResult.remainingText;
        }

        // --- PASO D: LIMPIEZA FINAL (NOMBRE Y DOSIS) ---
        // Intentamos inferir que lo que queda es el nombre y la dosis
        let remaining = processingText
            .replace(/agregar|nuevo|recordatorio|medicamento|tomar|iniciar|el dia|la fecha|hora|inicio/g, '')
            .replace(/con\s+frecuencia\s+de|con\s+frecuencia|frecuencia\s+de|frecuencia|cada/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (remaining.length > 0) {
            data.name = remaining.charAt(0).toUpperCase() + remaining.slice(1);
        }

        // --- LLENAR FORMULARIO ---
        if (data.name) this.inputs.name.value = data.name;
        if (data.time) this.inputs.time.value = data.time;
        if (data.date) this.inputs.date.value = data.date;
        if (data.frequency) this.inputs.frequency.value = data.frequency;

        // --- VALIDACIÓN ESTRICTA ---
        const missing = [];

        // Validamos si los inputs tienen valor (ya sea por el dictado o porque el usuario lo puso antes)
        if (!this.inputs.name.value) missing.push('Nombre del medicamento');
        if (!this.inputs.time.value) missing.push('Hora de inicio');
        if (!this.inputs.frequency.value) missing.push('Frecuencia');
        if (!this.inputs.date.value) missing.push('Fecha de inicio');

        return { success: missing.length === 0, missing: missing };
    }

    // ---------------------------------------------------------
    // HELPERS DE EXTRACCIÓN (Sin cambios mayores, funcionan bien)
    // ---------------------------------------------------------

    extractTime(text) {
        const timeRegex = /(?:a\s+las?|a\s+la|alas?|hora|inicio)\s*(\d{1,2})(?::(\d{2})|\s+(\d{2}))?\s*(am|pm|p\.m\.|a\.m\.|de\s+la\s+(?:mañana|tarde|noche|madrugada))?/i;

        const match = text.match(timeRegex);
        if (match) {
            let hours = parseInt(match[1]);
            let minutes = match[2] ? parseInt(match[2]) : (match[3] ? parseInt(match[3]) : 0);
            let period = (match[4] || '').toLowerCase().replace(/\./g, '').trim();

            if (period.includes('pm') || period.includes('tarde') || period.includes('noche')) {
                if (hours < 12) hours += 12;
            } else if (period.includes('am') || period.includes('mañana') || period.includes('madrugada')) {
                if (hours === 12) hours = 0;
            }

            const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
            return { found: true, value: formattedTime, remainingText: text.replace(match[0], ' ') };
        }
        return { found: false, remainingText: text };
    }

    extractDate(text) {
        const today = new Date();
        const numericDateRegex = /(?:el\s+)?(\d{1,2})(?:\s+(?:de|del)\s+|\s*[\/\-]\s*)(\d{1,2}|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:(?:\s+(?:de|del)\s+|\s*[\/\-]\s*)(\d{2,4}))?/i;
        const numericMatch = text.match(numericDateRegex);

        if (numericMatch) {
            let day = parseInt(numericMatch[1]);
            let monthRaw = numericMatch[2].toLowerCase();
            let year = numericMatch[3] ? parseInt(numericMatch[3]) : today.getFullYear();

            let monthIndex = -1;
            if (!isNaN(monthRaw)) {
                monthIndex = parseInt(monthRaw) - 1;
            } else {
                const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                monthIndex = months.indexOf(monthRaw);
            }

            if (monthIndex >= 0 && monthIndex <= 11) {
                if (year < 100) year += 2000;
                const targetDate = new Date(year, monthIndex, day);
                const yyyy = targetDate.getFullYear();
                const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
                const dd = String(targetDate.getDate()).padStart(2, '0');
                return { found: true, value: `${yyyy}-${mm}-${dd}`, remainingText: text.replace(numericMatch[0], ' ') };
            }
        }

        if (text.includes('mañana')) {
            const d = new Date(today); d.setDate(today.getDate() + 1);
            return { found: true, value: d.toISOString().split('T')[0], remainingText: text.replace('mañana', ' ') };
        }
        if (text.includes('hoy')) {
            return { found: true, value: today.toISOString().split('T')[0], remainingText: text.replace('hoy', ' ') };
        }

        const days = ['domingo', 'lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado'];
        for (let i = 0; i < days.length; i++) {
            if (text.includes(days[i])) {
                const currentDay = today.getDay();
                let daysToAdd = i - currentDay;
                if (daysToAdd <= 0) daysToAdd += 7;
                const d = new Date(today); d.setDate(today.getDate() + daysToAdd);
                const regex = new RegExp(`(?:el\\s+)?${days[i]}`, 'i');
                return { found: true, value: d.toISOString().split('T')[0], remainingText: text.replace(regex, ' ') };
            }
        }
        return { found: false, remainingText: text };
    }

    extractFrequency(text) {
        let freq = null;
        let matchRegex = null;
        const prefix = "(?:con\\s+frecuencia\\s+(?:de\\s+)?|cada\\s+)?";

        if (text.includes('8 hora') || text.includes('8 hrs')) {
            freq = '480'; matchRegex = new RegExp(prefix + "8\\s*(?:horas?|hrs)", "i");
        } else if (text.includes('12 hora') || text.includes('12 hrs')) {
            freq = '720'; matchRegex = new RegExp(prefix + "12\\s*(?:horas?|hrs)", "i");
        } else if (text.includes('24 hora') || text.includes('una vez') || text.includes('diario')) {
            freq = '1440'; matchRegex = new RegExp(prefix + "(?:24\\s*(?:horas?|hrs)|una\\s+vez(?:\\s+al\\s+d[ií]a)?|diario)", "i");
        } else if (text.includes('minuto') || text.includes('prueba')) {
            freq = '1'; matchRegex = new RegExp(prefix + "(?:1\\s+)?(?:minuto|prueba)", "i");
        }

        if (freq && matchRegex) {
            const match = text.match(matchRegex);
            if (match) return { found: true, value: freq, remainingText: text.replace(match[0], ' ') };
        }
        return { found: false, remainingText: text };
    }

    wordsToNumbers(text) {
        const map = {
            'una': '1', 'uno': '1', 'dos': '2', 'tres': '3', 'cuatro': '4',
            'cinco': '5', 'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9',
            'diez': '10', 'once': '11', 'doce': '12', 'trece': '13', 'catorce': '14',
            'quince': '15', 'dieciseis': '16', 'diecisiete': '17', 'dieciocho': '18',
            'diecinueve': '19', 'veinte': '20', 'veintiuno': '21', 'veintidos': '22',
            'veintitres': '23', 'veinticuatro': '24', 'veinticinco': '25',
            'treinta': '30', 'cuarenta': '40', 'cincuenta': '50',
            'media': '30', 'cuarto': '15'
        };
        let newText = text;
        newText = newText.replace(/y\s+media/g, '30').replace(/y\s+cuarto/g, '15');
        for (const [word, number] of Object.entries(map)) {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            newText = newText.replace(regex, number);
        }
        return newText;
    }
}