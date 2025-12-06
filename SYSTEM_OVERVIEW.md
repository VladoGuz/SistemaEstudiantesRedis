# Visión General del Sistema

Este documento describe la arquitectura completa, flujos de datos y funcionamiento del Sistema de Alto Rendimiento con Redis para gestión académica.

## 🎯 Objetivo del Sistema

Demostrar cómo Redis puede mejorar dramáticamente el rendimiento de aplicaciones web mediante:

1. **Gestión de Sesiones** ultra-rápida sin consultar bases de datos
2. **Caché inteligente** que reduce la carga en sistemas lentos
3. **Rankings en tiempo real** con actualización instantánea
4. **Alta concurrencia** manejando miles de usuarios simultáneos

## 🏗️ Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                        NAVEGADOR                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Frontend (HTML/CSS/JS) - Puerto 8080                │   │
│  │  • Dashboard interactivo                             │   │
│  │  • Medición de latencia cliente-servidor             │   │
│  │  • Visualización en tiempo real                      │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/JSON
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND API - Puerto 3000                │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Express Server (Node.js)                            │   │
│  │  • Middleware de métricas                            │   │
│  │  • Validación y autenticación                        │   │
│  │  • Lógica de negocio                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Session    │  │    Data      │  │  Leaderboard     │   │
│  │ Controller  │  │  Controller  │  │   Controller     │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕ Redis Protocol
┌─────────────────────────────────────────────────────────────┐
│                    REDIS - Puerto 6379                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Base de Datos en Memoria (RAM)                      │   │
│  │  • Hashes: Sesiones de usuario                       │   │
│  │  • Strings: Caché de perfiles                        │   │
│  │  • Sorted Sets: Leaderboard académico                │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕ (Opcional)
┌─────────────────────────────────────────────────────────────┐
│              RedisInsight - Puerto 5540                     │
│  Interfaz gráfica para visualizar datos de Redis           │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Flujos Principales

### 1. Gestión de Sesiones (Login/Logout)

**Problema**: Validar usuarios en cada request es lento si consultamos la BD cada vez.

**Solución**: Almacenar sesiones en Redis con TTL automático.

#### Flujo de Login:

```
1. Usuario → POST /api/sessions/login
   Body: { username: "student1", password: "password123" }

2. Backend → Valida credenciales contra BD simulada

3. Backend → Genera token único (UUID)
   sessionId = "550e8400-e29b-41d4-a716-446655440000"

4. Backend → Redis HSET
   Key: session:550e8400-e29b-41d4-a716-446655440000
   Value: {
     userId: "123",
     username: "student1",
     role: "student",
     loginTime: 1701234567890
   }

5. Backend → Redis EXPIRE
   TTL: 1800 segundos (30 minutos)

6. Backend → Usuario
   Response: { success: true, sessionId: "550e8400..." }

7. Usuario guarda sessionId en localStorage
```

#### Flujo de Verificación:

```
1. Usuario → GET /api/sessions/check?sessionId=550e8400...

2. Backend → Redis HGETALL session:550e8400...

3. Redis → Backend
   • Si existe: Retorna datos de sesión
   • Si no existe: Retorna null (sesión expirada)

4. Backend → Redis EXPIRE (Renovar TTL)
   Rolling session: Resetea a 30 minutos

5. Backend → Usuario
   Response: { valid: true, user: {...} }
```

**Ventajas**:

- ⚡ Validación en <1ms vs 50-200ms de BD tradicional
- 🔄 Auto-limpieza: Redis elimina sesiones expiradas
- 🔒 Seguridad: Tokens únicos y temporales

---

### 2. Caché de Perfiles (Cache-Aside Pattern)

**Problema**: Consultar perfiles de usuario en BD es lento (I/O de disco).

**Solución**: Guardar resultados en Redis por tiempo limitado.

#### Flujo Primera Consulta (Cache MISS):

```
1. Usuario → GET /api/data/student/123

2. Backend → Redis GET student:123:profile

3. Redis → Backend: null (no existe en caché)

4. Backend → Base de Datos Simulada
   Delay artificial de 2 segundos (simula I/O lento)

5. BD → Backend
   Data: { id: 123, name: "Juan", gpa: 9.5, ... }

6. Backend → Redis SET student:123:profile
   Value: '{"id":123,"name":"Juan","gpa":9.5}'
   TTL: 300 segundos (5 minutos)

7. Backend → Usuario
   Response: { data: {...}, meta: { latency: "2003ms", source: "Database" } }
```

