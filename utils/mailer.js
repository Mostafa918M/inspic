const nodemailer = require("nodemailer");
const apiError = require("../utils/apiError");

function required(name) {
  if (!process.env[name]) throw new apiError(`Missing env: ${name}`);
  return process.env[name];
}
const transporter = nodemailer.createTransport({
  host: required("SMTP_HOST"),
  port: required("SMTP_PORT"),
  secure: false,
  auth: {
    user: required("SMTP_USER"),
    pass: required("SMTP_PASS"),
  },
  requireTLS: true,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

async function sendVerificationEmail(to, code) {
  const subject = "Your verification code";
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:16px;">
      <p>Use this code to verify your email:</p>
      <p style="font-size:24px;letter-spacing:4px;"><b>${code}</b></p>
      <p>This code expires in 15 minutes.</p>
      <p>If you didn’t request this, you can ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || '"No Reply" <no-reply@example.com>',
    to,
    subject,
    html,
  });
}

module.exports = { sendVerificationEmail };
