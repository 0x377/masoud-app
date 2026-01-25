<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
<<<<<<< HEAD
use Illuminate\Database\Eloquent\Relations\HasMany;

class Person extends Model
{
    use HasFactory;
    
    protected $primaryKey = 'person_id';
    protected $keyType = 'string';
    public $incrementing = false;
    
    protected $fillable = [
        'person_id',
        'national_id',
        'full_name_arabic',
        // 'full_name_english',
=======
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;

class Person extends Model
{
    use HasFactory, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'persons'; // ADD THIS LINE

    /**
     * The primary key for the model.
     *
     * @var string
     */
    protected $primaryKey = 'id';

    /**
     * The "type" of the primary key ID.
     *
     * @var string
     */
    protected $keyType = 'string';

    /**
     * Indicates if the IDs are auto-incrementing.
     *
     * @var bool
     */
    public $incrementing = false;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'national_id',
        'full_name_arabic',
        'full_name_english',
        'nickname',
>>>>>>> 6e447c6 (Init...)
        'gender',
        'birth_date',
        'birth_place',
        'death_date',
        'is_alive',
<<<<<<< HEAD
=======
        'marital_status',
>>>>>>> 6e447c6 (Init...)
        'blood_type',
        'phone_number',
        'email',
        'current_address',
        'photo_path',
<<<<<<< HEAD
        'additional_info'
    ];
    
=======
        'family_info',
        'education_info',
        'work_info',
        'additional_info',
        'created_by',
        'verified_by',
        'verified_at',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
>>>>>>> 6e447c6 (Init...)
    protected $casts = [
        'birth_date' => 'date',
        'death_date' => 'date',
        'is_alive' => 'boolean',
<<<<<<< HEAD
        'additional_info' => 'array'
    ];
    
    // Relationships
    public function user()
    {
        return $this->belongsTo(User::class, 'national_id', 'national_id');
    }
    
=======
        'verified_at' => 'datetime',
        'family_info' => 'array',
        'education_info' => 'array',
        'work_info' => 'array',
        'additional_info' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    /**
     * The accessors to append to the model's array form.
     *
     * @var array<int, string>
     */
    protected $appends = [
        'age',
        'full_name',
        'display_name',
        'photo_url',
        'is_verified',
        'life_status',
        'generation_label',
    ];

    /**
     * Boot the model.
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = (string) \Illuminate\Support\Str::uuid();
            }
            
            // Auto-generate email if not provided
            if (empty($model->email) && !empty($model->full_name_english)) {
                $nameSlug = strtolower(str_replace(' ', '.', $model->full_name_english));
                $model->email = $nameSlug . '@family.masoud';
            }
            
            // Set is_alive based on death_date
            if (is_null($model->death_date)) {
                $model->is_alive = true;
            }
        });

        static::updating(function ($model) {
            // Update is_alive if death_date changes
            if ($model->isDirty('death_date')) {
                $model->is_alive = is_null($model->death_date);
            }
        });
    }

    /**
     * Get the person's age.
     */
    protected function age(): Attribute
    {
        return Attribute::make(
            get: function () {
                if (!$this->birth_date) {
                    return null;
                }
                
                if ($this->death_date) {
                    return Carbon::parse($this->birth_date)->diffInYears($this->death_date);
                }
                
                return Carbon::parse($this->birth_date)->age;
            }
        );
    }

    /**
     * Get the person's full name (prefers Arabic, falls back to English).
     */
    protected function fullName(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->full_name_arabic ?: $this->full_name_english
        );
    }

