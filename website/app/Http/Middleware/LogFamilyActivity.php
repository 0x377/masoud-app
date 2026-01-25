<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class LogFamilyActivity
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);
        
        $user = $request->user();
        
        if ($user) {
            $this->logActivity($user, $request, $response);
        }
        
        return $response;
    }
    
    private function logActivity($user, Request $request, $response)
    {
        $activityData = [
            'user_id' => $user->id,
            'user_type' => $user->user_type,
            'action' => $request->method(),
            'endpoint' => $request->path(),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'request_data' => $this->sanitizeRequestData($request->all()),
            'response_status' => $response->getStatusCode(),
            'timestamp' => now()->toDateTimeString(),
        ];
        
        // تسجيل النشاط في قاعدة البيانات
        \App\Models\ActivityLog::create([
            'id' => \Illuminate\Support\Str::uuid(),
            ...$activityData
        ]);
        
        // تسجيل في ملفات اللوغ
        Log::channel('family_activity')->info('Family Activity', $activityData);
    }
    
    private function sanitizeRequestData($data)
    {
        $sensitiveFields = [
            'password',
            'password_confirmation',
            'current_password',
            'new_password',
            'card_number',
            'cvv',
            'cvv2',
            'card_holder_name',
            'expiry_month',
            'expiry_year',
        ];
        
        foreach ($sensitiveFields as $field) {
            if (isset($data[$field])) {
                $data[$field] = '***MASKED***';
            }
        }
        
        return $data;
    }
}
