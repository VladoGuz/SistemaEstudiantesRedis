const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const { connectRedis } = require('./config/redis');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const sessionRoutes = require('./routes/sessionRoutes');
const dataRoutes = require('./routes/dataRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');

// Routes
app.use('/api/sessions', sessionRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/leaderboard', leaderboardRoutes);

app.get('/', (req, res) => {
    res.send('Redis High Performance System API');
});

// Start Server
const startServer = async () => {
    console.log('='.repeat(50));
    console.log('🚀 Iniciando servidor Redis Backend...');
    console.log('='.repeat(50));
    
    try {
        // Paso 1: Conectar a Redis (con reintentos automáticos)
        console.log('\n[Paso 1/2] Conectando a Redis...');
        const redisConnected = await connectRedis();
        
        if (!redisConnected) {
            throw new Error('No se pudo establecer conexión con Redis');
        }
        
        // Paso 2: Iniciar servidor Express solo si Redis está conectado
        console.log('\n[Paso 2/2] Iniciando servidor Express...');
        
        const server = app.listen(PORT, () => {
            console.log('\n' + '='.repeat(50));
            console.log(`✅ Servidor corriendo exitosamente en puerto ${PORT}`);
            console.log(`📡 API disponible en: http://localhost:${PORT}`);
            console.log(`🔧 Modo: ${process.env.USE_MOCK_REDIS === 'true' ? 'Mock Redis' : 'Redis Real'}`);
            console.log('='.repeat(50) + '\n');
        });
        
        // Manejo de errores del servidor
        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`\n❌ ERROR: El puerto ${PORT} ya está en uso`);
                console.error('💡 Solución: Cierra el otro proceso o cambia el puerto en .env\n');
            } else {
                console.error('\n❌ Error del servidor:', err.message);
            }
            process.exit(1);
        });
        
    } catch (error) {
        console.error('\n' + '='.repeat(50));
        console.error('❌ ERROR CRÍTICO: No se pudo iniciar el servidor');
        console.error('='.repeat(50));
        console.error('\n📋 Detalles del error:');
        console.error('   Mensaje:', error.message);
        console.error('   Stack:', error.stack);
        console.error('\n💡 Posibles soluciones:');
        console.error('   1. Verifica que las dependencias estén instaladas: npm install');
        console.error('   2. Revisa el archivo .env');
        console.error('   3. Asegúrate de que el puerto 3000 esté disponible');
        console.error('='.repeat(50) + '\n');
        process.exit(1);
    }
};

// Manejo de señales de terminación
process.on('SIGINT', () => {
    console.log('\n\n⚠️  Señal SIGINT recibida. Cerrando servidor...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n⚠️  Señal SIGTERM recibida. Cerrando servidor...');
    process.exit(0);
});

startServer();
