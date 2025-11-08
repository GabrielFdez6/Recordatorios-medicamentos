// --- main.js (Versión CORREGIDA con Bucle Silencioso) ---

/**
 * =======================================================
 * SECCIÓN 0: CARGADOR DE TEMA
 * =======================================================
 */
(function () {

    const theme = localStorage.getItem('theme') || 'dark';
    const html = document.documentElement;
    html.classList.remove('dark', 'light', 'high-contrast');
    if (theme !== 'light') {
        html.classList.add(theme);
    }
})();

/**
 * =======================================================
 * SECCIÓN 0.5: CARGADOR de TAMAÑO DE FUENTE
 * =======================================================
 */
(function () {

    const sizeMap = ['85%', '92.5%', '100%', '107.5%', '115%'];
    const savedSizeIndex = localStorage.getItem('fontSize') || '2';
    const sizeValue = sizeMap[parseInt(savedSizeIndex, 10)] || '100%';
    document.documentElement.style.fontSize = sizeValue;
})();


/**
 * =======================================================
 * SECCIÓN 1: PERMISOS Y LÓGICA DE INICIO (¡CORREGIDA!)
 * =======================================================
 */

// --- ⬇️ INICIO DEL CAMBIO 1 (MODIFICADO) ⬇️ ---
// Detener AMBOS sonidos al cambiar de página
window.addEventListener('beforeunload', () => {
    const alarmSound = document.getElementById('alarm-sound');
    if (alarmSound) {
        alarmSound.pause();
        alarmSound.currentTime = 0;
    }

    // Añadido para detener el bucle silencioso
    const silentLoop = document.getElementById('silent-loop');
    if (silentLoop) {
        silentLoop.pause();
    }
});
// --- ⬆️ FIN DEL CAMBIO 1 ⬆️ ---


