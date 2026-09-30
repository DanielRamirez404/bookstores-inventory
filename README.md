# Bookstores Inventory Management System

> **Nota:** La documentación del presente README fue desarrollada con el soporte de un Modelo de Lenguaje (LLM).

Sistema de gestión de inventario para librerías desarrollado como parte de una prueba técnica. La aplicación cuenta con un backend en **FastAPI** (Python) integrado con **PostgreSQL** mediante SQLAlchemy, y un frontend básico en **React** con **Tailwind CSS**.

---

## 🛠️ Requisitos Previos e Instalación

Para ejecutar este proyecto de forma local, asegúrate de tener instalados:
* [Docker](https://www.docker.com/) y Docker Compose
* [uv](https://github.com/astral-sh/uv) (Gestor rápido de paquetes y entornos de Python)
* [Node.js](https://nodejs.org/) (con `npm`)

---

## 🚀 Guía de Ejecución

### 1. Configuración de Variables de Entorno
Dirígete a la carpeta del backend (`bookstores-inventory-api/`) y revisa el archivo `.env`. Asegúrate de completar la clave de API que se encuentra vacía:

```env
API_KEY=tu_clave_aqui

```

### 2. Iniciar la Base de Datos (PostgreSQL)

Levanta el contenedor de PostgreSQL utilizando Docker Compose desde el directorio correspondiente:

```bash
docker compose up -d

```

### 3. Ejecutar el Backend (FastAPI)

Instala las dependencias y ejecuta el servidor de desarrollo utilizando `uv`:

```bash
# Instalar dependencias del proyecto
uv sync

# Ejecutar el servidor FastAPI
uv run uvicorn app.main:app --reload

```

El backend quedará disponible por defecto en `http://localhost:8000`.

### 4. Ejecutar el Frontend

Navega a la carpeta del frontend, instala las dependencias (si aún no lo has hecho) y levanta el servidor de desarrollo:

```bash
npm install
npm run dev

```

El frontend estará accesible en la URL local provista por Vite/React (habitualmente `http://localhost:5173`, que es como está definido en el middleware de CORS).

---

## 📝 Observaciones Técnicas y Decisiones de Diseño

### 🎯 Unificación de Endpoints de Búsqueda y Paginación

En el enunciado del ejercicio se solicitaba de manera opcional la creación de los siguientes endpoints independientes:

* `GET /books/search?category={category}` — Buscar libros por categoría.
* `GET /books/low-stock?threshold=10` — Filtrar libros con stock bajo.
* Paginación sobre los listados.

**Decisión:** Se optó por **unificar todas estas funcionalidades dentro del endpoint principal `GET /books**`, utilizando parámetros de consulta (*query parameters*) opcionales (`category`, `threshold`, `page`, `limit`).

**Justificación y Buenas Prácticas:**

1. **RESTful Design:** Creación de endpoints limpios y consistentes. Los filtros y la paginación representan transformaciones/vistas sobre una misma colección (`/books`), por lo que saturar la API con múltiples rutas redundantes atenta contra las buenas prácticas REST.
2. **Simplicidad en el Frontend (React Query / `@tanstack/react-query`):** Al diseñar la API pensando de antemano en la integración con `useQuery`, es considerablemente más sencillo y mantenible gestionar una única query key (ej. `['books', { category, threshold, page }]`) que condicione sus parámetros a una sola función de fetch, en lugar de alternar dinámicamente entre tres endpoints distintos.

---

### 🛡️ Atomicidad y Consultas con `stmt` (SQLAlchemy)

Se priorizó el uso de sentencias explícitas (`stmt`) ejecutadas en bloques atómicos a nivel de base de datos, en lugar de realizar validaciones imperativas en código Python del estilo `if (existe_libro) { ejecutar_segunda_query() }`. Esto previene condiciones de carrera (*race conditions*) y garantiza la integridad de las transacciones.

**Excepción conocida (Límite del cálculo de moneda):**
El único escenario donde no se logró garantizar atomicidad total fue en la lógica del **cálculo/conversión de moneda**. Existe un intervalo de tiempo desde que se consulta el país objetivo hasta que se efectúa la operación final en la base de datos. Esto introduce una posible *race condition*: si la información del país es modificada por otra petición en medio de dicho intervalo, la consulta podría actualizar el registro utilizando el valor o la tasa de cambio del país solicitado en la petición previa.

---

### ⏱️ Alcance del Proyecto (Límite de 4 horas) y Deuda Técnica

El desarrollo expuesto representa todo lo alcanzado durante el margen de tiempo establecido de **4 horas**.

* **Frontend y Generación por LLM:** Debido a la restricción de tiempo, no fue posible desarrollar un frontend manual extenso que reflejara completamente todas mis buenas prácticas habituales de UI/UX y arquitectura de software. Relegué la conexión con el backend mediante `useQuery` y el maquetado estilizado con **Tailwind CSS** directamente a un LLM, considerando que era la vía más rápida para validar la integración.
* **Componentes e Mantenibilidad:** Aunque la intención inicial era integrar **shadcn/ui**, se consideró que el diseño generado por el LLM era suficiente para fines demostrativos. Se reconoce que esto deja el código del cliente menos estructurado y más difícil de mantener de lo que respondería a un estándar de producción.
* **Detalle omitido en la Paginación:** Al momento de estar construyendo la interfaz en el frontend, me percaté de que olvidé incluir en la respuesta JSON del backend un campo que indique el **número máximo de páginas** (`total_pages`) para una búsqueda dada.
