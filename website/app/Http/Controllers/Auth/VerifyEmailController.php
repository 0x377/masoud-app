<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\Verified;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\RedirectResponse;
use Tymon\JWTAuth\Facades\JWTAuth;
use Illuminate\Support\Facades\Mail;
use App\Mail\EmailVerifiedMail;
use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class VerifyEmailController extends Controller
{
    /**
     * Mark the authenticated user's email address as verified (Web).
     */
    public function __invoke(EmailVerificationRequest $request): RedirectResponse
    {
        if ($request->user()->hasVerifiedEmail()) {
            return redirect()->intended(route('dashboard', absolute: false).'?verified=1');
        }

        if ($request->user()->markEmailAsVerified()) {
            event(new Verified($request->user()));
        }

        return redirect()->intended(route('dashboard', absolute: false).'?verified=1');
    }

    /**
     * Verify email using token (API).
     */
    public function verifyEmail(Request $request, string $token): JsonResponse
    {
        try {
            // Find user by verification token
            $user = User::where('email_verification_token', $token)->first();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'رمز التحقق غير صالح أو منتهي الصلاحية',
                    'error_code' => 'INVALID_TOKEN',
                    'data' => [
                        'token' => $token,
                        'is_valid' => false
                    ]
                ], 400);
            }

            // Check if already verified
            if ($user->hasVerifiedEmail()) {
                return response()->json([
                    'success' => false,
                    'message' => 'البريد الإلكتروني مفعل مسبقاً',
                    'error_code' => 'ALREADY_VERIFIED',
                    'data' => [
                        'user_id' => $user->id,
                        'email' => $user->email,
                        'verified_at' => $user->email_verified_at
                    ]
                ], 400);
            }

            // Check token expiration (24 hours)
            $tokenAge = $user->created_at->diffInHours(Carbon::now());
            if ($tokenAge > 24) {
                return response()->json([
                    'success' => false,
                    'message' => 'انتهت صلاحية رابط التفعيل. يرجى طلب رابط جديد',
                    'error_code' => 'TOKEN_EXPIRED',
                    'data' => [
                        'token_age_hours' => $tokenAge,
                        'max_age_hours' => 24
                    ]
                ], 400);
            }

            // Mark email as verified
            $user->email_verified_at = Carbon::now();
            $user->email_verification_token = null;
            $user->is_active = true;
            $user->save();

            // Generate new JWT tokens (old tokens become invalid)
            $accessToken = JWTAuth::fromUser($user);
            $refreshToken = $this->generateRefreshToken($user);

            // Send email notification
            $this->sendVerificationConfirmationEmail($user);

            // Log verification activity
            $this->logVerificationActivity($user, $request);

            // Trigger event
            event(new Verified($user));

            return response()->json([
                'success' => true,
                'message' => 'تم تفعيل البريد الإلكتروني بنجاح',
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'email' => $user->email,
                        'full_name_arabic' => $user->full_name_arabic,
                        'is_active' => $user->is_active,
                        'email_verified_at' => $user->email_verified_at,
                        'verification_status' => 'verified'
                    ],
                    'tokens' => [
                        'access_token' => $accessToken,
                        'refresh_token' => $refreshToken,
                        'token_type' => 'bearer',
                        'expires_in' => config('jwt.ttl') * 60,
                        'issued_at' => Carbon::now()->toISOString()
                    ],
                    'redirect' => [
                        'path' => $this->getRedirectPath($user),
                        'url' => url($this->getRedirectPath($user)),
                        'delay_seconds' => 3
                    ]
                ],
                'meta' => [
                    'timestamp' => Carbon::now()->toISOString(),
                    'verification_method' => 'token',
                    'requires_login' => false
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Email verification error: ' . $e->getMessage(), [
                'token' => $token,
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء تفعيل البريد الإلكتروني',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'error_code' => 'VERIFICATION_FAILED'
            ], 500);
        }
    }

    /**
     * Verify email using signed URL (API).
     */
    public function verifySignedEmail(Request $request): JsonResponse
    {
        try {
            if (!$request->hasValidSignature()) {
                return response()->json([
                    'success' => false,
                    'message' => 'رابط التفعيل غير صالح أو منتهي الصلاحية',
                    'error_code' => 'INVALID_SIGNATURE'
                ], 400);
            }

            $userId = $request->route('id');
            $hash = $request->route('hash');

            $user = User::findOrFail($userId);

            // Check if hash matches
            if (!hash_equals($hash, sha1($user->getEmailForVerification()))) {
                return response()->json([
                    'success' => false,
                    'message' => 'رابط التفعيل غير صالح',
                    'error_code' => 'INVALID_HASH'
                ], 400);
            }

            if ($user->hasVerifiedEmail()) {
                return response()->json([
                    'success' => true,
                    'message' => 'البريد الإلكتروني مفعل مسبقاً',
                    'data' => [
                        'user_id' => $user->id,
                        'email' => $user->email,
                        'verified_at' => $user->email_verified_at
                    ]
                ], 200);
            }

            if ($user->markEmailAsVerified()) {
                // Generate new tokens
                $accessToken = JWTAuth::fromUser($user);
                $refreshToken = $this->generateRefreshToken($user);

                // Send confirmation email
                $this->sendVerificationConfirmationEmail($user);

                // Log activity
                $this->logVerificationActivity($user, $request);

                event(new Verified($user));

                return response()->json([
                    'success' => true,
                    'message' => 'تم تفعيل البريد الإلكتروني بنجاح',
                    'data' => [
                        'user' => $this->prepareUserData($user),
                        'tokens' => [
                            'access_token' => $accessToken,
                            'refresh_token' => $refreshToken,
                            'token_type' => 'bearer',
                            'expires_in' => config('jwt.ttl') * 60
                        ],
                        'redirect' => [
                            'path' => $this->getRedirectPath($user),
                            'url' => url($this->getRedirectPath($user)),
                            'auto_redirect' => true
                        ]
                    ]
                ], 200);
            }

            throw new \Exception('Failed to mark email as verified');

        } catch (\Exception $e) {
            Log::error('Signed email verification error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'فشل تفعيل البريد الإلكتروني',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Send verification email (API).
     */
    public function sendVerificationEmail(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'email' => 'required|email|exists:users,email'
            ]);

            $user = User::where('email', $request->email)->first();

            if ($user->hasVerifiedEmail()) {
                return response()->json([
                    'success' => false,
                    'message' => 'البريد الإلكتروني مفعل مسبقاً',
                    'error_code' => 'ALREADY_VERIFIED'
                ], 400);
            }

            // Generate new verification token
            $user->email_verification_token = \Illuminate\Support\Str::random(60);
            $user->save();

            // Send verification email
            $verificationUrl = url("/api/verify-email/{$user->email_verification_token}");
            
            // Use your existing mail class
            Mail::to($user->email)->send(new \App\Mail\RegistrationSuccessMail($user, true));

            // Log email sent activity
            activity()
                ->causedBy($user)
                ->withProperties([
                    'ip_address' => $request->ip(),
                    'action' => 'verification_email_resent'
                ])
                ->log('Verification email resent');

            return response()->json([
                'success' => true,
                'message' => 'تم إرسال رابط التفعيل إلى بريدك الإلكتروني',
                'data' => [
                    'email' => $user->email,
                    'verification_sent' => true,
                    'expires_in' => '24 hours',
                    'resend_allowed_after' => 60 // seconds
                ],
                'meta' => [
                    'timestamp' => Carbon::now()->toISOString(),
                    'method' => 'token'
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Send verification email error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'فشل إرسال رابط التفعيل',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Check verification status (API).
     */
    public function checkVerificationStatus(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'email' => 'required|email|exists:users,email'
            ]);

            $user = User::where('email', $request->email)->first();

            $status = $user->hasVerifiedEmail() ? 'verified' : 'pending';

            $response = [
                'success' => true,
                'message' => 'حالة التحقق من البريد الإلكتروني',
                'data' => [
                    'email' => $user->email,
                    'verification_status' => $status,
                    'verified_at' => $user->email_verified_at,
                    'is_active' => $user->is_active,
                    'requires_verification' => !$user->hasVerifiedEmail(),
                    'can_resend' => !$user->hasVerifiedEmail()
                ]
            ];

            // Add resend info if pending
            if (!$user->hasVerifiedEmail()) {
                $response['data']['resend_info'] = [
                    'last_sent' => $user->created_at->toISOString(),
                    'can_resend_after' => $this->canResendAfter($user),
                    'method' => 'email_with_token'
                ];
            }

            return response()->json($response, 200);

        } catch (\Exception $e) {
            Log::error('Check verification status error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'فشل التحقق من حالة البريد الإلكتروني',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Generate refresh token.
     */
    private function generateRefreshToken(User $user): string
    {
        $refreshToken = \Illuminate\Support\Str::random(80);
        
        // Store in cache
        cache()->put('refresh_token:' . $user->id, [
            'token' => $refreshToken,
            'user_id' => $user->id,
            'expires_at' => Carbon::now()->addDays(14)
        ], 14 * 24 * 60); // 14 days in minutes

        return $refreshToken;
    }

    /**
     * Send verification confirmation email.
     */
    private function sendVerificationConfirmationEmail(User $user): void
    {
        try {
            Mail::to($user->email)->send(new EmailVerifiedMail($user));
            Log::info('Verification confirmation email sent', ['user_id' => $user->id]);
        } catch (\Exception $e) {
            Log::error('Failed to send verification confirmation email: ' . $e->getMessage());
        }
    }

    /**
     * Log verification activity.
     */
    private function logVerificationActivity(User $user, Request $request): void
    {
        try {
            if (class_exists('Spatie\Activitylog\Models\Activity')) {
                activity()
                    ->causedBy($user)
                    ->withProperties([
                        'ip_address' => $request->ip(),
                        'user_agent' => $request->userAgent(),
                        'verification_method' => 'api_token',
                        'verified_at' => $user->email_verified_at
                    ])
                    ->log('Email verified successfully');
            }
        } catch (\Exception $e) {
            Log::error('Failed to log verification activity: ' . $e->getMessage());
        }
    }

    /**
     * Get redirect path based on user role.
     */
    private function getRedirectPath(User $user): string
    {
        return match($user->user_type) {
            'ADMIN' => '/admin/dashboard?verified=1',
            'MANAGER' => '/manager/dashboard?verified=1',
            default => '/dashboard?verified=1',
        };
    }

    /**
     * Prepare user data for response.
     */
    private function prepareUserData(User $user): array
    {
        return [
            'id' => $user->id,
            'national_id' => $user->national_id,
            'full_name_arabic' => $user->full_name_arabic,
            'full_name_english' => $user->full_name_english,
            'email' => $user->email,
            'phone_number' => $user->phone_number,
            'user_type' => $user->user_type,
            'is_active' => $user->is_active,
            'email_verified' => true,
            'email_verified_at' => $user->email_verified_at,
            'verification_status' => 'verified'
        ];
    }

    /**
     * Calculate when user can resend verification email.
     */
    private function canResendAfter(User $user): ?int
    {
        $lastSent = $user->created_at;
        $now = Carbon::now();
        $diffInSeconds = $now->diffInSeconds($lastSent);
        
        // Allow resend after 60 seconds
        $cooldown = 60;
        
        if ($diffInSeconds < $cooldown) {
            return $cooldown - $diffInSeconds;
        }
        
        return null;
    }

    /**
     * Bulk verify emails (Admin only).
     */
    public function bulkVerify(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'user_ids' => 'required|array',
                'user_ids.*' => 'exists:users,id'
            ]);

            $verifiedUsers = [];
            $failedUsers = [];

            foreach ($request->user_ids as $userId) {
                try {
                    $user = User::find($userId);
                    
                    if (!$user->hasVerifiedEmail()) {
                        $user->email_verified_at = Carbon::now();
                        $user->email_verification_token = null;
                        $user->is_active = true;
                        $user->save();
                        
                        event(new Verified($user));
                        
                        $verifiedUsers[] = $user->id;
                        
                        // Send notification email
                        Mail::to($user->email)->send(new EmailVerifiedMail($user));
                    }
                } catch (\Exception $e) {
                    $failedUsers[] = [
                        'user_id' => $userId,
                        'error' => $e->getMessage()
                    ];
                    Log::error('Bulk verify failed for user: ' . $userId, ['error' => $e->getMessage()]);
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'تمت عملية التفعيل الجماعي',
                'data' => [
                    'total_processed' => count($request->user_ids),
                    'verified' => count($verifiedUsers),
                    'already_verified' => count($request->user_ids) - count($verifiedUsers) - count($failedUsers),
                    'failed' => count($failedUsers),
                    'verified_users' => $verifiedUsers,
                    'failed_users' => $failedUsers
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Bulk verify error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'فشل عملية التفعيل الجماعي',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get verification statistics.
     */
    public function verificationStats(Request $request): JsonResponse
    {
        try {
            // Total users
            $totalUsers = User::count();
            
            // Verified users
            $verifiedUsers = User::whereNotNull('email_verified_at')->count();
            
            // Pending verification
            $pendingUsers = User::whereNull('email_verified_at')->count();
            
            // Recently verified (last 7 days)
            $recentlyVerified = User::where('email_verified_at', '>=', Carbon::now()->subDays(7))->count();
            
            // Verification rate
            $verificationRate = $totalUsers > 0 ? ($verifiedUsers / $totalUsers) * 100 : 0;

            return response()->json([
                'success' => true,
                'message' => 'إحصائيات التحقق من البريد الإلكتروني',
                'data' => [
                    'total_users' => $totalUsers,
                    'verified_users' => $verifiedUsers,
                    'pending_verification' => $pendingUsers,
                    'recently_verified' => $recentlyVerified,
                    'verification_rate' => round($verificationRate, 2),
                    'stats' => [
                        'today' => User::whereDate('email_verified_at', Carbon::today())->count(),
                        'this_week' => User::whereBetween('email_verified_at', [
                            Carbon::now()->startOfWeek(),
                            Carbon::now()->endOfWeek()
                        ])->count(),
                        'this_month' => User::whereBetween('email_verified_at', [
                            Carbon::now()->startOfMonth(),
                            Carbon::now()->endOfMonth()
                        ])->count()
                    ]
                ],
                'meta' => [
                    'timestamp' => Carbon::now()->toISOString(),
                    'period' => 'all_time'
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Verification stats error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'فشل جلب إحصائيات التحقق',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }
}
