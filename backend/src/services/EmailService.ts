import nodemailer from 'nodemailer';

/**
 * Lightweight email service. If SMTP env vars are missing, falls back to console logging.
 */
export class EmailService {
  private static transporter = process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: false,
        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            }
          : undefined,
      })
    : null;

  static async sendMail(to: string, subject: string, html: string) {
    if (this.transporter) {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@menumaker.app',
        to,
        subject,
        html,
      });
    } else {
      console.log(`[EmailService] (dev log only) To: ${to} | Subject: ${subject}\n${html}`);
    }
  }

  static async sendPayoutNotice(to: string, amount: number, currency = 'INR') {
    const formatted = (amount / 100).toFixed(2);
    await this.sendMail(
      to,
      'Payout Scheduled',
      `<p>Your payout of ${currency} ${formatted} has been scheduled.</p>`
    );
  }

  static async sendSupportNotification(to: string, subject: string, body: string) {
    await this.sendMail(to, subject, `<p>${body}</p>`);
  }

  static async sendAdminNotification(to: string, subject: string, body: string) {
    await this.sendMail(to, subject, `<p>${body}</p>`);
  }
}
