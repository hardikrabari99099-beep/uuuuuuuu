# Hello You Workshop

hy

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/83f1656f-5269-48aa-bc12-fcc2dea7e82d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Deploying on Netlify

The site is deployed on Netlify as a server-rendered TanStack Start app. The
`@netlify/vite-plugin-tanstack-start` plugin (see `vite.config.ts`) turns the SSR
server — including the `/api/*` backend in `src/server/api-handler.js` — into a
Netlify Function, and the static client assets are published from `dist/client`
(see `netlify.toml`). To run locally with Netlify emulation, use `netlify dev`.

Without Supabase credentials the backend falls back to its built-in in-memory
store **only in local development**. In production (`NODE_ENV=production`, Render or
Netlify) the API refuses to use temporary memory and answers 503 until
`SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set (override only with
`ALLOW_MEMORY_STORE=true`). Set the variables listed in `.env.example` to connect real
data, payments, email and AI.

## Deploying on Render + Supabase

See **SETUP_GUIDE.md** (plain-language steps), `render.yaml` (Render blueprint),
`supabase/migrations/` (database schema) and `scripts/check-supabase.mjs`
(`npm run check:supabase`, a read-only connection test).
