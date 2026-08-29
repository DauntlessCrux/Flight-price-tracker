// scripts/checkPrices.js
//
//   npm run check:prices            # run once
//   npm run check:prices -- --watch # run once, then every 6 hours
//
// Uses the Supabase SERVICE ROLE key (bypasses RLS on purpose — needs to
// see every user's rows) and the same RapidAPI Flights Sky logic as
// lib/rapidapi-flights.js (duplicated here in CommonJS since this script
// runs standalone via `node`, outside the Next.js ESM build).

require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const HOST = process.env.RAPIDAPI_HOST || 'flights-sky.p.rapidapi.com';

function usingMock() {
  return process.env.USE_MOCK_FLIGHTS === 'true' || !process.env.RAPIDAPI_KEY;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getLatestPrice({ origin, destination, departureDate, returnDate }) {
  if (usingMock()) {
    let hash = 0;
    const seed = `${origin}${destination}${departureDate}`;
    for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    const wobble = Math.floor(Math.random() * 400) - 200;
    return Math.max(2500, 3500 + (hash % 4500) + wobble);
  }

  const params = new URLSearchParams({
    fromEntityId: origin.toUpperCase(),
    toEntityId: destination.toUpperCase(),
    departDate: departureDate,
    market: 'IN',
    locale: 'en-US',
    currency: 'INR',
    adults: '1',
    cabinClass: 'ECONOMY',
  });
  if (returnDate) params.set('returnDate', returnDate);

  const path = returnDate ? '/web/flights/search-roundtrip' : '/web/flights/search-one-way';
  const url = `https://${HOST}${path}?${params.toString()}`;
  const headers = { 'X-RapidAPI-Key': process.env.RAPIDAPI_KEY, 'X-RapidAPI-Host': HOST };

  let json = null;
  for (let attempt = 0; attempt <= 3; attempt++) {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`RapidAPI request failed: ${res.status}`);
    json = await res.json();
    const status = json?.data?.context?.status || json?.context?.status;
    if (status !== 'incomplete') break;
    await sleep(1500);
  }

  const results =
    json?.data?.itineraries?.results ||
    json?.data?.itineraries ||
    json?.itineraries?.results ||
    json?.itineraries ||
    [];

  const prices = results.map((r) => r?.price?.raw ?? r?.price).filter((p) => typeof p === 'number');
  return prices.length ? Math.round(Math.min(...prices)) : null;
}

async function getUserEmail(userId) {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    console.error(`[checkPrices] Could not resolve email for user ${userId}:`, error.message);
    return null;
  }
  return data.user?.email || null;
}

async function sendPriceDropEmail(details) {
  if (!process.env.EMAIL_API_KEY) {
    console.log('[email:mock]', details);
    return;
  }
  const { Resend } = require('resend');
  const resend = new Resend(process.env.EMAIL_API_KEY);
  await resend.emails.send({
    from: process.env.EMAIL_FROM || 'FlightTracker <alerts@flighttracker.dev>',
    to: details.to,
    subject: '✈ Flight Price Dropped!',
    html: `<p>${details.origin} → ${details.destination}: was ₹${details.previousPrice}, now ₹${details.currentPrice} (target ₹${details.targetPrice}).</p>`,
  });
}

async function checkAllTrackedFlights() {
  const { data: flights, error } = await supabase.from('tracked_flights').select('*');
  if (error) {
    console.error('[checkPrices] Failed to load tracked flights:', error.message);
    return;
  }

  console.log(`[checkPrices] Checking ${flights.length} tracked flight(s)...`);

  for (const flight of flights) {
    try {
      const newPrice = await getLatestPrice({
        origin: flight.origin,
        destination: flight.destination,
        departureDate: flight.departure_date,
        returnDate: flight.return_date,
      });
      if (newPrice == null) continue;

      const lowestPrice = Math.min(flight.lowest_price, newPrice);
      const priceDropped = newPrice < flight.target_price;

      await supabase
        .from('tracked_flights')
        .update({ current_price: newPrice, lowest_price: lowestPrice })
        .eq('id', flight.id);

      await supabase.from('price_history').insert({ tracked_flight_id: flight.id, price: newPrice });

      console.log(
        `[checkPrices] #${flight.id} ${flight.origin}->${flight.destination}: ₹${flight.current_price} -> ₹${newPrice}`
      );

      if (priceDropped) {
        const email = await getUserEmail(flight.user_id);
        if (email) {
          await sendPriceDropEmail({
            to: email,
            origin: flight.origin,
            destination: flight.destination,
            previousPrice: flight.current_price,
            currentPrice: newPrice,
            targetPrice: flight.target_price,
          });
        }
      }
    } catch (err) {
      console.error(`[checkPrices] Failed for flight #${flight.id}:`, err.message);
    }
  }
}

async function main() {
  if (process.argv.includes('--watch')) {
    console.log('[checkPrices] Scheduling job to run every 6 hours...');
    cron.schedule('0 */6 * * *', () => {
      checkAllTrackedFlights().catch(console.error);
    });
    await checkAllTrackedFlights();
  } else {
    await checkAllTrackedFlights();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
