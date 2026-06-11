const sql = require('mssql');

const config = {
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options:  { encrypt: true, trustServerCertificate: true },
  pool:     { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let _pool = null;

async function getPool() {
  if (_pool) return _pool;
  _pool = await sql.connect(config);
  return _pool;
}

module.exports = { sql, getPool };
