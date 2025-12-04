# Guía de Desarrollo - Sistema Redis

## Para Desarrolladores

### Agregar Nuevos Endpoints

1. **Crear controlador** en `src/controllers/`:

```javascript
// src/controllers/miController.js
const { client } = require("../config/redis");

const miFuncion = async (req, res) => {
  try {
    // Tu lógica aquí
    res.json({ success: true });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
};

module.exports = { miFuncion };
```

2. **Crear ruta** en `src/routes/`:

```javascript
// src/routes/miRoutes.js
const express = require("express");
const router = express.Router();
const { miFuncion } = require("../controllers/miController");

router.get("/mi-endpoint", miFuncion);

module.exports = router;
```

3. **Registrar en server.js**:

```javascript
const miRoutes = require("./routes/miRoutes");
app.use("/api/mi-ruta", miRoutes);
```

---

### Usar Redis en Controladores

#### Almacenar String

```javascript
await client.set("clave", "valor");
await client.setEx("clave", 60, "valor"); // Con TTL
```

#### Obtener String

```javascript
const valor = await client.get("clave");
```

#### Almacenar Hash

```javascript
await client.hSet("usuario:1", {
  nombre: "Juan",
  edad: 25,
});
```

#### Obtener Hash

```javascript
const usuario = await client.hGetAll("usuario:1");
```

#### Sorted Set (Leaderboard)

```javascript
// Agregar
await client.zAdd("ranking", {
  score: 95,
  value: "usuario1",
});

// Obtener top 10
const top = await client.zRangeWithScores("ranking", 0, 9, {
  REV: true,
});
```

---

### Debugging

#### Habilitar logs detallados

```javascript
// En cualquier controlador
console.log("[DEBUG]", variable);
```

#### Ver estado de Redis

```javascript
// Agregar endpoint temporal
router.get("/debug/redis", async (req, res) => {
  const keys = await client.keys("*"); // Solo en desarrollo
  res.json({ keys });
});
```

---

### Testing

#### Crear test manual

```javascript
// test/manual.js
const http = require("http");

const makeRequest = (path, method = "GET", data = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "localhost",
      port: 3000,
      path: path,
      method: method,
      headers: { "Content-Type": "application/json" },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve(JSON.parse(body)));
    });

    req.on("error", reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
};

// Usar
makeRequest("/api/sessions/login", "POST", {
  username: "student1",
  password: "password123",
}).then(console.log);
```

---

### Mejores Prácticas

1. **Siempre usar try/catch**
2. **Validar inputs**
3. **Logging apropiado**
4. **Manejar errores de Redis**
5. **Usar TTL cuando sea apropiado**
6. **No exponer stack traces en producción**

---

### Variables de Entorno

```env
# Desarrollo
USE_MOCK_REDIS=true
PORT=3000
REDIS_URL=redis://localhost:6379

# Producción
USE_MOCK_REDIS=false
PORT=80
REDIS_URL=redis://redis-server:6379
```

---

### Deployment

1. **Instalar Redis real**
2. **Cambiar USE_MOCK_REDIS=false**
3. **Configurar REDIS_URL**
4. **Usar process manager (PM2)**:

```bash
npm install -g pm2
pm2 start src/server.js --name redis-api
pm2 startup
pm2 save
```

---

## Extensiones Sugeridas

- [ ] Autenticación con JWT
- [ ] Rate limiting
- [ ] Persistencia de datos
- [ ] WebSockets para leaderboard en tiempo real
- [ ] Métricas con Prometheus
- [ ] Tests unitarios con Jest
- [ ] CI/CD con GitHub Actions
