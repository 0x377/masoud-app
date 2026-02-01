<?php

namespace Database\Seeders;

use App\Models\MarriageAidRequest;
use App\Models\Person;
use App\Models\User;
use Illuminate\Database\Seeder;

class MarriageAidRequestsSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('Seeding marriage aid requests...');
        
        $socialCommitteeUsers = User::where('user_type', 'SOCIAL_COMMITTEE')->get();
        $familyMembers = Person::whereHas('user', function ($query) {
            $query->where('user_type', 'FAMILY_MEMBER');
        })->where('gender', 'M')->where('marital_status', 'single')->get();
        
        // Create approved marriage aid requests
        foreach ($familyMembers->take(10) as $applicant) {
            MarriageAidRequest::create([
                'id' => \Illuminate\Support\Str::uuid(),
                'applicant_id' => $applicant->id,
                'user_id' => $applicant->user->id,
                'marriage_type' => 'FIRST_MARRIAGE',
                'status' => 'COMPLETED',
                'priority' => 'HIGH',
                'requested_amount' => 50000,
                'approved_amount' => 40000,
                'disbursed_amount' => 40000,
                'currency' => 'SAR',
                'marriage_date' => now()->addMonths(3)->format('Y-m-d'),
                'application_date' => now()->subMonths(2)->format('Y-m-d'),
                'marriage_course_certificate' => '/documents/course_cert_' . $applicant->id . '.pdf',
                'marriage_contract' => '/documents/contract_' . $applicant->id . '.pdf',
                'national_id_copy' => '/documents/national_id_' . $applicant->id . '.pdf',
                'family_id_document' => '/documents/family_id_' . $applicant->id . '.pdf',
                'bank_name' => 'الراجحي',
                'bank_account_number' => $this->faker->bankAccountNumber(),
                'iban' => 'SA' . $this->faker->numerify('####################'),
                'account_holder_name' => $applicant->full_name_arabic,
                'assigned_to' => $socialCommitteeUsers->random()->id,
                'reviewed_by' => $socialCommitteeUsers->random()->id,
                'approved_by' => $socialCommitteeUsers->where('username', 'like', '%chairman%')->first()->id ?? $socialCommitteeUsers->random()->id,
                'submitted_at' => now()->subMonths(2),
                'reviewed_at' => now()->subMonths(1),
                'approved_at' => now()->subWeeks(2),
                'disbursed_at' => now()->subWeeks(1),
                'completed_at' => now()->subDays(3),
                'review_notes' => 'تمت الموافقة على الطلب بعد التأكد من استيفاء الشروط',
                'conditions' => [
                    'توفير عقد الزواج الرسمي',
                    'إكمال دورة المقبلين على الزواج',
                    'تزويد اللجنة بصورة من السجل العائلي',
                ],
                'status_history' => [
                    ['status' => 'DRAFT', 'date' => now()->subMonths(3), 'by' => $applicant->user->id],
                    ['status' => 'SUBMITTED', 'date' => now()->subMonths(2), 'by' => $applicant->user->id],
                    ['status' => 'UNDER_REVIEW', 'date' => now()->subMonths(2), 'by' => $socialCommitteeUsers->random()->id],
                    ['status' => 'APPROVED', 'date' => now()->subWeeks(2), 'by' => $socialCommitteeUsers->where('username', 'like', '%chairman%')->first()->id],
                    ['status' => 'COMPLETED', 'date' => now()->subDays(3), 'by' => $socialCommitteeUsers->random()->id],
                ],
                'needs_committee_approval' => true,
                'committee_approval_by' => $socialCommitteeUsers->where('username', 'like', '%chairman%')->first()->id,
                'committee_approval_at' => now()->subWeeks(2),
            ]);
        }
        
        // Create pending marriage aid requests
        foreach ($familyMembers->skip(10)->take(5) as $applicant) {
            MarriageAidRequest::create([
                'applicant_id' => $applicant->id,
                'user_id' => $applicant->user->id,
                'marriage_type' => 'FIRST_MARRIAGE',
                'status' => 'UNDER_REVIEW',
                'requested_amount' => 60000,
                'marriage_date' => now()->addMonths(4)->format('Y-m-d'),
                'application_date' => now()->subWeeks(2)->format('Y-m-d'),
                'marriage_course_certificate' => '/documents/course_cert_' . $applicant->id . '.pdf',
                'national_id_copy' => '/documents/national_id_' . $applicant->id . '.pdf',
                'assigned_to' => $socialCommitteeUsers->random()->id,
                'submitted_at' => now()->subWeeks(2),
                'review_notes' => 'قيد المراجعة، يلزم توفير عقد النكاح',
            ]);
        }
        
        // Create rejected marriage aid requests
        foreach ($familyMembers->skip(15)->take(3) as $applicant) {
            MarriageAidRequest::create([
                'applicant_id' => $applicant->id,
                'user_id' => $applicant->user->id,
                'marriage_type' => 'FIRST_MARRIAGE',
                'status' => 'REJECTED',
                'requested_amount' => 70000,
                'marriage_date' => now()->addMonths(2)->format('Y-m-d'),
                'application_date' => now()->subMonths(1)->format('Y-m-d'),
                'rejection_reason' => 'عدم استيفاء الشروط: العمر أقل من 25 سنة وليس الأول في الأسرة',
                'reviewed_by' => $socialCommitteeUsers->random()->id,
                'reviewed_at' => now()->subWeeks(3),
                'status_history' => [
                    ['status' => 'SUBMITTED', 'date' => now()->subMonths(1)],
                    ['status' => 'UNDER_REVIEW', 'date' => now()->subMonths(1)->addDays(3)],
                    ['status' => 'REJECTED', 'date' => now()->subWeeks(3)],
                ],
            ]);
        }
        
        // Create second marriage requests
        Person::whereHas('user', function ($query) {
            $query->where('user_type', 'FAMILY_MEMBER');
        })->where('gender', 'M')->where('marital_status', 'divorced')->take(2)->each(function ($applicant) use ($socialCommitteeUsers) {
            MarriageAidRequest::create([
                'applicant_id' => $applicant->id,
                'user_id' => $applicant->user->id,
                'marriage_type' => 'SECOND_MARRIAGE',
                'status' => 'CONDITIONALLY_APPROVED',
                'requested_amount' => 30000,
                'approved_amount' => 20000,
                'marriage_date' => now()->addMonths(6)->format('Y-m-d'),
                'conditions' => [
                    'تقديم وثيقة الطلاق السابقة',
                    'إثبات القدرة المالية',
                    'موافقة الأسرة على الزواج الثاني',
                ],
                'reviewed_by' => $socialCommitteeUsers->random()->id,
                'reviewed_at' => now()->subWeeks(1),
                'review_notes' => 'موافقة مشروطة بتوفير الوثائق المطلوبة',
            ]);
        });
        
        $this->command->info('✅ Created marriage aid requests with different statuses');
    }
}