    /**
     * Get the display name (nickname if available, otherwise full name).
     */
    protected function displayName(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->nickname ?: $this->full_name
        );
    }

    /**
     * Get the photo URL.
     */
    protected function photoUrl(): Attribute
    {
        return Attribute::make(
            get: function () {
                if (!$this->photo_path) {
                    // Return default avatar based on gender
                    return $this->gender === 'F' 
                        ? 'https://ui-avatars.com/api/?name=' . urlencode($this->full_name_arabic) . '&background=FCE4EC&color=D81B60'
                        : 'https://ui-avatars.com/api/?name=' . urlencode($this->full_name_arabic) . '&background=E3F2FD&color=1E88E5';
                }
                
                if (filter_var($this->photo_path, FILTER_VALIDATE_URL)) {
                    return $this->photo_path;
                }
                
                return Storage::url($this->photo_path);
            }
        );
    }

    /**
     * Check if the person is verified.
     */
    protected function isVerified(): Attribute
    {
        return Attribute::make(
            get: fn () => !is_null($this->verified_at)
        );
    }

    /**
     * Get life status description.
     */
    protected function lifeStatus(): Attribute
    {
        return Attribute::make(
            get: function () {
                if (!$this->is_alive && $this->death_date) {
                    return 'متوفى/ى - ' . $this->death_date->translatedFormat('j F Y');
                }
                
                return $this->is_alive ? 'على قيد الحياة' : 'غير معروف';
            }
        );
    }

    /**
     * Get generation label.
     */
    protected function generationLabel(): Attribute
    {
        return Attribute::make(
            get: function () {
                if (!$this->birth_date) {
                    return 'غير معروف';
                }
                
                $birthYear = $this->birth_date->year;
                
                if ($birthYear < 1940) return 'الجيل المؤسس';
                if ($birthYear >= 1940 && $birthYear < 1960) return 'الجيل الأول';
                if ($birthYear >= 1960 && $birthYear < 1980) return 'الجيل الثاني';
                if ($birthYear >= 1980 && $birthYear < 2000) return 'الجيل الثالث';
                return 'الجيل الرابع+';
            }
        );
    }

    /**
     * Scope a query to only include males.
     */
    public function scopeMale($query)
    {
        return $query->where('gender', 'M');
    }

    /**
     * Scope a query to only include females.
     */
    public function scopeFemale($query)
    {
        return $query->where('gender', 'F');
    }

    /**
     * Scope a query to only include alive persons.
     */
    public function scopeAlive($query)
    {
        return $query->where('is_alive', true);
    }

    /**
     * Scope a query to only include deceased persons.
     */
    public function scopeDeceased($query)
    {
        return $query->where('is_alive', false);
    }

    /**
     * Scope a query to only include verified persons.
     */
    public function scopeVerified($query)
    {
        return $query->whereNotNull('verified_at');
    }

    /**
     * Scope a query to only include unverified persons.
     */
    public function scopeUnverified($query)
    {
        return $query->whereNull('verified_at');
    }

    /**
     * Scope a query to only include adults (18+ years).
     */
    public function scopeAdults($query)
    {
        return $query->where('birth_date', '<=', now()->subYears(18));
    }

    /**
     * Scope a query to only include minors (< 18 years).
     */
    public function scopeMinors($query)
    {
        return $query->where('birth_date', '>', now()->subYears(18));
    }

    /**
     * Scope a query to order by birth date (oldest first).
     */
    public function scopeOldestFirst($query)
    {
        return $query->orderBy('birth_date', 'asc');
    }

    /**
     * Scope a query to order by birth date (youngest first).
     */
    public function scopeYoungestFirst($query)
    {
        return $query->orderBy('birth_date', 'desc');
    }

    /**
     * Scope a query to search by name or national ID.
     */
    public function scopeSearch($query, $search)
    {
        return $query->where(function ($q) use ($search) {
            $q->where('full_name_arabic', 'LIKE', "%{$search}%")
              ->orWhere('full_name_english', 'LIKE', "%{$search}%")
              ->orWhere('nickname', 'LIKE', "%{$search}%")
              ->orWhere('national_id', 'LIKE', "%{$search}%")
              ->orWhere('phone_number', 'LIKE', "%{$search}%")
              ->orWhere('email', 'LIKE', "%{$search}%");
        });
    }

    /**
     * Scope a query to filter by marital status.
     */
    public function scopeMaritalStatus($query, $status)
    {
        return $query->where('marital_status', $status);
    }

    /**
     * Scope a query to filter by blood type.
     */
    public function scopeBloodType($query, $type)
    {
        return $query->where('blood_type', $type);
    }

    /**
     * Get the user associated with the person.
     */
    public function user(): HasOne
    {
        return $this->hasOne(User::class, 'person_id');
    }

    /**
     * Get the person's relationships where they are the primary person.
     */
>>>>>>> 6e447c6 (Init...)
    public function relationships(): HasMany
    {
        return $this->hasMany(FamilyRelationship::class, 'person_id');
    }
<<<<<<< HEAD
    
=======

    /**
     * Get the person's relationships where they are the related person.
     */
>>>>>>> 6e447c6 (Init...)
    public function relatedRelationships(): HasMany
    {
        return $this->hasMany(FamilyRelationship::class, 'related_person_id');
    }
