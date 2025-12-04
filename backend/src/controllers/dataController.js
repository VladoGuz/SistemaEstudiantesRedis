const { client } = require('../config/redis');

// Datos de Base de Datos Simulada
const studentProfile = {
    id: 1,
    name: 'John Doe',
    major: 'Computer Science',
    courses: ['CS101', 'CS102', 'MATH201', 'PHYS101'],
    gpa: 3.8
};

// Simular una consulta lenta a la base de datos (ej., retraso de 2 segundos)
const getStudentProfileFromDB = async () => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(studentProfile);
        }, 2000);
    });
};

const getProfile = async (req, res) => {
    const { id } = req.params;
    const cacheKey = `student:${id}:profile`;

    try {
        // 1. Verificar Caché
        const cachedData = await client.get(cacheKey);
        if (cachedData) {
            console.log('Cache Hit (Acierto de Caché)');
            return res.json({
                source: 'cache',
                data: JSON.parse(cachedData)
            });
        }

        console.log('Cache Miss (Fallo de Caché)');
        // 2. Obtener de BD (Lento)
        const data = await getStudentProfileFromDB();

        // 3. Almacenar en Caché (TTL: 60 segundos)
        await client.setEx(cacheKey, 60, JSON.stringify(data));

        res.json({
            source: 'database',
            data
        });

    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({ message: 'Error del Servidor' });
    }
};

module.exports = { getProfile };

