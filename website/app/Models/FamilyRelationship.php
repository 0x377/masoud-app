<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
<<<<<<< HEAD

class FamilyRelationship extends Model
{
    use HasFactory;
    
    protected $primaryKey = 'relationship_id';
    protected $keyType = 'string';
    public $incrementing = false;
    
=======
use Illuminate\Database\Eloquent\SoftDeletes;

class FamilyRelationship extends Model
{
    use HasFactory, SoftDeletes;

    protected $keyType = 'string';
    public $incrementing = false;

>>>>>>> 6e447c6 (Init...)
    protected $fillable = [
        'person_id',
        'related_person_id',
        'relationship_type',
<<<<<<< HEAD
        'is_biological',
        'start_date',
        'end_date',
        'notes'
    ];
    
    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'is_biological' => 'boolean'
    ];
    
    // Relationships
=======
        'relationship_subtype',
        // ... all other fields
    ];

    protected $casts = [
        'is_verified' => 'boolean',
        'is_emergency_contact' => 'boolean',
        'is_legal_guardian' => 'boolean',
        'has_financial_responsibility' => 'boolean',
        'relationship_strength' => 'decimal:2',
        'monthly_support_amount' => 'decimal:2',
        'relationship_details' => 'array',
        'cultural_context' => 'array',
        'inheritance_rights' => 'array',
        'communication_preferences' => 'array',
        'guardianship_terms' => 'array',
    ];

>>>>>>> 6e447c6 (Init...)
    public function person()
    {
        return $this->belongsTo(Person::class, 'person_id');
    }
<<<<<<< HEAD
    
=======

>>>>>>> 6e447c6 (Init...)
    public function relatedPerson()
    {
        return $this->belongsTo(Person::class, 'related_person_id');
    }
<<<<<<< HEAD
    
    // Scopes
    public function scopeActive($query)
    {
        return $query->where(function($q) {
            $q->whereNull('end_date')
              ->orWhere('end_date', '>', now());
        });
    }
    
    public function scopeBiological($query)
    {
        return $query->where('is_biological', true);
    }
=======
>>>>>>> 6e447c6 (Init...)
}
