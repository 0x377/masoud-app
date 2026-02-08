// email.test.js - FIXED VERSION
import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";
import config from "../config/index.js";
import {
  TITLE_LIST,
  BASE_TEMPLATE_MAIL,
  VERIFY_MAIL,
  RESET_PASSWORD,
  VERIFY_CODE,
  SUCCESS_RESET_PASSWORD,
} from "../tempMail/index.js";

class EmailService {
  constructor() {
    // Use SendGrid for production
    if (config.app.env === "production") {
      sgMail.setApiKey(config.email.apiKey);
      this.transporter = sgMail;
      this.useSendGrid = true;
    } else {
      // For development/testing
      this.transporter = nodemailer.createTransport({
        host: config.email.mailtrapHost,
        port: config.email.mailtrapPort,
        auth: {
          user: config.email.mailtrapUser,
          pass: config.email.mailtrapPass,
        },
      });
      this.useSendGrid = false;
    }
  }

  async sendVerificationCode(email, code) {
    const html = BASE_TEMPLATE_MAIL.replace("TITLE", TITLE_LIST.veryifyEmail)
      .replace("CONTENT", VERIFY_CODE)
      .replace("CODE", code);

    const recipient =
      config.app.env === "development" ? "gamaymaster2022@gmail.com" : email;

    const fromEmail =
      config.app.env === "development"
        ? "noreplay@demomailtrap.com"
        : config.email.from;

    const mailOptions = {
      from: `"Your App" <${fromEmail}>`,
      to: recipient,
      subject: "Verify Your Email Address",
      html,
      text: `Your verification code is: ${code}`,
    };

    try {
      if (this.useSendGrid) {
        await this.transporter.send(mailOptions);
      } else {
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Verification email sent to ${recipient}`);
        console.log("📧 Message ID:", info.messageId);

        // Get preview URL for Mailtrap
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          console.log("👀 Preview URL:", previewUrl);
        }
      }
      return true;
    } catch (error) {
      console.error("❌ Error sending verification email:", error.message);

      // Provide helpful error message
      if (error.message.includes("Demo domains")) {
        console.log(
          "\n🔧 Solution: You can only send to YOUR OWN email when using demo domains.",
        );
        console.log("Update your .env file with:");
        console.log("EMAIL_FROM=your_real_email@gmail.com");
        console.log("EMAIL_TEST_RECIPIENT=your_real_email@gmail.com");
      }

      throw new Error("Failed to send verification email");
    }
  }

  async sendVerificationEmail(email, verificationToken) {
    const verificationUrl = `${config.app.url}/api/auth/verify-email?token=${verificationToken}`;

    const html = BASE_TEMPLATE_MAIL.replace("TITLE", TITLE_LIST.veryifyEmail)
      .replace("CONTENT", VERIFY_MAIL)
      .replace("URL", verificationUrl);

    // Use test recipient in development
    const recipient =
      config.app.env === "development"
        ? config.email.testRecipient || email
        : email;

    const mailOptions = {
      from: `"Your App" <${config.email.from || "noreply@yourapp.com"}>`,
      to: recipient,
      subject: "Verify Your Email Address",
      html,
      text: `Verify your email: ${verificationUrl}`,
    };

    try {
      if (this.useSendGrid) {
        await this.transporter.send(mailOptions);
      } else {
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Verification email sent to ${recipient}`);
        console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
      }
      return true;
    } catch (error) {
      console.error("Error sending verification email:", error);
      throw new Error("Failed to send verification email");
    }
  }

  async sendPasswordResetEmail(email, resetToken) {
    const resetUrl = `${config.app.url}/reset-password?token=${resetToken}`;

    const html = BASE_TEMPLATE_MAIL.replace("TITLE", TITLE_LIST.resetPassword)
      .replace("CONTENT", RESET_PASSWORD)
      .replace("URL", resetUrl);

    // Use test recipient in development
    const recipient =
      config.app.env === "development"
        ? config.email.testRecipient || email
        : email;

    const mailOptions = {
      from: `"Your App" <${config.email.from || "noreply@yourapp.com"}>`,
      to: recipient,
      subject: "Password Reset Request",
      html,
      text: `Reset password: ${resetUrl}`,
    };

    try {
      if (this.useSendGrid) {
        await this.transporter.send(mailOptions);
      } else {
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Password reset email sent to ${recipient}`);
        console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
      }
      return true;
    } catch (error) {
      console.error("Error sending reset email:", error);
      throw new Error("Failed to send reset email");
    }
  }

  async sendSuccessResetPassword(email) {
    const html = BASE_TEMPLATE_MAIL.replace(
      "TITLE",
      TITLE_LIST.successResetPassword,
    ).replace("CONTENT", SUCCESS_RESET_PASSWORD);

    // Use test recipient in development
    const recipient =
      config.app.env === "development"
        ? config.email.testRecipient || email
        : email;

    const mailOptions = {
      from: `"Your App" <${config.email.from || "noreply@yourapp.com"}>`,
      to: recipient,
      subject: "Password Reset Successful",
      html,
      text: "Your password has been reset successfully.",
    };

    try {
      if (this.useSendGrid) {
        await this.transporter.send(mailOptions);
      } else {
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Success email sent to ${recipient}`);
        console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
      }
      return true;
    } catch (error) {
      console.error("Error sending success email:", error);
      throw new Error("Failed to send success email");
    }
  }
}

const emailService = new EmailService();

async function testEmail() {
  try {
    console.log("📧 Testing email service...");
    console.log("Environment:", config.app.env);

    const testEmail = "gamaymaster2022@gmail.com";

    console.log(`Sending to: ${testEmail}`);
    console.log("From:", config.email.from || "noreply@demomailtrap.com");

    await emailService.sendVerificationCode(testEmail, "123456");
    console.log("✅ Email sent successfully!");
  } catch (error) {
    console.error("❌ Error sending email:", error.message);
  }
}

testEmail();
