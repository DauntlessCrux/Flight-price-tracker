// lib/rapidapi-flights.js
//
// Wrapper around the "Flights Sky" API on RapidAPI (host:
// flights-sky.p.rapidapi.com), a Skyscanner-backed flight search API.
//
// CONFIRMED against a real response (Aug 2026): the endpoint is
// GET /flights/search-roundtrip with query params fromEntityId,
// toEntityId, departDate, and OPTIONAL returnDate (per the API's own docs:
// "Default: anytime") — so this same endpoint handles one-way searches
// too, just by omitting returnDate. There's no need for a separate
// one-way path.
//
// IMPORTANT: this endpoint can return `context.status: "incomplete"`
// while Skyscanner's backend is still assembling more results — but a
// real response we captured with that status still contained 10 valid,
// fully-priced itineraries. Earlier code discarded the whole response
// whenever status wasn't "complete", which threw away perfectly good real
// flight data. Fixed here: we use whatever itineraries are present,
// regardless of status. (A future enhancement could call the documented
// /flights/search-incomplete endpoint with the response's sessionId/token
// to fetch the remaining results, but showing the itineraries you already
// have is strictly better than showing nothing.)

const HOST = process.env.RAPIDAPI_HOST || 'flights-sky.p.rapidapi.com';
const BASE_URL = `https://${HOST}`;

function usingMock() {
  return process.env.USE_MOCK_FLIGHTS === 'true' || !process.env.RAPIDAPI_KEY;
}

function headers() {
  return {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': HOST,
  };
}

// ─── Mock data (USE_MOCK_FLIGHTS=true, or no RAPIDAPI_KEY set) ─────────

function seededPrice(seed, base, spread) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return base + (hash % spread);
}

const MOCK_AIRLINES = [
  { code: '6E', name: 'IndiGo' },
  { code: 'AI', name: 'Air India' },
  { code: 'UK', name: 'Vistara' },
  { code: 'SG', name: 'SpiceJet' },
];

function buildMockOffers({ origin, destination, departureDate }) {
  return MOCK_AIRLINES.map((airline, i) => {
    const seed = `${origin}${destination}${departureDate}${airline.code}`;
    const price = seededPrice(seed, 3500, 4500);
    const depHour = 6 + i * 4;
    const durationMinutes = 120 + seededPrice(seed + 'dur', 0, 90);
    const arrHour = (depHour + Math.floor(durationMinutes / 60)) % 24;
    const arrMin = durationMinutes % 60;

    return {
      id: `${airline.code}-${i}-${departureDate}`,
      airline: airline.name,
      flightNumber: `${airline.code}${100 + (price % 900)}`,
      origin,
      destination,
      departureDate,
      departureTime: `${String(depHour).padStart(2, '0')}:00`,
      arrivalTime: `${String(arrHour).padStart(2, '0')}:${String(arrMin).padStart(2, '0')}`,
      durationMinutes,
      stops: i % 3 === 0 ? 0 : 1,
      price,
      currency: 'INR',
    };
  }).sort((a, b) => a.price - b.price);
}

// ─── Real API ────────────────────────────────────────────────────────

function mapItinerary(raw, i, { origin, destination, departureDate }) {
  const outboundLeg = raw?.legs?.[0] || {};
  const carrier = outboundLeg?.carriers?.marketing?.[0] || {};
  const segment = outboundLeg?.segments?.[0] || {};
  const priceRaw = raw?.price?.raw;

  return {
    id: raw?.id || `${origin}-${destination}-${i}`,
    airline: carrier?.name || carrier?.alternateId || 'Unknown airline',
    flightNumber: segment?.flightNumber
      ? `${carrier?.alternateId || ''}${segment.flightNumber}`
      : null,
    origin: outboundLeg?.origin?.id || origin,
    destination: outboundLeg?.destination?.id || destination,
    departureDate: outboundLeg?.departure ? outboundLeg.departure.slice(0, 10) : departureDate,
    departureTime: outboundLeg?.departure ? outboundLeg.departure.slice(11, 16) : null,
    arrivalTime: outboundLeg?.arrival ? outboundLeg.arrival.slice(11, 16) : null,
    durationMinutes: typeof outboundLeg?.durationInMinutes === 'number'
      ? outboundLeg.durationInMinutes
      : null,
    stops: typeof outboundLeg?.stopCount === 'number' ? outboundLeg.stopCount : null,
    price: typeof priceRaw === 'number' ? Math.round(priceRaw) : null,
    currency: 'INR',
  };
}

/**
 * Search flights for a route/date. Returns a normalized, price-sorted array.
 */
export async function searchFlights({ origin, destination, departureDate, returnDate }) {
  if (usingMock()) {
    return buildMockOffers({ origin, destination, departureDate });
  }

  const params = new URLSearchParams({
    fromEntityId: origin.toUpperCase(),
    toEntityId: destination.toUpperCase(),
    departDate: departureDate,
    market: 'IN',
    locale: 'en-US',
    currency: 'INR',
    adults: '1',
    cabinClass: 'economy',
  });
  if (returnDate) params.set('returnDate', returnDate);

  const res = await fetch(`${BASE_URL}/flights/search-roundtrip?${params.toString()}`, {
    headers: headers(),
    // This is live-scraped data, not something to cache across requests.
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`RapidAPI request failed: ${res.status} ${body}`.trim());
  }

  const json = await res.json();
  const rawItineraries = json?.data?.itineraries || [];

  const offers = rawItineraries
    .map((r, i) => mapItinerary(r, i, { origin, destination, departureDate }))
    .filter((o) => o.price != null);

  return offers.sort((a, b) => a.price - b.price);
}

/**
 * Cheapest current price for a route — used by "Check Price Now" and the
 * scheduled/cron price checks.
 */
export async function getLatestPrice({ origin, destination, departureDate, returnDate }) {
  const offers = await searchFlights({ origin, destination, departureDate, returnDate });
  if (!offers.length) return null;
  return Math.min(...offers.map((o) => o.price));
}