#### Flujo Consultas Siguientes (Cache HIT):

```
1. Usuario → GET /api/data/student/123

2. Backend → Redis GET student:123:profile

3. Redis → Backend: '{"id":123,"name":"Juan","gpa":9.5}'
   ⚡ Retorno instantáneo desde RAM

4. Backend → Usuario
   Response: { data: {...}, meta: { latency: "2ms", source: "Redis Cache" } }
```

**Resultado**:

- 🚀 Primera consulta: ~2000ms
- ⚡ Siguientes consultas: ~2ms
- 📊 **Mejora de 1000x en velocidad**

---

### 3. Leaderboard en Tiempo Real

**Problema**: Ordenar miles de estudiantes por puntaje en SQL es costoso (ORDER BY).

**Solución**: Usar Redis Sorted Sets que se auto-ordenan.

#### Flujo de Actualización de Puntaje:

```
1. Usuario → POST /api/leaderboard/submit
   Body: { username: "student1", score: 95.5 }

2. Backend → Redis ZADD leaderboard:academic 95.5 student1
   • Si student1 no existe: Lo agrega
   • Si student1 existe: Actualiza su puntaje
   • Redis reordena automáticamente (O(log N))

3. Backend → Redis ZREVRANK leaderboard:academic student1
   Obtiene nueva posición del estudiante

4. Backend → Usuario
   Response: { success: true, rank: 15, score: 95.5 }
```

#### Flujo de Consulta de Top 10:

```
1. Usuario → GET /api/leaderboard

2. Backend → Redis ZREVRANGE leaderboard:academic 0 9 WITHSCORES
   Obtiene los 10 mejores con sus puntajes

3. Redis → Backend
   [
     { value: "student42", score: 98.5 },
     { value: "student17", score: 97.3 },
     ...
   ]

4. Backend → Usuario
   Response: { leaderboard: [...] }
```

**Ventajas**:

- ⚡ Actualización en O(log N) vs O(N log N) de SQL
- 🎯 Consulta de top N en O(log N + N)
- 🔄 Actualización en tiempo real sin reindexar

---

### 4. Prueba de Estrés (Concurrencia Masiva)

**Objetivo**: Validar que el sistema puede manejar 1000 usuarios simultáneos.

#### Flujo de Stress Test:

```
1. Script → Genera 1000 promesas concurrentes

2. Cada promesa ejecuta:
   a) Login → Crea sesión en Redis
   b) Submit Score → Actualiza leaderboard
   c) Get Profile → Lee desde caché

3. Promise.all() espera a que todas completen

4. Cálculo de métricas:
   • Tiempo total: 3.5 segundos
   • Operaciones totales: 3000 (1000 usuarios × 3 ops)
   • Throughput: 857 ops/segundo
   • Latencia promedio: 3.5ms por operación

5. Resultado → Consola
   ✅ 1000 usuarios procesados exitosamente
   ⚡ 857 operaciones por segundo
```

---

## 📊 Estructuras de Datos en Redis

### Hash: Sesiones de Usuario

```redis
Key: session:550e8400-e29b-41d4-a716-446655440000
Type: Hash
Value:
  userId → "123"
  username → "student1"
  role → "student"
  loginTime → "1701234567890"
TTL: 1800 segundos

Comandos:
  HSET session:{id} userId 123 username student1 ...
  HGETALL session:{id}
  EXPIRE session:{id} 1800
  HDEL session:{id}
```

### String: Caché de Perfiles

```redis
Key: student:123:profile
Type: String
Value: '{"id":123,"name":"Juan","gpa":9.5,"courses":[...]}'
TTL: 300 segundos

Comandos:
  SET student:123:profile '{"id":123,...}' EX 300
  GET student:123:profile
  DEL student:123:profile
```

### Sorted Set: Leaderboard

```redis
Key: leaderboard:academic
Type: Sorted Set
Members:
  student42 → 98.5
  student17 → 97.3
  student8 → 95.1
  student1 → 92.7
  ...

Comandos:
  ZADD leaderboard:academic 95.5 student1
  ZREVRANGE leaderboard:academic 0 9 WITHSCORES
  ZREVRANK leaderboard:academic student1
  ZSCORE leaderboard:academic student1
```

---

## ⚡ Comparación de Rendimiento

### Sesiones: Redis vs Base de Datos Tradicional

