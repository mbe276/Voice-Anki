.PHONY: dev dev-backend dev-client lint test bench

DEV_BACKEND?=backend
DEV_CLIENT?=client

## Start backend and client in development mode
dev:
$(MAKE) -j2 dev-backend dev-client

## Run only the FastAPI backend with autoreload
dev-backend:
cd $(DEV_BACKEND) && uvicorn app.main:app --reload

## Run only the Vite client dev server
dev-client:
cd $(DEV_CLIENT) && npm run dev

## Placeholder lint target
lint:
@echo "TODO: add linting commands"

## Placeholder test target
test:
	cd $(DEV_BACKEND) && pytest

## Placeholder benchmark target
bench:
@echo "TODO: add latency benchmark"
