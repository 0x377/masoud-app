<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PasswordChangedMail extends Mailable
{
    use Queueable, SerializesModels;

    public $user;
    public $changeDetails;

    public function __construct(User $user, array $changeDetails)
    {
        $this->user = $user;
        $this->changeDetails = $changeDetails;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'تم تغيير كلمة مرور حسابك - منصة عائلة المسعود',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.password-changed',
            with: [
                'user' => $this->user,
                'changeDetails' => $this->changeDetails,
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
