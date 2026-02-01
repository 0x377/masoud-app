FROM php:8.3-fpm

# تثبيت التبعيات
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    libzip-dev \
    libicu-dev \
    libpq-dev \
    librabbitmq-dev \
    libfreetype6-dev \
    libjpeg62-turbo-dev \
    libwebp-dev \
    supervisor \
    cron \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# تثبيت إضافات PHP
RUN docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
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
        opcache

# تثبيت PECL extensions
RUN pecl install \
    redis \
    amqp \
    xdebug \
    && docker-php-ext-enable \
        redis \
        amqp \
        xdebug

# تكوين Xdebug
RUN echo "xdebug.mode=debug" >> /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini \
    && echo "xdebug.client_host=host.docker.internal" >> /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini \
    && echo "xdebug.start_with_request=yes" >> /usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini

# تثبيت Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# إنشاء مستخدم Laravel
RUN useradd -G www-data,root -u 1000 -d /home/laravel laravel \
    && mkdir -p /home/laravel/.composer \
    && chown -R laravel:laravel /home/laravel

# تعيين العمل Directory
WORKDIR /var/www/html

# نسخ ملفات التطبيق
COPY --chown=laravel:laravel . .

# تعيين الصلاحيات
RUN chmod -R 775 storage \
    && chmod -R 775 bootstrap/cache

# Switch to laravel user
USER laravel

EXPOSE 9000
CMD ["php-fpm"]
