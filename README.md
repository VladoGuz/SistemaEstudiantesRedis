# Sistema de Alto Rendimiento con Redis

Este proyecto demuestra un sistema de alto rendimiento utilizando Redis para la gestión de sesiones, caché y una tabla de clasificación (leaderboard) en tiempo real.

## Características

1.  **Gestión de Sesiones**:

    - Utiliza Redis para almacenar sesiones de usuario con un TTL (Tiempo de Vida).
    - Implementa Inicio de Sesión, Cierre de Sesión y Verificación de Sesión.
    - **Patrón de Clave**: `session:{sessionId}` (Hash)

2.  **Caché**:

    - Simula una consulta lenta a la base de datos (retraso de 2 segundos).
    - Almacena el resultado en caché en Redis para un acceso posterior rápido.
    - **Patrón de Clave**: `student:{id}:profile` (String)
    - **Estrategia**: Cache-Aside

3.  **Leaderboard en Tiempo Real**:
    - Utiliza Redis Sorted Sets para mantener una tabla de clasificación basada en puntajes.
    - Soporta el envío de puntajes y la recuperación de los 10 mejores usuarios.
    - **Patrón de Clave**: `leaderboard:academic` (Sorted Set)

## Estructura de datos

```
d:/Redis/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── redis.js
│   │   ├── controllers/
│   │   │   ├── sessionController.js
│   │   │   ├── dataController.js
│   │   │   └── leaderboardController.js
│   │   ├── routes/
│   │   │   ├── sessionRoutes.js
│   │   │   ├── dataRoutes.js
│   │   │   └── leaderboardRoutes.js
│   │   └── server.js
│   ├── frontend_server.js
│   ├── stress_test.js
│   ├── .env
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   └── index.html
└── README.md
```

## 📚 Documentación Técnica

Para entender en profundidad cómo funciona el sistema:

- **[SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md)** - Arquitectura, flujos de datos y comparativas de rendimiento
- **[CODE_EXPLANATION.md](CODE_EXPLANATION.md)** - Explicación detallada del código fuente
- **[API.md](API.md)** - Referencia completa de la API REST
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Guía de desarrollo y mejores prácticas

## Configuración

### Opción 1: Usando Docker (Recomendado) 🐳

La forma más rápida de levantar Redis con interfaz gráfica:

```bash
# 1. Levantar Redis y RedisInsight
docker-compose up -d

# 2. Instalar dependencias del backend
cd backend
npm install

# 3. El sistema está listo para usar
```

**Servicios disponibles:**

- Redis: `localhost:6379`
- RedisInsight (GUI): `http://localhost:5540`

### Opción 2: Redis Local

1.  **Requisitos Previos**:

    - Node.js instalado.
    - Redis server instalado localmente (o el sistema usará Mock Redis automáticamente).

2.  **Instalación**:
    ```bash
    cd backend
    npm install
    ```

## Ejecución

### Opción 1: Ejecutar ambos servidores en terminales separadas

**Terminal 1 - Backend API (Puerto 3000):**

```bash
cd backend
npm start
```

**Terminal 2 - Frontend Server (Puerto 8080):**

```bash
cd backend
npm run frontend
```

### Opción 2: Abrir directamente el HTML (puede tener errores CORS)

```bash
# Abre frontend/index.html en el navegador
```

## Acceso a la Aplicación

1. Abre tu navegador en: `http://localhost:8080`
2. **Credenciales de Login**:
   - Usuario: `student1`
   - Contraseña: `password123`

## Uso

1.  **Login**: Ingresa las credenciales mencionadas arriba.
2.  **Perfil**: Haz clic en "Obtener Perfil". La primera vez toma 2s (BD simulada), la segunda es instantánea (Caché).
3.  **Leaderboard**: Ingresa un puntaje y envía. Haz clic en "Actualizar Tabla" para ver el ranking.

## Prueba de Rendimiento

Para simular 1000 usuarios concurrentes:

```bash
cd backend
npm run stress
```

## Arquitectura

- **Backend**: Node.js (Express) - Puerto 3000
- **Frontend**: Servidor estático - Puerto 8080
- **Base de Datos**: Simulada (En memoria / Mock)
- **Caché/Almacén**: Redis (o Mock Redis si no está instalado)

## API Endpoints

### Sesiones

- `POST /api/sessions/login` - Iniciar sesión
  ```json
  { "username": "student1", "password": "password123" }
  ```
- `POST /api/sessions/logout` - Cerrar sesión
  ```json
  { "sessionId": "uuid-here" }
  ```
- `GET /api/sessions/check?sessionId=uuid` - Verificar sesión activa

### Datos (Caché)

- `GET /api/data/student/:id` - Obtener perfil de estudiante (con caché)

### Leaderboard

- `POST /api/leaderboard/submit` - Enviar puntaje
  ```json
  { "username": "student1", "score": 95.5 }
  ```
- `GET /api/leaderboard` - Obtener top 10 usuarios

## Scripts Disponibles

```bash
npm start         # Iniciar servidor backend
npm run dev       # Iniciar con nodemon (auto-reload)
npm run frontend  # Iniciar servidor frontend
npm run stress    # Ejecutar prueba de estrés
```

## Troubleshooting

### Error: "Cannot connect to Redis"

- **Solución**: El sistema usa Mock Redis automáticamente. Verifica que `USE_MOCK_REDIS=true` en `.env`

### Error: CORS

- **Solución**: Usa `npm run frontend` en lugar de abrir el HTML directamente

### Las sesiones no expiran

- **Solución**: Verifica que MockRedisClient tenga el método `expire()` implementado

### Puntajes no se ordenan correctamente

- **Solución**: Asegúrate de que los scores se conviertan a números con `parseFloat()`

## Tecnologías Utilizadas

- **Backend**: Node.js, Express.js
- **Caché**: Redis (o Mock Redis)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Utilidades**: UUID, dotenv, morgan, cors

## Notas Importantes

- Si Redis no está instalado localmente, el sistema automáticamente usa un **Mock Redis** en memoria.
- Para evitar errores CORS, usa el servidor frontend en puerto 8080 en lugar de abrir el HTML directamente.
- El sistema incluye un diseño moderno con glassmorphism y animaciones suaves.

## Licencia

ISC
