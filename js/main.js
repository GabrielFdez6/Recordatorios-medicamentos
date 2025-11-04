// --- main.js (Versión Limpia y Final) ---

/**
 * =======================================================
 * SECCIÓN 1: PERMISOS DE NOTIFICACIÓN
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
            if (botonBorrar) {
                const idParaBorrar = botonBorrar.dataset.id;
                borrarRecordatorio(idParaBorrar);
            }
        });
    }

    const timeButton = document.getElementById('btn-time-picker');
    const timeInput = document.getElementById('med-time');
    if (timeButton && timeInput) {
        timeButton.addEventListener('click', () => {
            try {
                timeInput.showPicker();
            } catch (error) {
                timeInput.focus();
            }
        });
    }

    // --- Lógica de prueba manual ELIMINADA de aquí ---
});


/**
 * =======================================================
 * SECCIÓN 3: LÓGICA DE LA PÁGINA "AGREGAR"
 * =======================================================
 */
const botonAgregar = document.getElementById('btn-agregar');
if (botonAgregar) {
    botonAgregar.addEventListener('click', () => {
        const nombreMed = document.getElementById('med-name').value;
        const dosisMed = document.getElementById('med-dose').value;
        const frecuenciaMed = document.getElementById('med-frequency').value;
        const hora24 = document.getElementById('med-time').value;

        if (frecuenciaMed !== 'minuto' && !hora24) {
            alert("Por favor, ingrese el nombre y la hora.");
            return;
        }
        if (!nombreMed) {
            alert("Por favor, ingrese el nombre del medicamento.");
            return;
        }

        const horaMed = (frecuenciaMed === 'minuto') ? null : convertirHora24a12(hora24);
        let recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];

        const nuevoRecordatorio = {
            id: Date.now(),
            nombre: nombreMed,
            dosis: dosisMed,
            hora: horaMed,
            frecuencia: frecuenciaMed,
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
    const ahora = new Date();
    const horaActual = ahora.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    console.log(`Revisando... ${horaActual}`);

    let recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];
    let listaHaCambiado = false;

    recordatorios.forEach(recordatorio => {
        if (recordatorio.frecuencia === 'minuto') {
            new Notification(`¡Recordatorio (Cada Minuto)!`, {
                body: `Es hora de tomar tu ${recordatorio.nombre} (${recordatorio.dosis}).`
            });
        }
        else if (recordatorio.hora === horaActual && !recordatorio.completado) {
            new Notification(`¡Hora de tu medicamento!`, {
                body: `Es hora de tomar tu ${recordatorio.nombre} (${recordatorio.dosis}).`,
                tag: 'recordatorio-hora-' + recordatorio.id
            });
            recordatorio.completado = true;
            listaHaCambiado = true;
        }
    });

    if (listaHaCambiado) {
        console.log("Guardando estado 'completado' en localStorage.");
        localStorage.setItem('recordatorios', JSON.stringify(recordatorios));
    }
}

// --- ¡CAMBIO AQUÍ! ---
// Regresamos el temporizador a 60 segundos (60000 ms)
// para que no gaste tanta batería en el celular.
revisarRecordatorios();
setInterval(revisarRecordatorios, 60000); // Revisa cada 60 segundos


/**
* =======================================================
* SECCIÓN 5: FUNCIONES PARA MOSTRAR DATOS (Dibujar HTML)
* =======================================================
*/
function convertirHora24a12(hora24) {
    if (!hora24) return null;
    const [horas, minutos] = hora24.split(':');
    const fechaTemporal = new Date();
    fechaTemporal.setHours(horas, minutos, 0, 0);
    return fechaTemporal.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}
function convertirHoraA24(horaStr) {
    if (!horaStr || !horaStr.includes(' ')) {
        return 9999;
    }
    const [horaMin, ampm] = horaStr.split(' ');
    let [horas, minutos] = horaMin.split(':');
    horas = parseInt(horas, 10);
    if (ampm === 'PM' && horas !== 12) horas += 12;
    if (ampm === 'AM' && horas === 12) horas = 0;
    return (horas * 100) + parseInt(minutos, 10);
}
function crearTitulo(titulo) {
    return `<h2 class="text-3xl font-bold leading-tight tracking-[-0.015em] text-white pt-6 pb-2">${titulo}</h2>`;
}
function crearTarjetaRecordatorio(recordatorio) {
    let icon = 'pill';
    const nombreLower = recordatorio.nombre.toLowerCase();
    if (nombreLower.includes('insulina') || nombreLower.includes('inye')) icon = 'syringe';
    if (nombreLower.includes('gota')) icon = 'water_drop';
    const textoHora = recordatorio.frecuencia === 'minuto' ? 'Ahora' : recordatorio.hora;
    const colorBarra = recordatorio.frecuencia === 'minuto' ? 'bg-warning' : 'bg-primary';
    const colorIcono = recordatorio.frecuencia === 'minuto' ? 'text-warning' : 'text-primary';
    const opacidad = recordatorio.completado ? 'opacity-50' : '';
    return `
        <div class="relative flex items-stretch gap-4 overflow-hidden rounded-xl bg-card-dark p-5 ${opacidad}">
            <div class="absolute left-0 top-0 h-full w-1.5 ${colorBarra}"></div>
            <div class="flex flex-[2_2_0px] flex-col justify-center gap-1.5 pl-2">
                <p class="text-4xl font-bold text-white">${textoHora}</p>
                <p class="text-xl font-bold text-zinc-200">${recordatorio.nombre}</p>
                <p class="text-lg text-zinc-400">${recordatorio.dosis || 'Sin dosis'}</p>
            </div>
            <div class="flex flex-1 items-center justify-center rounded-xl bg-zinc-800">
                <span class="material-symbols-outlined text-5xl ${colorIcono}">${icon}</span>
            </div>
        </div>`;
}
function mostrarRecordatoriosIndex(contenedor) {
    const recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];
    contenedor.innerHTML = '';
    const recurrentes = recordatorios.filter(r => r.frecuencia === 'minuto');
    const proximos = recordatorios.filter(r => r.frecuencia !== 'minuto' && !r.completado);
    const completados = recordatorios.filter(r => r.frecuencia !== 'minuto' && r.completado);
    proximos.sort((a, b) => convertirHoraA24(a.hora) - convertirHoraA24(b.hora));
    let htmlFinal = '';
    if (recurrentes.length > 0) {
        htmlFinal += crearTitulo("Recurrentes (Prueba)");
        recurrentes.forEach(r => {
            htmlFinal += crearTarjetaRecordatorio(r);
        });
    }
    if (proximos.length > 0) {
        htmlFinal += crearTitulo("Próximos");
        proximos.forEach(r => {
            htmlFinal += crearTarjetaRecordatorio(r);
        });
    }
    if (completados.length > 0) {
        htmlFinal += crearTitulo("Completados");
        completados.forEach(r => {
            htmlFinal += crearTarjetaRecordatorio(r);
        });
    }
    if (htmlFinal === '') {
        contenedor.innerHTML = `
            <div class="rounded-xl bg-card-dark p-5 text-center">
                <p class="text-lg text-zinc-400">No tienes recordatorios programados.</p>
                <p class="text-sm text-zinc-500">Usa el botón "Agregar Recordatorio" para empezar.</p>
            </div>`;
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
        let textoFrecuencia = recordatorio.hora || '';
        if (recordatorio.frecuencia === 'minuto') {
            textoFrecuencia = 'Cada 1 minuto';
        }
        const colorIcono = recordatorio.frecuencia === 'minuto' ? 'bg-warning/20 text-warning' : 'bg-primary/20 text-primary';
        const opacidad = recordatorio.completado ? 'opacity-50' : '';
        const cardHTML = `
            <div class="flex cursor-pointer items-center gap-4 rounded-xl bg-zinc-900 p-4 ${opacidad}">
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


/**
* =======================================================
* SECCIÓN 6: LÓGICA DE BORRAR
* =======================================================
*/
function borrarRecordatorio(idParaBorrar) {
    if (!confirm("¿Estás seguro de que quieres borrar este medicamento?")) {
        return;
    }
    console.log("Borrando recordatorio con ID:", idParaBorrar);
    let recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];
    const nuevosRecordatorios = recordatorios.filter(r => r.id != idParaBorrar);
    localStorage.setItem('recordatorios', JSON.stringify(nuevosRecordatorios));

    // Recargamos ambas vistas
    const contenedorMedicamentos = document.getElementById('contenedor-medicamentos');
    if (contenedorMedicamentos) {
        mostrarMedicamentosLista(contenedorMedicamentos);
    }
    const contenedorRecordatorios = document.getElementById('contenedor-recordatorios');
    if (contenedorRecordatorios) {
        mostrarRecordatoriosIndex(contenedorRecordatorios);
    }
}