// --- main.js (Versión Corregida: Arreglo de Zona Horaria) ---

/**
 * =======================================================
 * SECCIÓN 1: PERMISOS Y LÓGICA DE INICIO
 * =======================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    if ("Notification" in window) {
        if (Notification.permission === "default") {
            Notification.requestPermission().then((permission) => {
                if (permission === "granted") {
                    new Notification("¡Gracias!", { body: "Ahora recibirás tus recordatorios." });
                }
            });
        }
    }

    // =======================================================
    // SECCIÓN 2: LÓGICA DE QUÉ PÁGINA MOSTRAR
    // =======================================================

    const contenedorRecordatorios = document.getElementById('contenedor-recordatorios');
    if (contenedorRecordatorios) {
        mostrarRecordatoriosIndex(contenedorRecordatorios);
    }

    const contenedorMedicamentos = document.getElementById('contenedor-medicamentos');
    if (contenedorMedicamentos) {
        mostrarMedicamentosLista(contenedorMedicamentos);
        contenedorMedicamentos.addEventListener('click', (event) => {
            const botonBorrar = event.target.closest('.btn-borrar');
            if (botonBorrar) borrarRecordatorio(botonBorrar.dataset.id);
        });
    }

    const timeButton = document.getElementById('btn-time-picker');
    const timeInput = document.getElementById('med-time');
    if (timeButton && timeInput) {
        timeButton.addEventListener('click', () => {
            try { timeInput.showPicker(); } catch (error) { timeInput.focus(); }
        });
    }
});


/**
 * =======================================================
 * SECCIÓN 3: LÓGICA DE LA PÁGINA "AGREGAR" (¡CORREGIDA!)
 * =======================================================
 */
const botonAgregar = document.getElementById('btn-agregar');
if (botonAgregar) {
    botonAgregar.addEventListener('click', async () => {

        let permission = Notification.permission;
        if (permission === "default") {
            console.log("Permiso 'default'. Solicitando...");
            permission = await Notification.requestPermission();
        }
        if (permission === "denied") {
            alert("No has dado permiso para notificaciones. Para que funcione, debes activarlo en los Ajustes de tu iPhone.");
            return;
        }

        console.log("Permiso OK. Guardando recordatorio...");

        const nombreMed = document.getElementById('med-name').value;
        const dosisMed = document.getElementById('med-dose').value;
        const frecuenciaMed = document.getElementById('med-frequency').value;
        const fechaInicio = document.getElementById('med-date').value; // ej: "2025-11-04"
        const horaInicio = document.getElementById('med-time').value; // ej: "19:15"

        if (!nombreMed || !frecuenciaMed || !fechaInicio || !horaInicio) {
            alert("Por favor, rellena todos los campos: nombre, frecuencia, fecha y hora.");
            return;
        }

        // --- ¡LÓGICA CORREGIDA AQUÍ! ---
        // 1. Partimos la fecha y hora para evitar problemas de zona horaria
        const partesFecha = fechaInicio.split('-').map(Number); // [2025, 11, 04]
        const partesHora = horaInicio.split(':').map(Number); // [19, 15]

        // 2. Creamos una fecha local vacía
        const fechaHoraInicio = new Date();

        // 3. Establecemos los componentes localmente
        // (el mes es 0-indexado, por eso 'partesFecha[1] - 1')
        fechaHoraInicio.setFullYear(partesFecha[0], partesFecha[1] - 1, partesFecha[2]);
        fechaHoraInicio.setHours(partesHora[0], partesHora[1], 0, 0); // (hora, min, seg, ms)

        // 4. AHORA SÍ obtenemos el timestamp local correcto
        const proximaDosisTimestamp = fechaHoraInicio.getTime();
        // --- FIN DE LA CORRECCIÓN ---


        let recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];
        const nuevoRecordatorio = {
            id: Date.now(),
            nombre: nombreMed,
            dosis: dosisMed,
            frecuencia: parseInt(frecuenciaMed, 10),
            proximaDosis: proximaDosisTimestamp, // ¡Guardamos el timestamp local!
            completado: false
        };

        recordatorios.push(nuevoRecordatorio);
        localStorage.setItem('recordatorios', JSON.stringify(recordatorios));
        alert("¡Recordatorio guardado con éxito!");
        window.location.href = "medicamentos.html";
    });
}

