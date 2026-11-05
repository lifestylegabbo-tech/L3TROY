# L3TROY — Sitio oficial y panel de administración

Landing narrativa (storytelling) con identidad neón, panel de administración con biblioteca de medios y gestión de usuarios.

**Stack:** Next.js (App Router) · Neon Postgres · Neon Object Storage (compatible con S3) · Vercel.

## Qué incluye

- **Landing en capítulos:** Portada → Historia → Estudio → Sets (reproductor con visualizador) → En cabina (eventos) → Galería → Colaboraciones → Contacto.
- **Panel `/admin`:** Media Library, textos y eventos, almacenamiento, usuarios (Administrador / Productor / Manager) y cambio de contraseña.
- **Publicación automática:** lo que se publica en el panel aparece en la sección correspondiente de la landing (con fecha de publicación programable).

## Almacenamiento y calidad original

- Los originales **nunca se recomprimen ni se reemplazan**. Se guardan tal cual en Neon Object Storage.
- Para imágenes se generan **versiones de visualización** (WebP 640 px y hasta 1800 px) que se guardan aparte; la landing usa `srcset` para cargar la adecuada. Los TIFF no se pueden decodificar en todos los navegadores: se conservan íntegros y se sirven como original.
- Para video se conserva el original, se reproduce directamente (MP4/MOV/WebM compatibles con el navegador), con carga diferida, controles y portada generada. **No hay transcodificación ni streaming adaptativo**: para eso haría falta un servicio adicional (por ejemplo Mux o Cloudflare Stream).
- Buckets (todos **privados**): `artist-branding`, `artist-photography`, `events`, `event-videos`, `music-sets`, `promotional-media`, `collaborations`, `documents`.
- Los archivos publicados se entregan por `/api/media/:id`, que valida que estén publicados y redirige a una URL firmada de 1 hora. Los no publicados solo se ven con sesión. Descargar el original requiere sesión.

### Cargas

- Directo del navegador al almacenamiento (los archivos no pasan por las funciones de Vercel). El servidor solo autoriza, valida y registra.
- Archivos ≤ 16 MiB: una sola petición firmada. Archivos mayores: **carga multiparte S3** (partes de 16 MiB, 3 en paralelo, reintentos con espera creciente) y **reanudación**: si se corta la conexión o se cierra la pestaña, al volver a elegir el mismo archivo continúa desde las partes ya subidas.
- Nota técnica: el protocolo **TUS** (`tus-js-client`) no está disponible en Neon Object Storage; la reanudación se implementa con multipart de S3, que cubre el mismo objetivo.
- Límites por tipo configurables (tabla `site_settings`, clave `allowed_formats`): imágenes 100 MB, video 2 GB, audio 500 MB, PDF 50 MB.

## Variables de entorno

Ver `.env.example`. Principales: `DATABASE_URL`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `SESSION_SECRET` (mín. 32 caracteres), `STORAGE_QUOTA_BYTES` (cuota real del plan; si está vacía el panel no inventa ningún límite).

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # completar valores
npm run seed:admin           # crea el primer administrador (ADMIN_EMAIL / ADMIN_PASSWORD)
npm run dev
```

1. Entrar a `/admin` con el administrador.
2. **Almacenamiento → Configurar permisos de subida** (una vez por dominio): autoriza al navegador a subir directo a los buckets (CORS). Alternativa por consola: `npm run setup:cors` con `SITE_ORIGINS` definido.
3. Cambiar la contraseña inicial en **Mi cuenta**.

## Despliegue en Vercel

1. Importar el repositorio en Vercel.
2. Cargar las variables de entorno de `.env.example` (sin comillas).
3. Desplegar. Luego, en `/admin`, ejecutar **Configurar permisos de subida** con el dominio final.

## Seguridad

- Sesiones con cookie `httpOnly` firmada (JWT HS256, 7 días), verificada contra la base en cada petición; usuarios desactivados pierden acceso de inmediato.
- Contraseñas con bcrypt (costo 12), límite de intentos de inicio de sesión.
- Roles: **Administrador** (todo) y **Productor** y **Manager** (subir, editar y publicar contenido, cotizaciones y clientes; no gestionan usuarios ni formatos).
- Ninguna credencial llega al navegador: solo URLs firmadas y de corta duración.
- Eliminar un archivo en uso pide confirmación, indica dónde está publicado y, al borrarlo, desaparece de la landing sin dejar enlaces rotos.

## Panel de almacenamiento

Muestra espacio usado (originales + versiones), disponible según `STORAGE_QUOTA_BYTES`, conteo de fotos/videos/audios/archivos, desglose por carpeta, los 10 archivos más pesados y alertas al 75 % y 90 %. El tráfico de transferencia no lo expone el almacenamiento por API; se consulta en la consola de Neon.

## Contenido editable

Todos los textos de los capítulos, redes sociales y datos de booking se editan en **Textos y eventos**. Los eventos (fecha, lugar, enlace de boletos) alimentan el capítulo «En cabina».
