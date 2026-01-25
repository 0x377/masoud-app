<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use App\Mail\PasswordResetMail;
use App\Mail\PasswordResetRequestedMail;

class PasswordResetLinkController extends Controller
{
    /**
     * Display the password reset link request view (Web).
     */
    public function create(): Response
    {
        return Inertia::render('Auth/ForgotPassword', [
            'status' => session('status'),
            'csrf_token' => csrf_token(),
            'max_attempts' => config('auth.password_reset.max_attempts', 3),
            'cooldown_minutes' => config('auth.password_reset.cooldown', 5),
        ]);
    }

    /**
     * Handle an incoming password reset link request (Web).
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'email' => 'required|email|exists:users,email',
        ]);

        $status = Password::sendResetLink(
            $request->only('email')
        );

        if ($status == Password::RESET_LINK_SENT) {
            return back()->with('status', __($status));
        }

        throw ValidationException::withMessages([
            'email' => [trans($status)],
        ]);
    }

    /**
     * API: Handle password reset link request and send reset email.
     */
    public function sendResetLink(Request $request): JsonResponse
    {
        try {
            // Validate request
            $request->validate([
                'email' => 'required|email|max:255',
                'captcha_token' => 'nullable|string', // For CAPTCHA validation
            ]);

            $email = $request->email;

            // Check if user exists
            $user = User::where('email', $email)->first();

            if (!$user) {
                // Return generic response for security (don't reveal if email exists)
                return response()->json([
                    'success' => true,
                    'message' => 'إذا كان البريد الإلكتروني مسجلاً لدينا، تم إرسال رابط إعادة التعيين',
                    'data' => [
                        'email' => $email,
                        'reset_sent' => true,
                        'exists_in_system' => false,
                    ],
                    'meta' => [
                        'security_notice' => 'للحفاظ على الأمان، لا نؤكد أو ننفي وجود البريد الإلكتروني في نظامنا'
                    ]
                ], 200);
            }

            // Check if user is active
            if (!$user->is_active) {
                return response()->json([
                    'success' => false,
                    'message' => 'حسابك غير نشط. يرجى التواصل مع الدعم',
                    'error_code' => 'ACCOUNT_INACTIVE',
                    'data' => [
                        'email' => $email,
                        'is_active' => false
                    ]
                ], 403);
            }

            // Rate limiting: Check attempts
            $attemptsKey = 'password_reset_attempts:' . $email;
            $attempts = Cache::get($attemptsKey, 0);
            $maxAttempts = config('auth.password_reset.max_attempts', 5);

            if ($attempts >= $maxAttempts) {
                $cooldown = config('auth.password_reset.cooldown', 15); // minutes
                $remainingTime = Cache::get('password_reset_cooldown:' . $email, $cooldown);

                return response()->json([
                    'success' => false,
                    'message' => 'لقد تجاوزت الحد الأقصى لمحاولات إعادة التعيين',
                    'error_code' => 'RATE_LIMITED',
                    'data' => [
                        'email' => $email,
                        'max_attempts' => $maxAttempts,
                        'attempts' => $attempts,
                        'cooldown_minutes' => $remainingTime,
                        'retry_after' => now()->addMinutes($remainingTime)->toISOString()
                    ]
                ], 429);
            }

            // Check last reset request time
            $lastRequestKey = 'last_password_reset_request:' . $email;
            $lastRequest = Cache::get($lastRequestKey);

            if ($lastRequest) {
                $timeSinceLastRequest = Carbon::parse($lastRequest)->diffInMinutes(now());
                $minInterval = config('auth.password_reset.min_interval', 2); // minutes

                if ($timeSinceLastRequest < $minInterval) {
                    return response()->json([
                        'success' => false,
                        'message' => 'يرجى الانتظار قبل طلب رابط إعادة تعيين آخر',
                        'error_code' => 'TOO_SOON',
                        'data' => [
                            'email' => $email,
                            'time_since_last_request' => $timeSinceLastRequest,
                            'min_interval_minutes' => $minInterval,
                            'wait_minutes' => $minInterval - $timeSinceLastRequest
                        ]
                    ], 429);
                }
            }

            // Generate reset token
            $token = Str::random(60);
            $resetUrl = $this->generateResetUrl($user, $token);

            // Store token in cache/database
            $this->storeResetToken($user, $token);

            // Send reset email
            $this->sendPasswordResetEmail($user, $resetUrl);

            // Increment attempts counter
            Cache::put($attemptsKey, $attempts + 1, now()->addHours(1));
            Cache::put($lastRequestKey, now()->toISOString(), now()->addHours(1));

            // Log reset request
            $this->logResetRequest($user, $request);

            // Prepare response
            $response = [
                'success' => true,
                'message' => 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني',
                'data' => [
                    'email' => $email,
                    'reset_sent' => true,
                    'exists_in_system' => true,
                    'user' => [
                        'id' => $user->id,
                        'full_name' => $user->full_name_arabic,
                        'email' => $user->email,
                        'is_active' => $user->is_active
                    ],
                    'token_info' => [
                        'type' => 'reset_token',
                        'expires_in_minutes' => config('auth.passwords.users.expire', 60),
                        'single_use' => true
                    ],
                    'security' => [
                        'max_attempts' => $maxAttempts,
                        'attempts_remaining' => $maxAttempts - ($attempts + 1),
                        'cooldown_enabled' => true
                    ]
                ],
                'meta' => [
                    'timestamp' => Carbon::now()->toISOString(),
                    'delivery_method' => 'email',
                    'expires_at' => now()->addMinutes(config('auth.passwords.users.expire', 60))->toISOString()
                ]
            ];

            return response()->json($response, 200);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $e->errors(),
                'error_code' => 'VALIDATION_ERROR'
            ], 422);

        } catch (\Exception $e) {
            Log::error('Password reset request error: ' . $e->getMessage(), [
                'email' => $request->email ?? 'N/A',
                'ip' => $request->ip()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء إرسال رابط إعادة التعيين',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'error_code' => 'RESET_REQUEST_FAILED'
            ], 500);
        }
    }

    /**
     * Generate reset URL.
     */
    private function generateResetUrl(User $user, string $token): string
    {
        // Frontend reset page URL
        $frontendUrl = config('app.frontend_url', config('app.url'));
        
        return "{$frontendUrl}/reset-password?token={$token}&email=" . urlencode($user->email);
    }

    /**
     * Store reset token.
     */
    private function storeResetToken(User $user, string $token): void
    {
        $key = 'password_reset:' . $user->id . ':' . hash('sha256', $token);
        
        $data = [
            'user_id' => $user->id,
            'token' => hash('sha256', $token),
            'created_at' => now()->toISOString(),
            'expires_at' => now()->addMinutes(config('auth.passwords.users.expire', 60))->toISOString(),
            'used' => false,
            'ip_address' => request()->ip()
        ];

        Cache::put($key, $data, now()->addMinutes(config('auth.passwords.users.expire', 60)));
    }

    /**
     * Send password reset email.
     */
    private function sendPasswordResetEmail(User $user, string $resetUrl): void
    {
        try {
            // Send to user
            Mail::to($user->email)->queue(new PasswordResetMail($user, $resetUrl));

            // Send notification to admin if configured
            $adminEmail = config('mail.admin_email');
            if ($adminEmail) {
                Mail::to($adminEmail)->queue(new PasswordResetRequestedMail($user));
            }

            Log::info('Password reset email sent', [
                'user_id' => $user->id,
                'email' => $user->email
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send password reset email: ' . $e->getMessage(), [
                'user_id' => $user->id,
                'email' => $user->email
            ]);
            throw $e;
        }
    }

    /**
     * Log reset request.
     */
    private function logResetRequest(User $user, Request $request): void
    {
        if (class_exists('Spatie\Activitylog\Models\Activity')) {
            activity()
                ->causedBy($user)
                ->withProperties([
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'action' => 'password_reset_requested',
                    'timestamp' => Carbon::now()
                ])
                ->log('Password reset requested');
        }
    }

    /**
     * Check reset token validity.
     */
    public function checkResetToken(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'token' => 'required|string',
                'email' => 'required|email'
            ]);

            $user = User::where('email', $request->email)->first();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'البريد الإلكتروني غير مسجل',
                    'error_code' => 'USER_NOT_FOUND'
                ], 404);
            }

            $key = 'password_reset:' . $user->id . ':' . hash('sha256', $request->token);
            $tokenData = Cache::get($key);

            if (!$tokenData) {
                return response()->json([
                    'success' => false,
                    'message' => 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية',
                    'error_code' => 'INVALID_TOKEN',
                    'data' => [
                        'is_valid' => false,
                        'expired' => true
                    ]
                ], 400);
            }

            if ($tokenData['used']) {
                return response()->json([
                    'success' => false,
                    'message' => 'تم استخدام رابط إعادة التعيين مسبقاً',
                    'error_code' => 'TOKEN_USED'
                ], 400);
            }

            return response()->json([
                'success' => true,
                'message' => 'رابط إعادة التعيين صالح',
                'data' => [
                    'is_valid' => true,
                    'user' => [
                        'id' => $user->id,
                        'email' => $user->email,
                        'full_name' => $user->full_name_arabic
                    ],
                    'token' => [
                        'expires_at' => $tokenData['expires_at'],
                        'created_at' => $tokenData['created_at'],
                        'expires_in_minutes' => Carbon::parse($tokenData['expires_at'])->diffInMinutes(now()),
                        'single_use' => true
                    ]
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Check reset token error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'فشل التحقق من صلاحية الرابط',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get reset request statistics.
     */
    public function resetStats(Request $request): JsonResponse
    {
        try {
            // Only admins can view stats
            if (!$request->user() || !$request->user()->hasRole('admin')) {
                return response()->json([
                    'success' => false,
                    'message' => 'غير مصرح',
                    'error_code' => 'UNAUTHORIZED'
                ], 403);
            }

            $period = $request->get('period', 'today'); // today, week, month

            $stats = [
                'total_requests' => $this->getTotalRequests($period),
                'successful_resets' => $this->getSuccessfulResets($period),
                'failed_attempts' => $this->getFailedAttempts($period),
                'most_common_ips' => $this->getMostCommonIPs($period),
                'reset_rate' => $this->calculateResetRate($period)
            ];

            return response()->json([
                'success' => true,
                'message' => 'إحصائيات طلبات إعادة تعيين كلمة المرور',
                'data' => $stats,
                'meta' => [
                    'period' => $period,
                    'timestamp' => Carbon::now()->toISOString()
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Reset stats error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'فشل جلب الإحصائيات',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get total reset requests.
     */
    private function getTotalRequests(string $period): int
    {
        // Implement based on your logging system
        return 0;
    }

    /**
     * Get successful resets.
     */
    private function getSuccessfulResets(string $period): int
    {
        // Implement based on your logging system
        return 0;
    }

    /**
     * Get failed attempts.
     */
    private function getFailedAttempts(string $period): int
    {
        // Implement based on your logging system
        return 0;
    }

    /**
     * Get most common IPs.
     */
    private function getMostCommonIPs(string $period): array
    {
        return [];
    }

    /**
     * Calculate reset success rate.
     */
    private function calculateResetRate(string $period): float
    {
        return 0.0;
    }

    /**
     * Clear reset attempts (Admin only).
     */
    public function clearResetAttempts(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'email' => 'required|email'
            ]);

            $email = $request->email;
            $user = User::where('email', $email)->first();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'المستخدم غير موجود',
                    'error_code' => 'USER_NOT_FOUND'
                ], 404);
            }

            // Clear all reset-related cache keys
            $keys = [
                'password_reset_attempts:' . $email,
                'password_reset_cooldown:' . $email,
                'last_password_reset_request:' . $email
            ];

            foreach ($keys as $key) {
                Cache::forget($key);
            }

            // Log the action
            activity()
                ->causedBy($request->user())
                ->performedOn($user)
                ->withProperties([
                    'action' => 'clear_reset_attempts',
                    'admin_id' => $request->user()->id
                ])
                ->log('Password reset attempts cleared by admin');

            return response()->json([
                'success' => true,
                'message' => 'تم مسح جميع محاولات إعادة التعيين',
                'data' => [
                    'email' => $email,
                    'user_id' => $user->id,
                    'cleared_at' => Carbon::now()->toISOString()
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Clear reset attempts error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'فشل مسح المحاولات',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }
}
