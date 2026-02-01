<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PasswordResetSecurityAlertMail extends Mailable
{
    use Queueable, SerializesModels;

    public $user;
    public $securityDetails;

    public function __construct(User $user, array $securityDetails)
    {
        $this->user = $user;
        $this->securityDetails = $securityDetails;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'تنبيه أمني: تم إعادة تعيين كلمة مرور حسابك - منصة عائلة المسعود',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.security.password-reset-alert',
            with: [
                'user' => $this->user,
                'securityDetails' => $this->securityDetails,
                'changePasswordUrl' => url('/change-password'),
                'supportEmail' => config('mail.support_email'),
                'currentYear' => date('Y'),
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
