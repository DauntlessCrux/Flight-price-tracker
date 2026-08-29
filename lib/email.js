// lib/email.js
//
// Sends "price dropped" alert emails via Resend. Falls back to logging to
// the console when EMAIL_API_KEY isn't set, so the app still runs in demo
// mode without a real email provider.

import { Resend } from 'resend';

function buildEmailHtml({ origin, destination, previousPrice, currentPrice, targetPrice }) {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>✈ Flight Price Dropped!</h2>
      <p>Your tracked flight from <b>${origin}</b> to <b>${destination}</b> has dropped in price.</p>
      <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding:8px 0; color:#666;">Previous price</td>
          <td style="padding:8px 0; text-align:right;">₹${previousPrice.toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#666;">Current price</td>
          <td style="padding:8px 0; text-align:right; color:#16a34a; font-weight:bold;">₹${currentPrice.toLocaleString('en-IN')}</td>
        </tr>
        <tr>
          <td style="padding:8px 0; color:#666;">Target price</td>
          <td style="padding:8px 0; text-align:right;">₹${targetPrice.toLocaleString('en-IN')}</td>
        </tr>
      </table>
      <p>You may want to book now!</p>
    </div>
  `;
}

export async function sendPriceDropEmail({ to, origin, destination, previousPrice, currentPrice, targetPrice }) {
  const subject = '✈ Flight Price Dropped!';
  const html = buildEmailHtml({ origin, destination, previousPrice, currentPrice, targetPrice });

  if (!process.env.EMAIL_API_KEY) {
    console.log('[email:mock] Would send email to', to);
    console.log(`[email:mock] ${origin} -> ${destination}: ₹${previousPrice} -> ₹${currentPrice} (target ₹${targetPrice})`);
    return { mocked: true };
  }

  const resend = new Resend(process.env.EMAIL_API_KEY);
  const result = await resend.emails.send({
    from: process.env.EMAIL_FROM || 'FlightTracker <alerts@flighttracker.dev>',
    to,
    subject,
    html,
  });

  return result;
}
