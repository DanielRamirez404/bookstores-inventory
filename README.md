# Bookstores Inventory Management System

> **Nota:** Este proyecto y la documentación del presente README fueron desarrollados y/o estructurados con el soporte de un Modelo de Lenguaje (LLM).

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
