<?php

namespace Database\Seeders;

use App\Models\Person;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class PersonsSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('Seeding persons...');

        // Create family founder
        $founder = Person::factory()->create([
            'national_id' => '1000000001',
            'full_name_arabic' => 'عبدالله محمد المسعود',
            'full_name_english' => 'Abdullah Mohammed Al-Masoud',
            'nickname' => 'أبو محمد',
            'gender' => 'M',
            'birth_date' => '1940-01-15',
            'birth_place' => 'الرياض',
            'marital_status' => 'married',
            'blood_type' => 'O+',
            'phone_number' => '+966500000001',
            'email' => 'founder@family.com',
            'family_info' => json_encode([
                'father_name' => 'محمد إبراهيم المسعود',
                'mother_name' => 'فاطمة أحمد',
                'number_of_siblings' => 3,
                'family_rank' => 1,
                'is_family_founder' => true,
            ]),
            'education_info' => json_encode([
                'level' => 'high_school',
                'specialization' => 'التجارة',
                'institution' => 'مدرسة الرياض',
                'graduation_year' => '1958',
            ]),
            'work_info' => json_encode([
                'occupation' => 'رجل أعمال',
                'company' => 'مجموعة المسعود',
                'position' => 'المؤسس والرئيس',
                'experience_years' => 60,
            ]),
            'additional_info' => json_encode([
                'hobbies' => ['الصيد', 'القراءة', 'الخيل'],
                'languages' => ['Arabic'],
                'social_status' => 'wealthy',
                'notable_achievements' => 'تأسيس العائلة وتوسيع أعمالها',
            ]),
            'created_by' => null,
            'verified_by' => null,
            'verified_at' => now(),
        ]);
        
        $this->command->info('✅ Family founder created: ' . $founder->full_name_arabic);
        
        // Create founder's wife
        $founderWife = Person::factory()->female()->create([
            'national_id' => '1000000002',
            'full_name_arabic' => 'نورة أحمد القحطاني',
            'full_name_english' => 'Nora Ahmed Al-Qahtani',
            'nickname' => 'أم علي',
            'birth_date' => '1945-03-20',
            'birth_place' => 'الرياض',
            'marital_status' => 'married',
            'family_info' => json_encode([
                'father_name' => 'أحمد سليمان القحطاني',
                'mother_name' => 'شريفة محمد',
                'family_rank' => 1,
            ]),
        ]);
        
        $this->command->info('✅ Founder\'s wife created: ' . $founderWife->full_name_arabic);
        
        // Create their children (first generation) - 5 children
        $firstGenChildren = [];
        for ($i = 1; $i <= 5; $i++) {
            $gender = ($i <= 3) ? 'M' : 'F'; // 3 males, 2 females
            $child = Person::factory()->create([
                'national_id' => '10000000' . (10 + $i),
                'gender' => $gender,
                'birth_date' => now()->subYears(rand(40, 60))->format('Y-m-d'),
                'marital_status' => rand(0, 1) ? 'married' : 'single',
                'family_info' => json_encode([
                    'father_name' => $founder->full_name_arabic,
                    'mother_name' => $founderWife->full_name_arabic,
                    'family_rank' => 2,
                    'birth_order' => $i,
                ]),
            ]);
            $firstGenChildren[] = $child;
            $this->command->info("   Created child {$i}: " . $child->full_name_arabic);
        }
        
        // Create second generation (grandchildren) - 15 grandchildren
        $secondGen = [];
        $childNames = ['علي', 'خالد', 'فهد', 'ناصر', 'سعود', 'فيصل', 'تركي', 'سعد', 'بدر', 'ماجد', 'نورة', 'سارة', 'فاطمة', 'أمل', 'هناء'];
        
        for ($i = 1; $i <= 15; $i++) {
            $parent = $firstGenChildren[array_rand($firstGenChildren)];
            $gender = ($i <= 8) ? 'M' : 'F'; // 8 males, 7 females
            
            $person = Person::factory()->create([
                'national_id' => '1000000' . (100 + $i),
                'gender' => $gender,
                'birth_date' => now()->subYears(rand(20, 40))->format('Y-m-d'),
                'marital_status' => ($i > 10) ? 'married' : ($i > 5 ? 'single' : 'married'),
                'family_info' => json_encode([
                    'father_name' => ($gender === 'M') ? $parent->full_name_arabic : 'متزوجة من ' . $parent->full_name_arabic,
                    'family_rank' => 3,
                    'generation' => 'second',
                ]),
            ]);
            $secondGen[] = $person;
        }
        
        $this->command->info('✅ Created 15 second generation members');
        
        // Create third generation (great-grandchildren) - 30 members
        for ($i = 1; $i <= 30; $i++) {
            $parent = $secondGen[array_rand($secondGen)];
            $gender = rand(0, 1) ? 'M' : 'F';
            
            Person::factory()->create([
                'national_id' => '100000' . (1000 + $i),
                'gender' => $gender,
                'birth_date' => now()->subYears(rand(5, 25))->format('Y-m-d'),
                'marital_status' => ($i > 25) ? 'married' : 'single',
                'family_info' => json_encode([
                    'family_rank' => 4,
                    'generation' => 'third',
                    'is_minor' => ($i > 20) ? false : true,
                ]),
            ]);
        }
        
        $this->command->info('✅ Created 30 third generation members');
        
        // Create extended family members - 50 members
        for ($i = 1; $i <= 50; $i++) {
            Person::factory()->create([
                'national_id' => '2000000' . str_pad($i, 4, '0', STR_PAD_LEFT),
                'family_info' => json_encode([
                    'family_rank' => rand(1, 4),
                    'is_extended_family' => true,
                    'relation_type' => ['عم', 'خال', 'ابن العم', 'ابن الخال', 'صهر'][rand(0, 4)],
                ]),
            ]);
        }
        
        $this->command->info('✅ Created 50 extended family members');
        $this->command->info('✅ Total: ' . Person::count() . ' persons created across 4 generations');
    }
}









