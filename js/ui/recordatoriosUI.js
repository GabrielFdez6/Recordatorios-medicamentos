// js/ui/recordatoriosUI.js

// Referencia local al servicio de voz para usarlo al guardar
let _speechService = null;

export function initRecordatoriosUI(speechService) {
    _speechService = speechService;

    // Listeners de botones globales
    const btnsAgregarVista = document.querySelectorAll('button[onclick*="vista-agregar"]');
    btnsAgregarVista.forEach(btn => {
        btn.addEventListener('click', () => prepararFormulario(null));
    });

    const btnGuardar = document.getElementById('btn-agregar');
    if (btnGuardar) btnGuardar.addEventListener('click', guardarRecordatorio);

    const timeBtn = document.getElementById('btn-time-picker');
    if (timeBtn) {
        timeBtn.addEventListener('click', () => {
            try { document.getElementById('med-time').showPicker(); }
            catch (e) { document.getElementById('med-time').focus(); }
        });
    }

    const contenedor = document.getElementById('contenedor-recordatorios');
    if (contenedor) {
        contenedor.addEventListener('click', (e) => {
            const btnDel = e.target.closest('.btn-borrar-menu');
            const btnEdit = e.target.closest('.btn-editar-menu');
            if (btnDel) { e.preventDefault(); e.stopPropagation(); borrarRecordatorio(btnDel.dataset.id); }
            if (btnEdit) { e.preventDefault(); e.stopPropagation(); editarRecordatorio(btnEdit.dataset.id); }
        });
    }

    setupAutocompleteSuggestions();
}

export function prepararFormulario(editData) {
    document.getElementById('med-name').value = '';
    document.getElementById('med-dose').value = '';
    document.getElementById('med-frequency').value = '480';
    document.getElementById('med-date').value = '';
    document.getElementById('med-date-end').value = '';
    document.getElementById('med-time').value = '';

    const btnSpan = document.getElementById('btn-agregar').querySelector('span');

    if (editData) {
        localStorage.setItem('currentEditId', editData.id);
        document.getElementById('med-name').value = editData.nombre;
        document.getElementById('med-dose').value = editData.dosis || '';
        document.getElementById('med-frequency').value = editData.frecuencia;

        const nextDate = new Date(editData.proximaDosis);
        const yyyy = nextDate.getFullYear();
        const mm = String(nextDate.getMonth() + 1).padStart(2, '0');
        const dd = String(nextDate.getDate()).padStart(2, '0');
        document.getElementById('med-date').value = `${yyyy}-${mm}-${dd}`;

        const hh = String(nextDate.getHours()).padStart(2, '0');
        const min = String(nextDate.getMinutes()).padStart(2, '0');
        document.getElementById('med-time').value = `${hh}:${min}`;

        if (btnSpan) btnSpan.textContent = 'Guardar Cambios';
    } else {
        localStorage.removeItem('currentEditId');
        if (btnSpan) btnSpan.textContent = 'Agregar';
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, '0');
        const dd = String(hoy.getDate()).padStart(2, '0');
        document.getElementById('med-date').value = `${yyyy}-${mm}-${dd}`;
    }
}

function guardarRecordatorio() {
    const nombre = document.getElementById('med-name').value;
    const frecuencia = document.getElementById('med-frequency').value;
    const fecha = document.getElementById('med-date').value;
    const hora = document.getElementById('med-time').value;
    const dosis = document.getElementById('med-dose').value;
    const fechaFin = document.getElementById('med-date-end').value;

    if (!nombre || !fecha || !hora) {
        if (_speechService && localStorage.getItem('voiceHelp') === 'true') {
            _speechService.speak("Faltan datos. Por favor completa nombre, fecha y hora.");
        } else {
            alert("Por favor completa el nombre, fecha y hora.");
        }
        return;
    }

    let records = JSON.parse(localStorage.getItem('recordatorios')) || [];

    const partesFecha = fecha.split('-').map(Number);
    const partesHora = hora.split(':').map(Number);
    const fechaObj = new Date();
    fechaObj.setFullYear(partesFecha[0], partesFecha[1] - 1, partesFecha[2]);
    fechaObj.setHours(partesHora[0], partesHora[1], 0, 0);

    let prox = fechaObj.getTime();
    if (prox <= Date.now()) {
        prox += (parseInt(frecuencia) * 60000);
    }

    const editId = localStorage.getItem('currentEditId');
    const nuevoItem = {
        id: editId ? parseInt(editId) : Date.now(),
        nombre,
        dosis,
        frecuencia: parseInt(frecuencia),
        proximaDosis: prox,
        fechaFin: fechaFin ? new Date(fechaFin).getTime() : null,
        completado: false
    };

    if (editId) {
        const index = records.findIndex(r => r.id == editId);
        if (index !== -1) records[index] = nuevoItem;
        localStorage.removeItem('currentEditId');
    } else {
        records.push(nuevoItem);
    }

    localStorage.setItem('recordatorios', JSON.stringify(records));

    const contenedor = document.getElementById('contenedor-recordatorios');
    if (contenedor) mostrarRecordatoriosIndex(contenedor);

    // Navegación
    if (window.navegarA) window.navegarA('vista-inicio');

    if (_speechService && localStorage.getItem('voiceHelp') === 'true') {
        _speechService.speak("Recordatorio guardado correctamente.");
    }
}

