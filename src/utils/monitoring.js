import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;
let enabled = false;

export function initMonitoring() {
  if (!dsn || enabled) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: `azan-times@${import.meta.env.VITE_APP_VERSION ?? '1.2.0'}`,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });

  enabled = true;
}

export function reportEvent(name, data = {}) {
  if (!enabled) return;
  Sentry.addBreadcrumb({
    category: 'azan',
    level: 'info',
    message: name,
    data,
  });
}

export function reportError(error, context = {}) {
  if (!enabled) return;
  Sentry.captureException(error, { extra: context });
}
