# API Reference - Sistema Redis

## Base URL

```
http://localhost:3000/api
```

---

## Autenticación

### POST /sessions/login

Inicia sesión y crea una sesión en Redis.

**Request Body:**

```json
{
  "username": "string",
  "password": "string"
}
```

**Success Response (200):**

```json
{
  "message": "Inicio de sesión exitoso",
  "sessionId": "uuid-v4-string"
}
```

**Error Responses:**

- **401 Unauthorized**
  ```json
  {
    "message": "Credenciales inválidas"
  }
  ```
- **500 Internal Server Error**
  ```json
  {
    "message": "Error interno del servidor"
  }
  ```

**Ejemplo con curl:**

```bash
curl -X POST http://localhost:3000/api/sessions/login \
  -H "Content-Type: application/json" \
  -d '{"username":"student1","password":"password123"}'
```

**Ejemplo con JavaScript:**

```javascript
const response = await fetch("http://localhost:3000/api/sessions/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "student1",
    password: "password123",
  }),
});
const data = await response.json();
console.log(data.sessionId);
```

---

### POST /sessions/logout

Cierra sesión y elimina la sesión de Redis.

**Request Body:**

```json
{
  "sessionId": "uuid-v4-string"
}
```

**Success Response (200):**

```json
{
  "message": "Cierre de sesión exitoso"
}
```

**Error Responses:**

- **400 Bad Request**
  ```json
  {
    "message": "ID de sesión requerido"
  }
  ```
- **500 Internal Server Error**
  ```json
  {
    "message": "Error al cerrar sesión"
  }
  ```

**Ejemplo con curl:**

```bash
curl -X POST http://localhost:3000/api/sessions/logout \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"your-session-id-here"}'
```

---

### GET /sessions/check

Verifica si una sesión está activa.

**Query Parameters:**

- `sessionId` (required): UUID de la sesión

**Success Response (200):**

```json
{
  "session": {
    "userId": "1",
    "username": "student1",
    "role": "student"
  }
}
```

**Error Responses:**

- **401 Unauthorized**
  ```json
  {
    "message": "No se proporcionó sesión"
  }
  ```
  ```json
  {
    "message": "Sesión expirada o inválida"
  }
  ```
- **500 Internal Server Error**
  ```json
  {
    "message": "Error al verificar sesión"
  }
  ```

**Ejemplo con curl:**

```bash
curl "http://localhost:3000/api/sessions/check?sessionId=your-session-id"
```

**Notas:**

- Las sesiones expiran después de 30 minutos (1800 segundos)
- Se almacenan en Redis con patrón: `session:{sessionId}`

---

## Datos (Caché)

### GET /data/student/:id

Obtiene el perfil de un estudiante. Implementa caché con estrategia Cache-Aside.

**URL Parameters:**

- `id` (required): ID del estudiante

**Success Response (200):**

```json
{
  "source": "cache", // o "database"
  "data": {
    "id": 1,
    "name": "John Doe",
    "major": "Computer Science",
    "courses": ["CS101", "CS102", "MATH201", "PHYS101"],
    "gpa": 3.8
  }
}
```

**Error Response (500):**

```json
{
  "message": "Error del Servidor"
}
```

**Ejemplo con curl:**

```bash
curl http://localhost:3000/api/data/student/1
```

**Comportamiento de Caché:**

- **Primera llamada**: ~2000ms (simula consulta lenta a BD)
- **Llamadas subsecuentes**: <10ms (desde caché Redis)
- **TTL**: 60 segundos
- **Patrón de clave**: `student:{id}:profile`

**Ejemplo JavaScript con medición de tiempo:**

```javascript
const start = Date.now();
const response = await fetch("http://localhost:3000/api/data/student/1");
const data = await response.json();
const time = Date.now() - start;

console.log(`Fuente: ${data.source}`);
console.log(`Tiempo: ${time}ms`);
```

---

## Leaderboard

### POST /leaderboard/submit

Envía un puntaje al leaderboard. Usa Redis Sorted Sets.

**Request Body:**

```json
{
  "username": "string",
  "score": number
}
```

**Success Response (200):**

```json
{
  "message": "Puntaje enviado exitosamente"
}
```

**Error Responses:**

- **400 Bad Request**
  ```json
  {
    "message": "Usuario y puntaje son requeridos"
  }
  ```
  ```json
  {
    "message": "El puntaje debe ser un número válido"
  }
  ```
- **500 Internal Server Error**
  ```json
  {
    "message": "Error del Servidor"
  }
  ```

**Ejemplo con curl:**

```bash
curl -X POST http://localhost:3000/api/leaderboard/submit \
  -H "Content-Type: application/json" \
  -d '{"username":"student1","score":95.5}'
```

**Validaciones:**

- `username`: requerido, string
- `score`: requerido, debe ser número válido (se convierte con parseFloat)

**Notas:**

