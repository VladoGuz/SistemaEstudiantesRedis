# Explicación del Código Fuente

Este documento detalla cómo está estructurado el código y cómo funciona internamente cada componente del sistema de alto rendimiento con Redis.

## 📁 Arquitectura del Proyecto

```
d:/Redis/
├── backend/                    # Servidor API y lógica de negocio
│   ├── src/
│   │   ├── config/
│   │   │   └── redis.js       # Configuración y conexión a Redis
│   │   ├── controllers/       # Lógica de negocio
│   │   │   ├── sessionController.js
│   │   │   ├── dataController.js
│   │   │   └── leaderboardController.js
│   │   ├── routes/            # Definición de endpoints
│   │   │   ├── sessionRoutes.js
│   │   │   ├── dataRoutes.js
│   │   │   └── leaderboardRoutes.js
│   │   └── server.js          # Servidor Express principal
│   ├── frontend_server.js     # Servidor estático para frontend
│   ├── stress_test.js         # Pruebas de rendimiento
│   └── package.json
├── frontend/                   # Interfaz de usuario
│   ├── css/
│   │   └── style.css          # Estilos modernos con glassmorphism
│   ├── js/
│   │   └── app.js             # Lógica del cliente
│   └── index.html             # Dashboard interactivo
└── docker-compose.yml         # Configuración Docker para Redis
```

## 🔧 1. Configuración (`backend/src/config/redis.js`)

Este módulo maneja la conexión a Redis con soporte para Mock Redis (útil para desarrollo sin Redis instalado).

### Características Clave:

- **Singleton Pattern**: Exporta una única instancia del cliente Redis
- **Fallback Automático**: Si Redis no está disponible, usa Mock Redis
- **Manejo de Errores**: Listeners para eventos de conexión y error
- **Funciones Helper**:
  - `connectRedis()`: Establece conexión
  - `disconnectRedis()`: Cierra conexión limpiamente
  - `getRedisClient()`: Retorna la instancia activa

### Mock Redis

Implementa las operaciones principales de Redis en memoria:

- **Hashes**: `hSet`, `hGetAll`, `hDel`
- **Sorted Sets**: `zAdd`, `zRevRange`, `zRevRank`
- **Strings**: `set`, `get`, `del`
- **TTL**: `expire` con limpieza automática

## 🎯 2. Controladores (`backend/src/controllers/`)

### A. Session Controller (`sessionController.js`)

Gestiona sesiones de usuario usando **Redis Hashes**.

**Operaciones:**

1. **Login (`login`)**:

   ```javascript
   // Genera token único
   const sessionId = uuidv4();

   // Guarda en Redis: session:{sessionId}
   await client.hSet(`session:${sessionId}`, {
     userId: user.id,
     username: user.username,
     role: user.role,
     loginTime: Date.now(),
   });

   // TTL de 30 minutos
   await client.expire(`session:${sessionId}`, 1800);
   ```

2. **Check Session (`checkSession`)**:

   - Verifica existencia con `hGetAll`
   - **Renovación automática**: Resetea TTL en cada verificación (rolling session)

3. **Logout (`logout`)**:
   - Elimina la sesión con `hDel`

### B. Data Controller (`dataController.js`)

Implementa el patrón **Cache-Aside** para perfiles de estudiantes.

**Flujo:**

```javascript
// 1. Intentar leer de caché
const cached = await client.get(`student:${id}:profile`);

if (cached) {
  // Cache HIT - Retornar inmediatamente
  return JSON.parse(cached);
} else {
  // Cache MISS - Consultar BD (simulada con delay de 2s)
  const data = await slowDatabaseQuery(id);

  // Guardar en caché por 5 minutos
  await client.set(`student:${id}:profile`, JSON.stringify(data), { EX: 300 });

  return data;
}
```

**Resultado**: Primera consulta ~2s, siguientes consultas <5ms

### C. Leaderboard Controller (`leaderboardController.js`)

Gestiona el ranking académico usando **Redis Sorted Sets (ZSET)**.

**¿Por qué Sorted Sets?**

- Auto-ordenamiento en O(log N)
- Consultas de rango extremadamente rápidas
- Ideal para rankings, scoreboards, etc.

**Operaciones:**

1. **Submit Score (`submitScore`)**:

   ```javascript
   // Agrega/actualiza puntaje
   await client.zAdd("leaderboard:academic", {
     score: parseFloat(score),
     value: username,
   });
   ```

2. **Get Top 10 (`getLeaderboard`)**:

   ```javascript
   // Obtiene top 10 con puntajes
   const top = await client.zRevRange("leaderboard:academic", 0, 9, {
     WITHSCORES: true,
   });
   ```

3. **Get User Rank (`getUserRank`)**:
   ```javascript
   // Posición del usuario (0-indexed)
   const rank = await client.zRevRank("leaderboard:academic", username);
   ```

## 🌐 3. Rutas (`backend/src/routes/`)

Definen los endpoints de la API REST:

### Session Routes

- `POST /api/sessions/login` - Iniciar sesión
- `POST /api/sessions/logout` - Cerrar sesión
- `GET /api/sessions/check` - Verificar sesión activa

