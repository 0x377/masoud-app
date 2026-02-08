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
    const html = BASE_TEMPLATE_MAIL.replace("TITLE", TITLE_LIST.veryifyCode)
      .replace("CONTENT", VERIFY_CODE)
      .replace("CODE", code);

    const recipient =
      config.app.env === "development" ? "gamaymaster2022@gmail.com" : email;

    const fromEmail =
      config.app.env === "development"
        ? "noreplay@demomailtrap.com"
        : config.email.from;

    const mailOptions = {
      from: `"Masoud Family" <${fromEmail}>`,
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

    // get veyfiy email template and replace
    const html = BASE_TEMPLATE_MAIL.replace("TITLE", TITLE_LIST.veryifyEmail)
      .replace("CONTENT", VERIFY_MAIL)
      .replace("URL", verificationUrl);

    const recipient =
      config.app.env === "development" ? "gamaymaster2022@gmail.com" : email;

    const fromEmail =
      config.app.env === "development"
        ? "noreplay@demomailtrap.com"
        : config.email.from;

    const mailOptions = {
      from: `"Masoud Family" <${fromEmail}>`,
      to: recipient,
      subject: "Verify Your Email Address",
      html,
      text: `Your verification email is: ${verificationUrl}`,
    };

    try {
      if (this.useSendGrid) {
        await this.transporter.send(mailOptions);
      } else {
        await this.transporter.sendMail(mailOptions);
      }
      console.log(`Verification email sent to ${email}`);
      return true;
    } catch (error) {
      console.error("Error sending verification email:", error);
      throw new Error("Failed to send verification email");
    }
  }

  async sendPasswordResetEmail(email, resetToken) {
    const resetUrl = `${config.app.url}/reset-password?token=${resetToken}`;

    // get veyfiy email template and replace
    const html = BASE_TEMPLATE_MAIL.replace("TITLE", TITLE_LIST.resetPassword)
      .replace("CONTENT", RESET_PASSWORD)
      .replace("URL", resetUrl);

    const recipient =
      config.app.env === "development" ? "gamaymaster2022@gmail.com" : email;

    const fromEmail =
      config.app.env === "development"
        ? "noreplay@demomailtrap.com"
        : config.email.from;

    const mailOptions = {
      from: `"Masoud Family" <${fromEmail}>`,
      to: recipient,
      subject: "Verify Your Email Address",
      html,
      text: `Reset Password: ${resetUrl}`,
    };

    try {
      if (this.useSendGrid) {
        await this.transporter.send(mailOptions);
      } else {
        await this.transporter.sendMail(mailOptions);
      }
      return true;
    } catch (error) {
      console.error("Error sending reset email:", error);
      // throw new Error("Failed to send reset email");
    }
  }

  async sendSuccessResetPassword(email) {
    // get veyfiy email template and replace
    const html = BASE_TEMPLATE_MAIL.replace(
      "TITLE",
      TITLE_LIST.successResetPassword,
    ).replace("CONTENT", SUCCESS_RESET_PASSWORD);

    const recipient =
      config.app.env === "development" ? "gamaymaster2022@gmail.com" : email;

    const fromEmail =
      config.app.env === "development"
        ? "noreplay@demomailtrap.com"
        : config.email.from;

    const mailOptions = {
      from: `"Masoud Family" <${fromEmail}>`,
      to: recipient,
      subject: "Successfull reset password",
      html,
    };

    try {
      if (this.useSendGrid) {
        await this.transporter.send(mailOptions);
      } else {
        await this.transporter.sendMail(mailOptions);
      }
      console.log(`Verification email sent to ${email}`);
      return true;
    } catch (error) {
      console.error("Error sending verification email:", error);
      throw new Error("Failed to send verification email");
    }
  }
}

export default new EmailService();
