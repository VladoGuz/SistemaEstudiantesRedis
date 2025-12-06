# Proyecto Final Redis - Portal Estudiantil

Sistema de alto rendimiento para gestión de sesiones, caché y leaderboard académico utilizando Redis y Node.js.

## Requisitos Previos

1.  **Node.js**: v14 o superior.
2.  **Redis**: Debe tener un servidor Redis ejecutándose en `localhost:6379`.

## Instalación

1.  Clonar el repositorio o descargar el código.
2.  Instalar dependencias:
    ```bash
    npm install
    ```

## Configuración

El proyecto espera que Redis esté ejecutándose en el puerto por defecto. Si necesitas cambiar la configuración, puedes crear un archivo `.env` en la raíz (aunque no es estrictamente necesario para la prueba local por defecto):

```env
REDIS_URL=redis://localhost:6379
```

## Ejecución

El proyecto consta de dos scripts principales para probar la funcionalidad:

### 1. Poblar la Base de Datos (`seed`)

Este script genera 1000 estudiantes aleatorios, sus puntuaciones y algunas sesiones activas. **Ejecutar esto primero.**

```bash
node src/scripts/seed.js
```
*Esto limpiará la base de datos actual (FLUSHDB) y generará nuevos datos.*

### 2. Iniciar el Servidor (`start`)

Esto levantará el servidor Express en `http://localhost:3000`.

```bash
npm start
```

### 3. Usar el Dashboard

Abre tu navegador y visita **`http://localhost:3000`**. Desde ahí podrás visualizar la demostración interactiva:
1.  **Gestión de Sesiones**: Login/Logout con tokens.
2.  **Leaderboard en Vivo**: Tabla de posiciones que se actualiza al instante.
3.  **Benchmark Comparativo**: ¿SQL vs Redis? Ejecuta una carrera en tiempo real y ve la diferencia gráfica.
4.  **Prueba de Estrés**: Lanza 1,000 usuarios concurrentes (3,000 operaciones) y mide el throughput real de tu máquina.
    *   *Tip: Abre la consola del navegador (F12) para ver los logs detallados de cada operación.*

### (Opcional) Ejecutar Pruebas de Consola (`queries`)
Si prefieres ver los logs en la terminal:
```bash
node src/scripts/queries.js
```

## Estructura del Proyecto

*   `src/server.js`: Servidor Express y API REST.
*   `public/`: Frontend de demostración (HTML/JS).
*   `src/config/redis.js`: Configuración y cliente de conexión Redis.
*   `src/services/`
    *   `sessionService.js`: Manejo de sesiones (Hash) con TTL.
    *   `leaderboardService.js`: Gestión de rankings (Sorted Sets).
    *   `cacheService.js`: Utilidad para caché genérico (Strings).
*   `src/scripts/`
    *   `seed.js`: Script de generación de datos fake.
    *   `queries.js`: Script de validación por consola.

## Documentación Técnica

Para ver la justificación técnica, diagramas y análisis de resultados, consulta el archivo generado `report.md`.
