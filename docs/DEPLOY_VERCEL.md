# Desplegar Kaonashi en Vercel (paso a paso)

Tiempo estimado: 10 minutos. No necesitas instalar nada en tu computador.

## Qué se despliega

| Pieza | Dónde corre |
| :--- | :--- |
| Frontend (React + Vite) | CDN de Vercel, como archivos estáticos |
| API (`/api/*`) y resolutor de QR (`/r/*`) | Una sola función de Vercel (Node 22), empaquetada con esbuild |
| Base de datos | **Neon Postgres** (gratis, se conecta desde Vercel) |
| Tareas programadas | Vercel Cron llama a `/api/cron/tick` una vez al día |

`npm run build:vercel` produce todo en `.vercel/output` (Build Output API de Vercel). `vercel.json` ya le dice a Vercel que use ese comando, así que no hay que configurar nada a mano.

## 1. Importar el repositorio

1. Entra a <https://vercel.com/new> e inicia sesión con GitHub.
2. Elige el repositorio **Kaonashi** → **Import**.
3. En *Framework Preset* deja **Other** (lo fija `vercel.json`). No cambies los comandos de build.
4. **Antes de pulsar Deploy**, abre *Environment Variables* y agrega por lo menos:

| Variable | Valor | Por qué |
| :--- | :--- | :--- |
| `ENV_MASTER_SEED` | una contraseña larga tuya | Contraseña de `kaonashi_sysmaster`. Sin ella queda la del README, que es pública. |
| `DEMO_STAFF_PASSWORD` | otra contraseña larga | Contraseña de las otras cuentas de personal de demostración. |
| `CRON_SECRET` | cualquier texto aleatorio largo | Protege `/api/cron/tick`. |

> Las contraseñas se aplican **la primera vez** que se crea la base de datos. Si las cambias después, usa "Reset demo data" desde una sesión sysmaster o crea una base nueva.

5. Pulsa **Deploy**. El primer despliegue puede terminar con la base aún sin conectar; eso se arregla en el paso 2.

## 2. Conectar Neon (la base de datos)

1. En el proyecto de Vercel: **Storage → Create Database → Neon (Serverless Postgres)** → región cercana (por ejemplo `Washington, D.C. (iad1)` o `São Paulo`).
2. Acepta conectar la base al proyecto en los entornos *Production* y *Preview*. Vercel crea la variable `DATABASE_URL` automáticamente.
3. Ve a **Deployments → ⋯ → Redeploy** para que la función tome la nueva variable.

La **primera petición** crea las tablas y genera el histórico de demostración (≈120 días: unos 15.000 pedidos, 22.000 escaneos y 67.000 eventos del embudo). Puede tardar hasta un minuto; después todo responde en milisegundos. Si prefieres hacerlo desde tu computador:

```bash
DATABASE_URL="postgres://…(copiado de Neon)…" npm run db:seed
```

Para un histórico más chico o más grande, define `SEED_DAYS` (7–365) antes del primer arranque.

## 3. Probar

- `https://TU-PROYECTO.vercel.app/` → sitio de clientes.
- `https://TU-PROYECTO.vercel.app/login` → acceso del personal (`kaonashi_sysmaster` + tu `ENV_MASTER_SEED`).
- `/admin/analytics` → **Análisis de datos** (ventas, marketing BTL, clientes, inventario).
- `/account/login` → clientes: código por e-mail o Google.
- `/api/health` → muestra `"backend":"neon"` y el número de registros por colección.

Para comprobar el circuito completo desde tu computador:

```bash
APP_BASE_URL=https://TU-PROYECTO.vercel.app \
VERIFY_STAFF_PASS='tu ENV_MASTER_SEED' npm run verify
```

## 4. Opcional: login real de clientes

### Google
1. <https://console.cloud.google.com/apis/credentials> → **Create credentials → OAuth client ID → Web application**.
2. *Authorized JavaScript origins*: `https://TU-PROYECTO.vercel.app` (y tu dominio propio si tienes).
3. Copia el *Client ID* a la variable `GOOGLE_CLIENT_ID` en Vercel y redeploy.

Sin `GOOGLE_CLIENT_ID`, en modo demo aparece un botón **Google (SIMULADO)** con dos cuentas de prueba.

### Código por e-mail
1. Crea una cuenta en <https://resend.com>, verifica tu dominio y genera una API key.
2. En Vercel: `RESEND_API_KEY` y `EMAIL_FROM` (por ejemplo `Kaonashi <hola@tudominio.com>`).

Sin `RESEND_API_KEY`, el código aparece en la pantalla dentro de un recuadro **BUZÓN SIMULADO**.

## 5. Pasar de demo a producción

1. Variables: `APP_ENV=production`, `DEMO_MODE=false`, `SESSION_SECRET`, `QR_HMAC_SECRET`, `OTP_PEPPER` (valores aleatorios largos, distintos entre sí) y `ENV_MASTER_SEED`.
2. Usa una base Neon nueva: en producción solo se crea la cuenta sysmaster (debe cambiar su contraseña al entrar) y el menú, sin datos inventados.
3. Configura `APP_BASE_URL` con tu dominio definitivo **antes** de imprimir QR.

> Si cambias `QR_HMAC_SECRET` después de imprimir, los QR impresos dejan de validar. Guárdalo bien.

## Límites conocidos

- Sin `DATABASE_URL`, en Vercel la app intenta arrancar sin base persistente y responde 503 en la API: conecta Neon.
- El tiempo real (cocina y seguimiento del pedido) usa Server-Sent Events que consultan la base cada 1,5 s y se reconectan cada ~50 s, porque las funciones de Vercel no mantienen conexiones indefinidas.
- El cron del plan Hobby de Vercel corre una vez al día. Lo que depende del tiempo (vencimiento de campañas, reservas retenidas) se calcula al leer, así que no depende del cron.
