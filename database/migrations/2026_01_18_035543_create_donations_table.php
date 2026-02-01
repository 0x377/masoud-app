<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('donations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('donor_id'); // User ID
            $table->uuid('person_id')->nullable(); // Person ID if family member
            $table->decimal('amount', 15, 2);
            $table->enum('payment_method', ['CREDIT_CARD', 'BANK_TRANSFER', 'CASH', 'MOBILE_WALLET']);
            $table->string('transaction_id')->unique()->nullable();
            $table->enum('status', ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'])->default('PENDING');
            $table->enum('donation_type', [
                'GENERAL', // تبرع عام
                'MARRIAGE_AID', // إعانة الزواج
                'FAMILY_AID', // إعانة أسرة
                'EDUCATION', // التعليم
                'HEALTHCARE', // الرعاية الصحية
                'OTHER'
            ]);
            $table->string('purpose')->nullable();
            $table->json('metadata')->nullable();
            $table->boolean('is_anonymous')->default(false);
            $table->text('notes')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
            
            // Foreign keys
            $table->foreign('donor_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('person_id')->references('person_id')->on('persons')->onDelete('set null');
            
            // Indexes
            $table->index(['donor_id', 'status']);
            $table->index(['donation_type', 'status']);
            $table->index('paid_at');
            $table->index('transaction_id');
        });

        if (!Schema::hasTable('donations')) {
            Schema::create('donations', function (Blueprint $table) {
                $table->uuid('id')->primary();
                $table->uuid('donor_id'); // User ID
                $table->uuid('person_id')->nullable(); // Person ID if family member
                $table->decimal('amount', 15, 2);
                $table->enum('payment_method', ['CREDIT_CARD', 'BANK_TRANSFER', 'CASH', 'MOBILE_WALLET']);
                $table->string('transaction_id')->unique()->nullable();
                $table->enum('status', ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'])->default('PENDING');
                $table->enum('donation_type', [
                    'GENERAL', // تبرع عام
                    'MARRIAGE_AID', // إعانة الزواج
                    'FAMILY_AID', // إعانة أسرة
                    'EDUCATION', // التعليم
                    'HEALTHCARE', // الرعاية الصحية
                    'OTHER'
                ]);
                $table->string('purpose')->nullable();
                $table->json('metadata')->nullable();
                $table->boolean('is_anonymous')->default(false);
                $table->text('notes')->nullable();
                $table->timestamp('paid_at')->nullable();
                $table->timestamps();

                // Foreign keys
                $table->foreign('donor_id')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('person_id')->references('person_id')->on('persons')->onDelete('set null');

                // Indexes
                $table->index(['donor_id', 'status']);
                $table->index(['donation_type', 'status']);
                $table->index('paid_at');
                $table->index('transaction_id');
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('donations');
    }
};
