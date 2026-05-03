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

async function sendNewSubscriptionRequestEmail(adminEmails, username, method, ref) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  await transporter.sendMail({
    from:    `"Orange Chicken" <${process.env.GMAIL_USER}>`,
    to:      adminEmails.join(', '),
    subject: `New subscription request from ${username}`,
    html: emailTemplate(`
      <h2 style="color:#fff;margin-bottom:.5rem">New Subscription Request</h2>
      <p style="color:#c4a882;line-height:1.6;margin-bottom:1.5rem">
        <strong style="color:#fff">${username}</strong> has submitted a subscription request and is waiting for approval.
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem">
        <tr><td style="padding:8px 0;color:#8a6a48;font-size:.85rem;width:40%">Username</td><td style="color:#fff;font-size:.85rem">${username}</td></tr>
        <tr><td style="padding:8px 0;color:#8a6a48;font-size:.85rem">Payment method</td><td style="color:#fff;font-size:.85rem;text-transform:uppercase">${method}</td></tr>
        <tr><td style="padding:8px 0;color:#8a6a48;font-size:.85rem">Reference</td><td style="color:#F5A623;font-family:monospace;font-size:.9rem">${ref}</td></tr>
      </table>
      <div style="text-align:center;margin:1.5rem 0">
        <a href="${appUrl}/admin/subscriptions" style="${btnStyle}">Review in Admin →</a>
      </div>
    `),
  });
}

async function sendProApprovedEmail(toEmail, username, endDate) {
  const formattedEnd = new Date(endDate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  await transporter.sendMail({
    from:    `"Orange Chicken" <${process.env.GMAIL_USER}>`,
    to:      toEmail,
    subject: 'You\'ve been granted Pro access on Orange Chicken!',
    html: emailTemplate(`
      <h2 style="color:#fff;margin-bottom:.5rem">Pro Access Granted! 🍗</h2>
      <p style="color:#c4a882;line-height:1.6;margin-bottom:1.5rem">
        Congratulations, <strong style="color:#fff">${username}</strong>! Your Pro access has been approved.
        You now have unlimited tool usage and no daily cap.
      </p>
      <div style="text-align:center;background:rgba(200,110,20,.1);border:1px solid rgba(200,110,20,.4);border-radius:10px;padding:1.25rem;margin-bottom:1.5rem">
        <p style="color:#8a6a48;font-size:.8rem;margin:0 0 .25rem">Active until</p>
        <p style="color:#F5A623;font-size:1.2rem;font-weight:700;margin:0">${formattedEnd}</p>
      </div>
      <p style="color:#8a6a48;font-size:.8rem;text-align:center">
        Enjoy your stay in the Coop!
      </p>
    `),
  });
}

// Shared email shell
const btnStyle = 'background:linear-gradient(135deg,#C8600A,#F5A623);color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:1rem;display:inline-block';

function emailTemplate(body) {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  return `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#1a0e00;color:#e2d5c3;padding:2rem;border-radius:12px;border:1px solid rgba(200,110,20,0.35)">
      <div style="text-align:center;margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:1px solid rgba(200,110,20,0.2)">
        <img src="${appUrl}/img/orangechick_logo.png" alt="Orange Chicken" width="90" style="display:inline-block;margin-bottom:.5rem" />
        <h1 style="font-family:Georgia,serif;color:#F5A623;margin:.25rem 0;font-size:1.3rem;letter-spacing:3px;text-transform:uppercase">Orange Chicken</h1>
      </div>
      ${body}
      <div style="text-align:center;margin-top:2rem;padding-top:1.5rem;border-top:1px solid rgba(200,110,20,0.2)">
        <p style="color:#8a6a48;font-size:.75rem;margin:0">© Orange Chicken — The Coop</p>
      </div>
    </div>
  `;
}

module.exports = { transporter, sendVerificationCode, sendPasswordResetEmail, sendNewSubscriptionRequestEmail, sendProApprovedEmail };
