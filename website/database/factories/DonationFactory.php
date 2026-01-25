<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;
use \App\Models\User;

class DonationFactory extends Factory
{
    public function definition(): array
    {
        $user = User::inRandomOrder()->first() ?? 
               User::factory()->create();

        $statuses = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];
        $paymentMethods = ['CREDIT_CARD', 'BANK_TRANSFER', 'CASH', 'CHECK', 'MOBILE_PAYMENT'];

        return [
            'id' => Str::uuid(),
            'donor_user_id' => $user->id,
            'amount' => $this->faker->randomFloat(2, 10, 10000),
            'currency' => 'SAR',
            'status' => $this->faker->randomElement($statuses),
            'payment_method' => $this->faker->randomElement($paymentMethods),
            'transaction_id' => 'TXN-' . Str::upper(Str::random(10)),
            'receipt_url' => $this->faker->optional()->url(),
            'donor_name' => $this->faker->name(),
            'donor_email' => $user->email,
            'donor_phone' => $user->phone_number,
            'donor_national_id' => $this->faker->optional()->numerify('1#########'),
            'is_anonymous' => $this->faker->boolean(20),
            'dedication_name' => $this->faker->optional()->name(),
            'dedication_type' => $this->faker->optional()->randomElement(['IN_MEMORY', 'IN_HONOR', 'THANKSGIVING']),
            'campaign_id' => $this->faker->optional()->uuid(),
            'campaign_name' => $this->faker->optional()->words(3, true),
            'payment_gateway' => $this->faker->randomElement(['MYFATOORAH', 'TAP', 'PAYPAL', 'STRIPE']),
            'gateway_transaction_id' => 'GATE-' . Str::upper(Str::random(8)),
            'gateway_response' => $this->faker->optional()->text(),
            'bank_reference' => $this->faker->optional()->bothify('REF-#####'),
            'check_number' => $this->faker->optional()->bothify('CHK-#####'),
            'check_date' => $this->faker->optional()->date(),
            'check_bank' => $this->faker->optional()->company(),
            'approved_by' => $this->faker->optional()->uuid(),
            'approved_at' => $this->faker->optional()->dateTime(),
            'rejected_by' => $this->faker->optional()->uuid(),
            'rejected_at' => $this->faker->optional()->dateTime(),
            'rejection_reason' => $this->faker->optional()->sentence(),
            'refunded_by' => $this->faker->optional()->uuid(),
            'refunded_at' => $this->faker->optional()->dateTime(),
            'refund_reason' => $this->faker->optional()->sentence(),
            'notes' => $this->faker->optional()->paragraph(),
            'metadata' => [
                'device' => $this->faker->randomElement(['web', 'mobile', 'tablet']),
                'browser' => $this->faker->userAgent(),
                'ip_address' => $this->faker->ipv4(),
                'user_agent' => $this->faker->userAgent(),
                'location' => [
                    'city' => $this->faker->city(),
                    'country' => 'SA',
                ],
            ],
        ];
    }

    public function completed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'COMPLETED',
            'approved_at' => now(),
            'approved_by' => Str::uuid(),
        ]);
    }

    public function pending(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'PENDING',
        ]);
    }

    public function large(): static
    {
        return $this->state(fn (array $attributes) => [
            'amount' => $this->faker->randomFloat(2, 10000, 100000),
        ]);
    }

    public function small(): static
    {
        return $this->state(fn (array $attributes) => [
            'amount' => $this->faker->randomFloat(2, 10, 100),
        ]);
    }

    public function anonymous(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_anonymous' => true,
            'donor_name' => 'Anonymous',
            'donor_email' => null,
            'donor_phone' => null,
            'donor_national_id' => null,
        ]);
    }

    public function withDedication(): static
    {
        return $this->state(fn (array $attributes) => [
            'dedication_name' => $this->faker->name(),
            'dedication_type' => $this->faker->randomElement(['IN_MEMORY', 'IN_HONOR', 'THANKSGIVING']),
        ]);
    }

    public function creditCard(): static
    {
        return $this->state(fn (array $attributes) => [
            'payment_method' => 'CREDIT_CARD',
            'payment_gateway' => $this->faker->randomElement(['MYFATOORAH', 'TAP', 'STRIPE']),
        ]);
    }

    public function bankTransfer(): static
    {
        return $this->state(fn (array $attributes) => [
            'payment_method' => 'BANK_TRANSFER',
            'bank_reference' => 'BANK-' . Str::upper(Str::random(8)),
        ]);
    }

    public function cash(): static
    {
        return $this->state(fn (array $attributes) => [
            'payment_method' => 'CASH',
            'payment_gateway' => null,
            'gateway_transaction_id' => null,
        ]);
    }
}