| Operación                 | Base de Datos SQL | Redis   | Mejora  |
| ------------------------- | ----------------- | ------- | ------- |
| Login (INSERT)            | 50-100ms          | 1-2ms   | **50x** |
| Verificar sesión (SELECT) | 30-80ms           | 0.5-1ms | **60x** |
| Logout (DELETE)           | 20-50ms           | 0.5-1ms | **40x** |

### Caché: Primera vs Segunda Consulta

| Consulta       | Sin Caché | Con Redis | Mejora    |
| -------------- | --------- | --------- | --------- |
| Primera (MISS) | 2000ms    | 2000ms    | 1x        |
| Segunda (HIT)  | 2000ms    | 2ms       | **1000x** |
| Tercera (HIT)  | 2000ms    | 2ms       | **1000x** |

### Leaderboard: SQL vs Redis Sorted Set

| Operación           | SQL (ORDER BY) | Redis ZSET | Mejora   |
| ------------------- | -------------- | ---------- | -------- |
| Actualizar puntaje  | 100-200ms      | 1-3ms      | **100x** |
| Top 10              | 150-300ms      | 2-5ms      | **75x**  |
| Posición de usuario | 200-400ms      | 1-2ms      | **200x** |

---

## 🐳 Deployment con Docker

### Setup Rápido

```bash
# 1. Levantar Redis y RedisInsight
docker-compose up -d

# 2. Instalar dependencias
cd backend
npm install

# 3. Iniciar backend
npm start

# 4. En otra terminal, iniciar frontend
npm run frontend

# 5. Abrir navegador
http://localhost:8080
```

### Visualización con RedisInsight

```bash
# Acceder a RedisInsight
http://localhost:5540

# Conectar a Redis
Host: redis (o localhost si no usas Docker)
Port: 6379
```

---

## 🎯 Casos de Uso Reales

### 1. Portal Estudiantil

- Login de miles de estudiantes simultáneamente
- Consulta rápida de calificaciones y perfiles
- Ranking académico actualizado en tiempo real

### 2. E-commerce

- Sesiones de compra
- Caché de productos populares
- Leaderboard de productos más vendidos

### 3. Gaming

- Autenticación de jugadores
- Caché de perfiles y estadísticas
- Tablas de clasificación global

### 4. Redes Sociales

- Sesiones de usuario
- Caché de feeds y perfiles
- Trending topics (sorted sets por popularidad)

---

## 🔒 Seguridad y Mejores Prácticas

### Sesiones

- ✅ Tokens UUID únicos e impredecibles
- ✅ TTL automático (auto-logout)
- ✅ Renovación en cada acceso (rolling sessions)
- ⚠️ En producción: Usar HTTPS y tokens firmados (JWT)

### Caché

- ✅ TTL apropiado según frecuencia de cambio
- ✅ Invalidación manual cuando se actualiza la BD
- ✅ Manejo de cache stampede (múltiples requests simultáneos)

### Leaderboard

- ✅ Validación de puntajes (evitar cheating)
- ✅ Rate limiting para evitar spam
- ✅ Auditoría de cambios sospechosos

---

## 📈 Escalabilidad

### Vertical (Más recursos)

- Redis puede manejar millones de keys en RAM
- Throughput: 100,000+ ops/segundo en hardware moderno

### Horizontal (Más instancias)

- Redis Cluster: Sharding automático
- Redis Sentinel: Alta disponibilidad
- Réplicas read-only para distribución de lectura

---

## 🚀 Próximos Pasos

1. **Persistencia**: Configurar RDB + AOF para durabilidad
2. **Pub/Sub**: Notificaciones en tiempo real
3. **Streams**: Event sourcing y logs
4. **Lua Scripts**: Transacciones atómicas complejas
5. **Redis Stack**: Búsqueda full-text, JSON, grafos

---

## 📚 Recursos Adicionales

- [Documentación Oficial de Redis](https://redis.io/docs/)
- [Redis University](https://university.redis.com/)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [RedisInsight](https://redis.io/docs/stack/insight/)

---

## 🎓 Conclusión

Este sistema demuestra cómo Redis puede transformar una aplicación web tradicional en un sistema de alto rendimiento capaz de:

- ⚡ Responder en **milisegundos** en lugar de segundos
- 🚀 Manejar **miles de usuarios concurrentes**
- 💾 Reducir **carga en bases de datos** hasta 1000x
- 📊 Mantener **rankings en tiempo real** sin overhead

La arquitectura modular y bien documentada facilita su extensión para casos de uso más complejos en producción.
