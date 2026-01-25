<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Carbon\Carbon;
use App\Mail\PasswordChangedMail;
use App\Mail\PasswordChangeNotificationMail;

class PasswordController extends Controller
{
    /**
     * Update the user's password (Web).
     */
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', Password::defaults(), 'confirmed'],
        ]);

        $request->user()->update([
            'password' => Hash::make($validated['password']),
        ]);

        return back();
    }

    /**
     * API: Change user password (authenticated).
     */
    public function changePassword(Request $request): JsonResponse
    {
        try {
            // Validate request
            $validated = $request->validate([
                'current_password' => [
                    'required',
                    'string',
                    function ($attribute, $value, $fail) use ($request) {
                        if (!Hash::check($value, $request->user()->password)) {
                            $fail('كلمة المرور الحالية غير صحيحة.');
                        }
                    },
                ],
                'password' => [
                    'required',
                    'confirmed',
                    Password::min(8)
                        ->letters()
                        ->mixedCase()
                        ->numbers()
                        ->symbols()
                        ->uncompromised(),
                    'different:current_password'
                ],
                'logout_other_sessions' => 'boolean'
            ]);

            $user = $request->user();
            $oldPasswordHash = $user->password;

            // Check password history (prevent reuse of last 5 passwords)
            if (!$this->isPasswordNew($user, $validated['password'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن استخدام كلمة مرور سابقة. يرجى اختيار كلمة مرور جديدة.',
                    'error_code' => 'PASSWORD_REUSE',
                    'data' => [
                        'max_history' => 5,
                        'reuse_prevention_enabled' => true
                    ]
                ], 422);
            }

            // Check if password was recently changed (cooldown)
            if ($this->isPasswordChangeCooldownActive($user)) {
                $cooldown = $this->getCooldownRemaining($user);
                return response()->json([
                    'success' => false,
                    'message' => 'يرجى الانتظار قبل تغيير كلمة المرور مرة أخرى',
                    'error_code' => 'CHANGE_COOLDOWN',
                    'data' => [
                        'cooldown_remaining_minutes' => $cooldown,
                        'last_change' => $user->password_changed_at?->toISOString()
                    ]
                ], 429);
            }

            // Update password
            $user->password = Hash::make($validated['password']);
            $user->password_changed_at = Carbon::now();
            $user->password_change_ip = $request->ip();
            $user->password_change_user_agent = $request->userAgent();
            $user->save();

            // Add to password history
            $this->addToPasswordHistory($user, $oldPasswordHash);

            // Logout other sessions if requested
            if ($request->boolean('logout_other_sessions')) {
                Auth::logoutOtherDevices($validated['current_password']);
                $this->invalidateOtherSessions($user);
            }

            // Send email notification
            $this->sendPasswordChangeNotification($user, $request);

            // Log password change activity
            $this->logPasswordChangeActivity($user, $request);

            // Generate new JWT token (optional, if using JWT)
            $newToken = $this->generateNewTokenIfNeeded($user);

            return response()->json([
                'success' => true,
                'message' => 'تم تغيير كلمة المرور بنجاح',
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'email' => $user->email,
                        'full_name' => $user->full_name_arabic,
                        'password_changed_at' => $user->password_changed_at->toISOString()
                    ],
                    'security' => [
                        'logout_other_sessions' => $request->boolean('logout_other_sessions'),
                        'password_strength' => 'strong',
                        'next_change_allowed_after' => $this->getNextChangeAllowedTime($user),
                        'history_size' => 5
                    ],
                    'token' => $newToken ? [
                        'access_token' => $newToken,
                        'token_type' => 'bearer',
                        'issued_at' => Carbon::now()->toISOString()
                    ] : null
                ],
                'meta' => [
                    'timestamp' => Carbon::now()->toISOString(),
                    'change_method' => 'authenticated_request'
                ]
            ], 200);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $e->errors(),
                'error_code' => 'VALIDATION_ERROR'
            ], 422);

        } catch (\Exception $e) {
            Log::error('Password change error: ' . $e->getMessage(), [
                'user_id' => $request->user()->id ?? 'N/A',
                'ip' => $request->ip()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء تغيير كلمة المرور',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'error_code' => 'PASSWORD_CHANGE_FAILED'
            ], 500);
        }
    }

    /**
     * API: Reset password using reset token.
     */
    public function resetPassword(Request $request): JsonResponse
    {
        try {
            // Validate request
            $validated = $request->validate([
                'token' => 'required|string',
                'email' => 'required|email|exists:users,email',
                'password' => [
                    'required',
                    'confirmed',
                    Password::min(8)
                        ->letters()
                        ->mixedCase()
                        ->numbers()
                        ->symbols()
                        ->uncompromised()
                ],
                'logout_all_sessions' => 'boolean|default:true'
            ]);

            // Find user
            $user = User::where('email', $validated['email'])->first();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'المستخدم غير موجود',
                    'error_code' => 'USER_NOT_FOUND'
                ], 404);
            }

            // Verify reset token
            $tokenKey = 'password_reset:' . $user->id . ':' . hash('sha256', $validated['token']);
            $tokenData = Cache::get($tokenKey);

            if (!$tokenData) {
                return response()->json([
                    'success' => false,
                    'message' => 'رابط إعادة التعيين غير صالح أو منتهي الصلاحية',
                    'error_code' => 'INVALID_RESET_TOKEN'
                ], 400);
            }

            if ($tokenData['used']) {
                return response()->json([
                    'success' => false,
                    'message' => 'تم استخدام رابط إعادة التعيين مسبقاً',
                    'error_code' => 'TOKEN_ALREADY_USED'
                ], 400);
            }

            // Check if token expired
            if (Carbon::parse($tokenData['expires_at'])->isPast()) {
                return response()->json([
                    'success' => false,
                    'message' => 'انتهت صلاحية رابط إعادة التعيين',
                    'error_code' => 'TOKEN_EXPIRED'
                ], 400);
            }

            // Check password history
            if (!$this->isPasswordNew($user, $validated['password'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن استخدام كلمة مرور سابقة',
                    'error_code' => 'PASSWORD_REUSE',
                    'data' => [
                        'max_history' => 5
                    ]
                ], 422);
            }

            // Save old password hash for history
            $oldPasswordHash = $user->password;

            // Update password
            $user->password = Hash::make($validated['password']);
            $user->password_changed_at = Carbon::now();
            $user->password_reset_at = Carbon::now();
            $user->password_change_ip = $request->ip();
            $user->password_change_user_agent = $request->userAgent();
            $user->save();

            // Mark token as used
            $tokenData['used'] = true;
            $tokenData['used_at'] = Carbon::now()->toISOString();
            $tokenData['used_ip'] = $request->ip();
            Cache::put($tokenKey, $tokenData, Carbon::parse($tokenData['expires_at'])->diffInMinutes());

            // Add to password history
            $this->addToPasswordHistory($user, $oldPasswordHash);

            // Logout all sessions if requested
            if ($validated['logout_all_sessions']) {
                $this->invalidateAllSessions($user);
            }

            // Send email notification
            $this->sendPasswordResetConfirmation($user, $request);

            // Log reset activity
            $this->logPasswordResetActivity($user, $request);

            // Generate new JWT token
            $newToken = $this->generateNewToken($user);

            // Clear reset attempts for this email
            $this->clearResetAttempts($user->email);

            return response()->json([
                'success' => true,
                'message' => 'تم إعادة تعيين كلمة المرور بنجاح',
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'email' => $user->email,
                        'full_name' => $user->full_name_arabic,
                        'password_reset_at' => $user->password_reset_at->toISOString()
                    ],
                    'security' => [
                        'logout_all_sessions' => $validated['logout_all_sessions'],
                        'token_invalidated' => true,
                        'password_strength' => 'strong'
                    ],
                    'tokens' => [
                        'access_token' => $newToken,
                        'token_type' => 'bearer',
                        'expires_in' => config('jwt.ttl') * 60
                    ],
                    'redirect' => [
                        'path' => '/login',
                        'url' => url('/login'),
                        'message' => 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة'
                    ]
                ],
                'meta' => [
                    'timestamp' => Carbon::now()->toISOString(),
                    'reset_method' => 'token'
                ]
            ], 200);

        } catch (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $e->errors(),
                'error_code' => 'VALIDATION_ERROR'
            ], 422);

        } catch (\Exception $e) {
            Log::error('Password reset error: ' . $e->getMessage(), [
                'email' => $request->email ?? 'N/A',
                'ip' => $request->ip()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء إعادة تعيين كلمة المرور',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'error_code' => 'PASSWORD_RESET_FAILED'
            ], 500);
        }
    }

    /**
     * API: Admin force password reset for user.
     */
    public function adminForceResetPassword(Request $request): JsonResponse
    {
        try {
            // Only admins can force reset
            if (!$request->user()->hasRole('admin')) {
                return response()->json([
                    'success' => false,
                    'message' => 'غير مصرح',
                    'error_code' => 'UNAUTHORIZED'
                ], 403);
            }

            $validated = $request->validate([
                'user_id' => 'required|exists:users,id',
                'logout_all_sessions' => 'boolean|default:true',
                'notify_user' => 'boolean|default:true',
                'reason' => 'nullable|string|max:500'
            ]);

            $targetUser = User::findOrFail($validated['user_id']);
            $adminUser = $request->user();
            $oldPasswordHash = $targetUser->password;

            // Generate temporary password
            $temporaryPassword = Str::random(12);
            
            // Update password
            $targetUser->password = Hash::make($temporaryPassword);
            $targetUser->password_changed_at = Carbon::now();
            $targetUser->password_force_reset = true;
            $targetUser->force_reset_reason = $validated['reason'];
            $targetUser->force_reset_by = $adminUser->id;
            $targetUser->force_reset_at = Carbon::now();
            $targetUser->save();

            // Add to password history
            $this->addToPasswordHistory($targetUser, $oldPasswordHash);

            // Logout all sessions if requested
            if ($validated['logout_all_sessions']) {
                $this->invalidateAllSessions($targetUser);
            }

            // Notify user if requested
            if ($validated['notify_user']) {
                $this->sendAdminForceResetNotification($targetUser, $temporaryPassword, $adminUser, $validated['reason']);
            }

            // Log admin action
            $this->logAdminForceResetActivity($targetUser, $adminUser, $validated);

            return response()->json([
                'success' => true,
                'message' => 'تم إعادة تعيين كلمة مرور المستخدم بنجاح',
                'data' => [
                    'user' => [
                        'id' => $targetUser->id,
                        'email' => $targetUser->email,
                        'full_name' => $targetUser->full_name_arabic,
                        'force_reset_at' => $targetUser->force_reset_at->toISOString()
                    ],
                    'security' => [
                        'logout_all_sessions' => $validated['logout_all_sessions'],
                        'notify_user' => $validated['notify_user'],
                        'temporary_password_generated' => true,
                        'requires_password_change' => true
                    ],
                    'admin_action' => [
                        'admin_id' => $adminUser->id,
                        'admin_name' => $adminUser->full_name_arabic,
                        'reason' => $validated['reason'],
                        'timestamp' => Carbon::now()->toISOString()
                    ]
                ],
                'meta' => [
                    'timestamp' => Carbon::now()->toISOString(),
                    'action' => 'admin_force_reset',
                    'note' => 'يجب على المستخدم تغيير كلمة المرور عند تسجيل الدخول التالي'
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Admin force reset error: ' . $e->getMessage(), [
                'admin_id' => $request->user()->id,
                'target_user_id' => $request->user_id ?? 'N/A'
            ]);

            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء إعادة تعيين كلمة المرور',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'error_code' => 'ADMIN_FORCE_RESET_FAILED'
            ], 500);
        }
    }

    /**
     * API: Check password strength.
     */
    public function checkPasswordStrength(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'password' => 'required|string'
            ]);

            $password = $request->password;
            $strength = $this->calculatePasswordStrength($password);
            $suggestions = $this->getPasswordSuggestions($password);

            return response()->json([
                'success' => true,
                'message' => 'تحليل قوة كلمة المرور',
                'data' => [
                    'strength' => $strength['level'],
                    'score' => $strength['score'],
                    'max_score' => 100,
                    'requirements' => [
                        'length' => strlen($password) >= 8,
                        'has_uppercase' => preg_match('/[A-Z]/', $password),
                        'has_lowercase' => preg_match('/[a-z]/', $password),
                        'has_numbers' => preg_match('/[0-9]/', $password),
                        'has_symbols' => preg_match('/[^A-Za-z0-9]/', $password),
                        'not_common' => !$this->isCommonPassword($password)
                    ],
                    'suggestions' => $suggestions,
                    'estimated_crack_time' => $this->estimateCrackTime($password)
                ]
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'فشل تحليل قوة كلمة المرور',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * API: Get password policy.
     */
    public function getPasswordPolicy(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'سياسة كلمات المرور',
            'data' => [
                'minimum_length' => 8,
                'requires_uppercase' => true,
                'requires_lowercase' => true,
                'requires_numbers' => true,
                'requires_symbols' => true,
                'password_history_size' => 5,
                'maximum_age_days' => 90,
                'minimum_age_minutes' => 5,
                'lockout_attempts' => 5,
                'lockout_minutes' => 15,
                'common_passwords_blocked' => true
            ],
            'meta' => [
                'timestamp' => Carbon::now()->toISOString(),
                'version' => '1.0'
            ]
        ], 200);
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
        $user->save();
    }

    /**
     * Check password change cooldown.
     */
    private function isPasswordChangeCooldownActive(User $user): bool
    {
        if (!$user->password_changed_at) {
            return false;
        }
        
        $cooldownMinutes = config('auth.password.min_change_interval', 5);
        return $user->password_changed_at->addMinutes($cooldownMinutes)->isFuture();
    }

    /**
     * Get cooldown remaining time.
     */
    private function getCooldownRemaining(User $user): int
    {
        $cooldownMinutes = config('auth.password.min_change_interval', 5);
        return $user->password_changed_at->addMinutes($cooldownMinutes)->diffInMinutes(Carbon::now());
    }

    /**
     * Get next allowed change time.
     */
    private function getNextChangeAllowedTime(User $user): ?string
    {
        if ($this->isPasswordChangeCooldownActive($user)) {
            $cooldownMinutes = config('auth.password.min_change_interval', 5);
            return $user->password_changed_at->addMinutes($cooldownMinutes)->toISOString();
        }
        
        return null;
    }

    /**
     * Invalidate other sessions.
     */
    private function invalidateOtherSessions(User $user): void
    {
        // Implement session invalidation logic
        // This depends on your session driver
        Cache::tags(['user_sessions', $user->id])->flush();
    }

    /**
     * Invalidate all sessions.
     */
    private function invalidateAllSessions(User $user): void
    {
        // Invalidate all sessions for user
        Cache::tags(['user_sessions', $user->id])->flush();
        
        // If using JWT, add to blacklist
        if (config('auth.defaults.guard') === 'api') {
            // JWT token invalidation logic
        }
    }

    /**
     * Send password change notification email.
     */
    private function sendPasswordChangeNotification(User $user, Request $request): void
    {
        try {
            Mail::to($user->email)->send(new PasswordChangedMail($user, [
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'timestamp' => Carbon::now()
            ]));
        } catch (\Exception $e) {
            Log::error('Failed to send password change notification: ' . $e->getMessage());
        }
    }

    /**
     * Send password reset confirmation email.
     */
    private function sendPasswordResetConfirmation(User $user, Request $request): void
    {
        try {
            Mail::to($user->email)->send(new PasswordChangeNotificationMail($user, [
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'reset_method' => 'token',
                'timestamp' => Carbon::now()
            ]));
        } catch (\Exception $e) {
            Log::error('Failed to send password reset confirmation: ' . $e->getMessage());
        }
    }

    /**
     * Send admin force reset notification.
     */
    private function sendAdminForceResetNotification(User $user, string $tempPassword, User $admin, ?string $reason): void
    {
        try {
            Mail::to($user->email)->send(new \App\Mail\AdminForceResetMail($user, $tempPassword, $admin, $reason));
        } catch (\Exception $e) {
            Log::error('Failed to send admin force reset notification: ' . $e->getMessage());
        }
    }

    /**
     * Log password change activity.
     */
    private function logPasswordChangeActivity(User $user, Request $request): void
    {
        if (class_exists('Spatie\Activitylog\Models\Activity')) {
            activity()
                ->causedBy($user)
                ->withProperties([
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'action' => 'password_changed',
                    'logout_other_sessions' => $request->boolean('logout_other_sessions')
                ])
                ->log('Password changed');
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
                    'action' => 'password_reset_via_token',
                    'method' => 'reset_token'
                ])
                ->log('Password reset via token');
        }
    }

    /**
     * Log admin force reset activity.
     */
    private function logAdminForceResetActivity(User $targetUser, User $adminUser, array $data): void
    {
        if (class_exists('Spatie\Activitylog\Models\Activity')) {
            activity()
                ->causedBy($adminUser)
                ->performedOn($targetUser)
                ->withProperties([
                    'action' => 'admin_force_password_reset',
                    'reason' => $data['reason'] ?? null,
                    'logout_all_sessions' => $data['logout_all_sessions'] ?? true,
                    'notify_user' => $data['notify_user'] ?? true
                ])
                ->log('Admin forced password reset');
        }
    }

    /**
     * Generate new JWT token.
     */
    private function generateNewToken(User $user): ?string
    {
        if (config('auth.defaults.guard') === 'api') {
            try {
                return JWTAuth::fromUser($user);
            } catch (\Exception $e) {
                Log::error('Failed to generate new token: ' . $e->getMessage());
                return null;
            }
        }
        
        return null;
    }

    /**
     * Generate new token if needed.
     */
    private function generateNewTokenIfNeeded(User $user): ?string
    {
        // Only generate new token if using API guard and sessions should be maintained
        return $this->generateNewToken($user);
    }

    /**
     * Clear reset attempts.
     */
    private function clearResetAttempts(string $email): void
    {
        Cache::forget('password_reset_attempts:' . $email);
        Cache::forget('password_reset_cooldown:' . $email);
    }

    /**
     * Calculate password strength.
     */
    private function calculatePasswordStrength(string $password): array
    {
        $score = 0;
        $length = strlen($password);
        
        // Length
        if ($length >= 8) $score += 20;
        if ($length >= 12) $score += 10;
        if ($length >= 16) $score += 10;
        
        // Character variety
        if (preg_match('/[a-z]/', $password)) $score += 10;
        if (preg_match('/[A-Z]/', $password)) $score += 10;
        if (preg_match('/[0-9]/', $password)) $score += 10;
        if (preg_match('/[^A-Za-z0-9]/', $password)) $score += 10;
        
        // Deductions
        if ($this->isCommonPassword($password)) $score -= 30;
        if (preg_match('/(.)\1{2,}/', $password)) $score -= 10; // Repeated characters
        if (preg_match('/^[0-9]+$/', $password)) $score -= 20; // Only numbers
        
        $score = max(0, min(100, $score));
        
        $level = match(true) {
            $score >= 80 => 'strong',
            $score >= 60 => 'good',
            $score >= 40 => 'fair',
            default => 'weak'
        };
        
        return ['score' => $score, 'level' => $level];
    }

    /**
     * Check if password is common.
     */
    private function isCommonPassword(string $password): bool
    {
        $commonPasswords = [
            'password', '123456', '12345678', '123456789', '1234567890',
            'qwerty', 'password1', '12345', '1234', '111111',
            '123123', 'admin', 'letmein', 'welcome', 'monkey'
        ];
        
        return in_array(strtolower($password), $commonPasswords);
    }

    /**
     * Get password suggestions.
     */
    private function getPasswordSuggestions(string $password): array
    {
        $suggestions = [];
        $length = strlen($password);
        
        if ($length < 8) {
            $suggestions[] = 'إجعل كلمة المرور أطول (8 أحرف على الأقل)';
        }
        
        if (!preg_match('/[A-Z]/', $password)) {
            $suggestions[] = 'أضف حرفاً كبيراً (A-Z)';
        }
        
        if (!preg_match('/[0-9]/', $password)) {
            $suggestions[] = 'أضف رقماً (0-9)';
        }
        
        if (!preg_match('/[^A-Za-z0-9]/', $password)) {
            $suggestions[] = 'أضف رمزاً خاصاً (!@#$%...)';
        }
        
        if ($this->isCommonPassword($password)) {
            $suggestions[] = 'تجنب كلمات المرور الشائعة';
        }
        
        return $suggestions;
    }

    /**
     * Estimate crack time.
     */
    private function estimateCrackTime(string $password): string
    {
        $strength = $this->calculatePasswordStrength($password);
        
        return match($strength['level']) {
            'strong' => 'قرون',
            'good' => 'سنوات',
            'fair' => 'أشهر',
            default => 'ثواني إلى أيام'
        };
    }
}
