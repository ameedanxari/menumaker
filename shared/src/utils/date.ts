/**
 * Date and timezone utilities for consistent handling across the application.
 *
 * Best Practices:
 * - Always store dates in UTC in the database
 * - Display dates in the business's timezone or user's local timezone
 * - Use ISO 8601 format for API communication
 * - Parse dates safely with validation
 */

/**
 * Parse a date string safely, returning null if invalid
 */
export function parseDate(dateString: string | Date | null | undefined): Date | null {
  if (!dateString) return null;

  if (dateString instanceof Date) {
    return isNaN(dateString.getTime()) ? null : dateString;
  }

  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Format date to ISO 8601 string (UTC)
 * Use this when sending dates to the API
 */
export function toISOString(date: Date | string | null | undefined): string | null {
  const parsed = parseDate(date);
  return parsed ? parsed.toISOString() : null;
}

/**
 * Get start of day in UTC
 */
export function startOfDayUTC(date: Date | string): Date {
  const parsed = parseDate(date);
  if (!parsed) throw new Error('Invalid date');

  const utcDate = new Date(Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
    0, 0, 0, 0
  ));
  return utcDate;
}

/**
 * Get end of day in UTC
 */
export function endOfDayUTC(date: Date | string): Date {
  const parsed = parseDate(date);
  if (!parsed) throw new Error('Invalid date');

  const utcDate = new Date(Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
    23, 59, 59, 999
  ));
  return utcDate;
}

/**
 * Format date for display in a specific timezone
 * @param date - Date to format
 * @param timezone - IANA timezone (e.g., 'America/New_York', 'Asia/Kolkata')
 * @param options - Intl.DateTimeFormat options
 */
export function formatInTimezone(
  date: Date | string | null | undefined,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const parsed = parseDate(date);
  if (!parsed) return '';

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  };

  return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(parsed);
}

/**
 * Format date relative to now (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelative(date: Date | string | null | undefined): string {
  const parsed = parseDate(date);
  if (!parsed) return '';

  const now = new Date();
  const diffMs = now.getTime() - parsed.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} week${Math.floor(diffDay / 7) !== 1 ? 's' : ''} ago`;
  if (diffDay < 365) return `${Math.floor(diffDay / 30)} month${Math.floor(diffDay / 30) !== 1 ? 's' : ''} ago`;
  return `${Math.floor(diffDay / 365)} year${Math.floor(diffDay / 365) !== 1 ? 's' : ''} ago`;
}

/**
 * Check if a date is within a range (inclusive)
 */
export function isDateInRange(
  date: Date | string,
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
): boolean {
  const dateToCheck = parseDate(date);
  if (!dateToCheck) return false;

  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (startDate && dateToCheck < startDate) return false;
  if (endDate && dateToCheck > endDate) return false;

  return true;
}

/**
 * Compare two dates (ignoring time)
 * Returns: -1 if a < b, 0 if equal, 1 if a > b
 */
export function compareDates(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined
): number {
  const dateA = parseDate(a);
  const dateB = parseDate(b);

  if (!dateA && !dateB) return 0;
  if (!dateA) return -1;
  if (!dateB) return 1;

  const timeA = startOfDayUTC(dateA).getTime();
  const timeB = startOfDayUTC(dateB).getTime();

  if (timeA < timeB) return -1;
  if (timeA > timeB) return 1;
  return 0;
}

/**
 * Get today's date at start of day in UTC
 */
export function todayUTC(): Date {
  return startOfDayUTC(new Date());
}

/**
 * Check if date is today (in UTC)
 */
export function isToday(date: Date | string | null | undefined): boolean {
  const parsed = parseDate(date);
  if (!parsed) return false;

  const today = todayUTC();
  return startOfDayUTC(parsed).getTime() === today.getTime();
}

/**
 * Add days to a date
 */
export function addDays(date: Date | string, days: number): Date {
  const parsed = parseDate(date);
  if (!parsed) throw new Error('Invalid date');

  const result = new Date(parsed);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Validate date range (start must be before or equal to end)
 */
export function isValidDateRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
): boolean {
  if (!start || !end) return true; // Allow null dates

  const startDate = parseDate(start);
  const endDate = parseDate(end);

  if (!startDate || !endDate) return false;

  return startDate <= endDate;
}

/**
 * Format time duration in a human-readable format
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Get business hours for a given day in a timezone
 * Returns times in 24-hour format (e.g., "09:00", "17:30")
 */
export function getBusinessHours(
  dayOfWeek: number, // 0 = Sunday, 6 = Saturday
  timezone: string,
  businessHours?: {
    [key: number]: { open: string; close: string } | null;
  }
): { open: string; close: string } | null {
  if (!businessHours || !businessHours[dayOfWeek]) {
    return null;
  }

  return businessHours[dayOfWeek];
}

/**
 * Check if current time is within business hours
 */
export function isWithinBusinessHours(
  timezone: string,
  businessHours?: {
    [key: number]: { open: string; close: string } | null;
  }
): boolean {
  if (!businessHours) return true; // If no hours set, assume always open

  // Get current time in business timezone
  const now = new Date();
  const dayOfWeek = new Date(now.toLocaleString('en-US', { timeZone: timezone })).getDay();

  const hours = getBusinessHours(dayOfWeek, timezone, businessHours);
  if (!hours) return false; // Closed today

  // Get current time in HH:mm format in business timezone
  const currentTime = now.toLocaleString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return currentTime >= hours.open && currentTime <= hours.close;
}
