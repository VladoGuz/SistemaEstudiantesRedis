const { client } = require('../config/redis');

const DEFAULT_TTL = 300; // 5 minutos

const cacheService = {
    /**
     * Intenta obtener datos de caché. Si no existen, ejecuta la función fetcher,
     * guarda el resultado en caché y lo retorna.
     * @param {string} key - Clave de caché
     * @param {Function} fetcher - Función asíncrona que obtiene los datos si hay cache miss
     * @param {number} ttl - Tiempo de vida en segundos
     */
    async getOrSet(key, fetcher, ttl = DEFAULT_TTL) {
        try {
            const cachedData = await client.get(key);
            if (cachedData) {
                console.log(`[CACHE HIT] ${key}`);
                return JSON.parse(cachedData); // Asumimos JSON
            }
        } catch (err) {
            console.error('[CACHE ERROR] Error leyendo caché:', err);
            // Si falla caché, seguimos al fetcher sin romper flujo
        }

        console.log(`[CACHE MISS] ${key}`);
        const data = await fetcher();

        if (data !== undefined && data !== null) {
            try {
                await client.set(key, JSON.stringify(data), {
                    EX: ttl
                });
            } catch (err) {
                console.error('[CACHE ERROR] Error escribiendo caché:', err);
            }
        }

        return data;
    },

    /**
     * Invalida una clave de caché específica
     * @param {string} key 
     */
    async invalidate(key) {
        await client.del(key);
    },
    
    /**
     * Invalida por patrón (Cuidado: usar SCAN en prod, KEYS en dev es ok)
     */
    async invalidatePattern(pattern) {
        const keys = await client.keys(pattern);
        if (keys.length > 0) {
            await client.del(keys);
        }
    }
};

module.exports = cacheService;
