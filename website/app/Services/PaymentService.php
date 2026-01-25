<?php

namespace App\Services;

use App\Models\CreditCard;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PaymentService
{
    protected $gatewayUrl;
    protected $apiKey;
    protected $apiSecret;
    
    public function __construct()
    {
        $this->gatewayUrl = config('payment.gateway_url');
        $this->apiKey = config('payment.api_key');
        $this->apiSecret = config('payment.api_secret');
    }
    
    /**
     * معالجة الدفع بالبطاقة الائتمانية
     */
    public function processCreditCardPayment(array $paymentData)
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ])->post($this->gatewayUrl . '/payments', [
                'amount' => $paymentData['amount'],
                'currency' => 'SAR',
                'card_number' => $paymentData['card_number'],
                'expiry_date' => $paymentData['expiry_date'],
                'cvv' => $paymentData['cvv'],
                'card_holder' => $paymentData['card_holder'],
                'description' => 'تبرع عائلة',
                'metadata' => [
                    'service' => 'family-donation',
                    'timestamp' => now()->toIso8601String(),
                ],
            ]);
            
            if ($response->successful()) {
                $result = $response->json();
                
                return [
                    'success' => true,
                    'transaction_id' => $result['transaction_id'],
                    'reference_number' => $result['reference'],
                    'amount' => $result['amount'],
                    'currency' => $result['currency'],
                    'status' => $result['status'],
                    'timestamp' => $result['timestamp'],
                ];
            } else {
                Log::error('Payment failed', [
                    'status' => $response->status(),
                    'error' => $response->json(),
                ]);
                
                return [
                    'success' => false,
                    'message' => $response->json()['message'] ?? 'فشل عملية الدفع',
                    'error_code' => $response->json()['code'] ?? 'UNKNOWN_ERROR',
                ];
            }
            
        } catch (\Exception $e) {
            Log::error('Payment exception', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            return [
                'success' => false,
                'message' => 'خطأ في اتصال بوابة الدفع',
                'error' => $e->getMessage(),
            ];
        }
    }
    
    /**
     * التحقق من البطاقة الائتمانية
     */
    public function verifyCard(CreditCard $creditCard, $amount = 1.00)
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ])->post($this->gatewayUrl . '/verify', [
                'amount' => $amount,
                'currency' => 'SAR',
                'card_number' => decrypt($creditCard->card_number),
                'expiry_month' => $creditCard->expiry_month,
                'expiry_year' => $creditCard->expiry_year,
                'purpose' => 'card-verification',
            ]);
            
            if ($response->successful()) {
                $result = $response->json();
                
                return [
                    'success' => true,
                    'transaction_id' => $result['transaction_id'],
                    'status' => $result['status'],
                    'card_type' => $result['card_type'],
                    'issuer' => $result['issuer'],
                ];
            } else {
                return [
                    'success' => false,
                    'message' => $response->json()['message'] ?? 'فشل التحقق من البطاقة',
                ];
            }
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'خطأ في التحقق من البطاقة: ' . $e->getMessage(),
            ];
        }
    }
    
    /**
     * استرداد مبلغ مدفوع
     */
    public function refund($transactionId, $amount = null)
    {
        try {
            $payload = ['transaction_id' => $transactionId];
            
            if ($amount !== null) {
                $payload['amount'] = $amount;
            }
            
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ])->post($this->gatewayUrl . '/refunds', $payload);
            
            if ($response->successful()) {
                $result = $response->json();
                
                return [
                    'success' => true,
                    'refund_id' => $result['refund_id'],
                    'amount' => $result['amount'],
                    'status' => $result['status'],
                ];
            } else {
                return [
                    'success' => false,
                    'message' => $response->json()['message'] ?? 'فشل عملية الاسترداد',
                ];
            }
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'خطأ في عملية الاسترداد: ' . $e->getMessage(),
            ];
        }
    }
    
    /**
     * معالجة التحويل البنكي
     */
    public function processBankTransfer($transferData)
    {
        // توليد رقم إيصال فريد
        $receiptNumber = 'BANK-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -8));
        
        // إرجاع تفاصيل الحساب البنكي
        $bankAccounts = config('payment.bank_accounts', [
            [
                'bank_name' => 'البنك الأهلي السعودي',
                'account_name' => 'عائلة المسعود - التبرعات',
                'iban' => 'SA1234567890123456789012',
                'account_number' => '1234567890123',
            ]
        ]);
        
        return [
            'success' => true,
            'receipt_number' => $receiptNumber,
            'bank_accounts' => $bankAccounts,
            'instructions' => 'يرجى إرسال إيصال التحويل بعد الإتمام',
            'deadline' => now()->addDays(3)->format('Y-m-d'),
        ];
    }
    
    /**
     * معالجة المحفظة الإلكترونية
     */
    public function processMobileWallet($walletData)
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ])->post($this->gatewayUrl . '/mobile-payment', [
                'amount' => $walletData['amount'],
                'currency' => 'SAR',
                'mobile_number' => $walletData['mobile_number'],
                'wallet_type' => $walletData['wallet_type'], // stc pay, mada, apple pay, etc.
                'description' => 'تبرع عائلة',
            ]);
            
            if ($response->successful()) {
                $result = $response->json();
                
                return [
                    'success' => true,
                    'transaction_id' => $result['transaction_id'],
                    'payment_url' => $result['payment_url'],
                    'expires_at' => $result['expires_at'],
                ];
            } else {
                return [
                    'success' => false,
                    'message' => $response->json()['message'] ?? 'فشل عملية الدفع بالمحفظة',
                ];
            }
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'خطأ في عملية الدفع بالمحفظة: ' . $e->getMessage(),
            ];
        }
    }
    
    /**
     * التحقق من حالة المعاملة
     */
    public function checkTransactionStatus($transactionId)
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ])->get($this->gatewayUrl . '/transactions/' . $transactionId);
            
            if ($response->successful()) {
                return $response->json();
            } else {
                return [
                    'success' => false,
                    'message' => 'فشل الحصول على حالة المعاملة',
                ];
            }
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'خطأ في التحقق من حالة المعاملة: ' . $e->getMessage(),
            ];
        }
    }
    
    /**
     * إنشاء فاتورة
     */
    public function createInvoice($invoiceData)
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ])->post($this->gatewayUrl . '/invoices', [
                'amount' => $invoiceData['amount'],
                'currency' => 'SAR',
                'customer' => [
                    'name' => $invoiceData['customer_name'],
                    'email' => $invoiceData['customer_email'],
                    'phone' => $invoiceData['customer_phone'],
                ],
                'items' => $invoiceData['items'],
                'due_date' => $invoiceData['due_date'] ?? now()->addDays(7)->format('Y-m-d'),
                'description' => $invoiceData['description'] ?? 'فاتورة تبرع',
                'metadata' => [
                    'family_id' => $invoiceData['family_id'] ?? null,
                    'purpose' => $invoiceData['purpose'] ?? 'donation',
                ],
            ]);
            
            if ($response->successful()) {
                $result = $response->json();
                
                return [
                    'success' => true,
                    'invoice_id' => $result['invoice_id'],
                    'invoice_number' => $result['invoice_number'],
                    'amount' => $result['amount'],
                    'due_date' => $result['due_date'],
                    'status' => $result['status'],
                    'payment_url' => $result['payment_url'],
                ];
            } else {
                return [
                    'success' => false,
                    'message' => $response->json()['message'] ?? 'فشل إنشاء الفاتورة',
                ];
            }
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'خطأ في إنشاء الفاتورة: ' . $e->getMessage(),
            ];
        }
    }
    
    /**
     * الحصول على تقارير المدفوعات
     */
    public function getPaymentReports($startDate, $endDate)
    {
        try {
            $response = Http::withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ])->get($this->gatewayUrl . '/reports', [
                'start_date' => $startDate,
                'end_date' => $endDate,
                'report_type' => 'transactions',
            ]);
            
            if ($response->successful()) {
                return [
                    'success' => true,
                    'report' => $response->json(),
                    'period' => [
                        'start_date' => $startDate,
                        'end_date' => $endDate,
                    ],
                ];
            } else {
                return [
                    'success' => false,
                    'message' => 'فشل الحصول على التقرير',
                ];
            }
            
        } catch (\Exception $e) {
            return [
                'success' => false,
                'message' => 'خطأ في الحصول على التقرير: ' . $e->getMessage(),
            ];
        }
    }
}
