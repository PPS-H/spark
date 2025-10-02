import nodemailer from "nodemailer";
// Create a transporter object
const transport = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD,
  },
});

const emailTemplates = {
  registerOtpSendEmail: {
    subject: "Verify OTP for Registration",
    text: "Please find your OTP below.",
    body: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #4CAF50;">Welcome to Our Service!</h2>
                <p>Thank you for registering. Use the OTP below to complete your registration.</p>
                <h3 style="color: #4CAF50; font-size: 24px;">{{OTP}}</h3>
                <p>If you didn’t request this, please ignore this email.</p>
            </div>
        `,
  },
  updateEmailOtpSendEmail: {
    subject: "Verify OTP for Change email",
    text: "Please find your OTP below.",
    body: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #4CAF50;">Welcome to Our Service!</h2>
                <p>Thank you for using Headwater-sage. Use the OTP below to change email.</p>
                <h3 style="color: #4CAF50; font-size: 24px;">{{OTP}}</h3>
                <p>If you didn’t request this, please ignore this email.</p>
            </div>
        `,
  },
  resendRegistrationOtp: {
    subject: "Resend OTP for Registration",
    text: "Please find your OTP below.",
    body: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #FFA500;">OTP Resend Request</h2>
                <p>We received a request to resend your OTP. Use the OTP below to complete your registration.</p>
                <h3 style="color: #FFA500; font-size: 24px;">{{OTP}}</h3>
                <p>If you didn’t request this, please ignore this email.</p>
            </div>
        `,
  },
  ForgetSendEmail: {
    subject: "Reset Password OTP",
    text: "Please use this OTP to reset your password.",
    body: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #E91E63;">Password Reset Request</h2>
                <p>Use the OTP below to reset your password.</p>
                <h3 style="color: #E91E63; font-size: 24px;">{{OTP}}</h3>
                <p>If you didn’t request this, please ignore this email.</p>
            </div>
        `,
  },
  forgotReSendEmail: {
    subject: "Resend Reset Password OTP",
    text: "Please use this OTP to reset your password.",
    body: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #FF5722;">Resend Password Reset OTP</h2>
                <p>We received a request to resend your password reset OTP. Use the OTP below.</p>
                <h3 style="color: #FF5722; font-size: 24px;">{{OTP}}</h3>
                <p>If you didn’t request this, please ignore this email.</p>
            </div>
        `,
  },
  changeEmail: {
    subject: "Change Email",
    text: "Please use this OTP to Change Email.",
    body: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #FF5722;">Change Email OTP</h2>
                <p>We received a request to Change Email reset OTP. Use the OTP below.</p>
                <h3 style="color: #FF5722; font-size: 24px;">{{OTP}}</h3>
                <p>If you didn't request this, please ignore this email.</p>
            </div>
        `,
  },
  emailVerificationOtp: {
    subject: "Verify Your Email - SPARK",
    text: "Please verify your email to complete login.",
    body: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #2196F3;">Email Verification Required</h2>
                <p>Your account is not verified yet. Please use the OTP below to verify your email and complete your login.</p>
                <h3 style="color: #2196F3; font-size: 24px;">{{OTP}}</h3>
                <p>This OTP will expire in 2 minutes. If you didn't request this, please ignore this email.</p>
            </div>
        `,
  },
  resendEmailVerificationOtp: {
    subject: "Resend Email Verification - SPARK",
    text: "Please verify your email to complete login.",
    body: `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #FF9800;">Email Verification Resent</h2>
                <p>We received a request to resend your email verification OTP. Please use the OTP below to verify your email and complete your login.</p>
                <h3 style="color: #FF9800; font-size: 24px;">{{OTP}}</h3>
                <p>This OTP will expire in 2 minutes. If you didn't request this, please ignore this email.</p>
            </div>
        `,
  },
};

// Generate email body based on type
function generateEmailBody(type: number, otp: string) {
  let template: any;
  switch (type) {
    case 1:
      template = emailTemplates.registerOtpSendEmail;
      break;
    case 2:
      template = emailTemplates.resendRegistrationOtp;
      break;
    case 3:
      template = emailTemplates.ForgetSendEmail;
      break;
    case 4:
      template = emailTemplates.forgotReSendEmail;
      break;
    case 5:
      template = emailTemplates.changeEmail;
      break;
    case 6:
      template = emailTemplates.updateEmailOtpSendEmail;
      break;
    case 7:
      template = emailTemplates.emailVerificationOtp;
      break;
    case 8:
      template = emailTemplates.resendEmailVerificationOtp;
      break;
    default:
      throw new Error("Invalid email type");
  }

  // Replace {{OTP}} placeholder with the actual OTP
  const bodyWithOtp = template.body.replace("{{OTP}}", otp);
  return { subject: template.subject, text: template.text, html: bodyWithOtp };
}

// Send an email
export async function sendEmail(to: string, type: number, otp: string) {
  try {
    const { subject, text, html } = generateEmailBody(type, otp);

    await transport.sendMail({
      from: process.env.SMTP_EMAIL,
      to,
      subject,
      text,
      html,
    });
    console.log("Email sent successfully");
  } catch (error) {
    console.log("Error sending email:", error);
  } finally {
    await transport.close();
  }
}
