<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    public function up()
    {
        // Board Members (الخانة الثانية)
        Schema::create('board_members', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('person_id');
            $table->uuid('user_id');
            $table->string('position');
            $table->integer('term_start_year');
            $table->integer('term_end_year')->nullable();
            $table->boolean('is_current')->default(true);
            $table->json('responsibilities')->nullable();
            $table->timestamps();
            
            $table->foreign('person_id')->references('person_id')->on('persons');
            $table->foreign('user_id')->references('id')->on('users');
            
            $table->index(['is_current', 'position']);
        });

        // Social Committee (اللجنة الاجتماعية - الخانة السابعة)
        Schema::create('social_committee_members', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('person_id');
            $table->uuid('user_id');
            $table->enum('aid_type', ['MARRIAGE_AID', 'FAMILY_AID', 'EDUCATION_AID', 'HEALTH_AID']);
            $table->json('aid_conditions')->nullable(); // شروط الإعانة
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->foreign('person_id')->references('person_id')->on('persons');
            $table->foreign('user_id')->references('id')->on('users');
            
            $table->index(['aid_type', 'is_active']);
        });

        // Marriage Aid Requests (طلبات إعانة الزواج)
        Schema::create('marriage_aid_requests', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('applicant_id'); // Person ID
            $table->uuid('user_id'); // User ID
            $table->enum('status', ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED'])->default('PENDING');
            $table->decimal('requested_amount', 15, 2);
            $table->decimal('approved_amount', 15, 2)->nullable();
            $table->date('marriage_date');
            $table->string('marriage_course_certificate')->nullable(); // دورة المقبلين على الزواج
            $table->string('marriage_contract')->nullable(); // عقد النكاح
            $table->string('national_id_copy')->nullable(); // الهوية الوطنية
            $table->string('bank_account')->nullable(); // الحساب البنكي
            $table->text('notes')->nullable();
            $table->uuid('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            
            $table->foreign('applicant_id')->references('person_id')->on('persons');
            $table->foreign('user_id')->references('id')->on('users');
            $table->foreign('reviewed_by')->references('id')->on('users');
            
            $table->index(['status', 'marriage_date']);
            $table->index('applicant_id');
        });
    }

    public function down()
    {
        Schema::dropIfExists('marriage_aid_requests');
        Schema::dropIfExists('social_committee_members');
        Schema::dropIfExists('board_members');

        // Disable foreign key checks
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        
        try {
            $this->safeCreateTables();
        } catch (\Exception $e) {
            Log::error('Migration failed: ' . $e->getMessage());
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
            throw $e;
        }
        
        // Re-enable foreign key checks
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
    }
    
    /**
     * Safely create all tables with proper error handling
     */
    private function safeCreateTables(): void
    {
        // Create committees table
        $this->createCommitteesTable();
        
        // Create committee_members table
        $this->createCommitteeMembersTable();
        
        // Create board_members table
        $this->createBoardMembersTable();
        
        // Create executive_management table
        $this->createExecutiveManagementTable();
        
        // Create committee_meetings table
        $this->createCommitteeMeetingsTable();
        
        // Create meeting_attendees table
        $this->createMeetingAttendeesTable();
    }
    
    private function createCommitteesTable(): void
    {
        if (!Schema::hasTable('committees')) {
            Schema::create('committees', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('name_arabic');
                $table->string('name_english')->nullable();
                $table->string('code')->unique()->comment('Committee code like SOC-001');
                $table->enum('committee_type', [
                    'SOCIAL', 'CULTURAL', 'RECONCILIATION', 'SPORTS', 'MEDIA',
                    'FINANCE', 'EDUCATION', 'HEALTH', 'EVENTS', 'AWQAF', 'OTHER'
                ]);
                $table->text('description_arabic')->nullable();
                $table->text('description_english')->nullable();
                $table->json('objectives')->nullable();
                $table->json('responsibilities')->nullable();
                $table->uuid('chairman_id')->nullable()->comment('رئيس اللجنة');
                $table->uuid('deputy_chairman_id')->nullable()->comment('نائب الرئيس');
                $table->uuid('secretary_id')->nullable()->comment('سكرتير اللجنة');
                $table->date('formation_date')->nullable();
                $table->date('termination_date')->nullable();
                $table->enum('status', ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'UNDER_REVIEW'])->default('ACTIVE');
                $table->json('meeting_schedule')->nullable();
                $table->json('budget_info')->nullable();
                $table->json('performance_metrics')->nullable();
                $table->boolean('has_subcommittees')->default(false);
                $table->json('subcommittees')->nullable();
                $table->string('logo_path')->nullable();
                $table->string('document_path')->nullable();
                $table->integer('max_members')->nullable();
                $table->integer('min_members')->nullable()->default(3);
                $table->json('settings')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
                $table->softDeletes();
                
                $table->index(['committee_type', 'status']);
                $table->index('code');
                $table->index('formation_date');
                $table->index('chairman_id');
            });
        }
    }
    
    private function createCommitteeMembersTable(): void
    {
        if (!Schema::hasTable('committee_members')) {
            Schema::create('committee_members', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('committee_id');
                $table->uuid('person_id');
                $table->enum('role', [
                    'CHAIRMAN', 'DEPUTY_CHAIRMAN', 'SECRETARY', 'TREASURER',
                    'COORDINATOR', 'MEMBER', 'ADVISOR', 'AUDITOR', 'OBSERVER'
                ])->default('MEMBER');
                $table->enum('membership_type', ['PERMANENT', 'TEMPORARY', 'HONORARY', 'EX_OFFICIO'])->default('PERMANENT');
                $table->date('appointment_date')->nullable();
                $table->date('start_date');
                $table->date('end_date')->nullable();
                $table->enum('status', ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'RESIGNED', 'TERMINATED', 'ON_LEAVE'])->default('ACTIVE');
                $table->text('appointment_letter_path')->nullable();
                $table->text('resignation_letter_path')->nullable();
                $table->json('responsibilities')->nullable();
                $table->json('permissions')->nullable();
                $table->decimal('attendance_rate', 5, 2)->default(0);
                $table->integer('meetings_attended')->default(0);
                $table->integer('meetings_missed')->default(0);
                $table->decimal('performance_score', 5, 2)->nullable();
                $table->json('performance_reviews')->nullable();
                $table->boolean('can_vote')->default(true);
                $table->boolean('can_propose')->default(true);
                $table->boolean('can_approve')->default(false);
                $table->decimal('monthly_allowance', 10, 2)->nullable();
                $table->string('allowance_currency', 3)->default('SAR');
                $table->json('contact_info')->nullable();
                $table->uuid('appointed_by')->nullable();
                $table->uuid('terminated_by')->nullable();
                $table->text('termination_reason')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
                $table->softDeletes();
                
                // Add foreign keys after table creation
                $table->unique(['committee_id', 'person_id', 'deleted_at']);
                $table->index(['committee_id', 'role']);
                $table->index(['person_id', 'status']);
                $table->index(['start_date', 'end_date']);
                $table->index('attendance_rate');
                $table->index('performance_score');
            });
            
            // Add foreign keys separately to avoid issues
            Schema::table('committee_members', function (Blueprint $table) {
                $table->foreign('committee_id')
                      ->references('id')
                      ->on('committees')
                      ->onDelete('cascade')
                      ->onUpdate('cascade');
                
                $table->foreign('person_id')
                      ->references('id')
                      ->on('persons')
                      ->onDelete('cascade')
                      ->onUpdate('cascade');
            });
        }
    }
    
    private function createBoardMembersTable(): void
    {
        if (!Schema::hasTable('board_members')) {
            Schema::create('board_members', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('person_id');
                $table->enum('position', [
                    'CHAIRMAN', 'VICE_CHAIRMAN', 'SECRETARY_GENERAL', 
                    'TREASURER', 'MEMBER', 'EXECUTIVE_DIRECTOR', 
                    'LEGAL_ADVISOR', 'AUDITOR'
                ]);
                $table->enum('board_type', ['MAIN_BOARD', 'EXECUTIVE_BOARD', 'SUPERVISORY_BOARD', 'ADVISORY_BOARD'])->default('MAIN_BOARD');
                $table->date('election_date');
                $table->date('term_start_date');
                $table->date('term_end_date');
                $table->enum('status', ['ACTIVE', 'FORMER', 'SUSPENDED', 'RESIGNED', 'TERMINATED'])->default('ACTIVE');
                $table->integer('term_number')->default(1);
                $table->boolean('is_current')->default(true);
                $table->text('election_document_path')->nullable();
                $table->text('appointment_decree_path')->nullable();
                $table->json('powers')->nullable();
                $table->json('responsibilities')->nullable();
                $table->decimal('attendance_rate', 5, 2)->default(0);
                $table->integer('votes_count')->default(0);
                $table->integer('proposals_count')->default(0);
                $table->integer('decisions_count')->default(0);
                $table->decimal('monthly_salary', 12, 2)->nullable();
                $table->string('salary_currency', 3)->default('SAR');
                $table->json('benefits')->nullable();
                $table->uuid('elected_by')->nullable();
                $table->uuid('approved_by')->nullable();
                $table->json('committees')->nullable();
                $table->json('contact_channels')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
                $table->softDeletes();
                
                $table->unique(['person_id', 'position', 'term_start_date', 'deleted_at']);
                $table->index(['person_id', 'is_current']);
                $table->index(['position', 'status']);
                $table->index('term_start_date');
                $table->index('term_end_date');
                $table->index('attendance_rate');
            });
            
            // Add foreign key separately
            Schema::table('board_members', function (Blueprint $table) {
                $table->foreign('person_id')
                      ->references('id')
                      ->on('persons')
                      ->onDelete('cascade')
                      ->onUpdate('cascade');
            });
        } else {
            // Table exists, fix foreign key if needed
            $this->fixBoardMembersTable();
        }
    }
    
    /**
     * Fix existing board_members table if it has incorrect foreign key
     */
    private function fixBoardMembersTable(): void
    {
        // Check if foreign key exists and is incorrect
        $foreignKeys = DB::select("
            SELECT CONSTRAINT_NAME 
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
            WHERE TABLE_NAME = 'board_members' 
            AND TABLE_SCHEMA = DATABASE()
            AND REFERENCED_TABLE_NAME = 'persons'
        ");
        
        if (!empty($foreignKeys)) {
            // Foreign key exists, check if it's incorrect
            foreach ($foreignKeys as $fk) {
                $constraintName = $fk->CONSTRAINT_NAME;
                
                // Drop the foreign key safely
                Schema::table('board_members', function (Blueprint $table) use ($constraintName) {
                    try {
                        $table->dropForeign([$constraintName]);
                    } catch (\Exception $e) {
                        // Ignore if foreign key doesn't exist
                        Log::warning("Could not drop foreign key {$constraintName}: " . $e->getMessage());
                    }
                });
            }
        }
        
        // Add correct foreign key
        if (Schema::hasColumn('board_members', 'person_id')) {
            Schema::table('board_members', function (Blueprint $table) {
                // Check if foreign key already exists with correct reference
                $existingFk = DB::select("
                    SELECT 1 
                    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
                    WHERE TABLE_NAME = 'board_members' 
                    AND COLUMN_NAME = 'person_id'
                    AND REFERENCED_TABLE_NAME = 'persons'
                    AND REFERENCED_COLUMN_NAME = 'id'
                ");
                
                if (empty($existingFk)) {
                    $table->foreign('person_id')
                          ->references('id')
                          ->on('persons')
                          ->onDelete('cascade')
                          ->onUpdate('cascade');
                }
            });
        }
    }
    
    private function createExecutiveManagementTable(): void
    {
        if (!Schema::hasTable('executive_management')) {
            Schema::create('executive_management', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('person_id');
                $table->enum('position', [
                    'EXECUTIVE_DIRECTOR', 'DEPUTY_DIRECTOR', 'GENERAL_SECRETARY',
                    'FINANCE_DIRECTOR', 'OPERATIONS_DIRECTOR', 'HR_DIRECTOR',
                    'PROJECTS_DIRECTOR', 'IT_DIRECTOR', 'COMMUNICATION_DIRECTOR',
                    'LEGAL_DIRECTOR'
                ]);
                $table->uuid('reports_to')->nullable();
                $table->uuid('deputy_id')->nullable();
                $table->date('appointment_date');
                $table->date('contract_start_date');
                $table->date('contract_end_date')->nullable();
                $table->enum('employment_type', ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'CONSULTANT', 'TEMPORARY'])->default('FULL_TIME');
                $table->enum('status', ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED', 'RESIGNED'])->default('ACTIVE');
                $table->text('contract_path')->nullable();
                $table->text('job_description_path')->nullable();
                $table->json('powers_delegation')->nullable();
                $table->json('responsibilities')->nullable();
                $table->json('key_performance_indicators')->nullable();
                $table->decimal('salary', 12, 2);
                $table->string('salary_currency', 3)->default('SAR');
                $table->json('allowances')->nullable();
                $table->json('benefits')->nullable();
                $table->integer('team_size')->default(0);
                $table->decimal('budget_responsibility', 15, 2)->nullable();
                $table->uuid('appointed_by')->nullable();
                $table->uuid('approved_by')->nullable();
                $table->json('achievements')->nullable();
                $table->json('performance_reviews')->nullable();
                $table->decimal('performance_score', 5, 2)->nullable();
                $table->json('contact_info')->nullable();
                $table->json('emergency_contact')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
                $table->softDeletes();
                
                $table->index(['person_id', 'status']);
                $table->index(['position', 'employment_type']);
                $table->index('contract_start_date');
                $table->index('contract_end_date');
                $table->index('performance_score');
            });
            
            // Add foreign keys separately
            Schema::table('executive_management', function (Blueprint $table) {
                $table->foreign('person_id')
                      ->references('id')
                      ->on('persons')
                      ->onDelete('cascade')
                      ->onUpdate('cascade');
            });
        }
    }
    
    private function createCommitteeMeetingsTable(): void
    {
        if (!Schema::hasTable('committee_meetings')) {
            Schema::create('committee_meetings', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('committee_id');
                $table->string('meeting_number')->comment('رقم الاجتماع مثل SOC-2024-001');
                $table->string('title_arabic');
                $table->string('title_english')->nullable();
                $table->date('meeting_date');
                $table->time('start_time');
                $table->time('end_time')->nullable();
                $table->enum('meeting_type', ['REGULAR', 'EMERGENCY', 'ANNUAL', 'QUARTERLY', 'MONTHLY', 'SPECIAL', 'VIRTUAL'])->default('REGULAR');
                $table->enum('status', ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED'])->default('SCHEDULED');
                $table->text('location')->nullable();
                $table->json('virtual_meeting_info')->nullable();
                $table->uuid('chairman_id')->nullable();
                $table->uuid('secretary_id')->nullable();
                $table->json('agenda_items')->nullable();
                $table->json('decisions_taken')->nullable();
                $table->json('action_items')->nullable();
                $table->json('next_steps')->nullable();
                $table->integer('total_attendees')->default(0);
                $table->integer('total_invitees')->default(0);
                $table->text('minutes_path')->nullable();
                $table->text('attendance_sheet_path')->nullable();
                $table->text('decisions_document_path')->nullable();
                $table->boolean('is_quorum_achieved')->default(false);
                $table->decimal('attendance_percentage', 5, 2)->nullable();
                $table->json('documents')->nullable();
                $table->json('metadata')->nullable();
                $table->uuid('created_by')->nullable();
                $table->uuid('updated_by')->nullable();
                $table->timestamps();
                $table->softDeletes();
                
                $table->unique(['committee_id', 'meeting_number', 'deleted_at']);
                $table->index(['committee_id', 'meeting_date']);
                $table->index(['meeting_date', 'status']);
                $table->index('meeting_type');
                $table->index('chairman_id');
            });
            
            // Add foreign key
            Schema::table('committee_meetings', function (Blueprint $table) {
                $table->foreign('committee_id')
                      ->references('id')
                      ->on('committees')
                      ->onDelete('cascade')
                      ->onUpdate('cascade');
            });
        }
    }
    
    private function createMeetingAttendeesTable(): void
    {
        if (!Schema::hasTable('meeting_attendees')) {
            Schema::create('meeting_attendees', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('meeting_id');
                $table->uuid('person_id');
                $table->enum('attendee_type', ['COMMITTEE_MEMBER', 'BOARD_MEMBER', 'EXECUTIVE', 'INVITED_GUEST', 'OBSERVER', 'CONSULTANT'])->default('COMMITTEE_MEMBER');
                $table->enum('attendance_status', ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'LEFT_EARLY'])->default('PRESENT');
                $table->time('arrival_time')->nullable();
                $table->time('departure_time')->nullable();
                $table->text('excuse_reason')->nullable();
                $table->boolean('has_voting_right')->default(true);
                $table->json('contributions')->nullable()->comment('المساهمات في الاجتماع');
                $table->json('assigned_tasks')->nullable();
                $table->uuid('registered_by')->nullable();
                $table->timestamp('registered_at')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
                
                $table->unique(['meeting_id', 'person_id']);
                $table->index(['meeting_id', 'attendance_status']);
                $table->index(['person_id', 'meeting_id']);
                $table->index('attendee_type');
            });
            
            // Add foreign keys separately
            Schema::table('meeting_attendees', function (Blueprint $table) {
                $table->foreign('meeting_id')
                      ->references('id')
                      ->on('committee_meetings')
                      ->onDelete('cascade')
                      ->onUpdate('cascade');
                
                $table->foreign('person_id')
                      ->references('id')
                      ->on('persons')
                      ->onDelete('cascade')
                      ->onUpdate('cascade');
            });
        }
    }

    public function down()
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        
        // Drop tables in reverse order (considering dependencies)
        Schema::dropIfExists('meeting_attendees');
        Schema::dropIfExists('committee_meetings');
        Schema::dropIfExists('executive_management');
        Schema::dropIfExists('board_members');
        Schema::dropIfExists('committee_members');
        Schema::dropIfExists('committees');
        
        DB::statement('SET FOREIGN_KEY_CHECKS=1');
    }
};