// namespace Database\Seeders;

// use App\Models\Person;
// use Illuminate\Database\Seeder;

// class PersonsSeeder extends Seeder
// {
//     public function run(): void
//     {
//         $this->command->info('Seeding persons...');
        
//         // Create family founder
//         $founder = Person::factory()->create([
//             'national_id' => '1000000001',
//             'full_name_arabic' => 'عبدالله محمد المسعود',
//             'full_name_english' => 'Abdullah Mohammed Al-Masoud',
//             'nickname' => 'أبو محمد',
//             'gender' => 'M',
//             'birth_date' => '1940-01-15',
//             'birth_place' => 'الرياض',
//             'marital_status' => 'married',
//             'blood_type' => 'O+',
//             'phone_number' => '+966500000001',
//             'email' => 'founder@family.com',
//             'family_info' => [
//                 'father_name' => 'محمد إبراهيم المسعود',
//                 'mother_name' => 'فاطمة أحمد',
//                 'number_of_siblings' => 3,
//                 'family_rank' => 1,
//                 'is_family_founder' => true,
//             ],
//             'education_info' => [
//                 'level' => 'high_school',
//                 'specialization' => 'التجارة',
//                 'institution' => 'مدرسة الرياض',
//                 'graduation_year' => '1958',
//             ],
//             'work_info' => [
//                 'occupation' => 'رجل أعمال',
//                 'company' => 'مجموعة المسعود',
//                 'position' => 'المؤسس والرئيس',
//                 'experience_years' => 60,
//             ],
//             'additional_info' => [
//                 'hobbies' => ['الصيد', 'القراءة', 'الخيل'],
//                 'languages' => ['Arabic'],
//                 'social_status' => 'wealthy',
//                 'notable_achievements' => 'تأسيس العائلة وتوسيع أعمالها',
//             ],
//         ]);
        
//         $this->command->info('✅ Family founder created: ' . $founder->full_name_arabic);
        
//         // Create founder's wife
//         $founderWife = Person::factory()->female()->create([
//             'national_id' => '1000000002',
//             'full_name_arabic' => 'نورة أحمد القحطاني',
//             'full_name_english' => 'Nora Ahmed Al-Qahtani',
//             'nickname' => 'أم علي',
//             'birth_date' => '1945-03-20',
//             'birth_place' => 'الرياض',
//             'marital_status' => 'married',
//             'family_info' => [
//                 'father_name' => 'أحمد سليمان القحطاني',
//                 'mother_name' => 'شريفة محمد',
//                 'family_rank' => 1,
//             ],
//         ]);
        
//         // Create their children (first generation)
//         $children = Person::factory()->count(5)->create([
//             'family_info' => [
//                 'father_name' => $founder->full_name_arabic,
//                 'mother_name' => $founderWife->full_name_arabic,
//                 'family_rank' => 2,
//             ],
//         ]);
        
//         // Create second generation (grandchildren)
//         $grandchildren = Person::factory()->count(15)->create([
//             'family_info' => [
//                 'family_rank' => 3,
//             ],
//         ]);
        
//         // Create third generation (great-grandchildren)
//         Person::factory()->count(30)->create([
//             'family_info' => [
//                 'family_rank' => 4,
//             ],
//         ]);
        
//         // Create extended family members
//         Person::factory()->count(50)->create([
//             'family_info' => [
//                 'family_rank' => $this->faker->numberBetween(1, 4),
//                 'is_extended_family' => true,
//             ],
//         ]);
        
//         $this->command->info('✅ Created 100+ family members across 4 generations');
//     }
// }
