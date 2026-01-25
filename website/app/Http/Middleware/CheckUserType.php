<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckUserType
{
    public function handle(Request $request, Closure $next, ...$types): Response
    {
        $user = $request->user();
        
        if (!$user) {
            return response()->json([
                'message' => 'يرجى تسجيل الدخول للوصول إلى هذا المورد'
            ], 401);
        }
        
        if (!in_array($user->user_type, $types)) {
            return response()->json([
                'message' => 'غير مصرح لك بالوصول إلى هذا القسم',
                'required_types' => $types,
                'your_type' => $user->user_type
            ], 403);
        }
        
        // التحقق من أن الحساب مفعل
        if (!$user->is_active) {
            return response()->json([
                'message' => 'حسابك معطل، يرجى التواصل مع الإدارة'
            ], 403);
        }
        
        return $next($request);
    }
}
