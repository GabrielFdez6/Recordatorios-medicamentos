// --- main.js (Versión con Lógica de TEMA, FUENTE y CONFIRMAR AL SALIR) ---

/**
 * =======================================================
 * SECCIÓN 0: CARGADOR DE TEMA
 * =======================================================
 */
(function () {
    // ... (código existente sin cambios)
    const theme = localStorage.getItem('theme') || 'dark';
    const html = document.documentElement;
    html.classList.remove('dark', 'light', 'high-contrast');
    if (theme !== 'light') {
        html.classList.add(theme);
    }
})();

/**
 * =======================================================
 * SECCIÓN 0.5: CARGADOR DE TAMAÑO DE FUENTE
 * =======================================================
 */
(function () {
    // ... (código existente sin cambios)
    const sizeMap = ['85%', '92.5%', '100%', '107.5%', '115%'];
    const savedSizeIndex = localStorage.getItem('fontSize') || '2';
    const sizeValue = sizeMap[parseInt(savedSizeIndex, 10)] || '100%';
    document.documentElement.style.fontSize = sizeValue;
})();


/**
 * =======================================================
 * SECCIÓN 1: PERMISOS Y LÓGICA DE INICIO
 * =======================================================
 */
document.addEventListener('DOMContentLoaded', () => {
    // ... (código existente sin cambios)
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
    // SECCIÓN 2: LÓGICA DE LA PÁGINA DE INICIO (INDEX)
    // =======================================================
    const contenedorRecordatorios = document.getElementById('contenedor-recordatorios');
    // ... (código existente sin cambios)
    if (contenedorRecordatorios) {
        mostrarRecordatoriosIndex(contenedorRecordatorios);

        contenedorRecordatorios.addEventListener('click', (event) => {
            // ... (código existente sin cambios)
            const botonMenu = event.target.closest('.btn-menu');
            const botonBorrar = event.target.closest('.btn-borrar-menu');
            // ... (código existente sin cambios)
            const botonEditar = event.target.closest('.btn-editar');

            const menuActual = botonMenu ? botonMenu.nextElementSibling : null;
            // ... (código existente sin cambios)
            document.querySelectorAll('.menu-recordatorio').forEach(menu => {
                if (menu !== menuActual) {
                    menu.classList.add('hidden');
                }
            });

            if (botonMenu) {
                // ... (código existente sin cambios)
                event.preventDefault();
                menuActual.classList.toggle('hidden');
            }
            else if (botonBorrar) {
                // ... (código existente sin cambios)
                event.preventDefault();
                borrarRecordatorio(botonBorrar.dataset.id);
            }
            else if (botonEditar) {
                // ... (código existente sin cambios)
                event.preventDefault();
                alert("Función 'Editar' aún no implementada.");
                botonEditar.closest('.menu-recordatorio').classList.add('hidden');
            }
            // ... (código existente sin cambios)
            else if (!event.target.closest('.menu-recordatorio')) {
                document.querySelectorAll('.menu-recordatorio').forEach(m => m.classList.add('hidden'));
            }
        });
    }

    // =======================================================
    // SECCIÓN 2.5: LÓGICA DE LA PÁGINA DE PERFIL (¡MODIFICADA!)
    // =======================================================
    // ... (código existente sin cambios)
    const btnBack = document.getElementById('btn-back');

    // Solo ejecutar esta lógica si estamos en la página de perfil (btnBack existe)
    // ... (código existente sin cambios)
    if (btnBack) {

        // --- 1. Definir estados y elementos ---
        // ... (código existente sin cambios)
        let initialState = {};
        let currentState = {};

        // Elementos del Modal
        // ... (código existente sin cambios)
        const modalBackdrop = document.getElementById('modal-backdrop');
        const modalBtnSave = document.getElementById('modal-btn-save');
        // ... (código existente sin cambios)
        const modalBtnDiscard = document.getElementById('modal-btn-discard');

        // Elementos de Tema
        // ... (código existente sin cambios)
        const themeSelector = document.getElementById('theme-selector');
        const lightBtn = document.getElementById('btn-theme-light');
        // ... (código existente sin cambios)
        const darkBtn = document.getElementById('btn-theme-dark');
        const contrastBtn = document.getElementById('btn-theme-contrast');
        // ... (código existente sin cambios)
        const themeButtons = [lightBtn, darkBtn, contrastBtn];
        const inactiveClasses = 'border-slate-700';
        // ... (código existente sin cambios)
        const activeClasses = 'border-primary bg-primary/10';

        // Elementos de Fuente
        // ... (código existente sin cambios)
        const fontSizeSlider = document.getElementById('fontSize');
        const sizeMap = ['85%', '92.5%', '100%', '107.5%', '115%'];

        // Elementos de Perfil
        // ... (código existente sin cambios)
        const inputFullName = document.getElementById('fullName');
        const inputEmail = document.getElementById('email');
        // ... (código existente sin cambios)
        const headerName = document.getElementById('header-name');
        const headerEmail = document.getElementById('header-email');

        // Elemento de Sonido
        // ... (código existente sin cambios)
        const volumeSlider = document.getElementById('volumeSlider');

        // --- 2. Funciones de Carga y Guardado ---

        // ... (código existente sin cambios)
        function loadInitialState() {
            initialState = {
                // ... (código existente sin cambios)
                theme: localStorage.getItem('theme') || 'dark',
                fontSize: localStorage.getItem('fontSize') || '2',
                name: localStorage.getItem('profileName') || 'Carlos Pérez',
                email: localStorage.getItem('profileEmail') || 'carlos.perez@ejemplo.com',
                volume: localStorage.getItem('profileVolume') || '75'
            };
            // El estado actual empieza igual que el inicial
            // ... (código existente sin cambios)
            currentState = { ...initialState };
        }

        function loadUiFromState(state) {
            // ... (código existente sin cambios)
            // Cargar Tema
            document.documentElement.classList.remove('dark', 'light', 'high-contrast');
            // ... (código existente sin cambios)
            if (state.theme !== 'light') {
                document.documentElement.classList.add(state.theme);
            }
            // ... (código existente sin cambios)
            updateButtonState(state.theme);

            // Cargar Fuente
            // ... (código existente sin cambios)
            document.documentElement.style.fontSize = sizeMap[state.fontSize];
            fontSizeSlider.value = state.fontSize;

            // Cargar Perfil
            // ... (código existente sin cambios)
            inputFullName.value = state.name;
            inputEmail.value = state.email;
            // ... (código existente sin cambios)
            headerName.textContent = state.name;
            headerEmail.textContent = state.email;

            // Cargar Volumen
            // ... (código existente sin cambios)
            volumeSlider.value = state.volume;
        }

        // ... (código existente sin cambios)
        function saveCurrentState() {
            localStorage.setItem('theme', currentState.theme);
            // ... (código existente sin cambios)
            localStorage.setItem('fontSize', currentState.fontSize);
            localStorage.setItem('profileName', currentState.name);
            // ... (código existente sin cambios)
            localStorage.setItem('profileEmail', currentState.email);
            localStorage.setItem('profileVolume', currentState.volume);
            // Sincronizar initialState para que no vuelva a preguntar
            // ... (código existente sin cambios)
            initialState = { ...currentState };
        }

        function updateButtonState(currentTheme) {
            // ... (código existente sin cambios)
            const activeClassesArray = activeClasses.split(' ');
            themeButtons.forEach(btn => {
                // ... (código existente sin cambios)
                btn.classList.remove(...activeClassesArray);
                btn.classList.add(inactiveClasses);
            });

            if (currentTheme === 'light') {
                // ... (código existente sin cambios)
                lightBtn.classList.add(...activeClassesArray);
                lightBtn.classList.remove(inactiveClasses);
            } else if (currentTheme === 'dark') {
                // ... (código existente sin cambios)
                darkBtn.classList.add(...activeClassesArray);
                darkBtn.classList.remove(inactiveClasses);
            } else if (currentTheme === 'high-contrast') {
                // ... (código existente sin cambios)
                contrastBtn.classList.add(...activeClassesArray);
                contrastBtn.classList.remove(inactiveClasses);
            }
        }

        // --- 3. Inicializar la página ---
        // ... (código existente sin cambios)
        loadInitialState();
        loadUiFromState(initialState);


        // --- 4. Listeners (¡YA NO GUARDAN!) ---

        // ... (código existente sin cambios)
        // Tema
        lightBtn.addEventListener('click', () => {
            // ... (código existente sin cambios)
            document.documentElement.classList.remove('dark', 'high-contrast');
            currentState.theme = 'light';
            updateButtonState('light');
        });
        darkBtn.addEventListener('click', () => {
            // ... (código existente sin cambios)
            document.documentElement.classList.remove('light', 'high-contrast');
            document.documentElement.classList.add('dark');
            currentState.theme = 'dark';
            updateButtonState('dark');
        });
        contrastBtn.addEventListener('click', () => {
            // ... (código existente sin cambios)
            document.documentElement.classList.remove('light', 'dark');
            document.documentElement.classList.add('high-contrast');
            currentState.theme = 'high-contrast';
            updateButtonState('high-contrast');
        });

        // Fuente
        // ... (código existente sin cambios)
        fontSizeSlider.addEventListener('input', () => {
            const newIndex = fontSizeSlider.value;
            // ... (código existente sin cambios)
            currentState.fontSize = newIndex;
            document.documentElement.style.fontSize = sizeMap[newIndex];
        });

        // Perfil
        // ... (código existente sin cambios)
        inputFullName.addEventListener('input', () => {
            const newName = inputFullName.value;
            // ... (código existente sin cambios)
            currentState.name = newName;
            headerName.textContent = newName;
        });
        inputEmail.addEventListener('input', () => {
            // ... (código existente sin cambios)
            const newEmail = inputEmail.value;
            currentState.email = newEmail;
            headerEmail.textContent = newEmail;
        });

        // Volumen
        // ... (código existente sin cambios)
        volumeSlider.addEventListener('input', () => {
            currentState.volume = volumeSlider.value;
        });

        // --- 5. Lógica de Salida (Modal) ---

        // ... (código existente sin cambios)
        btnBack.addEventListener('click', (event) => {
            event.preventDefault(); // ¡Detener la navegación!

            const hasChanges =
                // ... (código existente sin cambios)
                initialState.theme !== currentState.theme ||
                initialState.fontSize !== currentState.fontSize ||
                initialState.name !== currentState.name ||
                initialState.email !== currentState.email ||
                initialState.volume !== currentState.volume;

            if (hasChanges) {
                // ... (código existente sin cambios)
                // Si hay cambios, mostrar modal
                modalBackdrop.classList.remove('hidden');
            } else {
                // ... (código existente sin cambios)
                // Si no hay cambios, navegar
                window.location.href = btnBack.href;
            }
        });

        modalBtnSave.addEventListener('click', () => {
            // ... (código existente sin cambios)
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

    // ... (código existente sin cambios)
    const timeButton = document.getElementById('btn-time-picker');
    const timeInput = document.getElementById('med-time');
    // ... (código existente sin cambios)
    if (timeButton && timeInput) {
        timeButton.addEventListener('click', () => {
            // ... (código existente sin cambios)
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
// ... (código existente sin cambios)
if (botonAgregar) {
    botonAgregar.addEventListener('click', async () => {
        // ... (código existente sin cambios)
        let permission = Notification.permission;
        if (permission === "default") {
            // ... (código existente sin cambios)
            permission = await Notification.requestPermission();
        }
        if (permission === "denied") {
            alert("No has dado permiso para notificaciones. Para que funcione, debes activarlo en los Ajustes de tu iPhone.");
            // ... (código existente sin cambios)
            return;
        }

        const nombreMed = document.getElementById('med-name').value;
        // ... (código existente sin cambios)
        const dosisMed = document.getElementById('med-dose').value;
        const frecuenciaMed = document.getElementById('med-frequency').value;
        // ... (código existente sin cambios)
        const fechaInicio = document.getElementById('med-date').value;
        const horaInicio = document.getElementById('med-time').value;

        if (!nombreMed || !frecuenciaMed || !fechaInicio || !horaInicio) {
            alert("Por favor, rellena todos los campos: nombre, frecuencia, fecha y hora.");
            // ... (código existente sin cambios)
            return;
        }

        const ahoraTimestamp = Date.now();
        // ... (código existente sin cambios)
        const partesFecha = fechaInicio.split('-').map(Number);
        const partesHora = horaInicio.split(':').map(Number);
        // ... (código existente sin cambios)
        const fechaHoraInicio = new Date();
        fechaHoraInicio.setFullYear(partesFecha[0], partesFecha[1] - 1, partesFecha[2]);
        // ... (código existente sin cambios)
        fechaHoraInicio.setHours(partesHora[0], partesHora[1], 0, 0);

        let proximaDosisTimestamp = fechaHoraInicio.getTime();
        // ... (código existente sin cambios)
        const frecuenciaEnMS = parseInt(frecuenciaMed, 10) * 60000;

        while (proximaDosisTimestamp <= ahoraTimestamp) {
            // ... (código existente sin cambios)
            proximaDosisTimestamp += frecuenciaEnMS;
        }

        let recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];
        // ... (código existente sin cambios)
        const nuevoRecordatorio = {
            id: Date.now(),
            // ... (código existente sin cambios)
            nombre: nombreMed,
            dosis: dosisMed,
            // ... (código existente sin cambios)
            frecuencia: parseInt(frecuenciaMed, 10),
            proximaDosis: proximaDosisTimestamp,
            // ... (código existente sin cambios)
            completado: false
        };

        recordatorios.push(nuevoRecordatorio);
        // ... (código existente sin cambios)
        localStorage.setItem('recordatorios', JSON.stringify(recordatorios));
        alert("¡Recordatorio guardado con éxito!");

        window.location.href = "index.html";
        // ... (código existente sin cambios)
    });
}

/**
* =======================================================
* SECCIÓN 4: EL MOTOR DE NOTIFICACIONES Y ACTUALIZACIÓN
* =======================================================
*/
function revisarRecordatorios() {
    // ... (código existente sin cambios)
    const ahoraTimestamp = Date.now();
    let recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];
    // ... (código existente sin cambios)
    let listaHaCambiado = false;

    recordatorios.forEach(recordatorio => {
        // ... (código existente sin cambios)
        if (recordatorio.proximaDosis <= ahoraTimestamp) {
            new Notification(`¡Hora de tu medicamento!`, {
                // ... (código existente sin cambios)
                body: `Es hora de tomar tu ${recordatorio.nombre} (${recordatorio.dosis}).`
            });
            const frecuenciaEnMS = recordatorio.frecuencia * 60000;
            // ... (código existente sin cambios)
            recordatorio.proximaDosis = recordatorio.proximaDosis + frecuenciaEnMS;
            listaHaCambiado = true;
            // ... (código existente sin cambios)
        }
    });

    if (listaHaCambiado) {
        // ... (código existente sin cambios)
        localStorage.setItem('recordatorios', JSON.stringify(recordatorios));
    }
}

function refrescarListaIndex() {
    // ... (código existente sin cambios)
    const contenedorRecordatorios = document.getElementById('contenedor-recordatorios');
    if (contenedorRecordatorios) {
        // ... (código existente sin cambios)
        mostrarRecordatoriosIndex(contenedorRecordatorios);
    }
}

function cicloPrincipal() {
    // ... (código existente sin cambios)
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
    // ... (código existente sin cambios)
    const recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];
    contenedor.innerHTML = '';
    // ... (código existente sin cambios)
    const ahora = new Date();
    const inicioHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0).getTime();
    // ... (código existente sin cambios)
    const finHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59).getTime();
    const finManana = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + 1, 23, 59, 59).getTime();
    // ... (código existente sin cambios)
    const recordatoriosActivos = recordatorios.filter(r => r.proximaDosis >= inicioHoy);
    const hoy = recordatoriosActivos.filter(r => r.proximaDosis <= finHoy);
    // ... (código existente sin cambios)
    const manana = recordatoriosActivos.filter(r => r.proximaDosis > finHoy && r.proximaDosis <= finManana);
    const proximos = recordatoriosActivos.filter(r => r.proximaDosis > finManana);
    // ... (código existente sin cambios)
    hoy.sort((a, b) => a.proximaDosis - b.proximaDosis);
    manana.sort((a, b) => a.proximaDosis - b.proximaDosis);
    // ... (código existente sin cambios)
    proximos.sort((a, b) => a.proximaDosis - b.proximaDosis);
    let htmlFinal = '';
    // ... (código existente sin cambios)
    if (hoy.length > 0) {
        htmlFinal += crearTitulo("Hoy");
        // ... (código existente sin cambios)
        hoy.forEach(r => { htmlFinal += crearTarjetaRecordatorio(r); });
    }
    if (manana.length > 0) {
        // ... (código existente sin cambios)
        htmlFinal += crearTitulo("Mañana");
        manana.forEach(r => { htmlFinal += crearTarjetaRecordatorio(r); });
        // ... (código existente sin cambios)
    }
    if (proximos.length > 0) {
        // ... (código existente sin cambios)
        htmlFinal += crearTitulo("Próximos");
        proximos.forEach(r => { htmlFinal += crearTarjetaRecordatorio(r); });
        // ... (código existente sin cambios)
    }

    if (htmlFinal === '') {
        // ... (código existente sin cambios)
        contenedor.innerHTML = `<div class="rounded-xl bg-card-dark p-5 text-center"><p class="text-xl text-zinc-400">No tienes recordatorios programados.</p></div>`;
    } else {
        contenedor.innerHTML = htmlFinal;
        // ... (código existente sin cambios)
    }
}

function crearTitulo(titulo) {
    // ... (código existente sin cambios)
    return `<h2 class="text-3xl font-bold text-white pt-6">${titulo}</h2>`;
}

function crearTarjetaRecordatorio(recordatorio) {
    // ... (código existente sin cambios)
    let icon = 'pill';
    const nombreLower = recordatorio.nombre.toLowerCase();
    // ... (código existente sin cambios)
    if (nombreLower.includes('insulina') || nombreLower.includes('inye')) icon = 'syringe';
    if (nombreLower.includes('gota')) icon = 'water_drop';

    const horaFormato = new Date(recordatorio.proximaDosis).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const colorBarra = recordatorio.frecuencia === 1 ? 'bg-warning' : 'bg-primary';
    // ... (código existente sin cambios)
    const colorIcono = recordatorio.frecuencia === 1 ? 'text-warning' : 'text-primary';

    return `
        <div class="relative flex items-stretch gap-4 overflow-hidden rounded-xl bg-card-dark p-6 min-h-[11rem]">
            <div class="absolute left-0 top-0 h-full w-1.5 ${colorBarra}"></div>
// ... (código existente sin cambios)
            <div class="flex flex-[2_2_0px] flex-col justify-center gap-1.5 pl-3">
                
                <p class="text-5xl font-bold text-white">${horaFormato}</p>
                
// ... (código existente sin cambios)
                <p class="text-3xl font-bold text-zinc-200">${recordatorio.nombre}</p>
                
                <p class="text-2xl text-white">${recordatorio.dosis || 'Sin dosis'}</p>
// ... (código existente sin cambios)
            </div>
            
            <div class="flex flex-1 items-center justify-center rounded-xl bg-zinc-800">
// ... (código existente sin cambios)
                <span class="material-symbols-outlined text-6xl ${colorIcono}">${icon}</span>
            </div>
            
            <button type="button" class="btn-menu absolute top-3 right-3 flex size-12 items-center justify-center rounded-full bg-surface-dark text-white border border-zinc-600 hover:bg-zinc-700">
// ... (código existente sin cambios)
                <span class="material-symbols-outlined !text-3xl">more_vert</span>
            </button>

            <div class="menu-recordatorio absolute top-16 right-3 z-10 w-48 rounded-lg bg-surface-dark shadow-lg hidden overflow-hidden">
// ... (código existente sin cambios)
                <a href="#" data-id="${recordatorio.id}" class="btn-editar flex items-center gap-3 px-4 py-3 text-xl text-white hover:bg-zinc-700">
                    <span class="material-symbols-outlined">edit</span>
// ... (código existente sin cambios)
                    Editar
                </a>
                <a href="#" data-id="${recordatorio.id}" class="btn-borrar-menu flex items-center gap-3 px-4 py-3 text-xl text-red-400 hover:bg-zinc-700">
// ... (código existente sin cambios)
                    <span class="material-symbols-outlined">delete</span>
                    Eliminar
// ... (código existente sin cambios)
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
    // ... (código existente sin cambios)
    // Reemplazar confirm() con un modal personalizado sería el siguiente paso
    if (!confirm("¿Estás seguro de que quieres borrar este medicamento?")) {
        // ... (código existente sin cambios)
        return;
    }
    let recordatorios = JSON.parse(localStorage.getItem('recordatorios')) || [];
    // ... (código existente sin cambios)
    const nuevosRecordatorios = recordatorios.filter(r => r.id != idParaBorrar);
    localStorage.setItem('recordatorios', JSON.stringify(nuevosRecordatorios));

    const contenedorRecordatorios = document.getElementById('contenedor-recordatorios');
    // ... (código existente sin cambios)
    if (contenedorRecordatorios) mostrarRecordatoriosIndex(contenedorRecordatorios);
}