require("dotenv").config();
const { parse } = require("date-fns");
const moment = require("moment");
const mustache = require('mustache');

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

async function addScheduledMessage(phone, message, sendAt, recurrence, sendChance, timeWindow) {
  const parsedSendAt = parseSendAt(sendAt);

  const db = await getDb();

  const result = await db.run(
    "INSERT INTO scheduled_sms (phone, message, send_at, recurrence, send_chance, time_window) VALUES (?, ?, ?, ?, ?, ?)",
    [phone, message, parsedSendAt, recurrence, sendChance, timeWindow]
  );
  console.log(`Scheduled message added with ID ${result.lastID} and sendAt ${parsedSendAt}`);
}

async function saveScheduledMessage(id, phone, message, sendAt, recurrence, sendChance, timeWindow, occurrences) {
  const parsedSendAt = parseSendAt(sendAt);

  const db = await getDb();

  if(occurrences) {
    const result = await db.run(
      "UPDATE scheduled_sms SET phone = ?, message = ?, send_at = ?, recurrence = ?, occurrences = ?, send_chance = ?, time_window = ? WHERE id = ?",
      [phone, message, parsedSendAt, recurrence, occurrences, sendChance, timeWindow, id]
    );
    console.log(`Scheduled message saved with ID ${id} and occurrences ${occurrences} and sendAt ${parsedSendAt}`);
  }
  else {
    const result = await db.run(
      "UPDATE scheduled_sms SET phone = ?, message = ?, send_at = ?, recurrence = ?, send_chance = ?, time_window = ? WHERE id = ?",
      [phone, message, parsedSendAt, recurrence, sendChance, timeWindow, id]
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

  const messages = await getScheduledMessagesBeforeTimeInRandomTimeWindow();
  if (messages?.length !== 0) console.log(`\nFound ${messages.length} messages to send.`);

  for (const message of messages) {
    try {
      const now = new Date();
      const hit = Math.floor(Math.random() * 100);
      const chance = Math.floor(message.send_chance);

      const theMessage = mustache.render(message.message, {
        weekday:now.toLocaleString('default', { weekday: 'long' }),
        year:now.getFullYear(),
        month: String(now.getMonth() + 1).padStart(2, '0'),
        day:String(now.getDate()).padStart(2, '0'),
        hour:String(now.getHours()).padStart(2, '0'),
        minute:String(now.getMinutes()).padStart(2, '0'),
        second:String(now.getSeconds()).padStart(2, '0'),
        millisecond:String(now.getMilliseconds()).padStart(3, '0'),
        random: Math.floor(Math.random() * 1000000000) % 100,
        from: twilioFromNumber,
        to: message.phone
      });

      if(chance == 100 || (chance < 100 && hit < chance)) {
        let parsedMessage = theMessage;
        if (theMessage.startsWith("ai:")) {
          const prompt = theMessage.slice(3).trim();
          parsedMessage = await generateMessage(prompt);
        }
  
        await sendSms(message.phone, parsedMessage, twilioFromNumber);
      }
      else {
        console.log(`[${new Date().toLocaleString()}] Skipping message to ${message.phone} because of send chance not met (${chance} == 100 || (${chance} < 100 && ${hit} < ${chance})): ${theMessage}`);
      }

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
              message.send_chance,
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
      console.error(`[${new Date().toLocaleString()}] Error sending message to ${message.phone}:`, error);
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
