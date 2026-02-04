import nodemailer from "nodemailer";
import sgMail from "@sendgrid/mail";
import config from "../config/index.js";
import {
  title_list,
  BASE_TEMPLATE_MAIL,
  VERIFY_MAIL,
  RESET_PASSWORD,
  VERIFY_CODE,
} from "../tempMail/index.js";

class EmailService {
  constructor() {
    // Use SendGrid for production
    if (config.env === "production") {
      sgMail.setApiKey(config.email.apiKey);
      this.transporter = sgMail;
      this.useSendGrid = true;
    } else {
      // For development/testing
      this.transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        auth: {
          user: "gamaymaster2022@gmail.com",
          pass: "this_is_real_account",
        },
      });
      this.useSendGrid = false;
    }
  }

  async sendVerificationCode(email, code) {
    // get veyfiy email template and replace
    const title = BASE_TEMPLATE_MAIL.replace("TITLE", title_list.veryifyEmail);
    const getVerifyCode = VERIFY_CODE.replace("CODE", code);
    const html = title.replace("CONTENT", getVerifyCode);

    const mailOptions = {
      from: config.email.from,
      to: email,
      subject: "Verify Your Email Address",
      html: html,
      text: `Please verify your email by clicking this link: ${verificationUrl}`,
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

  async sendVerificationEmail(email, verificationToken) {
    const verificationUrl = `${config.app.url}/api/auth/verify-email?token=${verificationToken}`;

    // get veyfiy email template and replace
    const title = BASE_TEMPLATE_MAIL.replace("TITLE", title_list.veryifyEmail);
    const getVerifyMail = VERIFY_MAIL.replace("URL", verificationUrl);
    const html = title.replace("CONTENT", getVerifyMail);

    const mailOptions = {
      from: config.email.from,
      to: email,
      subject: "Verify Your Email Address",
      html: html,
      text: `Please verify your email by clicking this link: ${verificationUrl}`,
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
    const title = BASE_TEMPLATE_MAIL.replace("TITLE", title_list.resetPassword);
    const getResetPassword = RESET_PASSWORD.replace("URL", resetUrl);
    const html = title.replace("CONTENT", getResetPassword);

    const mailOptions = {
      from: config.email.from,
      to: email,
      subject: "Password Reset Request",
      html: html,
      text: `Reset your password: ${resetUrl}`,
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
      throw new Error("Failed to send reset email");
    }
  }
}

export default new EmailService();
