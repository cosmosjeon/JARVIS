#!/usr/bin/env node
/* eslint-disable no-console */

const requiredVars = [
  'REACT_APP_SUPABASE_URL',
  'REACT_APP_SUPABASE_ANON_KEY',
];

const missing = requiredVars.filter((key) => {
  const value = process.env[key];
  return typeof value !== 'string' || value.length === 0;
});

if (missing.length > 0) {
  console.error(`[env-check] Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('[env-check] Environment variables validated.');
