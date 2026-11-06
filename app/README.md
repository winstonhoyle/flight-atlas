# Flight Atlas app

The map at flightatlas.io: React, TypeScript, and OpenLayers, built with Vite. All data comes from
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

The app loads a month's airports and routes once, then filters routes by airport or airline
in the browser; see [lambda/README.md](../lambda/README.md#request-flow). The API sends each
route as `[src, dst, [airline_codes]]`; `legsOf` in `src/services/api.ts` turns that into one
`[airline, src, dst]` row per airline, and a code's `:s`, `:c` or `:sc` marker becomes an optional
fourth item, the row's service. Requests go through `src/services/api.ts`, which reads `VITE_API_BASE` and falls back to
`https://api.flightatlas.io`. To point the app at a different API, create `.env.local`:

```
VITE_API_BASE=https://your-api-host
```

`.env.local` is gitignored. The endpoints are in the [API reference](../README.md#api).

## Comparing months

"Compare months" in the panel's Advanced section shows the routes that are new or lost between
two snapshot months. It needs no extra endpoint: the app fetches both months' `/routes`,
`/airports` and `/problems` and compares them in the browser.

- A route is an `[airline, src, dst]` row; the service item is ignored, so a route turning
  seasonal isn't a change. A row only in the later month is new; only in the earlier month,
  lost. An airline taking over a route counts as one of each.
- The map and the airport, destination and airline pickers then work on the changed routes
  only. The airline picker always lists the airlines on the routes the map draws.
- A problem in `problems.json` at either end of a changed route may explain the change: the
  earlier month's problems for new routes, the later month's for lost ones. The panel links
  to them once an airport or airline is picked.
- The pure parts are in `src/utils/routeChanges.ts` (`routeChanges`, `changedAirports`,
  `changeProblems`) and `src/utils/months.ts`, so another page or a future API endpoint can
  reuse them without React.

## Drawing the map

`src/components/atlas/mapLayers.ts` builds the three vector layers: airports, routes, and the
hovered routes. Hovering draws the highlight on its own small layer, so it doesn't restyle every
route. Seasonal, charter, and seasonal charter routes are dashed, and the legend and route panel
name them.

Layers draw on canvas by default. "Draw the map with your GPU" under Advanced switches the
airports and routes to OpenLayers' WebGL layers, and the choice is saved in `localStorage`
(`useRenderer`). It only appears where `canWebGL()` finds a WebGL context. Both paths read the
same destination bins and color tokens. The GPU styles are flat-style rules, and OpenLayers
draws each rule in turn, so the airport rules run from the fewest destinations to the most to
keep the busiest airports on top as they are on canvas. OpenLayers' expression language is
small (there's `clamp`, not `min`); `mapLayers.test.ts` compiles every GPU rule to catch
a bad expression.

## Layout

| Path                     | Contents                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `src/components/atlas/`  | The map page: map, airport tooltip, overlay panel, month controls, changed airports, route info, legend, welcome dialog   |
| `src/components/common/` | Domain-free pieces: `Button`, `Checkbox`, `IconButton`, `Combobox`, `SegmentedControl`, `Panel`, `Dialog`, `ExternalLink` |
| `src/icons/`             | Inline SVG icons                                                                                                          |
| `src/hooks/`             | Data hooks (airports and airlines, routes, months), the saved drawing choice, and the URL sync                            |
| `src/services/api.ts`    | API client; checks each response's shape                                                                                  |
| `src/styles/`            | `tokens.css` (every color, size, and space), base styles                                                                  |
| `src/utils/`             | Path parsing, destination bins, great-circle distance and arcs, month ordering, route changes, WebGL detection            |
| `src/types.ts`           | API response types                                                                                                        |
| `scripts/`               | `build-pages.js` and `pages.js`, run after every build                                                                    |

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
distance, great-circle arcs, route filtering, month ordering, route changes between months, and
the checkbox, combobox, segmented control, dialog, link, legend, overlay panel, changed airports,
and route info components, plus the canvas and GPU layer styles, the choice between them, and the
box around a set of routes. The map component itself has no automated tests, and jsdom has no
GPU, so check drawing by eye in both modes.
