.PHONY: help build up down restart logs ps login

help:
	@echo "Available commands:"
	@echo "  make build      - Build all containers"
	@echo "  make up         - Start all containers"
	@echo "  make down       - Stop and remove all containers"
	@echo "  make restart    - Restart all containers"
	@echo "  make logs       - Show logs from all containers"
	@echo "  make ps         - Show running containers"
	@echo "  make login-app  - Login to app container"
	@echo "  make fresh      - Fresh install (composer install, npm install, migrations)"
	@echo "  make test       - Run tests"
	@echo "  make deploy     - Deploy to production"

# Development
build:
	docker-compose build --no-cache --pull

up:
	docker-compose up -d

down:
	docker-compose down -v

restart:
	docker-compose restart

logs:
	docker-compose logs -f

ps:
	docker-compose ps

login-app:
	docker-compose exec app bash

login-mysql:
	docker-compose exec mysql mysql -u root -p${DB_PASSWORD}

# Development Commands
fresh:
	docker-compose exec app composer install
	docker-compose exec app npm install
	docker-compose exec app php artisan migrate:fresh --seed
	docker-compose exec app php artisan storage:link
	docker-compose exec app php artisan optimize:clear

test:
	docker-compose exec app php artisan test

# Production
deploy:
	@echo "Building production image..."
	docker build -t your-registry/laravel-app:latest .
	@echo "Pushing to registry..."
	docker push your-registry/laravel-app:latest
	@echo "Deploying to production..."
	docker stack deploy -c docker-compose.prod.yml laravel