<<<<<<< HEAD
    
    public function marriagesAsHusband(): HasMany
    {
        return $this->hasMany(Marriage::class, 'husband_id');
    }
    
    public function marriagesAsWife(): HasMany
    {
        return $this->hasMany(Marriage::class, 'wife_id');
    }
    
    // Helper methods
    public function getFullNameAttribute()
    {
        return $this->full_name_arabic;
    }
    
    public function getAgeAttribute()
    {
        if (!$this->birth_date) return null;
        
        $birthDate = $this->birth_date;
        $currentDate = $this->is_alive ? now() : $this->death_date;
        
        return $birthDate->diffInYears($currentDate);
    }
    
    public function getParents()
    {
        return $this->relationships()
            ->whereIn('relationship_type', ['FATHER', 'MOTHER'])
            ->with('relatedPerson')
            ->get();
    }
    
    public function getChildren()
    {
        return $this->relatedRelationships()
            ->whereIn('relationship_type', ['SON', 'DAUGHTER'])
            ->with('person')
            ->get();
    }
    
    public function getSpouse()
    {
        if ($this->gender === 'M') {
            return $this->marriagesAsHusband()
                ->where('status', 'ACTIVE')
                ->with('wife')
                ->first();
        } else {
            return $this->marriagesAsWife()
                ->where('status', 'ACTIVE')
                ->with('husband')
                ->first();
        }
=======

    /**
     * Get all relationships for this person (both as primary and related).
     */
    public function allRelationships()
    {
        return FamilyRelationship::where('person_id', $this->id)
            ->orWhere('related_person_id', $this->id)
            ->where('status', 'ACTIVE')
            ->get();
    }

    /**
     * Get the person's parents.
     */
    public function parents()
    {
        return $this->relationships()
            ->whereIn('relationship_type', ['FATHER', 'MOTHER'])
            ->where('status', 'ACTIVE')
            ->get()
            ->map(function ($relationship) {
                return $relationship->relatedPerson;
            });
    }

    /**
     * Get the person's father.
     */
    public function father()
    {
        $relationship = $this->relationships()
            ->where('relationship_type', 'FATHER')
            ->where('status', 'ACTIVE')
            ->first();
        
        return $relationship ? $relationship->relatedPerson : null;
    }

    /**
     * Get the person's mother.
     */
    public function mother()
    {
        $relationship = $this->relationships()
            ->where('relationship_type', 'MOTHER')
            ->where('status', 'ACTIVE')
            ->first();
        
        return $relationship ? $relationship->relatedPerson : null;
    }

    /**
     * Get the person's children.
     */
    public function children()
    {
        return $this->relatedRelationships()
            ->whereIn('relationship_type', ['SON', 'DAUGHTER'])
            ->where('status', 'ACTIVE')
            ->get()
            ->map(function ($relationship) {
                return $relationship->person;
            });
    }

    /**
     * Get the person's sons.
     */
    public function sons()
    {
        return $this->relatedRelationships()
            ->where('relationship_type', 'SON')
            ->where('status', 'ACTIVE')
            ->get()
            ->map(function ($relationship) {
                return $relationship->person;
            });
    }

    /**
     * Get the person's daughters.
     */
    public function daughters()
    {
        return $this->relatedRelationships()
            ->where('relationship_type', 'DAUGHTER')
            ->where('status', 'ACTIVE')
            ->get()
            ->map(function ($relationship) {
                return $relationship->person;
            });
    }

    /**
     * Get the person's spouse.
     */
    public function spouse()
    {
        $relationship = $this->relationships()
            ->whereIn('relationship_type', ['HUSBAND', 'WIFE'])
            ->where('status', 'ACTIVE')
            ->first();
        
        return $relationship ? $relationship->relatedPerson : null;
    }

    /**
     * Get the person's siblings.
     */
    public function siblings()
    {
        // Get parents first
        $parents = $this->parents();
        
        if ($parents->isEmpty()) {
            return collect();
        }
        
        // Get all children of the same parents
        $siblingIds = [];
        foreach ($parents as $parent) {
            $siblingIds = array_merge(
                $siblingIds,
                $parent->children()->where('id', '!=', $this->id)->pluck('id')->toArray()
            );
        }
        
        return Person::whereIn('id', array_unique($siblingIds))->get();
    }

    /**
     * Get the person's brothers.
     */
    public function brothers()
    {
        return $this->siblings()->where('gender', 'M');
    }

    /**
     * Get the person's sisters.
     */
    public function sisters()
    {
        return $this->siblings()->where('gender', 'F');
    }

    /**
     * Get the person's emergency contacts.
     */
    public function emergencyContacts()
    {
        return $this->relationships()
            ->where('is_emergency_contact', true)
            ->where('status', 'ACTIVE')
            ->orderBy('emergency_contact_priority')
            ->get()
            ->map(function ($relationship) {
                return [
                    'person' => $relationship->relatedPerson,
                    'priority' => $relationship->emergency_contact_priority,
                    'relationship' => $relationship->relationship_type,
                ];
            });
    }

    /**
     * Get the person's credit cards.
     */
    public function creditCards(): HasMany
    {
        return $this->hasMany(CreditCard::class, 'person_id');
    }

    /**
     * Get the person's active credit card.
     */
    public function activeCreditCard()
    {
        return $this->creditCards()
            ->where('status', 'ACTIVE')
            ->where('is_default', true)
            ->first();
    }

    /**
     * Get the person's donations.
     */
    public function donations()
    {
        return $this->hasManyThrough(
            Donation::class,
            User::class,
            'person_id', // Foreign key on User table
            'donor_user_id', // Foreign key on Donation table
            'id', // Local key on Person table
            'id' // Local key on User table
        );
    }

    /**
     * Get the person's total donations amount.
     */
    public function getTotalDonationsAttribute()
    {
        return $this->donations()->sum('amount');
    }

    /**
     * Get the person's marriage aid requests.
     */
    public function marriageAidRequests(): HasMany
    {
        return $this->hasMany(MarriageAidRequest::class, 'applicant_id');
    }

    /**
     * Get the person's family aid requests.
     */
    public function familyAidRequests(): HasMany
    {
        return $this->hasMany(FamilyAidRequest::class, 'applicant_id');
    }

    /**
     * Get the person's committee memberships.
     */
    public function committeeMemberships()
    {
        return $this->hasManyThrough(
            CommitteeMember::class,
            User::class,
            'person_id',
            'user_id',
            'id',
            'id'
        );
    }

    /**
     * Get the person's board memberships.
     */
    public function boardMemberships(): HasMany
    {
        return $this->hasMany(BoardMember::class, 'person_id');
    }

    /**
     * Get the person's executive positions.
     */
    public function executivePositions(): HasMany
    {
        return $this->hasMany(ExecutiveManagement::class, 'person_id');
    }

    /**
     * Get the person's current board position.
     */
    public function currentBoardPosition()
    {
        return $this->boardMemberships()
            ->where('is_current', true)
            ->where('status', 'ACTIVE')
            ->first();
    }

    /**
     * Get the person's current executive position.
     */
    public function currentExecutivePosition()
    {
        return $this->executivePositions()
            ->where('status', 'ACTIVE')
            ->first();
    }

    /**
     * Get the person's family groups.
     */
    public function familyGroups(): BelongsToMany
    {
        return $this->belongsToMany(
            FamilyGroup::class,
            'family_group_members',
            'person_id',
            'group_id'
        )->withPivot('role', 'joined_date', 'is_active')
         ->withTimestamps();
    }

    /**
     * Check if person has user account.
     */
    public function hasUserAccount(): bool
    {
        return !is_null($this->user);
    }

    /**
     * Check if person is a board member.
     */
    public function isBoardMember(): bool
    {
        return $this->boardMemberships()->where('is_current', true)->exists();
    }

    /**
     * Check if person is an executive.
     */
    public function isExecutive(): bool
    {
        return $this->executivePositions()->where('status', 'ACTIVE')->exists();
    }

    /**
     * Check if person is a committee member.
     */
    public function isCommitteeMember($committeeType = null): bool
    {
        $query = $this->committeeMemberships()->whereHas('committee', function ($q) {
            $q->where('status', 'ACTIVE');
        });

        if ($committeeType) {
            $query->whereHas('committee', function ($q) use ($committeeType) {
                $q->where('committee_type', $committeeType);
            });
        }

        return $query->exists();
    }

    /**
     * Verify the person.
     */
    public function verify($verifiedBy = null): bool
    {
        return $this->update([
            'verified_at' => now(),
            'verified_by' => $verifiedBy,
        ]);
    }

    /**
     * Unverify the person.
     */
    public function unverify(): bool
    {
        return $this->update([
            'verified_at' => null,
            'verified_by' => null,
        ]);
    }

    /**
     * Mark person as deceased.
     */
    public function markAsDeceased($deathDate = null, $reason = null): bool
    {
        $updates = [
            'is_alive' => false,
            'death_date' => $deathDate ?: now(),
        ];

        if ($reason) {
            $additionalInfo = $this->additional_info ?? [];
            $additionalInfo['death_reason'] = $reason;
            $updates['additional_info'] = $additionalInfo;
        }

        return $this->update($updates);
    }

    /**
     * Update family info.
     */
    public function updateFamilyInfo(array $info): bool
    {
        $currentInfo = $this->family_info ?? [];
        $updatedInfo = array_merge($currentInfo, $info);
        
        return $this->update(['family_info' => $updatedInfo]);
    }

    /**
     * Update education info.
     */
    public function updateEducationInfo(array $info): bool
    {
        $currentInfo = $this->education_info ?? [];
        $updatedInfo = array_merge($currentInfo, $info);
        
        return $this->update(['education_info' => $updatedInfo]);
    }

    /**
     * Update work info.
     */
    public function updateWorkInfo(array $info): bool
    {
        $currentInfo = $this->work_info ?? [];
        $updatedInfo = array_merge($currentInfo, $info);
        
        return $this->update(['work_info' => $updatedInfo]);
    }

    /**
     * Update additional info.
     */
    public function updateAdditionalInfo(array $info): bool
    {
        $currentInfo = $this->additional_info ?? [];
        $updatedInfo = array_merge($currentInfo, $info);
        
        return $this->update(['additional_info' => $updatedInfo]);
    }

    /**
     * Get person's family tree (ancestors).
     */
    public function getAncestors($depth = 3, $currentDepth = 0)
    {
        if ($currentDepth >= $depth) {
            return collect();
        }

        $ancestors = collect();
        $parents = $this->parents();

        foreach ($parents as $parent) {
            $ancestors->push([
                'person' => $parent,
                'depth' => $currentDepth + 1,
                'relationship' => $parent->gender === 'M' ? 'الأب' : 'الأم',
                'children' => $this->getAncestors($depth, $currentDepth + 1),
            ]);
        }

        return $ancestors;
    }

    /**
     * Get person's family tree (descendants).
     */
    public function getDescendants($depth = 3, $currentDepth = 0)
    {
        if ($currentDepth >= $depth) {
            return collect();
        }

        $descendants = collect();
        $children = $this->children();

        foreach ($children as $child) {
            $descendants->push([
                'person' => $child,
                'depth' => $currentDepth + 1,
                'relationship' => $child->gender === 'M' ? 'الابن' : 'البنت',
                'children' => $child->getDescendants($depth, $currentDepth + 1),
            ]);
        }

        return $descendants;
    }

    /**
     * Get person's complete family tree.
     */
    public function getFamilyTree($ancestorDepth = 2, $descendantDepth = 3)
    {
        return [
            'person' => $this,
            'ancestors' => $this->getAncestors($ancestorDepth),
            'descendants' => $this->getDescendants($descendantDepth),
            'spouse' => $this->spouse(),
            'siblings' => $this->siblings(),
        ];
    }

    /**
     * Calculate inheritance shares according to Islamic law (simplified).
     */
    public function calculateInheritanceShares($estateValue)
    {
        $shares = [];
        
        // Get heirs
        $heirs = collect();
        
        // Spouse
        if ($spouse = $this->spouse()) {
            $share = $this->gender === 'M' ? 0.25 : 0.125; // Wife gets 1/4, husband gets 1/2
            $heirs->push(['person' => $spouse, 'relationship' => 'spouse', 'share' => $share]);
        }
        
        // Children
        $children = $this->children();
        if ($children->isNotEmpty()) {
            $totalChildren = $children->count();
            $sons = $children->where('gender', 'M')->count();
            $daughters = $children->where('gender', 'F')->count();
            
            // Each son gets double the share of each daughter
            $sonShare = 2;
            $daughterShare = 1;
            $totalShares = ($sons * $sonShare) + ($daughters * $daughterShare);
            
            foreach ($children as $child) {
                $share = $child->gender === 'M' ? $sonShare / $totalShares : $daughterShare / $totalShares;
                $heirs->push(['person' => $child, 'relationship' => 'child', 'share' => $share]);
            }
        }
        
        // Parents
        $parents = $this->parents();
        foreach ($parents as $parent) {
            $share = $children->isNotEmpty() ? 0.1667 : 0.3333; // 1/6 if children exist, 1/3 if not
            $heirs->push(['person' => $parent, 'relationship' => 'parent', 'share' => $share]);
        }
        
        // Calculate actual amounts
        $totalDistributed = 0;
        foreach ($heirs as &$heir) {
            $heir['amount'] = $estateValue * $heir['share'];
            $totalDistributed += $heir['amount'];
        }
        
        return [
            'heirs' => $heirs,
            'estate_value' => $estateValue,
            'total_distributed' => $totalDistributed,
            'remaining' => $estateValue - $totalDistributed,
        ];
    }

    /**
     * Get person's statistics.
     */
    public function getStatistics()
    {
        return [
            'basic_info' => [
                'age' => $this->age,
                'life_status' => $this->life_status,
                'generation' => $this->generation_label,
                'marital_status' => $this->marital_status,
            ],
            'family_stats' => [
                'parents_count' => $this->parents()->count(),
                'children_count' => $this->children()->count(),
                'siblings_count' => $this->siblings()->count(),
                'grandchildren_count' => $this->getDescendants(2)->count(),
            ],
            'financial_stats' => [
                'total_donations' => $this->total_donations,
                'donation_count' => $this->donations()->count(),
                'credit_cards_count' => $this->creditCards()->count(),
                'aid_requests_count' => $this->marriageAidRequests()->count() + $this->familyAidRequests()->count(),
            ],
            'positions_stats' => [
                'is_board_member' => $this->isBoardMember(),
                'is_executive' => $this->isExecutive(),
                'committee_memberships' => $this->committeeMemberships()->count(),
                'family_groups' => $this->familyGroups()->count(),
            ],
        ];
    }

    /**
     * Export person's data as array.
     */
    public function toExportArray(): array
    {
        return [
            'basic_info' => [
                'id' => $this->id,
                'national_id' => $this->national_id,
                'full_name_arabic' => $this->full_name_arabic,
                'full_name_english' => $this->full_name_english,
                'nickname' => $this->nickname,
                'gender' => $this->gender === 'M' ? 'ذكر' : 'أنثى',
                'birth_date' => $this->birth_date?->format('Y-m-d'),
                'birth_place' => $this->birth_place,
                'death_date' => $this->death_date?->format('Y-m-d'),
                'is_alive' => $this->is_alive ? 'نعم' : 'لا',
                'marital_status' => $this->marital_status,
                'blood_type' => $this->blood_type,
                'phone_number' => $this->phone_number,
                'email' => $this->email,
                'current_address' => $this->current_address,
                'is_verified' => $this->is_verified ? 'نعم' : 'لا',
                'verified_at' => $this->verified_at?->format('Y-m-d H:i:s'),
            ],
            'family_info' => $this->family_info,
            'education_info' => $this->education_info,
            'work_info' => $this->work_info,
            'additional_info' => $this->additional_info,
            'relationships' => $this->allRelationships()->map(function ($relationship) {
                return [
                    'related_person' => $relationship->relatedPerson->full_name_arabic,
                    'relationship_type' => $relationship->relationship_type,
                    'relationship_subtype' => $relationship->relationship_subtype,
                    'status' => $relationship->status,
                ];
            }),
            'created_at' => $this->created_at->format('Y-m-d H:i:s'),
            'updated_at' => $this->updated_at->format('Y-m-d H:i:s'),
        ];
    }

    /**
     * Get validation rules for creating/updating a person.
     */
    public static function getValidationRules($personId = null): array
    {
        $rules = [
            'national_id' => ['required', 'string', 'size:10', 'unique:persons,national_id,' . $personId],
            'full_name_arabic' => ['required', 'string', 'max:255'],
            'full_name_english' => ['nullable', 'string', 'max:255'],
            'nickname' => ['nullable', 'string', 'max:100'],
            'gender' => ['required', 'in:M,F'],
            'birth_date' => ['required', 'date', 'before:today'],
            'birth_place' => ['nullable', 'string', 'max:100'],
            'death_date' => ['nullable', 'date', 'after:birth_date', 'before_or_equal:today'],
            'marital_status' => ['required', 'in:single,married,divorced,widowed'],
            'blood_type' => ['nullable', 'string', 'max:5'],
            'phone_number' => ['required', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:255', 'unique:persons,email,' . $personId],
            'current_address' => ['nullable', 'string'],
            'photo_path' => ['nullable', 'string', 'max:500'],
            'family_info' => ['nullable', 'array'],
            'education_info' => ['nullable', 'array'],
            'work_info' => ['nullable', 'array'],
            'additional_info' => ['nullable', 'array'],
        ];

        return $rules;
>>>>>>> 6e447c6 (Init...)
    }
}
