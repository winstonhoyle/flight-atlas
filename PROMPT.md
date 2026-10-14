# PROMPT.md: Flight Atlas, road to public

Flight Atlas maps every direct flight route between U.S. airports. The frontend is a React +
TypeScript + Vite app on Cloudflare Pages; the API is API Gateway in front of one Lambda that
queries Athena over Parquet in S3 and caches query IDs in DynamoDB. A monthly ECS task scrapes
the data. See `README.md` for the architecture and `DESIGN.md` for the design system.

This file is the task list for making the project public. Work through section 3 phase by
phase and tick each `- [ ]` box as you finish it, so the next session can see where you
stopped.

---

## 1. Ground rules from the owner

- **Don't commit, push, or open PRs** unless the owner asks in that session. Phase 4 plans the commits; the owner approves them.
- **Don't change live infrastructure without an explicit go**: no `make deploy-containers`, `make tf-apply`, `aws ... put/create/delete`, or Cloudflare changes. Read-only AWS calls (`describe`, `get`, `list`, `terraform plan`) are fine.
- **Don't grant IAM permissions** (new roles, policy attachments) without the owner approving that exact policy.
- Keep the frontend light. Ask before adding a runtime dependency.
- Follow `DESIGN.md`: tokens only, components in `common/` or `atlas/`, icons from `src/icons/`, no emoji in the UI.
- Writing rules in `DESIGN.md` apply to code comments and docs too. A comment says why, not what. No em or en dashes in prose.
- Run `make app-check` before calling frontend work done, and `make py-check` for the Lambda and the scraper.

## 2. Environment (checked 2026-10-13)

| Item | Value |
| --- | --- |
| Host | Windows + WSL2. Repo on `/mnt/c/Users/Winston/Documents/Github/flight-atlas` (slow mount; Vite polls for changes automatically) |
| Branch | `Modernizing-FE-Code`, everything below uncommitted |
| Node | 25 locally; CI uses 22 (Vite 7 needs ≥ 20.19) |
| Python | `.venv/` at the repo root, Python 3.14. `requirements.txt` at the root pins pytest and ruff; `lambda/` and `ecs/` have their own |
| Docker | 29.x, builds `linux/amd64` images |
| AWS | Account `406891295987`, region `us-west-1`. The CLI is signed in as **root** (see Phase 5) |
| Screenshots | No browser tool in this session. Playwright's Chromium is in `~/.cache/ms-playwright`; load `@playwright/test` from `../landmatch-site/frontend/node_modules` with `createRequire` from a script in the scratchpad |
| Run the app | `make app-start`, then http://localhost:3000. It talks to the live API |

### Already done

- Frontend: CRA replaced by Vite + strict TypeScript; zustand, react-router, and turf removed; components split into `common/` and `atlas/` with CSS modules; USWDS tokens in `app/src/styles/tokens.css`; the original map colors kept as tokens; Material SVG icons; `logo.svg` and `logo-mark.svg`; 24 unit and component tests; `DESIGN.md`.
- SEO: `robots.txt`, a sitemap generated before each build, canonical and Open Graph tags, `_headers` with security headers.
- API: stage-wide throttling (50 rps, burst 100), `Cache-Control` on 200s, generic 500 bodies, Lambda at 256 MB / 10 s, count-based ECR lifecycle policy.
- Tooling: `make app-*` and `make py-check`; CI runs lint, format, and tests before deploying.

### Decision log

- **2026-10-13:** The API went down because the old ECR lifecycle policy expired every image after 7 days, including the Lambda's. The policy now keeps the 5 newest `lambda-*` and `ecs-*` images.
- **2026-10-13:** Terraform updates a Lambda's configuration before its image. When the current image is gone from ECR, AWS rejects the configuration change, so the apply deadlocks. The way out is `aws lambda update-function-code --image-uri <new image>` first, then apply again.
- **2026-10-13:** `fetchMonths` now polls past `202` like the other fetches; before, a cold cache left the month picker empty.
- **2026-10-13:** Vite answers "504 Outdated Optimize Dep" after packages change while the dev server runs. Restart `make app-start`.
- **2026-10-13:** React, not React Native. The map is Leaflet in the DOM, and the site is a web page.
- **2026-10-13:** `Combobox` keeps react-select behind one file. It's most of the bundle; replacing it means editing only `common/Combobox.tsx`.
- **2026-10-13:** The logo keeps its red and green, which look alike under protanopia. The UI never uses the brand colors to mean anything.

---

## 3. Phases

### Phase 0: Restore the API (needs the owner's go)

Images `flight-atlas:ecs-ae2eac20` and `flight-atlas:lambda-ae2eac20` are built locally. `terraform plan` showed 2 to add, 4 to change, 2 to destroy, all expected.

