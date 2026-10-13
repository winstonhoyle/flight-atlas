# Flight Atlas Frontend

React, TypeScript, and Leaflet map for exploring U.S. flight routes, built with Vite. It reads
all data from the Flight Atlas API, so there is no local backend to run.

## Prerequisites

- Node.js >= 22
- npm

## Run locally

From the repo root:

```bash
make app-dev      # installs dependencies on first run, then starts Vite
```

Or from `app/`: `npm install && npm run dev`.

Open http://localhost:3000. The dev server fetches live data from the deployed API
(`https://api.flightatlas.io`), so the map loads real routes, airports, and airlines with no
extra setup. Under WSL on a `/mnt/` path, Vite polls for file changes automatically.

## Make targets

| Target             | What it does                                         |
| ------------------ | ---------------------------------------------------- |
| `make app-install` | `npm ci` (re-runs when `package-lock.json` changes)  |
| `make app-dev`     | Dev server on port 3000                              |
| `make app-build`   | Sitemap, type-check, and production build to `dist/` |
| `make app-preview` | Build, then serve `dist/` locally                    |
| `make app-check`   | Lint, format check, type-check, and unit tests       |
| `make app-test`    | Unit tests only                                      |

## Data source

Requests go through `src/services/api.ts`, which reads `VITE_API_BASE` and falls back to
`https://api.flightatlas.io`. To point the app at a different API, create `.env.local`:

```
VITE_API_BASE=https://your-api-host
```

`.env.local` is gitignored. See the [API reference](../README.md#-api) for the endpoints
(`/airports`, `/airlines`, `/routes`, `/available_months`).

## Layout

| Path              | Contents                                               |
| ----------------- | ------------------------------------------------------ |
| `src/components/` | Map, overlay panel, route info, legend, welcome dialog |
| `src/hooks/`      | Data hooks: airports/airlines, routes, months          |
| `src/services/`   | API client                                             |
| `src/types.ts`    | API response types                                     |
| `scripts/`        | `generate-sitemap.js`, run before every build          |
