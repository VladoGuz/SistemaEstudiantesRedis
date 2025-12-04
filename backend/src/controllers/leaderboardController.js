const { client } = require('../config/redis');

const LEADERBOARD_KEY = 'leaderboard:academic';

const submitScore = async (req, res) => {
    const { username, score } = req.body;

    if (!username || score === undefined) {
        return res.status(400).json({ message: 'Usuario y puntaje son requeridos' });
    }

    // Convertir score a número y validar
    const numericScore = parseFloat(score);
    if (isNaN(numericScore)) {
        return res.status(400).json({ message: 'El puntaje debe ser un número válido' });
    }

    try {
        // Agregar o actualizar puntaje en Sorted Set
        await client.zAdd(LEADERBOARD_KEY, {
            score: numericScore,
            value: username
        });

        res.json({ message: 'Puntaje enviado exitosamente' });
    } catch (error) {
        console.error('Error al enviar puntaje:', error);
        res.status(500).json({ message: 'Error del Servidor' });
    }
};

const getLeaderboard = async (req, res) => {
    try {
        // Obtener top 10 usuarios (puntajes más altos primero)
        // ZREVRANGE key start stop WITHSCORES
        const topUsers = await client.zRangeWithScores(LEADERBOARD_KEY, 0, 9, {
            REV: true
        });

        res.json({ leaderboard: topUsers });
    } catch (error) {
        console.error('Error al obtener leaderboard:', error);
        res.status(500).json({ message: 'Error del Servidor' });
    }
};

module.exports = { submitScore, getLeaderboard };

