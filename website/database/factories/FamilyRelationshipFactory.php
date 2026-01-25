<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;
use \App\Models\Person;

class FamilyRelationshipFactory extends Factory
{
    public function definition(): array
    {
        $person1 = Person::inRandomOrder()->first() ?? 
                  Person::factory()->create();
        $person2 = Person::inRandomOrder()->where('id', '!=', $person1->id)->first() ?? 
                  Person::factory()->create();

        $relationshipTypes = [
            'FATHER', 'MOTHER', 'SON', 'DAUGHTER', 'BROTHER', 'SISTER',
            'HUSBAND', 'WIFE', 'GRANDFATHER', 'GRANDMOTHER', 'GRANDSON',
            'GRANDDAUGHTER', 'UNCLE', 'AUNT', 'NEPHEW', 'NIECE', 'COUSIN',
        ];

        $relationshipType = $this->faker->randomElement($relationshipTypes);

        // Set hierarchy based on relationship type
        $hierarchy = in_array($relationshipType, ['FATHER', 'MOTHER', 'SON', 'DAUGHTER', 'HUSBAND', 'WIFE', 'BROTHER', 'SISTER']) ? 1 : 2;

        return [
            'id' => Str::uuid(),
            'person_id' => $person1->id,
            'related_person_id' => $person2->id,
            'relationship_type' => $relationshipType,
            'relationship_subtype' => $this->faker->randomElement(['BIOLOGICAL', 'ADOPTIVE', 'STEP']),
            'hierarchy_level' => $hierarchy,
            'birth_order' => $this->faker->optional()->numberBetween(1, 10),
            'is_primary_relationship' => true,
            'relationship_details' => [
                'notes' => $this->faker->optional()->sentence(),
                'closeness_level' => $this->faker->numberBetween(1, 10),
                'contact_frequency' => $this->faker->randomElement(['daily', 'weekly', 'monthly', 'yearly']),
            ],
            'relationship_strength' => $this->faker->randomFloat(2, 0.5, 1.0),
            'relationship_start_date' => $this->faker->dateTimeBetween('-30 years', 'now')->format('Y-m-d'),
            'relationship_end_date' => $this->faker->optional(0.1)->dateTimeBetween('-5 years', 'now')->format('Y-m-d'),
            'end_reason' => $this->faker->optional()->randomElement(['death', 'divorce', 'estrangement']),
            'legal_document_path' => $this->faker->optional()->url(),
            'legal_document_number' => $this->faker->optional()->bothify('DOC-#####'),
            'legal_document_date' => $this->faker->optional()->date(),
            'is_verified' => $this->faker->boolean(80),
            'verified_at' => $this->faker->optional()->dateTime(),
            'verified_by' => $this->faker->optional()->uuid(),
            'verification_notes' => $this->faker->optional()->sentence(),
            'status' => 'ACTIVE',
            'cultural_context' => [
                'tribal_affiliation' => $this->faker->optional()->word(),
                'family_branch' => $this->faker->optional()->word(),
                'customary_rules' => $this->faker->optional()->words(3),
            ],
            'inheritance_rights' => [
                'share' => $this->faker->randomFloat(2, 0, 1),
                'conditions' => $this->faker->optional()->sentence(),
            ],
            'can_contact' => true,
            'can_view_profile' => true,
            'can_view_financial' => $this->faker->boolean(30),
            'can_view_medical' => $this->faker->boolean(20),
            'communication_preferences' => [
                'preferred_method' => $this->faker->randomElement(['phone', 'email', 'whatsapp']),
                'contact_times' => $this->faker->randomElement(['morning', 'afternoon', 'evening']),
            ],
            'is_emergency_contact' => $this->faker->boolean(30),
            'emergency_contact_priority' => $this->faker->optional()->numberBetween(1, 3),
            'has_financial_responsibility' => $this->faker->boolean(20),
            'monthly_support_amount' => $this->faker->optional()->randomFloat(2, 100, 5000),
            'support_currency' => 'SAR',
            'support_frequency' => $this->faker->optional()->randomElement(['MONTHLY', 'QUARTERLY', 'YEARLY']),
            'is_legal_guardian' => $this->faker->boolean(10),
            'guardianship_start_date' => $this->faker->optional()->date(),
            'guardianship_end_date' => $this->faker->optional()->date(),
            'guardianship_terms' => $this->faker->optional()->paragraph(),
            'created_by' => $this->faker->optional()->uuid(),
            'updated_by' => $this->faker->optional()->uuid(),
        ];
    }

    public function parentChild(): static
    {
        return $this->state(function (array $attributes) {
            $parent = \App\Models\Person::factory()->create(['birth_date' => $this->faker->dateTimeBetween('-60 years', '-30 years')]);
            $child = \App\Models\Person::factory()->create(['birth_date' => $this->faker->dateTimeBetween('-30 years', '-10 years')]);
            
            $relationshipType = $parent->gender === 'M' ? 'FATHER' : 'MOTHER';
            $childRelationshipType = $child->gender === 'M' ? 'SON' : 'DAUGHTER';
            
            return [
                'person_id' => $parent->id,
                'related_person_id' => $child->id,
                'relationship_type' => $relationshipType,
                'hierarchy_level' => 1,
                'relationship_subtype' => 'BIOLOGICAL',
                'is_legal_guardian' => true,
                'has_financial_responsibility' => true,
            ];
        });
    }

    public function spouse(): static
    {
        return $this->state(function (array $attributes) {
            $husband = \App\Models\Person::factory()->male()->create();
            $wife = \App\Models\Person::factory()->female()->create();
            
            return [
                'person_id' => $husband->id,
                'related_person_id' => $wife->id,
                'relationship_type' => 'HUSBAND',
                'hierarchy_level' => 1,
                'relationship_subtype' => 'MARITAL',
                'relationship_start_date' => $this->faker->dateTimeBetween('-20 years', '-1 year')->format('Y-m-d'),
                'is_emergency_contact' => true,
                'can_view_financial' => true,
                'can_view_medical' => true,
            ];
        });
    }

    public function siblings(): static
    {
        return $this->state(function (array $attributes) {
            $sibling1 = \App\Models\Person::factory()->create();
            $sibling2 = \App\Models\Person::factory()->create();
            
            $relationshipType = $sibling2->gender === 'M' ? 'BROTHER' : 'SISTER';
            
            return [
                'person_id' => $sibling1->id,
                'related_person_id' => $sibling2->id,
                'relationship_type' => $relationshipType,
                'hierarchy_level' => 1,
                'relationship_subtype' => 'BIOLOGICAL',
                'birth_order' => $this->faker->numberBetween(1, 5),
            ];
        });
    }

    public function verified(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_verified' => true,
            'verified_at' => now(),
            'verified_by' => Str::uuid(),
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'INACTIVE',
            'relationship_end_date' => $this->faker->dateTimeBetween('-5 years', 'now')->format('Y-m-d'),
            'end_reason' => $this->faker->randomElement(['death', 'divorce', 'estrangement']),
        ]);
    }
}
