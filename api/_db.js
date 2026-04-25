var Pool = require("pg").Pool;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL");
  }

  if (!global.__surprisePgPool) {
    global.__surprisePgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
    });
  }
  return global.__surprisePgPool;
}

async function query(text, params) {
  var pool = getPool();
  return pool.query(text, params || []);
}

module.exports = {
  query: query,
};
