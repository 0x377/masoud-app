<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class PersonFactory extends Factory
{
    /**
     * The name of the factory's corresponding model.
     *
     * @var string
     */
    protected $model = Person::class; // ADD THIS LINE if not already there

    public function definition(): array
    {
        $genders = ['M', 'F'];
        $gender = $this->faker->randomElement($genders);
        
        $arabicNamesMale = [
            'محمد', 'أحمد', 'علي', 'عمر', 'خالد', 'سعد', 'فهد', 'ناصر', 'يوسف', 'طارق',
            'ماجد', 'بدر', 'سلطان', 'فيصل', 'تركي', 'عبدالله', 'عبدالرحمن', 'عبدالعزيز',
            'عبداللطيف', 'عبدالمحسن', 'سعود', 'سلمان', 'مساعد', 'مشعل', 'نايف'
        ];
        
        $arabicNamesFemale = [
            'فاطمة', 'عائشة', 'خديجة', 'سارة', 'نورة', 'لطيفة', 'منيرة', 'مها', 'هناء',
            'أمل', 'سعاد', 'جميلة', 'مريم', 'زينب', 'روضة', 'شريفة', 'الجوهرة', 'نادية',
            'حصة', 'الجازي', 'سلوى', 'عبير', 'أريج', 'ضحى', 'ريم'
        ];
        
        $fullNameArabic = $gender === 'M' 
            ? $this->faker->randomElement($arabicNamesMale) . ' بن ' . $this->faker->randomElement($arabicNamesMale) . ' ' . $this->faker->randomElement(['المسعود', 'الغامدي', 'الحربي', 'القحطاني', 'الشهري'])
            : $this->faker->randomElement($arabicNamesFemale) . ' بنت ' . $this->faker->randomElement($arabicNamesMale) . ' ' . $this->faker->randomElement(['المسعود', 'الغامدي', 'الحربي', 'القحطاني', 'الشهري']);
        
        // FIXED: Handle optional death date properly
        $deathDate = $this->faker->optional(0.1)->dateTimeBetween('-10 years', 'now');
        $isAlive = $deathDate ? false : $this->faker->boolean(90);
        
        return [
            'id' => Str::uuid(),
            'national_id' => $this->faker->unique()->numerify('1#########'),
            'full_name_arabic' => $fullNameArabic,
            'full_name_english' => $this->faker->name($gender === 'M' ? 'male' : 'female'),
            'nickname' => $this->faker->optional()->firstName(),
            'gender' => $gender,
            'birth_date' => $this->faker->dateTimeBetween('-80 years', '-18 years')->format('Y-m-d'),
            'birth_place' => $this->faker->city(),
            'death_date' => $deathDate ? $deathDate->format('Y-m-d') : null, // FIXED
            'is_alive' => $isAlive,
            'marital_status' => $this->faker->randomElement(['single', 'married', 'divorced', 'widowed']),
            'blood_type' => $this->faker->randomElement(['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-']),
            'phone_number' => $this->faker->phoneNumber(),
            'email' => $this->faker->unique()->safeEmail(),
            'current_address' => $this->faker->address(),
            'photo_path' => $this->faker->optional()->imageUrl(),
            'family_info' => [
                'father_name' => $this->faker->name('male'),
                'mother_name' => $this->faker->name('female'),
                'number_of_siblings' => $this->faker->numberBetween(0, 10),
                'family_rank' => $this->faker->numberBetween(1, 5),
            ],
            'education_info' => [
                'level' => $this->faker->randomElement(['high_school', 'diploma', 'bachelor', 'master', 'phd']),
                'specialization' => $this->faker->jobTitle(),
                'institution' => $this->faker->company(),
                'graduation_year' => $this->faker->year(),
            ],
            'work_info' => [
                'occupation' => $this->faker->jobTitle(),
                'company' => $this->faker->company(),
                'position' => $this->faker->word(),
                'experience_years' => $this->faker->numberBetween(1, 40),
            ],
            'additional_info' => [
                'hobbies' => $this->faker->words(3),
                'languages' => ['Arabic', $this->faker->randomElement(['English', 'French', 'Spanish'])],
                'social_status' => $this->faker->randomElement(['middle_class', 'upper_middle', 'wealthy']),
            ],
            'created_by' => null,
            'verified_by' => null,
            'verified_at' => $this->faker->optional()->dateTimeThisYear(),
        ];
    }
    
    public function male(): static
    {
        return $this->state(fn (array $attributes) => [
            'gender' => 'M',
        ]);
    }
    
    public function female(): static
    {
        return $this->state(fn (array $attributes) => [
            'gender' => 'F',
        ]);
    }
    
    public function alive(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_alive' => true,
            'death_date' => null,
        ]);
    }
    
    public function deceased(): static
    {
        $deathDate = $this->faker->dateTimeBetween('-10 years', 'now');
        return $this->state(fn (array $attributes) => [
            'is_alive' => false,
            'death_date' => $deathDate->format('Y-m-d'),
        ]);
    }
    
    public function verified(): static
    {
        return $this->state(fn (array $attributes) => [
            'verified_at' => now(),
            'verified_by' => Str::uuid(),
        ]);
    }
    
    public function withFamilyInfo(array $info): static
    {
        return $this->state(fn (array $attributes) => [
            'family_info' => array_merge($attributes['family_info'] ?? [], $info),
        ]);
    }
    
    public function married(): static
    {
        return $this->state(fn (array $attributes) => [
            'marital_status' => 'married',
        ]);
    }
    
    public function single(): static
    {
        return $this->state(fn (array $attributes) => [
            'marital_status' => 'single',
        ]);
    }
    
    public function withBirthDate(string $date): static
    {
        return $this->state(fn (array $attributes) => [
            'birth_date' => $date,
        ]);
    }
}






