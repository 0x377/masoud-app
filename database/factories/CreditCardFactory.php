<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class CreditCardFactory extends Factory
{
    public function definition(): array
    {
        $person = \App\Models\Person::inRandomOrder()->first() ?? 
                 \App\Models\Person::factory()->create();
        
        $cardTypes = ['VISA', 'MASTERCARD', 'AMEX', 'MADA'];
        $cardType = $this->faker->randomElement($cardTypes);
        
        $cardNumber = $this->generateCardNumber($cardType);
        $expiryMonth = str_pad($this->faker->numberBetween(1, 12), 2, '0', STR_PAD_LEFT);
        $expiryYear = $this->faker->numberBetween(date('Y') + 1, date('Y') + 5);
        
        return [
            'id' => Str::uuid(),
            'person_id' => $person->id,
            'card_holder_name' => $person->full_name_english ?? $this->faker->name(),
            'card_number' => encrypt($cardNumber), // Always encrypt sensitive data
            'card_type' => $cardType,
            'expiry_month' => $expiryMonth,
            'expiry_year' => $expiryYear,
            'cvv_hash' => hash('sha256', $this->faker->numerify('###')),
            'last_four' => substr($cardNumber, -4),
            'billing_address' => [
                'street' => $this->faker->streetAddress(),
                'city' => $this->faker->city(),
                'state' => $this->faker->state(),
                'postal_code' => $this->faker->postcode(),
                'country' => 'SA',
            ],
            'bank_name' => $this->faker->randomElement(['الراجحي', 'الأهلي', 'ساب', 'الإنماء', 'البلد']),
            'bank_country' => 'SA',
            'issuer' => $this->faker->company(),
            'status' => 'ACTIVE',
            'is_default' => $this->faker->boolean(30),
            'is_verified' => $this->faker->boolean(80),
            'verified_at' => $this->faker->optional()->dateTime(),
            'verified_by' => $this->faker->optional()->uuid(),
            'failed_attempts' => 0,
            'token' => 'TOKEN-' . Str::upper(Str::random(16)),
            'gateway_customer_id' => 'CUST-' . Str::upper(Str::random(10)),
            'gateway_card_id' => 'CARD-' . Str::upper(Str::random(10)),
            'daily_limit' => $this->faker->optional()->randomFloat(2, 1000, 10000),
            'transaction_limit' => $this->faker->optional()->randomFloat(2, 100, 5000),
            'monthly_limit' => $this->faker->optional()->randomFloat(2, 5000, 50000),
            'transaction_count' => $this->faker->numberBetween(0, 100),
            'total_spent' => $this->faker->randomFloat(2, 0, 50000),
            'last_used_at' => $this->faker->optional()->dateTimeBetween('-1 month', 'now'),
            'three_d_secure_enabled' => true,
            'allow_recurring' => $this->faker->boolean(40),
            'recurring_settings' => $this->faker->optional()->passthrough([
                'frequency' => $this->faker->randomElement(['monthly', 'quarterly', 'yearly']),
                'max_amount' => $this->faker->randomFloat(2, 100, 1000),
            ]),
            'security_rules' => [
                'allowed_countries' => ['SA'],
                'blocked_categories' => ['gambling', 'adult'],
                'max_transaction_amount' => 10000,
            ],
            'allowed_merchants' => ['donation_platform', 'family_services'],
            'blocked_categories' => ['gambling', 'adult'],
            'risk_score_data' => [
                'score' => $this->faker->numberBetween(1, 100),
                'factors' => $this->faker->words(3),
                'last_assessment' => now()->toDateTimeString(),
            ],
            'created_by' => $this->faker->optional()->uuid(),
            'updated_by' => $this->faker->optional()->uuid(),
        ];
    }
    
    private function generateCardNumber(string $type): string
    {
        return match($type) {
            'VISA' => '4' . $this->faker->numerify('###############'),
            'MASTERCARD' => '5' . $this->faker->numerify('###############'),
            'AMEX' => '3' . $this->faker->numerify('#############'),
            'MADA' => '5' . $this->faker->numerify('###############'),
            default => $this->faker->creditCardNumber(),
        };
    }
    
    public function visa(): static
    {
        return $this->state(fn (array $attributes) => [
            'card_type' => 'VISA',
        ]);
    }
    
    public function mastercard(): static
    {
        return $this->state(fn (array $attributes) => [
            'card_type' => 'MASTERCARD',
        ]);
    }
    
    public function mada(): static
    {
        return $this->state(fn (array $attributes) => [
            'card_type' => 'MADA',
        ]);
    }
    
    public function default(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_default' => true,
        ]);
    }
    
    public function expired(): static
    {
        return $this->state(fn (array $attributes) => [
            'expiry_year' => date('Y') - 1,
            'status' => 'EXPIRED',
        ]);
    }
    
    public function verified(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_verified' => true,
            'verified_at' => now(),
            'verified_by' => Str::uuid(),
        ]);
    }
    
    public function withHighLimits(): static
    {
        return $this->state(fn (array $attributes) => [
            'daily_limit' => 50000,
            'transaction_limit' => 20000,
            'monthly_limit' => 200000,
        ]);
    }
}
