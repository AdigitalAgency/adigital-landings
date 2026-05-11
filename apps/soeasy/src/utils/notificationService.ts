import { supabase } from './supabaseClient';

export interface NotificationPayload {
  to: string;
  subject?: string;
  message: string;
  type: 'email' | 'sms';
}

export const notificationService = {
  async sendEmail(tenantId: string, to: string, subject: string, html: string) {
    const { data: settings } = await supabase
      .from('booking_settings')
      .select('sendgrid_api_key, sendgrid_from_email, sendgrid_from_name, notify_email_on_booking')
      .eq('tenant_id', tenantId)
      .single();

    if (!settings?.notify_email_on_booking || !settings?.sendgrid_api_key) return;

    try {
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.sendgrid_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: settings.sendgrid_from_email, name: settings.sendgrid_from_name },
          subject: subject,
          content: [{ type: 'text/html', value: html }]
        })
      });
    } catch (err) {
      console.error('SendGrid error:', err);
    }
  },

  async sendSMS(tenantId: string, to: string, message: string) {
    const { data: settings } = await supabase
      .from('booking_settings')
      .select('twilio_account_sid, twilio_auth_token, twilio_from_number, notify_sms_on_booking')
      .eq('tenant_id', tenantId)
      .single();

    if (!settings?.notify_sms_on_booking || !settings?.twilio_account_sid) return;

    try {
      const auth = btoa(`${settings.twilio_account_sid}:${settings.twilio_auth_token}`);
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${settings.twilio_account_sid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          From: settings.twilio_from_number,
          Body: message
        })
      });
    } catch (err) {
      console.error('Twilio error:', err);
    }
  }
};
