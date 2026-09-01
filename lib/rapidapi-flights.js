// lib/rapidapi-flights.js
//
// Wrapper around the "Flights Sky" API on RapidAPI (host:
// flights-sky.p.rapidapi.com), a Skyscanner-backed flight search API.
//
// CONFIRMED against a real response (Aug 2026): GET /flights/search-roundtrip
// with fromEntityId, toEntityId, departDate, returnDate, market=IN,
// locale=en-GB, currency=INR returns real, correctly priced round-trip
// itineraries. That call is used as-is whenever a returnDate is given.
//
// For one-way (no returnDate), we try /flights/search-one-way first — a
// dedicated endpoint is more likely correct than assuming an endpoint
// literally named "search-roundtrip" also handles one-way silently. If
// that 404s or errors, we fall back to search-roundtrip without a
// returnDate, which is at least known not to error even though its true
// one-way behavior isn't independently confirmed.
//
// IMPORTANT: this endpoint can return `context.status: "incomplete"`
// while Skyscanner's backend is still assembling more results — but a
// real response we captured with that status still contained 10 valid,
// fully-priced itineraries. We use whatever itineraries are present,
// regardless of status, rather than discarding a real partial result.

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

function mapLeg(leg) {
  if (!leg) return null;
  const carrier = leg?.carriers?.marketing?.[0] || {};
  const segment = leg?.segments?.[0] || {};

  return {
    airline: carrier?.name || carrier?.alternateId || 'Unknown airline',
    flightNumber: segment?.flightNumber
      ? `${carrier?.alternateId || ''}${segment.flightNumber}`
      : null,
    date: leg?.departure ? leg.departure.slice(0, 10) : null,
    departureTime: leg?.departure ? leg.departure.slice(11, 16) : null,
    arrivalTime: leg?.arrival ? leg.arrival.slice(11, 16) : null,
    durationMinutes: typeof leg?.durationInMinutes === 'number' ? leg.durationInMinutes : null,
    stops: typeof leg?.stopCount === 'number' ? leg.stopCount : null,
  };
}

function mapItinerary(raw, i, { origin, destination, departureDate }) {
  const outbound = mapLeg(raw?.legs?.[0]);
  // legs[1], when present, is the return flight — a round-trip search
  // prices both legs together as ONE total, so we surface both legs'
  // details rather than showing only the outbound flight next to a price
  // that actually includes the return flight too.
  const inbound = mapLeg(raw?.legs?.[1]);
  const priceRaw = raw?.price?.raw;

  return {
    id: raw?.id || `${origin}-${destination}-${i}`,
    isRoundTrip: !!inbound,
    airline: outbound?.airline || 'Unknown airline',
    flightNumber: outbound?.flightNumber || null,
    origin: raw?.legs?.[0]?.origin?.id || origin,
    destination: raw?.legs?.[0]?.destination?.id || destination,
    departureDate: outbound?.date || departureDate,
    departureTime: outbound?.departureTime || null,
    arrivalTime: outbound?.arrivalTime || null,
    durationMinutes: outbound?.durationMinutes ?? null,
    stops: outbound?.stops ?? null,
    // Present only for round-trip results — the return flight's own details.
    returnDate: inbound?.date || null,
    returnDepartureTime: inbound?.departureTime || null,
    returnArrivalTime: inbound?.arrivalTime || null,
    returnDurationMinutes: inbound?.durationMinutes ?? null,
    returnStops: inbound?.stops ?? null,
    price: typeof priceRaw === 'number' ? Math.round(priceRaw) : null,
    currency: 'INR',
  };
}

async function fetchItineraries({ origin, destination, departureDate, returnDate }) {
  const baseParams = {
    fromEntityId: origin.toUpperCase(),
    toEntityId: destination.toUpperCase(),
    departDate: departureDate,
    // These three values must be a real, matching combination — confirmed
    // via GET /flights/get-config, whose India row is exactly
    // { market: "IN", locale: "en-GB", currency: "INR" }. Using en-US here
    // (a mismatched combo) was the likely cause of prices silently coming
    // back in USD despite currency=INR.
    market: 'IN',
    locale: 'en-GB',
    currency: 'INR',
    adults: '1',
    cabinClass: 'economy',
  };

  async function callEndpoint(path, extraParams = {}) {
    const params = new URLSearchParams({ ...baseParams, ...extraParams });
    const res = await fetch(`${BASE_URL}${path}?${params.toString()}`, {
      headers: headers(),
      cache: 'no-store', // live-scraped data, never cache
    });
    return res;
  }

  if (returnDate) {
    // Round-trip — this exact call is CONFIRMED working against real data.
    const res = await callEndpoint('/flights/search-roundtrip', { returnDate });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`RapidAPI request failed: ${res.status} ${body}`.trim());
    }
    return res.json();
  }

  // One-way: the endpoint we use for round-trip is literally named
  // "search-roundtrip", so a dedicated one-way endpoint (a very common
  // naming pattern on APIs like this — e.g. "search-one-way") is more
  // likely correct than assuming search-roundtrip silently handles it too.
  // Try that first; if it doesn't exist (404) or errors, fall back to the
  // proven search-roundtrip call without a returnDate rather than failing
  // outright — that combination is at least known not to error, even if
  // its one-way behavior is unconfirmed.
  const oneWayRes = await callEndpoint('/flights/search-one-way');
  if (oneWayRes.ok) {
    return oneWayRes.json();
  }

  const fallbackRes = await callEndpoint('/flights/search-roundtrip');
  if (!fallbackRes.ok) {
    const body = await fallbackRes.text().catch(() => '');
    throw new Error(`RapidAPI request failed: ${fallbackRes.status} ${body}`.trim());
  }
  return fallbackRes.json();
}

/**
 * Search flights for a route/date. Returns a normalized, price-sorted array.
 */
export async function searchFlights({ origin, destination, departureDate, returnDate }) {
  if (usingMock()) {
    return buildMockOffers({ origin, destination, departureDate });
  }

  const json = await fetchItineraries({ origin, destination, departureDate, returnDate });
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
