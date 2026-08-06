# Despliegue

## Firebase

1. Copia `.firebaserc.example` como `.firebaserc`.
2. Reemplaza `TU_FIREBASE_PROJECT_ID`.
3. Ejecuta `npm run firebase:rules`.

## GitHub

```bash
git init
git add .
git commit -m "feat: versión inicial de TorqueFlow"
git branch -M main
git remote add origin URL_DE_TU_REPOSITORIO
git push -u origin main
```

## Vercel

Importa el repositorio y configura las variables de entorno en Production, Preview y Development. Las funciones bajo `/api` se desplegarán con el mismo proyecto.

## Dominio

Una vez validado el despliegue, agrega el dominio en Vercel y registra ese dominio en Firebase Authentication > Settings > Authorized domains.
