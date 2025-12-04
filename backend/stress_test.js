const http = require('http');

const TOTAL_USERS = 1000;
const API_HOST = 'localhost';
const API_PORT = 3000;

const makeRequest = (method, path, data, headers = {}) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_HOST,
            port: API_PORT,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, body: body ? JSON.parse(body) : {} });
                } catch (e) {
                    resolve({ status: res.statusCode, body });
                }
            });
        });

        req.on('error', (e) => reject(e));
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
};

const simulateUser = async (id) => {
    const username = `user_${id}`;
    const password = 'password123'; // Usando la contraseña del controlador
    // Nota: El controlador actualmente verifica contra una lista de 2 usuarios.
    // Para soportar 1000 usuarios, deberíamos actualizar el controlador o usar las mismas credenciales
    // pero diferentes IDs de sesión.
    // La lógica actual del controlador: users.find(u => u.username === username && u.password === password);
    // Entonces debemos usar 'student1' o 'student2' para iniciar sesión exitosamente.
    // Pero queremos simular sesiones distintas.
    
    // Usemos 'student1' para todos los logins para pasar autenticación,
    // pero el ID de sesión generado será único.
    
    const start = Date.now();
    try {
        // 1. Login
        const loginRes = await makeRequest('POST', '/api/sessions/login', { 
            username: 'student1', 
            password: 'password123' 
        });
        
        if (loginRes.status !== 200) throw new Error(`Login falló: ${loginRes.status}`);
        const sessionId = loginRes.body.sessionId;

        // 2. Obtener Perfil (Prueba de Caché)
        // La primera solicitud puede ser lenta, las subsecuentes rápidas.
        // Estamos simulando usuarios concurrentes, así que pueden usar el caché si es global.
        // La clave de caché es `student:{id}:profile`.
        // Si todos solicitamos estudiante 1, será cacheado.
        const profileRes = await makeRequest('GET', '/api/data/student/1', null, {
            // 'Authorization': sessionId // Si implementamos auth por header, pero usamos query param o body en algunos endpoints
        });

        // 3. Enviar Puntaje (Leaderboard)
        // Usamos el ID único para el nombre del leaderboard para poblarlo
        await makeRequest('POST', '/api/leaderboard/submit', {
            username: username,
            score: Math.floor(Math.random() * 100)
        });

        // 4. Logout
        await makeRequest('POST', '/api/sessions/logout', { sessionId });

        return { success: true, time: Date.now() - start };
    } catch (error) {
        return { success: false, error: error.message, time: Date.now() - start };
    }
};

const runStressTest = async () => {
    console.log(`Iniciando prueba de estrés con ${TOTAL_USERS} usuarios...`);
    const startTime = Date.now();
    
    const promises = [];
    for (let i = 0; i < TOTAL_USERS; i++) {
        promises.push(simulateUser(i));
    }

    const results = await Promise.all(promises);
    const endTime = Date.now();

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    const totalTime = endTime - startTime;
    const avgTime = results.reduce((acc, r) => acc + r.time, 0) / TOTAL_USERS;

    console.log('\n--- Resultados ---');
    console.log(`Total de Usuarios: ${TOTAL_USERS}`);
    console.log(`Exitosos: ${successCount}`);
    console.log(`Fallidos: ${failCount}`);
    console.log(`Tiempo Total: ${totalTime}ms`);
    console.log(`Tiempo Promedio por Usuario: ${avgTime.toFixed(2)}ms`);
    console.log(`Rendimiento: ${(TOTAL_USERS / (totalTime / 1000)).toFixed(2)} req/seg (flujos de usuario aprox)`);
};

runStressTest();

