<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        if (!Schema::hasTable('family_relationships')) {
            Schema::create('family_relationships', function (Blueprint $table) {
                $table->uuid('relationship_id')->primary();
                $table->uuid('person_id');
                $table->uuid('related_person_id');
                $table->enum('relationship_type', [
                    'FATHER', 'MOTHER', 'SON', 'DAUGHTER',
                    'HUSBAND', 'WIFE', 'BROTHER', 'SISTER',
                    'GRANDFATHER', 'GRANDMOTHER', 'GRANDSON', 'GRANDDAUGHTER',
                    'UNCLE', 'AUNT', 'NEPHEW', 'NIECE',
                    'COUSIN'
                ]);
                $table->boolean('is_biological')->default(true);
                $table->date('start_date')->nullable();
                $table->date('end_date')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();

                // Foreign keys
                $table->foreign('person_id')->references('person_id')->on('persons')->onDelete('cascade');
                $table->foreign('related_person_id')->references('person_id')->on('persons')->onDelete('cascade');
                
                // Unique constraint
                $table->unique(['person_id', 'related_person_id', 'relationship_type']);
                
                // Indexes
                $table->index('person_id');
                $table->index('related_person_id');
                $table->index('relationship_type');
                $table->index(['start_date', 'end_date']);
            });
        }
    }

    public function down()
    {
        Schema::dropIfExists('family_relationships');
    }
};
