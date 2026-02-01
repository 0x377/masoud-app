<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        Schema::create('users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('national_id')->unique();
            $table->string('full_name_arabic');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->enum('gender', ['M', 'F']);
            $table->date('birth_date')->nullable();
            $table->string('phone_number')->unique();
            $table->enum('user_type', [
                'FAMILY_MEMBER',
                'BOARD_MEMBER',  // أعضاء مجلس الإدارة (الخانة الثانية)
                'EXECUTIVE',     // الإدارة التنفيذية (الخانة الخامسة)
                'FINANCE_MANAGER', // المدير المالي (الخانة السادسة)
                'SOCIAL_COMMITTEE', // اللجنة الاجتماعية (الخانة السابعة)
                'CULTURAL_COMMITTEE', // اللجنة الثقافية (الخانة الثامنة)
                'RECONCILIATION_COMMITTEE', // لجنة إصلاح ذات البين (الخانة التاسعة)
                'SPORTS_COMMITTEE', // اللجنة الرياضية (الخانة الثامنة)
                'MEDIA_CENTER', // المركز الإعلامي (الخانة العاشرة)
                'SUPER_ADMIN'
            ])->default('FAMILY_MEMBER');

            $table->boolean('is_active')->default(true);
            $table->rememberToken();
            $table->timestamps();

            // Indexes
            $table->index(['user_type', 'is_active']);
            $table->index('national_id');
        });
        if (!Schema::hasTable('persons')) {
            // Create persons table first (for personal information)
            Schema::create('persons', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->string('national_id', 14)->unique()->comment('الهوية الوطنية - 14 رقم');
                $table->string('full_name_arabic');
                $table->string('full_name_english')->nullable();
                $table->string('nickname')->nullable()->comment('الاسم المستعار');
                $table->enum('gender', ['M', 'F'])->comment('M = ذكر, F = أنثى');
                $table->date('birth_date')->nullable();
                $table->string('birth_place')->nullable();
                $table->date('death_date')->nullable();
                $table->boolean('is_alive')->default(true);
                $table->enum('marital_status', ['single', 'married', 'divorced', 'widowed'])->default('single');
                $table->string('blood_type', 5)->nullable()->comment('مثل: O+, A-, AB+');
                $table->string('phone_number', 20)->nullable();
                $table->string('email')->nullable();
                $table->text('current_address')->nullable();
                $table->string('photo_path')->nullable();
                $table->json('family_info')->nullable()->comment('معلومات الأب والأم والأبناء');
                $table->json('education_info')->nullable()->comment('معلومات التعليم');
                $table->json('work_info')->nullable()->comment('معلومات العمل');
                $table->json('additional_info')->nullable();
                $table->uuid('created_by')->nullable();
                $table->uuid('verified_by')->nullable();
                $table->timestamp('verified_at')->nullable();
                $table->timestamps();
                $table->softDeletes();

                // Indexes
                $table->index('birth_date');
                $table->index('is_alive');
                $table->index(['gender', 'marital_status']);
            });
        }

        if (!Schema::hasTable('users')) {
            // Create users table (for authentication)
            Schema::create('users', function (Blueprint $table) {
                $table->uuid('id')->primary();
                
                // Foreign key to persons table
                $table->uuid('person_id')->unique();
                $table->foreign('person_id')
                    ->references('id')
                    ->on('persons')
                    ->onDelete('cascade')
                    ->onUpdate('cascade');

                // Authentication fields
                $table->string('username')->unique()->nullable()->comment('اسم المستخدم (اختياري)');
                $table->string('email')->unique();
                $table->timestamp('email_verified_at')->nullable();
                $table->string('phone_number')->unique();
                $table->timestamp('phone_verified_at')->nullable();
                $table->string('password');
                $table->timestamp('password_changed_at')->nullable();

                // User type/role with hierarchical permissions
                $table->enum('user_type', [
                    'FAMILY_MEMBER',          // عضو عائلة عادي
                    'BOARD_MEMBER',           // أعضاء مجلس الإدارة (الخانة الثانية)
                    'EXECUTIVE',              // الإدارة التنفيذية (الخانة الخامسة)
                    'FINANCE_MANAGER',        // المدير المالي (الخانة السادسة)
                    'SOCIAL_COMMITTEE',       // اللجنة الاجتماعية (الخانة السابعة)
                    'CULTURAL_COMMITTEE',     // اللجنة الثقافية (الخانة الثامنة)
                    'RECONCILIATION_COMMITTEE', // لجنة إصلاح ذات البين (الخانة التاسعة)
                    'SPORTS_COMMITTEE',       // اللجنة الرياضية (الخانة الثامنة)
                    'MEDIA_CENTER',           // المركز الإعلامي (الخانة العاشرة)
                    'SUPER_ADMIN'
                ])->default('FAMILY_MEMBER');

                // Additional roles (JSON array for multiple roles)
                $table->json('additional_roles')->nullable()->comment('أدوار إضافية للمستخدم');

                // Status management
                $table->enum('status', [
                    'PENDING_VERIFICATION',
                    'ACTIVE',
                    'SUSPENDED',
                    'DEACTIVATED',
                    'BANNED'
                ])->default('PENDING_VERIFICATION');

                $table->string('suspension_reason')->nullable();
                $table->timestamp('suspended_at')->nullable();
                $table->uuid('suspended_by')->nullable();

                // MFA/2FA Configuration
                $table->boolean('mfa_enabled')->default(false);
                $table->string('mfa_secret')->nullable()->comment('TOTP secret key');
                $table->json('mfa_backup_codes')->nullable()->comment('Backup codes for 2FA');
                $table->timestamp('mfa_enabled_at')->nullable();
                $table->timestamp('last_mfa_used_at')->nullable();

                // Login security
                $table->integer('failed_login_attempts')->default(0);
                $table->timestamp('locked_until')->nullable();
                $table->string('last_login_ip')->nullable();
                $table->timestamp('last_login_at')->nullable();
                $table->timestamp('last_activity_at')->nullable();
                $table->string('current_session_id')->nullable();

                // Preferences
                $table->json('preferences')->nullable()->comment('User preferences (theme, language, notifications)');
                $table->json('notification_settings')->nullable()->comment('Notification preferences');

                // Permissions override
                $table->json('permissions_override')->nullable()->comment('Permissions beyond user type');
                
                // Statistics
                $table->integer('login_count')->default(0);
                $table->decimal('total_donations', 15, 2)->default(0);
                $table->integer('donation_count')->default(0);
                $table->timestamp('last_donation_at')->nullable();

                // Metadata
                $table->json('metadata')->nullable();
                $table->rememberToken();
                $table->timestamps();
                $table->softDeletes();

                // Indexes for performance
                $table->index(['user_type', 'status']);
                $table->index('status');
                $table->index('email_verified_at');
                $table->index('last_login_at');
                $table->index('created_at');
                $table->index('total_donations');
            });
        }

        if (!Schema::hasTable('password_reset_tokens')) {
            // Create password reset tokens table
            Schema::create('password_reset_tokens', function (Blueprint $table) {
                $table->string('email')->primary();
                $table->string('token');
                $table->timestamp('created_at')->nullable();

                // Index
                $table->index(['email', 'token']);
            });
        }

        if (!Schema::hasTable('personal_access_tokens')) {
            // Create personal access tokens table (for API authentication)
            Schema::create('personal_access_tokens', function (Blueprint $table) {
                $table->bigIncrements('id');
                $table->uuidMorphs('tokenable');
                $table->string('name');
                $table->string('token', 64)->unique();
                $table->text('abilities')->nullable();
                $table->timestamp('last_used_at')->nullable();
                $table->timestamp('expires_at')->nullable();
                $table->string('ip_address', 45)->nullable();
                $table->string('user_agent')->nullable();
                $table->string('device_id')->nullable()->comment('For mobile device identification');
                $table->string('device_name')->nullable();
                $table->enum('device_type', ['web', 'ios', 'android', 'desktop'])->default('web');
                $table->boolean('is_revoked')->default(false);
                $table->timestamp('revoked_at')->nullable();
                $table->string('revoked_by_ip')->nullable();
                $table->uuid('revoked_by_user')->nullable();
                $table->timestamps();

                // Indexes
                $table->index(['tokenable_type', 'tokenable_id']);
                $table->index('token');
                $table->index('expires_at');
                $table->index('last_used_at');
                $table->index('device_id');
            });
        }

        // Check if sessions table already exists (from Laravel default)
        if (!Schema::hasTable('sessions')) {
            Schema::create('sessions', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->uuid('user_id')->nullable()->index();
                $table->string('ip_address', 45)->nullable();
                $table->text('user_agent')->nullable();
                $table->text('payload');
                $table->integer('last_activity')->index();
                
                // Additional session metadata
                $table->string('device_id')->nullable();
                $table->string('device_name')->nullable();
                $table->enum('device_type', ['web', 'ios', 'android', 'desktop'])->default('web');
                $table->string('browser')->nullable();
                $table->string('browser_version')->nullable();
                $table->string('platform')->nullable();
                $table->boolean('is_mobile')->default(false);
                $table->boolean('is_tablet')->default(false);
                $table->boolean('is_desktop')->default(false);
                $table->string('country')->nullable();
                $table->string('city')->nullable();
                $table->decimal('latitude', 10, 8)->nullable();
                $table->decimal('longitude', 11, 8)->nullable();
                $table->timestamp('login_at')->useCurrent();
                $table->timestamp('last_seen_at')->useCurrent();
                $table->boolean('is_active')->default(true);
                
                // Indexes
                $table->index(['user_id', 'is_active']);
                $table->index('device_id');
                $table->index('login_at');
            });
        } else {
            // If table exists, just add missing columns
            Schema::table('sessions', function (Blueprint $table) {
                // Check if columns exist before adding them
                if (!Schema::hasColumn('sessions', 'device_id')) {
                    $table->string('device_id')->nullable()->after('last_activity');
                }
                if (!Schema::hasColumn('sessions', 'device_name')) {
                    $table->string('device_name')->nullable()->after('device_id');
                }
                if (!Schema::hasColumn('sessions', 'device_type')) {
                    $table->enum('device_type', ['web', 'ios', 'android', 'desktop'])
                          ->default('web')
                          ->after('device_name');
                }
                // ... add other missing columns similarly
            });
        }

        if (!Schema::hasTable('verification_codes')) {
            // Create verification codes table for 6-digit OTP
            Schema::create('verification_codes', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('user_id');
                $table->foreign('user_id')
                    ->references('id')
                    ->on('users')
                    ->onDelete('cascade')
                    ->onUpdate('cascade');

                $table->string('code', 6)->comment('6-digit verification code');
                $table->enum('type', [
                    'EMAIL_VERIFICATION',
                    'PHONE_VERIFICATION',
                    'PASSWORD_RESET',
                    'LOGIN_2FA',
                    'TRANSACTION_VERIFICATION',
                    'ACCOUNT_RECOVERY'
                ]);

                $table->string('recipient')->comment('Email or phone number');
                $table->enum('channel', ['email', 'sms', 'whatsapp', 'push']);
                $table->text('metadata')->nullable()->comment('Additional data for verification');

                $table->boolean('is_used')->default(false);
                $table->timestamp('used_at')->nullable();
                $table->string('used_ip')->nullable();
                $table->string('used_device_id')->nullable();

                $table->boolean('is_expired')->default(false);
                $table->timestamp('expires_at');
                $table->timestamp('verified_at')->nullable();

                $table->integer('attempts')->default(0);
                $table->timestamp('last_attempt_at')->nullable();
                $table->boolean('is_locked')->default(false);
                $table->timestamp('locked_until')->nullable();

                $table->timestamps();
                
                // Indexes
                $table->index(['user_id', 'type', 'is_used']);
                $table->index(['code', 'type', 'is_expired']);
                $table->index('expires_at');
                $table->index(['recipient', 'created_at']);
            });
        }

        if (!Schema::hasTable('login_histories')) {
            // Create login history table
            Schema::create('login_histories', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('user_id');
                $table->foreign('user_id')
                    ->references('id')
                    ->on('users')
                    ->onDelete('cascade')
                    ->onUpdate('cascade');

                $table->enum('event_type', [
                    'LOGIN_SUCCESS',
                    'LOGIN_FAILED',
                    'LOGOUT',
                    'PASSWORD_CHANGED',
                    'MFA_ENABLED',
                    'MFA_DISABLED',
                    'ACCOUNT_LOCKED',
                    'ACCOUNT_UNLOCKED'
                ]);

                $table->string('ip_address', 45)->nullable();
                $table->string('user_agent')->nullable();
                $table->string('device_id')->nullable();
                $table->string('device_name')->nullable();
                $table->enum('device_type', ['web', 'ios', 'android', 'desktop'])->default('web');

                $table->string('country')->nullable();
                $table->string('city')->nullable();
                $table->decimal('latitude', 10, 8)->nullable();
                $table->decimal('longitude', 11, 8)->nullable();

                $table->string('browser')->nullable();
                $table->string('browser_version')->nullable();
                $table->string('platform')->nullable();

                $table->text('details')->nullable()->comment('JSON details about the event');
                $table->boolean('is_suspicious')->default(false);
                $table->string('suspicious_reason')->nullable();

                $table->uuid('related_session_id')->nullable()->comment('Link to session if applicable');
                $table->uuid('related_token_id')->nullable()->comment('Link to personal access token');

                $table->timestamps();

                // Indexes
                $table->index(['user_id', 'event_type', 'created_at']);
                $table->index('ip_address');
                $table->index('device_id');
                $table->index('is_suspicious');
                $table->index('created_at');
            });
        }

        if (!Schema::hasTable('security_logs')) {
            // Create security logs table
            Schema::create('security_logs', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('user_id')->nullable();
                $table->foreign('user_id')
                    ->references('id')
                    ->on('users')
                    ->onDelete('set null')
                    ->onUpdate('cascade');
                
                $table->enum('severity', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
                $table->string('action');
                $table->text('description');
                $table->string('ip_address', 45)->nullable();
                $table->string('user_agent')->nullable();
                
                $table->json('old_values')->nullable();
                $table->json('new_values')->nullable();
                $table->json('metadata')->nullable();
                
                $table->uuid('affected_user_id')->nullable()->comment('User affected by this action');
                $table->string('affected_table')->nullable();
                $table->uuid('affected_record_id')->nullable();
                
                $table->timestamps();
                
                // Indexes
                $table->index(['user_id', 'severity', 'created_at']);
                $table->index('severity');
                $table->index('action');
                $table->index('affected_user_id');
                $table->index('created_at');
            });
        }

        if (!Schema::hasTable('password_history')) {
            // Create password history table (for password rotation policy)
            Schema::create('password_history', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('user_id');
                $table->foreign('user_id')
                    ->references('id')
                    ->on('users')
                    ->onDelete('cascade')
                    ->onUpdate('cascade');
                
                $table->string('password_hash');
                $table->timestamp('changed_at')->useCurrent();
                $table->string('changed_by_ip')->nullable();
                $table->uuid('changed_by_user')->nullable();
                $table->boolean('is_current')->default(false);
                
                $table->timestamps();
                
                // Indexes
                $table->index(['user_id', 'changed_at']);
                $table->index('is_current');
            });
        }

        if (!Schema::hasTable('user_permissions')) {
            // Create user permissions table for granular access control
            Schema::create('user_permissions', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('user_id');
                $table->foreign('user_id')
                    ->references('id')
                    ->on('users')
                    ->onDelete('cascade')
                    ->onUpdate('cascade');
                
                $table->string('permission');
                $table->boolean('is_allowed')->default(true);
                $table->text('restrictions')->nullable()->comment('JSON restrictions for this permission');
                $table->timestamp('granted_at')->useCurrent();
                $table->uuid('granted_by')->nullable();
                $table->timestamp('expires_at')->nullable();
                $table->string('grant_reason')->nullable();
                
                $table->timestamps();
                
                // Unique constraint
                $table->unique(['user_id', 'permission']);
                
                // Indexes
                $table->index(['user_id', 'is_allowed']);
                $table->index('permission');
                $table->index('expires_at');
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('users');
        // Drop tables in reverse order
        Schema::dropIfExists('user_permissions');
        Schema::dropIfExists('password_history');
        Schema::dropIfExists('security_logs');
        Schema::dropIfExists('login_histories');
        Schema::dropIfExists('verification_codes');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('personal_access_tokens');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
        Schema::dropIfExists('persons');
    }
};
