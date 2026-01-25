<?php

namespace App\Services;

use App\Models\User;
use App\Models\Notification as NotificationModel;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    /**
     * إرسال إشعار للمستخدم
     */
    public function sendNotification(User $user, $type, $title, $message, $data = [])
    {
        try {
            // حفظ الإشعار في قاعدة البيانات
            $notification = NotificationModel::create([
                'id' => \Illuminate\Support\Str::uuid(),
                'user_id' => $user->id,
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'data' => $data,
                'read_at' => null,
            ]);
            
            // إرسال بريد إلكتروني إذا كان المستخدم مفعل الإشعارات البريدية
            if ($user->email_notifications) {
                $this->sendEmailNotification($user, $type, $title, $message, $data);
            }
            
            // إرسال إشعار بدفع ويب إذا كان المستخدم متصلاً
            if ($user->web_push_enabled) {
                $this->sendWebPushNotification($user, $type, $title, $message, $data);
            }
            
            // إرسال رسالة SMS إذا كان رقم الهاتف مفعل
            if ($user->sms_notifications && $user->phone_number) {
                $this->sendSMSNotification($user, $message);
            }
            
            Log::info('Notification sent', [
                'user_id' => $user->id,
                'type' => $type,
                'title' => $title,
            ]);
            
            return $notification;
            
        } catch (\Exception $e) {
            Log::error('Failed to send notification', [
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
            
            return false;
        }
    }
    
    /**
     * إرسال إشعار بريدي
     */
    private function sendEmailNotification(User $user, $type, $title, $message, $data)
    {
        $emailClass = $this->getEmailClass($type);
        
        if ($emailClass) {
            Mail::to($user->email)->send(new $emailClass($user, $title, $message, $data));
        } else {
            // إرسال بريد افتراضي
            Mail::to($user->email)->send(new \App\Mail\GenericNotification($user, $title, $message, $data));
        }
    }
    
    /**
     * إرسال إشعار بدفع ويب
     */
    private function sendWebPushNotification(User $user, $type, $title, $message, $data)
    {
        // هنا يمكنك استخدام خدمة مثل Pusher أو Firebase
        // هذا مثال بسيط
        
        $payload = [
            'user_id' => $user->id,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'data' => $data,
            'timestamp' => now()->toIso8601String(),
        ];
        
        // إرسال عبر WebSocket
        broadcast(new \App\Events\NotificationEvent($user->id, $payload));
    }
    
    /**
     * إرسال إشعار SMS
     */
    private function sendSMSNotification(User $user, $message)
    {
        // هنا يمكنك استخدام خدمة SMS مثل Twilio أو أي مزود محلي
        // هذا مثال بسيط
        
        $smsService = config('services.sms.provider');
        
        if ($smsService === 'twilio') {
            // استخدام Twilio
            $this->sendViaTwilio($user->phone_number, $message);
        } elseif ($smsService === 'sms_gateway') {
            // استخدام بوابة SMS محلية
            $this->sendViaLocalGateway($user->phone_number, $message);
        }
    }
    
    /**
     * الحصول على فئة البريد المناسبة
     */
    private function getEmailClass($type)
    {
        $emailClasses = [
            'DONATION_RECEIPT' => \App\Mail\DonationReceipt::class,
            'MARRIAGE_AID_APPROVAL' => \App\Mail\MarriageAidApproval::class,
            'FAMILY_AID_APPROVAL' => \App\Mail\FamilyAidApproval::class,
            'MEETING_INVITATION' => \App\Mail\MeetingInvitation::class,
            'BOARD_DECISION' => \App\Mail\BoardDecision::class,
            'FAMILY_EVENT' => \App\Mail\FamilyEvent::class,
            'PASSWORD_CHANGED' => \App\Mail\PasswordChanged::class,
            'PROFILE_UPDATED' => \App\Mail\ProfileUpdated::class,
        ];
        
        return $emailClasses[$type] ?? null;
    }
    
    /**
     * إرسال إشعار لعدة مستخدمين
     */
    public function broadcastNotification($userIds, $type, $title, $message, $data = [])
    {
        $users = User::whereIn('id', $userIds)->get();
        
        $sentCount = 0;
        $failedCount = 0;
        
        foreach ($users as $user) {
            $result = $this->sendNotification($user, $type, $title, $message, $data);
            
            if ($result) {
                $sentCount++;
            } else {
                $failedCount++;
            }
        }
        
        return [
            'total' => count($users),
            'sent' => $sentCount,
            'failed' => $failedCount,
        ];
    }
    
    /**
     * إرسال إشعار لأعضاء لجنة معينة
     */
    public function notifyCommittee($committeeType, $title, $message, $data = [])
    {
        $users = User::where('user_type', $committeeType)->get();
        
        return $this->broadcastNotification(
            $users->pluck('id')->toArray(),
            'COMMITTEE_NOTIFICATION',
            $title,
            $message,
            $data
        );
    }
    
    /**
     * إرسال إشعار لجميع أعضاء العائلة
     */
    public function notifyAllFamilyMembers($title, $message, $data = [])
    {
        $users = User::where('user_type', 'FAMILY_MEMBER')->get();
        
        return $this->broadcastNotification(
            $users->pluck('id')->toArray(),
            'FAMILY_ANNOUNCEMENT',
            $title,
            $message,
            $data
        );
    }
    
    /**
     * الحصول على إشعارات المستخدم
     */
    public function getUserNotifications(User $user, $unreadOnly = false, $limit = 20)
    {
        $query = NotificationModel::where('user_id', $user->id);
        
        if ($unreadOnly) {
            $query->whereNull('read_at');
        }
        
        return $query->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }
    
    /**
     * تعليم إشعار كمقروء
     */
    public function markAsRead($notificationId, User $user)
    {
        $notification = NotificationModel::where('id', $notificationId)
            ->where('user_id', $user->id)
            ->first();
            
        if ($notification && !$notification->read_at) {
            $notification->update(['read_at' => now()]);
            return true;
        }
        
        return false;
    }
    
    /**
     * حذف إشعار
     */
    public function deleteNotification($notificationId, User $user)
    {
        return NotificationModel::where('id', $notificationId)
            ->where('user_id', $user->id)
            ->delete();
    }
    
    /**
     * مسح جميع الإشعارات المقروءة
     */
    public function clearReadNotifications(User $user)
    {
        return NotificationModel::where('user_id', $user->id)
            ->whereNotNull('read_at')
            ->delete();
    }
    
    /**
     * إحصاءات الإشعارات
     */
    public function getNotificationStats(User $user)
    {
        return [
            'total' => NotificationModel::where('user_id', $user->id)->count(),
            'unread' => NotificationModel::where('user_id', $user->id)->whereNull('read_at')->count(),
            'read' => NotificationModel::where('user_id', $user->id)->whereNotNull('read_at')->count(),
            'today' => NotificationModel::where('user_id', $user->id)
                ->whereDate('created_at', today())
                ->count(),
            'this_week' => NotificationModel::where('user_id', $user->id)
                ->whereBetween('created_at', [now()->startOfWeek(), now()->endOfWeek()])
                ->count(),
        ];
    }
}
