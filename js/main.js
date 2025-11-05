// --- main.js (Versión con Selector de Tema Funcional) ---

/**
 * =======================================================
 * SECCIÓN 0: CARGADOR DE TEMA (¡NUEVO!)
 * Se ejecuta de inmediato para evitar parpadeo.
 * =======================================================
 */
(function () {
    // 1. Obtiene el tema guardado o usa 'dark' por defecto.
    const theme = localStorage.getItem('theme') || 'dark';
    const html = document.documentElement;
    // 2. Limpia temas viejos
    html.classList.remove('dark', 'light', 'high-contrast');
    // 3. Aplica el tema actual
    html.classList.add(theme);
})();


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

        contenedorRecordatorios.addEventListener('click', (event) => {

            const botonMenu = event.target.closest('.btn-menu');
            const botonBorrar = event.target.closest('.btn-borrar-menu');
            const botonEditar = event.target.closest('.btn-editar');

            const menuActual = botonMenu ? botonMenu.nextElementSibling : null;
            document.querySelectorAll('.menu-recordatorio').forEach(menu => {
                if (menu !== menuActual) {
                    menu.classList.add('hidden');
                }
            });

            if (botonMenu) {
                event.preventDefault();
                menuActual.classList.toggle('hidden');
            }
            else if (botonBorrar) {
                event.preventDefault();
                borrarRecordatorio(botonBorrar.dataset.id);
            }
            else if (botonEditar) {
                event.preventDefault();
                alert("Función 'Editar' aún no implementada.");
                botonEditar.closest('.menu-recordatorio').classList.add('hidden');
            }
            else if (!event.target.closest('.menu-recordatorio')) {
                document.querySelectorAll('.menu-recordatorio').forEach(m => m.classList.add('hidden'));
            }
        });
    }

    // ===== ¡NUEVA LÓGICA PARA EL SELECTOR DE TEMA! =====
    const themeSelector = document.getElementById('theme-selector');
    if (themeSelector) {
        const lightBtn = document.getElementById('btn-theme-light');
        const darkBtn = document.getElementById('btn-theme-dark');
        const contrastBtn = document.getElementById('btn-theme-contrast');
        const buttons = [lightBtn, darkBtn, contrastBtn];

        const inactiveClasses = 'border-slate-700';
        const activeClasses = 'border-primary bg-primary/10';

        // Función para actualizar el estado visual de los botones
        function updateButtonState(currentTheme) {
            buttons.forEach(btn => {
                btn.classList.remove(activeClasses, activeClasses.replace('border-', 'border-'));
                btn.classList.add(inactiveClasses);
            });

            if (currentTheme === 'light') {
                lightBtn.classList.add(activeClasses);
                lightBtn.classList.remove(inactiveClasses);
            } else if (currentTheme === 'dark') {
                darkBtn.classList.add(activeClasses);
                darkBtn.classList.remove(inactiveClasses);
            } else if (currentTheme === 'high-contrast') {
                contrastBtn.classList.add(activeClasses);
                contrastBtn.classList.remove(inactiveClasses);
            }
        }

        // 1. Poner el estado visual correcto al cargar la página
        const savedTheme = localStorage.getItem('theme') || 'dark';
        updateButtonState(savedTheme);

        // 2. Añadir listeners para cambiar el tema
        lightBtn.addEventListener('click', () => setTheme('light'));
        darkBtn.addEventListener('click', () => setTheme('dark'));
        contrastBtn.addEventListener('click', () => setTheme('high-contrast'));

        function setTheme(theme) {
            // 1. Aplicar al HTML
            const html = document.documentElement;
            html.classList.remove('dark', 'light', 'high-contrast');
            html.classList.add(theme);

            // 2. Guardar en localStorage
            localStorage.setItem('theme', theme);

            // 3. Actualizar botones
            updateButtonState(theme);
        }
    }
    // ===================================================

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
 * SECCIÓN 3: LÓGICA DE LA PÁGINA "AGREGAR"
 * =======================================================
 */
const botonAgregar = document.getElementById('btn-agregar');
if (botonAgregar) {
    botonAgregar.addEventListener('click', async () => {
        let permission = Notification.permission;
        if (permission === "default") {
            permission = await Notification.requestPermission();
        }
        if (permission === "denied") {
            alert("No has dado permiso para notificaciones. Para que funcione, debes activarlo en los Ajustes de tu iPhone.");
            return;
        }

        const nombreMed = document.getElementById('med-name').value;
        const dosisMed = document.getElementById('med-dose').value;
        const frecuenciaMed = document.getElementById('med-frequency').value;
        const fechaInicio = document.getElementById('med-date').value;
        const horaInicio = document.getElementById('med-time').value;

        if (!nombreMed || !frecuenciaMed || !fechaInicio || !horaInicio) {
            alert("Por favor, rellena todos los campos: nombre, frecuencia, fecha y hora.");
            return;
        }

        const ahoraTimestamp = Date.now();
        const partesFecha = fechaInicio.split('-').map(Number);
        const partesHora = horaInicio.split(':').map(Number);
        const fechaHoraInicio = new Date();
        fechaHoraInicio.setFullYear(partesFecha[0], partesFecha[1] - 1, partesFecha[2]);
        fechaHoraInicio.setHours(partesHora[0], partesHora[1], 0, 0);

        let proximaDosisTimestamp = fechaHoraInicio.getTime();
        const frecuenciaEnMS = parseInt(frecuenciaMed, 10) * 60000;

        while (proximaDosisTimestamp <= ahoraTimestamp) {
            proximaDosisTimestamp += frecuenciaEnMS;
        }

        let recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];
        const nuevoRecordatorio = {
            id: Date.now(),
            nombre: nombreMed,
            dosis: dosisMed,
            frecuencia: parseInt(frecuenciaMed, 10),
            proximaDosis: proximaDosisTimestamp,
            completado: false
        };

        recordatorios.push(nuevoRecordatorio);
        localStorage.setItem('recordatorios', JSON.stringify(recordatorios));
        alert("¡Recordatorio guardado con éxito!");

        window.location.href = "index.html";
    });
}

