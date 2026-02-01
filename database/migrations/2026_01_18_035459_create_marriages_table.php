<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('marriages', function (Blueprint $table) {
            $table->uuid('marriage_id')->primary();
            $table->uuid('husband_id');
            $table->uuid('wife_id');
            $table->date('marriage_date');
            $table->string('marriage_contract_number')->nullable();
            $table->string('marriage_location')->nullable();
            $table->enum('status', ['ACTIVE', 'DIVORCED', 'ANNULED', 'WIDOWED'])->default('ACTIVE');
            $table->date('divorce_date')->nullable();
            $table->integer('children_count')->default(0);
            $table->text('notes')->nullable();
            $table->json('documents')->nullable(); // Store marriage documents
            $table->timestamps();
            
            // Foreign keys
            $table->foreign('husband_id')->references('person_id')->on('persons');
            $table->foreign('wife_id')->references('person_id')->on('persons');
            
            // Constraints
            $table->unique(['husband_id', 'wife_id', 'marriage_date']);
            
            // Indexes
            $table->index('husband_id');
            $table->index('wife_id');
            $table->index(['marriage_date', 'divorce_date']);
            $table->index('status');
        });
        if (!Schema::hasTable('marriages')) {
            Schema::create('marriages', function (Blueprint $table) {
                $table->uuid('marriage_id')->primary();
                $table->uuid('husband_id');
                $table->uuid('wife_id');
                $table->date('marriage_date');
                $table->string('marriage_contract_number')->nullable();
                $table->string('marriage_location')->nullable();
                $table->enum('status', ['ACTIVE', 'DIVORCED', 'ANNULED', 'WIDOWED'])->default('ACTIVE');
                $table->date('divorce_date')->nullable();
                $table->integer('children_count')->default(0);
                $table->text('notes')->nullable();
                $table->json('documents')->nullable(); // Store marriage documents
                $table->timestamps();

                // Foreign keys
                $table->foreign('husband_id')->references('person_id')->on('persons');
                $table->foreign('wife_id')->references('person_id')->on('persons');

                // Constraints
                $table->unique(['husband_id', 'wife_id', 'marriage_date']);

                // Indexes
                $table->index('husband_id');
                $table->index('wife_id');
                $table->index(['marriage_date', 'divorce_date']);
                $table->index('status');
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('marriages');
    }
};
