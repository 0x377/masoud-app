<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Person;
use Illuminate\Support\Facades\Hash;
use Faker\Factory as FakerFactory;
use \Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Disable foreign key checks
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        
        // Define tables in correct order (respecting foreign keys)
        $tables = [
            'meeting_attendees',
            'committee_meetings',
            'committee_members',
            'committees',
            'board_members',
            'executive_management',
            'marriage_aid_requests',
            'social_committee_members',
            'donations',
            'credit_cards',
            'family_group_members',
            'family_groups',
            'relationship_change_logs',
            'family_tree_snapshots',
            'family_relationships',
            'users',
            'persons',
        ];
        
        // Only truncate tables that exist
        foreach ($tables as $table) {
            if (Schema::hasTable($table)) {
                DB::table($table)->truncate();
                $this->command->info("Truncated table: {$table}");
            } else {
                $this->command->warn("Table does not exist, skipping: {$table}");
            }
        }
        
        // Enable foreign key checks
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
        
        $this->call([
            PersonsSeeder::class,
            UsersSeeder::class,
            FamilyRelationshipsSeeder::class,
            CommitteesSeeder::class,
            BoardMembersSeeder::class,
            ExecutiveManagementSeeder::class,
            SocialCommitteeSeeder::class,
            DonationsSeeder::class,
            CreditCardsSeeder::class,
            MarriageAidRequestsSeeder::class,
        ]);
        
        $this->command->info('✅ All seeders completed successfully!');
        
        // Display summary (check if models exist first)
        $summary = [];
        
        if (class_exists('\App\Models\Person') && method_exists('\App\Models\Person', 'count')) {
            $summary[] = ['Persons', \App\Models\Person::count()];
        }
        
        if (class_exists('\App\Models\User') && method_exists('\App\Models\User', 'count')) {
            $summary[] = ['Users', \App\Models\User::count()];
        }
        
        if (class_exists('\App\Models\FamilyRelationship') && method_exists('\App\Models\FamilyRelationship', 'count')) {
            $summary[] = ['Family Relationships', \App\Models\FamilyRelationship::count()];
        }
        
        if (class_exists('\App\Models\Donation') && method_exists('\App\Models\Donation', 'count')) {
            $summary[] = ['Donations', \App\Models\Donation::count()];
        }
        
        if (class_exists('\App\Models\Committee') && method_exists('\App\Models\Committee', 'count')) {
            $summary[] = ['Committees', \App\Models\Committee::count()];
        }
        
        if (!empty($summary)) {
            $this->table(['Model', 'Count'], $summary);
        }
    }
}
