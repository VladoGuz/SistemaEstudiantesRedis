const { createClient } = require('redis');
const dotenv = require('dotenv');

dotenv.config();

let client;

class MockRedisClient {
    constructor() {
        this.store = {};
        this.events = {};
        console.log('Usando Cliente Mock de Redis');
    }

    on(event, callback) {
        this.events[event] = callback;
    }

    async connect() {
        if (this.events['connect']) this.events['connect']();
    }

    async get(key) {
        return this.store[key] || null;
    }

    async set(key, value) {
        this.store[key] = value;
    }

    async setEx(key, ttl, value) {
        this.store[key] = value;
        // TTL simulado con setTimeout
        setTimeout(() => delete this.store[key], ttl * 1000);
    }

    async hSet(key, object) {
        if (!this.store[key]) this.store[key] = {};
        Object.assign(this.store[key], object);
    }

    async hGetAll(key) {
        return this.store[key] || {};
    }

    async del(key) {
        delete this.store[key];
    }

    async expire(key, ttl) {
        // Simular expiración con setTimeout
        if (this.store[key]) {
            setTimeout(() => delete this.store[key], ttl * 1000);
        }
    }

    async zAdd(key, { score, value }) {
        if (!this.store[key]) this.store[key] = [];
        // Remover existente si hay alguno
        this.store[key] = this.store[key].filter(item => item.value !== value);
        this.store[key].push({ score, value });
        this.store[key].sort((a, b) => b.score - a.score); // Descendente
    }

    async zRangeWithScores(key, start, stop, options) {
        const list = this.store[key] || [];
        // Slice simple, ignorando opción REV ya que ordenamos descendente
        return list.slice(start, stop + 1);
    }
}

if (process.env.USE_MOCK_REDIS === 'true') {
    client = new MockRedisClient();
} else {
    client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    client.on('error', (err) => {
        console.log('Error del Cliente Redis', err);
        // Fallback a mock si la conexión falla
        // Difícil de intercambiar al vuelo después de exportar
        // Por ahora, depender de variable de entorno o cambio manual
    });
    client.on('connect', () => console.log('Cliente Redis Conectado'));
}

const connectRedis = async (retries = 5, delay = 2000) => {
    let attempt = 0;
    
    while (attempt < retries) {
        try {
            attempt++;
            console.log(`[Redis] Intento de conexión ${attempt}/${retries}...`);
            
            await client.connect();
            console.log('[Redis] ✅ Conexión exitosa');
            return true;
            
        } catch (err) {
            console.error(`[Redis] ❌ Error en intento ${attempt}:`, err.message);
            
            if (attempt >= retries) {
                console.log('[Redis] ⚠️  Máximo de reintentos alcanzado. Cambiando a Mock Redis...');
                client = new MockRedisClient();
                
                try {
                    await client.connect();
                    console.log('[Redis] ✅ Mock Redis conectado exitosamente');
                    return true;
                } catch (mockErr) {
                    console.error('[Redis] ❌ Error crítico: Incluso Mock Redis falló:', mockErr);
                    throw new Error('No se pudo inicializar ningún cliente Redis');
                }
            }
            
            // Esperar antes del siguiente intento
            console.log(`[Redis] ⏳ Esperando ${delay/1000}s antes del siguiente intento...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// Exportar un wrapper o proxy para manejar el intercambio si queremos fallback dinámico
// Pero por simplicidad, exportaremos el cliente
// Nota: Si intercambiamos la variable `client` aquí, la referencia exportada podría no actualizarse
// si ya fue requerida
// Entonces deberíamos exportar un getter o la función connect debería manejarlo

// Mejor enfoque: Exportar un objeto wrapper
const clientWrapper = new Proxy({}, {
    get: function(target, prop) {
        return client[prop];
    }
});

module.exports = { client: clientWrapper, connectRedis };

