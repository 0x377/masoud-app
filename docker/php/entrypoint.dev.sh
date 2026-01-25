#!/bin/bash
set -e

echo "🚀 Starting Laravel Development Container..."

# Install dependencies if vendor directory doesn't exist
if [ ! -d "vendor" ] && [ -f "composer.json" ]; then
    echo "📦 Installing Composer dependencies..."
    composer install --no-interaction --prefer-dist --optimize-autoloader
fi

# Install npm dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ] && [ -f "package.json" ]; then
    echo "📦 Installing NPM dependencies..."
    npm install --no-audit --progress=false
fi

# Generate application key if not exists
if [ ! -f ".env" ]; then
    echo "📝 Copying .env.example to .env..."
    cp .env.example .env
fi

if grep -q "^APP_KEY=$" .env 2>/dev/null || [ ! -s .env ]; then
    echo "🔑 Generating application key..."
    php artisan key:generate
fi

# Set directory permissions
echo "🔧 Setting directory permissions..."
sudo chown -R laravel:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache

# Clear cache
echo "🧹 Clearing cache..."
php artisan optimize:clear

# Run database migrations if requested
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    echo "🗃️ Running database migrations..."
    php artisan migrate --force
fi

# Run database seeders if requested
if [ "${RUN_SEEDERS:-false}" = "true" ]; then
    echo "🌱 Running database seeders..."
    php artisan db:seed --force
fi

echo "✅ Laravel is ready!"
echo "🔗 App URL: ${APP_URL:-http://localhost}"
echo "🐘 MySQL Host: ${DB_HOST:-mysql}:${DB_PORT:-3306}"
echo "🔴 Redis Host: ${REDIS_HOST:-redis}:${REDIS_PORT:-6379}"
echo "📧 Mailhog: http://localhost:8025"
echo "🗃️ Adminer: http://localhost:8080"
echo "📊 Redis Commander: http://localhost:8081"

# Execute the main command
exec "$@"
