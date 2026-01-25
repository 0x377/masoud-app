<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Casts\Attribute;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $keyType = 'string';
    public $incrementing = false;
    
    protected $fillable = [
        'id',
        'national_id',
        'full_name_arabic',
<<<<<<< HEAD
        // 'full_name_english',
=======
        'full_name_english',
>>>>>>> 6e447c6 (Init...)
        'email',
        'password',
        'gender',
        'birth_date',
        'phone_number',
        'user_type',
        'is_active'
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'birth_date' => 'date',
        'is_active' => 'boolean'
    ];

    // Relationships
    public function person()
    {
        return $this->hasOne(Person::class, 'national_id', 'national_id');
    }

    public function boardMember()
    {
        return $this->hasOne(BoardMember::class);
    }

    public function executiveCommittee()
    {
        return $this->hasOne(ExecutiveCommittee::class);
    }

    // Scopes
    public function scopeBoardMembers($query)
    {
        return $query->where('user_type', 'BOARD_MEMBER');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    // Attributes
    protected function fullName(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->full_name_arabic,
        );
    }

    // Check permissions based on user type
    public function canAccessDonationPlatform()
    {
        return in_array($this->user_type, ['FAMILY_MEMBER', 'SUPER_ADMIN']);
    }

    public function canAccessBoardSection()
    {
        return in_array($this->user_type, ['BOARD_MEMBER', 'SUPER_ADMIN']);
    }

    public function canAccessFamilyArchive()
    {
        return in_array($this->user_type, ['FAMILY_MEMBER', 'SUPER_ADMIN']);
    }
}
