/** Zona horaria IANA por país del perfil (`livesIn.country`). */
const COUNTRY_TIMEZONES: Record<string, string> = {
  Uruguay: "America/Montevideo",
  Argentina: "America/Argentina/Buenos_Aires",
  Brasil: "America/Sao_Paulo",
  Chile: "America/Santiago",
  Paraguay: "America/Asuncion",
  España: "Europe/Madrid",
  México: "America/Mexico_City",
  Colombia: "America/Bogota",
  Otro: "America/Montevideo",
};

/** Default de producto (Uruguay · GMT-3). */
export const DEFAULT_TIMEZONE = "America/Montevideo";

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function timezoneFromCountry(country?: string | null): string {
  const key = (country ?? "").trim();
  if (!key) return DEFAULT_TIMEZONE;
  return COUNTRY_TIMEZONES[key] ?? DEFAULT_TIMEZONE;
}

/** Fecha civil de hoy en la zona (`YYYY-MM-DD`). */
export function todayInTimeZone(timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseYmd(ymd: string): { year: number; month: number; day: number } | null {
  const m = YMD_RE.exec(ymd.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  let hour = get("hour");
  // Algunos entornos reportan 24:00 en vez de 00:00
  if (hour === 24) hour = 0;

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Convierte una fecha/hora civil en `timeZone` a un instante UTC.
 * Útil para anclar validez de promos al día del usuario (p. ej. Uruguay GMT-3).
 */
export function zonedDateTimeToUtc(
  ymd: string,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone: string
): Date | null {
  const parsed = parseYmd(ymd);
  if (!parsed) return null;

  const { year, month, day } = parsed;
  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second, ms);

  for (let i = 0; i < 4; i++) {
    const local = zonedParts(new Date(utcMs), timeZone);
    const asIfUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
      ms
    );
    const intended = Date.UTC(year, month - 1, day, hour, minute, second, ms);
    const delta = intended - asIfUtc;
    if (delta === 0) break;
    utcMs += delta;
  }

  return new Date(utcMs);
}

/** Inicio del día civil (00:00:00.000) en la zona → UTC. */
export function startOfZonedDay(
  ymd: string,
  timeZone: string = DEFAULT_TIMEZONE
): Date | null {
  return zonedDateTimeToUtc(ymd, 0, 0, 0, 0, timeZone);
}

/** Fin del día civil (23:59:59.999) en la zona → UTC. */
export function endOfZonedDay(
  ymd: string,
  timeZone: string = DEFAULT_TIMEZONE
): Date | null {
  return zonedDateTimeToUtc(ymd, 23, 59, 59, 999, timeZone);
}

export function isValidYmd(ymd: string): boolean {
  return parseYmd(ymd) != null;
}
