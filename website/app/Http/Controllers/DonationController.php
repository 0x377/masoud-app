<?php

namespace App\Http\Controllers;

use App\Http\Requests\CreateDonationRequest;
use \Illuminate\Support\Str;
use App\Models\Donation;
use App\Models\CreditCard;
use App\Services\PaymentService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class DonationController extends Controller
{
    protected $paymentService;

    public function __construct(PaymentService $paymentService)
    {
        $this->paymentService = $paymentService;
    }

    /**
     * عرض جميع التبرعات (مفتوح للجميع)
     */
    public function index(Request $request)
    {
        $query = Donation::query();
        
        // فلترة حسب النوع
        if ($request->has('type')) {
            $query->where('donation_type', $request->type);
        }
        
        // فلترة حسب الحالة
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        
        // فلترة حسب النطاق الزمني
        if ($request->has('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        
        if ($request->has('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }
        
        // للمتبرع: يرى فقط تبرعاته
        if ($request->user()) {
            $user = $request->user();
            if ($user->user_type === 'FAMILY_MEMBER' || !$user->canAccessBoardSection()) {
                $query->where('donor_id', $user->id);
            }
        } else {
            // للزوار: يروا فقط التبرعات العامة
            $query->where('is_anonymous', false)
                  ->where('status', 'COMPLETED');
        }
        
        $donations = $query->with(['donor.person'])
            ->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 15));

        return response()->json([
            'donations' => $donations,
            'summary' => $this->getDonationsSummary($request)
        ]);
    }

    /**
     * إنشاء تبرع جديد (مفتوح للجميع)
     */
    public function store(CreateDonationRequest $request)
    {
        DB::beginTransaction();
        
        try {
            $user = $request->user();
            $isGuest = !$user;
            
            $donationData = [
                'id' => Str::uuid(),
                'amount' => $request->amount,
                'payment_method' => $request->payment_method,
                'donation_type' => $request->donation_type,
                'purpose' => $request->purpose,
                'is_anonymous' => $request->boolean('is_anonymous'),
                'notes' => $request->notes,
                'metadata' => [
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'is_guest' => $isGuest,
                ]
            ];

            // إذا كان المستخدم مسجلاً
            if ($user) {
                $donationData['donor_id'] = $user->id;
                $donationData['person_id'] = $user->person?->person_id;
            } else {
                // للزوار: نحتاج معلومات المتبرع
                $donationData['metadata']['guest_info'] = [
                    'name' => $request->guest_name,
                    'email' => $request->guest_email,
                    'phone' => $request->guest_phone,
                ];
            }

            $donation = Donation::create($donationData);

            // معالجة الدفع
            $paymentResult = $this->processPayment($donation, $request);
            
            if (!$paymentResult['success']) {
                throw new \Exception($paymentResult['message']);
            }

            $donation->update([
                'status' => 'COMPLETED',
                'transaction_id' => $paymentResult['transaction_id'],
                'paid_at' => now(),
            ]);

            DB::commit();

            // إرسال إشعار/رسالة شكر
            $this->sendDonationConfirmation($donation);

            return response()->json([
                'message' => 'شكراً لك على تبرعك',
                'donation' => $donation,
                'receipt' => $this->generateReceipt($donation)
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            
            if (isset($donation)) {
                $donation->update(['status' => 'FAILED']);
            }
            
            return response()->json([
                'message' => 'فشلت عملية التبرع',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * معالجة الدفع
     */
    private function processPayment(Donation $donation, Request $request)
    {
        switch ($donation->payment_method) {
            case 'CREDIT_CARD':
                return $this->processCreditCardPayment($donation, $request);
                
            case 'BANK_TRANSFER':
                return $this->processBankTransfer($donation);
                
            case 'MOBILE_WALLET':
                return $this->processMobileWallet($donation, $request);
                
            default:
                throw new \Exception('طريقة الدفع غير مدعومة');
        }
    }

    /**
     * معالجة الدفع بالبطاقة الائتمانية
     */
    private function processCreditCardPayment(Donation $donation, Request $request)
    {
        $user = $request->user();
        
        if ($request->has('save_card') && $user) {
            $this->saveCreditCard($user, $request);
        }
        
        $paymentData = [
            'amount' => $donation->amount,
            'card_number' => $request->card_number,
            'expiry_date' => $request->expiry_month . '/' . $request->expiry_year,
            'cvv' => $request->cvv,
            'card_holder' => $request->card_holder_name,
        ];
        
        return $this->paymentService->processCreditCardPayment($paymentData);
    }

    /**
     * معالجة التحويل البنكي
     */
    private function processBankTransfer(Donation $donation)
    {
        // توليد رقم إيصال التحويل
        $transferNumber = 'TRF-' . time() . '-' . strtoupper(substr(uniqid(), -6));
        
        return [
            'success' => true,
            'transaction_id' => $transferNumber,
            'message' => 'يرجى إتمام التحويل البنكي',
            'bank_details' => config('payment.bank_accounts'),
        ];
    }

    /**
     * حفظ البطاقة الائتمانية
     */
    private function saveCreditCard($user, Request $request)
    {
        $creditCard = CreditCard::create([
            'id' => Str::uuid(),
            'user_id' => $user->id,
            'person_id' => $user->person?->person_id,
            'card_holder_name' => $request->card_holder_name,
            'card_number' => encrypt($request->card_number),
            'last_four' => substr($request->card_number, -4),
            'expiry_month' => $request->expiry_month,
            'expiry_year' => $request->expiry_year,
            'cvv_hash' => hash('sha256', $request->cvv),
            'card_type' => $this->detectCardType($request->card_number),
            'issuing_bank' => $request->issuing_bank,
            'is_default' => !CreditCard::where('user_id', $user->id)->exists(),
        ]);
        
        return $creditCard;
    }

    /**
     * كشف نوع البطاقة
     */
    private function detectCardType($cardNumber)
    {
        $firstDigit = substr($cardNumber, 0, 1);
        
        switch ($firstDigit) {
            case '4': return 'visa';
            case '5': return 'mastercard';
            case '6': return 'discover';
            default: return 'other';
        }
    }

    /**
     * إحصائيات التبرعات
     */
    public function statistics(Request $request)
    {
        $summary = $this->getDonationsSummary($request, true);
        
        return response()->json([
            'statistics' => $summary,
            'top_donors' => $this->getTopDonors(),
            'recent_donations' => Donation::where('status', 'COMPLETED')
                ->with(['donor.person'])
                ->orderBy('paid_at', 'desc')
                ->limit(10)
                ->get()
        ]);
    }

    /**
     * الحصول على ملخص التبرعات
     */
    private function getDonationsSummary(Request $request, $detailed = false)
    {
        $query = Donation::query();
        
        if ($request->has('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        
        if ($request->has('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }
        
        $totalDonations = $query->count();
        $totalAmount = $query->sum('amount');
        $completedAmount = $query->where('status', 'COMPLETED')->sum('amount');
        
        $summary = [
            'total_donations' => $totalDonations,
            'total_amount' => $totalAmount,
            'completed_amount' => $completedAmount,
            'average_donation' => $totalDonations > 0 ? $totalAmount / $totalDonations : 0,
        ];
        
        if ($detailed) {
            $summary['by_type'] = Donation::select('donation_type', DB::raw('COUNT(*) as count'), DB::raw('SUM(amount) as total'))
                ->where('status', 'COMPLETED')
                ->groupBy('donation_type')
                ->get();
            
            $summary['by_month'] = Donation::select(
                DB::raw("DATE_TRUNC('month', created_at) as month"),
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(amount) as total')
            )
                ->where('status', 'COMPLETED')
                ->groupBy(DB::raw("DATE_TRUNC('month', created_at)"))
                ->orderBy('month', 'desc')
                ->limit(12)
                ->get();
        }
        
        return $summary;
    }

    /**
     * الحصول على أكبر المتبرعين
     */
    private function getTopDonors($limit = 10)
    {
        return Donation::select('donor_id', DB::raw('SUM(amount) as total_donated'), DB::raw('COUNT(*) as donation_count'))
            ->where('status', 'COMPLETED')
            ->whereNotNull('donor_id')
            ->groupBy('donor_id')
            ->with(['donor.person'])
            ->orderBy('total_donated', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * إرسال تأكيد التبرع
     */
    private function sendDonationConfirmation(Donation $donation)
    {
        // إرسال بريد إلكتروني
        if ($donation->donor?->email) {
            \Illuminate\Support\Facades\Mail::to($donation->donor->email)
                ->send(new \App\Mail\DonationConfirmation($donation));
        }
        
        // إرسال رسالة SMS
        if ($donation->donor?->phone_number) {
            $this->sendSMSConfirmation($donation);
        }
    }

    /**
     * توليد إيصال التبرع
     */
    private function generateReceipt(Donation $donation)
    {
        return [
            'receipt_number' => 'REC-' . $donation->id,
            'donation_date' => $donation->paid_at->format('Y-m-d H:i:s'),
            'donor_name' => $donation->is_anonymous ? 'متبرع مجهول' : ($donation->donor?->full_name_arabic ?? 'ضيف'),
            'amount' => number_format($donation->amount, 2),
            'transaction_id' => $donation->transaction_id,
            'purpose' => $donation->purpose,
            'tax_deductible' => true,
            'thank_you_message' => 'شكراً لك على دعمك وتعاونك مع عائلتنا الكريمة',
        ];
    }
}
