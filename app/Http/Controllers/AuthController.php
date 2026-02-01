<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\HasApiTokens;
use \Illuminate\Support\Str;

class AuthController extends Controller
{
    /**
     * Create new user
     */
    public function register(RegisterRequest $request)
    {
        $validated = $request->validated();

        $user = User::create([
            'id' => Str::uuid(),
            'national_id' => $validated['national_id'],
            'full_name_arabic' => $validated['full_name_arabic'],
            // 'full_name_english' => $validated['full_name_english'] ?? null,
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'gender' => $validated['gender'],
            'birth_date' => $validated['birth_date'] ?? null,
            'phone_number' => $validated['phone_number'],
            'user_type' => $validated['user_type'] ?? 'FAMILY_MEMBER',
        ]);

        // Create new person
        $user->person()->create([
            'person_id' => $user->id,
            'national_id' => $user->national_id,
            'full_name_arabic' => $user->full_name_arabic,
            'gender' => $user->gender,
            'birth_date' => $user->birth_date,
            'phone_number' => $user->phone_number,
            'email' => $user->email,
        ]);

        $token = $user->createToken('family-token')->plainTextToken;

        return response()->json([
            'message' => 'تم تسجيل المستخدم بنجاح',
            'user' => $user,
            'token' => $token,
            'permissions' => $this->getUserPermissions($user)
        ], 201);
    }

    /**
     * login
     */
    public function login(LoginRequest $request)
    {
        $credentials = $request->only('email', 'password');

        if (!Auth::attempt($credentials)) {
            return response()->json([
                'message' => 'بيانات الدخول غير صحيحة'
            ], 401);
        }

        $user = User::where('email', $request->email)->first();

        if (!$user->is_active) {
            return response()->json([
                'message' => 'الحساب معطل، يرجى التواصل مع الإدارة'
            ], 403);
        }

        $user->tokens()->delete();
        $token = $user->createToken('family-token')->plainTextToken;

        return response()->json([
            'message' => 'تم تسجيل الدخول بنجاح',
            'user' => $user,
            'token' => $token,
            'permissions' => $this->getUserPermissions($user)
        ]);
    }

    /**
     * logout
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        
        return response()->json([
            'message' => 'تم تسجيل الخروج بنجاح'
        ]);
    }

    /**
     * get all info user account
     */
    public function me(Request $request)
    {
        $user = $request->user();
        
        return response()->json([
            'user' => $user->load(['person', 'boardMember', 'executiveCommittee']),
            'permissions' => $this->getUserPermissions($user)
        ]);
    }

    /**
     * get user permissions
     */
    private function getUserPermissions(User $user)
    {
        $permissions = [
            'can_donate' => true, // منصة التبرعات مفتوحة للجميع
            'can_view_board' => $user->canAccessBoardSection(),
            'can_view_family_archive' => $user->canAccessFamilyArchive(),
            'can_manage_marriage_aid' => in_array($user->user_type, ['SOCIAL_COMMITTEE', 'SUPER_ADMIN']),
            'can_manage_finance' => in_array($user->user_type, ['FINANCE_MANAGER', 'SUPER_ADMIN']),
            'can_manage_executive' => in_array($user->user_type, ['EXECUTIVE', 'SUPER_ADMIN']),
            'can_view_reports' => in_array($user->user_type, ['EXECUTIVE', 'BOARD_MEMBER', 'SUPER_ADMIN']),
            'can_manage_media' => in_array($user->user_type, ['MEDIA_CENTER', 'SUPER_ADMIN']),
            'can_access_sports' => in_array($user->user_type, ['SPORTS_COMMITTEE', 'SUPER_ADMIN']),
            'can_access_cultural' => in_array($user->user_type, ['CULTURAL_COMMITTEE', 'SUPER_ADMIN']),
            'can_access_reconciliation' => in_array($user->user_type, ['RECONCILIATION_COMMITTEE', 'SUPER_ADMIN']),
        ];

        return $permissions;
    }

    /**
     * update profile
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();
        
        $validated = $request->validate([
            'full_name_arabic' => 'sometimes|string|max:255',
            'full_name_english' => 'nullable|string|max:255',
            'phone_number' => 'sometimes|string|max:20',
            'current_address' => 'nullable|string',
            'birth_date' => 'nullable|date',
            'blood_type' => 'nullable|string|max:5',
        ]);

        // تحديث بيانات المستخدم
        $user->update(array_filter($validated, function($key) {
            return in_array($key, ['full_name_arabic', 'full_name_english', 'phone_number', 'birth_date']);
        }, ARRAY_FILTER_USE_KEY));

        // تحديث بيانات الشخص
        if ($user->person) {
            $user->person->update($validated);
        }

        return response()->json([
            'message' => 'تم تحديث البيانات بنجاح',
            'user' => $user->fresh()
        ]);
    }

    /**
     * change password
     */
    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'message' => 'كلمة المرور الحالية غير صحيحة'
            ], 422);
        }

        $user->update([
            'password' => Hash::make($request->new_password)
        ]);

        return response()->json([
            'message' => 'تم تغيير كلمة المرور بنجاح'
        ]);
    }
}
