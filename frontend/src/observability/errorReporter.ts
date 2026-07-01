export type ClientPlatform = 'web' | 'android' | 'ios';
export type ClientTelemetryEvent =
  | 'fatal_boundary'
  | 'api_failure'
  | 'sync_failure'
  | 'forced_debug_crash'
  | 'payment_ui_failure'
  | 'media_upload_failure';

export interface ClientTelemetryPayload {
  event: ClientTelemetryEvent;
  platform: ClientPlatform;
  release: string;
  environment: 'development' | 'test' | 'staging' | 'production';
  operation: string;
  error_code: string;
  correlation_id: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface ClientTelemetryExporter {
  send(payload: ClientTelemetryPayload): Promise<void> | void;
}

const SENSITIVE_KEY_PATTERN = /(token|authorization|cookie|password|secret|email|phone|address|payment|card|request_?body|body|metadata)$/i;
const SENSITIVE_VALUE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/i,
  /(sk|pk|rk)_(test|live)_[A-Za-z0-9]+/,
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /\+?[0-9][0-9 .()-]{7,}[0-9]/,
];

export class ClientErrorReporter {
  constructor(private readonly exporter: ClientTelemetryExporter) {}

  async report(payload: ClientTelemetryPayload): Promise<ClientTelemetryPayload> {
    const sanitized = sanitizePayload(payload);
    await this.exporter.send(sanitized);
    return sanitized;
  }

  reportFatalBoundary(error: Error, context: Omit<ClientTelemetryPayload, 'event' | 'message' | 'error_code'> & { error_code?: string }): Promise<ClientTelemetryPayload> {
    return this.report({
      ...context,
      event: 'fatal_boundary',
      error_code: context.error_code ?? error.name,
      message: error.message,
    });
  }

  reportApiFailure(status: number, context: Omit<ClientTelemetryPayload, 'event' | 'error_code'>): Promise<ClientTelemetryPayload> {
    return this.report({
      ...context,
      event: 'api_failure',
      error_code: `http_${status}`,
    });
  }

  reportSyncFailure(context: Omit<ClientTelemetryPayload, 'event'>): Promise<ClientTelemetryPayload> {
    return this.report({
      ...context,
      event: 'sync_failure',
    });
  }
}

export function sanitizePayload(payload: ClientTelemetryPayload): ClientTelemetryPayload {
  const metadata = sanitizeMetadata(payload.metadata ?? {});
  return {
    ...payload,
    message: payload.message ? sanitizeString(payload.message) : undefined,
    metadata,
  };
}

export function sanitizeMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = '[REDACTED]';
      continue;
    }
    if (typeof value === 'string') {
      output[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      output[key] = value.map((item) => typeof item === 'string' ? sanitizeString(item) : item);
    } else if (value && typeof value === 'object') {
      output[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      output[key] = value;
    }
  }
  return output;
}

export function sanitizeString(value: string): string {
  return SENSITIVE_VALUE_PATTERNS.reduce((current, pattern) => current.replace(pattern, '[REDACTED]'), value);
}

export const consoleTelemetryExporter: ClientTelemetryExporter = {
  send(payload) {
    if (payload.environment !== 'production') {
      // Structured console signal for non-production debug projects only.
      console.info('[client-telemetry]', payload);
    }
  },
};
