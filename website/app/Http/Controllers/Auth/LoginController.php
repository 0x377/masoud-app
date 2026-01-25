<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Tymon\JWTAuth\Facades\JWTAuth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;

class LoginController extends Controller
{
    // Show login page
    public function create(): Response
    {
        return Inertia::render('Auth/Login');
    }

    // Login user and generate tokens
    public function store(Request $request): JsonResponse
    {
        try {
            // Validation input user
            $validator = Validator::make($request->all(), [
                'email' => 'required|email|max:255',
                'password' => 'required|string|min:6',
                'remember_me' => 'boolean'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Check user credentials
            $credentials = $request->only('email', 'password');
            
            if (!Auth::attempt($credentials)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid email or password',
                    'error_code' => 'INVALID_CREDENTIALS'
                ], 401);
            }

            // Get authenticated user
            $user = Auth::user();
            
            // Check if user is active
            if (!$user->is_active) {
                Auth::logout();
                return response()->json([
                    'success' => false,
                    'message' => 'Your account has been deactivated',
                    'error_code' => 'ACCOUNT_DEACTIVATED'
                ], 403);
            }

            // Check if user email is verified
            if (!$user->hasVerifiedEmail()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Please verify your email address',
                    'error_code' => 'EMAIL_NOT_VERIFIED',
                    'user_id' => $user->id
                ], 403);
            }

            // Generate JWT tokens
            $accessToken = JWTAuth::fromUser($user);
            
            // Generate refresh token
            $refreshToken = $this->generateRefreshToken($user);
            
            // Update last login
            $user->last_login_at = Carbon::now();
            $user->last_login_ip = $request->ip();
            $user->save();

            // Log login activity
            $this->logLoginActivity($user, $request);

            // Prepare user data for response
            $userData = [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'avatar' => $user->avatar,
                'roles' => $user->roles->pluck('name'),
                'permissions' => $user->getAllPermissions()->pluck('name'),
                'is_active' => $user->is_active,
                'email_verified_at' => $user->email_verified_at,
                'last_login_at' => $user->last_login_at,
            ];

            // Response with tokens and user data
            $response = [
                'success' => true,
                'message' => 'Login successful',
                'data' => [
                    'user' => $userData,
                    'access_token' => $accessToken,
                    'refresh_token' => $refreshToken,
                    'token_type' => 'bearer',
                    'expires_in' => config('jwt.ttl') * 60, // in seconds
                    'redirect_to' => $this->getRedirectUrl($user),
                ],
                'meta' => [
                    'timestamp' => Carbon::now()->toISOString(),
                    'version' => '1.0'
                ]
            ];

