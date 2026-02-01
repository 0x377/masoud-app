<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('credit_cards')) {
            Schema::create('credit_cards', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('user_id');
                $table->uuid('person_id')->nullable();
                $table->string('card_holder_name');
                $table->string('card_number')->unique();
                $table->string('last_four', 4);
                $table->string('expiry_month', 2);
                $table->string('expiry_year', 4);
                $table->string('cvv_hash');
                $table->string('card_type'); // visa, mastercard, mada
                $table->string('issuing_bank');
                $table->boolean('is_default')->default(false);
                $table->boolean('is_active')->default(true);
                $table->timestamp('verified_at')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
                
                // Foreign keys
                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('person_id')->references('person_id')->on('persons')->onDelete('cascade');
                
                // Indexes
                $table->index(['user_id', 'is_default']);
                $table->index('card_number');
                $table->index(['expiry_year', 'expiry_month']);
            });
        }
        Schema::create('credit_cards', function (Blueprint $table) {
            $table->uuid('id')->primary();
            
            // Correct foreign key - reference 'id' not 'person_id'
            $table->uuid('person_id');
            $table->foreign('person_id')
                  ->references('id')  // Changed from 'person_id' to 'id'
                  ->on('persons')
                  ->onDelete('cascade')
                  ->onUpdate('cascade');
            
            // Card Information
            $table->string('card_holder_name');
            $table->string('card_number');
            $table->enum('card_type', [
                'VISA',
                'MASTERCARD',
                'AMEX',
                'MADA',
                'OTHER'
            ]);
            
            $table->string('expiry_month', 2);
            $table->string('expiry_year', 4);
            $table->string('cvv_hash')->nullable()->comment('Hashed CVV for security');
            $table->string('last_four', 4);
            
            // Billing Address
            $table->json('billing_address')->nullable()->comment('JSON with address details');
            
            // Bank Information
            $table->string('bank_name')->nullable();
            $table->string('bank_country')->nullable();
            $table->string('issuer')->nullable();
            
            // Status & Verification
            $table->enum('status', [
                'PENDING_VERIFICATION',
                'ACTIVE',
                'SUSPENDED',
                'EXPIRED',
                'CANCELLED'
            ])->default('PENDING_VERIFICATION');
            
            $table->boolean('is_default')->default(false);
            $table->boolean('is_verified')->default(false);
            $table->timestamp('verified_at')->nullable();
            $table->uuid('verified_by')->nullable();
            
            $table->integer('failed_attempts')->default(0);
            $table->timestamp('locked_until')->nullable();
            
            // Tokenization for PCI Compliance
            $table->string('token')->unique()->nullable()->comment('Payment gateway token');
            $table->string('gateway_customer_id')->nullable();
            $table->string('gateway_card_id')->nullable();
            
            // Usage Limits
            $table->decimal('daily_limit', 15, 2)->nullable();
            $table->decimal('transaction_limit', 15, 2)->nullable();
            $table->decimal('monthly_limit', 15, 2)->nullable();
            
            // Statistics
            $table->integer('transaction_count')->default(0);
            $table->decimal('total_spent', 15, 2)->default(0);
            $table->timestamp('last_used_at')->nullable();
            
            // 3D Secure Configuration
            $table->boolean('three_d_secure_enabled')->default(true);
            $table->json('three_d_secure_data')->nullable();
            
            // Recurring Payments
            $table->boolean('allow_recurring')->default(false);
            $table->json('recurring_settings')->nullable();
            
            // Security Features
            $table->json('security_rules')->nullable()->comment('Custom security rules');
            $table->json('allowed_merchants')->nullable()->comment('Whitelisted merchants');
            $table->json('blocked_categories')->nullable()->comment('Blocked transaction categories');
            
            // Metadata
            $table->json('metadata')->nullable();
            $table->json('risk_score_data')->nullable()->comment('Risk assessment data');
            
            // Audit Trail
            $table->uuid('created_by')->nullable();
            $table->uuid('updated_by')->nullable();
            $table->timestamps();
            $table->softDeletes();
            
            // Advanced Indexes
            $table->index(['person_id', 'status']);
            $table->index(['card_type', 'is_default']);
            $table->index('last_used_at');
            $table->index('created_at');
            $table->index(['is_verified', 'status']);
            $table->index('token');
            
            // Full-text search on card holder name
            $table->fullText(['card_holder_name']);
        });

        // Add generated column for expiry date
        DB::statement('
            ALTER TABLE credit_cards 
            ADD COLUMN expiry_date DATE 
            GENERATED ALWAYS AS (STR_TO_DATE(CONCAT(expiry_year, "-", expiry_month, "-01"), "%Y-%m-%d")) 
            VIRTUAL
        ');

        // Add generated column for is_expired
        DB::statement('
            ALTER TABLE credit_cards 
            ADD COLUMN is_expired BOOLEAN 
            GENERATED ALWAYS AS (expiry_date < CURDATE()) 
            VIRTUAL
        ');

        // Create card_usage_logs table
        Schema::create('card_usage_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('credit_card_id');
            $table->foreign('credit_card_id')
                  ->references('id')
                  ->on('credit_cards')
                  ->onDelete('cascade')
                  ->onUpdate('cascade');
            
            $table->enum('transaction_type', [
                'DONATION',
                'PAYMENT',
                'VERIFICATION',
                'REFUND',
                'AUTHORIZATION',
                'DECLINE'
            ]);
            
            $table->decimal('amount', 15, 2)->nullable();
            $table->string('currency', 3)->default('SAR');
            
            $table->string('merchant_name')->nullable();
            $table->string('merchant_category')->nullable();
            $table->string('merchant_country')->nullable();
            
            $table->enum('status', [
                'SUCCESS',
                'FAILED',
                'PENDING',
                'DECLINED',
                'REFUNDED'
            ]);
            
            $table->string('gateway_transaction_id')->nullable();
            $table->string('gateway_response_code')->nullable();
            $table->text('gateway_response_message')->nullable();
            
            $table->json('request_data')->nullable()->comment('Original request data');
            $table->json('response_data')->nullable()->comment('Gateway response data');
            
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->string('device_id')->nullable();
            $table->string('device_fingerprint')->nullable();
            
            $table->json('risk_indicators')->nullable()->comment('Risk assessment indicators');
            $table->decimal('risk_score', 5, 2)->nullable();
            $table->boolean('is_suspicious')->default(false);
            $table->string('suspicious_reason')->nullable();
            
            $table->boolean('is_reviewed')->default(false);
            $table->uuid('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            
            $table->json('metadata')->nullable();
            
            $table->timestamps();
            
            // Indexes
            $table->index(['credit_card_id', 'created_at']);
            $table->index('transaction_type');
            $table->index('status');
            $table->index('merchant_name');
            $table->index('is_suspicious');
            $table->index('gateway_transaction_id');
            $table->index('created_at');
        });

        // Create card_verification_attempts table
        Schema::create('card_verification_attempts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('credit_card_id');
            $table->foreign('credit_card_id')
                  ->references('id')
                  ->on('credit_cards')
                  ->onDelete('cascade')
                  ->onUpdate('cascade');
            
            $table->enum('verification_method', [
                'ZERO_AMOUNT',
                'MICRO_DEPOSIT',
                'OTP',
                '3D_SECURE',
                'MANUAL'
            ]);
            
            $table->enum('status', [
                'INITIATED',
                'PENDING',
                'COMPLETED',
                'FAILED',
                'EXPIRED'
            ])->default('INITIATED');
            
            $table->string('verification_code')->nullable();
            $table->timestamp('code_expires_at')->nullable();
            
            $table->decimal('amount', 8, 2)->nullable()->comment('For micro-deposits');
            $table->string('transaction_id')->nullable();
            
            $table->integer('attempts')->default(0);
            $table->timestamp('last_attempt_at')->nullable();
            
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->string('device_fingerprint')->nullable();
            
            $table->json('request_data')->nullable();
            $table->json('response_data')->nullable();
            
            $table->text('failure_reason')->nullable();
            
            $table->timestamps();
            
            // Indexes
            $table->index(['credit_card_id', 'status']);
            $table->index('verification_method');
            $table->index('code_expires_at');
            $table->index('created_at');
        });

        // Create card_limit_overrides table for special cases
        Schema::create('card_limit_overrides', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('credit_card_id');
            $table->foreign('credit_card_id')
                  ->references('id')
                  ->on('credit_cards')
                  ->onDelete('cascade')
                  ->onUpdate('cascade');
            
            $table->enum('limit_type', [
                'DAILY',
                'TRANSACTION',
                'MONTHLY',
                'CATEGORY',
                'MERCHANT'
            ]);
            
            $table->decimal('new_limit', 15, 2);
            $table->string('currency', 3)->default('SAR');
            
            $table->timestamp('effective_from')->nullable();
            $table->timestamp('effective_until')->nullable();
            
            $table->text('reason');
            $table->uuid('approved_by');
            
            $table->boolean('is_active')->default(true);
            $table->timestamp('deactivated_at')->nullable();
            $table->uuid('deactivated_by')->nullable();
            $table->text('deactivation_reason')->nullable();
            
            $table->json('conditions')->nullable()->comment('Additional conditions for override');
            
            $table->timestamps();
            
            // Indexes
            $table->index(['credit_card_id', 'is_active']);
            $table->index('limit_type');
            $table->index('effective_from');
            $table->index('effective_until');
        });

        // Create stored procedures for card management
        DB::unprepared('
            CREATE PROCEDURE sp_deactivate_expired_cards()
            BEGIN
                UPDATE credit_cards 
                SET status = "EXPIRED",
                    updated_at = NOW()
                WHERE is_expired = 1 
                AND status = "ACTIVE";
            END
        ');

        DB::unprepared('
            CREATE TRIGGER tr_before_card_insert
            BEFORE INSERT ON credit_cards
            FOR EACH ROW
            BEGIN
                -- Ensure only one default card per person
                IF NEW.is_default = 1 THEN
                    UPDATE credit_cards 
                    SET is_default = 0 
                    WHERE person_id = NEW.person_id 
                    AND is_default = 1 
                    AND status = "ACTIVE";
                END IF;
                
                -- Set last four digits
                IF NEW.card_number IS NOT NULL THEN
                    SET NEW.last_four = RIGHT(NEW.card_number, 4);
                END IF;
            END
        ');

        DB::unprepared('
            CREATE TRIGGER tr_before_card_update
            BEFORE UPDATE ON credit_cards
            FOR EACH ROW
            BEGIN
                -- Prevent changing card number if already set
                IF OLD.card_number IS NOT NULL AND NEW.card_number != OLD.card_number THEN
                    SIGNAL SQLSTATE "45000" 
                    SET MESSAGE_TEXT = "Cannot change card number once set";
                END IF;
                
                -- Handle default card change
                IF NEW.is_default = 1 AND OLD.is_default = 0 THEN
                    UPDATE credit_cards 
                    SET is_default = 0 
                    WHERE person_id = NEW.person_id 
                    AND id != NEW.id 
                    AND is_default = 1 
                    AND status = "ACTIVE";
                END IF;
            END
        ');
    }

    public function down()
    {
        // Drop stored procedures and triggers first
        DB::unprepared('DROP TRIGGER IF EXISTS tr_before_card_update');
        DB::unprepared('DROP TRIGGER IF EXISTS tr_before_card_insert');
        DB::unprepared('DROP PROCEDURE IF EXISTS sp_deactivate_expired_cards');
        
        // Drop tables in reverse order
        Schema::dropIfExists('card_limit_overrides');
        Schema::dropIfExists('card_verification_attempts');
        Schema::dropIfExists('card_usage_logs');
        Schema::dropIfExists('credit_cards');
    }
};