function editarRecordatorio(id) {
    const records = JSON.parse(localStorage.getItem('recordatorios')) || [];
    const item = records.find(r => r.id == id);
    if (item) {
        prepararFormulario(item);
        if (window.navegarA) window.navegarA('vista-agregar');
    }
}

function borrarRecordatorio(id) {
    if (!confirm("¿Seguro que quieres borrar este recordatorio?")) return;
    let r = JSON.parse(localStorage.getItem('recordatorios')) || [];
    r = r.filter(x => x.id != id);
    localStorage.setItem('recordatorios', JSON.stringify(r));
    const contenedor = document.getElementById('contenedor-recordatorios');
    if (contenedor) mostrarRecordatoriosIndex(contenedor);
}

export function mostrarRecordatoriosIndex(contenedor) {
    if (!contenedor) return;
    const records = JSON.parse(localStorage.getItem('recordatorios')) || [];
    contenedor.innerHTML = '';
    const active = records.filter(r => !r.completado);

    if (active.length === 0) {
        contenedor.innerHTML = `<div class="rounded-xl bg-card-dark p-8 text-center border border-zinc-800"><p class="text-xl text-zinc-500">No hay recordatorios pendientes.<br>¡Añade uno!</p></div>`;
        return;
    }

    active.sort((a, b) => a.proximaDosis - b.proximaDosis);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tomorrowStart = todayStart + 86400000;
    const dayAfterStart = tomorrowStart + 86400000;
    let html = '';
    let currentGroup = null;

    active.forEach(r => {
        let group = '';
        if (r.proximaDosis < tomorrowStart) group = 'Hoy';
        else if (r.proximaDosis < dayAfterStart) group = 'Mañana';
        else group = 'Más adelante';

        if (group !== currentGroup) {
            html += `<h2 class="text-2xl font-bold text-white pt-4 pb-2 sticky top-0 bg-background-dark/95 backdrop-blur-sm z-10">${group}</h2>`;
            currentGroup = group;
        }

        const date = new Date(r.proximaDosis).toLocaleTimeString('es-ES', { hour: 'numeric', minute: '2-digit', hour12: true });
        const color = r.frecuencia === 1 ? 'bg-warning' : 'bg-primary';

        html += `
        <div class="flex rounded-xl bg-card-dark overflow-hidden mb-3 border border-white/5 shadow-sm">
            <div class="w-2 ${color}"></div>
            <div class="flex-1 p-5">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="flex items-baseline gap-2">
                            <p class="text-3xl font-bold text-white">${date}</p>
                            ${r.dosis ? `<span class="text-lg text-zinc-400 font-medium">${r.dosis}</span>` : ''}
                        </div>
                        <p class="text-xl text-zinc-200 mt-1">${r.nombre}</p>
                    </div>
                </div>
                <div class="flex gap-3 mt-4">
                    <button class="btn-editar-menu flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 py-2 text-primary font-bold transition-colors hover:bg-zinc-700" data-id="${r.id}">Editar</button>
                    <button class="btn-borrar-menu flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 py-2 text-red-400 font-bold transition-colors hover:bg-zinc-700" data-id="${r.id}">Borrar</button>
                </div>
            </div>
        </div>`;
    });
    contenedor.innerHTML = html;
}

export function obtenerTextoRecordatorios() {
    const r = JSON.parse(localStorage.getItem('recordatorios')) || [];
    const hoy = r.filter(x => !x.completado && new Date(x.proximaDosis).getDate() === new Date().getDate());
    if (hoy.length === 0) return "No tienes nada pendiente para hoy.";
    return `Tienes ${hoy.length} medicinas hoy. ` + hoy.map(m => `${m.nombre} a las ${new Date(m.proximaDosis).getHours()} horas`).join('. ');
}

function setupAutocompleteSuggestions() {
    const input = document.getElementById('med-name');
    const box = document.getElementById('med-suggestions');
    if (!input || !box) return;
    const MEDICAMENTOS_COMUNES = ['Paracetamol', 'Ibuprofeno', 'Aspirina', 'Omeprazol', 'Amoxicilina', 'Loratadina', 'Metformina', 'Losartán', 'Atorvastatina', 'Salbutamol'];

    const hide = () => {
        box.classList.add('hidden');
        input.parentElement.classList.remove('rounded-t-xl');
    };

    input.addEventListener('input', () => {
        const val = input.value.toLowerCase().trim();
        box.innerHTML = '';
        if (val.length < 2) { hide(); return; }
        const matches = MEDICAMENTOS_COMUNES.filter(m => m.toLowerCase().startsWith(val));
        if (matches.length === 0) { hide(); return; }
        box.classList.remove('hidden');
        matches.forEach(m => {
            const div = document.createElement('div');
            div.className = 'p-4 text-white hover:bg-surface-dark cursor-pointer border-b border-gray-700 last:border-0';
            div.textContent = m;
            div.onclick = () => { input.value = m; hide(); };
            box.appendChild(div);
        });
    });

    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !box.contains(e.target)) hide();
    });
}