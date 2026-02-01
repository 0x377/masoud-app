<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class RegisterRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }
    
    public function rules()
    {
        return [
            'national_id' => 'required|string|unique:users,national_id|size:10',
            'full_name_arabic' => 'required|string|max:255',
            'full_name_english' => 'nullable|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
            'gender' => 'required|in:M,F',
            'birth_date' => 'nullable|date',
            'phone_number' => 'required|string|unique:users,phone_number',
            'user_type' => 'sometimes|in:FAMILY_MEMBER,BOARD_MEMBER,EXECUTIVE,FINANCE_MANAGER,SOCIAL_COMMITTEE,CULTURAL_COMMITTEE,RECONCILIATION_COMMITTEE,SPORTS_COMMITTEE,MEDIA_CENTER',
        ];
    }
    
    public function messages()
    {
        return [
            'national_id.required' => 'رقم الهوية الوطنية مطلوب',
            'national_id.unique' => 'رقم الهوية الوطنية مسجل مسبقاً',
            'national_id.size' => 'رقم الهوية الوطنية يجب أن يكون 10 أرقام',
            'full_name_arabic.required' => 'الاسم باللغة العربية مطلوب',
            'email.required' => 'البريد الإلكتروني مطلوب',
            'email.unique' => 'البريد الإلكتروني مسجل مسبقاً',
            'password.required' => 'كلمة المرور مطلوبة',
            'password.min' => 'كلمة المرور يجب أن تكون على الأقل 8 أحرف',
            'password.confirmed' => 'تأكيد كلمة المرور غير مطابق',
            'gender.required' => 'الجنس مطلوب',
            'phone_number.required' => 'رقم الجوال مطلوب',
            'phone_number.unique' => 'رقم الجوال مسجل مسبقاً',
        ];
    }
}
