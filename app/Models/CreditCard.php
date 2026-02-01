<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class CreditCard extends Model
{
    use HasFactory, SoftDeletes;

    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'person_id',
        'card_holder_name',
        'card_number',
        'card_type',
        // ... all other fields
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'is_verified' => 'boolean',
        'three_d_secure_enabled' => 'boolean',
        'allow_recurring' => 'boolean',
        'billing_address' => 'array',
        'security_rules' => 'array',
        'allowed_merchants' => 'array',
        'blocked_categories' => 'array',
        'recurring_settings' => 'array',
        'risk_score_data' => 'array',
        'metadata' => 'array',
    ];

    public function person()
    {
        return $this->belongsTo(Person::class);
    }
}
