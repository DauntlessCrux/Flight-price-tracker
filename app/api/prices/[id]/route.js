import { NextResponse } from 'next/server';
import { createClient, getAuthedUser } from '@/lib/supabase/server';
import { getLatestPrice } from '@/lib/rapidapi-flights';
import { sendPriceDropEmail } from '@/lib/email';

// POST /api/prices/:id — "Check Price Now" button. Only works on a flight
// owned by the logged-in user (checked here AND by RLS).
export async function POST(_request, { params }) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const id = Number(params.id);
  const supabase = createClient();

  const { data: trackedFlight, error: fetchError } = await supabase
    .from('tracked_flights')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !trackedFlight) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let newPrice;
  try {
    newPrice = await getLatestPrice({
      origin: trackedFlight.origin,
      destination: trackedFlight.destination,
      departureDate: trackedFlight.departure_date,
      returnDate: trackedFlight.return_date || undefined,
    });
  } catch (err) {
    console.error('Flight price check failed:', err.message);
    return NextResponse.json(
      { error: 'Could not fetch a live price right now. Please try again shortly.' },
      { status: 502 }
    );
  }

  if (newPrice == null) {
    return NextResponse.json({ error: 'No cached price found for this route yet' }, { status: 502 });
  }

  const previousPrice = trackedFlight.current_price;
  const lowestPrice = Math.min(trackedFlight.lowest_price, newPrice);
  const priceDropped = newPrice < trackedFlight.target_price;

  const { data: updated, error: updateError } = await supabase
    .from('tracked_flights')
    .update({ current_price: newPrice, lowest_price: lowestPrice })
    .eq('id', id)
    .select('*, price_history(*)')
    .single();

  if (updateError) {
    console.error('POST /api/prices/[id] update error:', updateError);
    return NextResponse.json({ error: 'Failed to update price' }, { status: 500 });
  }

  await supabase.from('price_history').insert({ tracked_flight_id: id, price: newPrice });

  let emailResult = null;
  if (priceDropped) {
    emailResult = await sendPriceDropEmail({
      to: user.email,
      origin: trackedFlight.origin,
      destination: trackedFlight.destination,
      previousPrice,
      currentPrice: newPrice,
      targetPrice: trackedFlight.target_price,
    });
  }

  return NextResponse.json({
    trackedFlight: updated,
    priceDropped,
    previousPrice,
    newPrice,
    emailSent: !!emailResult,
  });
}
