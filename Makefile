AWS_REGION ?= us-west-1
IMAGE_TAG  ?= local

# Lazy (=) so targets that don't push to ECR never call AWS.
AWS_ACCOUNT_ID  = $(shell aws sts get-caller-identity --query Account --output text)
ECR_REGISTRY    = $(AWS_ACCOUNT_ID).dkr.ecr.$(AWS_REGION).amazonaws.com
ECR_REPO       := flight-atlas
ECS_IMAGE      := $(ECR_REPO):ecs-$(IMAGE_TAG)
LAMBDA_IMAGE   := $(ECR_REPO):lambda-$(IMAGE_TAG)

BUILD_FLAGS := --provenance=false --platform linux/amd64

.PHONY: app-install app-dev app-build app-preview app-check app-test palette-check \
	containers deploy-containers scrape-dry-run tf-init tf-plan tf-apply

app/node_modules: app/package-lock.json
	cd app && npm ci
	@touch $@

app-install: app/node_modules

app-dev: app/node_modules
	cd app && npm run dev

app-build: app/node_modules
	cd app && npm run build

app-preview: app-build
	cd app && npm run preview

app-check: app/node_modules
	cd app && npm run lint && npm run format:check && npx tsc -b && npm run test:run

app-test: app/node_modules
	cd app && npm run test:run

.venv/.palette-deps: tools/requirements.txt
	test -d .venv || python3 -m venv .venv
	.venv/bin/pip install -q -r tools/requirements.txt
	@touch $@

palette-check: .venv/.palette-deps
	.venv/bin/python tools/palette_check.py

containers:
	docker build $(BUILD_FLAGS) -t $(ECS_IMAGE) ecs
	docker build $(BUILD_FLAGS) -t $(LAMBDA_IMAGE) lambda

deploy-containers:
	aws ecr get-login-password --region $(AWS_REGION) | docker login --username AWS --password-stdin $(ECR_REGISTRY)
	docker tag $(ECS_IMAGE) $(ECR_REGISTRY)/$(ECS_IMAGE)
	docker tag $(LAMBDA_IMAGE) $(ECR_REGISTRY)/$(LAMBDA_IMAGE)
	docker push $(ECR_REGISTRY)/$(ECS_IMAGE)
	docker push $(ECR_REGISTRY)/$(LAMBDA_IMAGE)

scrape-dry-run:
	docker run --rm \
		-e OUTPUT_BASE=/data -e RUN_ATHENA=false \
		-v "$(CURDIR)/ecs/output:/data" \
		$(ECS_IMAGE)

tf-init:
	cd infra && terraform init

tf-plan:
	cd infra && terraform plan -var image_tag=$(IMAGE_TAG)

tf-apply:
	cd infra && terraform apply -var image_tag=$(IMAGE_TAG)
