# Flight Atlas Frontend

React, TypeScript, and Leaflet map for exploring U.S. flight routes, built with Vite. It reads
all data from the Flight Atlas API, so there is no local backend to run.

## Prerequisites

- Node.js >= 22
- npm

## Run locally

From the repo root:

```bash
make app-start    # installs dependencies on first run, then starts Vite
```

Or from `app/`: `npm install && npm start`.

Open http://localhost:3000. The dev server fetches live data from the deployed API
(`https://api.flightatlas.io`), so the map loads real routes, airports, and airlines with no
extra setup. Under WSL on a `/mnt/` path, Vite polls for file changes automatically.

## Make targets

| Target             | What it does                                         |
| ------------------ | ---------------------------------------------------- |
| `make app-install` | `npm ci` (re-runs when `package-lock.json` changes)  |
| `make app-start`   | Dev server on port 3000                              |
| `make app-build`   | Sitemap, type-check, and production build to `dist/` |
| `make app-preview` | Build, then serve `dist/` locally                    |
| `make app-check`   | Lint, format check, type-check, and tests            |
| `make app-test`    | Tests only                                           |

If the page shows "504 Outdated Optimize Dep" after packages change, restart `make app-start`.

## Links

The selection lives in the URL, so every view can be shared and reloaded:

| Path              | Shows                                  |
| ----------------- | -------------------------------------- |
| `/ATL`            | Routes from an airport                 |
| `/ATL/BOS`        | One route and the airlines that fly it |
| `/airline/DL`     | An airline's routes                    |
| `/ATL/airline/DL` | An airline's routes from one airport   |

Codes are case-insensitive. An unknown code opens the home map. The page title and canonical
link follow the selection, and Back/Forward step through it.

## Data source

Requests go through `src/services/api.ts`, which reads `VITE_API_BASE` and falls back to
`https://api.flightatlas.io`. To point the app at a different API, create `.env.local`:

```
VITE_API_BASE=https://your-api-host
```

`.env.local` is gitignored. See the [API reference](../README.md#-api) for the endpoints
(`/airports`, `/airlines`, `/routes`, `/available_months`).

## Layout

| Path                     | Contents                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `src/components/atlas/`  | The map page: map, overlay panel, route info, legend, markers, welcome dialog             |
| `src/components/common/` | Domain-free pieces: `Button`, `IconButton`, `Combobox`, `Panel`, `Dialog`, `ExternalLink` |
| `src/icons/`             | Inline SVG icons                                                                          |
| `src/hooks/`             | Data hooks (airports and airlines, routes, months) and the URL sync                       |
| `src/services/api.ts`    | API client, including polling while the API answers `202`                                 |
| `src/styles/`            | `tokens.css` (every color, size, and space), base styles, Leaflet panes                   |
| `src/utils/`             | Path parsing, destination bins, great-circle distance                                     |
| `src/types.ts`           | API response types                                                                        |
| `scripts/`               | `generate-sitemap.js`, run before every build                                             |

Each component is three files side by side: `Name.tsx`, `Name.module.css`, and `Name.test.tsx`
when it has tests. Colors, type, spacing, and component rules are in [DESIGN.md](../DESIGN.md).

## Tests

Vitest with Testing Library in jsdom. Plain functions (API parsing, paths, bins, distance) and
components (combobox, dialog, links, legend, route info) are covered; the Leaflet map itself is
checked by hand or with Playwright screenshots.
