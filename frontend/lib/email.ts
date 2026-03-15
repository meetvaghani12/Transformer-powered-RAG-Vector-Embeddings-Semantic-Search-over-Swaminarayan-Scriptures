import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_FROM,
    pass: process.env.EMAIL_PASSWORD,
  },
})

export async function sendOTPEmail(email: string, otp: string, purpose: 'signup' | 'login') {
  const subject = purpose === 'signup'
    ? 'Verify your AksharAI account'
    : 'Your AksharAI login code'

  const action = purpose === 'signup' ? 'verify your email' : 'sign in'

  await transporter.sendMail({
    from: `"AksharAI ॐ" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#141414;border:1px solid #2a2a2a;border-radius:16px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding:40px 40px 24px;border-bottom:1px solid #1f1f1f;">
              <p style="margin:0;font-size:36px;letter-spacing:2px;">ॐ</p>
              <h1 style="margin:12px 0 0;font-size:22px;font-weight:600;color:#f0f0f0;letter-spacing:0.5px;">AksharAI</h1>
              <p style="margin:6px 0 0;font-size:12px;color:#555;letter-spacing:1px;text-transform:uppercase;">Swaminarayan Scripture Intelligence</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 32px;">
              <p style="margin:0 0 8px;font-size:15px;color:#999;">Use this code to ${action}:</p>
              <p style="margin:0 0 28px;font-size:13px;color:#555;">This code expires in <strong style="color:#aaa;">10 minutes</strong> and can only be used once.</p>

              <!-- OTP box -->
              <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0;font-size:42px;font-weight:700;letter-spacing:12px;color:#e8d5a0;font-family:'Courier New',monospace;">${otp}</p>
              </div>

              <p style="margin:0;font-size:13px;color:#444;line-height:1.6;">
                If you didn't request this code, you can safely ignore this email. Someone may have typed your email address by mistake.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1f1f1f;text-align:center;">
              <p style="margin:0;font-size:12px;color:#333;">AksharAI · Powered by Vachnamrut &amp; Swamini Vato</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  })
}
