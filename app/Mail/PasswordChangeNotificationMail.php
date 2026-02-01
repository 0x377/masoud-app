<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PasswordChangeNotificationMail extends Mailable
{
    use Queueable, SerializesModels;

    public $user;
    public $resetDetails;

    public function __construct(User $user, array $resetDetails)
    {
        $this->user = $user;
        $this->resetDetails = $resetDetails;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'تم إعادة تعيين كلمة مرور حسابك - منصة عائلة المسعود',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.password-reset-confirmation',
            with: [
                'user' => $this->user,
                'resetDetails' => $this->resetDetails,
                'loginUrl' => url('/login'),
                'currentYear' => date('Y'),
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
