const API_URL = 'http://localhost:3000/api';
let sessionId = localStorage.getItem('sessionId');

// Verificar sesión al cargar
if (sessionId) {
    checkSession();
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
        const res = await fetch(`${API_URL}/sessions/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            sessionId = data.sessionId;
            localStorage.setItem('sessionId', sessionId);
            alert('Inicio de sesión exitoso');
            showDashboard(username);
        } else {
            alert(data.message);
        }
    } catch (error) {
        console.error(error);
    }
}

async function logout() {
    try {
        await fetch(`${API_URL}/sessions/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId })
        });
        localStorage.removeItem('sessionId');
        sessionId = null;
        document.getElementById('login-section').style.display = 'block';
        document.getElementById('dashboard-section').style.display = 'none';
    } catch (error) {
        console.error(error);
    }
}

async function checkSession() {
    try {
        const res = await fetch(`${API_URL}/sessions/check?sessionId=${sessionId}`);
        const data = await res.json();
        if (res.ok) {
            showDashboard(data.session.username);
        } else {
            localStorage.removeItem('sessionId');
        }
    } catch (error) {
        console.error(error);
    }
}

function showDashboard(username) {
    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    document.getElementById('user-display').innerText = username;
}

// Demo de Caché
async function getProfile() {
    const start = Date.now();
    try {
        const res = await fetch(`${API_URL}/data/student/1`);
        const data = await res.json();
        const end = Date.now();

        document.getElementById('profile-result').innerHTML = `
            <pre>${JSON.stringify(data.data, null, 2)}</pre>
            <p>Fuente: <b>${data.source}</b></p>
        `;
        document.getElementById('profile-time').innerText = `Tiempo: ${end - start}ms`;
    } catch (error) {
        console.error(error);
    }
}

// Demo de Leaderboard
async function submitScore() {
    const score = document.getElementById('score-input').value;
    const username = document.getElementById('user-display').innerText;

    try {
        await fetch(`${API_URL}/leaderboard/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, score })
        });
        getLeaderboard();
    } catch (error) {
        console.error(error);
    }
}

async function getLeaderboard() {
    try {
        const res = await fetch(`${API_URL}/leaderboard`);
        const data = await res.json();
        
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '';
        
        // Redis retorna [{value, score}, ...] con zRangeWithScores
        
        data.leaderboard.forEach((entry, index) => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerText = `${index + 1}. ${entry.value}`;
            const span = document.createElement('span');
            span.className = 'badge bg-primary rounded-pill';
            span.innerText = entry.score;
            li.appendChild(span);
            list.appendChild(li);
        });
    } catch (error) {
        console.error(error);
    }
}

