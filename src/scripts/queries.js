const { connectRedis, disconnectRedis, client } = require('../config/redis');
const leaderboardService = require('../services/leaderboardService');
const sessionService = require('../services/sessionService');
const cacheService = require('../services/cacheService');

// Helper para medir tiempo
const measure = async (label, fn) => {
    const start = process.hrtime();
    const result = await fn();
    const end = process.hrtime(start);
    const timeInMs = (end[0] * 1000 + end[1] / 1e6).toFixed(3);
    console.log(`⏱️  [${label}] - ${timeInMs}ms`);
    return result;
};

// Función simula consulta lenta a BD principal (200ms delay)
const mockSlowDbQuery = async (id) => {
    return new Promise(resolve => setTimeout(() => {
        resolve({ id, data: 'Datos pesados de la BD Relacional', timestamp: Date.now() });
    }, 200));
};

const runQueries = async () => {
    console.log('🚀 Iniciando pruebas representativas...\n');
    await connectRedis();

    // Obtenemos un ID del leaderboard para usar de prueba
    const topUsers = await leaderboardService.getTopStudents(1);
    if (topUsers.length === 0) {
        console.error('❌ No hay datos. Ejecuta "npm run seed" primero.');
        await disconnectRedis();
        return;
    }
    const testUserId = topUsers[0].value;
    const testScore = topUsers[0].score;

    console.log(`👤 Usuario de prueba: ${testUserId} (Score: ${testScore})\n`);

    // --- SESIONES ---
    console.log('--- 1. GESTIÓN DE SESIONES ---');
    
    // Consulta 1: Crear Sesión (Login)
    const sessionId = await measure('Crear Sesión', () => 
        sessionService.createSession(testUserId, { role: 'admin', browser: 'Chrome' })
    );
    console.log(`   Token: ${sessionId.substring(0, 10)}...`);

    // Consulta 2: Obtener Sesión (Middleware check)
    const sessionData = await measure('Leer Sesión', () => sessionService.getSession(sessionId));
    console.log(`   Datos: Role=${sessionData.role}`);

    // Consulta 3: Logout
    await measure('Cerrar Sesión', () => sessionService.destroySession(sessionId));
    const sessionCheck = await sessionService.getSession(sessionId);
    console.log(`   Sesión existe tras logout?: ${!!sessionCheck}\n`);


    // --- LEADERBOARD ---
    console.log('--- 2. LEADERBOARD ACADÉMICO ---');

    // Consulta 4: Top 5 Estudiantes Global
    const top5 = await measure('Top 5 Global', () => leaderboardService.getTopStudents(5));
    console.log('   Top 5:');
    top5.forEach((u, i) => console.log(`     ${i+1}. ${u.value.substring(0, 8)}... - ${u.score}`));

    // Consulta 5: Obtener mi ranking
    const rank = await measure('Obtener mi Ranking', () => leaderboardService.getStudentRank(testUserId));
    console.log(`   Ranking usuario prueba: #${rank + 1}`);

    // Consulta 6: Actualizar nota (subir puntaje)
    const newScore = testScore + 5;
    await measure('Actualizar Nota (+5)', () => leaderboardService.updateScore(testUserId, newScore));
    
    // Consulta 7: Verificar nuevo ranking
    const newRank = await leaderboardService.getStudentRank(testUserId);
    console.log(`   Nuevo Ranking: #${newRank + 1} (Subió ${rank - newRank} posiciones)\n`);

    // Consulta 8: Vecinos (Competencia directa)
    const neighbors = await measure('Obtener Competidores Cercanos (+-1)', () => leaderboardService.getSurroundingStudents(testUserId, 1));
    console.log('   Vecinos:');
    neighbors.forEach(u => console.log(`     ${u.value === testUserId ? '-> ME' : '  Comp'}: ${u.score}`));
    console.log('');


    // --- CACHÉ ---
    console.log('--- 3. CACHÉ DE CONSULTAS ---');
    const cacheKey = `user_profile:${testUserId}`;

    // Consulta 9: Cache Miss (Primera vez)
    await cacheService.invalidate(cacheKey); // asegurar limpio
    const data1 = await measure('Consulta Pesada (Cache Miss)', () => 
        cacheService.getOrSet(cacheKey, () => mockSlowDbQuery(testUserId))
    );

    // Consulta 10: Cache Hit (Segunda vez)
    const data2 = await measure('Consulta Pesada (Cache Hit)', () => 
        cacheService.getOrSet(cacheKey, () => mockSlowDbQuery(testUserId))
    );
    console.log(`   Diferencia: Miss vs Hit es evidente.\n`);


    // --- ESTADÍSTICAS ---
    console.log('--- 4. ESTADÍSTICAS ---');
    
    // Consulta 11: Contar total estudiantes
    const total = await measure('Total Estudiantes', () => leaderboardService.countStudents());
    console.log(`   Total: ${total}`);

    await disconnectRedis();
    console.log('\n✅ Pruebas finalizadas.');
};

runQueries().catch(console.error);
