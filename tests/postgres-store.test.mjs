import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID, createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {createPostgresStore, postgresPoolOptions} from '../server/postgres-inquiry-store.mjs';
import {fixture} from './fixtures.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const evidence = {permissionText: 'Captured consultation permission', newsletterText: 'Separate optional newsletter', landingUrl: 'https://investo.example/'};

async function setup(t) {
  // These are actual PostgreSQL statements, not string-matched SQL mocks.
  // PGlite serializes its single connection; two store handles model separate
  // callers. Live multi-connection acceptance remains a deployment check.
  const db = new PGlite();
  const pool = {query: (sql, values) => values === undefined && sql.trimStart().startsWith('BEGIN;') ? db.exec(sql) : db.query(sql, values)};
  const a = await createPostgresStore({pool});
  const b = await createPostgresStore({pool});
  t.after(async () => {await a.close(); await b.close(); await db.close();});
  return {a, b, db, pool};
}

test('PostgreSQL initialization is repeatable and receipts survive store handles', async t => {
  const {a, b, db} = await setup(t);
  const payload = fixture(), token = randomUUID();
  const result = await a.reserve(payload, token, evidence);
  assert.equal(result.created, true);
  assert.equal(result.row.id, payload.submission_id);
  assert.equal(result.row.token_hash, hash(token));
  assert.equal(result.row.payload_hash, hash(JSON.stringify(payload)));
  assert.equal(result.row.evidence_json, JSON.stringify(evidence));
  assert.ok(!Number.isNaN(Date.parse(result.row.received_at)));
  await a.close();
  assert.deepEqual(await b.get(payload.submission_id), result.row);
  assert.equal(await b.health(), true);
  assert.deepEqual((await db.query('SELECT version FROM investo_intake.schema_migrations')).rows, [{version: 1}]);
});

test('concurrent duplicate reservations across handles have one winner and immutable original payload', async t => {
  const {a, b} = await setup(t);
  const payload = fixture(), token = randomUUID();
  const results = await Promise.all(Array.from({length: 12}, (_, index) => (index % 2 ? a : b).reserve(payload, token, evidence)));
  assert.equal(results.filter(result => result.created).length, 1);
  assert.ok(results.every(result => result.row.id === payload.submission_id && result.row.payload_hash === results[0].row.payload_hash));
  const changed = {...payload, contact: {...payload.contact, first_name: 'Changed'}};
  const conflict = await b.reserve(changed, randomUUID(), {...evidence, permissionText: 'Different text'});
  assert.equal(conflict.created, false);
  assert.equal(conflict.row.payload_json, JSON.stringify(payload));
  assert.equal(conflict.row.token_hash, hash(token));
  assert.equal(conflict.row.evidence_json, JSON.stringify(evidence));
});

test('atomic lease claims exclude competitors and stale or expired tokens cannot mutate state', async t => {
  const {a, b, db} = await setup(t);
  const payload = fixture();
  await a.reserve(payload, randomUUID(), evidence);
  const tokens = await Promise.all(Array.from({length: 10}, (_, index) => (index % 2 ? a : b).claim(payload.submission_id)));
  const winners = tokens.filter(Boolean);
  assert.equal(winners.length, 1);
  const oldToken = winners[0];
  assert.equal((await a.get(payload.submission_id)).attempts, 1);
  await a.update(payload.submission_id, oldToken, {phase: 'contact_create_started'});
  await assert.rejects(b.update(payload.submission_id, randomUUID(), {status: 'accepted'}), /Lease lost/);
  await b.release(payload.submission_id, randomUUID());
  assert.equal((await a.get(payload.submission_id)).lease_token, oldToken);
  await db.query('UPDATE investo_intake.inquiries SET lease_until=0 WHERE id=$1', [payload.submission_id]);
  await assert.rejects(a.touch(payload.submission_id, oldToken), /Lease lost/);
  await assert.rejects(a.update(payload.submission_id, oldToken, {phase: 'contact_resolved'}), /Lease lost/);
  const newToken = await b.claim(payload.submission_id);
  assert.ok(newToken && newToken !== oldToken);
  await assert.rejects(a.update(payload.submission_id, oldToken, {status: 'accepted'}), /Lease lost/);
  await a.release(payload.submission_id, oldToken);
  assert.equal((await b.get(payload.submission_id)).lease_token, newToken);
  await b.update(payload.submission_id, newToken, {contact_id: 123, owner_id: 443333, phase: 'contact_resolved'});
  const row = await a.get(payload.submission_id);
  assert.equal(row.attempts, 2);
  assert.equal(row.contact_id, 123);
  assert.equal(row.owner_id, 443333);
  await assert.rejects(b.update(payload.submission_id, newToken, {payload_json: '{}'}), /Invalid state transition/);
});

