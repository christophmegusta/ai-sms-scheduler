require("dotenv").config();
const { parse } = require("date-fns");
const moment = require("moment");

const { getDb } = require("./db");
const { sendSms } = require("./twilioClient");
const { generateMessage } = require("./chatgptClient");

const twilioFromNumber = process.env.TWILIO_PHONE_NUMBER;

const RECURRING_SCHEME = {
  daily: {
    recurringDuration: { value: 1, unit: "days" },
    maxOccurrences: 365,
  },
  weekly: {
    recurringDuration: { value: 1, unit: "weeks" },
    maxOccurrences: 5 * 52, // 5 years in weeks
  },
  monthly: {
    recurringDuration: { value: 1, unit: "months" },
    maxOccurrences: 10 * 12, // 10 years in months
  },
  yearly: {
    recurringDuration: { value: 1, unit: "years" },
    maxOccurrences: 20, // 20 years
  },
};


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

async function addScheduledMessage(phone, message, sendAt, recurrence, timeWindow) {
  const parsedSendAt = parseSendAt(sendAt);

  const db = await getDb();

  const result = await db.run(
    "INSERT INTO scheduled_sms (phone, message, send_at, recurrence, time_window) VALUES (?, ?, ?, ?, ?)",
    [phone, message, parsedSendAt, recurrence, timeWindow]
  );
  console.log(`Scheduled message added with ID ${result.lastID} and sendAt ${parsedSendAt}`);
}

async function saveScheduledMessage(id, phone, message, sendAt, recurrence, timeWindow, occurrences) {
  const parsedSendAt = parseSendAt(sendAt);

  const db = await getDb();

  if(occurrences) {
    const result = await db.run(
      "UPDATE scheduled_sms SET phone = ?, message = ?, send_at = ?, recurrence = ?, occurrences = ?, time_window = ? WHERE id = ?",
      [phone, message, parsedSendAt, recurrence, occurrences, timeWindow, id]
    );
    console.log(`Scheduled message saved with ID ${id} and occurrences ${occurrences} and sendAt ${parsedSendAt}`);
  }
  else {
    const result = await db.run(
      "UPDATE scheduled_sms SET phone = ?, message = ?, send_at = ?, recurrence = ?, time_window = ? WHERE id = ?",
      [phone, message, parsedSendAt, recurrence, timeWindow, id]
    );
    console.log(`Scheduled message saved with ID ${id} and occurrences ${occurrences} and sendAt ${parsedSendAt}`);
  }
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

 const messages = await getScheduledMessagesBeforeTimeInRandomTimeWindow(null,5);
  if (messages?.length !== 0) console.log(`\nFound ${messages.length} messages to send.`);

  for (const message of messages) {
    try {
      let parsedMessage = message.message;
      if (message.message.startsWith("ai:")) {
        const prompt = message.message.slice(3);
        parsedMessage = await generateMessage(prompt);
      }

      await sendSms(message.phone, parsedMessage, twilioFromNumber);

      if (message.recurrence !== "once") {
        const { recurringDuration, maxOccurrences } = RECURRING_SCHEME[message.recurrence];

        if (message.occurrences < maxOccurrences) {
          if (recurringDuration) {
            const newSendAt = moment
              .unix(message.send_at)
              .add(recurringDuration.value, recurringDuration.unit)
              .unix();

            // Update send_at and occurrences for the next scheduled message
            await saveScheduledMessage(
              message.id,
              message.phone,
              message.message,
              newSendAt,
              message.recurrence,
              message.time_window,
              message.occurrences + 1
            );
          }
        } else if (message.occurrences >= maxOccurrences) {
          // Notify the user that the recurring message has reached its maximum occurrences
          // This could be implemented with a function like: notifyUserMaxOccurrencesReached(message)
          await deleteScheduledMessage(message.id);
        }
      } else {
        // Delete the scheduled message if it is set to 'once'
        await deleteScheduledMessage(message.id);
      }
    } catch (error) {
      console.error(`Error sending message to ${message.phone}:`, error);
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

async function getScheduledMessagesBeforeTimeInRandomTimeWindow(beforeTime) {
  const currentTime = beforeTime || Math.floor(Date.now() / 1000);

  const db = await getDb();
  const messages = await db.all(
    `SELECT *, ((ABS(random()) % 101) / 100.0) as R FROM scheduled_sms WHERE (send_at - (time_window * 60 * R)) <= ?`,
    currentTime
  );
  return messages;
}


module.exports = {
  addScheduledMessage,
  scheduleMessages,
  saveScheduledMessage,
  deleteScheduledMessage,
  getScheduledMessages,
  getScheduledMessagesBeforeTime,
  getScheduledMessagesBeforeTimeInRandomTimeWindow
};
