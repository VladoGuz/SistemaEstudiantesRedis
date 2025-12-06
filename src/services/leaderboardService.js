const { client } = require('../config/redis');

const LEADERBOARD_KEY = 'leaderboard:academic';

const leaderboardService = {
    /**
     * Actualiza la puntuación de un estudiante.
     * @param {string} studentId 
     * @param {number} score 
     */
    async updateScore(studentId, score) {
        // ZADD actualiza si existe o crea si no.
        // Usamos timestamp como parte decimal para desempatar por antigüedad (si fuera req)
        // Pero aquí simple score.
        await client.zAdd(LEADERBOARD_KEY, {
            score: score,
            value: studentId
        });
    },

    /**
     * Obtiene los N mejores estudiantes con sus puntuaciones.
     * @param {number} limit 
     * @returns {Promise<Array<{value: string, score: number}>>}
     */
    async getTopStudents(limit = 10) {
        // ZREVRANGEBYSCORE leaderboard:academic +inf -inf WITHSCORES LIMIT 0 limit
        // O más simple con zRangeWithScores y reversa
        return await client.zRangeWithScores(LEADERBOARD_KEY, 0, limit - 1, {
            REV: true
        });
    },

    /**
     * Obtiene el rango (posición) de un estudiante. 0 es el mejor.
     * @param {string} studentId 
     * @returns {Promise<number|null>}
     */
    async getStudentRank(studentId) {
        return await client.zRevRank(LEADERBOARD_KEY, studentId);
    },

    /**
     * Obtiene la puntuación de un estudiante.
     * @param {string} studentId 
     * @returns {Promise<number|null>}
     */
    async getStudentScore(studentId) {
        return await client.zScore(LEADERBOARD_KEY, studentId);
    },

    /**
     * Encuentra estudiantes alrededor de un ranking específico (vecinos).
     * @param {string} studentId 
     * @param {number} radius - Cuántos por arriba y abajo
     */
    async getSurroundingStudents(studentId, radius = 2) {
        const rank = await this.getStudentRank(studentId);
        if (rank === null) return null;

        const start = Math.max(0, rank - radius);
        const end = rank + radius;

        return await client.zRangeWithScores(LEADERBOARD_KEY, start, end, {
            REV: true
        });
    },
    
    /**
     * Obtiene total de estudiantes en el leaderboard
     */
    async countStudents() {
        return await client.zCard(LEADERBOARD_KEY);
    }
};

module.exports = leaderboardService;
