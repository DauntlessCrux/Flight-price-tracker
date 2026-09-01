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

function buildMockOffers({ origin, destination, departureDate, returnDate }) {
  return MOCK_AIRLINES.map((airline, i) => {
    const seed = `${origin}${destination}${departureDate}${airline.code}`;
    const outboundPrice = seededPrice(seed, 3500, 4500);
    const depHour = 6 + i * 4;
    const durationMinutes = 120 + seededPrice(seed + 'dur', 0, 90);
    const arrHour = (depHour + Math.floor(durationMinutes / 60)) % 24;
    const arrMin = durationMinutes % 60;

    const offer = {
      id: `${airline.code}-${i}-${departureDate}`,
      isRoundTrip: !!returnDate,
      airline: airline.name,
      flightNumber: `${airline.code}${100 + (outboundPrice % 900)}`,
      origin,
      destination,
      departureDate,
      departureTime: `${String(depHour).padStart(2, '0')}:00`,
      arrivalTime: `${String(arrHour).padStart(2, '0')}:${String(arrMin).padStart(2, '0')}`,
      durationMinutes,
      stops: i % 3 === 0 ? 0 : 1,
      currency: 'INR',
    };

    if (!returnDate) {
      offer.price = outboundPrice;
      return offer;
    }

    // Round trip — generate a return leg too, and price the pair together
    // (matching the real API, which prices round trips as one combined
    // total rather than two separate fares).
    const returnSeed = `${destination}${origin}${returnDate}${airline.code}`;
    const returnPrice = seededPrice(returnSeed, 3500, 4500);
    const returnDepHour = 8 + i * 4;
    const returnDurationMinutes = 120 + seededPrice(returnSeed + 'dur', 0, 90);
    const returnArrHour = (returnDepHour + Math.floor(returnDurationMinutes / 60)) % 24;
    const returnArrMin = returnDurationMinutes % 60;

    offer.price = outboundPrice + returnPrice;
    offer.returnDate = returnDate;
    offer.returnDepartureTime = `${String(returnDepHour).padStart(2, '0')}:00`;
    offer.returnArrivalTime = `${String(returnArrHour).padStart(2, '0')}:${String(returnArrMin).padStart(2, '0')}`;
    offer.returnDurationMinutes = returnDurationMinutes;
    offer.returnStops = (i + 1) % 3 === 0 ? 0 : 1;

    return offer;
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
      cache: 'no-store',
    });
    return res;
  }

  if (returnDate) {
    const res = await callEndpoint('/flights/search-roundtrip', { returnDate });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`RapidAPI request failed: ${res.status} ${body}`.trim());
    }
    return res.json();
  }

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
    return buildMockOffers({ origin, destination, departureDate, returnDate });
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