            return response()->json($response, 200);

        } catch (\Exception $e) {
            \Log::error('Login error: ' . $e->getMessage(), [
                'email' => $request->email,
                'ip' => $request->ip()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'An error occurred during login',
                'error' => config('app.debug') ? $e->getMessage() : 'Server error',
                'error_code' => 'SERVER_ERROR'
            ], 500);
        }
    }

    // Generate refresh token
    private function generateRefreshToken(User $user): string
    {
        $refreshToken = Str::random(80);
        
        // Store refresh token in cache with expiration
        $key = 'refresh_token:' . $user->id;
        $expiration = config('jwt.refresh_ttl') * 60; // in seconds
        
        Cache::put($key, [
            'token' => $refreshToken,
            'user_id' => $user->id,
            'expires_at' => Carbon::now()->addSeconds($expiration)
        ], $expiration);

        return $refreshToken;
    }

    // Refresh access token
    public function refreshToken(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'refresh_token' => 'required|string'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Get refresh token from cache
            $refreshTokenData = null;
            foreach (Cache::get('refresh_tokens', []) as $key => $data) {
                if ($data['token'] === $request->refresh_token) {
                    $refreshTokenData = $data;
                    break;
                }
            }

            if (!$refreshTokenData || $refreshTokenData['expires_at'] < Carbon::now()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid or expired refresh token',
                    'error_code' => 'INVALID_REFRESH_TOKEN'
                ], 401);
            }

            // Get user
            $user = User::find($refreshTokenData['user_id']);
            
            if (!$user || !$user->is_active) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found or inactive',
                    'error_code' => 'USER_INACTIVE'
                ], 401);
            }

            // Generate new tokens
            $accessToken = JWTAuth::fromUser($user);
            $newRefreshToken = $this->generateRefreshToken($user);

            // Remove old refresh token
            $this->removeRefreshToken($request->refresh_token);

            return response()->json([
                'success' => true,
                'message' => 'Token refreshed successfully',
                'data' => [
                    'access_token' => $accessToken,
                    'refresh_token' => $newRefreshToken,
                    'token_type' => 'bearer',
                    'expires_in' => config('jwt.ttl') * 60,
                ]
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Token refresh error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to refresh token',
                'error' => config('app.debug') ? $e->getMessage() : 'Server error'
            ], 500);
        }
    }

    // Remove refresh token
    private function removeRefreshToken(string $refreshToken): void
    {
        $refreshTokens = Cache::get('refresh_tokens', []);
        
        foreach ($refreshTokens as $key => $data) {
            if ($data['token'] === $refreshToken) {
                unset($refreshTokens[$key]);
                Cache::put('refresh_tokens', $refreshTokens);
                break;
            }
        }
    }

    // Get redirect URL based on user role
    private function getRedirectUrl(User $user): string
    {
        if ($user->hasRole('admin')) {
            return '/admin/dashboard';
        } elseif ($user->hasRole('manager')) {
            return '/manager/dashboard';
        } else {
            return '/dashboard';
        }
    }

    // Log login activity
    private function logLoginActivity(User $user, Request $request): void
    {
        activity()
            ->causedBy($user)
            ->withProperties([
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'timestamp' => Carbon::now()
            ])
            ->log('User logged in');
    }

    // Verify token validity
    public function verifyToken(Request $request): JsonResponse
    {
        try {
            $token = JWTAuth::parseToken();
            
            return response()->json([
                'success' => true,
                'message' => 'Token is valid',
                'data' => [
                    'user_id' => $token->getClaim('sub'),
                    'expires_at' => Carbon::createFromTimestamp($token->getClaim('exp'))->toDateTimeString(),
                    'issued_at' => Carbon::createFromTimestamp($token->getClaim('iat'))->toDateTimeString(),
                ]
            ], 200);

        } catch (\Tymon\JWTAuth\Exceptions\TokenExpiredException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Token has expired',
                'error_code' => 'TOKEN_EXPIRED'
            ], 401);
            
        } catch (\Tymon\JWTAuth\Exceptions\TokenInvalidException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Token is invalid',
                'error_code' => 'TOKEN_INVALID'
            ], 401);
            
        } catch (\Tymon\JWTAuth\Exceptions\JWTException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Token not provided',
                'error_code' => 'TOKEN_MISSING'
            ], 401);
        }
    }

    // Logout user
    public function destroy(Request $request): JsonResponse
    {
        try {
            // Get refresh token from request
            $refreshToken = $request->input('refresh_token');
            
            if ($refreshToken) {
                $this->removeRefreshToken($refreshToken);
            }

            // Invalidate JWT token
            JWTAuth::invalidate(JWTAuth::getToken());

            // Log logout activity
            if ($request->user()) {
                activity()
                    ->causedBy($request->user())
                    ->log('User logged out');
            }

            return response()->json([
                'success' => true,
                'message' => 'Successfully logged out',
                'data' => []
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Logout error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to logout',
                'error' => config('app.debug') ? $e->getMessage() : 'Server error'
            ], 500);
        }
    }

    // Get authenticated user profile
    public function profile(Request $request): JsonResponse
    {
        try {
            $user = $request->user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated',
                    'error_code' => 'UNAUTHENTICATED'
                ], 401);
            }

            $userData = [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'avatar' => $user->avatar,
                'roles' => $user->roles->pluck('name'),
                'permissions' => $user->getAllPermissions()->pluck('name'),
                'is_active' => $user->is_active,
                'email_verified_at' => $user->email_verified_at,
                'created_at' => $user->created_at,
                'last_login_at' => $user->last_login_at,
                'login_count' => $user->login_count,
            ];

            return response()->json([
                'success' => true,
                'message' => 'User profile retrieved successfully',
                'data' => [
                    'user' => $userData
                ]
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Profile error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Failed to retrieve profile',
                'error' => config('app.debug') ? $e->getMessage() : 'Server error'
            ], 500);
        }
    }

    // Login with social providers (optional)
    public function socialLogin(Request $request, string $provider): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'access_token' => 'required|string',
                'provider_id' => 'required|string'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation error',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Implement social login logic based on provider
            // This is a placeholder - you'll need to implement actual OAuth2 flow
            $user = $this->handleSocialLogin($provider, $request->all());

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to authenticate with ' . ucfirst($provider),
                    'error_code' => 'SOCIAL_AUTH_FAILED'
                ], 401);
            }

            // Generate tokens
            $accessToken = JWTAuth::fromUser($user);
            $refreshToken = $this->generateRefreshToken($user);

            return response()->json([
                'success' => true,
                'message' => 'Social login successful',
                'data' => [
                    'user' => $user->only(['id', 'name', 'email', 'avatar']),
                    'access_token' => $accessToken,
                    'refresh_token' => $refreshToken,
                    'token_type' => 'bearer',
                    'expires_in' => config('jwt.ttl') * 60,
                    'redirect_to' => $this->getRedirectUrl($user),
                ]
            ], 200);

        } catch (\Exception $e) {
            \Log::error('Social login error: ' . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'Social authentication failed',
                'error' => config('app.debug') ? $e->getMessage() : 'Server error'
            ], 500);
        }
    }

    // Handle social login logic
    private function handleSocialLogin(string $provider, array $data): ?User
    {
        // Implement actual social login logic here
        // This could integrate with Socialite package
        return null;
    }
}
