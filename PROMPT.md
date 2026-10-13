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
- Run `make app-check` and `make palette-check` before calling frontend work done, and `make lambda-check` (Phase 3) for Lambda work.

## 2. Environment (checked 2026-10-13)

| Item | Value |
| --- | --- |
| Host | Windows + WSL2. Repo on `/mnt/c/Users/Winston/Documents/Github/flight-atlas` (slow mount; Vite polls for changes automatically) |
| Branch | `Modernizing-FE-Code`, everything below uncommitted |
| Node | 25 locally; CI uses 22 (Vite 7 needs ≥ 20.19) |
| Python | `.venv/` at the repo root, Python 3.14, with `tools/requirements.txt` (colorblind, colorspacious, numpy, opencv-python-headless) |
| Docker | 29.x, builds `linux/amd64` images |
| AWS | Account `406891295987`, region `us-west-1`. The CLI is signed in as **root** (see Phase 5) |
| Screenshots | No browser tool in this session. Playwright's Chromium is in `~/.cache/ms-playwright`; load `@playwright/test` from `../landmatch-site/frontend/node_modules` with `createRequire` from a script in the scratchpad |
| Run the app | `make app-dev`, then http://localhost:3000. It talks to the live API |

### Already done

- Frontend: CRA replaced by Vite + strict TypeScript; zustand, react-router, and turf removed; components split into `common/` and `atlas/` with CSS modules; USWDS tokens in `app/src/styles/tokens.css`; viridis destinations ramp; Material SVG icons; `logo.svg` and `logo-mark.svg`; 24 unit and component tests; `DESIGN.md`.
- SEO: `robots.txt`, a sitemap generated before each build, canonical and Open Graph tags, `_headers` with security headers.
- API: stage-wide throttling (50 rps, burst 100), `Cache-Control` on 200s, generic 500 bodies, Lambda at 256 MB / 10 s, count-based ECR lifecycle policy.
- Tooling: `make app-*` targets, `make palette-check`, CI runs lint, format, and tests before deploying.

### Decision log

- **2026-10-13:** The API went down because the old ECR lifecycle policy expired every image after 7 days, including the Lambda's. The policy now keeps the 5 newest `lambda-*` and `ecs-*` images.
- **2026-10-13:** React, not React Native. The map is Leaflet in the DOM, and the site is a web page.
- **2026-10-13:** `Combobox` keeps react-select behind one file. It's most of the bundle; replacing it means editing only `common/Combobox.tsx`.
- **2026-10-13:** The logo keeps its red and green, which look alike under protanopia. The UI never uses the brand colors to mean anything.

---

## 3. Phases

### Phase 0: Restore the API (needs the owner's go)

Images `flight-atlas:ecs-ae2eac20` and `flight-atlas:lambda-ae2eac20` are built locally. `terraform plan` showed 2 to add, 4 to change, 2 to destroy, all expected.

- [ ] Owner says go
- [ ] `make deploy-containers IMAGE_TAG=ae2eac20`
- [ ] `make tf-plan IMAGE_TAG=ae2eac20`, confirm nothing unexpected, then `make tf-apply IMAGE_TAG=ae2eac20`
- [ ] `aws lambda get-function-configuration --function-name flights-query-lambda --query State` returns `Active`
- [ ] `curl https://api.flightatlas.io/routes?airport=ATL` returns GeoJSON (the first call may return `202`; repeat)

### Phase 1: Check the app on real data

- [ ] Screenshot the app with routes drawn: all airports, ATL selected, ATL to BOS selected, an airline selected
- [ ] Routes are blue, highlights orange, markers follow the viridis ramp and stay visible on land and water
- [ ] Hover, click, Back, Escape on the dialog, and the month picker all behave as on `main`
- [ ] Check a phone-width viewport (390×844): panel, legend, and info button don't overlap
- [ ] `npm run sitemap` lists airports and airlines once the API answers

### Phase 2: Selection lives in the URL

The sitemap lists `/ATL`, `/ATL/BOS`, and `/airline/DL`, but the app ignores the path, so every URL renders the same page. Search engines would see hundreds of duplicates.

- [ ] Read the path on load and select the airport, route, or airline it names (no router dependency; `window.location` and `history.pushState` are enough)
- [ ] Update the path as the selection changes, and handle Back/Forward with `popstate`
- [ ] Unknown codes fall back to the home map without an error
- [ ] Set `document.title` and the canonical link per selection ("ATL direct flights | Flight Atlas")
- [ ] Tests for parsing and building paths
- [ ] Remove the "Building and Selecting from URL" TODO in `MapComponent.tsx`

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

- [ ] Move code into the modules above with no behavior change first; the existing responses must match byte for byte
- [ ] Dockerfile copies `flight_atlas_api/`; `CMD ["flight_atlas_api.handler.lambda_handler"]`
- [ ] Fix the problems listed above, one change at a time
- [ ] Tests for every module; the handler test covers 200, 202, 400, 404, and 500
- [ ] `requirements-dev.in` with pytest, ruff (compiled with pip-compile like `requirements.txt`)
- [ ] Make targets: `lambda-test` (pytest), `lambda-check` (ruff + pytest), `lambda-run` (build the image and run it with the Lambda Runtime Interface Emulator on port 9000), `lambda-invoke EVENT=events/routes_atl.json`
- [ ] Update `infra/compute.tf` env vars, then `terraform plan` (don't apply without the owner)
- [ ] Add a Lambda job to CI that runs `make lambda-check` before building images
- [ ] Update the README sections on the Lambda and the API

### Phase 4: Commit (owner approves)

Suggested commits, in order. Show the owner the file list for each before committing.

- [ ] Infra reorganization, rate limiting, ECR lifecycle fix, Lambda settings
- [ ] Lambda: cache headers, generic errors, then the module split
- [ ] Frontend: Vite + TypeScript migration, dependency cuts, tests, Make targets, CI
- [ ] Design system: tokens, components, icons, logo SVGs, `DESIGN.md`, palette checker
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