- Si el usuario ya existe, se actualiza su puntaje
- Patrón de clave: `leaderboard:academic`
- Ordenamiento: descendente (mayor a menor)

---

### GET /leaderboard

Obtiene el top 10 del leaderboard.

**Success Response (200):**

```json
{
  "leaderboard": [
    {
      "value": "student1",
      "score": 95.5
    },
    {
      "value": "student2",
      "score": 87.3
    },
    ...
  ]
}
```

**Error Response (500):**

```json
{
  "message": "Error del Servidor"
}
```

**Ejemplo con curl:**

```bash
curl http://localhost:3000/api/leaderboard
```

**Ejemplo JavaScript:**

```javascript
const response = await fetch("http://localhost:3000/api/leaderboard");
const data = await response.json();

data.leaderboard.forEach((entry, index) => {
  console.log(`${index + 1}. ${entry.value}: ${entry.score}`);
});
```

**Notas:**

- Retorna máximo 10 usuarios
- Ordenados por puntaje (mayor a menor)
- Usa Redis ZREVRANGE internamente

---

## Códigos de Estado HTTP

| Código | Significado                                |
| ------ | ------------------------------------------ |
| 200    | OK - Solicitud exitosa                     |
| 400    | Bad Request - Datos inválidos              |
| 401    | Unauthorized - No autorizado               |
| 500    | Internal Server Error - Error del servidor |

---

## Rate Limiting

**Actualmente**: No implementado

**Recomendado para producción**:

```javascript
const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de requests
});

app.use("/api/", limiter);
```

---

## CORS

**Configuración actual**: Permitir todos los orígenes (desarrollo)

```javascript
app.use(cors());
```

**Recomendado para producción**:

```javascript
app.use(
  cors({
    origin: "https://tu-dominio.com",
    credentials: true,
  })
);
```

---

## Patrones de Clave Redis

| Tipo        | Patrón                 | Ejemplo                |
| ----------- | ---------------------- | ---------------------- |
| Sesión      | `session:{sessionId}`  | `session:abc-123`      |
| Caché       | `student:{id}:profile` | `student:1:profile`    |
| Leaderboard | `leaderboard:academic` | `leaderboard:academic` |

---

## Ejemplos de Flujo Completo

### Flujo de Login y Obtener Perfil

```javascript
// 1. Login
const loginRes = await fetch("http://localhost:3000/api/sessions/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "student1",
    password: "password123",
  }),
});
const { sessionId } = await loginRes.json();

// 2. Verificar sesión
const checkRes = await fetch(
  `http://localhost:3000/api/sessions/check?sessionId=${sessionId}`
);
const { session } = await checkRes.json();
console.log("Usuario:", session.username);

// 3. Obtener perfil (primera vez - lento)
const start1 = Date.now();
const profileRes1 = await fetch("http://localhost:3000/api/data/student/1");
const profile1 = await profileRes1.json();
console.log("Primera llamada:", Date.now() - start1, "ms");
console.log("Fuente:", profile1.source); // "database"

// 4. Obtener perfil (segunda vez - rápido)
const start2 = Date.now();
const profileRes2 = await fetch("http://localhost:3000/api/data/student/1");
const profile2 = await profileRes2.json();
console.log("Segunda llamada:", Date.now() - start2, "ms");
console.log("Fuente:", profile2.source); // "cache"

// 5. Logout
await fetch("http://localhost:3000/api/sessions/logout", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sessionId }),
});
```

### Flujo de Leaderboard

```javascript
// 1. Enviar puntaje
await fetch("http://localhost:3000/api/leaderboard/submit", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "student1",
    score: 95.5,
  }),
});

// 2. Obtener ranking
const res = await fetch("http://localhost:3000/api/leaderboard");
const { leaderboard } = await res.json();

// 3. Mostrar top 10
leaderboard.forEach((entry, index) => {
  console.log(`${index + 1}. ${entry.value}: ${entry.score} puntos`);
});
```

---

## Testing con Postman

### Colección de Requests

1. **Login**

   - Method: POST
   - URL: `http://localhost:3000/api/sessions/login`
   - Body (JSON):
     ```json
     {
       "username": "student1",
       "password": "password123"
     }
     ```

2. **Check Session**

   - Method: GET
   - URL: `http://localhost:3000/api/sessions/check?sessionId={{sessionId}}`

3. **Get Profile**

   - Method: GET
   - URL: `http://localhost:3000/api/data/student/1`

4. **Submit Score**

   - Method: POST
   - URL: `http://localhost:3000/api/leaderboard/submit`
   - Body (JSON):
     ```json
     {
       "username": "student1",
       "score": 95.5
     }
     ```

5. **Get Leaderboard**
   - Method: GET
   - URL: `http://localhost:3000/api/leaderboard`

---

**Última actualización**: Diciembre 2025  
**Versión API**: 1.0.0
