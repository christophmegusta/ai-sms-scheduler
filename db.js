const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const setupDb = async () => {
  const db = await open({
    filename: "sms-scheduler.db",
    driver: sqlite3.Database,
  });

  await db.exec(
    `CREATE TABLE IF NOT EXISTS scheduled_sms (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, message TEXT, send_at 
INTEGER)`
  );

  return db;
};

module.exports = {
  setupDb,
};