### Data Routes

- `GET /api/data/student/:id` - Obtener perfil (con caché)

### Leaderboard Routes

- `POST /api/leaderboard/submit` - Enviar puntaje
- `GET /api/leaderboard` - Obtener top 10

## 🖥️ 4. Servidor (`backend/src/server.js`)

Servidor Express con middleware personalizado:

### Middleware de Métricas

```javascript
app.use((req, res, next) => {
  const start = process.hrtime();
  res.on("finish", () => {
    const diff = process.hrtime(start);
    const timeInMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(3);
    console.log(`[${req.method}] ${req.originalUrl} - ${timeInMs}ms`);
  });
  next();
});
```

Mide con precisión de nanosegundos el tiempo de cada request.

### Manejo de Errores

- Validación de parámetros
- Try-catch en todos los endpoints
- Respuestas JSON consistentes

## 🎨 5. Frontend (`frontend/`)

### HTML (`index.html`)

Dashboard interactivo con secciones:

- Login/Logout
- Perfil con caché
- Leaderboard en vivo
- Métricas de rendimiento

### JavaScript (`app.js`)

- **Fetch API**: Comunicación con backend
- **Medición de latencia**: Calcula tiempo cliente-servidor
- **Actualización dinámica**: Renderiza datos sin recargar página
- **Manejo de estados**: Login/logout, loading, errores

### CSS (`style.css`)

Diseño moderno con:

- **Glassmorphism**: Efectos de vidrio translúcido
- **Gradientes**: Fondos dinámicos
- **Animaciones**: Transiciones suaves
- **Responsive**: Adaptable a diferentes pantallas

## 🔥 6. Prueba de Estrés (`backend/stress_test.js`)

Simula 1000 usuarios concurrentes realizando operaciones:

```javascript
const promises = Array.from({ length: 1000 }, async (_, i) => {
  // 1. Login
  const session = await login(`user${i}`);

  // 2. Submit score
  await submitScore(`user${i}`, Math.random() * 100);

  // 3. Get profile
  await getProfile(`user${i}`);
});

await Promise.all(promises);
```

**Métricas calculadas:**

- Tiempo total de ejecución
- Operaciones por segundo (throughput)
- Latencia promedio
- Tasa de éxito

## 🐳 7. Docker (`docker-compose.yml`)

Configuración para levantar Redis fácilmente:

```yaml
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  redis-insight:
    image: redis/redisinsight:latest
    ports:
      - "5540:5540"
```

**Beneficios:**

- Setup en un comando: `docker-compose up -d`
- Persistencia de datos
- RedisInsight para visualización

## 🔄 Flujo de Datos Típico

### Escenario: Usuario hace login y consulta su perfil

1. **Cliente** → `POST /api/sessions/login`
2. **Server** → Valida credenciales
3. **Redis** → Guarda sesión con `HSET session:{uuid}`
4. **Redis** → Establece TTL con `EXPIRE`
5. **Server** → Retorna sessionId al cliente
6. **Cliente** → `GET /api/data/student/123` (con sessionId)
7. **Server** → Verifica sesión con `HGETALL`
8. **Redis** → Renueva TTL automáticamente
9. **Server** → Intenta `GET student:123:profile`
10. **Redis** → Cache MISS (primera vez)
11. **Server** → Consulta BD simulada (2s delay)
12. **Redis** → Guarda resultado con `SET ... EX 300`
13. **Server** → Retorna datos al cliente
14. **Cliente** → Siguiente consulta es instantánea (Cache HIT)

## 📊 Estructuras de Datos en Redis

### Sesiones (Hash)

```
Key: session:uuid-1234-5678
Value: {
  userId: "123",
  username: "student1",
  role: "student",
  loginTime: "1701234567890"
}
TTL: 1800 segundos (30 min)
```

### Caché de Perfiles (String)

```
Key: student:123:profile
Value: '{"id":"123","name":"Juan","gpa":9.5}'
TTL: 300 segundos (5 min)
```

### Leaderboard (Sorted Set)

```
Key: leaderboard:academic
Members: [
  { value: "student1", score: 98.5 },
  { value: "student2", score: 95.3 },
  { value: "student3", score: 92.1 }
]
```

## 🚀 Optimizaciones Implementadas

1. **Conexión Singleton**: Una sola conexión Redis reutilizada
2. **Pipeline**: Múltiples comandos en una sola round-trip (en stress test)
3. **TTL Automático**: Redis limpia datos expirados sin intervención
4. **Rolling Sessions**: TTL se renueva en cada acceso
5. **Cache-Aside**: Patrón estándar para máximo rendimiento
6. **Sorted Sets**: Estructura óptima para rankings (O(log N))

## 🎯 Ventajas de esta Arquitectura

- ✅ **Escalabilidad**: Separación clara de responsabilidades
- ✅ **Mantenibilidad**: Código modular y bien organizado
- ✅ **Testeable**: Controladores independientes fáciles de probar
- ✅ **Desarrollo**: Mock Redis permite trabajar sin dependencias
- ✅ **Producción**: Docker facilita deployment
- ✅ **Monitoreo**: Métricas integradas en cada request
