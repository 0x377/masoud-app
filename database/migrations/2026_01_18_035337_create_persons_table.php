<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('persons', function (Blueprint $table) {
            $table->uuid('person_id')->primary();
            $table->string('national_id', 14)->unique();
            $table->string('full_name_arabic');
            $table->enum('gender', ['M', 'F']);
            $table->date('birth_date')->nullable();
            $table->string('birth_place')->nullable();
            $table->date('death_date')->nullable();
            $table->boolean('is_alive')->default(true);
            $table->string('blood_type', 5)->nullable();
            $table->string('phone_number', 20)->nullable();
            $table->string('email')->nullable();
            $table->text('current_address')->nullable();
            $table->string('photo_path')->nullable();
            $table->json('additional_info')->nullable();
            $table->timestamps();

            // Indexes
            $table->index('gender');
            $table->index('birth_date');
            $table->index('national_id');
            $table->index(['is_alive', 'gender']);
        });
    }

    public function down()
    {
        Schema::dropIfExists('persons');
    }
};
