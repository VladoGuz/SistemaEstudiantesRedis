const { connectRedis, disconnectRedis, client } = require('../config/redis');
const leaderboardService = require('../services/leaderboardService');
const sessionService = require('../services/sessionService');

// Configuración
const CONCURRENT_USERS = 5000; // Número de peticiones simultáneas
const BATCH_SIZE = 500; // Para no ahogar el event loop de Node.js (opcional)

const stressTest = async () => {
    console.log(`🔥 Iniciando PRUEBA DE POTENCIA BRUTA`);
    console.log(`👥 Simulando ${CONCURRENT_USERS} transacciones concurrentes...\n`);
    
    await connectRedis();

    // Generar datos fake en memoria para no gastar tiempo en eso durante el test
    const requests = Array.from({ length: CONCURRENT_USERS }, (_, i) => ({
        userId: `user_stress_${i}`,
        score: Math.random() * 100
    }));

    const start = process.hrtime();
    let completed = 0;

    // Ejecutamos todas las promesas "a la vez" (concurrencia de Node.js)
    // Cada transacción implica:
    // 1. Crear/Actualizar Sesión (Write Hash)
    // 2. Actualizar Tabla de Posiciones (Write Sorted Set)
    // 3. Consultar mi nuevo ranking (Read Sorted Set)
    const promises = requests.map(async (req) => {
        // Operación 1: Sesión
        await sessionService.createSession(req.userId, { active: true });
        
        // Operación 2: Leaderboard Update
        await leaderboardService.updateScore(req.userId, req.score);
        
        // Operación 3: Consultar Rank (Read)
        await leaderboardService.getStudentRank(req.userId);
        
        completed++;
        if (completed % 1000 === 0) process.stdout.write('.');
    });

    await Promise.all(promises);

    const diff = process.hrtime(start);
    const timeInSeconds = (diff[0] + diff[1] / 1e9);
    
    console.log('\n\n✅ Prueba Finalizada.');
    console.log('------------------------------------------------');
    console.log(`⏱️  Tiempo Total:      ${timeInSeconds.toFixed(3)} segundos`);
    console.log(`📊 Peticiones totales: ${CONCURRENT_USERS}`);
    console.log(`⚡ Operaciones Redis:  ${CONCURRENT_USERS * 3} (3 ops por usuario)`);
    console.log('------------------------------------------------');
    console.log(`🚀 THROUGHPUT:       ${(CONCURRENT_USERS / timeInSeconds).toFixed(0)} usuarios/seg`);
    console.log(`🔨 OPS/SEC (Redis):  ${((CONCURRENT_USERS * 3) / timeInSeconds).toFixed(0)} ops/seg`);
    console.log('------------------------------------------------');

    await disconnectRedis();
};

stressTest().catch(console.error);
