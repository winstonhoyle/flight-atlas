AWS_REGION ?= us-west-1
IMAGE_TAG  ?= local

# Lazy (=) so targets that don't push to ECR never call AWS.
AWS_ACCOUNT_ID  = $(shell aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY    = $(AWS_ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com
ECR_REPO       := flight-atlas
ECS_IMAGE      := $(ECR_REPO):ecs-$(IMAGE_TAG)
LAMBDA_IMAGE   := $(ECR_REPO):lambda-$(IMAGE_TAG)

BUILD_FLAGS := --provenance=false --platform linux/amd64

.PHONY: app-install app-start app-build app-preview app-check app-test \
	py-check lambda-run lambda-invoke \
	containers deploy-containers scrape scrape-check scrape-dry-run tf-init tf-plan tf-apply

app/node_modules: app/package-lock.json
	cd app && npm ci
	@touch $@

app-install: app/node_modules

app-start: app/node_modules
	cd app && npm start

app-build: app/node_modules
	cd app && npm run build

app-preview: app-build
	cd app && npm run preview

app-check: app/node_modules
	cd app && npm run lint && npm run format:check && npx tsc -b && npm run test:run

app-test: app/node_modules
	cd app && npm run test:run

.venv/.deps: requirements.txt lambda/requirements.txt ecs/requirements.txt
	test -d .venv || python3 -m venv .venv
	.venv/bin/pip install -q -r requirements.txt -r lambda/requirements.txt -r ecs/requirements.txt
	@touch $@

py-check: .venv/.deps
	.venv/bin/ruff check lambda ecs && .venv/bin/ruff format --check lambda ecs
	cd lambda && $(CURDIR)/.venv/bin/python -m pytest -q
	cd ecs && $(CURDIR)/.venv/bin/python -m pytest -q

lambda-run:
	docker build $(BUILD_FLAGS) -t $(LAMBDA_IMAGE) lambda
	docker run --rm -p 9000:8080 \
		-v "$(HOME)/.aws:/root/.aws:ro" \
		-e AWS_PROFILE=$${AWS_PROFILE:-default} -e AWS_REGION=$(AWS_REGION) \
		$(LAMBDA_IMAGE)

EVENT ?= lambda/events/routes.json
lambda-invoke:
	@curl -s http://localhost:9000/2015-03-31/functions/function/invocations -d @$(EVENT) | python3 -m json.tool | head -40

containers:
	docker build $(BUILD_FLAGS) -t $(ECS_IMAGE) ecs
	docker build $(BUILD_FLAGS) -t $(LAMBDA_IMAGE) lambda

deploy-containers:
	aws ecr get-login-password --region $(AWS_REGION) | docker login --username AWS --password-stdin $(ECR_REGISTRY)
	docker tag $(ECS_IMAGE) $(ECR_REGISTRY)/$(ECS_IMAGE)
	docker tag $(LAMBDA_IMAGE) $(ECR_REGISTRY)/$(LAMBDA_IMAGE)
	docker push $(ECR_REGISTRY)/$(ECS_IMAGE)
	docker push $(ECR_REGISTRY)/$(LAMBDA_IMAGE)

AIRPORTS ?=
COUNTRIES ?=
scrape: .venv/.deps
	cd ecs && AIRPORTS=$(AIRPORTS) COUNTRIES=$(COUNTRIES) $(CURDIR)/.venv/bin/python create_routes.py

scrape-check: .venv/.deps
	cd ecs && AIRPORTS=$(AIRPORTS) COUNTRIES=$(COUNTRIES) $(CURDIR)/.venv/bin/python create_routes.py --check

LIMIT ?= 0
scrape-dry-run: .venv/.deps
	cd ecs && OUTPUT_BASE=./output SCRAPE_LIMIT=$(LIMIT) AIRPORTS=$(AIRPORTS) COUNTRIES=$(COUNTRIES) $(CURDIR)/.venv/bin/python create_routes.py

tf-init:
	cd infra && terraform init

tf-plan:
	cd infra && terraform plan -var image_tag=$(IMAGE_TAG)

tf-apply:
	cd infra && terraform apply -var image_tag=$(IMAGE_TAG)
