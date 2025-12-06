const { client } = require('../config/redis');

// Constantes
const SESSION_PREFIX = 'session:';
const SESSION_TTL = 1800; // 30 minutos en segundos

const sessionService = {
    /**
     * Crea una nueva sesión para un usuario
     * @param {string} userId - ID del usuario
     * @param {Object} userData - Datos a guardar en la sesión
     * @returns {Promise<string>} - ID de la sesión creada (token)
     */
    async createSession(userId, userData) {
        const sessionId = require('crypto').randomBytes(16).toString('hex');
        const key = `${SESSION_PREFIX}${sessionId}`;
        
        // Guardamos los datos como un Hash
        // Aplanamos el objeto para almacenamiento simple en Hash de Redis
        const sessionData = {
            id: sessionId,
            userId: userId,
            createdAt: new Date().toISOString(),
            lastAccess: new Date().toISOString(),
            ...userData
        };

        // Redis v4 HSET soporta objetos directos si son simples (strings/numbers)
        // Convertimos valores a string para evitar problemas
        const entries = Object.entries(sessionData).flat().map(String);
        
        await client.multi()
            .hSet(key, entries)
            .expire(key, SESSION_TTL)
            .exec();
            
        return sessionId;
    },

    /**
     * Obtiene los datos de una sesión y renueva su TTL
     * @param {string} sessionId 
     * @returns {Promise<Object|null>}
     */
    async getSession(sessionId) {
        const key = `${SESSION_PREFIX}${sessionId}`;
        
        const exists = await client.exists(key);
        if (!exists) return null;

        // Pipeline para obtener datos y actualizar expiración
        const [data, _] = await client.multi()
            .hGetAll(key)
            .expire(key, SESSION_TTL) // Renovamos TTL por actividad (Rolling Session)
            .exec();
            
        return Object.keys(data).length > 0 ? data : null;
    },

    /**
     * Elimina una sesión (Logout)
     * @param {string} sessionId 
     */
    async destroySession(sessionId) {
        const key = `${SESSION_PREFIX}${sessionId}`;
        await client.del(key);
    },

    /**
     * Solo para análisis: cuenta sesiones activas (usando SCAN para no bloquear)
     * En producción real se usaría un Set auxiliar o HyperLogLog si son muchas.
     */
    async countActiveSessions() {
        let count = 0;
        let cursor = 0;
        
        do {
            const result = await client.scan(cursor, {
                MATCH: `${SESSION_PREFIX}*`,
                COUNT: 100
            });
            cursor = result.cursor;
            count += result.keys.length;
        } while (cursor !== 0);
        
        return count;
    }
};

module.exports = sessionService;
