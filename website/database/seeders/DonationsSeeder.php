<?php

namespace Database\Seeders;

use App\Models\Donation;
use App\Models\User;
use Illuminate\Database\Seeder;

class DonationsSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('Seeding donations...');
        
        $users = User::all();
        
        // Create large donations from board members
        User::where('user_type', 'BOARD_MEMBER')->each(function ($user) {
            Donation::factory()->completed()->large()->count(3)->create([
                'donor_user_id' => $user->id,
                'donor_name' => $user->person->full_name_arabic ?? $user->person->full_name_english,
                'donor_email' => $user->email,
                'donor_phone' => $user->phone_number,
                'payment_method' => 'BANK_TRANSFER',
                'notes' => 'تبرع سنوي لمشاريع العائلة',
                'metadata' => [
                    'purpose' => 'general_family_fund',
                    'tax_receipt_issued' => true,
                    'receipt_number' => 'REC-' . strtoupper(uniqid()),
                ],
            ]);
        });
        
        // Create medium donations from executives
        User::where('user_type', 'EXECUTIVE')->each(function ($user) {
            Donation::factory()->completed()->count(5)->create([
                'donor_user_id' => $user->id,
                'amount' => $this->faker->numberBetween(1000, 5000),
                'payment_method' => 'CREDIT_CARD',
                'notes' => 'مساهمة في الأنشطة الشهرية',
            ]);
        });
        
        // Create regular donations from family members
        User::where('user_type', 'FAMILY_MEMBER')->inRandomOrder()->limit(30)->each(function ($user) {
            Donation::factory()->completed()->count($this->faker->numberBetween(1, 5))->create([
                'donor_user_id' => $user->id,
                'amount' => $this->faker->numberBetween(100, 2000),
                'payment_method' => $this->faker->randomElement(['CREDIT_CARD', 'BANK_TRANSFER', 'CASH']),
                'is_anonymous' => $this->faker->boolean(30),
                'dedication_name' => $this->faker->optional()->name(),
                'dedication_type' => $this->faker->optional()->randomElement(['IN_MEMORY', 'IN_HONOR']),
            ]);
        });
        
        // Create some anonymous donations
        Donation::factory()->completed()->anonymous()->count(10)->create([
            'amount' => $this->faker->numberBetween(500, 5000),
            'payment_method' => 'CASH',
            'notes' => 'تبرع مجهول',
        ]);
        
        // Create some pending donations
        Donation::factory()->pending()->count(8)->create([
            'payment_method' => 'BANK_TRANSFER',
            'bank_reference' => 'PENDING-' . strtoupper(uniqid()),
        ]);
        
        // Create some failed donations
        Donation::factory()->count(5)->create([
            'status' => 'FAILED',
            'payment_method' => 'CREDIT_CARD',
            'gateway_response' => 'Transaction declined by bank',
        ]);
        
        // Create donations with specific campaigns
        $campaigns = [
            'بناء المسجد العائلي',
            'صندوق الطلاب المتفوقين',
            'إعانات الزواج',
            'مساعدة الأسر المحتاجة',
            'تطوير المقر الرئيسي',
        ];
        
        foreach ($campaigns as $campaign) {
            Donation::factory()->completed()->count(3)->create([
                'campaign_name' => $campaign,
                'notes' => "تبرع لحملة {$campaign}",
                'metadata' => [
                    'campaign_year' => 2024,
                    'campaign_manager' => $this->faker->name(),
                ],
            ]);
        }
        
        $this->command->info('✅ Created diverse donation records');
    }
}
