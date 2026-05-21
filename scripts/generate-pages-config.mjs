import fs from 'node:fs';
import path from 'node:path';

function parseBoolean(value, fallback = false) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeFromSet(value, allowed, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return allowed.includes(normalized) ? normalized : fallback;
}

function getPendingExpiryMinutes(value) {
  const parsed = parseInt(value || '', 10);
  if (Number.isNaN(parsed) || parsed <= 0) return 30;
  return Math.min(parsed, 60);
}

const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
  throw new Error(`Invalid target directory for config.js generation: ${targetDir}`);
}
const pendingExpiryMinutes = getPendingExpiryMinutes(
  process.env.BOOKING_PENDING_EXPIRY_MIN || process.env.BOOKING_COOLDOWN_MIN
);

const config = {
  IG_USERNAME: process.env.IG_USERNAME || 'latanadelconiglio_nola',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || '',
  SUBMIT_BOOKING_FUNCTION_URL: process.env.SUBMIT_BOOKING_FUNCTION_URL || '',
  BOOKING_STATUS_FUNCTION_URL: process.env.BOOKING_STATUS_FUNCTION_URL || '',
  BOOKING_PENDING_EXPIRY_MIN: pendingExpiryMinutes,
  BOOKING_COOLDOWN_MIN: pendingExpiryMinutes,
  ADS_ENABLED: parseBoolean(process.env.ADS_ENABLED, false),
  ADS_MODE: normalizeFromSet(process.env.ADS_MODE, ['off', 'soft', 'intrusive'], 'off'),
  ADS_PROVIDER: normalizeFromSet(process.env.ADS_PROVIDER, ['none', 'adsense', 'custom'], 'none'),
  ADSENSE_CLIENT_ID: process.env.ADSENSE_CLIENT_ID || '',
  ADSENSE_BANNER_SLOT: process.env.ADSENSE_BANNER_SLOT || '',
  ADS_REQUIRE_BEFORE_BOOKING: parseBoolean(process.env.ADS_REQUIRE_BEFORE_BOOKING, false),
};

fs.writeFileSync(
  path.join(targetDir, 'config.js'),
  `const CONFIG = ${JSON.stringify(config, null, 2)};\nif (typeof window !== 'undefined') { window.CONFIG = CONFIG; }\n`
);
console.log(`config.js generated in ${targetDir}`);
