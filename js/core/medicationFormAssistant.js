export class MedicationFormAssistant {
    constructor() {
        this.inputs = {
            name: document.getElementById('med-name'),
            frequency: document.getElementById('med-frequency'),
            time: document.getElementById('med-time'),
            date: document.getElementById('med-date')
        };
    }

    /**
     * Procesa el texto completo del dictado
     */
    fillFromText(fullText) {
        if (!fullText) return { success: false, missing: [] };

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

        // --- PASO B: EXTRAER Y BORRAR FECHA (Lógica Mejorada) ---
        const dateResult = this.extractDate(processingText);
        if (dateResult.found) {
            data.date = dateResult.value;
            processingText = dateResult.remainingText;
        } else {
            // Default: Hoy (sin borrar texto)
            data.date = new Date().toISOString().split('T')[0];
        }

        // --- PASO C: EXTRAER Y BORRAR FRECUENCIA ---
        const freqResult = this.extractFrequency(processingText);
        if (freqResult.found) {
            data.frequency = freqResult.value;
            processingText = freqResult.remainingText;
        }

        // --- PASO D: LIMPIEZA FINAL (NOMBRE) ---
        let finalName = processingText
            .replace(/agregar|nuevo|recordatorio|medicamento|tomar|iniciar|el dia|la fecha/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (finalName.length > 0) {
            finalName = finalName.charAt(0).toUpperCase() + finalName.slice(1);
        }

        data.name = finalName;

        // --- LLENAR FORMULARIO ---
        if (data.name) this.inputs.name.value = data.name;
        if (data.time) this.inputs.time.value = data.time;
        if (data.date) this.inputs.date.value = data.date;
        if (data.frequency) this.inputs.frequency.value = data.frequency;

        // --- VALIDACIÓN ---
        const missing = [];
        if (!this.inputs.time.value) missing.push('Hora de inicio');
        if (!this.inputs.frequency.value) missing.push('Frecuencia');

        return { success: true, missing: missing };
    }

    // ---------------------------------------------------------
    // HELPERS DE EXTRACCIÓN
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

        // 1. FECHAS NUMÉRICAS (Ej: "18 del 11", "5 de octubre", "10/12/2025")
        // Grupo 1: Día, Grupo 2: Mes (número o nombre), Grupo 3: Año (Opcional)
        const numericDateRegex = /(?:el\s+)?(\d{1,2})(?:\s+(?:de|del)\s+|\s*[\/\-]\s*)(\d{1,2}|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:(?:\s+(?:de|del)\s+|\s*[\/\-]\s*)(\d{2,4}))?/i;

        const numericMatch = text.match(numericDateRegex);

        if (numericMatch) {
            let day = parseInt(numericMatch[1]);
            let monthRaw = numericMatch[2].toLowerCase();
            let year = numericMatch[3] ? parseInt(numericMatch[3]) : today.getFullYear();

            // Convertir nombre de mes a número (0-11)
            let monthIndex = -1;
            if (!isNaN(monthRaw)) {
                monthIndex = parseInt(monthRaw) - 1;
            } else {
                const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
                monthIndex = months.indexOf(monthRaw);
            }

            if (monthIndex >= 0 && monthIndex <= 11) {
                // Ajuste de año corto (ej: "25" -> 2025)
                if (year < 100) year += 2000;

                const targetDate = new Date(year, monthIndex, day);

                // Formato YYYY-MM-DD
                const yyyy = targetDate.getFullYear();
                const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
                const dd = String(targetDate.getDate()).padStart(2, '0');

                return {
                    found: true,
                    value: `${yyyy}-${mm}-${dd}`,
                    remainingText: text.replace(numericMatch[0], ' ')
                };
            }
        }

        // 2. PALABRAS CLAVE ("mañana", "hoy")
        if (text.includes('mañana')) {
            const d = new Date(today); d.setDate(today.getDate() + 1);
            return { found: true, value: d.toISOString().split('T')[0], remainingText: text.replace('mañana', ' ') };
        }
        if (text.includes('hoy')) {
            return { found: true, value: today.toISOString().split('T')[0], remainingText: text.replace('hoy', ' ') };
        }

        // 3. DÍAS DE LA SEMANA ("el lunes")
        const days = ['domingo', 'lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado'];
        for (let i = 0; i < days.length; i++) {
            if (text.includes(days[i])) {
                const currentDay = today.getDay();
                let daysToAdd = i - currentDay;
                if (daysToAdd <= 0) daysToAdd += 7;

                const d = new Date(today); d.setDate(today.getDate() + daysToAdd);
                // Borramos "el lunes" o solo "lunes"
                const regex = new RegExp(`(?:el\\s+)?${days[i]}`, 'i');
                return { found: true, value: d.toISOString().split('T')[0], remainingText: text.replace(regex, ' ') };
            }
        }

        return { found: false, remainingText: text };
    }

    extractFrequency(text) {
        let freq = null;
        let matchString = "";

        if (text.includes('8 hora') || text.includes('8 hrs')) { freq = '480'; matchString = /(?:cada\s+)?8\s*(?:horas?|hrs)/i; }
        else if (text.includes('12 hora') || text.includes('12 hrs')) { freq = '720'; matchString = /(?:cada\s+)?12\s*(?:horas?|hrs)/i; }
        else if (text.includes('24 hora') || text.includes('una vez') || text.includes('diario')) { freq = '1440'; matchString = /(?:cada\s+)?(?:24\s*(?:horas?|hrs)|una\s+vez(?:\s+al\s+d[ií]a)?|diario)/i; }
        else if (text.includes('minuto') || text.includes('prueba')) { freq = '1'; matchString = /(?:cada\s+)?(?:1\s+)?(?:minuto|prueba)/i; }

        if (freq) {
            return { found: true, value: freq, remainingText: text.replace(matchString, ' ') };
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