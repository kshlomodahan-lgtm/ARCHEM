/**
 * sfAuditLogger — ARCHEM → SQUADFLOW Audit Log integration
 * Uses a separate ConnectionPool to avoid conflicting with ARCHEM's own DB pool.
 */
const mssql = require('mssql');

let _pool = null;
let _connecting = false;

async function getPool() {
  if (_pool && _pool.connected) return _pool;
  if (_connecting) {
    // Wait for the connection in progress
    await new Promise(r => setTimeout(r, 500));
    return _pool;
  }
  _connecting = true;
  try {
    const pool = new mssql.ConnectionPool({
      server:   process.env.SF_DB_SERVER,
      database: process.env.SF_DB_NAME,
      user:     process.env.SF_DB_USER,
      password: process.env.SF_DB_PASSWORD,
      options:  { trustServerCertificate: true, encrypt: false },
      pool:     { max: 3, min: 0, idleTimeoutMillis: 30000 },
    });
    await pool.connect();
    _pool = pool;
    console.log('[sfAudit] Connected to SQUADFLOW DB (TenantID=' + process.env.SF_TENANT_ID + ')');
  } catch (err) {
    console.error('[sfAudit] Failed to connect to SQUADFLOW DB:', err.message);
    _pool = null;
  } finally {
    _connecting = false;
  }
  return _pool;
}

/**
 * @param {import('express').Request|null} req
 * @param {{ actionType, entityType, entityId?, entityName?, oldValue?, newValue?, severity? }} opts
 */
async function logAction(req, {
  actionType, entityType,
  entityId   = null,
  entityName = null,
  oldValue   = null,
  newValue   = null,
  severity   = 'INFO',
}) {
  try {
    const pool = await getPool();
    if (!pool) return;

    const tenantId       = +process.env.SF_TENANT_ID;
    const resolvedUserId = req?.user?.userId   ?? null;
    const resolvedName   = req?.user?.fullName  ?? 'anonymous';
    const ip = ((req?.ip || req?.connection?.remoteAddress || '0.0.0.0').replace('::ffff:', '')).substring(0, 45);
    const ua = (req?.get?.('user-agent') || '').substring(0, 500);

    const r = pool.request();
    r.input('TenantID',   mssql.Int,              tenantId);
    r.input('UserID',     mssql.Int,              resolvedUserId);
    r.input('UserName',   mssql.NVarChar(100),    resolvedName);
    r.input('TenantName', mssql.NVarChar(200),    process.env.SF_TENANT_NAME || 'ARCHEM');
    r.input('ActionType', mssql.VarChar(50),      actionType);
    r.input('EntityType', mssql.VarChar(50),      entityType);
    r.input('EntityID',   mssql.Int,              entityId);
    r.input('EntityName', mssql.NVarChar(200),    entityName);
    r.input('CustomerID', mssql.Int,              null);
    r.input('OldValue',   mssql.NVarChar(mssql.MAX), oldValue ? JSON.stringify(oldValue) : null);
    r.input('NewValue',   mssql.NVarChar(mssql.MAX), newValue ? JSON.stringify(newValue) : null);
    r.input('IPAddress',  mssql.VarChar(45),      ip || '0.0.0.0');
    r.input('UserAgent',  mssql.NVarChar(500),    ua);
    r.input('SessionID',  mssql.NVarChar(100),    null);
    r.input('Severity',   mssql.VarChar(10),      severity);
    r.output('ResultCode',    mssql.Int);
    r.output('ResultMessage', mssql.NVarChar(200));
    await r.execute('sp_AuditLog_Insert');
  } catch (err) {
    console.error('[sfAudit] logAction error:', err.message);
  }
}

module.exports = { logAction };