document.addEventListener('DOMContentLoaded', () => {

    // --- ⬇️ INICIO DEL CAMBIO 2 (REESCRITO) ⬇️ ---
    // --- ARRANQUE DE AUDIO CON BUCLE SILENCIOSO ---
    const alarmSoundForPriming = document.getElementById('alarm-sound');
    const silentLoopSound = document.getElementById('silent-loop');

    function primeAudioOnClick() {

        // Revisar si ya lo hicimos en esta sesión
        function primeAudioOnClick() {

            // --- ⬇️ INICIO DE LA CORRECCIÓN ⬇️ ---
            // Si la alarma ya está visible, no ejecutar esta función.
            // El clic debe ser para el slider, no para 'preparar' el audio.
            const modalAlarma = document.getElementById('alarm-modal');
            if (modalAlarma && !modalAlarma.classList.contains('hidden')) {
                return; // No hacer nada, la alarma está activa.
            }
            // --- ⬆️ FIN DE LA CORRECCIÓN ⬆️ ---

            // Revisar si ya lo hicimos en esta sesión
            if (sessionStorage.getItem('isAudioPrimed') === 'true' || !alarmSoundForPriming) {
                return; // Ya está desbloqueado en esta sesión
            }

            console.log("Intentando preparar AMBOS audios (silenciosamente)...");

            // 1. Prepara el audio de la ALARMA (silenciado)
            alarmSoundForPriming.muted = true;
            const alarmPromise = alarmSoundForPriming.play();

            // 2. Prepara el BUCLE SILENCIOSO (con volumen 0)
            let loopPromise = Promise.resolve(); // Promesa vacía por si no existe
            if (silentLoopSound) {
                silentLoopSound.muted = false; // El audio ya es silencioso de por sí
                silentLoopSound.volume = 0;    // Doble seguro
                loopPromise = silentLoopSound.play();
            }

            // 3. Esperar a que AMBOS se desbloqueen
            Promise.all([alarmPromise, loopPromise])
                .then(() => {
                    // ¡Éxito! Pausamos la alarma...
                    alarmSoundForPriming.pause();
                    alarmSoundForPriming.currentTime = 0;
                    alarmSoundForPriming.muted = false; // ¡Importante! Quitar mute

                    // ...PERO dejamos el bucle silencioso sonando (con volumen 0)
                    if (silentLoopSound) {
                        silentLoopSound.volume = 0;
                        console.log("¡Bucle silencioso iniciado! Permiso de audio mantenido.");
                    }

                    // Guardar en la sesión
                    sessionStorage.setItem('isAudioPrimed', 'true');
                    console.log("¡Audio preparado (desbloqueado)!");

                    // Removemos los listeners
                    document.removeEventListener('click', primeAudioOnClick);
                    document.removeEventListener('touchstart', primeAudioOnClick);

                }).catch(error => {
                    // Si falla, lo intentará en el próximo clic
                    console.warn("Fallo al preparar el audio (esperando más interacción):", error.name);

                    // Pausar ambos por si acaso
                    alarmSoundForPriming.pause();
                    alarmSoundForPriming.muted = false;
                    if (silentLoopSound) silentLoopSound.pause();
                });
        }

        // Adjuntamos el "primer" al primer clic o toque en CUALQUIER LUGAR
        document.addEventListener('click', primeAudioOnClick);
        document.addEventListener('touchstart', primeAudioOnClick);
        // --- ⬆️ FIN DEL CAMBIO 2 ⬆️ ---


        // (¡NUEVO!) Revisar si hay una alarma pendiente al cargar la app
        // Esto se activa cuando el usuario abre la app desde una notificación
        try {
            const pendingAlarmJson = localStorage.getItem('pendingAlarm');
            if (pendingAlarmJson) {
                const recordatorio = JSON.parse(pendingAlarmJson);
                localStorage.removeItem('pendingAlarm'); // Limpiar para que no se repita

                // Esperar un breve momento para que la UI cargue
                setTimeout(() => {
                    showAlarm(recordatorio);
                }, 100);
            }
        } catch (e) {
            console.error("Error al procesar alarma pendiente:", e);
            localStorage.removeItem('pendingAlarm');
        }


        // Pedir permisos de notificación
        if ("Notification" in window) {
            if (Notification.permission === "default") {
                Notification.requestPermission().then((permission) => {
                    if (permission === "granted") {
                        new Notification("¡Gracias!", { body: "Ahora recibirás tus recordatorios." });
                    }
                });
            }
        }

        // (¡NUEVO!) Inicializar la lógica de la alarma (está en la SECCIÓN 7)
        initAlarmSlider();

        // =======================================================
        // SECCIÓN 2: LÓGICA DE LA PÁGINA DE INICIO (INDEX)
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

        // =======================================================
        // SECCIÓN 2.5: LÓGICA DE LA PÁGINA DE PERFIL (¡MODIFICADA!)
        // =======================================================

        const btnBack = document.getElementById('btn-back');

        // Solo ejecutar esta lógica si estamos en la página de perfil (btnBack existe)

        if (btnBack) {

            // --- 1. Definir estados y elementos ---

            let initialState = {};
            let currentState = {};

            // Elementos del Modal

            const modalBackdrop = document.getElementById('modal-backdrop');
            const modalBtnSave = document.getElementById('modal-btn-save');

            const modalBtnDiscard = document.getElementById('modal-btn-discard');

            // Elementos de Tema

            const themeSelector = document.getElementById('theme-selector');
            const lightBtn = document.getElementById('btn-theme-light');

            const darkBtn = document.getElementById('btn-theme-dark');
            const contrastBtn = document.getElementById('btn-theme-contrast');

            const themeButtons = [lightBtn, darkBtn, contrastBtn];
            const inactiveClasses = 'border-slate-700';

            const activeClasses = 'border-primary bg-primary/10';

            // Elementos de Fuente

            const fontSizeSlider = document.getElementById('fontSize');
            const sizeMap = ['85%', '92.5%', '100%', '107.5%', '115%'];

            // Elementos de Perfil

            const inputFullName = document.getElementById('fullName');
            const inputEmail = document.getElementById('email');

            const headerName = document.getElementById('header-name');
            const headerEmail = document.getElementById('header-email');

            // Elemento de Sonido

            const volumeSlider = document.getElementById('volumeSlider');

            // --- 2. Funciones de Carga y Guardado ---


            function loadInitialState() {
                initialState = {

                    theme: localStorage.getItem('theme') || 'dark',
                    fontSize: localStorage.getItem('fontSize') || '2',
                    name: localStorage.getItem('profileName') || 'Carlos Pérez',
                    email: localStorage.getItem('profileEmail') || 'carlos.perez@ejemplo.com',
                    volume: localStorage.getItem('profileVolume') || '75'
                };
                // El estado actual empieza igual que el inicial

                currentState = { ...initialState };
            }

            function loadUiFromState(state) {

                // Cargar Tema
                document.documentElement.classList.remove('dark', 'light', 'high-contrast');

                if (state.theme !== 'light') {
                    document.documentElement.classList.add(state.theme);
                }

                updateButtonState(state.theme);

                // Cargar Fuente

                document.documentElement.style.fontSize = sizeMap[state.fontSize];
                fontSizeSlider.value = state.fontSize;

                // Cargar Perfil

                inputFullName.value = state.name;
                inputEmail.value = state.email;

                headerName.textContent = state.name;
                headerEmail.textContent = state.email;

                // Cargar Volumen

                volumeSlider.value = state.volume;
            }


            function saveCurrentState() {
                localStorage.setItem('theme', currentState.theme);

                localStorage.setItem('fontSize', currentState.fontSize);
                localStorage.setItem('profileName', currentState.name);

                localStorage.setItem('profileEmail', currentState.email);
                localStorage.setItem('profileVolume', currentState.volume);
                // Sincronizar initialState para que no vuelva a preguntar

                initialState = { ...currentState };
            }

            function updateButtonState(currentTheme) {

                const activeClassesArray = activeClasses.split(' ');
                themeButtons.forEach(btn => {

                    btn.classList.remove(...activeClassesArray);
                    btn.classList.add(inactiveClasses);
                });

                if (currentTheme === 'light') {

                    lightBtn.classList.add(...activeClassesArray);
                    lightBtn.classList.remove(inactiveClasses);
                } else if (currentTheme === 'dark') {

                    darkBtn.classList.add(...activeClassesArray);
                    darkBtn.classList.remove(inactiveClasses);
                } else if (currentTheme === 'high-contrast') {

                    contrastBtn.classList.add(...activeClassesArray);
                    contrastBtn.classList.remove(inactiveClasses);
                }
            }

            // --- 3. Inicializar la página ---

            loadInitialState();
            loadUiFromState(initialState);


            // --- 4. Listeners (¡YA NO GUARDAN!) ---


            // Tema
            lightBtn.addEventListener('click', () => {

                document.documentElement.classList.remove('dark', 'high-contrast');
                currentState.theme = 'light';
                updateButtonState('light');
            });
            darkBtn.addEventListener('click', () => {

                document.documentElement.classList.remove('light', 'high-contrast');
                document.documentElement.classList.add('dark');
                currentState.theme = 'dark';
                updateButtonState('dark');
            });
            contrastBtn.addEventListener('click', () => {

                document.documentElement.classList.remove('light', 'dark');
                document.documentElement.classList.add('high-contrast');
                currentState.theme = 'high-contrast';
                updateButtonState('high-contrast');
            });

            // Fuente

            fontSizeSlider.addEventListener('input', () => {
                const newIndex = fontSizeSlider.value;

                currentState.fontSize = newIndex;
                document.documentElement.style.fontSize = sizeMap[newIndex];
            });

            // Perfil

            inputFullName.addEventListener('input', () => {
                const newName = inputFullName.value;

                currentState.name = newName;
                headerName.textContent = newName;
            });
            inputEmail.addEventListener('input', () => {

                const newEmail = inputEmail.value;
                currentState.email = newEmail;
                headerEmail.textContent = newEmail;
            });

            // Volumen

            volumeSlider.addEventListener('input', () => {
                currentState.volume = volumeSlider.value;
            });

            // --- 5. Lógica de Salida (Modal) ---


            btnBack.addEventListener('click', (event) => {
                event.preventDefault(); // ¡Detener la navegación!

                const hasChanges =

                    initialState.theme !== currentState.theme ||
                    initialState.fontSize !== currentState.fontSize ||
                    initialState.name !== currentState.name ||
                    initialState.email !== currentState.email ||
                    initialState.volume !== currentState.volume;

                if (hasChanges) {

                    // Si hay cambios, mostrar modal
                    modalBackdrop.classList.remove('hidden');
                } else {

                    // Si no hay cambios, navegar
                    window.location.href = btnBack.href;
                }
            });

            modalBtnSave.addEventListener('click', () => {

                saveCurrentState(); // Guardar
                modalBackdrop.classList.add('hidden');
                window.location.href = btnBack.href; // Navegar
            });

            // (¡MODIFICADO!) Flujo de "No" actualizado
            modalBtnDiscard.addEventListener('click', () => {
                // 1. No guardar, revertir la UI al estado original
                loadUiFromState(initialState);
                // 2. Sincronizar el estado actual de vuelta al original
                currentState = { ...initialState };
                // 3. Ocultar el modal
                modalBackdrop.classList.add('hidden');
                // 4. NO navegar, quedarse en la página
            });
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

        // ¡Importante! Asegurarse de que la primera dosis sea en el futuro
        // Si la hora de inicio ya pasó hoy, calcular la siguiente dosis
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
* SECCIÓN 4: EL MOTOR DE NOTIFICACIONES (¡MODIFICADO!)
* =======================================================
*/
function revisarRecordatorios() {

    const ahoraTimestamp = Date.now();
    let recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];

    let listaHaCambiado = false;

    // (¡NUEVO!) No mostrar alarma si ya hay una visible
    const modalAlarma = document.getElementById('alarm-modal');
    if (!modalAlarma || !modalAlarma.classList.contains('hidden')) {
        return; // Ya hay una alarma activa, no hacer nada
    }

    recordatorios.forEach(recordatorio => {

        // Comprobación de precisión: solo activar si está dentro del último segundo
        // (ahoraTimestamp - proximaDosis) < 1000ms (la duración de nuestro intervalo)
        const diferencia = ahoraTimestamp - recordatorio.proximaDosis;

        // Activar si la hora es AHORA (o un poco tarde, pero dentro de nuestro intervalo de 1seg)
        if (recordatorio.proximaDosis <= ahoraTimestamp && diferencia < 1000) {

            // (¡NUEVO!) Lógica de Alarma
            if (document.hidden) {
                // 1. App está en segundo plano o cerrada
                // Guardar la alarma para mostrarla al abrir
                localStorage.setItem('pendingAlarm', JSON.stringify(recordatorio));

                // Enviar notificación estándar
                new Notification(`¡Hora de tu medicamento!`, {
                    body: `Es hora de tomar tu ${recordatorio.nombre} (${recordatorio.dosis}).`,
                    tag: `med-${recordatorio.id}`, // Agrupar notificaciones
                    sound: 'sounds/alarm.mp3', // Ignorado en móviles, pero está bien tenerlo
                    vibrate: [200, 100, 200]
                });

            } else {
                // 2. App está abierta y visible
                // ¡Esto es lo que quieres ver en tus pruebas!
                // Mostrar la alarma en pantalla completa
                showAlarm(recordatorio);
            }

            // Actualizar la hora de la próxima dosis
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

// --- ¡ESTE ES EL CAMBIO IMPORTANTE! ---
// Revisar cada segundo para precisión, en lugar de cada 5 segundos.
setInterval(cicloPrincipal, 1000);


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
            
            <button type="button" class="btn-menu absolute top-3 right-3 flex size-12 items-center justify-center rounded-full bg-surface-dark text-white border border-zinc-600 hover:bg-zinc-700">
 
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

    // Reemplazar confirm() con un modal personalizado sería el siguiente paso
    if (!confirm("¿Estás seguro de que quieres borrar este medicamento?")) {

        return;
    }
    let recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];

    const nuevosRecordatorios = recordatorios.filter(r => r.id != idParaBorrar);
    localStorage.setItem('recordatorios', JSON.stringify(nuevosRecordatorios));

    const contenedorRecordatorios = document.getElementById('contenedor-recordatorios');

    if (contenedorRecordatorios) mostrarRecordatoriosIndex(contenedorRecordatorios);
}

/**
* =======================================================
* SECCIÓN 7: (¡NUEVO!) LÓGICA DE ALARMA FULLSCREEN
* =======================================================
*/

// --- Variables Globales para la Alarma ---
let alarmModal, alarmSound, sliderTrack, sliderThumb, sliderText;
let isDragging = false;
let startX = 0;
let thumbWidth = 0;
let maxDragX = 0;

/**
 * Muestra la pantalla de alarma con los datos del recordatorio
 */
function showAlarm(recordatorio) {
    // Obtener elementos (si no se han obtenido ya)
    if (!alarmModal) alarmModal = document.getElementById('alarm-modal');
    if (!alarmSound) alarmSound = document.getElementById('alarm-sound');

    // Rellenar datos en el modal
    const iconEl = document.getElementById('alarm-icon');
    const timeEl = document.getElementById('alarm-time');
    const nameEl = document.getElementById('alarm-name');
    const doseEl = document.getElementById('alarm-dose');

    // Poner icono
    let icon = 'pill';
    const nombreLower = recordatorio.nombre.toLowerCase();
    if (nombreLower.includes('insulina') || nombreLower.includes('inye')) icon = 'syringe';
    if (nombreLower.includes('gota')) icon = 'water_drop';
    iconEl.textContent = icon;

    // Poner textos
    timeEl.textContent = new Date(recordatorio.proximaDosis).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    nameEl.textContent = recordatorio.nombre;
    doseEl.textContent = recordatorio.dosis || 'Sin dosis';

    // Reproducir sonido (usando el volumen guardado)
    // --- ¡MODIFICADO! ---
    // Ahora usamos la Promesa de .play() para manejar el error de Autoplay
    try {
        const savedVolume = parseInt(localStorage.getItem('profileVolume') || '75', 10);
        alarmSound.volume = savedVolume / 100; // El volumen de HTML va de 0.0 a 1.0
        // Restaurar 'muted' por si acaso
        alarmSound.muted = false;

        const playPromise = alarmSound.play();

        if (playPromise !== undefined) {
            playPromise.then(_ => {
                // ¡Sonido iniciado!
            }).catch(error => {
                // ¡Bloqueado!
                console.error("El navegador bloqueó el sonido de la alarma.", error);
                // Aquí podríamos mostrar un ícono de "silencio" en la UI de la alarma
            });
        }
    } catch (e) {
        console.error("Error inesperado al intentar reproducir la alarma:", e);
    }

    // Mostrar el modal
    alarmModal.classList.remove('hidden');
}

/**
 * Oculta la pantalla de alarma y detiene el sonido
 */
function hideAlarm() {
    if (!alarmModal) alarmModal = document.getElementById('alarm-modal');
    if (!alarmSound) alarmSound = document.getElementById('alarm-sound');

    // Ocultar modal
    alarmModal.classList.add('hidden');

    // Detener y rebobinar el sonido
    // NOTA: NO detenemos el bucle silencioso. Ese sigue corriendo.
    alarmSound.pause();
    alarmSound.currentTime = 0;

    // Resetear el slider
    if (sliderThumb) {
        sliderThumb.style.transform = `translateX(0px)`;
        sliderThumb.style.transition = 'transform 0.3s ease';
        // Hacemos un pequeño timeout para que la transición de reseteo termine
        // y luego quitamos la transición para que el próximo drag sea instantáneo
        setTimeout(() => {
            sliderThumb.style.transition = '';
        }, 300);
    }
    if (sliderText) sliderText.style.opacity = '1';
}

/**
 * Inicializa la lógica del slider (arrastrar)
 */
function initAlarmSlider() {
    sliderTrack = document.getElementById('slider-track');
    sliderThumb = document.getElementById('slider-thumb');
    sliderText = document.getElementById('slider-text');

    if (!sliderTrack || !sliderThumb) return; // No estamos en una página con alarma

    // --- Funciones de Arrastre ---
    function onDragStart(e) {
        // Prevenir selección de texto
        e.preventDefault();
        isDragging = true;
        // Obtener la posición inicial (funciona para mouse y touch)
        startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;

        // Quitar transición para que el movimiento sea 1:1
        sliderThumb.style.transition = 'none';

        // Calcular límites
        thumbWidth = sliderThumb.offsetWidth;
        maxDragX = sliderTrack.offsetWidth - thumbWidth - 4; // -4 por los bordes/padding
    }

    function onDragMove(e) {
        if (!isDragging) return;

        const currentX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        let deltaX = currentX - startX;

        // Limitar el movimiento: no ir a la izquierda, no ir más allá del final
        if (deltaX < 0) deltaX = 0;
        if (deltaX > maxDragX) deltaX = maxDragX;

        // Mover el thumb
        sliderThumb.style.transform = `translateX(${deltaX}px)`;

        // Ocultar texto "Deslizar"
        const opacity = Math.max(0, 1 - (deltaX / (maxDragX / 2)));
        sliderText.style.opacity = opacity;
    }

    function onDragEnd(e) {
        if (!isDragging) return;
        isDragging = false;

        const currentTransform = sliderThumb.style.transform;
        const currentX = parseFloat(currentTransform.replace('translateX(', '').replace('px)', '')) || 0;

        // Comprobar si se deslizó lo suficiente (ej. 80% del camino)
        if (currentX > maxDragX * 0.8) {
            // ¡Deslizado! Ocultar alarma
            hideAlarm();
        } else {
            // No lo suficiente, regresar el thumb
            sliderThumb.style.transition = 'transform 0.3s ease';
            sliderThumb.style.transform = `translateX(0px)`;
            sliderText.style.opacity = '1';
        }
    }

    // --- Asignar Eventos (Mouse) ---
    sliderThumb.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove); // Escuchar en todo el documento
    document.addEventListener('mouseup', onDragEnd);     // Escuchar en todo el documento

    // --- Asignar Eventos (Táctil) ---
    sliderThumb.addEventListener('touchstart', onDragStart, { passive: true });
    document.addEventListener('touchmove', onDragMove); // Escuchar en todo el documento
    document.addEventListener('touchend', onDragEnd);     // Escuchar en todo el documento
}