<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Carbon\Carbon;
use Tymon\JWTAuth\Facades\JWTAuth;
use App\Mail\PasswordResetSuccessMail;
use App\Mail\PasswordResetSecurityAlertMail;

class NewPasswordController extends Controller
{
    /**
     * Display the password reset view (Web).
     */
    public function create(Request $request): Response
    {
        return Inertia::render('Auth/ResetPassword', [
            'email' => $request->email,
            'token' => $request->route('token'),
            'csrf_token' => csrf_token(),
            'password_requirements' => $this->getPasswordRequirements(),
            'token_expiry_minutes' => config('auth.passwords.users.expire', 60),
        ]);
    }

    /**
     * Handle an incoming new password request (Web).
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email',
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user) use ($request) {
                $user->forceFill([
                    'password' => Hash::make($request->password),
                    'remember_token' => Str::random(60),
                    'password_changed_at' => Carbon::now(),
                ])->save();

                event(new PasswordReset($user));
            }
        );

        if ($status == Password::PASSWORD_RESET) {
            return redirect()->route('login')->with('status', __($status));
        }

        throw ValidationException::withMessages([
            'email' => [trans($status)],
        ]);
    }

    /**
     * API: Reset password with token.
     */
    public function resetPassword(Request $request): JsonResponse
    {
        try {
            // Validate request
            $validated = $request->validate([
                'token' => 'required|string|min:20',
                'email' => 'required|email|max:255',
                'password' => [
                    'required',
                    'confirmed',
                    'min:8',
                    'max:100',
                    'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/',
                    'different:email'
                ],
                'logout_all_sessions' => 'boolean|default:true',
                'device_name' => 'nullable|string|max:100'
            ], [
                'password.regex' => 'يجب أن تحتوي كلمة المرور على حرف كبير، حرف صغير، رقم، ورمز خاص',
                'password.different' => 'يجب أن تكون كلمة المرور مختلفة عن البريد الإلكتروني'
            ]);

            $email = $validated['email'];
            $token = $validated['token'];
            $newPassword = $validated['password'];

            // Find user
            $user = User::where('email', $email)->first();

            if (!$user) {
                // For security, return generic error
                return response()->json([
                    'success' => false,
                    'message' => 'رمز إعادة التعيين غير صالح أو منتهي الصلاحية',
                    'error_code' => 'INVALID_RESET_DATA',
                    'data' => [
                        'reset_successful' => false,
                        'security_notice' => 'لمزيد من الأمان، لا نؤكد وجود البريد الإلكتروني في نظامنا'
                    ]
                ], 400);
            }

            // Check if user is active
            if (!$user->is_active) {
                return response()->json([
                    'success' => false,
                    'message' => 'حسابك غير نشط. يرجى التواصل مع الدعم',
                    'error_code' => 'ACCOUNT_INACTIVE'
                ], 403);
            }

            // Verify reset token
            $tokenData = $this->verifyResetToken($user, $token);

            if (!$tokenData) {
                return response()->json([
                    'success' => false,
                    'message' => 'رمز إعادة التعيين غير صالح أو منتهي الصلاحية',
                    'error_code' => 'INVALID_TOKEN',
                    'data' => [
                        'token_valid' => false,
                        'token_expired' => true,
                        'max_attempts_exceeded' => false
                    ]
                ], 400);
            }

            // Check if token already used
            if ($tokenData['used']) {
                return response()->json([
                    'success' => false,
                    'message' => 'تم استخدام رمز إعادة التعيين مسبقاً',
                    'error_code' => 'TOKEN_ALREADY_USED',
                    'data' => [
                        'used_at' => $tokenData['used_at'],
                        'used_ip' => $tokenData['used_ip']
                    ]
                ], 400);
            }

            // Check token expiry
            if (Carbon::parse($tokenData['expires_at'])->isPast()) {
                return response()->json([
                    'success' => false,
                    'message' => 'انتهت صلاحية رابط إعادة التعيين',
                    'error_code' => 'TOKEN_EXPIRED',
                    'data' => [
                        'expired_at' => $tokenData['expires_at'],
                        'created_at' => $tokenData['created_at']
                    ]
                ], 400);
            }

            // Check password history (prevent reuse)
            if (!$this->isPasswordNew($user, $newPassword)) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن استخدام كلمة مرور سابقة. يرجى اختيار كلمة مرور جديدة',
                    'error_code' => 'PASSWORD_REUSE',
                    'data' => [
                        'max_history' => 5,
                        'reuse_prevention_enabled' => true
                    ]
                ], 422);
            }

            // Save old password for history
            $oldPasswordHash = $user->password;

            // Update password
            $user->password = Hash::make($newPassword);
            $user->password_changed_at = Carbon::now();
            $user->password_reset_at = Carbon::now();
            $user->last_password_reset_ip = $request->ip();
            $user->last_password_reset_user_agent = $request->userAgent();
            $user->remember_token = Str::random(60);
            
            // Mark token as used
            $tokenData['used'] = true;
            $tokenData['used_at'] = Carbon::now()->toISOString();
            $tokenData['used_ip'] = $request->ip();
            
            // Save token data
            $this->saveTokenData($user, $token, $tokenData);

            // Add to password history
            $this->addToPasswordHistory($user, $oldPasswordHash);

            // Logout all sessions if requested
            if ($validated['logout_all_sessions']) {
                $this->invalidateAllSessions($user);
            }

            // Save user
            $user->save();

            // Generate new JWT token
            $newAccessToken = $this->generateNewAccessToken($user);
            $refreshToken = $this->generateRefreshToken($user);

            // Send email notifications
            $this->sendPasswordResetNotifications($user, $request, $validated['device_name']);

            // Log the reset
            $this->logPasswordResetActivity($user, $request);

            // Clear reset attempts for this email
            $this->clearResetAttempts($email);

            // Fire event
            event(new PasswordReset($user));

            return response()->json([
                'success' => true,
                'message' => 'تم إعادة تعيين كلمة المرور بنجاح',
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'email' => $user->email,
                        'full_name_arabic' => $user->full_name_arabic,
                        'is_active' => $user->is_active,
                        'password_changed_at' => $user->password_changed_at->toISOString(),
                        'password_reset_at' => $user->password_reset_at->toISOString()
                    ],
                    'tokens' => [
                        'access_token' => $newAccessToken,
                        'refresh_token' => $refreshToken,
                        'token_type' => 'bearer',
                        'expires_in' => config('jwt.ttl') * 60,
                        'issued_at' => Carbon::now()->toISOString()
                    ],
                    'security' => [
                        'logout_all_sessions' => $validated['logout_all_sessions'],
                        'token_invalidated' => true,
                        'password_strength' => $this->checkPasswordStrength($newPassword),
                        'password_history_updated' => true
                    ],
                    'redirect' => [
                        'path' => '/dashboard',
                        'url' => url('/dashboard'),
                        'auto_redirect' => true,
                        'delay_seconds' => 3,
                        'requires_login' => false
                    ],
                    'session' => [
                        'authenticated' => true,
                        'device_name' => $validated['device_name'] ?? 'Unknown Device',
                        'ip_address' => $request->ip()
                    ]
                ],
                'meta' => [
                    'timestamp' => Carbon::now()->toISOString(),
                    'reset_method' => 'token',
                    'token_lifetime_minutes' => config('auth.passwords.users.expire', 60),
                    'password_requirements_met' => true
                ]
            ], 200);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $e->errors(),
                'error_code' => 'VALIDATION_ERROR',
                'data' => [
                    'validation_failed' => true,
                    'failed_fields' => array_keys($e->errors())
                ]
            ], 422);

        } catch (\Exception $e) {
            Log::error('Password reset error: ' . $e->getMessage(), [
                'email' => $request->email ?? 'N/A',
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء إعادة تعيين كلمة المرور',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'error_code' => 'PASSWORD_RESET_FAILED',
                'data' => [
                    'reset_successful' => false,
                    'retry_allowed' => true
                ]
            ], 500);
        }
    }

    /**
     * API: Validate reset token.
     */
    public function validateResetToken(Request $request): JsonResponse
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
                    'message' => 'رمز إعادة التعيين غير صالح',
                    'error_code' => 'INVALID_TOKEN',
                    'data' => [
                        'token_valid' => false,
                        'user_exists' => false
                    ]
                ], 400);
            }

            $tokenData = $this->verifyResetToken($user, $request->token);

            if (!$tokenData) {
                return response()->json([
                    'success' => false,
                    'message' => 'رمز إعادة التعيين غير صالح أو منتهي الصلاحية',
                    'error_code' => 'INVALID_TOKEN'
                ], 400);
            }

            if ($tokenData['used']) {
                return response()->json([
                    'success' => false,
                    'message' => 'تم استخدام هذا الرابط مسبقاً',
                    'error_code' => 'TOKEN_ALREADY_USED'
                ], 400);
            }

            if (Carbon::parse($tokenData['expires_at'])->isPast()) {
                return response()->json([
                    'success' => false,
                    'message' => 'انتهت صلاحية رابط إعادة التعيين',
                    'error_code' => 'TOKEN_EXPIRED'
                ], 400);
            }

            return response()->json([
                'success' => true,
                'message' => 'رمز إعادة التعيين صالح',
                'data' => [
                    'token_valid' => true,
                    'user' => [
                        'id' => $user->id,
                        'email' => $user->email,
                        'full_name_arabic' => $user->full_name_arabic
                    ],
                    'token' => [
                        'expires_at' => $tokenData['expires_at'],
                        'expires_in_minutes' => Carbon::parse($tokenData['expires_at'])->diffInMinutes(Carbon::now()),
                        'created_at' => $tokenData['created_at'],
                        'single_use' => true
                    ]
                ],
                'meta' => [
                    'timestamp' => Carbon::now()->toISOString(),
                    'valid_for_reset' => true
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Token validation error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'فشل التحقق من صلاحية الرابط',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Verify reset token from cache/database.
     */
    private function verifyResetToken(User $user, string $token): ?array
    {
        $tokenHash = hash('sha256', $token);
        $key = 'password_reset:' . $user->id . ':' . $tokenHash;
        
        return Cache::get($key);
    }

    /**
     * Save token data to cache.
     */
    private function saveTokenData(User $user, string $token, array $data): void
    {
        $tokenHash = hash('sha256', $token);
        $key = 'password_reset:' . $user->id . ':' . $tokenHash;
        $expiresAt = Carbon::parse($data['expires_at']);
        
        Cache::put($key, $data, $expiresAt);
    }

    /**
     * Check if password is new (not in history).
     */
    private function isPasswordNew(User $user, string $newPassword): bool
    {
        $history = $user->password_history ?? [];
        
        foreach ($history as $oldHash) {
            if (Hash::check($newPassword, $oldHash)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Add password to history.
     */
    private function addToPasswordHistory(User $user, string $oldHash): void
    {
        $history = $user->password_history ?? [];
        
        // Keep only last 5 passwords
        array_unshift($history, $oldHash);
        $history = array_slice($history, 0, 5);
        
        $user->password_history = $history;
    }

    /**
     * Generate new JWT access token.
     */
    private function generateNewAccessToken(User $user): string
    {
        return JWTAuth::fromUser($user);
    }

    /**
     * Generate refresh token.
     */
    private function generateRefreshToken(User $user): string
    {
        $refreshToken = Str::random(80);
        
        $key = 'refresh_token:' . $user->id;
        $data = [
            'token' => $refreshToken,
            'user_id' => $user->id,
            'expires_at' => Carbon::now()->addDays(14)->toISOString(),
            'created_at' => Carbon::now()->toISOString()
        ];
        
        Cache::put($key, $data, 14 * 24 * 60); // 14 days in minutes
        
        return $refreshToken;
    }

    /**
     * Invalidate all sessions.
     */
    private function invalidateAllSessions(User $user): void
    {
        // Clear all session cache for user
        Cache::tags(['user_sessions', 'user_' . $user->id])->flush();
        
        // If using database sessions
        if (config('session.driver') === 'database') {
            \DB::table('sessions')
                ->where('user_id', $user->id)
                ->delete();
        }
    }

    /**
     * Send password reset notifications.
     */
    private function sendPasswordResetNotifications(User $user, Request $request, ?string $deviceName): void
    {
        try {
            // Send success email to user
            Mail::to($user->email)->queue(new PasswordResetSuccessMail($user, [
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'device_name' => $deviceName,
                'reset_time' => Carbon::now()
            ]));

            // Send security alert if suspicious activity
            if ($this->isSuspiciousReset($request, $user)) {
                Mail::to($user->email)->queue(new PasswordResetSecurityAlertMail($user, [
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'location' => $this->getLocationFromIP($request->ip()),
                    'reset_time' => Carbon::now()
                ]));
            }

            Log::info('Password reset notifications sent', ['user_id' => $user->id]);

        } catch (\Exception $e) {
            Log::error('Failed to send reset notifications: ' . $e->getMessage());
        }
    }

    /**
     * Log password reset activity.
     */
    private function logPasswordResetActivity(User $user, Request $request): void
    {
        if (class_exists('Spatie\Activitylog\Models\Activity')) {
            activity()
                ->causedBy($user)
                ->withProperties([
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'action' => 'password_reset_completed',
                    'method' => 'reset_token',
                    'timestamp' => Carbon::now()
                ])
                ->log('Password reset completed successfully');
        }
    }

    /**
     * Clear reset attempts.
     */
    private function clearResetAttempts(string $email): void
    {
        Cache::forget('password_reset_attempts:' . $email);
        Cache::forget('password_reset_cooldown:' . $email);
        Cache::forget('last_password_reset_request:' . $email);
    }

    /**
     * Check password strength.
     */
    private function checkPasswordStrength(string $password): string
    {
        $score = 0;
        
        if (strlen($password) >= 8) $score += 25;
        if (preg_match('/[a-z]/', $password)) $score += 25;
        if (preg_match('/[A-Z]/', $password)) $score += 25;
        if (preg_match('/[0-9]/', $password)) $score += 15;
        if (preg_match('/[^A-Za-z0-9]/', $password)) $score += 10;
        
        return match(true) {
            $score >= 80 => 'strong',
            $score >= 60 => 'good',
            $score >= 40 => 'fair',
            default => 'weak'
        };
    }

    /**
     * Check for suspicious reset activity.
     */
    private function isSuspiciousReset(Request $request, User $user): bool
    {
        $lastLoginIp = $user->last_login_ip;
        $currentIp = $request->ip();
        
        // If IP changed significantly (simple check)
        if ($lastLoginIp && $lastLoginIp !== $currentIp) {
            // More sophisticated checks can be added here
            // Like checking IP ranges, geolocation, etc.
            return true;
        }
        
        return false;
    }

    /**
     * Get location from IP (simplified).
     */
    private function getLocationFromIP(string $ip): string
    {
        // In production, use a proper IP geolocation service
        return 'Unknown Location';
    }

    /**
     * Get password requirements.
     */
    private function getPasswordRequirements(): array
    {
        return [
            'minimum_length' => 8,
            'requires_uppercase' => true,
            'requires_lowercase' => true,
            'requires_numbers' => true,
            'requires_symbols' => true,
            'cannot_be_email' => true,
            'history_size' => 5
        ];
    }

    /**
     * API: Get password reset statistics.
     */
    public function getResetStatistics(Request $request): JsonResponse
    {
        try {
            // Only admins can view statistics
            if (!$request->user() || !$request->user()->hasRole('admin')) {
                return response()->json([
                    'success' => false,
                    'message' => 'غير مصرح',
                    'error_code' => 'UNAUTHORIZED'
                ], 403);
            }

            $period = $request->get('period', '7days'); // 7days, 30days, 90days
            
            $stats = [
                'total_resets' => $this->calculateTotalResets($period),
                'successful_resets' => $this->calculateSuccessfulResets($period),
                'failed_attempts' => $this->calculateFailedAttempts($period),
                'unique_users' => $this->calculateUniqueUsers($period),
                'success_rate' => $this->calculateSuccessRate($period),
                'average_reset_time' => $this->calculateAverageResetTime($period),
                'most_common_ip' => $this->getMostCommonIP($period)
            ];

            return response()->json([
                'success' => true,
                'message' => 'إحصائيات إعادة تعيين كلمات المرور',
                'data' => $stats,
                'meta' => [
                    'period' => $period,
                    'timestamp' => Carbon::now()->toISOString(),
                    'timezone' => config('app.timezone')
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Reset statistics error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'فشل جلب الإحصائيات',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Calculate total reset attempts.
     */
    private function calculateTotalResets(string $period): int
    {
        // Implement based on your logging system
        return 0;
    }

    /**
     * Calculate successful resets.
     */
    private function calculateSuccessfulResets(string $period): int
    {
        // Implement based on your logging system
        return 0;
    }

    /**
     * Calculate failed attempts.
     */
    private function calculateFailedAttempts(string $period): int
    {
        // Implement based on your logging system
        return 0;
    }

    /**
     * Calculate unique users.
     */
    private function calculateUniqueUsers(string $period): int
    {
        // Implement based on your logging system
        return 0;
    }

    /**
     * Calculate success rate.
     */
    private function calculateSuccessRate(string $period): float
    {
        // Implement based on your logging system
        return 0.0;
    }

    /**
     * Calculate average reset time.
     */
    private function calculateAverageResetTime(string $period): string
    {
        // Implement based on your logging system
        return '0 minutes';
    }

    /**
     * Get most common IP.
     */
    private function getMostCommonIP(string $period): ?string
    {
        // Implement based on your logging system
        return null;
    }
}
