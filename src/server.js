const express = require('express');
const path = require('path');
const { connectRedis } = require('./config/redis');
const sessionService = require('./services/sessionService');
const leaderboardService = require('./services/leaderboardService');
const cacheService = require('./services/cacheService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Middleware para medir tiempo de respuesta
app.use((req, res, next) => {
    const start = process.hrtime();
    res.on('finish', () => {
        const diff = process.hrtime(start);
        const timeInMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(3);
        console.log(`[${req.method}] ${req.originalUrl} - ${timeInMs}ms`);
        // Opcional: Enviar header con el tiempo
        // res.set('X-Response-Time', `${timeInMs}ms`);
    });
    next();
});

// --- API ROUTES ---

// Login (Crear Sesión)
app.post('/api/login', async (req, res) => {
    try {
        const { userId } = req.body; // En app real, validar password
        if (!userId) return res.status(400).json({ error: 'userId requerido' });

        // Simular datos de usuario
        const userData = { role: 'student', userAgent: req.headers['user-agent'] };
        const sessionId = await sessionService.createSession(userId, userData);
        
        res.json({ success: true, sessionId, message: 'Sesión creada en Redis' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ver Perfil (Cache Pattern)
app.get('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const cacheKey = `user_profile:${id}`;
        
        // Simulación DB lenta
        const slowDbFetch = async () => {
            return new Promise(resolve => setTimeout(() => {
                resolve({ 
                    id, 
                    name: `Estudiante ${id.substring(0,4)}`, 
                    bio: 'Datos cargados de "BD Lenta"' 
                });
            }, 200));
        };

        const start = process.hrtime();
        const data = await cacheService.getOrSet(cacheKey, slowDbFetch);
        const diff = process.hrtime(start);
        const timeInMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(3);

        res.json({ 
            data, 
            meta: { 
                latency: `${timeInMs}ms`,
                source: timeInMs < 10 ? 'Redis Cache' : 'Database'
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Leaderboard Top 10
app.get('/api/leaderboard', async (req, res) => {
    try {
        const top = await leaderboardService.getTopStudents(10);
        res.json(top);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Actualizar Puntaje
app.post('/api/score', async (req, res) => {
    try {
        const { userId, score } = req.body;
        if (!userId || score === undefined) return res.status(400).json({ error: 'Faltan datos' });

        await leaderboardService.updateScore(userId, parseFloat(score));
        const newRank = await leaderboardService.getStudentRank(userId);
        
        res.json({ success: true, newRank, message: 'Puntaje actualizado en Redis' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Benchmark Comparativo
app.get('/api/benchmark', async (req, res) => {
    try {
        const iterations = 100; // Leer 100 items (simula carga de lista)
        
        // 1. Simulación SQL (Delay promedio 50ms por query simple, pero hacemos solo 1 "pesada" de 300ms)
        const startSql = process.hrtime();
        await new Promise(resolve => setTimeout(resolve, 300)); // Latencia de red DB + Query compleja
        const diffSql = process.hrtime(startSql);
        const sqlTime = (diffSql[0] * 1000 + diffSql[1] / 1e6).toFixed(2);

        // 2. Redis (Lectura real)
        const startRedis = process.hrtime();
        // Leemos algo real, ej. el top 10
        await leaderboardService.getTopStudents(10);
        const diffRedis = process.hrtime(startRedis);
        const redisTime = (diffRedis[0] * 1000 + diffRedis[1] / 1e6).toFixed(2);

        res.json({
            sql: parseFloat(sqlTime),
            redis: parseFloat(redisTime),
            ratio: (sqlTime / redisTime).toFixed(1)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Prueba de Estrés (Potencia Bruta)
app.post('/api/stress', async (req, res) => {
    try {
        const CONCURRENT_USERS = 1000;
        const start = process.hrtime();
        const logs = []; // Array para recolectar logs
        
        // Generar array de promesas
        const promises = Array.from({ length: CONCURRENT_USERS }, (_, i) => {
            const userId = `stress_user_${i}`;
            const score = Math.random() * 100;
            
            // Cadena de promesas por usuario
            return sessionService.createSession(userId, { active: true })
                .then(() => {
                    logs.push(`[STRESS] 📝 CREATE SESSION: ${userId}`);
                    return leaderboardService.updateScore(userId, score);
                })
                .then(() => {
                    logs.push(`[STRESS] 🆙 UPDATE SCORE: ${userId} -> ${score.toFixed(2)}`);
                    return leaderboardService.getStudentRank(userId);
                })
                .then((rank) => {
                    logs.push(`[STRESS] 🔍 GET RANK: ${userId} is #${rank}`);
                });
        });

        await Promise.all(promises);

        const diff = process.hrtime(start);
        const timeInSeconds = (diff[0] + diff[1] / 1e9);
        const totalOps = CONCURRENT_USERS * 3;
        const opsPerSec = totalOps / timeInSeconds;

        res.json({
            users: CONCURRENT_USERS,
            totalOps: totalOps,
            timeSeconds: timeInSeconds.toFixed(3),
            opsPerSecond: opsPerSec.toFixed(0),
            logs: logs // Enviamos los logs al cliente
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start Server
const startServer = async () => {
    await connectRedis();
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
};

startServer();
