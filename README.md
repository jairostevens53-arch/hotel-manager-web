# Hotel Manager Web

Panel estático en HTML, CSS y JavaScript. El backend compartido con la app Flutter es la fuente de verdad de las operaciones.

## API

La URL de producción es `https://hotel-manager-api-ttg7.onrender.com/api`. Para apuntar el panel a otro entorno, define `window.HOTEL_API_BASE` antes de cargar `js/api.js` (por ejemplo, en un pequeño script de configuración del hosting):

```html
<script>window.HOTEL_API_BASE = 'https://mi-api.example/api';</script>
```

En este frontend sin bundler no hay acceso seguro a variables de entorno del servidor desde el navegador. El valor es público, por lo que aquí solo debe configurarse una URL de API; nunca una contraseña, token o secreto.

La autenticación usa `POST /login`, `GET /me`, `POST /logout` y tokens Bearer. El token se conserva en `localStorage` para mantener la sesión; los datos operativos se vuelven a consultar al API.

## Funciones conectadas

- Resumen financiero: `GET /reports/dashboard`; desglose y auditoría desde `/sales`, `/expenses`, `/purchases` y `/shifts`.
- Habitaciones, tarifas y estadías: `/rooms`, `/rates`, `/stays`, `/reservations/{id}/check-in`, `/stays/{id}/extend`, `/charge` y `/checkout`.
- Huéspedes y reservas: `/guests` y `/reservations`, con búsqueda, filtros por estado, paginación, edición, alta, cancelación y check-in.
- Tareas: `/tasks`, alta y actualización de estado.
- Caja y ventas: `/shifts/current`, `/shifts/open`, `/shifts/close`, `/sales` y `/expenses`.
- Inventario: `/inventory/movements` para administración; las ventas, compras y ajustes mantienen los cambios de stock bajo control del servidor.
- Catálogo y administración existente: productos, categorías, proveedores, compras, habitaciones, tarifas y usuarios.

## Límites del backend

El API no define un libro separado de facturas y pagos parciales ni aislamiento entre varios hoteles; el panel no simula esas funciones. La consulta de estadías de recepcionista devuelve solo las activas y algunos listados financieros no aceptan filtros por rango de fecha; el frontend usa únicamente filtros y formatos confirmados por las rutas y controladores.

El ordenamiento de tablas es local a la página ya cargada; no cambia la consulta ni los registros del servidor. El backend expone asignación de tareas, pero el listado de usuarios asignables es solo administrativo, así que la reasignación se ofrece únicamente a `admin`.
