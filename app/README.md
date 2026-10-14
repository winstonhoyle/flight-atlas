# Flight Atlas app

The map at flightatlas.io: React, TypeScript, and Leaflet, built with Vite. All data comes from
the Flight Atlas API, so a local run needs no backend.

## Prerequisites

- Node.js >= 22
- npm

## Run locally

From the repo root:

```bash
make app-start    # installs dependencies on first run, then starts Vite
```

Or from `app/`: `npm install && npm start`.

The app opens at http://localhost:3000 with live data from `https://api.flightatlas.io`. On a
WSL `/mnt/` path, Vite polls for file changes.

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

The URL holds the selection, so every view can be shared and reloaded:

| Path              | Shows                                  |
| ----------------- | -------------------------------------- |
| `/ATL`            | Routes from an airport                 |
| `/ATL/BOS`        | One route and the airlines that fly it |
| `/airline/DL`     | An airline's routes                    |
| `/ATL/airline/DL` | An airline's routes from one airport   |

Codes are case-insensitive. An unknown code opens the home map. The page title and canonical
link follow the selection, and Back/Forward step through it.

## Data source

The API answers `202` while a query runs, and the client polls until it finishes; see
[lambda/README.md](../lambda/README.md#request-flow). Requests go through `src/services/api.ts`, which reads `VITE_API_BASE` and falls back to
`https://api.flightatlas.io`. To point the app at a different API, create `.env.local`:

```
VITE_API_BASE=https://your-api-host
```

`.env.local` is gitignored. The endpoints are in the [API reference](../README.md#api).

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
| `scripts/`               | `build-pages.js` and `pages.js`, run after every build                                    |

Each component is three files side by side: `Name.tsx`, `Name.module.css`, and `Name.test.tsx`
when it has tests. Colors, type, spacing, and component rules are in [DESIGN.md](../DESIGN.md).

After `vite build`, `scripts/build-pages.js` fetches every airport and airline from the live
API and writes `dist/sitemap.xml` plus one HTML page per airport and airline (`dist/ATL.html`,
`dist/airline/DL.html`, served at `/ATL` and `/airline/DL`). Each is a copy of `dist/index.html` with its own title,
description, canonical link, Open Graph tags, JSON-LD (`Airport` or `Airline`), and a one-line
summary inside `#root`, so search engines and link previews see real content before JavaScript
runs. If the API is down, only the sitemap's home page is written.

## Tests

Vitest with Testing Library in jsdom covers the API client, path parsing, destination bins,
distance, and the combobox, dialog, link, legend, and route info components. The Leaflet map has
no automated tests.
