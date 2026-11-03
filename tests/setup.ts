/**
 * Isolated Test Environment Shield
 * 
 * CRITICAL SAFETY MECHANISM:
 * This file guarantees that ALL test suites run strictly against isolated,
 * mock/ephemeral endpoints. Tests are HARD-BLOCKED from touching your real
 * Supabase PostgreSQL database or your real Upstash Redis account, preventing
 * accidental quota consumption or data corruption.
 */

// Force test environment
process.env.NODE_ENV = 'test';

// Isolated local database URL (points to local test container only, never cloud Supabase)
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testpassword@127.0.0.1:5432/focusx_test';
process.env.DIRECT_URL = process.env.DATABASE_URL;

// Fake mock Upstash credentials (tests will never connect to live Upstash)
process.env.UPSTASH_REDIS_REST_URL = 'https://mock-fake-redis.upstash.io';
process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-mock-token-ci-shield';

// Fake mock Supabase credentials
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock-fake-supabase.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-mock-anon-key-ci-shield';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-mock-service-role-ci-shield';
