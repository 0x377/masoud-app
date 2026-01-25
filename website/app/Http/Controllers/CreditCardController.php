<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCreditCardRequest;
use App\Models\CreditCard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Hash;

class CreditCardController extends Controller
{
    /**
     * عرض البطاقات الائتمانية للمستخدم
     */
    public function index(Request $request)
    {
        $user = $request->user();
        
        $creditCards = CreditCard::where('user_id', $user->id)
            ->where('is_active', true)
            ->orderBy('is_default', 'desc')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function($card) {
                return $this->maskCardDetails($card);
            });
        
        return response()->json([
            'credit_cards' => $creditCards,
            'total_cards' => $creditCards->count(),
            'has_default' => $creditCards->where('is_default', true)->count() > 0,
        ]);
    }
    
    /**
     * إضافة بطاقة ائتمانية جديدة
     */
    public function store(StoreCreditCardRequest $request)
    {
        $user = $request->user();
        
        // التحقق من أن البطاقة ليست مسجلة مسبقاً
        $existingCard = CreditCard::where('last_four', substr($request->card_number, -4))
            ->where('user_id', $user->id)
            ->exists();
            
        if ($existingCard) {
            return response()->json([
                'message' => 'هذه البطاقة مسجلة مسبقاً'
            ], 409);
        }
        
        DB::beginTransaction();
        
        try {
            // إذا كانت البطاقة افتراضية، إلغاء تفضيل البطاقات الأخرى
            if ($request->boolean('is_default')) {
                CreditCard::where('user_id', $user->id)
                    ->update(['is_default' => false]);
            }
            
            $creditCard = CreditCard::create([
                'id' => \Illuminate\Support\Str::uuid(),
                'user_id' => $user->id,
                'person_id' => $user->person?->person_id,
                'card_holder_name' => $request->card_holder_name,
                'card_number' => Crypt::encryptString($request->card_number),
                'last_four' => substr($request->card_number, -4),
                'expiry_month' => $request->expiry_month,
                'expiry_year' => $request->expiry_year,
                'cvv_hash' => Hash::make($request->cvv),
                'card_type' => $this->detectCardType($request->card_number),
                'issuing_bank' => $request->issuing_bank,
                'is_default' => $request->boolean('is_default') || 
                              !CreditCard::where('user_id', $user->id)->exists(),
                'is_active' => true,
                'verified_at' => now(),
            ]);
            
            // التحقق من البطاقة عبر خدمة الدفع
            $verification = $this->verifyCreditCard($creditCard, $request);
            
            if (!$verification['success']) {
                throw new \Exception($verification['message']);
            }
            
            DB::commit();
            
            return response()->json([
                'message' => 'تم إضافة البطاقة بنجاح',
                'credit_card' => $this->maskCardDetails($creditCard),
                'verification_status' => 'verified'
            ], 201);
            
        } catch (\Exception $e) {
            DB::rollBack();
            
            return response()->json([
                'message' => 'فشل إضافة البطاقة',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * حذف بطاقة ائتمانية
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        
        $creditCard = CreditCard::where('id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();
        
        // التحقق من أن المستخدم ليس لديه بطاقات أخرى إذا كانت هذه البطاقة مفضلة
        if ($creditCard->is_default) {
            $otherCards = CreditCard::where('user_id', $user->id)
                ->where('id', '!=', $id)
                ->where('is_active', true)
                ->exists();
                
            if (!$otherCards) {
                return response()->json([
                    'message' => 'لا يمكن حذف البطاقة الافتراضية الوحيدة'
                ], 422);
            }
        }
        
        $creditCard->update(['is_active' => false]);
        
        // إذا كانت البطاقة المحذوفة مفضلة، جعل بطاقة أخرى مفضلة
        if ($creditCard->is_default) {
            $newDefault = CreditCard::where('user_id', $user->id)
                ->where('id', '!=', $id)
                ->where('is_active', true)
                ->first();
                
            if ($newDefault) {
                $newDefault->update(['is_default' => true]);
            }
        }
        
        return response()->json([
            'message' => 'تم حذف البطاقة بنجاح'
        ]);
    }
    
    /**
     * تعيين بطاقة كافتراضية
     */
    public function setDefault(Request $request, $id)
    {
        $user = $request->user();
        
        DB::beginTransaction();
        
        try {
            // إلغاء تفضيل جميع البطاقات
            CreditCard::where('user_id', $user->id)
                ->update(['is_default' => false]);
            
            // تعيين البطاقة المحددة كافتراضية
            $creditCard = CreditCard::where('id', $id)
                ->where('user_id', $user->id)
                ->firstOrFail();
                
            $creditCard->update(['is_default' => true]);
            
            DB::commit();
            
            return response()->json([
                'message' => 'تم تعيين البطاقة كافتراضية',
                'credit_card' => $this->maskCardDetails($creditCard)
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            
            return response()->json([
                'message' => 'فشل تعيين البطاقة كافتراضية',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * التحقق من البطاقة الائتمانية
     */
    private function verifyCreditCard(CreditCard $creditCard, Request $request)
    {
        // هنا يمكنك استخدام خدمة الدفع للتحقق من البطاقة
        // هذا مثال بسيط
        
        try {
            $cardNumber = Crypt::decryptString($creditCard->card_number);
            
            // التحقق من صحة رقم البطاقة (Luhn algorithm)
            if (!$this->validateCardNumber($cardNumber)) {
                return [
                    'success' => false,
                    'message' => 'رقم البطاقة غير صحيح'
                ];
            }
            
            // التحقق من تاريخ الانتهاء
            $expiryDate = $creditCard->expiry_year . '-' . str_pad($creditCard->expiry_month, 2, '0', STR_PAD_LEFT);
            
            if (strtotime($expiryDate . '-01') < strtotime(date('Y-m-01'))) {
                return [
                    'success' => false,
                    'message' => 'البطاقة منتهية الصلاحية'
                ];
            }
            
            // محاولة خصم مبلغ رمزي (1 ريال) والتراجع عنه
            $paymentService = app(PaymentService::class);
            $verificationCharge = $paymentService->verifyCard($creditCard, 1.00);
            
            if ($verificationCharge['success']) {
                // رد المبلغ الرمزي
                $paymentService->refund($verificationCharge['transaction_id']);
                
                return [
                    'success' => true,
                    'message' => 'تم التحقق من البطاقة بنجاح',
                    'transaction_id' => $verificationCharge['transaction_id']
                ];
            }
            
            return [
                'success' => false,
                'message' => 'فشل التحقق من البطاقة'
            ];
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'خطأ في التحقق من البطاقة: ' . $e->getMessage()
            ];
        }
    }
    
    /**
     * التحقق من صحة رقم البطاقة باستخدام خوارزمية Luhn
     */
    private function validateCardNumber($cardNumber)
    {
        $cardNumber = preg_replace('/\D/', '', $cardNumber);
        
        $length = strlen($cardNumber);
        $sum = 0;
        $parity = $length % 2;
        
        for ($i = 0; $i < $length; $i++) {
            $digit = $cardNumber[$i];
            
            if ($i % 2 == $parity) {
                $digit *= 2;
                if ($digit > 9) {
                    $digit -= 9;
                }
            }
            
            $sum += $digit;
        }
        
        return ($sum % 10) == 0;
    }
    
    /**
     * إخفاء تفاصيل البطاقة
     */
    private function maskCardDetails(CreditCard $creditCard)
    {
        return [
            'id' => $creditCard->id,
            'card_holder_name' => $creditCard->card_holder_name,
            'masked_number' => '**** **** **** ' . $creditCard->last_four,
            'expiry_month' => $creditCard->expiry_month,
            'expiry_year' => $creditCard->expiry_year,
            'card_type' => $creditCard->card_type,
            'issuing_bank' => $creditCard->issuing_bank,
            'is_default' => $creditCard->is_default,
            'is_active' => $creditCard->is_active,
            'added_on' => $creditCard->created_at->format('Y-m-d'),
        ];
    }
    
    /**
     * كشف نوع البطاقة
     */
    private function detectCardType($cardNumber)
    {
        $firstDigit = substr($cardNumber, 0, 1);
        $firstTwoDigits = substr($cardNumber, 0, 2);
        
        if ($firstDigit == '4') {
            return 'visa';
        } elseif ($firstTwoDigits >= '51' && $firstTwoDigits <= '55') {
            return 'mastercard';
        } elseif ($firstTwoDigits == '34' || $firstTwoDigits == '37') {
            return 'amex';
        } elseif ($firstTwoDigits >= '60' && $firstTwoDigits <= '62') {
            return 'discover';
        } elseif ($firstFourDigits = substr($cardNumber, 0, 4)) {
            if ($firstFourDigits == '5081' || $firstFourDigits == '5082') {
                return 'mada';
            }
        }
        
        return 'other';
    }
}