- [x] Owner says go
- [x] `make deploy-containers IMAGE_TAG=ae2eac20`
- [x] `make tf-apply IMAGE_TAG=ae2eac20` (failed on the Lambda; see the decision log)
- [x] `aws lambda update-function-code` to `lambda-ae2eac20`; the function is `Active`
- [x] All four endpoints return 200 with `Cache-Control` after a first `202`
- [x] Re-run `make tf-apply IMAGE_TAG=ae2eac20` for the remaining Lambda memory (256 MB) and timeout (10 s)

### Phase 1: Check the app on real data

- [x] Screenshot the app with routes drawn: all airports, ATL selected, ATL to BOS selected, an airline selected
- [x] Map colors: tried viridis and an orange highlight; the owner kept the original red-to-green markers, light blue routes, and navy highlight
- [x] Zooming to an airline or back to an airport's routes fit all three world copies; it now fits the original lines only
- [x] Phone width (390×844): the legend covered the map credits; it now starts collapsed and sits above them
- [x] The open-in-new icon wrapped onto its own line; the last word and icon now share a no-wrap span
- [x] One overlay panel: collapse control in its header, route info inside it, Back and Advanced on one row; zooming leaves room for the panel so a highlighted route is never under it
- [ ] Hover highlighting and Back by hand in a real browser (the scripted run covered select, route, airline, Escape)
- [ ] `npm run sitemap` lists airports and airlines

### Phase 1b: Data snapshots (owner decisions first)

The newest data is February 2026. EventBridge has failed to start the scraper every month since
March 2026: CloudTrail shows `ecs:RunTask` returning `BlockedException: Your account is currently
blocked`. AWS blocks ECS task launches for this account, so no code change fixes it.

Snapshots are stored by year and month, but the API filters by month only, and the app asks for
the current month. From March to September 2026 that month had no data, so the map was empty.
When October 2026 lands, `month=10` will return 2025 and 2026 rows together.

- [ ] Owner: open an AWS Support case to unblock ECS (`RunTask` `BlockedException`), or decide to run the scraper locally each month (`README.md` has the Docker command)
- [ ] Owner: decide whether to refresh the data now with a local run (about 2 hours, writes to S3)
- [ ] API: accept `year` with `month` on `/airports`, `/airlines`, and `/routes`, and default to the newest snapshot instead of the current month (do this inside the Phase 3 split)
- [ ] App: default to the newest entry from `/available_months`, send `year` and `month`, and show the snapshot date in the panel so stale data is visible
- [ ] Tests for both sides

### Phase 2: Selection lives in the URL

The sitemap lists `/ATL`, `/ATL/BOS`, and `/airline/DL`, but the app ignores the path, so every URL renders the same page. Search engines would see hundreds of duplicates.

- [x] Read the path on load and select the airport, route, or airline it names (`hooks/useSelectionUrl.ts`, no router)
- [x] Update the path as the selection changes, and handle Back/Forward with `popstate`
- [x] Unknown codes fall back to the home map and the URL is replaced with `/`
- [x] Set `document.title` and the canonical link per selection
- [x] Tests for parsing and building paths (`utils/selectionPath.test.ts`); deep links and history checked in Chromium
- [x] Remove the "Building and Selecting from URL" TODO in `MapComponent.tsx`
- Paths: `/ATL`, `/ATL/BOS`, `/airline/DL`, `/ATL/airline/DL`. Codes are case-insensitive. A destination drops the airline from the path, since the panel hides the airline picker then.

### Phase 3: Split the Lambda into modules

`lambda/lambda_function.py` is one 320-line file. Split it so each piece can be read, tested, and run alone.

Problems to fix along the way:
- Terraform sets `DATABASE` and `ATHENA_TABLE`; the code reads `ATHENA_DB` and `FLIGHTS_TABLE`. It works only because the defaults match. Pick one set of names and use it in both places.
- The DynamoDB table name `flights-query-cache` is hardcoded. Read it from an env var that Terraform sets.
- SQL is assembled with f-strings. The inputs are regex-checked, but use Athena's `ExecutionParameters` so the query text never contains user input.
- The `httpMethod == "OPTIONS"` check never matches under payload format 2.0, and API Gateway answers CORS preflight itself. Remove it.
- `result_dict` is unbound if a path matches no branch. Unknown paths should return 404.
- The "Delta Connection" rename is a data fix hiding in the handler. Move it to the scraper or a named mapping.

Target layout:

```
lambda/
  flight_atlas_api/
    __init__.py
    handler.py      # lambda_handler: parse the event, dispatch by path, map errors to responses
    config.py       # Settings dataclass read from env vars once
    http.py         # json_response, CORS and Cache-Control headers, error bodies
    params.py       # query-string validation (airport, airline_code, month)
    queries.py      # one function per endpoint returning (sql, parameters)
    athena.py       # start a query, check its state, read the result CSV from S3
    cache.py        # DynamoDB query-ID cache
    geo.py          # WKT parsing, point and line GeoJSON builders
    endpoints.py    # /airports, /airlines, /routes, /available_months
  tests/
    test_params.py
    test_queries.py
    test_geo.py
    test_handler.py # handler with botocore Stubber, no AWS calls
  events/           # sample API Gateway v2 events for local invokes
  pyproject.toml    # ruff + pytest settings
```

- [x] Move code into the modules above; bodies for the same rows match the old handler byte for byte
- [x] Dockerfile copies `flight_atlas_api/`; `CMD ["flight_atlas_api.handler.lambda_handler"]`
- [x] Fix the problems listed above (plus: snapshots come from Glue partitions, a cached result skips Athena)
- [x] Tests for every module; the handler test covers 200, 202, 400, 404, and 500 (38 tests)
- [x] `make py-check` (ruff + pytest for the Lambda and the scraper), `make lambda-run`, `make lambda-invoke EVENT=...`; pytest and ruff pinned in the root `requirements.txt`
- [x] `infra/compute.tf` env vars updated; `terraform plan` shows only that change
- [x] CI job `check-python` runs before images are built
- [x] README sections on the Lambda and the API
- [x] The image ran under the Lambda emulator against live AWS: same ATL routes as the live API for Oct 2025
- [ ] Owner: deploy. Build and push a new image, then `make tf-apply IMAGE_TAG=<tag>`; deploy the Lambda before the app so `year` is understood

### Phase 3b: Scraper tests

Wikipedia markup is the scraper's main risk. Every function that reads HTML now lives in
`ecs/wiki_parse.py` with no network calls, and `create_routes.py` runs through `main()`.

- [x] Fixtures cut from real pages (Parsoid HTML, 2026-10-13): Atlanta, Bethel, Anchorage, Delta, the airport list
- [x] Tests for citation markers, notice boxes, tables without a class, unlinked airlines, redirect links, section links, missing coordinates and codes (45 tests); guards checked by removing them and watching tests fail
- [x] Fixed: a disambiguation link no longer drops an airport's routes; airlines without a code and airports without coordinates are skipped instead of written as empty values, which crashed the final write
- [x] `SCRAPE_LIMIT=2` live run against Wikipedia: ATL 373 routes, DFW 399, no errors
- [ ] App: default to the newest snapshot and send `year` with `month` (Phase 1b), after the Lambda is deployed

### Phase 4: Commit (owner approves)

Suggested commits, in order. Show the owner the file list for each before committing.

- [ ] Infra reorganization, rate limiting, ECR lifecycle fix, Lambda settings
- [ ] Lambda: cache headers, generic errors, then the module split
- [ ] Frontend: Vite + TypeScript migration, dependency cuts, tests, Make targets, CI
- [ ] Design system: tokens, components, icons, logo SVGs, `DESIGN.md`
- [ ] Docs: README, `app/README.md`, `infra/README.md`, this file

### Phase 5: Security

- [ ] **OIDC for GitHub Actions.** A role `github-actions-flight-atlas-deploy-role` trusted only by `repo:winstonhoyle/flight-atlas:ref:refs/heads/main`. The account already has the GitHub OIDC provider (shared with Mapping-WMATA-Fares), so look it up with a `data` source. The owner must approve the policy; CI runs `terraform apply`, so it needs broad access (the wmata role uses `AdministratorAccess`).
- [ ] Switch the workflow to `role-to-assume: ${{ secrets.AWS_DEPLOY_ROLE_ARN }}` with `aws-actions/configure-aws-credentials@v4`. The owner applies locally, adds the secret, then deletes `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` from GitHub and deactivates that key.
- [ ] Tell the owner to replace the root access key on the laptop with an IAM user or SSO login, then delete the root key.
- [ ] Per-IP rate limiting: set `proxied = true` on the Cloudflare `api` record and add a Cloudflare rate-limiting rule. The current limit is shared by every client. Check how Route 53 and Cloudflare split DNS for `flightatlas.io` before touching records.

### Phase 6: Alerts

- [ ] CloudWatch alarms on Lambda errors and API Gateway 5xx, sent to an SNS topic with the owner's email
- [ ] An AWS Budget alert at a monthly limit the owner chooses
- [ ] Document both in `infra/README.md`

### Phase 7: Small cleanup

- [ ] Regenerate `favicon.ico` from `logo-mark.svg`
- [ ] Upgrade ESLint 9 (end of life) to 10, keeping the flat config
- [ ] Remove the "Known Issues" comment block in `MapComponent.tsx` once each item is fixed or filed
