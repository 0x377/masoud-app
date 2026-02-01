<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class UserFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => Str::uuid(),
            'national_id' => $this->faker->unique()->numerify('1##########'),
            'full_name_arabic' => $this->faker->name(),
            'full_name_english' => $this->faker->name(),
            'email' => $this->faker->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => bcrypt('password123'),
            'gender' => $this->faker->randomElement(['M', 'F']),
            'birth_date' => $this->faker->date(),
            'phone_number' => $this->faker->phoneNumber(),
            'user_type' => 'FAMILY_MEMBER',
            'is_active' => true,
        ];

        $personId = \App\Models\Person::inRandomOrder()->first()?->id ?? 
                   \App\Models\Person::factory()->create()->id;

        $userTypes = [
            'FAMILY_MEMBER',
            'BOARD_MEMBER',
            'EXECUTIVE',
            'FINANCE_MANAGER',
            'SOCIAL_COMMITTEE',
            'CULTURAL_COMMITTEE',
            'RECONCILIATION_COMMITTEE',
            'SPORTS_COMMITTEE',
            'MEDIA_CENTER',
            'SUPER_ADMIN'
        ];

        $person = \App\Models\Person::find($personId);
        $email = $person->email ?? $this->faker->unique()->safeEmail();
        $phone = $person->phone_number ?? $this->faker->phoneNumber();
        $fullNameArabic = $person->full_name_arabic ?? $this->faker->name();

        // Generate username from Arabic name
        $username = Str::slug(explode(' ', $fullNameArabic)[0]) . $this->faker->randomNumber(3);

        return [
            'id' => Str::uuid(),
            'person_id' => $personId,
            'username' => $username,
            'email' => $email,
            'email_verified_at' => now(),
            'phone_number' => $phone,
            'phone_verified_at' => now(),
            'password' => Hash::make('password123'), // Default password
            'password_changed_at' => now(),
            'user_type' => $this->faker->randomElement($userTypes),
            'additional_roles' => $this->faker->optional()->passthrough(['BOARD_MEMBER', 'SOCIAL_COMMITTEE']),
            'status' => 'ACTIVE',
            'mfa_enabled' => $this->faker->boolean(20),
            'mfa_secret' => $this->faker->optional()->bothify('******'),
            'failed_login_attempts' => 0,
            'last_login_at' => $this->faker->dateTimeBetween('-1 month', 'now'),
            'last_login_ip' => $this->faker->ipv4(),
            'last_activity_at' => now(),
            'login_count' => $this->faker->numberBetween(1, 100),
            'preferences' => [
                'theme' => $this->faker->randomElement(['light', 'dark']),
                'language' => $this->faker->randomElement(['ar', 'en']),
                'timezone' => 'Asia/Riyadh',
                'notifications' => [
                    'email' => true,
                    'sms' => true,
                    'push' => false,
                ],
            ],
            'notification_settings' => [
                'donations' => true,
                'meetings' => true,
                'family_updates' => true,
                'security_alerts' => true,
            ],
            'permissions_override' => null,
            'total_donations' => $this->faker->randomFloat(2, 0, 100000),
            'donation_count' => $this->faker->numberBetween(0, 50),
            'last_donation_at' => $this->faker->optional()->dateTimeBetween('-1 year', 'now'),
            'remember_token' => Str::random(10),
        ];
    }

    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
    public function superAdmin(): static
    {
        return $this->state(fn (array $attributes) => [
            'user_type' => 'SUPER_ADMIN',
            'permissions_override' => ['*'],
        ]);
    }

    public function boardMember(): static
    {
        return $this->state(fn (array $attributes) => [
            'user_type' => 'BOARD_MEMBER',
            'additional_roles' => null,
        ]);
    }

    public function socialCommittee(): static
    {
        return $this->state(fn (array $attributes) => [
            'user_type' => 'SOCIAL_COMMITTEE',
        ]);
    }

    public function executive(): static
    {
        return $this->state(fn (array $attributes) => [
            'user_type' => 'EXECUTIVE',
        ]);
    }

    public function financeManager(): static
    {
        return $this->state(fn (array $attributes) => [
            'user_type' => 'FINANCE_MANAGER',
        ]);
    }

    public function suspended(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'SUSPENDED',
            'suspended_at' => now(),
            'suspension_reason' => $this->faker->sentence(),
        ]);
    }

    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
            'phone_verified_at' => null,
        ]);
    }

    public function withMfa(): static
    {
        return $this->state(fn (array $attributes) => [
            'mfa_enabled' => true,
            'mfa_secret' => 'ABCDEFGHIJKLMNOP',
            'mfa_enabled_at' => now(),
            'mfa_backup_codes' => ['123456', '654321', '111111', '222222'],
        ]);
    }

    public function withHighDonations(): static
    {
        return $this->state(fn (array $attributes) => [
            'total_donations' => $this->faker->randomFloat(2, 100000, 1000000),
            'donation_count' => $this->faker->numberBetween(50, 200),
        ]);
    }
}