test('email locks exclude other submissions, survive review and release only for their owner', async t => {
  const {a, b} = await setup(t);
  const first = fixture(), second = fixture();
  const firstRow = (await a.reserve(first, randomUUID(), evidence)).row;
  const secondRow = (await b.reserve(second, randomUUID(), evidence)).row;
  const locked = await Promise.all([a.emailLock(firstRow), b.emailLock(secondRow)]);
  assert.equal(locked.filter(Boolean).length, 1);
  const winner = locked[0] ? firstRow : secondRow;
  const loser = locked[0] ? secondRow : firstRow;
  const token = await a.claim(winner.id);
  await a.update(winner.id, token, {phase: 'contact_create_started', status: 'review', review_reason: 'contact_creation_uncertain'});
  await a.release(winner.id, token);
  await b.unlockEmail(loser.id);
  assert.equal(await b.emailLock(loser), false);
  assert.equal(await b.emailLock(winner), true);
  await a.unlockEmail(winner.id);
  assert.equal(await b.emailLock(loser), true);
});

test('shared rate limiter counts concurrent calls atomically and resets using database time', async t => {
  const {a, b, db} = await setup(t);
  const key = 'submission:203.0.113.1';
  const results = await Promise.all(Array.from({length: 12}, (_, index) => (index % 2 ? a : b).limit(key, 5)));
  assert.equal(results.filter(result => result.allowed).length, 5);
  assert.ok(results.every(result => Number.isInteger(result.retryAfter) && result.retryAfter >= 1 && result.retryAfter <= 60));
  const bucket = (await db.query('SELECT key,count FROM investo_intake.request_limits')).rows[0];
  assert.equal(bucket.key, hash(key));
  assert.equal(bucket.count, 12);
  await db.query('UPDATE investo_intake.request_limits SET reset=0 WHERE key=$1', [hash(key)]);
  assert.equal((await b.limit(key, 5)).allowed, true);
  assert.equal((await db.query('SELECT count FROM investo_intake.request_limits WHERE key=$1', [hash(key)])).rows[0].count, 1);
});

test('pending work respects lease and backoff; private reconciliation never resets write intent', async t => {
  const {a, b, db} = await setup(t);
  const payload = fixture();
  await a.reserve(payload, randomUUID(), evidence);
  assert.deepEqual(await b.pending(), [{id: payload.submission_id}]);
  const token = await a.claim(payload.submission_id);
  assert.deepEqual(await b.pending(), []);
  assert.equal(await b.reopenForReconciliation(payload.submission_id), false);
  await a.update(payload.submission_id, token, {phase: 'inquiry_create_started', contact_id: 123, owner_id: 443333, next_attempt: Date.now() + 600000});
  assert.equal(await b.reopenForReconciliation(payload.submission_id), false);
  await a.release(payload.submission_id, token);
  assert.deepEqual(await b.pending(), []);
  assert.equal(await b.reopenForReconciliation(payload.submission_id), true);
  assert.deepEqual(await b.pending(), [{id: payload.submission_id}]);
  assert.equal((await a.get(payload.submission_id)).phase, 'inquiry_create_started');
  const retryToken = await b.claim(payload.submission_id);
  await b.update(payload.submission_id, retryToken, {status: 'accepted', inquiry_id: 987, phase: 'inquiry_stored'});
  await b.release(payload.submission_id, retryToken);
  assert.equal(await b.reopenForReconciliation(payload.submission_id), false);
  assert.equal(await a.claim(payload.submission_id), null);
  assert.deepEqual(await a.pending(), []);
  assert.equal((await db.query('SELECT status FROM investo_intake.inquiries WHERE id=$1', [payload.submission_id])).rows[0].status, 'accepted');
});

test('connection URL options cannot weaken TLS and configuration failures omit credentials', async () => {
  const options = postgresPoolOptions('postgresql://user:server-secret@example.com/db?sslmode=require&sslrootcert=ignored&uselibpqcompat=true');
  assert.deepEqual(options.ssl, {rejectUnauthorized: true});
  const url = new URL(options.connectionString);
  assert.equal(url.searchParams.size, 0);
  assert.equal(url.password, 'server-secret');
  for (const mode of ['disable', 'allow', 'prefer', 'no-verify']) {
    assert.throws(() => postgresPoolOptions(`postgresql://user:server-secret@example.com/db?sslmode=${mode}`), /verified TLS/);
  }
  assert.throws(() => postgresPoolOptions('not-a-url-server-secret'), error => !error.message.includes('server-secret'));
  await assert.rejects(createPostgresStore({pool: {query: async () => {throw new Error('server-secret');}}}), error => error.message === 'Inquiry storage initialization failed.');
});
