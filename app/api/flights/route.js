import { NextResponse } from 'next/server';
import { searchFlights } from '@/lib/rapidapi-flights';

// GET /api/flights?origin=GAU&destination=DEL&departureDate=2026-09-20&returnDate=2026-09-27
export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const origin = searchParams.get('origin');
  const destination = searchParams.get('destination');
  const departureDate = searchParams.get('departureDate');
  const returnDate = searchParams.get('returnDate') || undefined;

  if (!origin || !destination || !departureDate) {
    return NextResponse.json(
      { error: 'origin, destination and departureDate are required' },
      { status: 400 }
    );
  }

  try {
    const flights = await searchFlights({
      origin: origin.toUpperCase(),
      destination: destination.toUpperCase(),
      departureDate,
      returnDate,
    });

    return NextResponse.json({ flights });
  } catch (err) {
    console.error('GET /api/flights error:', err);
    return NextResponse.json({ error: 'Failed to search flights' }, { status: 500 });
  }
}
