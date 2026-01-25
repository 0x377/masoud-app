<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AddFamilyMemberRequest extends FormRequest
{
    public function authorize()
    {
        return $this->user() && $this->user()->canAccessFamilyArchive();
    }
    
    public function rules()
    {
        return [
            'national_id' => 'required|string|unique:persons,national_id|size:10',
            'full_name_arabic' => 'required|string|max:255',
            'full_name_english' => 'nullable|string|max:255',
            'gender' => 'required|in:M,F',
            'birth_date' => 'required|date',
            'birth_place' => 'nullable|string|max:100',
            'phone_number' => 'required|string|max:20',
            'email' => 'required|email|unique:persons,email',
            'blood_type' => 'nullable|string|in:A+,A-,B+,B-,AB+,AB-,O+,O-',
            'current_address' => 'nullable|string|max:500',
            'father_id' => 'nullable|exists:persons,person_id',
            'mother_id' => 'nullable|exists:persons,person_id',
            'password' => 'required|string|min:8',
        ];
    }
    
    public function messages()
    {
        return [
            'national_id.required' => 'رقم الهوية الوطنية مطلوب',
            'national_id.unique' => 'رقم الهوية الوطنية مسجل مسبقاً',
            'full_name_arabic.required' => 'الاسم بالعربية مطلوب',
            'gender.required' => 'الجنس مطلوب',
            'birth_date.required' => 'تاريخ الميلاد مطلوب',
            'phone_number.required' => 'رقم الجوال مطلوب',
            'email.required' => 'البريد الإلكتروني مطلوب',
            'email.unique' => 'البريد الإلكتروني مسجل مسبقاً',
            'father_id.exists' => 'الأب غير موجود في سجل العائلة',
            'mother_id.exists' => 'الأم غير موجودة في سجل العائلة',
        ];
    }
}
