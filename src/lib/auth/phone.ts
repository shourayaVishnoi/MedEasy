import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export function countryOptions(locale = "en") {
  const names = new Intl.DisplayNames([locale], { type: "region" });
  return getCountries()
    .map((c) => ({ code: c, name: names.of(c) ?? c, dial: `+${getCountryCallingCode(c)}` }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Validate and normalise to E.164 (what SMS providers expect). */
export function toE164(raw: string, country: CountryCode): string | null {
  const p = parsePhoneNumberFromString(raw, country);
  return p && p.isValid() ? p.number : null;
}
