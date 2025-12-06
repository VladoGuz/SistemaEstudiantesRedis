# Explicación del Código Fuente

Este documento detalla cómo está estructurado el código y cómo funciona internamente cada servicio para lograr los objetivos de alto rendimiento con Redis.

## 1. Configuración (`src/config/redis.js`)

Este módulo maneja la conexión centralizada a Redis.
- **Singleton**: Exporta una única instancia de `client` para ser reusada en toda la app.
- **Manejo de Errores**: Escucha eventos `error` y `connect` para monitorear el estado.
- **Funciones Helper**: `connectRedis()` y `disconnectRedis()` aseguran que no intentemos conectar si ya estamos conectados, o desconectar si ya estamos cerrados.

## 2. Servicios (`src/services/`)

Aquí reside la lógica de negocio. Cada servicio encapsula operaciones de Redis.

### A. SessionService (`sessionService.js`)
Gestiona sesiones de usuario usando **Hashes** de Redis.
*   **Creación (`createSession`)**:
    *   Genera un token aleatorio.
    *   Usa `HSET` para guardar los datos del usuario bajo la clave `session:{token}`.
    *   **TTL**: Define un tiempo de expiración (ej. 30 min) para que Redis borre automáticamente sesiones inactivas.
*   **Lectura (`getSession`)**:
    *   Usa `HGETALL` para recuperar los datos.
    *   **Renovación**: Cada vez que se lee la sesión, se ejecuta `EXPIRE` para reiniciar el contador de 30 minutos (sesión "rolling" o deslizante).

### B. LeaderboardService (`leaderboardService.js`)
Gestiona el ranking académico usando **Sorted Sets (ZSETS)**. Esta es la estructura más potente para este caso.
*   **Estructura**: `ZADD key score member`.
    *   Use `sore` para la nota/promedio.
    *   Usa `member` para el ID del estudiante.
*   **Ranking (`getStudentRank`)**: Usa `ZREVRANK`. Redis calcula instantáneamente en qué posición está un usuario (0 = primero) ordenando de mayor a menor.
*   **Top Global (`getTopStudents`)**: Usa `ZREVRANGE ... WITHSCORES` para traer los IDs y puntos de los mejores N estudiantes.
*   **Vecinos (`getSurroundingStudents`)**: Calcula el rango del usuario (ej. puesto 50) y pide el rango [48, 52] para mostrar "quién está justo arriba y abajo".

### C. CacheService (`cacheService.js`)
Implementa el patrón **Cache-Aside** para datos generales (como perfiles de usuario).
1.  **`getOrSet(key, fetcher)`**: Intenta leer de Redis (`GET`).
2.  **Hit**: Si existe, devuelve el JSON parseado (rápido).
3.  **Miss**:
    *   Ejecuta la función `fetcher` (que simula ir a una BD lenta).
    *   Guarda el resultado en Redis (`SET` con `EX` expiración) para la próxima vez.
    *   Devuelve el dato fresco.

## 3. Capa HTTP (`src/server.js`)

Se utiliza **Express** para exponer los servicios de Redis a través de una API REST y servir el frontend.

*   **Middleware de Métricas**: Intercepta cada petición y usa `process.hrtime()` para medir con precisión el tiempo total de procesamiento (incluyendo Redis).
*   **Endpoints Principales**:
    *   `GET /api/benchmark`: Compara una espera artificial (SQL) vs una consulta real a Redis.
    *   `POST /api/stress`:
        *   Genera un array de 1,000 Promesas.
        *   Ejecuta operaciones encadenadas (`session` -> `leaderboard write` -> `leaderboard read`).
        *   Calcula Ops/Seg (Throughput).
        *   **Logs**: Acumula `console.log` en un array `logs[]` y los envía en el JSON de respuesta para ser mostrados en el navegador (`console.groupCollapsed`).

## 4. Frontend (`public/`)

Una SPA (Single Page Application) sencilla para visualizar los datos.
*   **`index.html`**: Estructura del Dashboard.
*   **`app.js`**:
    *   Realiza peticiones `fetch` a la API.
    *   Calcula y muestra la latencia percibida por el cliente (Red + Server).
    *   Actualiza el DOM dinámicamente.

## 5. Scripts (`src/scripts/`)

### `seed.js`
Script de población de datos.
1.  Conecta a Redis y limpia todo (`FLUSHDB`).
2.  Usa `@faker-js/faker` para crear 1000 objetos de estudiantes.
3.  Inserta masivamente:
    *   Nuevos items en el Leaderboard.
    *   Perfiles de usuario simulados.
    *   Algunas sesiones activas aleatorias.

### `queries.js`
Script de validación y benchmarking.
*   Utiliza `process.hrtime()` para medir con precisión de microsegundos cuánto tarda cada operación.
*   Demuestra la diferencia abismal entre un "Cache Miss" (simulado en 200ms) y un "Cache Hit" (~1ms).

## Flujo de Datos Típico

1.  **Login**: `SessionService` crea token -> Redis guarda Hash con TTL.
2.  **Ver Ranking**: `LeaderboardService` consulta Sorted Set -> Redis devuelve top 10 en ~1ms.
3.  **Ver Perfil**: `CacheService` busca en Redis -> Si no está, carga de BD -> Guarda en Redis -> Devuelve.
