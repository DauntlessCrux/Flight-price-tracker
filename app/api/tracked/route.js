import { NextResponse } from 'next/server';
import { createClient, getAuthedUser } from '@/lib/supabase/server';

// GET /api/tracked
// Returns tracked flights for the CURRENTLY LOGGED-IN user only. The user
// id comes from the server-verified session, and Row Level Security (see
// supabase/schema.sql) enforces the same restriction at the database level
// even if this route's code ever had a bug.
export async function GET() {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('tracked_flights')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('GET /api/tracked error:', error);
    return NextResponse.json({ error: 'Failed to load tracked flights' }, { status: 500 });
  }

  return NextResponse.json({ tracked: data });
}

// POST /api/tracked
// Body: { origin, destination, departureDate, returnDate, targetPrice, currentPrice }
export async function POST(request) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();
  const { origin, destination, departureDate, returnDate, targetPrice, currentPrice } = body;

  if (!origin || !destination || !departureDate || !targetPrice || !currentPrice) {
    return NextResponse.json(
      { error: 'origin, destination, departureDate, targetPrice and currentPrice are required' },
      { status: 400 }
    );
  }

  const supabase = createClient();

  const { data: trackedFlight, error: insertError } = await supabase
    .from('tracked_flights')
    .insert({
      user_id: user.id,
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      departure_date: departureDate,
      return_date: returnDate || null,
      target_price: Number(targetPrice),
      current_price: Number(currentPrice),
      lowest_price: Number(currentPrice),
    })
    .select()
    .single();

  if (insertError) {
    console.error('POST /api/tracked error:', insertError);
    return NextResponse.json({ error: 'Failed to save tracked flight' }, { status: 500 });
  }

  const { error: historyError } = await supabase
    .from('price_history')
    .insert({ tracked_flight_id: trackedFlight.id, price: Number(currentPrice) });

  if (historyError) {
    console.error('POST /api/tracked price_history error:', historyError);
    // The tracked flight itself was saved fine; the first history point
    // just didn't record. Not fatal — later checks will still add rows.
  }

  return NextResponse.json({ trackedFlight }, { status: 201 });
}
