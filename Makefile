.PHONY: help dev up down logs build clean test lint format install

# Default target
help:
	@echo "LabelHub Development Commands"
	@echo ""
	@echo "Development:"
	@echo "  make install    - Install dependencies for both frontend and backend"
	@echo "  make dev        - Start development environment (backend + postgres)"
	@echo "  make up         - Start all services with docker-compose"
	@echo "  make down       - Stop all services"
	@echo "  make logs       - Show logs from all services"
	@echo ""
	@echo "Build & Deploy:"
	@echo "  make build      - Build docker images"
	@echo "  make clean      - Remove all containers and volumes"
	@echo ""
	@echo "Quality:"
	@echo "  make lint       - Run linters for frontend and backend"
	@echo "  make format     - Format code for frontend and backend"
	@echo "  make test       - Run tests for backend"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate - Run database migrations"
	@echo "  make db-reset   - Reset database (WARNING: destroys data)"

# =============================================================================
# Development
# =============================================================================

install:
	@echo "📦 Installing backend dependencies..."
	cd backend && python -m pip install -r requirements.txt
	@echo "📦 Installing frontend dependencies..."
	cd frontend && npm install
	@echo "✅ Dependencies installed!"

dev:
	@echo "🚀 Starting development environment..."
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres backend
	@echo ""
	@echo "✅ Backend running at http://localhost:8000"
	@echo "📖 API docs at http://localhost:8000/docs"
	@echo ""
	@echo "To start frontend development server:"
	@echo "  cd frontend && npm run dev"
	@echo ""
	@echo "To view logs:"
	@echo "  make logs"

up:
	@echo "🚀 Starting all services..."
	docker-compose up -d
	@echo ""
	@echo "✅ LabelHub running at http://localhost"
	@echo "📖 API docs at http://localhost:8000/docs"

down:
	@echo "🛑 Stopping all services..."
	docker-compose down

logs:
	docker-compose logs -f

# =============================================================================
# Build & Deploy
# =============================================================================

build:
	@echo "🔨 Building docker images..."
	docker-compose build

clean:
	@echo "🧹 Cleaning up..."
	docker-compose down -v --remove-orphans
	@echo "✅ Cleaned up containers and volumes"

# =============================================================================
# Quality
# =============================================================================

lint: lint-backend lint-frontend

lint-backend:
	@echo "🔍 Linting backend..."
	cd backend && python -m ruff check .

lint-frontend:
	@echo "🔍 Linting frontend..."
	cd frontend && npm run lint

format: format-backend format-frontend

format-backend:
	@echo "✨ Formatting backend..."
	cd backend && python -m ruff format .
	cd backend && python -m ruff check --fix .

format-frontend:
	@echo "✨ Formatting frontend..."
	cd frontend && npm run format

test: test-backend

test-backend:
	@echo "🧪 Running backend tests..."
	cd backend && python -m pytest -v

# =============================================================================
# Database
# =============================================================================

db-migrate:
	@echo "🗃️ Running database migrations..."
	cd backend && alembic upgrade head

db-reset:
	@echo "⚠️  Resetting database..."
	docker-compose down -v postgres
	docker-compose up -d postgres
	@sleep 3
	cd backend && alembic upgrade head
	@echo "✅ Database reset complete"

