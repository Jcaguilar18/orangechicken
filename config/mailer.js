const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendVerificationCode(toEmail, username, code) {
  await transporter.sendMail({
    from:    `"Jc's Space" <${process.env.GMAIL_USER}>`,
    to:      toEmail,
    subject: `${code} — Your Jc's Space verification code`,
    html: emailTemplate(`
      <h2 style="color:#fff;margin-bottom:.5rem">Welcome, ${username}!</h2>
      <p style="color:#94a3b8;line-height:1.6;margin-bottom:1.5rem">
        Thanks for joining Jc's Space. Enter the code below to verify your email and activate your account.
      </p>
      <div style="text-align:center;margin:2rem 0">
        <div style="display:inline-block;background:rgba(0,212,255,.08);border:2px solid rgba(0,212,255,.4);border-radius:12px;padding:1.25rem 2.5rem">
          <p style="font-size:2.5rem;font-family:monospace;font-weight:700;color:#00d4ff;letter-spacing:8px;margin:0">${code}</p>
        </div>
        <p style="color:#64748b;font-size:.8rem;margin-top:.75rem">This code expires in 15 minutes.</p>
      </div>
      <p style="color:#64748b;font-size:.8rem;text-align:center;margin-top:1rem">
        If you didn't create this account, you can safely ignore this email.
      </p>
    `),
  });
}

async function sendPasswordResetEmail(toEmail, username, token) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const link   = `${appUrl}/reset-password?token=${token}`;

  await transporter.sendMail({
    from:    `"Jc's Space" <${process.env.GMAIL_USER}>`,
    to:      toEmail,
    subject: "Reset your Jc's Space password",
    html: emailTemplate(`
      <h2 style="color:#fff;margin-bottom:.5rem">Password Reset</h2>
      <p style="color:#94a3b8;line-height:1.6;margin-bottom:1.5rem">
        Hey ${username}, we received a request to reset your password. Click below to choose a new one.
      </p>
      <div style="text-align:center;margin:2rem 0">
        <a href="${link}" style="${btnStyle}">Reset My Password →</a>
      </div>
      <p style="color:#64748b;font-size:.8rem;text-align:center;margin-top:2rem">
        If you didn't request this, you can safely ignore this email.<br/>This link expires in 1 hour.
      </p>
    `),
  });
}

// Shared email shell
const btnStyle = 'background:linear-gradient(135deg,#7c3aed,#00d4ff);color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:1rem;display:inline-block';

function emailTemplate(body) {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#050510;color:#e2e8f0;padding:2rem;border-radius:12px;border:1px solid rgba(0,212,255,0.2)">
      <div style="text-align:center;margin-bottom:2rem">
        <span style="font-size:2rem;color:#00d4ff">✦</span>
        <h1 style="font-family:monospace;color:#00d4ff;margin:.5rem 0;font-size:1.4rem;letter-spacing:2px">JC'S SPACE</h1>
      </div>
      ${body}
    </div>
  `;
}

module.exports = { transporter, sendVerificationCode, sendPasswordResetEmail };
