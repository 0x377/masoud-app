<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CreateDonationRequest extends FormRequest
{
    public function authorize()
    {
        return true; // مفتوح للجميع
    }
    
    public function rules()
    {
        $rules = [
            'amount' => 'required|numeric|min:50|max:100000',
            'payment_method' => 'required|in:CREDIT_CARD,BANK_TRANSFER,MOBILE_WALLET',
            'donation_type' => 'required|in:GENERAL,MARRIAGE_AID,FAMILY_AID,EDUCATION,HEALTHCARE,OTHER',
            'purpose' => 'nullable|string|max:500',
            'is_anonymous' => 'sometimes|boolean',
            'notes' => 'nullable|string|max:1000',
        ];
        
        // إذا كان المستخدم غير مسجل، نحتاج معلوماته
        if (!$this->user()) {
            $rules['guest_name'] = 'required|string|max:255';
            $rules['guest_email'] = 'required|email';
            $rules['guest_phone'] = 'required|string|max:20';
        }
        
        // إذا كانت طريقة الدفع بطاقة ائتمانية
        if ($this->payment_method === 'CREDIT_CARD') {
            $rules['card_number'] = 'required|string|size:16';
            $rules['expiry_month'] = 'required|string|size:2';
            $rules['expiry_year'] = 'required|string|size:4';
            $rules['cvv'] = 'required|string|size:3';
            $rules['card_holder_name'] = 'required|string|max:255';
            $rules['save_card'] = 'sometimes|boolean';
        }
        
        // إذا كانت طريقة الدفع محفظة إلكترونية
        if ($this->payment_method === 'MOBILE_WALLET') {
            $rules['mobile_number'] = 'required|string|max:20';
            $rules['wallet_type'] = 'required|in:STC_PAY,MADA,APPLE_PAY,GOOGLE_PAY';
        }
        
        return $rules;
    }
    
    public function messages()
    {
        return [
            'amount.required' => 'المبلغ المطلوب',
            'amount.min' => 'الحد الأدنى للمبلغ 50 ريال',
            'amount.max' => 'الحد الأقصى للمبلغ 100,000 ريال',
            'payment_method.required' => 'طريقة الدفع مطلوبة',
            'guest_name.required' => 'الاسم مطلوب للزوار',
            'guest_email.required' => 'البريد الإلكتروني مطلوب للزوار',
            'guest_phone.required' => 'رقم الجوال مطلوب للزوار',
            'card_number.required' => 'رقم البطاقة مطلوب',
            'card_number.size' => 'رقم البطاقة يجب أن يكون 16 رقم',
            'cvv.required' => 'رمز الأمان مطلوب',
            'cvv.size' => 'رمز الأمان يجب أن يكون 3 أرقام',
        ];
    }
}