// namespace Database\Factories;

// use Illuminate\Database\Eloquent\Factories\Factory;
// use Illuminate\Support\Str;

// class PersonFactory extends Factory
// {
//     public function definition(): array
//     {
//         $genders = ['M', 'F'];
//         $gender = $this->faker->randomElement($genders);

//         $arabicNamesMale = [
//             'محمد', 'أحمد', 'علي', 'عمر', 'خالد', 'سعد', 'فهد', 'ناصر', 'يوسف', 'طارق',
//             'ماجد', 'بدر', 'سلطان', 'فيصل', 'تركي', 'عبدالله', 'عبدالرحمن', 'عبدالعزيز',
//             'عبداللطيف', 'عبدالمحسن', 'سعود', 'سلمان', 'مساعد', 'مشعل', 'نايف'
//         ];

//         $arabicNamesFemale = [
//             'فاطمة', 'عائشة', 'خديجة', 'سارة', 'نورة', 'لطيفة', 'منيرة', 'مها', 'هناء',
//             'أمل', 'سعاد', 'جميلة', 'مريم', 'زينب', 'روضة', 'شريفة', 'الجوهرة', 'نادية',
//             'حصة', 'الجازي', 'سلوى', 'عبير', 'أريج', 'ضحى', 'ريم'
//         ];

//         $fullNameArabic = $gender === 'M' 
//             ? $this->faker->randomElement($arabicNamesMale) . ' بن ' . $this->faker->randomElement($arabicNamesMale) . ' ' . $this->faker->randomElement(['المسعود', 'الغامدي', 'الحربي', 'القحطاني', 'الشهري'])
//             : $this->faker->randomElement($arabicNamesFemale) . ' بنت ' . $this->faker->randomElement($arabicNamesMale) . ' ' . $this->faker->randomElement(['المسعود', 'الغامدي', 'الحربي', 'القحطاني', 'الشهري']);

//         return [
//             'id' => Str::uuid(),
//             'national_id' => $this->faker->unique()->numerify('1#########'),
//             'full_name_arabic' => $fullNameArabic,
//             'full_name_english' => $this->faker->name($gender === 'M' ? 'male' : 'female'),
//             'nickname' => $this->faker->optional()->firstName(),
//             'gender' => $gender,
//             'birth_date' => $this->faker->dateTimeBetween('-80 years', '-18 years')->format('Y-m-d'),
//             'birth_place' => $this->faker->city(),
//             'death_date' => $this->faker->optional(0.1)->dateTimeBetween('-10 years', 'now')->format('Y-m-d'),
//             'is_alive' => $this->faker->boolean(90),
//             'marital_status' => $this->faker->randomElement(['single', 'married', 'divorced', 'widowed']),
//             'blood_type' => $this->faker->randomElement(['O+', 'A+', 'B+', 'AB+', 'O-', 'A-', 'B-', 'AB-']),
//             'phone_number' => $this->faker->phoneNumber(),
//             'email' => $this->faker->unique()->safeEmail(),
//             'current_address' => $this->faker->address(),
//             'photo_path' => $this->faker->optional()->imageUrl(),
//             'family_info' => [
//                 'father_name' => $this->faker->name('male'),
//                 'mother_name' => $this->faker->name('female'),
//                 'number_of_siblings' => $this->faker->numberBetween(0, 10),
//                 'family_rank' => $this->faker->numberBetween(1, 5),
//             ],
//             'education_info' => [
//                 'level' => $this->faker->randomElement(['high_school', 'diploma', 'bachelor', 'master', 'phd']),
//                 'specialization' => $this->faker->jobTitle(),
//                 'institution' => $this->faker->company(),
//                 'graduation_year' => $this->faker->year(),
//             ],
//             'work_info' => [
//                 'occupation' => $this->faker->jobTitle(),
//                 'company' => $this->faker->company(),
//                 'position' => $this->faker->word(),
//                 'experience_years' => $this->faker->numberBetween(1, 40),
//             ],
//             'additional_info' => [
//                 'hobbies' => $this->faker->words(3),
//                 'languages' => ['Arabic', $this->faker->randomElement(['English', 'French', 'Spanish'])],
//                 'social_status' => $this->faker->randomElement(['middle_class', 'upper_middle', 'wealthy']),
//             ],
//             'created_by' => null,
//             'verified_by' => null,
//             'verified_at' => $this->faker->optional()->dateTime(),
//         ];
//     }

//     public function male(): static
//     {
//         return $this->state(fn (array $attributes) => [
//             'gender' => 'M',
//         ]);
//     }

//     public function female(): static
//     {
//         return $this->state(fn (array $attributes) => [
//             'gender' => 'F',
//         ]);
//     }

//     public function alive(): static
//     {
//         return $this->state(fn (array $attributes) => [
//             'is_alive' => true,
//             'death_date' => null,
//         ]);
//     }

//     public function deceased(): static
//     {
//         return $this->state(fn (array $attributes) => [
//             'is_alive' => false,
//             'death_date' => $this->faker->dateTimeBetween('-10 years', 'now')->format('Y-m-d'),
//         ]);
//     }

//     public function verified(): static
//     {
//         return $this->state(fn (array $attributes) => [
//             'verified_at' => now(),
//             'verified_by' => Str::uuid(),
//         ]);
//     }

//     public function withFamilyInfo(array $info): static
//     {
//         return $this->state(fn (array $attributes) => [
//             'family_info' => array_merge($attributes['family_info'] ?? [], $info),
//         ]);
//     }
// }
