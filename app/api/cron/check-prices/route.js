import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getLatestPrice } from '@/lib/rapidapi-flights';
import { sendPriceDropEmail } from '@/lib/email';

// This route is what actually automates price checking in production —
// scripts/checkPrices.js --watch only works on a machine that stays on,
// which a deployed app can't rely on. Vercel's built-in Cron (configured
// in vercel.json) sends a GET request here on a schedule.
//
// SECURITY: Vercel signs its own cron requests with an Authorization:
// Bearer <CRON_SECRET> header, using whatever value you set for the
// CRON_SECRET environment variable in your Vercel project. We check that
// header below — without it, anyone who found this URL could trigger
// price checks (and API usage / emails) on demand.

export const dynamic = 'force-dynamic';
// Hobby plan functions are capped at 10s regardless of this setting; Pro
// allows up to 300s. We set a generous value and also self-limit with a
// time budget in the loop below, so on Hobby we simply check as many
// flights as fit in ~9s and let tomorrow's run pick up the rest.
export const maxDuration = 60;

const TIME_BUDGET_MS = 9000;

function isAuthorized(request) {
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request) {
  if (!process.env.CRON_SECRET || !isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const supabase = createAdminClient();

  const { data: flights, error } = await supabase.from('tracked_flights').select('*');
  if (error) {
    console.error('[cron] Failed to load tracked flights:', error.message);
    return NextResponse.json({ error: 'Failed to load tracked flights' }, { status: 500 });
  }

  const summary = { total: flights.length, checked: 0, priceDrops: 0, errors: 0, skipped: 0 };

  for (const flight of flights) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      summary.skipped = flights.length - summary.checked;
      break;
    }

    try {
      const newPrice = await getLatestPrice({
        origin: flight.origin,
        destination: flight.destination,
        departureDate: flight.departure_date,
        returnDate: flight.return_date || undefined,
      });

      if (newPrice == null) {
        summary.checked += 1;
        continue;
      }

      const lowestPrice = Math.min(flight.lowest_price, newPrice);
      const priceDropped = newPrice < flight.target_price;

      await supabase
        .from('tracked_flights')
        .update({ current_price: newPrice, lowest_price: lowestPrice })
        .eq('id', flight.id);

      await supabase.from('price_history').insert({ tracked_flight_id: flight.id, price: newPrice });

      summary.checked += 1;

      if (priceDropped) {
        const { data: userData, error: userError } = await supabase.auth.admin.getUserById(
          flight.user_id
        );
        if (!userError && userData.user?.email) {
          await sendPriceDropEmail({
            to: userData.user.email,
            origin: flight.origin,
            destination: flight.destination,
            previousPrice: flight.current_price,
            currentPrice: newPrice,
            targetPrice: flight.target_price,
          });
          summary.priceDrops += 1;
        }
      }
    } catch (err) {
      console.error(`[cron] Failed for flight #${flight.id}:`, err.message);
      summary.errors += 1;
    }
  }

  console.log('[cron] check-prices summary:', summary);
  return NextResponse.json({ ok: true, ...summary });
}
