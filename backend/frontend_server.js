const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 8080;

// Enable CORS
app.use(cors());

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

const startFrontendServer = () => {
    try {
        const server = app.listen(PORT, () => {
            console.log('='.repeat(50));
            console.log(`✅ Frontend server running at http://localhost:${PORT}`);
            console.log('='.repeat(50));
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`\n❌ ERROR: Puerto ${PORT} ya está en uso`);
                console.error('💡 Cierra el otro proceso o cambia el puerto\n');
            } else {
                console.error('\n❌ Error del servidor frontend:', err.message);
            }
            process.exit(1);
        });

        // Mantener el proceso vivo
        process.on('SIGINT', () => {
            console.log('\n\n⚠️  Cerrando servidor frontend...');
            server.close(() => {
                console.log('✅ Servidor frontend cerrado');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('❌ Error crítico al iniciar servidor frontend:', error);
        process.exit(1);
    }
};

startFrontendServer();
