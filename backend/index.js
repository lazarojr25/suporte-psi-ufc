import { onRequest } from 'firebase-functions/v2/https';
import app from './src/app.js';

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const toNonNegativeInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const region = process.env.FUNCTION_REGION || 'southamerica-east1';
const timeoutSeconds = toPositiveInt(process.env.FUNCTION_TIMEOUT_SECONDS, 540);
const maxInstances = toPositiveInt(process.env.FUNCTION_MAX_INSTANCES, 5);
const minInstances = toNonNegativeInt(process.env.FUNCTION_MIN_INSTANCES, 0);
const concurrency = toPositiveInt(process.env.FUNCTION_CONCURRENCY, 40);
const memory = process.env.FUNCTION_MEMORY || '2GiB';

export const api = onRequest(
  {
    region,
    timeoutSeconds,
    maxInstances,
    minInstances,
    concurrency,
    memory,
  },
  app,
);
