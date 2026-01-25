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
        // Disable foreign key checks for this transaction
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        
        try {
            $this->repairFamilyRelationshipsTable();
            $this->createOrRepairRelatedTables();
            $this->createDatabaseObjects();
            $this->createViews();
            
            Log::info('Family relationships migration completed successfully');
        } catch (\Exception $e) {
            Log::error('Family relationships migration failed: ' . $e->getMessage());
            throw $e;
        } finally {
            // Re-enable foreign key checks
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }
    }
    
    /**
     * Repair the main family_relationships table
     */
    private function repairFamilyRelationshipsTable(): void
    {
        if (!Schema::hasTable('family_relationships')) {
            $this->createFamilyRelationshipsTable();
            return;
        }
        
        // Get existing columns
        $existingColumns = collect(DB::select('DESCRIBE family_relationships'))
            ->pluck('Field')
            ->toArray();
        
        // Define all required columns with their definitions - FIXED: Pass $existingColumns to closures
        $requiredColumns = [
            'id' => function ($table) use ($existingColumns) {
                if (!in_array('id', $existingColumns)) {
                    $table->uuid('id')->primary()->first();
                }
            },
            'person_id' => function ($table) use ($existingColumns) {
                if (!in_array('person_id', $existingColumns)) {
                    $table->uuid('person_id')->after('id');
                }
            },
            'related_person_id' => function ($table) use ($existingColumns) {
                if (!in_array('related_person_id', $existingColumns)) {
                    $table->uuid('related_person_id')->after('person_id');
                }
            },
            'relationship_type' => function ($table) use ($existingColumns) {
                if (!in_array('relationship_type', $existingColumns)) {
                    $table->enum('relationship_type', [
                        'FATHER', 'MOTHER', 'SON', 'DAUGHTER', 'BROTHER', 'SISTER',
                        'HUSBAND', 'WIFE', 'GRANDFATHER', 'GRANDMOTHER', 'GRANDSON',
                        'GRANDDAUGHTER', 'UNCLE', 'AUNT', 'NEPHEW', 'NIECE', 'COUSIN',
                        'FATHER_IN_LAW', 'MOTHER_IN_LAW', 'SON_IN_LAW', 'DAUGHTER_IN_LAW',
                        'BROTHER_IN_LAW', 'SISTER_IN_LAW', 'STEP_FATHER', 'STEP_MOTHER',
                        'STEP_SON', 'STEP_DAUGHTER', 'ADOPTIVE_PARENT', 'ADOPTED_CHILD',
                        'GUARDIAN', 'WARD', 'FAMILY_HEAD', 'FAMILY_ELDER'
                    ])->after('related_person_id');
                }
            },
            'relationship_subtype' => function ($table) use ($existingColumns) {
                if (!in_array('relationship_subtype', $existingColumns)) {
                    // Find position - after relationship_type if it exists, otherwise at end
                    $position = in_array('relationship_type', $existingColumns) 
                        ? 'relationship_type' 
                        : null;
                    
                    $column = $table->enum('relationship_subtype', [
                        'BIOLOGICAL', 'ADOPTIVE', 'STEP', 'FOSTER', 
                        'MARITAL', 'LEGAL', 'CUSTOMARY'
                    ])->default('BIOLOGICAL');
                    
                    if ($position) {
                        $column->after($position);
                    }
                }
            },
            'hierarchy_level' => function ($table) use ($existingColumns) {
                if (!in_array('hierarchy_level', $existingColumns)) {
                    $table->integer('hierarchy_level')
                        ->default(1)
                        ->comment('1 = Immediate family, 2 = Extended, 3 = Distant')
                        ->after('relationship_subtype');
                }
            },
            'birth_order' => function ($table) use ($existingColumns) {
                if (!in_array('birth_order', $existingColumns)) {
                    $table->integer('birth_order')->nullable()
                        ->comment('Order among siblings')
                        ->after('hierarchy_level');
                }
            },
            'is_primary_relationship' => function ($table) use ($existingColumns) {
                if (!in_array('is_primary_relationship', $existingColumns)) {
                    $table->boolean('is_primary_relationship')->default(true)
                        ->after('birth_order');
                }
            },
            'relationship_details' => function ($table) use ($existingColumns) {
                if (!in_array('relationship_details', $existingColumns)) {
                    $table->json('relationship_details')->nullable()
                        ->comment('Additional relationship info')
                        ->after('is_primary_relationship');
                }
            },
            'relationship_strength' => function ($table) use ($existingColumns) {
                if (!in_array('relationship_strength', $existingColumns)) {
                    $table->decimal('relationship_strength', 3, 2)->default(1.00)
                        ->comment('0.00 to 1.00 scale')
                        ->after('relationship_details');
                }
            },
            'relationship_start_date' => function ($table) use ($existingColumns) {
                if (!in_array('relationship_start_date', $existingColumns)) {
                    $table->date('relationship_start_date')->nullable()
                        ->comment('When relationship began')
                        ->after('relationship_strength');
                }
            },
            'relationship_end_date' => function ($table) use ($existingColumns) {
                if (!in_array('relationship_end_date', $existingColumns)) {
                    $table->date('relationship_end_date')->nullable()
                        ->comment('When relationship ended')
                        ->after('relationship_start_date');
                }
            },
            'end_reason' => function ($table) use ($existingColumns) {
                if (!in_array('end_reason', $existingColumns)) {
                    $table->string('end_reason')->nullable()
                        ->comment('Death, divorce, annulment, etc.')
                        ->after('relationship_end_date');
                }
            },
            'legal_document_path' => function ($table) use ($existingColumns) {
                if (!in_array('legal_document_path', $existingColumns)) {
                    $table->string('legal_document_path')->nullable()
                        ->after('end_reason');
                }
            },
            'legal_document_number' => function ($table) use ($existingColumns) {
                if (!in_array('legal_document_number', $existingColumns)) {
                    $table->string('legal_document_number')->nullable()
                        ->after('legal_document_path');
                }
            },
            'legal_document_date' => function ($table) use ($existingColumns) {
                if (!in_array('legal_document_date', $existingColumns)) {
                    $table->date('legal_document_date')->nullable()
                        ->after('legal_document_number');
                }
            },
            'is_verified' => function ($table) use ($existingColumns) {
                if (!in_array('is_verified', $existingColumns)) {
                    $table->boolean('is_verified')->default(false)
                        ->after('legal_document_date');
                }
            },
            'verified_at' => function ($table) use ($existingColumns) {
                if (!in_array('verified_at', $existingColumns)) {
                    $table->timestamp('verified_at')->nullable()
                        ->after('is_verified');
                }
            },
            'verified_by' => function ($table) use ($existingColumns) {
                if (!in_array('verified_by', $existingColumns)) {
                    $table->uuid('verified_by')->nullable()
                        ->after('verified_at');
                }
            },
            'verification_notes' => function ($table) use ($existingColumns) {
                if (!in_array('verification_notes', $existingColumns)) {
                    $table->text('verification_notes')->nullable()
                        ->after('verified_by');
                }
            },
            'status' => function ($table) use ($existingColumns) {
                if (!in_array('status', $existingColumns)) {
                    $table->enum('status', [
                        'ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED', 'HISTORICAL'
                    ])->default('ACTIVE')
                        ->after('verification_notes');
                }
            },
        ];
        
        // Apply column changes
        Schema::table('family_relationships', function (Blueprint $table) use ($requiredColumns, $existingColumns) {
            foreach ($requiredColumns as $columnName => $callback) {
                $callback($table);
            }
            
            // Add missing timestamps
            if (!in_array('created_at', $existingColumns)) {
                $table->timestamps();
            }
            
            if (!in_array('deleted_at', $existingColumns)) {
                $table->softDeletes();
            }
        });
        
        // Fix foreign keys
        $this->fixForeignKeys();
        
        // Create indexes
        $this->createIndexes();
    }
    
    /**
     * Create family_relationships table from scratch
     */
    private function createFamilyRelationshipsTable(): void
    {
        Schema::create('family_relationships', function (Blueprint $table) {
            $table->uuid('id')->primary();
            
            // Person involved in the relationship
            $table->uuid('person_id');
            $table->foreign('person_id')
                  ->references('id')
                  ->on('persons')
                  ->onDelete('cascade')
                  ->onUpdate('cascade');
            
            // Related person
            $table->uuid('related_person_id');
            $table->foreign('related_person_id')
                  ->references('id')
                  ->on('persons')
                  ->onDelete('cascade')
                  ->onUpdate('cascade');
            
            // Relationship type with hierarchical levels
            $table->enum('relationship_type', [
                'FATHER', 'MOTHER', 'SON', 'DAUGHTER', 'BROTHER', 'SISTER',
                'HUSBAND', 'WIFE', 'GRANDFATHER', 'GRANDMOTHER', 'GRANDSON',
                'GRANDDAUGHTER', 'UNCLE', 'AUNT', 'NEPHEW', 'NIECE', 'COUSIN',
                'FATHER_IN_LAW', 'MOTHER_IN_LAW', 'SON_IN_LAW', 'DAUGHTER_IN_LAW',
                'BROTHER_IN_LAW', 'SISTER_IN_LAW', 'STEP_FATHER', 'STEP_MOTHER',
                'STEP_SON', 'STEP_DAUGHTER', 'ADOPTIVE_PARENT', 'ADOPTED_CHILD',
                'GUARDIAN', 'WARD', 'FAMILY_HEAD', 'FAMILY_ELDER'
            ]);
            
            // Relationship sub-type
            $table->enum('relationship_subtype', [
                'BIOLOGICAL', 'ADOPTIVE', 'STEP', 'FOSTER', 
                'MARITAL', 'LEGAL', 'CUSTOMARY'
            ])->default('BIOLOGICAL');
            
            // Hierarchy and precedence
            $table->integer('hierarchy_level')->default(1)
                  ->comment('1 = Immediate family, 2 = Extended, 3 = Distant');
            $table->integer('birth_order')->nullable()
                  ->comment('Order among siblings');
            $table->boolean('is_primary_relationship')->default(true);
            
            // Relationship metadata
            $table->json('relationship_details')->nullable()
                  ->comment('Additional relationship info');
            $table->decimal('relationship_strength', 3, 2)->default(1.00)
                  ->comment('0.00 to 1.00 scale');
            
            // Dates
            $table->date('relationship_start_date')->nullable()
                  ->comment('When relationship began');
            $table->date('relationship_end_date')->nullable()
                  ->comment('When relationship ended');
            $table->string('end_reason')->nullable()
                  ->comment('Death, divorce, annulment, etc.');
            
            // Legal documentation
            $table->string('legal_document_path')->nullable();
            $table->string('legal_document_number')->nullable();
            $table->date('legal_document_date')->nullable();
            
            // Verification
            $table->boolean('is_verified')->default(false);
            $table->timestamp('verified_at')->nullable();
            $table->uuid('verified_by')->nullable();
            $table->text('verification_notes')->nullable();
            
            // Status
            $table->enum('status', [
                'ACTIVE', 'INACTIVE', 'PENDING', 'SUSPENDED', 'HISTORICAL'
            ])->default('ACTIVE');
            
            // Cultural/Religious context
            $table->json('cultural_context')->nullable()
                  ->comment('Cultural or religious aspects');
            $table->json('inheritance_rights')->nullable()
                  ->comment('Inheritance rights and shares');
            
            // Contact permissions
            $table->boolean('can_contact')->default(true);
            $table->boolean('can_view_profile')->default(true);
            $table->boolean('can_view_financial')->default(false);
            $table->boolean('can_view_medical')->default(false);
            $table->json('communication_preferences')->nullable();
            
            // Emergency contact info
            $table->boolean('is_emergency_contact')->default(false);
            $table->integer('emergency_contact_priority')->nullable()
                  ->comment('1 = Primary, 2 = Secondary, etc.');
            
            // Financial responsibilities
            $table->boolean('has_financial_responsibility')->default(false);
            $table->decimal('monthly_support_amount', 15, 2)->nullable();
            $table->string('support_currency', 3)->default('SAR');
            $table->enum('support_frequency', [
                'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ONE_TIME'
            ])->nullable();
            
            // Guardianship info
            $table->boolean('is_legal_guardian')->default(false);
            $table->date('guardianship_start_date')->nullable();
            $table->date('guardianship_end_date')->nullable();
            $table->json('guardianship_terms')->nullable();
            
            // Audit trail
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
            
            // Advanced indexes
            $table->unique(['person_id', 'related_person_id', 'relationship_type'], 
                          'unique_relationship');
            $table->index(['person_id', 'relationship_type']);
            $table->index(['related_person_id', 'relationship_type']);
            $table->index(['person_id', 'is_emergency_contact']);
            $table->index(['person_id', 'is_legal_guardian']);
            $table->index('hierarchy_level');
            $table->index('status');
            $table->index('is_verified');
            $table->index('relationship_start_date');
            $table->index('relationship_end_date');
            
            // Full-text search
            $table->fullText(['relationship_details']);
        });
    }
    
    /**
     * Fix foreign key constraints
     */
    private function fixForeignKeys(): void
    {
        // Get existing foreign keys
        $foreignKeys = DB::select("
            SELECT CONSTRAINT_NAME 
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
            WHERE TABLE_NAME = 'family_relationships' 
            AND TABLE_SCHEMA = DATABASE()
            AND REFERENCED_TABLE_NAME IS NOT NULL
        ");
        
        // Drop existing foreign keys
        Schema::table('family_relationships', function (Blueprint $table) use ($foreignKeys) {
            foreach ($foreignKeys as $fk) {
                try {
                    $table->dropForeign([$fk->CONSTRAINT_NAME]);
                } catch (\Exception $e) {
                    // Ignore if foreign key doesn't exist
                    Log::warning("Could not drop foreign key {$fk->CONSTRAINT_NAME}: " . $e->getMessage());
                }
            }
        });
        
        // Re-add correct foreign keys
        Schema::table('family_relationships', function (Blueprint $table) {
            if (Schema::hasColumn('family_relationships', 'person_id')) {
                $table->foreign('person_id')
                      ->references('id')
                      ->on('persons')
                      ->onDelete('cascade')
                      ->onUpdate('cascade');
            }
            
            if (Schema::hasColumn('family_relationships', 'related_person_id')) {
                $table->foreign('related_person_id')
                      ->references('id')
                      ->on('persons')
                      ->onDelete('cascade')
                      ->onUpdate('cascade');
            }
        });
    }
    
    /**
     * Create indexes
     */
    private function createIndexes(): void
    {
        $indexes = [
            ['columns' => ['person_id', 'relationship_type'], 'name' => 'idx_person_relationship'],
            ['columns' => ['related_person_id', 'relationship_type'], 'name' => 'idx_related_relationship'],
            ['columns' => ['person_id', 'is_emergency_contact'], 'name' => 'idx_person_emergency'],
            ['columns' => ['person_id', 'is_legal_guardian'], 'name' => 'idx_person_guardian'],
            ['columns' => ['hierarchy_level'], 'name' => 'idx_hierarchy'],
            ['columns' => ['status'], 'name' => 'idx_status'],
            ['columns' => ['is_verified'], 'name' => 'idx_verified'],
            ['columns' => ['relationship_start_date'], 'name' => 'idx_start_date'],
            ['columns' => ['relationship_end_date'], 'name' => 'idx_end_date'],
        ];
        
        Schema::table('family_relationships', function (Blueprint $table) use ($indexes) {
            foreach ($indexes as $index) {
                $columns = $index['columns'];
                $name = $index['name'];
                
                // Check if all columns exist
                $allColumnsExist = true;
                foreach ($columns as $column) {
                    if (!Schema::hasColumn('family_relationships', $column)) {
                        $allColumnsExist = false;
                        break;
                    }
                }
                
                if ($allColumnsExist) {
                    try {
                        $table->index($columns, $name);
                    } catch (\Exception $e) {
                        Log::warning("Could not create index {$name}: " . $e->getMessage());
                    }
                }
            }
        });
    }
    
    /**
     * Create or repair related tables
     */
    private function createOrRepairRelatedTables(): void
    {
        $tables = [
            'family_tree_snapshots' => function () {
                if (!Schema::hasTable('family_tree_snapshots')) {
                    Schema::create('family_tree_snapshots', function (Blueprint $table) {
                        $table->uuid('id')->primary();
                        $table->uuid('family_id')->nullable()->comment('Reference to main family');
                        $table->string('snapshot_name');
                        $table->text('description')->nullable();
                        $table->json('tree_data')->comment('Complete family tree structure');
                        $table->integer('total_members')->default(0);
                        $table->integer('total_generations')->default(0);
                        $table->uuid('created_by');
                        $table->string('version', 20)->default('1.0');
                        $table->boolean('is_current')->default(false);
                        $table->boolean('is_public')->default(false);
                        $table->json('metadata')->nullable();
                        $table->timestamps();
                        
                        $table->index(['family_id', 'is_current']);
                        $table->index('created_at');
                        $table->index('version');
                    });
                }
            },
            
            'relationship_change_logs' => function () {
                if (!Schema::hasTable('relationship_change_logs')) {
                    Schema::create('relationship_change_logs', function (Blueprint $table) {
                        $table->uuid('id')->primary();
                        $table->uuid('relationship_id');
                        $table->foreign('relationship_id')
                              ->references('id')
                              ->on('family_relationships')
                              ->onDelete('cascade')
                              ->onUpdate('cascade');
                        
                        $table->enum('change_type', [
                            'CREATED', 'UPDATED', 'STATUS_CHANGED', 'VERIFIED',
                            'DOCUMENT_ADDED', 'HIERARCHY_CHANGED', 'DELETED'
                        ]);
                        
                        $table->json('old_values')->nullable();
                        $table->json('new_values')->nullable();
                        $table->text('change_reason')->nullable();
                        $table->uuid('changed_by');
                        $table->string('ip_address', 45)->nullable();
                        $table->string('user_agent')->nullable();
                        $table->json('metadata')->nullable();
                        $table->timestamps();
                        
                        $table->index(['relationship_id', 'change_type']);
                        $table->index('changed_by');
                        $table->index('created_at');
                    });
                }
            },
            
            'family_groups' => function () {
                if (!Schema::hasTable('family_groups')) {
                    Schema::create('family_groups', function (Blueprint $table) {
                        $table->uuid('id')->primary();
                        $table->uuid('family_id')->nullable();
                        $table->string('group_name');
                        $table->string('group_code')->unique()->comment('Unique identifier for group');
                        $table->enum('group_type', [
                            'IMMEDIATE_FAMILY', 'EXTENDED_FAMILY', 'BRANCH', 'GENERATION',
                            'COMMITTEE', 'EDUCATIONAL', 'SOCIAL', 'BUSINESS',
                            'GEOGRAPHICAL', 'CUSTOM'
                        ]);
                        $table->text('description')->nullable();
                        $table->json('group_rules')->nullable();
                        $table->uuid('group_leader_id')->nullable();
                        $table->uuid('deputy_leader_id')->nullable();
                        $table->date('formation_date')->nullable();
                        $table->date('dissolution_date')->nullable();
                        $table->boolean('is_active')->default(true);
                        $table->json('settings')->nullable();
                        $table->timestamps();
                        $table->softDeletes();
                        
                        $table->index(['family_id', 'group_type']);
                        $table->index('group_code');
                        $table->index('is_active');
                    });
                }
            },
            
            'family_group_members' => function () {
                if (!Schema::hasTable('family_group_members')) {
                    Schema::create('family_group_members', function (Blueprint $table) {
                        $table->uuid('id')->primary();
                        $table->uuid('group_id');
                        $table->foreign('group_id')
                              ->references('id')
                              ->on('family_groups')
                              ->onDelete('cascade')
                              ->onUpdate('cascade');
                        
                        $table->uuid('person_id');
                        $table->foreign('person_id')
                              ->references('id')
                              ->on('persons')
                              ->onDelete('cascade')
                              ->onUpdate('cascade');
                        
                        $table->enum('role', [
                            'LEADER', 'DEPUTY_LEADER', 'MEMBER', 'ADVISOR',
                            'SECRETARY', 'TREASURER', 'AUDITOR', 'HONORARY_MEMBER', 'GUEST'
                        ])->default('MEMBER');
                        
                        $table->date('joined_date')->nullable();
                        $table->date('left_date')->nullable();
                        $table->string('left_reason')->nullable();
                        $table->json('permissions')->nullable();
                        $table->json('responsibilities')->nullable();
                        $table->boolean('is_active')->default(true);
                        $table->decimal('contribution_score', 5, 2)->default(0);
                        $table->timestamps();
                        
                        $table->unique(['group_id', 'person_id']);
                        $table->index(['group_id', 'role']);
                        $table->index(['person_id', 'is_active']);
                        $table->index('contribution_score');
                    });
                }
            }
        ];
        
        foreach ($tables as $tableName => $callback) {
            $callback();
        }
    }
    
    /**
     * Create database objects (stored procedures, triggers)
     */
    private function createDatabaseObjects(): void
    {
        // Drop existing objects first
        $this->dropDatabaseObjects();
        
        // Create stored procedure for rebuilding family tree
        try {
            DB::unprepared('
                CREATE PROCEDURE IF NOT EXISTS sp_rebuild_family_tree(IN family_uuid VARCHAR(36))
                BEGIN
                    DECLARE tree_data JSON;
                    DECLARE snapshot_id CHAR(36);
                    
                    SET snapshot_id = UUID();
                    
                    -- Build family tree JSON
                    SELECT JSON_OBJECT(
                        "family_id", family_uuid,
                        "generated_at", NOW(),
                        "snapshot_id", snapshot_id,
                        "tree", (
                            SELECT JSON_ARRAYAGG(
                                JSON_OBJECT(
                                    "person_id", p.id,
                                    "name", p.full_name_arabic,
                                    "gender", p.gender,
                                    "birth_date", p.birth_date,
                                    "is_alive", p.is_alive,
                                    "relationships", (
                                        SELECT JSON_ARRAYAGG(
                                            JSON_OBJECT(
                                                "type", fr.relationship_type,
                                                "related_person_id", fr.related_person_id,
                                                "related_name", (
                                                    SELECT full_name_arabic 
                                                    FROM persons 
                                                    WHERE id = fr.related_person_id
                                                ),
                                                "strength", fr.relationship_strength,
                                                "hierarchy", fr.hierarchy_level
                                            )
                                        )
                                        FROM family_relationships fr
                                        WHERE fr.person_id = p.id
                                        AND fr.status = "ACTIVE"
                                        AND fr.deleted_at IS NULL
                                    )
                                )
                            )
                            FROM persons p
                            WHERE p.deleted_at IS NULL
                            AND EXISTS (
                                SELECT 1 FROM family_relationships fr2
                                WHERE (fr2.person_id = p.id OR fr2.related_person_id = p.id)
                                AND fr2.status = "ACTIVE"
                                AND fr2.deleted_at IS NULL
                            )
                        )
                    ) INTO tree_data;
                    
                    -- Update existing snapshot
                    UPDATE family_tree_snapshots
                    SET is_current = FALSE
                    WHERE family_id = family_uuid
                    AND is_current = TRUE;
                    
                    -- Insert new snapshot
                    INSERT INTO family_tree_snapshots (
                        id, family_id, snapshot_name, tree_data,
                        total_members, total_generations, created_by,
                        is_current, created_at, updated_at
                    ) VALUES (
                        snapshot_id, 
                        family_uuid, 
                        CONCAT("Tree Snapshot - ", DATE_FORMAT(NOW(), "%Y-%m-%d %H:%i")),
                        tree_data,
                        (
                            SELECT COUNT(DISTINCT p.id)
                            FROM persons p
                            WHERE p.deleted_at IS NULL
                            AND EXISTS (
                                SELECT 1 FROM family_relationships fr2
                                WHERE (fr2.person_id = p.id OR fr2.related_person_id = p.id)
                                AND fr2.status = "ACTIVE"
                                AND fr2.deleted_at IS NULL
                            )
                        ),
                        (
                            SELECT MAX(level)
                            FROM (
                                SELECT COUNT(*) as level
                                FROM family_relationships fr
                                WHERE fr.status = "ACTIVE"
                                AND fr.deleted_at IS NULL
                                START WITH fr.person_id = (
                                    SELECT id FROM persons 
                                    WHERE family_id = family_uuid 
                                    ORDER BY birth_date ASC 
                                    LIMIT 1
                                )
                                CONNECT BY PRIOR fr.related_person_id = fr.person_id
                            ) levels
                        ),
                        NULL,
                        TRUE,
                        NOW(),
                        NOW()
                    );
                    
                    SELECT snapshot_id as new_snapshot_id, tree_data;
                END
            ');
        } catch (\Exception $e) {
            Log::warning("Could not create stored procedure sp_rebuild_family_tree: " . $e->getMessage());
        }
        
        // Create trigger for relationship validation
        try {
            DB::unprepared('
                CREATE TRIGGER IF NOT EXISTS tr_family_relationships_before_insert
                BEFORE INSERT ON family_relationships
                FOR EACH ROW
                BEGIN
                    -- Prevent self-relationships
                    IF NEW.person_id = NEW.related_person_id THEN
                        SIGNAL SQLSTATE "45000"
                        SET MESSAGE_TEXT = "Cannot create relationship with self";
                    END IF;
                    
                    -- Set default hierarchy based on relationship type
                    IF NEW.hierarchy_level IS NULL THEN
                        CASE NEW.relationship_type
                            WHEN "FATHER" THEN SET NEW.hierarchy_level = 1;
                            WHEN "MOTHER" THEN SET NEW.hierarchy_level = 1;
                            WHEN "SON" THEN SET NEW.hierarchy_level = 1;
                            WHEN "DAUGHTER" THEN SET NEW.hierarchy_level = 1;
                            WHEN "HUSBAND" THEN SET NEW.hierarchy_level = 1;
                            WHEN "WIFE" THEN SET NEW.hierarchy_level = 1;
                            WHEN "BROTHER" THEN SET NEW.hierarchy_level = 1;
                            WHEN "SISTER" THEN SET NEW.hierarchy_level = 1;
                            ELSE SET NEW.hierarchy_level = 2;
                        END CASE;
                    END IF;
                    
                    -- Auto-generate relationship strength based on type
                    IF NEW.relationship_strength IS NULL THEN
                        CASE NEW.relationship_type
                            WHEN "FATHER" THEN SET NEW.relationship_strength = 1.00;
                            WHEN "MOTHER" THEN SET NEW.relationship_strength = 1.00;
                            WHEN "SON" THEN SET NEW.relationship_strength = 1.00;
                            WHEN "DAUGHTER" THEN SET NEW.relationship_strength = 1.00;
                            WHEN "HUSBAND" THEN SET NEW.relationship_strength = 0.95;
                            WHEN "WIFE" THEN SET NEW.relationship_strength = 0.95;
                            WHEN "BROTHER" THEN SET NEW.relationship_strength = 0.85;
                            WHEN "SISTER" THEN SET NEW.relationship_strength = 0.85;
                            ELSE SET NEW.relationship_strength = 0.70;
                        END CASE;
                    END IF;
                END
            ');
        } catch (\Exception $e) {
            Log::warning("Could not create trigger tr_family_relationships_before_insert: " . $e->getMessage());
        }
    }
    
    /**
     * Drop existing database objects
     */
    private function dropDatabaseObjects(): void
    {
        $objects = [
            'PROCEDURE' => ['sp_rebuild_family_tree'],
            'TRIGGER' => [
                'tr_family_relationships_before_insert',
                'tr_family_relationships_before_update',
                'tr_family_relationships_after_insert',
                'tr_family_relationships_after_update'
            ],
            'VIEW' => ['v_immediate_family', 'v_family_tree', 'v_family_hierarchy']
        ];
        
        foreach ($objects['PROCEDURE'] as $procedure) {
            try {
                DB::statement("DROP PROCEDURE IF EXISTS {$procedure}");
            } catch (\Exception $e) {
                // Ignore
            }
        }
        
        foreach ($objects['TRIGGER'] as $trigger) {
            try {
                DB::statement("DROP TRIGGER IF EXISTS {$trigger}");
            } catch (\Exception $e) {
                // Ignore
            }
        }
        
        foreach ($objects['VIEW'] as $view) {
            try {
                DB::statement("DROP VIEW IF EXISTS {$view}");
            } catch (\Exception $e) {
                // Ignore
            }
        }
    }
    
    /**
     * Create views
     */
    private function createViews(): void
    {
        // View for immediate family
        try {
            DB::statement('
                CREATE OR REPLACE VIEW v_immediate_family AS
                SELECT 
                    fr.id as relationship_id,
                    p.id as person_id,
                    p.full_name_arabic as person_name,
                    p.gender as person_gender,
                    p.birth_date as person_birth_date,
                    fr.relationship_type,
                    fr.relationship_subtype,
                    rp.id as related_person_id,
                    rp.full_name_arabic as related_person_name,
                    rp.gender as related_person_gender,
                    fr.hierarchy_level,
                    fr.is_emergency_contact,
                    fr.is_legal_guardian,
                    fr.relationship_strength,
                    fr.status,
                    fr.created_at
                FROM family_relationships fr
                INNER JOIN persons p ON fr.person_id = p.id
                INNER JOIN persons rp ON fr.related_person_id = rp.id
                WHERE fr.status = "ACTIVE"
                AND fr.hierarchy_level = 1
                AND fr.deleted_at IS NULL
                AND p.deleted_at IS NULL
                AND rp.deleted_at IS NULL
                ORDER BY p.full_name_arabic, fr.relationship_type
            ');
        } catch (\Exception $e) {
            Log::warning("Could not create view v_immediate_family: " . $e->getMessage());
        }
    }
    
    public function down()
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        
        try {
            // Drop database objects
            $this->dropDatabaseObjects();
            
            // Drop tables in reverse order
            Schema::dropIfExists('family_group_members');
            Schema::dropIfExists('family_groups');
            Schema::dropIfExists('relationship_change_logs');
            Schema::dropIfExists('family_tree_snapshots');
            Schema::dropIfExists('family_relationships');
        } catch (\Exception $e) {
            Log::error("Migration rollback failed: " . $e->getMessage());
            throw $e;
        } finally {
            DB::statement('SET FOREIGN_KEY_CHECKS=1');
        }
    }
};
