# Design system

Flight Atlas is one map with a few floating controls. It follows the
[U.S. Web Design System](https://designsystem.digital.gov/) (USWDS) at a high level: its type
pair, system colors, spacing grid, and button styles. It doesn't use the USWDS package itself,
which would outweigh the rest of the app.

The look is plain and public-service. The routes are the content, and the controls stay out
of their way.

## The one rule

**No colors, font sizes, or spacing values outside `app/src/styles/tokens.css`.** Components
read tokens through `var(--fa-…)` in their CSS modules. Map code, which paints through Leaflet
where `var()` doesn't work, reads them with `tokenValue()` from `app/src/styles/tokens.ts`.
Check before review:

```sh
grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(' app/src --include=*.ts --include=*.tsx --include=*.css | grep -v styles/tokens.css
```

The command should print nothing.

## Files

Each component is three flat files in its feature folder: `Name.tsx`, `Name.module.css`, and
`Name.test.tsx` when it has tests. There are no per-component subfolders or shared stylesheets.

| Folder | What lives there |
| --- | --- |
| `app/src/components/common/` | Domain-free building blocks: `Button`, `IconButton`, `Combobox`, `Panel`, `Dialog`, `ExternalLink` |
| `app/src/components/atlas/` | The map page: `MapComponent`, `OverlayPanel`, `RouteInfoPanel`, `Legend`, `AirportMarker`, `WelcomeDialog` |
| `app/src/icons/` | Inline SVG icons |
| `app/src/styles/` | `tokens.css` (every value), `tokens.ts` (reads them from JS), `index.css` (base styles, Leaflet panes) |

A piece with no knowledge of airports or routes goes in `common/`. When two components start
to share a layout, move it into `common/` instead of copying it.

## Tokens

Tokens come in two layers. The palette holds USWDS system colors under their USWDS names
(`--uswds-blue-60v`). The roles (`--fa-color-primary`, `--fa-map-route`) name the job a color
does, and components read only roles, so changing what a role looks like is one line.

### Color

| Role | Value | Used for |
| --- | --- | --- |
| `--fa-color-text` | gray-90 `#1b1b1b` | Body text |
| `--fa-color-text-muted` | gray-cool-60 `#565c65` | Hints, labels, icon buttons |
| `--fa-color-surface` | white | Panels, dialogs |
| `--fa-color-surface-muted` | gray-5 `#f0f0f0` | API request box, hover |
| `--fa-color-border` | gray-cool-10 `#dfe1e2` | Panel edges |
| `--fa-color-primary` | blue-60v `#005ea2` | Buttons, links, selected options |
| `--fa-color-primary-hover` | blue-warm-70v `#1a4480` | Button hover |
| `--fa-color-primary-tint` | blue-5 `#eff6fb` | Focused option, outline button hover |
| `--fa-color-focus` | blue-40v `#2491ff` | The focus ring |
| `--fa-color-error` | red-60v `#b50909` | Error messages |

### Map colors

| Role | Value | Used for |
| --- | --- | --- |
| `--fa-map-route` | blue-60v `#005ea2` | Every drawn route |
| `--fa-map-route-highlight` | orange-60v `#8c471c` | Hovered airport's routes, the selected route |
| `--fa-map-marker-stroke` | gray-90 `#1b1b1b` | Airport marker outline |
| `--fa-map-destinations-1` to `-5` | viridis, `#fde725` to `#440154` | Airport marker fill by destination count |

Routes and highlights are blue and orange, a pair that stays apart for every type of color
blindness. No two map colors are red and green, the pair most color-blind people can't
separate.

The destinations ramp is [viridis](https://cran.r-project.org/web/packages/viridis/vignettes/intro-to-viridis.html),
ordered from light (1 to 10 destinations) to dark (over 100). Each step is darker than the
last in normal vision and under every simulated color blindness, so a reader who sees no hue
at all can still read the order. Marker size also grows with the count. The fill shows the
count, and the dark outline separates the marker from the basemap, which the light end of the
ramp can't do on its own.

### Typography

The USWDS pair, self-hosted as variable fonts in `app/src/assets/fonts/` (SIL OFL 1.1, license
alongside). Public Sans is used for everything except the API request URL, which is set in
Roboto Mono.

| Token | Size | Used for |
| --- | --- | --- |
| `--fa-font-size-3xs` | 13px | Legend rows, tooltips, hints (the floor) |
| `--fa-font-size-2xs` | 14px | Controls, panel text |
| `--fa-font-size-xs` | 15px | Spare step |
| `--fa-font-size-sm` | 16px | Body, panel title |
| `--fa-font-size-lg` | 22px | Dialog and route info headings |

Sizes are the USWDS theme scale. Weights are `regular` 400, `semibold` 600, and `bold` 700.
Counts use `font-variant-numeric: tabular-nums` so columns line up.

### Spacing, shape, and layers

- Spacing is the USWDS unit grid: `--fa-space-05` 4px, `-1` 8px, `-105` 12px, `-2` 16px, `-3` 24px.
- Radius is `--fa-radius-sm` 2px, `-md` 4px (controls), `-lg` 8px (panels, dialogs), `-pill`.
- Elevation is the USWDS shadow scale: `--fa-shadow-1` tooltips, `-2` panels and floating buttons, `-3` dialogs.
- Controls sit above Leaflet's panes: `--fa-z-panel` 1000, `-floating` 1100, `-route-info` 1500, `-dialog` 2000, `-menu` 3000.
- Touch targets are at least `--fa-target-min` (44px), except the compact icon buttons inside panels.

## Icons

Material icons (Apache-2.0), the set USWDS draws from, as inline SVG in `app/src/icons/`. There's
no icon library dependency. To add one, copy the 24×24 path into `PATHS` in `icons/index.tsx`
and export a component for it. Icons draw in `currentColor` and are hidden from screen readers;
the button or link around them carries the label.

The UI doesn't use emoji or text arrows (`☰`, `✖`, `←`, `⚙️`).

## Logo

| File | Use |
| --- | --- |
| `app/public/logo.svg` | Mark and wordmark: welcome dialog |
| `app/public/logo-mark.svg` | Mark only: favicon, small spaces |
| `app/public/logo.png`, `logo192.png`, `logo512.png` | Raster copies for the web manifest and link previews |

The SVGs are redrawn from `logo.png`: a green globe behind a silver compass star, with a red,
white, and green swoosh ending at a plane. The brand colors are measured from the PNG and kept
in the palette as `--brand-*`. They belong to the logo only; the UI uses the USWDS roles.

The logo's green "Flight" and red "Atlas" measure ΔE 4.7 under protanopia, so to some
color-blind readers the two words look like one color. Nothing depends on telling them apart,
so the logo keeps its colors. Don't reuse the brand red and green to mean two different things.

## Accessibility

- Text clears WCAG AA 4.5:1 on its background; the focus ring and map graphics clear 3:1, map graphics against both the basemap's land (`#efefef`) and water (`#d0cfd4`).
- Colors that carry meaning stay at least ΔE 15 apart (CAM02-UCS) under simulated protanopia, deuteranopia, and tritanopia.
- Color is never the only signal. Marker size follows the count, and the highlight is thicker as well as orange.
- Focus is always visible: `index.css` draws one ring for every element, and components don't remove it.
- Icon-only buttons have a label (`IconButton` requires one). Links that open a new tab say so to screen readers.
- Motion is short and turns off under `prefers-reduced-motion`.

`make palette-check` measures all of the color rules above from `tokens.css`. It simulates color
blindness with two models, `colorspacious` (Machado 2009) and the `colorblind` package (LMS
daltonization), and counts the worse one. Run it after changing a color; it exits 1 on a
failure.

## Writing

UI text, comments, and docs follow the same rules, taken from Wikipedia's
[Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing).

- Sentence case everywhere, including buttons: "Hide panel", "Search for an airport".
- Say what happened and what to do next. Leave out HTTP codes.
- Plain verbs: "is", "has", "returns". Avoid "leverages", "ensures", "serves as".
- A comment explains why, not what. If the code already says it, delete the comment.
- No closing line that restates the paragraph, no lists of three added for rhythm.

## Checks

| Command | What it checks |
| --- | --- |
| `make app-check` | ESLint, Prettier, TypeScript, and unit and component tests |
| `make palette-check` | Contrast, color-blind separation, ramp order |