/**
* =======================================================
* SECCIÓN 4: EL MOTOR DE NOTIFICACIONES
* =======================================================
*/
function revisarRecordatorios() {
    const ahoraTimestamp = Date.now();
    console.log(`Revisando... ${new Date(ahoraTimestamp).toLocaleTimeString()}`);
    let recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];
    let listaHaCambiado = false;

    recordatorios.forEach(recordatorio => {
        if (recordatorio.proximaDosis <= ahoraTimestamp) {
            console.log("¡ES HORA! Notificando:", recordatorio.nombre);

            new Notification(`¡Hora de tu medicamento!`, {
                body: `Es hora de tomar tu ${recordatorio.nombre} (${recordatorio.dosis}).`
            });

            // Si es 'minuto', actualiza la próxima dosis para 1 min en el futuro
            if (recordatorio.frecuencia === 1) { // 1 minuto
                recordatorio.proximaDosis = ahoraTimestamp + (recordatorio.frecuencia * 60000);
            } else {
                // Si no, calcula la próxima dosis normal (ej. +12 horas)
                const frecuenciaEnMS = recordatorio.frecuencia * 60000;
                recordatorio.proximaDosis = recordatorio.proximaDosis + frecuenciaEnMS;
            }

            listaHaCambiado = true;
        }
    });

    if (listaHaCambiado) {
        console.log("Actualizando 'proximaDosis' en localStorage.");
        localStorage.setItem('recordatorios', JSON.stringify(recordatorios));
    }
}

// Volvemos a ponerlo en 60 segundos (valor de producción)
setInterval(revisarRecordatorios, 60000);


