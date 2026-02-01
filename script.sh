#!/bin/bash

echo "🔧 Fixing Person factory and model..."

# 1. Dump autoload
composer dump-autoload

# 2. Clear all cache
php artisan optimize:clear

# 3. Check if Person model exists
if [ ! -f "app/Models/Person.php" ]; then
    echo "📝 Creating Person model..."
    php artisan make:model Person -mfs
fi

# 4. Fix PersonFactory if needed
FACTORY_FILE="database/factories/PersonFactory.php"
if [ -f "$FACTORY_FILE" ]; then
    echo "🔨 Fixing PersonFactory..."
    
    # Check if factory has correct model reference
    if ! grep -q "protected \$model = Person::class" "$FACTORY_FILE"; then
        # Add model reference after namespace
        sed -i '/namespace Database\\Factories;/a\ \nuse App\\Models\\Person;' "$FACTORY_FILE"
        sed -i '/class PersonFactory extends Factory/a\ \n    /**\n     * The name of the factory\'s corresponding model.\n     *\n     * @var string\n     */\n    protected \$model = Person::class;' "$FACTORY_FILE"
    fi
fi

# 5. Clear cache again
php artisan config:clear
php artisan cache:clear

echo "✅ Fix complete! Try running seeder again."
