import {
  endOfZonedDay,
  isValidYmd,
  startOfZonedDay,
  timezoneFromCountry,
} from "@nocta/shared";

const ymdSchemaMessage = "Usá fechas YYYY-MM-DD";

/** Filtro Mongo: promo vigente en `now` (respeta validFrom / validUntil). */
export function currentlyValidPromoFilter(now = new Date()) {
  return {
    $and: [
      {
        $or: [
          { validFrom: null },
          { validFrom: { $exists: false } },
          { validFrom: { $lte: now } },
        ],
      },
      {
        $or: [
          { validUntil: null },
          { validUntil: { $exists: false } },
          { validUntil: { $gte: now } },
        ],
      },
    ],
  };
}

export function resolveUserTimeZone(country?: string | null): string {
  return timezoneFromCountry(country);
}

/**
 * Interpreta fechas civiles del form en la zona del usuario.
 * `validFrom` → 00:00 local · `validUntil` → 23:59:59.999 local.
 */
export function parsePromoValidityRange(
  validFromYmd: string,
  validUntilYmd: string,
  timeZone: string
):
  | { ok: true; validFrom: Date; validUntil: Date }
  | { ok: false; error: string } {
  if (!isValidYmd(validFromYmd) || !isValidYmd(validUntilYmd)) {
    return { ok: false, error: ymdSchemaMessage };
  }

  const validFrom = startOfZonedDay(validFromYmd, timeZone);
  const validUntil = endOfZonedDay(validUntilYmd, timeZone);
  if (!validFrom || !validUntil) {
    return { ok: false, error: ymdSchemaMessage };
  }
  if (validFrom.getTime() > validUntil.getTime()) {
    return {
      ok: false,
      error: "La fecha de inicio no puede ser posterior a la de fin",
    };
  }

  return { ok: true, validFrom, validUntil };
}
