# Stage 1: Builder - لتثبيت التبعيات وتجميع الأصول
FROM composer:2.6 AS builder

WORKDIR /app

# نسخ ملفات composer
COPY composer.json composer.lock ./
COPY database/ database/

# تثبيت التبعيات مع optimization
RUN composer install \
    --ignore-platform-reqs \
    --no-interaction \
    --no-plugins \
    --no-scripts \
    --prefer-dist \
    --optimize-autoloader \
    --no-dev

# نسخ باقي الملفات
COPY . .

# توليد الأصول (إذا كان لديك Laravel Mix/Vite)
RUN if [ -f package.json ]; then \
    npm ci --no-audit --progress=false && \
    npm run build; \
    fi

# تنظيف الملفات غير الضرورية
RUN rm -rf node_modules \
    && rm -rf tests \
    && rm -rf .github \
    && rm -rf storage/logs/* \
    && rm -rf storage/framework/cache/* \
    && rm -rf storage/framework/sessions/* \
    && rm -rf storage/framework/views/*

# Stage 2: Production - صورة أخف وأكثر أماناً
FROM php:8.3-fpm-alpine AS production

# تثبيت system dependencies
RUN apk add --no-cache \
    nginx \
    supervisor \
    curl \
    libzip-dev \
    zip \
    unzip \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    oniguruma-dev \
    libxml2-dev \
    icu-dev \
    postgresql-dev \
    rabbitmq-c-dev \
    bash \
    git \
    && apk add --no-cache --virtual .build-deps $PHPIZE_DEPS \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install \
        pdo_mysql \
        pdo_pgsql \
        bcmath \
        exif \
        gd \
        intl \
        mbstring \
        pcntl \
        zip \
        sockets \
        opcache \
    && pecl install \
        redis \
        amqp \
        xdebug \
    && docker-php-ext-enable \
        redis \
        amqp \
    && apk del .build-deps \
    && rm -rf /tmp/*

# تكوين PHP-FPM
RUN mv "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"
COPY docker/php/php.ini $PHP_INI_DIR/conf.d/
COPY docker/php/opcache.ini $PHP_INI_DIR/conf.d/

# تكوين nginx
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf

# تكوين supervisor
RUN mkdir -p /etc/supervisor.d
COPY docker/supervisor/supervisord.conf /etc/supervisord.conf
COPY docker/supervisor/conf.d/* /etc/supervisor.d/

# إنشاء مستخدم Laravel بدون صلاحيات root
RUN addgroup -g 1000 -S laravel && \
    adduser -u 1000 -S laravel -G laravel -h /home/laravel -s /bin/bash

# إنشاء الدلائل الضرورية
RUN mkdir -p /var/www/html \
    && mkdir -p /var/log/supervisor \
    && mkdir -p /var/run/php \
    && chown -R laravel:laravel /var/www/html \
    && chown -R laravel:laravel /var/log \
    && chown -R laravel:laravel /var/run

# نسخ التطبيق من مرحلة البناء
COPY --from=builder --chown=laravel:laravel /app /var/www/html

# تعيين الصلاحيات
RUN chmod -R 755 /var/www/html/storage \
    && chmod -R 755 /var/www/html/bootstrap/cache

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Expose port
EXPOSE 8080

# تشغيل supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisord.conf"]

# Labels للميتاداتا
LABEL maintainer="your-email@example.com"
LABEL version="1.0"
LABEL description="Laravel Application"
