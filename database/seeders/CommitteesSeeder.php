<?php

namespace Database\Seeders;

use App\Models\Committee;
use App\Models\CommitteeMember;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class CommitteesSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('Seeding committees...');
        
        // 1. Social Committee (اللجنة الاجتماعية - الخانة السابعة)
        $socialCommittee = Committee::create([
            'id' => Str::uuid(),
            'name_arabic' => 'اللجنة الاجتماعية',
            'name_english' => 'Social Committee',
            'code' => 'SOC-001',
            'committee_type' => 'SOCIAL',
            'description_arabic' => 'تهتم اللجنة الاجتماعية بشؤون الأسرة والدعم الاجتماعي والإعانات',
            'description_english' => 'Social committee handles family affairs, social support, and aid programs',
            'objectives' => [
                'توفير الدعم الاجتماعي لأفراد العائلة',
                'إدارة برامج الإعانات (الزواج، الأسرة، التعليم)',
                'تنظيم الفعاليات الاجتماعية',
                'دعم الأسر المحتاجة',
            ],
            'responsibilities' => [
                'دراسة طلبات الإعانات',
                'توزيع المساعدات المالية',
                'متابعة الحالات الاجتماعية',
                'تنظيم اللقاءات العائلية',
            ],
            'chairman_id' => User::where('user_type', 'SOCIAL_COMMITTEE')->inRandomOrder()->first()->person_id,
            'formation_date' => '2020-01-01',
            'status' => 'ACTIVE',
            'meeting_schedule' => [
                'frequency' => 'monthly',
                'day_of_week' => 'saturday',
                'time' => '18:00',
                'location' => 'مقر العائلة الرئيسي',
            ],
            'budget_info' => [
                'annual_budget' => 500000,
                'currency' => 'SAR',
                'budget_year' => 2024,
            ],
            'performance_metrics' => [
                'aid_requests_processed' => 150,
                'total_aid_distributed' => 2500000,
                'family_events_organized' => 12,
            ],
            'max_members' => 7,
            'min_members' => 3,
            'settings' => [
                'aid_approval_threshold' => 10000,
                'emergency_response_time' => '48_hours',
                'report_frequency' => 'quarterly',
            ],
        ]);
        
        // Add members to social committee
        $socialCommitteeUsers = User::where('user_type', 'SOCIAL_COMMITTEE')->limit(5)->get();
        foreach ($socialCommitteeUsers as $index => $user) {
            CommitteeMember::create([
                'id' => Str::uuid(),
                'committee_id' => $socialCommittee->id,
                'person_id' => $user->person_id,
                'role' => $index === 0 ? 'CHAIRMAN' : ($index === 1 ? 'DEPUTY_CHAIRMAN' : 'MEMBER'),
                'appointment_date' => '2020-01-01',
                'start_date' => '2020-01-01',
                'status' => 'ACTIVE',
                'responsibilities' => [
                    'مراجعة الطلبات',
                    'زيارة الأسر',
                    'توزيع المساعدات',
                    'كتابة التقارير',
                ],
                'permissions' => [
                    'can_approve_aid' => $index < 3,
                    'can_view_sensitive_data' => true,
                    'can_generate_reports' => true,
                ],
                'attendance_rate' => $this->faker->numberBetween(70, 100),
                'meetings_attended' => $this->faker->numberBetween(10, 50),
                'can_approve' => $index < 3,
                'monthly_allowance' => $index === 0 ? 3000 : ($index === 1 ? 2000 : 1000),
                'allowance_currency' => 'SAR',
            ]);
        }
        
        // 2. Cultural Committee (اللجنة الثقافية - الخانة الثامنة)
        $culturalCommittee = Committee::create([
            'id' => Str::uuid(),
            'name_arabic' => 'اللجنة الثقافية',
            'name_english' => 'Cultural Committee',
            'code' => 'CUL-001',
            'committee_type' => 'CULTURAL',
            'description_arabic' => 'تعنى اللجنة الثقافية بالأنشطة الثقافية والتعليمية والجوائز العلمية',
            'objectives' => [
                'تشجيع التعليم والتفوق العلمي',
                'تنظيم المسابقات الثقافية',
                'إدارة جائزة القرآن الكريم',
                'تنمية المهارات الثقافية',
            ],
            'responsibilities' => [
                'إدارة جائزة القرآن الكريم',
                'تنظيم المسابقات العلمية',
                'دعم الطلاب المتفوقين',
                'تنظيم المحاضرات والندوات',
            ],
            'chairman_id' => User::where('user_type', 'CULTURAL_COMMITTEE')->inRandomOrder()->first()->person_id,
            'formation_date' => '2020-02-01',
            'status' => 'ACTIVE',
            'performance_metrics' => [
                'quran_competitions' => 4,
                'academic_awards' => 25,
                'cultural_events' => 8,
                'students_supported' => 50,
            ],
            'budget_info' => [
                'annual_budget' => 300000,
                'currency' => 'SAR',
                'quran_award_budget' => 100000,
                'academic_award_budget' => 150000,
            ],
        ]);
        
        // Add cultural committee members
        User::where('user_type', 'CULTURAL_COMMITTEE')->each(function ($user, $index) use ($culturalCommittee) {
            CommitteeMember::create([
                'committee_id' => $culturalCommittee->id,
                'person_id' => $user->person_id,
                'role' => $index === 0 ? 'CHAIRMAN' : 'MEMBER',
                'appointment_date' => '2020-02-01',
                'start_date' => '2020-02-01',
                'monthly_allowance' => $index === 0 ? 2000 : 800,
            ]);
        });
        
        // 3. Reconciliation Committee (لجنة إصلاح ذات البين - الخانة التاسعة)
        $reconciliationCommittee = Committee::create([
            'id' => Str::uuid(),
            'name_arabic' => 'لجنة إصلاح ذات البين',
            'name_english' => 'Reconciliation Committee',
            'code' => 'REC-001',
            'committee_type' => 'RECONCILIATION',
            'description_arabic' => 'تتولى حل النزاعات والخلافات بين أفراد العائلة',
            'objectives' => [
                'حل النزاعات العائلية',
                'تعزيز الوحدة الأسرية',
                'منع تفاقم الخلافات',
                'الحفاظ على تماسك العائلة',
            ],
            'responsibilities' => [
                'استقبال شكاوى النزاعات',
                'عقد جلسات الصلح',
                'اقتراح حلول وسط',
                'متابعة تنفيذ الاتفاقيات',
            ],
            'chairman_id' => User::where('user_type', 'RECONCILIATION_COMMITTEE')->inRandomOrder()->first()->person_id,
            'formation_date' => '2020-03-01',
            'status' => 'ACTIVE',
            'performance_metrics' => [
                'cases_resolved' => 45,
                'success_rate' => 92,
                'average_resolution_time' => '15_days',
            ],
            'settings' => [
                'confidentiality_level' => 'high',
                'mediation_protocol' => 'traditional',
                'follow_up_period' => '3_months',
            ],
        ]);
        
        // 4. Sports Committee (اللجنة الرياضية - الخانة الثامنة)
        $sportsCommittee = Committee::create([
            'id' => Str::uuid(),
            'name_arabic' => 'اللجنة الرياضية',
            'name_english' => 'Sports Committee',
            'code' => 'SPO-001',
            'committee_type' => 'SPORTS',
            'description_arabic' => 'تهتم بالأنشطة الرياضية والبطولات العائلية',
            'objectives' => [
                'تنظيم البطولات الرياضية',
                'تشجيع ممارسة الرياضة',
                'اكتشاف المواهب الرياضية',
                'تعزيز الروح الرياضية',
            ],
            'responsibilities' => [
                'تنظيم دوري العائلة الرياضي',
                'إدارة الفرق الرياضية',
                'توفير المعدات الرياضية',
                'تنظيم رحلات رياضية',
            ],
            'chairman_id' => User::where('user_type', 'SPORTS_COMMITTEE')->inRandomOrder()->first()->person_id,
            'formation_date' => '2020-04-01',
            'performance_metrics' => [
                'sports_tournaments' => 6,
                'teams_formed' => 8,
                'participants' => 120,
                'championships_won' => 3,
            ],
            'budget_info' => [
                'annual_budget' => 200000,
                'equipment_budget' => 80000,
                'tournament_budget' => 100000,
            ],
        ]);
        
        // 5. Media Center (المركز الإعلامي - الخانة العاشرة)
        $mediaCenter = Committee::create([
            'id' => Str::uuid(),
            'name_arabic' => 'المركز الإعلامي',
            'name_english' => 'Media Center',
            'code' => 'MED-001',
            'committee_type' => 'MEDIA',
            'description_arabic' => 'يدير التواصل الإعلامي والتوثيق والشؤون الإعلامية للعائلة',
            'objectives' => [
                'توثيق أنشطة العائلة',
                'إدارة التواصل الإعلامي',
                'نشر أخبار العائلة',
                'الحفاظ على الأرشيف',
            ],
            'responsibilities' => [
                'إصدار النشرات الدورية',
                'إدارة الموقع الإلكتروني',
                'الحفاظ على الأرشيف',
                'التغطية الإعلامية للفعاليات',
            ],
            'chairman_id' => User::where('user_type', 'MEDIA_CENTER')->inRandomOrder()->first()->person_id,
            'formation_date' => '2020-05-01',
            'performance_metrics' => [
                'newsletters_published' => 24,
                'website_visits' => 15000,
                'social_media_followers' => 5000,
                'events_covered' => 35,
            ],
            'settings' => [
                'publication_frequency' => 'monthly',
                'social_media_channels' => ['twitter', 'instagram', 'youtube'],
                'archiving_system' => 'digital',
            ],
        ]);
        
        $this->command->info('✅ Created 5 major committees with members');
    }
}
