<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Person;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;
use Tymon\JWTAuth\Facades\JWTAuth;
use Carbon\Carbon;
use App\Mail\RegistrationSuccessMail;
use App\Mail\WelcomeMail;
use App\Mail\AdminNotificationMail;
use Illuminate\Support\Facades\Log;

class RegisteredUserController extends Controller
{
    /**
     * Display the registration view.
     */
    public function create(): Response
    {
        return Inertia::render('Auth/Register');
    }

    /**
     * Handle an incoming registration request (for web).
     */
    public function store(Request $request): RedirectResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        event(new Registered($user));

        Auth::login($user);

        return redirect(route('dashboard', absolute: false));
    }

    /**
     * API Registration with JWT tokens and email notifications
     */
    public function register(Request $request): JsonResponse
    {
        try {
            // Validation
            $validated = $request->validate([
                'national_id' => 'required|string|max:20|unique:users,national_id',
                'full_name_arabic' => 'required|string|max:255',
                'full_name_english' => 'nullable|string|max:255',
                'email' => 'required|string|email|max:255|unique:users,email',
                'password' => ['required', 'confirmed', Rules\Password::defaults()],
                'gender' => 'required|in:male,female',
                'birth_date' => 'nullable|date',
                'phone_number' => 'required|string|max:20',
                'user_type' => 'nullable|in:FAMILY_MEMBER,ADMIN,MANAGER',
                'family_id' => 'nullable|exists:families,id',
                'terms_accepted' => 'required|accepted',
            ]);

            // Generate UUID
            $userId = Str::uuid();

            // Create user
            $user = User::create([
                'id' => $userId,
                'national_id' => $validated['national_id'],
                'full_name_arabic' => $validated['full_name_arabic'],
                'full_name_english' => $validated['full_name_english'] ?? null,
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'gender' => $validated['gender'],
                'birth_date' => $validated['birth_date'] ?? null,
                'phone_number' => $validated['phone_number'],
                'user_type' => $validated['user_type'] ?? 'FAMILY_MEMBER',
                'family_id' => $validated['family_id'] ?? null,
                'email_verification_token' => Str::random(60),
                'email_verified_at' => null,
                'is_active' => true,
                'registration_ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            // Create person record
            $person = Person::create([
                'person_id' => $user->id,
                'national_id' => $user->national_id,
                'full_name_arabic' => $user->full_name_arabic,
                'full_name_english' => $user->full_name_english,
                'gender' => $user->gender,
                'birth_date' => $user->birth_date,
                'phone_number' => $user->phone_number,
                'email' => $user->email,
                'user_type' => $user->user_type,
                'is_active' => true,
            ]);

            // Assign default role based on user type
            $this->assignDefaultRole($user);

            // Generate JWT tokens
            $accessToken = JWTAuth::fromUser($user);
            $refreshToken = $this->generateRefreshToken($user);

            // Send email notifications
            $this->sendRegistrationEmails($user);

            // Log registration activity
            $this->logRegistrationActivity($user, $request);

            // Prepare response data
            $userData = $this->prepareUserData($user);

            // Generate email verification URL
            $verificationUrl = $this->generateVerificationUrl($user);

            // Event
            event(new Registered($user));

            return response()->json([
                'success' => true,
                'message' => 'تم تسجيل المستخدم بنجاح',
                'data' => [
                    'user' => $userData,
                    'access_token' => $accessToken,
                    'refresh_token' => $refreshToken,
                    'token_type' => 'bearer',
                    'expires_in' => config('jwt.ttl') * 60,
                    'redirect_to' => $this->getRedirectUrl($user),
                    'verification_required' => true,
                    'verification_url' => $verificationUrl,
                ],
                'meta' => [
                    'timestamp' => Carbon::now()->toISOString(),
                    'version' => '1.0',
                    'notifications' => [
                        'email_sent' => true,
                        'welcome_sent' => true,
                        'admin_notified' => true,
                    ]
                ]
            ], 201);

        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'خطأ في التحقق من البيانات',
                'errors' => $e->errors(),
                'error_code' => 'VALIDATION_ERROR'
            ], 422);

        } catch (\Exception $e) {
            Log::error('Registration error: ' . $e->getMessage(), [
                'email' => $request->email ?? 'N/A',
                'ip' => $request->ip(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء التسجيل',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'error_code' => 'REGISTRATION_FAILED'
            ], 500);
        }
    }

    /**
     * Generate refresh token
     */
    private function generateRefreshToken(User $user): string
    {
        $refreshToken = Str::random(80);
        
        // Store in cache or database
        cache()->put('refresh_token:' . $user->id, [
            'token' => $refreshToken,
            'user_id' => $user->id,
            'expires_at' => Carbon::now()->addDays(14)
        ], 14 * 24 * 60); // 14 days in minutes

        return $refreshToken;
    }

    /**
     * Assign default role to user
     */
    private function assignDefaultRole(User $user): void
    {
        $role = match($user->user_type) {
            'ADMIN' => 'admin',
            'MANAGER' => 'manager',
            default => 'family_member',
        };

        // If using spatie/laravel-permission
        if (class_exists('Spatie\Permission\Models\Role')) {
            $user->assignRole($role);
        }

        // Set default permissions
        $permissions = $this->getDefaultPermissions($role);
        $user->permissions = $permissions;
        $user->save();
    }

    /**
     * Get default permissions for role
     */
    private function getDefaultPermissions(string $role): array
    {
        return match($role) {
            'admin' => [
                'view_dashboard',
                'manage_users',
                'manage_family',
                'view_reports',
                'manage_settings',
            ],
            'manager' => [
                'view_dashboard',
                'manage_family',
                'view_reports',
            ],
            default => [
                'view_dashboard',
                'view_profile',
                'update_profile',
            ],
        };
    }

    /**
     * Send registration emails
     */
    private function sendRegistrationEmails(User $user): void
    {
        try {
            // Send welcome email to user
            Mail::to($user->email)->queue(new WelcomeMail($user));

            // Send registration success email with verification link
            Mail::to($user->email)->queue(new RegistrationSuccessMail($user));

            // Notify admin about new registration
            $adminEmail = config('mail.admin_email');
            if ($adminEmail) {
                Mail::to($adminEmail)->queue(new AdminNotificationMail($user));
            }

            Log::info('Registration emails sent successfully', ['user_id' => $user->id]);

        } catch (\Exception $e) {
            Log::error('Failed to send registration emails: ' . $e->getMessage(), [
                'user_id' => $user->id,
                'email' => $user->email
            ]);
        }
    }

    /**
     * Log registration activity
     */
    private function logRegistrationActivity(User $user, Request $request): void
    {
        if (class_exists('Spatie\Activitylog\Models\Activity')) {
            activity()
                ->causedBy($user)
                ->withProperties([
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'registration_type' => 'api',
                    'timestamp' => Carbon::now()
                ])
                ->log('User registered successfully');
        }
    }

    /**
     * Prepare user data for response
     */
    private function prepareUserData(User $user): array
    {
        $roles = [];
        $permissions = [];

        if (class_exists('Spatie\Permission\Models\Role')) {
            $roles = $user->getRoleNames()->toArray();
            $permissions = $user->getAllPermissions()->pluck('name')->toArray();
        } else {
            $roles = [$user->user_type];
            $permissions = $user->permissions ?? [];
        }

        return [
            'id' => $user->id,
            'national_id' => $user->national_id,
            'full_name_arabic' => $user->full_name_arabic,
            'full_name_english' => $user->full_name_english,
            'email' => $user->email,
            'gender' => $user->gender,
            'birth_date' => $user->birth_date?->format('Y-m-d'),
            'phone_number' => $user->phone_number,
            'user_type' => $user->user_type,
            'family_id' => $user->family_id,
            'email_verified' => $user->hasVerifiedEmail(),
            'is_active' => $user->is_active,
            'created_at' => $user->created_at->toISOString(),
            'roles' => $roles,
            'permissions' => $permissions,
        ];
    }

    /**
     * Generate email verification URL
     */
    private function generateVerificationUrl(User $user): string
    {
        return url("/api/verify-email/{$user->email_verification_token}");
    }

    /**
     * Get redirect URL based on user role
     */
    private function getRedirectUrl(User $user): string
    {
        return match($user->user_type) {
            'ADMIN' => '/admin/dashboard',
            'MANAGER' => '/manager/dashboard',
            default => '/dashboard',
        };
    }

    /**
     * Verify email address
     */
    public function verifyEmail(Request $request, string $token): JsonResponse
    {
        try {
            $user = User::where('email_verification_token', $token)->first();

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'رمز التحقق غير صالح أو منتهي الصلاحية',
                    'error_code' => 'INVALID_TOKEN'
                ], 400);
            }

            if ($user->hasVerifiedEmail()) {
                return response()->json([
                    'success' => false,
                    'message' => 'البريد الإلكتروني مفعل مسبقاً',
                    'error_code' => 'ALREADY_VERIFIED'
                ], 400);
            }

            $user->email_verified_at = Carbon::now();
            $user->email_verification_token = null;
            $user->save();

            // Send confirmation email
            Mail::to($user->email)->send(new EmailVerifiedMail($user));

            return response()->json([
                'success' => true,
                'message' => 'تم تفعيل البريد الإلكتروني بنجاح',
                'data' => [
                    'user' => [
                        'id' => $user->id,
                        'email' => $user->email,
                        'email_verified_at' => $user->email_verified_at,
                    ],
                    'redirect_to' => '/login'
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Email verification error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'فشل تفعيل البريد الإلكتروني',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Resend verification email
     */
    public function resendVerificationEmail(Request $request): JsonResponse
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

            // Generate new token if expired
            if (!$user->email_verification_token) {
                $user->email_verification_token = Str::random(60);
                $user->save();
            }

            // Resend verification email
            Mail::to($user->email)->send(new RegistrationSuccessMail($user, true));

            return response()->json([
                'success' => true,
                'message' => 'تم إرسال رابط التفعيل إلى بريدك الإلكتروني',
                'data' => [
                    'email' => $user->email,
                    'expires_in' => '24 hours'
                ]
            ], 200);

        } catch (\Exception $e) {
            Log::error('Resend verification error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'فشل إرسال رابط التفعيل',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Check email availability
     */
    public function checkEmail(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'email' => 'required|email'
            ]);

            $exists = User::where('email', $request->email)->exists();

            return response()->json([
                'success' => true,
                'data' => [
                    'email' => $request->email,
                    'available' => !$exists,
                    'message' => $exists ? 'البريد الإلكتروني مستخدم مسبقاً' : 'البريد الإلكتروني متاح'
                ]
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'فشل التحقق من البريد الإلكتروني',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Check national ID availability
     */
    public function checkNationalId(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'national_id' => 'required|string|max:20'
            ]);

            $exists = User::where('national_id', $request->national_id)->exists();

            return response()->json([
                'success' => true,
                'data' => [
                    'national_id' => $request->national_id,
                    'available' => !$exists,
                    'message' => $exists ? 'رقم الهوية مستخدم مسبقاً' : 'رقم الهوية متاح'
                ]
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'فشل التحقق من رقم الهوية',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }
}
