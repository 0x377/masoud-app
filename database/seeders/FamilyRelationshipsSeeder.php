<?php

namespace Database\Seeders;

use App\Models\FamilyRelationship;
use App\Models\Person;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class FamilyRelationshipsSeeder extends Seeder
{
    public function run(): void
    {
        $this->command->info('Seeding family relationships...');
        
        $persons = Person::all();
        $founder = Person::where('national_id', '1000000001')->first();
        $founderWife = Person::where('national_id', '1000000002')->first();
        
        // 1. Founder and his wife (marriage relationship)
        FamilyRelationship::factory()->spouse()->create([
            'person_id' => $founder->id,
            'related_person_id' => $founderWife->id,
            'relationship_type' => 'HUSBAND',
            'relationship_start_date' => '1960-05-15',
            'relationship_details' => [
                'notes' => 'الزواج الأساسي للعائلة',
                'wedding_location' => 'الرياض',
                'wedding_type' => 'تقليدي',
            ],
            'legal_document_number' => 'MAR-1960-001',
            'legal_document_date' => '1960-05-15',
            'is_verified' => true,
            'verified_at' => now(),
            'cultural_context' => [
                'tribal_affiliation' => 'المسعود',
                'marriage_type' => 'تقليدي',
                'dowry_amount' => 50000,
                'dowry_currency' => 'SAR',
            ],
        ]);
        
        // 2. Find first generation children
        $firstGenChildren = Person::whereHas('family_info->family_rank', 2)->get();
        
        // Create parent-child relationships
        foreach ($firstGenChildren as $child) {
            // Father-child relationship
            FamilyRelationship::factory()->parentChild()->create([
                'person_id' => $founder->id,
                'related_person_id' => $child->id,
                'relationship_type' => $child->gender === 'M' ? 'FATHER' : 'FATHER',
                'relationship_start_date' => $child->birth_date,
                'relationship_details' => [
                    'notes' => 'الابن/البنت الأول/ى للعائلة',
                    'birth_order' => array_search($child->id, $firstGenChildren->pluck('id')->toArray()) + 1,
                ],
                'is_verified' => true,
                'verified_at' => now(),
            ]);
            
            // Mother-child relationship
            FamilyRelationship::factory()->parentChild()->create([
                'person_id' => $founderWife->id,
                'related_person_id' => $child->id,
                'relationship_type' => $child->gender === 'M' ? 'MOTHER' : 'MOTHER',
                'relationship_start_date' => $child->birth_date,
                'is_verified' => true,
                'verified_at' => now(),
            ]);
        }
        
        // 3. Create sibling relationships among first generation
        for ($i = 0; $i < count($firstGenChildren); $i++) {
            for ($j = $i + 1; $j < count($firstGenChildren); $j++) {
                $sibling1 = $firstGenChildren[$i];
                $sibling2 = $firstGenChildren[$j];
                
                $relationshipType = $sibling2->gender === 'M' ? 'BROTHER' : 'SISTER';
                
                FamilyRelationship::factory()->siblings()->create([
                    'person_id' => $sibling1->id,
                    'related_person_id' => $sibling2->id,
                    'relationship_type' => $relationshipType,
                    'birth_order' => $i + 1,
                    'relationship_details' => [
                        'birth_order_difference' => abs($i - $j),
                        'shared_childhood' => true,
                    ],
                    'is_verified' => true,
                    'verified_at' => now(),
                ]);
            }
        }
        
        // 4. Create marriages for first generation
        $firstGenMales = $firstGenChildren->where('gender', 'M')->take(3);
        $firstGenFemales = $firstGenChildren->where('gender', 'F')->take(3);
        
        foreach ($firstGenMales as $male) {
            $spouse = Person::factory()->female()->create([
                'marital_status' => 'married',
                'family_info' => [
                    'is_married_into_family' => true,
                    'original_family' => $this->faker->randomElement(['القحطاني', 'الشهري', 'الغامدي']),
                ],
            ]);
            
            FamilyRelationship::factory()->spouse()->create([
                'person_id' => $male->id,
                'related_person_id' => $spouse->id,
                'relationship_type' => 'HUSBAND',
                'relationship_start_date' => $this->faker->dateTimeBetween('-30 years', '-10 years')->format('Y-m-d'),
                'cultural_context' => [
                    'marriage_type' => 'تقليدي',
                    'dowry_amount' => $this->faker->numberBetween(50000, 200000),
                ],
                'is_verified' => true,
            ]);
        }
        
        // 5. Create random relationships for extended family
        $extendedFamily = Person::whereHas('family_info->is_extended_family', true)->get();
        
        foreach ($extendedFamily->take(20) as $person) {
            $relatedPerson = $persons->where('id', '!=', $person->id)->random();
            
            FamilyRelationship::factory()->create([
                'person_id' => $person->id,
                'related_person_id' => $relatedPerson->id,
                'relationship_type' => $this->faker->randomElement(['COUSIN', 'UNCLE', 'AUNT', 'NEPHEW', 'NIECE']),
                'hierarchy_level' => 3,
                'is_verified' => $this->faker->boolean(70),
                'cultural_context' => [
                    'tribal_connection' => $this->faker->randomElement(['من طرف الأب', 'من طرف الأم', 'قرابة بعيدة']),
                    'geographic_proximity' => $this->faker->city(),
                ],
            ]);
        }
        
        // 6. Create some emergency contacts
        FamilyRelationship::whereIn('relationship_type', ['FATHER', 'MOTHER', 'HUSBAND', 'WIFE', 'BROTHER', 'SISTER'])
            ->inRandomOrder()
            ->limit(20)
            ->get()
            ->each(function ($relationship) {
                $relationship->update([
                    'is_emergency_contact' => true,
                    'emergency_contact_priority' => $this->faker->numberBetween(1, 3),
                    'can_view_medical' => true,
                ]);
            });
        
        // 7. Create some financial responsibility relationships
        FamilyRelationship::where('relationship_type', 'FATHER')
            ->orWhere('relationship_type', 'HUSBAND')
            ->inRandomOrder()
            ->limit(15)
            ->get()
            ->each(function ($relationship) {
                $relationship->update([
                    'has_financial_responsibility' => true,
                    'monthly_support_amount' => $this->faker->numberBetween(1000, 5000),
                    'support_frequency' => 'MONTHLY',
                ]);
            });
        
        $this->command->info('✅ Created complex family relationship network');
    }
}
