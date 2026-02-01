<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use \App\Models\Person;
use Illuminate\Support\Facades\DB;

class UsersSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('Seeding users...');

        $person_id = DB::table('persons')->select('national_id')->where('national_id', '1000000001')->get();
        
        // Super Admin (System Administrator)
        User::factory()->superAdmin()->create([
            'username' => 'superadmin',
            'email' => 'superadmin@family.com',
            'person_id' => $person_id,
            'permissions_override' => ['*'],
            'preferences' => [
                'theme' => 'dark',
                'language' => 'ar',
                'timezone' => 'Asia/Riyadh',
                'notifications' => ['email' => true, 'sms' => true, 'push' => true],
            ],
        ]);
        
        $this->command->info('✅ Super Admin created');
        
        // Board Members (أعضاء مجلس الإدارة)
        User::factory()->boardMember()->count(7)->create([
            'user_type' => 'BOARD_MEMBER',
            'additional_roles' => null,
            'preferences' => [
                'theme' => 'light',
                'language' => 'ar',
                'notifications' => [
                    'board_meetings' => true,
                    'financial_reports' => true,
                    'strategic_decisions' => true,
                ],
            ],
        ]);
        
        // Executive Management (الإدارة التنفيذية)
        User::factory()->executive()->count(3)->create([
            'user_type' => 'EXECUTIVE',
            'preferences' => [
                'theme' => 'light',
                'language' => 'en',
                'notifications' => [
                    'daily_reports' => true,
                    'team_updates' => true,
                    'performance_metrics' => true,
                ],
            ],
        ]);
        
        // Finance Manager (المدير المالي)
        User::factory()->financeManager()->create([
            'username' => 'finance_manager',
            'email' => 'finance@family.com',
            'preferences' => [
                'theme' => 'light',
                'language' => 'ar',
                'notifications' => [
                    'transactions' => true,
                    'budget_alerts' => true,
                    'audit_logs' => true,
                ],
            ],
        ]);
        
        // Social Committee (اللجنة الاجتماعية)
        User::factory()->socialCommittee()->count(5)->create([
            'user_type' => 'SOCIAL_COMMITTEE',
            'preferences' => [
                'theme' => 'light',
                'language' => 'ar',
                'notifications' => [
                    'aid_requests' => true,
                    'family_events' => true,
                    'social_programs' => true,
                ],
            ],
        ]);
        
        // Cultural Committee (اللجنة الثقافية)
        User::factory()->count(4)->create([
            'user_type' => 'CULTURAL_COMMITTEE',
            'preferences' => [
                'theme' => 'light',
                'language' => 'ar',
                'notifications' => [
                    'cultural_events' => true,
                    'educational_programs' => true,
                    'award_announcements' => true,
                ],
            ],
        ]);
        
        // Reconciliation Committee (لجنة إصلاح ذات البين)
        User::factory()->count(3)->create([
            'user_type' => 'RECONCILIATION_COMMITTEE',
            'preferences' => [
                'theme' => 'light',
                'language' => 'ar',
                'notifications' => [
                    'dispute_cases' => true,
                    'mediation_requests' => true,
                    'resolution_updates' => true,
                ],
            ],
        ]);
        
        // Sports Committee (اللجنة الرياضية)
        User::factory()->count(4)->create([
            'user_type' => 'SPORTS_COMMITTEE',
            'preferences' => [
                'theme' => 'light',
                'language' => 'ar',
                'notifications' => [
                    'sports_events' => true,
                    'tournaments' => true,
                    'team_updates' => true,
                ],
            ],
        ]);
        
        // Media Center (المركز الإعلامي)
        User::factory()->count(3)->create([
            'user_type' => 'MEDIA_CENTER',
            'preferences' => [
                'theme' => 'dark',
                'language' => 'en',
                'notifications' => [
                    'news_updates' => true,
                    'social_media' => true,
                    'public_relations' => true,
                ],
            ],
        ]);
        
        // Regular Family Members
        User::factory()->count(50)->create([
            'user_type' => 'FAMILY_MEMBER',
            'preferences' => [
                'theme' => $this->faker->randomElement(['light', 'dark']),
                'language' => 'ar',
                'notifications' => [
                    'family_news' => true,
                    'donation_updates' => true,
                    'event_invitations' => true,
                ],
            ],
        ]);
        
        // Some users with MFA enabled
        User::whereIn('user_type', ['SUPER_ADMIN', 'BOARD_MEMBER', 'FINANCE_MANAGER'])
            ->inRandomOrder()
            ->limit(10)
            ->get()
            ->each(function ($user) {
                $user->update([
                    'mfa_enabled' => true,
                    'mfa_secret' => 'ABCDEFGHIJKLMNOP',
                    'mfa_backup_codes' => ['123456', '654321', '111111', '222222'],
                    'mfa_enabled_at' => now(),
                ]);
            });
        
        $this->command->info('✅ Created 80+ users with different roles');
    }
}