/**
* =======================================================
* SECCIÓN 4: EL MOTOR DE NOTIFICACIONES Y ACTUALIZACIÓN
* =======================================================
*/
function revisarRecordatorios() {
    const ahoraTimestamp = Date.now();
    let recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];
    let listaHaCambiado = false;

    recordatorios.forEach(recordatorio => {
        if (recordatorio.proximaDosis <= ahoraTimestamp) {
            new Notification(`¡Hora de tu medicamento!`, {
                body: `Es hora de tomar tu ${recordatorio.nombre} (${recordatorio.dosis}).`
            });
            const frecuenciaEnMS = recordatorio.frecuencia * 60000;
            recordatorio.proximaDosis = recordatorio.proximaDosis + frecuenciaEnMS;
            listaHaCambiado = true;
        }
    });

    if (listaHaCambiado) {
        localStorage.setItem('recordatorios', JSON.stringify(recordatorios));
    }
}

function refrescarListaIndex() {
    const contenedorRecordatorios = document.getElementById('contenedor-recordatorios');
    if (contenedorRecordatorios) {
        mostrarRecordatoriosIndex(contenedorRecordatorios);
    }
}

function cicloPrincipal() {
    revisarRecordatorios();
    refrescarListaIndex();
}

setInterval(cicloPrincipal, 60000);


/**
* =======================================================
* SECCIÓN 5: FUNCIONES PARA MOSTRAR DATOS (Dibujar HTML)
* =======================================================
*/
function mostrarRecordatoriosIndex(contenedor) {
    const recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];
    contenedor.innerHTML = '';
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0).getTime();
    const finHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59).getTime();
    const finManana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1, 23, 59, 59).getTime();
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
        contenedor.innerHTML = `<div class="rounded-xl bg-card-dark p-5 text-center"><p class="text-xl text-zinc-400">No tienes recordatorios programados.</p></div>`;
    } else {
        contenedor.innerHTML = htmlFinal;
    }
}

function crearTitulo(titulo) {
    return `<h2 class="text-3xl font-bold text-white pt-6">${titulo}</h2>`;
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
        <div class="relative flex items-stretch gap-4 overflow-hidden rounded-xl bg-card-dark p-6 min-h-[11rem]">
            <div class="absolute left-0 top-0 h-full w-1.5 ${colorBarra}"></div>
            <div class="flex flex-[2_2_0px] flex-col justify-center gap-1.5 pl-3">
                
                <p class="text-5xl font-bold text-white">${horaFormato}</p>
                
                <p class="text-3xl font-bold text-zinc-200">${recordatorio.nombre}</p>
                
                <p class="text-2xl text-white">${recordatorio.dosis || 'Sin dosis'}</p>
            </div>
            
            <div class="flex flex-1 items-center justify-center rounded-xl bg-zinc-800">
                <span class="material-symbols-outlined text-6xl ${colorIcono}">${icon}</span>
            </div>
            
            <button class="btn-menu absolute top-3 right-3 flex size-12 items-center justify-center rounded-full bg-surface-dark text-white border border-zinc-600 hover:bg-zinc-700">
                <span class="material-symbols-outlined !text-3xl">more_vert</span>
            </button>

            <div class="menu-recordatorio absolute top-16 right-3 z-10 w-48 rounded-lg bg-surface-dark shadow-lg hidden overflow-hidden">
                <a href="#" data-id="${recordatorio.id}" class="btn-editar flex items-center gap-3 px-4 py-3 text-xl text-white hover:bg-zinc-700">
                    <span class="material-symbols-outlined">edit</span>
                    Editar
                </a>
                <a href="#" data-id="${recordatorio.id}" class="btn-borrar-menu flex items-center gap-3 px-4 py-3 text-xl text-red-400 hover:bg-zinc-700">
                    <span class="material-symbols-outlined">delete</span>
                    Eliminar
                </a>
            </div>
        </div>`;
}
// ===================================


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

    const contenedorRecordatorios = document.getElementById('contenedor-recordatorios');
    if (contenedorRecordatorios) mostrarRecordatoriosIndex(contenedorRecordatorios);
}