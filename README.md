# Mi Caja – Sistema de cajero

Punto de venta para un local pequeño: escaneas productos con la cámara del celular, cobras y ves en un dashboard cuánto vendes.

## Funciones

- **Caja**: escaneo en vivo con la cámara (o foto, búsqueda por nombre, lector USB), carrito, cobro en efectivo/QR/tarjeta con cálculo de cambio.
- **Productos**: inventario con stock, costo y alerta de stock mínimo. Importación masiva pegando desde Excel. Si escaneas un código nuevo, te pide los datos y lo guarda.
- **Dashboard**: ventas, ganancia estimada, número de ventas y ticket promedio (hoy, 7 días, 30 días, este mes), gráfico por hora o por día, productos más vendidos, formas de pago, stock bajo, últimas ventas (con opción de anular).
- **Cierre**:
  - **Cerrar caja**: guarda un registro del cierre y descarga un reporte PDF del día (total vendido, ganancia, ventas por forma de pago, cuánto se vendió de cada producto y el detalle de cada venta).
  - **Exportar a Excel**: todas las ventas registradas juntas (todos los días, meses y años) en un .xlsx con tres hojas: Ventas (con totales), Detalle por producto e Inventario.

## Tecnologías

| Tecnología | Para qué se usa |
|---|---|
| [React 19](https://react.dev) | Interfaz de usuario (componentes) |
| [Vite](https://vite.dev) | Servidor de desarrollo y compilación |
| [React Router](https://reactrouter.com) | Navegación entre Caja, Productos, Dashboard y Cierre |
| [Dexie.js](https://dexie.org) (IndexedDB) | Base de datos dentro del navegador: funciona sin internet |
| [ZXing](https://github.com/zxing-js/browser) | Lectura de códigos de barras (EAN-13, EAN-8, UPC, Code 128, Code 39, ITF, QR) |
| [Recharts](https://recharts.org) | Gráfico de ventas del dashboard |
| [Lucide](https://lucide.dev) | Íconos de la interfaz |
| [ExcelJS](https://github.com/exceljs/exceljs) | Exportación a Excel con formato |
| [jsPDF](https://github.com/parallax/jsPDF) + [AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) | Reporte PDF del cierre de caja |
| CSS propio | Diseño adaptable a celular y computadora, modo claro/oscuro automático |

## Cómo ejecutarlo

Necesitas [Node.js](https://nodejs.org) 20 o superior.

```bash
npm install      # instala las dependencias (solo la primera vez)
npm run dev      # abre la app en http://localhost:5173
```

Para generar la versión final (carpeta `dist/`):

```bash
npm run build
npm run preview  # prueba la versión compilada
```

## Usarlo en el celular

La cámara del navegador **solo funciona con `https://`** (o en `localhost`), así que hay que publicar la app.

### GitHub Pages (ya configurado)

GitHub Pages necesita un `index.html` listo para el navegador. El `index.html` de la raíz es solo la plantilla de Vite: la versión final la genera `npm run build` dentro de `dist/`. El archivo `.github/workflows/deploy.yml` hace esa compilación en GitHub cada vez que subes cambios a `main` y publica `dist/`.

Solo hay que activarlo una vez:

1. En el repositorio: **Settings → Pages**.
2. En **Build and deployment → Source**, elige **GitHub Actions**.
3. Ve a la pestaña **Actions** y espera a que termine "Publicar en GitHub Pages" (o ejecútalo con **Run workflow**).
4. La app queda en `https://<tu-usuario>.github.io/sistema-de-cajero/`.

> En un plan gratuito de GitHub, Pages solo funciona con repositorios **públicos**.

### Otras opciones

- **Vercel** o **Netlify**: conecta este repositorio (comando `npm run build`, carpeta `dist`).

Después, abre el enlace en el celular y usa "Agregar a la pantalla de inicio" para tenerlo como app.

## Dónde se guardan los datos

Los productos y las ventas se guardan **en el navegador del dispositivo** (IndexedDB). Por eso:

- Funciona sin internet.
- Cada dispositivo tiene sus propios datos.
- Si borras los datos del navegador, se pierden. El historial de ventas se puede descargar en **Cierre → Exportar a Excel**.
- Está previsto agregar un backend con base de datos en la nube para compartir y asegurar los datos.

Para compartir los datos entre varios dispositivos en tiempo real, reemplaza las funciones de `src/db/repositorio.js` por un servicio en la nube (por ejemplo Supabase o Firebase). El resto de la app no necesita cambios.

## Estructura del proyecto

```
src/
  main.jsx              punto de entrada
  App.jsx               navegación y diseño general
  index.css             estilos
  db/
    database.js         esquema de la base de datos (Dexie)
    repositorio.js      todas las operaciones de datos (productos, ventas, cierres)
  lib/
    formato.js          formato de dinero (Bs) y fechas
    estadisticas.js     cálculos del dashboard
    exportarExcel.js    archivo Excel de ventas e inventario
    reporteCierre.js    resumen y PDF del cierre de caja
  components/
    Escaner.jsx         cámara en vivo + lectura por foto (ZXing)
    EscanerLazy.jsx     carga el escáner solo cuando se usa
    Cobro.jsx           ventana de cobro y cambio
    ProductoForm.jsx    crear/editar producto
    ImportarLista.jsx   carga masiva de productos
    Modal.jsx           ventana emergente
    Avisos.jsx          mensajes y confirmaciones
  pages/
    Caja.jsx  Productos.jsx  Dashboard.jsx  Cierre.jsx
```
