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
    from:    `"Orange Chicken" <${process.env.GMAIL_USER}>`,
    to:      toEmail,
    subject: `${code} — Your Orange Chicken verification code`,
    html: emailTemplate(`
      <h2 style="color:#fff;margin-bottom:.5rem">Welcome, ${username}!</h2>
      <p style="color:#c4a882;line-height:1.6;margin-bottom:1.5rem">
        Thanks for joining the Coop! Enter the code below to verify your email and activate your account.
      </p>
      <div style="text-align:center;margin:2rem 0">
        <div style="display:inline-block;background:rgba(200,110,20,.1);border:2px solid rgba(200,110,20,.5);border-radius:12px;padding:1.25rem 2.5rem">
          <p style="font-size:2.5rem;font-family:monospace;font-weight:700;color:#F5A623;letter-spacing:8px;margin:0">${code}</p>
        </div>
        <p style="color:#8a6a48;font-size:.8rem;margin-top:.75rem">This code expires in 15 minutes.</p>
      </div>
      <p style="color:#8a6a48;font-size:.8rem;text-align:center;margin-top:1rem">
        If you didn't create this account, you can safely ignore this email.
      </p>
    `),
  });
}

async function sendPasswordResetEmail(toEmail, username, token) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const link   = `${appUrl}/reset-password?token=${token}`;

  await transporter.sendMail({
    from:    `"Orange Chicken" <${process.env.GMAIL_USER}>`,
    to:      toEmail,
    subject: 'Reset your Orange Chicken password',
    html: emailTemplate(`
      <h2 style="color:#fff;margin-bottom:.5rem">Password Reset</h2>
      <p style="color:#c4a882;line-height:1.6;margin-bottom:1.5rem">
        Hey ${username}, we received a request to reset your password. Click below to choose a new one.
      </p>
      <div style="text-align:center;margin:2rem 0">
        <a href="${link}" style="${btnStyle}">Reset My Password →</a>
      </div>
      <p style="color:#8a6a48;font-size:.8rem;text-align:center;margin-top:2rem">
        If you didn't request this, you can safely ignore this email.<br/>This link expires in 1 hour.
      </p>
    `),
  });
}

// Shared email shell
const btnStyle = 'background:linear-gradient(135deg,#C8600A,#F5A623);color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:1rem;display:inline-block';

function emailTemplate(body) {
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#1a0e00;color:#e2d5c3;padding:2rem;border-radius:12px;border:1px solid rgba(200,110,20,0.35)">
      <div style="text-align:center;margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:1px solid rgba(200,110,20,0.2)">
        <div style="font-size:2.2rem;line-height:1;margin-bottom:.5rem">🍗</div>
        <h1 style="font-family:Georgia,serif;color:#F5A623;margin:.25rem 0;font-size:1.3rem;letter-spacing:3px;text-transform:uppercase">Orange Chicken</h1>
      </div>
      ${body}
      <div style="text-align:center;margin-top:2rem;padding-top:1.5rem;border-top:1px solid rgba(200,110,20,0.2)">
        <p style="color:#8a6a48;font-size:.75rem;margin:0">© Orange Chicken — The Coop</p>
      </div>
    </div>
  `;
}

module.exports = { transporter, sendVerificationCode, sendPasswordResetEmail };
