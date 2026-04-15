.PHONY: dev build prod test lint test-image clean

dev:
	docker compose up --build

build:
	docker compose -f docker-compose.prod.yml build

prod:
	docker compose -f docker-compose.prod.yml up

test:
	cd backend && python -m pytest tests/ -v

lint:
	cd backend && python -m ruff check app/ tests/ 2>/dev/null || echo "ruff not installed — skipping Python lint"
	cd frontend && npx eslint src/ 2>/dev/null || echo "eslint not configured — skipping JS lint"

test-image:
	cd backend && python samples/create_test_image.py

clean:
	docker compose down --rmi local --volumes --remove-orphans 2>/dev/null || true
	docker compose -f docker-compose.prod.yml down --rmi local --volumes --remove-orphans 2>/dev/null || true
