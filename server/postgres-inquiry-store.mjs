import {readFile} from 'node:fs/promises';
import {createHash, randomUUID} from 'node:crypto';

const hash = value => createHash('sha256').update(value).digest('hex');
const dbNow = '(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint)';
const leaseMs = 90000;
const allowedChanges = new Set(['status', 'phase', 'contact_id', 'owner_id', 'inquiry_id', 'review_reason', 'next_attempt']);
const numericFields = ['contact_id', 'owner_id', 'inquiry_id', 'lease_until', 'next_attempt', 'attempts'];

function normalizeRow(row) {
  if (!row) return undefined;
  const result = {...row};
  for (const key of numericFields) {
    if (result[key] !== null && result[key] !== undefined) {
      const value = Number(result[key]);
      if (!Number.isSafeInteger(value)) throw new Error('Invalid inquiry state.');
      result[key] = value;
    }
  }
  result.received_at = new Date(result.received_at).toISOString();
  return result;
}

/** URL SSL parameters can override pg's SSL object; remove them before use. */
export function postgresPoolOptions(connectionString) {
  let url;
  try { url = new URL(connectionString); } catch { throw new Error('A PostgreSQL connection is required.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error('A PostgreSQL connection is required.');
  }
  const mode = url.searchParams.get('sslmode');
  if (mode && !['require', 'verify-ca', 'verify-full'].includes(mode)) {
    throw new Error('PostgreSQL must use verified TLS.');
  }
  for (const name of [...url.searchParams.keys()]) {
    if (/^ssl/i.test(name) || name === 'uselibpqcompat') url.searchParams.delete(name);
  }
  return {
    connectionString: url.toString(),
    ssl: {rejectUnauthorized: true},
    max: 3,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
    query_timeout: 3000,
    statement_timeout: 3000,
    application_name: 'investo-inquiries',
  };
}

/**
 * Shared, durable state for independent serverless instances. All operations are
 * awaited by the caller. Passing a pool is for a trusted server-side adapter or
 * tests; only pools created here are closed by this store.
 */
export async function createPostgresStore({connectionString, pool: injectedPool} = {}) {
  let pool = injectedPool;
  const ownedPool = !pool;
  if (!pool) {
    const options = postgresPoolOptions(connectionString);
    const {Pool} = await import('pg');
    pool = new Pool(options);
    // Idle socket failures must not become uncaught EventEmitter errors. Never
    // log the pg error object, because provider errors can contain connection data.
    pool.on('error', () => console.error('Inquiry storage connection unavailable.'));
  }
  if (typeof pool.query !== 'function') throw new Error('A PostgreSQL query adapter is required.');
  try {
    const migration = await readFile(new URL('./migrations/001-inquiry-state.sql', import.meta.url), 'utf8');
    // One query message pins BEGIN, DDL, advisory lock and COMMIT to one session,
    // even when query() is supplied by a connection pool.
    await pool.query(migration);
  } catch {
    if (ownedPool) await pool.end().catch(() => {});
    throw new Error('Inquiry storage initialization failed.');
  }

  async function get(id) {
    const result = await pool.query('SELECT * FROM investo_intake.inquiries WHERE id=$1', [id]);
    return normalizeRow(result.rows[0]);
  }
  async function reserve(payload, token, evidence) {
    const json = JSON.stringify(payload);
    const result = await pool.query(`
      INSERT INTO investo_intake.inquiries
        (id, token_hash, payload_hash, payload_json, evidence_json, email_hash)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING RETURNING *`,
    [payload.submission_id, hash(token), hash(json), json, JSON.stringify(evidence), hash(payload.contact.email)]);
    if (result.rows.length) return {row: normalizeRow(result.rows[0]), created: true};
    // A separate statement sees the committed winner after a concurrent insert.
    // A same-statement CTE fallback could miss it under READ COMMITTED snapshots.
    return {row: await get(payload.submission_id), created: false};
  }
  async function claim(id) {
    const token = randomUUID();
    const result = await pool.query(`
      UPDATE investo_intake.inquiries
      SET lease_token=$2, lease_until=${dbNow}+$3, attempts=attempts+1
      WHERE id=$1 AND status='pending' AND lease_until<=${dbNow}
      RETURNING lease_token`, [id, token, leaseMs]);
    return result.rows[0]?.lease_token ?? null;
  }
  async function update(id, token, changes) {
    const entries = Object.entries(changes);
    if (entries.some(([key]) => !allowedChanges.has(key))) throw new Error('Invalid state transition.');
    const assignments = entries.map(([key], index) => `${key}=$${index + 4}`);
    const result = await pool.query(`
      UPDATE investo_intake.inquiries SET ${[...assignments, `lease_until=${dbNow}+$3`].join(',')}
      WHERE id=$1 AND lease_token=$2 AND lease_until>${dbNow} RETURNING id`,
    [id, token, leaseMs, ...entries.map(([, value]) => value)]);
    if (!result.rows.length) throw new Error('Lease lost.');
  }
  async function touch(id, token) { await update(id, token, {}); }
  async function emailLock(row) {
    await pool.query(`
      INSERT INTO investo_intake.contact_locks (email_hash,submission_id)
      VALUES ($1,$2) ON CONFLICT (email_hash) DO NOTHING`, [row.email_hash, row.id]);
    const result = await pool.query('SELECT submission_id FROM investo_intake.contact_locks WHERE email_hash=$1', [row.email_hash]);
    return result.rows[0]?.submission_id === row.id;
  }
  async function unlockEmail(id) {
    await pool.query('DELETE FROM investo_intake.contact_locks WHERE submission_id=$1', [id]);
  }
  async function release(id, token) {
    await pool.query(`UPDATE investo_intake.inquiries SET lease_token=NULL,lease_until=0
      WHERE id=$1 AND lease_token=$2`, [id, token]);
  }
  async function pending() {
    // Rate buckets contain only hashed IP-derived keys. Expired buckets are not
    // inquiry evidence and can be pruned by the scheduled worker.
    await pool.query(`DELETE FROM investo_intake.request_limits WHERE reset<${dbNow}-86400000`);
    const result = await pool.query(`SELECT id FROM investo_intake.inquiries
      WHERE status='pending' AND lease_until<=${dbNow} AND next_attempt<=${dbNow}
      ORDER BY received_at LIMIT 10`);
    return result.rows;
  }
  async function limit(key, max, windowMs = 60000) {
    if (!Number.isSafeInteger(max) || max < 1 || !Number.isSafeInteger(windowMs) || windowMs < 1) {
      throw new Error('Invalid rate limit.');
    }
    const result = await pool.query(`
      INSERT INTO investo_intake.request_limits AS bucket (key,count,reset)
      VALUES ($1,1,${dbNow}+$2)
      ON CONFLICT (key) DO UPDATE SET
        count=CASE WHEN bucket.reset<=${dbNow} THEN 1 ELSE bucket.count+1 END,
        reset=CASE WHEN bucket.reset<=${dbNow} THEN ${dbNow}+$2 ELSE bucket.reset END
      RETURNING count,reset,${dbNow} AS server_now`, [hash(key), windowMs]);
    const item = result.rows[0];
    return {allowed: Number(item.count) <= max, retryAfter: Math.max(1, Math.ceil((Number(item.reset) - Number(item.server_now)) / 1000))};
  }
  async function reopenForReconciliation(id) {
    const result = await pool.query(`UPDATE investo_intake.inquiries
      SET status='pending',next_attempt=0
      WHERE id=$1 AND phase='inquiry_create_started' AND status<>'accepted'
        AND lease_until<=${dbNow} RETURNING id`, [id]);
    return result.rows.length > 0;
  }
  async function health() { await pool.query('SELECT 1'); return true; }
  async function close() { if (ownedPool) await pool.end(); }

  return {get, reserve, claim, update, touch, emailLock, unlockEmail, limit, release, pending,
    reopenForReconciliation, health, close};
}
