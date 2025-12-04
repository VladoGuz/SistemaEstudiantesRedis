const { client } = require('../config/redis');
const { v4: uuidv4 } = require('uuid');

// Base de Datos de Usuarios Simulada
const users = [
    { id: 1, username: 'student1', password: 'password123', role: 'student' },
    { id: 2, username: 'student2', password: 'password123', role: 'student' }
];

const SESSION_TTL = 1800; // 30 minutos

const login = async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
        return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const sessionId = uuidv4();
    const sessionKey = `session:${sessionId}`;

    try {
        await client.hSet(sessionKey, {
            userId: user.id,
            username: user.username,
            role: user.role
        });
        await client.expire(sessionKey, SESSION_TTL);

        res.json({ message: 'Inicio de sesión exitoso', sessionId });
    } catch (error) {
        console.error('Error al crear sesión:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
};

const logout = async (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: 'ID de sesión requerido' });

    try {
        await client.del(`session:${sessionId}`);
        res.json({ message: 'Cierre de sesión exitoso' });
    } catch (error) {
        res.status(500).json({ message: 'Error al cerrar sesión' });
    }
};

const checkSession = async (req, res) => {
    const { sessionId } = req.query; // O headers
    if (!sessionId) return res.status(401).json({ message: 'No se proporcionó sesión' });

    try {
        const session = await client.hGetAll(`session:${sessionId}`);
        if (!session || Object.keys(session).length === 0) {
            return res.status(401).json({ message: 'Sesión expirada o inválida' });
        }
        res.json({ session });
    } catch (error) {
        res.status(500).json({ message: 'Error al verificar sesión' });
    }
};

module.exports = { login, logout, checkSession };

