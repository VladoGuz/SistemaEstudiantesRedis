// Estado global simple
let currentUserId = localStorage.getItem('userId') || '';
let currentSessionId = localStorage.getItem('sessionId') || '';

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    if (currentUserId && currentSessionId) {
        showSessionInfo(currentSessionId);
        document.getElementById('userIdInput').value = currentUserId;
    }
    refreshLeaderboard();
});

// Helper para medir tiempo de fetch (Latencia HTTP + Procesamiento)
// Nota: Esto mide "tiempo total ronda de cliente", que es lo que percibe el usuario.
async function timedFetch(url, options = {}) {
    const start = performance.now();
    const res = await fetch(url, options);
    const end = performance.now();
    const duration = (end - start).toFixed(1);
    return { res, duration, data: await res.json() };
}

// --- SESSION ---
async function login() {
    const userId = document.getElementById('userIdInput').value;
    if (!userId) return alert('Ingresa un ID');

    const { data, duration } = await timedFetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
    });

    if (data.sessionId) {
        currentUserId = userId;
        currentSessionId = data.sessionId;
        localStorage.setItem('userId', userId);
        localStorage.setItem('sessionId', currentSessionId);
        showSessionInfo(currentSessionId);
        updateLatency('session-latency', duration);
    } else {
        alert('Error login');
    }
}

function logout() {
    localStorage.removeItem('sessionId');
    currentSessionId = '';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('session-info').style.display = 'none';
    document.getElementById('profile-data').innerHTML = 'Esperando consulta...';
}

function showSessionInfo(token) {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('session-info').style.display = 'block';
    document.getElementById('session-token').textContent = `Token: ${token.substring(0,20)}...`;
}

// --- PROFILE (CACHE) ---
async function loadProfile() {
    if (!currentUserId) return alert('Haz login primero');

    const { data, duration } = await timedFetch(`/api/users/${currentUserId}`);
    
    const div = document.getElementById('profile-data');
    div.innerHTML = `
        Nombre: ${data.data.name}<br>
        Origen: <b>${data.meta.source}</b>
    `;
    div.classList.remove('highlight');
    void div.offsetWidth; // trigger reflow
    div.classList.add('highlight'); // flash effect

    updateLatency('profile-latency', duration, data.meta.source === 'Redis Cache');
}

// --- LEADERBOARD ---
async function refreshLeaderboard() {
    const { data, duration } = await timedFetch('/api/leaderboard');
    
    const tbody = document.getElementById('leaderboard-body');
    tbody.innerHTML = '';
    
    data.forEach((item, index) => {
        const row = document.createElement('tr');
        const isMe = item.value === currentUserId;
        if (isMe) row.style.background = '#3a3a3a';
        
        row.innerHTML = `
            <td>#${index + 1}</td>
            <td>${item.value} ${isMe ? '(Tú)' : ''}</td>
            <td>${item.score.toFixed(2)}</td>
        `;
        tbody.appendChild(row);
    });

    updateLatency('leaderboard-latency', duration);
}

async function updateScore() {
    const score = document.getElementById('scoreInput').value;
    if (!currentUserId || !score) return alert('Login y puntaje requeridos');

    const { duration } = await timedFetch('/api/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, score })
    });

    updateLatency('leaderboard-latency', duration); // Reutilizamos badge
    refreshLeaderboard();
}

// --- BENCHMARK ---
async function runBenchmark() {
    const btn = document.querySelector('button[onclick="runBenchmark()"]');
    btn.disabled = true;
    btn.textContent = 'Calculando...';

    const { data } = await timedFetch('/api/benchmark');
    
    // Animate bars
    const max = Math.max(data.sql, data.redis * 20); // Scale factor for visibility
    const sqlWidth = Math.min(100, (data.sql / max) * 100);
    const redisWidth = Math.min(100, (data.redis / max) * 100); // Redis is so fast we might need min width

    document.getElementById('bar-sql').style.width = `${sqlWidth}%`;
    document.getElementById('text-sql').textContent = `${data.sql} ms`;

    document.getElementById('bar-redis').style.width = `${Math.max(1, redisWidth)}%`;
    document.getElementById('text-redis').textContent = `${data.redis} ms`;

    document.getElementById('benchmark-result').innerHTML = 
        `🚀 Redis es <span style="color:#d53f3f; font-size:1.2em;">${data.ratio}x</span> más rápido que SQL en esta prueba.`;

    btn.disabled = false;
    btn.textContent = '🔥 Iniciar Benchmark';
}

// --- STRESS TEST ---
async function runStressTest() {
    const btn = document.getElementById('btn-stress');
    const resultsDiv = document.getElementById('stress-results');
    
    btn.disabled = true;
    btn.innerHTML = '⚡ Ejecutando 1000 hilos concurrentes... <br><span style="font-size:0.8rem">(Esto puede tardar un poco)</span>';
    resultsDiv.style.display = 'none';

    try {
        const res = await fetch('/api/stress', { method: 'POST' });
        const data = await res.json();

        document.getElementById('stress-time').textContent = `${data.timeSeconds}s`;
        document.getElementById('stress-ops').textContent = data.totalOps;
        
        const throughputEl = document.getElementById('stress-throughput');
        throughputEl.textContent = Number(data.opsPerSecond).toLocaleString();

        // Imprimir logs en consola del navegador
        if (data.logs && data.logs.length > 0) {
            console.groupCollapsed(`📋 Detalles Prueba Estrés (${data.logs.length} líneas)`);
            data.logs.forEach(log => console.log(log));
            console.groupEnd();
            console.log('✅ Logs completos impresos arriba (expandir grupo ^^)');
        }

        // Animación simple
        resultsDiv.style.display = 'grid';
        resultsDiv.animate([
            { opacity: 0, transform: 'translateY(10px)' },
            { opacity: 1, transform: 'translateY(0)' }
        ], { duration: 500 });

    } catch (e) {
        alert('Error en prueba de estrés');
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '🚀 Lanzar 3000 Operaciones Simultáneas';
    }
}

// UI Helper
function updateLatency(elementId, ms, fast = true) {
    const el = document.getElementById(elementId);
    el.textContent = `Latency: ${ms}ms`;
    el.style.color = ms < 50 ? '#4caf50' : (ms < 300 ? '#ff9800' : '#f44336');
}
