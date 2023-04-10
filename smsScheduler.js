const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const { parse } = require("date-fns");

const { setupDb } = require("./db");
const { sendSms } = require("./twilioClient");
const { generateMessage } = require("./chatgptClient");

const twilioFromNumber = process.env.TWILIO_PHONE_NUMBER;

const addScheduledMessage = async (phone, message, sendAt) => {
  const db = await setupDb();
  const result = await db.run(
    "INSERT INTO scheduled_sms (phone, message, send_at) VALUES (?, ?, ?)",
    [phone, message, sendAt]
  );
  console.log(`Scheduled message added with ID ${result.lastID} and sendAt ${sendAt}`);
};

const scheduleMessages = async () => {
  console.log("Checking for scheduled messages...");
  const db = await setupDb();
  const currentTime = Math.floor(Date.now() / 1000);
  const messages = await db.all("SELECT * FROM scheduled_sms WHERE send_at <= ?", [currentTime]);

  if (messages.length === 0) {
    console.log("No messages to send at this time.");
  } else {
    console.log(`Found ${messages.length} messages to send.`);
  }

  for (const message of messages) {
    if (message.message.startsWith("ai:")) {
      const prompt = message.message.slice(3);
      generateMessage(prompt, (err, aiMessage) => {
        if (err) {
          console.error(`Error generating AI message for ${message.phone}:`, err);
          return;
        }

        sendSms(message.phone, aiMessage, twilioFromNumber, (err, result) => {
          if (err) {
            console.error(`Error sending AI message to ${message.phone}:`, err);
          } else {
            console.log(`AI message sent to ${message.phone}`);
          }
        });
      });
    } else {
      sendSms(message.phone, message.message, twilioFromNumber, (err, result) => {
        if (err) {
          console.error(`Error sending message to ${message.phone}:`, err);
        } else {
          console.log(`Message sent to ${message.phone}`);
        }
      });
    }
    await db.run("DELETE FROM scheduled_sms WHERE id = ?", [message.id]);
  }
};

module.exports = {
  addScheduledMessage,
  scheduleMessages,
  getScheduledMessages: async () => {
    const db = await setupDb();
    const messages = await db.all("SELECT * FROM scheduled_sms");
    return messages;
  },
};

