# Funcionamiento del Sistema de Portal Estudiantil

Este documento describe la arquitectura y el flujo de datos del proyecto, explicando cómo interactúan los diferentes componentes para lograr un sistema de alto rendimiento.

## 1. Arquitectura General

El sistema sigue una arquitectura de 3 capas optimizada para velocidad:

```mermaid
graph LR
    User[Usuario / Navegador] <-->|HTTP JSON| API[Servidor Express (Node.js)]
    API <-->|Redis Protocol| Redis[Base de Datos en Memoria]
    API -.->|Simulado| SlowDB[Base de Datos Relacional (Lenta)]
```

1.  **Capa de Presentación (Frontend)**:
    *   Panel de control web (`public/index.html`) que permite a los usuarios interactuar con el sistema.
    *   Calcula y muestra la latencia de cada operación en tiempo real.

2.  **Capa de Lógica (Backend API)**:
    *   Servidor Node.js con Express.
    *   Recibe peticiones HTTP, procesa la lógica de negocio y se comunica con Redis.
    *   Actúa como intermediario, asegurando que el cliente nunca hable directamente con la base de datos.

3.  **Capa de Datos (Redis)**:
    *   Almacena datos "calientes" en memoria RAM.
    *   Responsable de la velocidad extrema en Sesiones, Rankings y Caché.

---

## 2. Flujos Principales de Funcionamiento

### A. Gestión de Sesiones (Login Rápido)
El objetivo es validar usuarios sin consultar una base de datos lenta en disco cada vez.

1.  **Login**: El usuario envía su ID. El servidor genera un token único (UUID).
2.  **Almacenamiento**: Se guarda un objeto `Hash` en Redis (`session:{token}`) con los datos del usuario.
3.  **TTL (Auto-limpieza)**: Se configura para expirar en 30 minutos.
4.  **Validación**: Las siguientes peticiones solo envían el token. Redis verifica en microsegundos si existe. Si sí, renueva el tiempo de vida (Rolling Session).

### B. Leaderboard Académico (Ranking en Tiempo Real)
El desafío es mantener ordenados a miles de estudiantes según sus notas cambiantes.

1.  **Estructura**: Se usa un `Sorted Set` en Redis. Es una lista matemática que se auto-ordena cada vez que insertas un dato.
2.  **Actualización**: Cuando un alumno sube su nota, el servidor hace un `ZADD`. Redis reubica al alumno en su nueva posición instantáneamente (Complejidad O(log N)).
3.  **Consulta**: Para mostrar el "Top 10", el servidor hace un `ZREVRANGE`. Redis solo devuelve los 10 punteros superiores, sin tener que ordenar toda la tabla como haría SQL (`ORDER BY`).

### C. Caché de Perfiles (Protección de Base de Datos)
Evita colapsar la base de datos principal con consultas repetitivas.

1.  **Petición**: El usuario pide ver su perfil.
2.  **Verificación Caché**: El servidor pregunta a Redis: "¿Tienes el perfil de X? (`GET user:X`)".
    *   **Caso SI (Hit)**: Redis devuelve el JSON en <1ms. Se envía al usuario.
    *   **Caso NO (Miss)**:
        1.  El servidor consulta la "Base de Datos Lenta" (simulada, tarda 200ms).
        2.  Guarda el resultado en Redis por 5 minutos.
        3.  Envía el resultado al usuario.
3.  **Resultado**: La primera vez es lenta, las siguientes 1000 veces son instantáneas.

### D. Pruebas de Rendimiento (Benchmark & Stress)
Mecanismos integrados para validar la "potencia bruta".

1.  **Benchmark SQL vs Redis**:
    *   **SQL (Simulado)**: Introduce un delay artificial de 300ms para imitar latencia de I/O y bloqueo.
    *   **Redis**: Ejecuta una consulta real (`ZREVRANGE`).
    *   **Resultado**: Calcula el ratio (ej. Redis es 150x más rápido).

2.  **Prueba de Estrés (Concurrencia)**:
    *   El servidor dispara **1,000 hilos** de promesas (`Promise.all`).
    *   Cada hilo ejecuta una transacción completa: `Login -> Update Score -> Read Rank`.
    *   **Logging**: Se recolectan los logs en memoria y se envían al navegador para no saturar la E/S del servidor.

---

## 3. Resumen de Tecnologías

| Componente | Tecnología | Función Principal |
| :--- | :--- | :--- |
| **Backend** | **Node.js + Express** | Manejo de concurrencia y API REST. |
| **Base de Datos** | **Redis** | Motor en memoria para velocidad extrema. |
| **Cliente** | **HTML5 + JS** | Interfaz visual para pruebas. |
| **Estructuras** | **Hashes, Sorted Sets** | Optimización específica por caso de uso. |
