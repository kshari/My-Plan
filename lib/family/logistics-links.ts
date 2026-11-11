/**
 * Deep-link helpers for flights and lodging — no API, just prefilled URL builder.
 */

interface FlightLinkParams {
  origin: string          // city/airport code or name, e.g. "Austin, TX" or "AUS"
  destination: string     // e.g. "Denver, CO"
  departDate?: string     // YYYY-MM-DD
  returnDate?: string     // YYYY-MM-DD
  adults?: number
}

/** Google Flights prefilled URL */
export function googleFlightsUrl({ origin, destination, departDate, returnDate, adults = 1 }: FlightLinkParams): string {
  const base = "https://www.google.com/travel/flights"
  const params = new URLSearchParams()
  // Google Flights uses a query string format
  const q = `flights from ${origin} to ${destination}${departDate ? ` on ${departDate}` : ""}${returnDate ? ` returning ${returnDate}` : ""}`
  params.set("q", q)
  return `${base}?${params.toString()}`
}

/** Skyscanner prefilled URL */
export function skyscannerUrl({ origin, destination, departDate, returnDate, adults = 1 }: FlightLinkParams): string {
  // Skyscanner uses slug-based routes
  const originSlug = origin.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()
  const destSlug = destination.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()
  const dateStr = departDate ? departDate.replace(/-/g, "") : ""
  const retStr = returnDate ? returnDate.replace(/-/g, "") : ""
  const path = returnDate
    ? `/${originSlug}/${destSlug}/${dateStr}/${retStr}/${adults}adult`
    : `/${originSlug}/${destSlug}/${dateStr}/${adults}adult`
  return `https://www.skyscanner.com/transport/flights${path}/`
}

interface LodgingLinkParams {
  destination: string
  checkIn?: string   // YYYY-MM-DD
  checkOut?: string  // YYYY-MM-DD
  guests?: number
}

/** Google Hotels prefilled URL */
export function googleHotelsUrl({ destination, checkIn, checkOut, guests = 1 }: LodgingLinkParams): string {
  const params = new URLSearchParams()
  params.set("q", `hotels in ${destination}`)
  if (checkIn) params.set("checkin", checkIn)
  if (checkOut) params.set("checkout", checkOut)
  if (guests > 1) params.set("adults", String(guests))
  return `https://www.google.com/travel/hotels?${params.toString()}`
}

/** Airbnb prefilled URL */
export function airbnbUrl({ destination, checkIn, checkOut, guests = 1 }: LodgingLinkParams): string {
  const params = new URLSearchParams()
  params.set("query", destination)
  if (checkIn) params.set("checkin", checkIn)
  if (checkOut) params.set("checkout", checkOut)
  params.set("adults", String(guests))
  return `https://www.airbnb.com/s/${encodeURIComponent(destination)}/homes?${params.toString()}`
}

/** Booking.com prefilled URL */
export function bookingUrl({ destination, checkIn, checkOut, guests = 1 }: LodgingLinkParams): string {
  const params = new URLSearchParams()
  params.set("ss", destination)
  if (checkIn) params.set("checkin", checkIn)
  if (checkOut) params.set("checkout", checkOut)
  params.set("group_adults", String(guests))
  return `https://www.booking.com/searchresults.html?${params.toString()}`
}

/** Convenience: generate all logistics links for a trip */
export interface LogisticsLinks {
  flights: { google: string; skyscanner: string }
  lodging: { googleHotels: string; airbnb: string; booking: string }
}

export function buildLogisticsLinks(
  origin: string,
  destination: string,
  startDate?: string | null,
  endDate?: string | null,
  attendeeCount?: number,
): LogisticsLinks {
  const adults = attendeeCount ?? 1
  return {
    flights: {
      google: googleFlightsUrl({ origin, destination, departDate: startDate ?? undefined, returnDate: endDate ?? undefined, adults }),
      skyscanner: skyscannerUrl({ origin, destination, departDate: startDate ?? undefined, returnDate: endDate ?? undefined, adults }),
    },
    lodging: {
      googleHotels: googleHotelsUrl({ destination, checkIn: startDate ?? undefined, checkOut: endDate ?? undefined, guests: adults }),
      airbnb: airbnbUrl({ destination, checkIn: startDate ?? undefined, checkOut: endDate ?? undefined, guests: adults }),
      booking: bookingUrl({ destination, checkIn: startDate ?? undefined, checkOut: endDate ?? undefined, guests: adults }),
    },
  }
}
