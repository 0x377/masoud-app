<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ValidateFamilyMember
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        
        if (!$user) {
            return response()->json([
                'message' => 'يرجى تسجيل الدخول'
            ], 401);
        }
        
        // التحقق من أن المستخدم لديه سجل في جدول الأشخاص
        if (!$user->person) {
            return response()->json([
                'message' => 'لم يتم العثور على بياناتك في سجل العائلة، يرجى التواصل مع الإدارة'
            ], 404);
        }
        
        // التحقق من أن الشخص ليس في قائمة المحظورين
        if ($user->person->is_banned) {
            return response()->json([
                'message' => 'تم حظر وصولك إلى نظام العائلة',
                'reason' => $user->person->ban_reason,
                'banned_until' => $user->person->banned_until
            ], 403);
        }
        
        // إضافة بيانات الشخص إلى الـ Request
        $request->merge([
            'family_member' => $user->person
        ]);
        
        return $next($request);
    }
}
