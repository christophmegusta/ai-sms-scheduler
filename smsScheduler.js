require("dotenv").config();
const { parse } = require("date-fns");

const { getDb } = require("./db");
const { sendSms } = require("./twilioClient");
const { generateMessage } = require("./chatgptClient");

const twilioFromNumber = process.env.TWILIO_PHONE_NUMBER;


function parseSendAt(sendAt) {
  if (sendAt === "now") {
    return Math.floor(Date.now() / 1000);
  }

  if (/\d{14}/.test(sendAt)) {
    return Math.floor(parseInt(sendAt, 14) / 1000);
  }

  if (/\d{10}/.test(sendAt)) {
    return parseInt(sendAt, 10);
  }

  try {
    const parsedDate = parse(sendAt, "yyyy-MM-dd HH:mm:ss", new Date());
    return Math.floor(parsedDate.getTime() / 1000);
  } catch (error) {
    console.error("Invalid sendAt input format. Please use a Unix timestamp, 'now', or 'yyyy-MM-dd HH:mm:ss' format.");
    throw error;
  }
}

async function addScheduledMessage(phone, message, sendAt) {
  const parsedSendAt = parseSendAt(sendAt);

  const db = await getDb();

  const result = await db.run(
    "INSERT INTO scheduled_sms (phone, message, send_at) VALUES (?, ?, ?)",
    [phone, message, parsedSendAt]
  );
  console.log(`Scheduled message added with ID ${result.lastID} and sendAt ${parsedSendAt}`);
}

async function saveScheduledMessage(id, phone, message, sendAt) {
  const parsedSendAt = parseSendAt(sendAt);

  const db = await getDb();

  const result = await db.run(
    "UPDATE scheduled_sms SET phone = ?, message = ?, send_at = ? WHERE id = ?",
    [phone, message, parsedSendAt, id]
  );
  console.log(`Scheduled message saved with ID ${id} and sendAt ${parsedSendAt}`);
}

async function deleteScheduledMessage(id) {
  const db = await getDb();

  const result = await db.run(
    "DELETE FROM scheduled_sms WHERE id = ?",
    [id]
  );
  console.log(`Scheduled message deleted with ID ${id}`);
}

async function scheduleMessages() {
  const db = await getDb();

  const messages = await getScheduledMessagesBeforeTime();
  if( messages?.length !== 0 ) console.log(`\nFound ${messages.length} messages to send.`);

  for (const message of messages) {
    try {
      let parsedMessage = message.message;
      if (message.message.startsWith("ai:")) {
        const prompt = message.message.slice(3);
        parsedMessage = await generateMessage(prompt);
      }

      await sendSms(message.phone, parsedMessage, twilioFromNumber);
      await db.run("DELETE FROM scheduled_sms WHERE id = ?", [message.id]);

    } catch (error) {
      console.error(`Error sending message ${message.id} from ${message.phone}: ${error.message}`);
    }
  }
}

async function getScheduledMessages() {
  const db = await getDb();
  const messages = await db.all("SELECT * FROM scheduled_sms");
  // convert messages sendAt to js date
  messages.forEach(message => {
    message.sendAt = new Date(message.send_at * 1000);
  });

  return messages;
}

async function getScheduledMessagesBeforeTime(beforeTime) {
  const currentTime = Math.floor(Date.now() / 1000);
  const time = beforeTime || currentTime;

  const db = await getDb();
  const messages = await db.all("SELECT * FROM scheduled_sms WHERE send_at <= ?", [time]);
  return messages;
}


module.exports = {
  addScheduledMessage,
  scheduleMessages,
  saveScheduledMessage,
  deleteScheduledMessage,
  getScheduledMessages,
  getScheduledMessagesBeforeTime
};
