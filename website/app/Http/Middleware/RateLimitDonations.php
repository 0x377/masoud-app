<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class RateLimitDonations
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();
        $key = $user ? "donations:user:{$user->id}" : "donations:ip:{$request->ip()}";
        
        $maxAttempts = $user ? 10 : 5; // 10 محاولة للمستخدمين المسجلين، 5 للزوار
        $decayMinutes = 60; // خلال 60 دقيقة
        
        $attempts = Cache::get($key, 0);
        
        if ($attempts >= $maxAttempts) {
            return response()->json([
                'message' => 'لقد تجاوزت الحد المسموح به من التبرعات. يرجى المحاولة مرة أخرى لاحقاً.',
                'retry_after' => Cache::ttl($key) / 60 . ' دقيقة'
            ], 429);
        }
        
        Cache::add($key, 1, $decayMinutes * 60);
        Cache::increment($key);
        
        $response = $next($request);
        
        // إذا كانت العملية ناجحة، زيادة العداد
        if ($response->getStatusCode() === 201 || $response->getStatusCode() === 200) {
            Cache::increment($key . ':success');
        }
        
        return $response;
    }
}
