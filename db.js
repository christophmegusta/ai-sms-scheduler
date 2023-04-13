const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");

// get db instance
const getDb = async () => {
  const db = await sqlite.open({
    filename: "sms-scheduler.db",
    driver: sqlite3.Database,
  });

  return db;
};

const setupDb = async () => {
  const db = await getDb();

  db.exec(
    `CREATE TABLE IF NOT EXISTS scheduled_sms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT,
      message TEXT,
      send_at INTEGER,
      occurrences INTEGER DEFAULT 0,
      recurrence TEXT)`
  );

  return db;
};


module.exports = {
  setupDb,
  getDb
};
