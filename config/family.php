<?php

return [
    'donation_platform' => [
        'enabled' => env('ENABLE_DONATION_PLATFORM', true),
        'min_amount' => 50,
        'max_amount' => 100000,
        'default_currency' => 'SAR',
    ],
    
    'committees' => [
        'board_members_count' => 7,
        'social_committee_members_count' => 5,
        'cultural_committee_members_count' => 4,
        'sports_committee_members_count' => 6,
    ],
    
    'marriage_aid' => [
        'first_marriage_amount' => 20000,
        'marriage_course_required' => true,
        'max_age_for_aid' => 35,
    ],
    
    'family_aid' => [
        'monthly_amount' => 3000,
        'max_duration_months' => 6,
    ],
    
    'archive' => [
        'max_file_size_mb' => 20,
        'allowed_file_types' => ['pdf', 'jpg', 'png', 'doc', 'docx'],
        'meeting_minutes_required' => true,
    ],
];
