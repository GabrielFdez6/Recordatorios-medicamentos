// js/logic/audioLogic.js

export function aplicarVolumen(valor) {
    const audio = document.getElementById('alarm-sound');
    if (audio) {
        audio.volume = parseInt(valor) / 100;
    }
}

export function primeAllAudio() {
    if (sessionStorage.getItem('isAudioPrimed') === 'true') return Promise.resolve(true);
    const alarm = document.getElementById('alarm-sound');
    const silent = document.getElementById('silent-loop');
    if (!alarm) return Promise.resolve(false);

    alarm.muted = true;
    const p1 = alarm.play().then(() => {
        alarm.pause(); alarm.currentTime = 0; alarm.muted = false;
    }).catch(e => console.log("Audio block", e));

    let p2 = Promise.resolve();
    if (silent) {
        silent.muted = false; silent.volume = 0;
        p2 = silent.play();
    }

    return Promise.all([p1, p2]).then(() => {
        sessionStorage.setItem('isAudioPrimed', 'true');
        return true;
    });
}

export function stopAllAudio() {
    const alarm = document.getElementById('alarm-sound');
    const silent = document.getElementById('silent-loop');
    if (alarm) { alarm.pause(); alarm.currentTime = 0; }
    if (silent) silent.pause();
}

export function showAlarm(r) {
    const alarmModal = document.getElementById('alarm-modal');
    if (!alarmModal) return;

    document.getElementById('alarm-name').textContent = r.nombre;
    document.getElementById('alarm-time').textContent = new Date(r.proximaDosis).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    document.getElementById('alarm-dose').textContent = r.dosis || '';

    alarmModal.classList.remove('hidden');
    const alarmSound = document.getElementById('alarm-sound');
    if (alarmSound) {
        const vol = localStorage.getItem('profileVolume') || '100';
        alarmSound.volume = parseInt(vol) / 100;
        alarmSound.loop = true;
        alarmSound.play().catch(e => console.error(e));
    }
}

export function initAlarmSlider() {
    const track = document.getElementById('slider-track');
    const thumb = document.getElementById('slider-thumb');
    const text = document.getElementById('slider-text');
    if (!track || !thumb) return;

    let isDragging = false;
    let startX = 0;
    let maxDragX = 0;

    const endDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        const currentTransform = thumb.style.transform;
        const currentX = parseFloat(currentTransform.replace('translateX(', '').replace('px)', '')) || 0;

        if (currentX > maxDragX * 0.8) {
            document.getElementById('alarm-modal').classList.add('hidden');
            stopAllAudio();
            setTimeout(() => {
                thumb.style.transform = `translateX(0px)`;
                text.style.opacity = '1';
            }, 300);
        } else {
            thumb.style.transition = 'transform 0.3s ease';
            thumb.style.transform = `translateX(0px)`;
            text.style.opacity = '1';
        }
    };

    const startDrag = (e) => {
        isDragging = true;
        startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        thumb.style.transition = 'none';
        maxDragX = track.offsetWidth - thumb.offsetWidth - 4;
    };

    const moveDrag = (e) => {
        if (!isDragging) return;
        const currentX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        let deltaX = currentX - startX;
        if (deltaX < 0) deltaX = 0;
        if (deltaX > maxDragX) deltaX = maxDragX;
        thumb.style.transform = `translateX(${deltaX}px)`;
        text.style.opacity = Math.max(0, 1 - (deltaX / (maxDragX / 2)));
    };

    thumb.addEventListener('touchstart', startDrag, { passive: false });
    document.addEventListener('touchmove', moveDrag);
    document.addEventListener('touchend', endDrag);
    thumb.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('mouseup', endDrag);
}

export function revisarRecordatorios(callbackRefresh) {
    const ahora = Date.now();
    const alarmModal = document.getElementById('alarm-modal');
    if (!alarmModal || !alarmModal.classList.contains('hidden')) return;

    let records = JSON.parse(localStorage.getItem('recordatorios')) || [];
    let changed = false;

    records.forEach(r => {
        if (r.completado) return;
        if (r.fechaFin && r.proximaDosis > r.fechaFin) {
            r.completado = true; changed = true; return;
        }

        if (r.proximaDosis <= ahora && (ahora - r.proximaDosis) < 2000) {
            if (document.hidden) {
                new Notification(`Hora de medicina`, { body: `${r.nombre} - ${r.dosis}`, tag: `med-${r.id}` });
                localStorage.setItem('pendingAlarm', JSON.stringify(r));
            } else {
                showAlarm(r);
            }
            r.proximaDosis += (r.frecuencia * 60000); changed = true;
        }
    });

    if (changed) {
        localStorage.setItem('recordatorios', JSON.stringify(records));
        if (callbackRefresh) callbackRefresh();
    }
}