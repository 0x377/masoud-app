<?php

namespace Database\Seeders;

use App\Models\CreditCard;
use App\Models\Person;
use Illuminate\Database\Seeder;

class CreditCardsSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('Seeding credit cards...');
        
        // Create cards for board members
        Person::whereHas('user', function ($query) {
            $query->where('user_type', 'BOARD_MEMBER');
        })->each(function ($person) {
            CreditCard::factory()->default()->verified()->withHighLimits()->create([
                'person_id' => $person->id,
                'card_holder_name' => $person->full_name_english,
                'bank_name' => 'الراجحي',
                'daily_limit' => 100000,
                'transaction_limit' => 50000,
                'monthly_limit' => 500000,
                'security_rules' => [
                    'allowed_countries' => ['SA', 'AE', 'BH', 'QA', 'KW', 'OM'],
                    'max_transaction_amount' => 100000,
                    'require_otp_above' => 5000,
                ],
            ]);
            
            // Add secondary card
            CreditCard::factory()->create([
                'person_id' => $person->id,
                'card_type' => $this->faker->randomElement(['VISA', 'MASTERCARD']),
                'is_default' => false,
            ]);
        });
        
        // Create cards for executives
        Person::whereHas('user', function ($query) {
            $query->where('user_type', 'EXECUTIVE');
        })->each(function ($person) {
            CreditCard::factory()->verified()->create([
                'person_id' => $person->id,
                'card_holder_name' => $person->full_name_english,
                'daily_limit' => 50000,
                'transaction_limit' => 20000,
                'monthly_limit' => 200000,
                'allow_recurring' => true,
                'recurring_settings' => [
                    'frequency' => 'monthly',
                    'max_amount' => 10000,
                    'allowed_merchants' => ['family_services', 'utilities', 'education'],
                ],
            ]);
        });
        
        // Create cards for regular family members
        Person::whereHas('user', function ($query) {
            $query->where('user_type', 'FAMILY_MEMBER');
        })->inRandomOrder()->limit(20)->each(function ($person) {
            CreditCard::factory()->create([
                'person_id' => $person->id,
                'card_type' => $this->faker->randomElement(['VISA', 'MASTERCARD', 'MADA']),
                'daily_limit' => 10000,
                'transaction_limit' => 5000,
                'monthly_limit' => 50000,
                'is_default' => true,
            ]);
        });
        
        // Create some expired cards
        CreditCard::factory()->expired()->count(5)->create([
            'status' => 'EXPIRED',
        ]);
        
        // Create some suspended cards
        CreditCard::factory()->count(3)->create([
            'status' => 'SUSPENDED',
            'failed_attempts' => 5,
            'locked_until' => now()->addDays(1),
        ]);
        
        $this->command->info('✅ Created credit cards for different user types');
    }
}
