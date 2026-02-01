<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class EmailVerifiedMail extends Mailable
{
    use Queueable, SerializesModels;

    public $user;
    public $loginUrl;
    public $dashboardUrl;

    public function __construct(User $user)
    {
        $this->user = $user;
        $this->loginUrl = url('/login');
        $this->dashboardUrl = $this->getDashboardUrl($user);
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'تم تفعيل بريدك الإلكتروني - منصة عائلة المسعود',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.email-verified',
            with: [
                'user' => $this->user,
                'loginUrl' => $this->loginUrl,
                'dashboardUrl' => $this->dashboardUrl,
                'verificationDate' => now()->format('Y-m-d H:i:s'),
                'currentYear' => date('Y'),
            ],
        );
    }

    private function getDashboardUrl(User $user): string
    {
        return match($user->user_type) {
            'ADMIN' => url('/admin/dashboard'),
            'MANAGER' => url('/manager/dashboard'),
            default => url('/dashboard'),
        };
    }

    public function attachments(): array
    {
        return [];
    }
}
