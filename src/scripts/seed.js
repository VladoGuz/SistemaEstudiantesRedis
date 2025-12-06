// Faker v9+ is ESM only, use dynamic import or ensure environment supports it.
// We use dynamic import here to keep CJS compatibility for the rest of the project.
const { connectRedis, disconnectRedis, client } = require('../config/redis');
const leaderboardService = require('../services/leaderboardService');
const sessionService = require('../services/sessionService');

const TOTAL_STUDENTS = 1000;

const seed = async () => {
    console.log('🌱 Iniciando población de datos...');
    const { faker } = await import('@faker-js/faker');
    await connectRedis();

    console.log('🧹 Limpiando base de datos existente (FLUSHDB)...');
    await client.flushDb();

    console.log(`👥 Generando ${TOTAL_STUDENTS} estudiantes y puntuaciones...`);

    const promises = [];
    const students = [];

    for (let i = 0; i < TOTAL_STUDENTS; i++) {
        const student = {
            id: faker.string.uuid(),
            name: faker.person.fullName(),
            email: faker.internet.email(),
            career: faker.person.jobArea(),
            semester: faker.number.int({ min: 1, max: 10 })
        };
        students.push(student);

        // 1. Añadir al leaderboard (Puntuación aleatoria 0-100)
        // Simulamos decimales para precisión
        const score = faker.number.float({ min: 0, max: 100, precision: 0.01 });
        promises.push(leaderboardService.updateScore(student.id, score));

        // 2. Guardar detalles del usuario (Simulando una "base de datos" principal en Redis por simplicidad del ejemplo)
        // En un caso real esto iría a SQL/Mongo, pero aquí lo guardamos como Hash para tener datos que mostrar
        const userKey = `user:${student.id}`;
        promises.push(client.hSet(userKey, {
            name: student.name,
            email: student.email,
            career: student.career
        }));

        // 3. Crear sesión activa para algunos usuarios (ej. 10%)
        if (Math.random() < 0.1) {
            promises.push(sessionService.createSession(student.id, {
                role: 'student',
                device: faker.internet.userAgent()
            }));
        }
    }

    await Promise.all(promises);
    
    console.log('✅ Población completada.');
    console.log(`- ${TOTAL_STUDENTS} estudiantes creados.`);
    console.log(`- Leaderboard actualizado.`);
    
    // Verificación rápida
    const count = await leaderboardService.countStudents();
    console.log(`- Total en Leaderboard: ${count}`);

    await disconnectRedis();
};

seed().catch(console.error);
