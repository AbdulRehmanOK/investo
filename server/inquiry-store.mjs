import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export const hash=value=>createHash('sha256').update(value).digest('hex');
export function createStore(filename) {
  mkdirSync(path.dirname(filename),{recursive:true});
  const db=new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, payload_hash TEXT NOT NULL,
      payload_json TEXT NOT NULL, evidence_json TEXT NOT NULL, email_hash TEXT NOT NULL,
      received_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', phase TEXT NOT NULL DEFAULT 'reserved',
      contact_id INTEGER, owner_id INTEGER, inquiry_id INTEGER, review_reason TEXT,
      lease_token TEXT, lease_until INTEGER NOT NULL DEFAULT 0, next_attempt INTEGER NOT NULL DEFAULT 0,
      attempts INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS contact_locks (email_hash TEXT PRIMARY KEY, submission_id TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS request_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, reset INTEGER NOT NULL);`);
  const get=id=>db.prepare('SELECT * FROM inquiries WHERE id=?').get(id);
  function reserve(payload,token,evidence) {
    const json=JSON.stringify(payload),id=payload.submission_id;
    const result=db.prepare('INSERT OR IGNORE INTO inquiries (id,token_hash,payload_hash,payload_json,evidence_json,email_hash,received_at) VALUES (?,?,?,?,?,?,?)').run(id,hash(token),hash(json),json,JSON.stringify(evidence),hash(payload.contact.email),new Date().toISOString());
    return {row:get(id),created:!!result.changes};
  }
  function claim(id) {
    const token=randomUUID(),now=Date.now();
    const changed=db.prepare("UPDATE inquiries SET lease_token=?, lease_until=?, attempts=attempts+1 WHERE id=? AND status='pending' AND lease_until<?").run(token,now+90000,id,now);
    return changed.changes?token:null;
  }
  function update(id,token,changes) {
    const allowed=['status','phase','contact_id','owner_id','inquiry_id','review_reason','next_attempt'];
    const entries=Object.entries(changes);if(entries.some(([key])=>!allowed.includes(key)))throw Error('Invalid state transition.');
    const result=db.prepare(`UPDATE inquiries SET ${entries.map(([key])=>key+'=?').join(',')},lease_until=? WHERE id=? AND lease_token=? AND lease_until>?`).run(...entries.map(([,value])=>value),Date.now()+90000,id,token,Date.now());
    if(!result.changes)throw Error('Lease lost.');
  }
  function touch(id,token) {const r=db.prepare('UPDATE inquiries SET lease_until=? WHERE id=? AND lease_token=? AND lease_until>?').run(Date.now()+90000,id,token,Date.now());if(!r.changes)throw Error('Lease lost.');}
  function emailLock(row) {db.prepare('INSERT OR IGNORE INTO contact_locks VALUES (?,?)').run(row.email_hash,row.id);return db.prepare('SELECT submission_id FROM contact_locks WHERE email_hash=?').get(row.email_hash)?.submission_id===row.id;}
  const unlockEmail=id=>db.prepare('DELETE FROM contact_locks WHERE submission_id=?').run(id);
  function limit(key,max,windowMs=60000) {
    const now=Date.now();
    db.prepare('DELETE FROM request_limits WHERE reset<?').run(now);
    const item=db.prepare('INSERT INTO request_limits (key,count,reset) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count,reset').get(hash(key),now+windowMs);
    return {allowed:item.count<=max,retryAfter:Math.max(1,Math.ceil((item.reset-now)/1000))};
  }
  const reopenForReconciliation=id=>!!db.prepare("UPDATE inquiries SET status='pending',next_attempt=0 WHERE id=? AND phase='inquiry_create_started' AND status<>'accepted' AND lease_until<=?").run(id,Date.now()).changes;
  return {get,reserve,claim,update,touch,emailLock,unlockEmail,limit,reopenForReconciliation,health:()=>true,
    release:(id,token)=>db.prepare('UPDATE inquiries SET lease_token=NULL,lease_until=0 WHERE id=? AND lease_token=?').run(id,token),
    pending:()=>db.prepare("SELECT id FROM inquiries WHERE status='pending' AND lease_until<? AND next_attempt<=? ORDER BY received_at LIMIT 10").all(Date.now(),Date.now()),
    close:()=>db.close()};
}