/**
* =======================================================
* SECCIÓN 5: FUNCIONES PARA MOSTRAR DATOS (Dibujar HTML)
* =======================================================
*/
// (Esta sección no necesita cambios, es idéntica a la anterior)
function mostrarRecordatoriosIndex(contenedor) {
    const recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];
    contenedor.innerHTML = '';
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0).getTime();
    const finHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59).getTime();
    const finManana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1, 23, 59, 59).getTime();

    // Filtramos los que ya pasaron
    const recordatoriosActivos = recordatorios.filter(r => r.proximaDosis >= inicioHoy);

    const hoy = recordatoriosActivos.filter(r => r.proximaDosis <= finHoy);
    const manana = recordatoriosActivos.filter(r => r.proximaDosis > finHoy && r.proximaDosis <= finManana);
    const proximos = recordatoriosActivos.filter(r => r.proximaDosis > finManana);

    hoy.sort((a, b) => a.proximaDosis - b.proximaDosis);
    manana.sort((a, b) => a.proximaDosis - b.proximaDosis);
    proximos.sort((a, b) => a.proximaDosis - b.proximaDosis);

    let htmlFinal = '';

    if (hoy.length > 0) {
        htmlFinal += crearTitulo("Hoy");
        hoy.forEach(r => { htmlFinal += crearTarjetaRecordatorio(r); });
    }
    if (manana.length > 0) {
        htmlFinal += crearTitulo("Mañana");
        manana.forEach(r => { htmlFinal += crearTarjetaRecordatorio(r); });
    }
    if (proximos.length > 0) {
        htmlFinal += crearTitulo("Próximos");
        proximos.forEach(r => { htmlFinal += crearTarjetaRecordatorio(r); });
    }

    if (htmlFinal === '') {
        contenedor.innerHTML = `<div class="rounded-xl bg-card-dark p-5 text-center"><p class="text-lg text-zinc-400">No tienes recordatorios programados.</p></div>`;
    } else {
        contenedor.innerHTML = htmlFinal;
    }
}
function mostrarMedicamentosLista(contenedor) {
    const recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];
    contenedor.innerHTML = '';
    if (recordatorios.length === 0) {
        contenedor.innerHTML = `<div class="rounded-xl bg-zinc-900 p-5 text-center"><p class="text-lg text-gray-400">No hay medicamentos guardados.</p></div>`;
    }

    recordatorios.sort((a, b) => b.id - a.id);

    recordatorios.forEach(recordatorio => {
        let icon = 'pill';
        const nombreLower = recordatorio.nombre.toLowerCase();
        if (nombreLower.includes('insulina') || nombreLower.includes('inye')) icon = 'syringe';
        if (nombreLower.includes('gota')) icon = 'water_drop';

        const proximaDosisFecha = new Date(recordatorio.proximaDosis);
        const horaFormato = proximaDosisFecha.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        let textoFrecuencia = `Próxima: ${proximaDosisFecha.toLocaleDateString()} a las ${horaFormato}`;
        if (recordatorio.frecuencia === 1) { // 1 minuto
            textoFrecuencia = `Cada 1 minuto (Inicia ${horaFormato})`;
        } else if (recordatorio.frecuencia === 720) {
            textoFrecuencia = `Cada 12 horas (Inicia ${horaFormato})`;
        } else if (recordatorio.frecuencia === 480) {
            textoFrecuencia = `Cada 8 horas (Inicia ${horaFormato})`;
        } else if (recordatorio.frecuencia === 1440) {
            textoFrecuencia = `Una vez al día (Inicia ${horaFormato})`;
        }

        const colorIcono = (recordatorio.frecuencia === 1) ? 'bg-warning/20 text-warning' : 'bg-primary/20 text-primary';

        const cardHTML = `
            <div class="flex cursor-pointer items-center gap-4 rounded-xl bg-zinc-900 p-4">
                <div class="flex size-14 shrink-0 items-center justify-center rounded-lg ${colorIcono}">
                    <span class="material-symbols-outlined !text-4xl">${icon}</span>
                </div>
                <div class="flex flex-1 flex-col justify-center">
                    <p class="text-xl font-bold text-white">${recordatorio.nombre}</p>
                    <p class="text-base font-normal text-gray-400">${recordatorio.dosis || 'Sin dosis'} - ${textoFrecuencia}</p>
                </div>
                <div class="shrink-0 flex gap-2">
                    <a href="#" class="flex size-10 items-center justify-center text-gray-400 hover:text-primary">
                        <span class="material-symbols-outlined !text-3xl">edit</span>
                    </a>
                    <button data-id="${recordatorio.id}" class="btn-borrar flex size-10 items-center justify-center text-gray-400 hover:text-red-500">
                        <span class="material-symbols-outlined !text-3xl">delete</span>
                    </button>
                </div>
            </div>`;
        contenedor.insertAdjacentHTML('beforeend', cardHTML);
    });
}
function crearTarjetaRecordatorio(recordatorio) {
    let icon = 'pill';
    const nombreLower = recordatorio.nombre.toLowerCase();
    if (nombreLower.includes('insulina') || nombreLower.includes('inye')) icon = 'syringe';
    if (nombreLower.includes('gota')) icon = 'water_drop';

    const horaFormato = new Date(recordatorio.proximaDosis).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const colorBarra = recordatorio.frecuencia === 1 ? 'bg-warning' : 'bg-primary';
    const colorIcono = recordatorio.frecuencia === 1 ? 'text-warning' : 'text-primary';

    return `
        <div class="relative flex items-stretch gap-4 overflow-hidden rounded-xl bg-card-dark p-5">
            <div class="absolute left-0 top-0 h-full w-1.5 ${colorBarra}"></div>
            <div class="flex flex-[2_2_0px] flex-col justify-center gap-1.5 pl-2">
                <p class="text-4xl font-bold text-white">${horaFormato}</p>
                <p class="text-xl font-bold text-zinc-200">${recordatorio.nombre}</p>
                <p class="text-lg text-zinc-400">${recordatorio.dosis || 'Sin dosis'}</p>
            </div>
            <div class="flex flex-1 items-center justify-center rounded-xl bg-zinc-800">
                <span class="material-symbols-outlined text-5xl ${colorIcono}">${icon}</span>
            </div>
        </div>`;
}


/**
* =======================================================
* SECCIÓN 6: LÓGICA DE BORRAR
* =======================================================
*/
function borrarRecordatorio(idParaBorrar) {
    if (!confirm("¿Estás seguro de que quieres borrar este medicamento?")) {
        return;
    }
    let recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];
    const nuevosRecordatorios = recordatorios.filter(r => r.id != idParaBorrar);
    localStorage.setItem('recordatorios', JSON.stringify(nuevosRecordatorios));

    // Recargamos ambas vistas
    const contenedorMedicamentos = document.getElementById('contenedor-medicamentos');
    if (contenedorMedicamentos) mostrarMedicamentosLista(contenedorMedicamentos);
    const contenedorRecordatorios = document.getElementById('contenedor-recordatorios');
    if (contenedorRecordatorios) mostrarRecordatoriosIndex(contenedorRecordatorios);
}