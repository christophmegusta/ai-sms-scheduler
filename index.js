require("dotenv").config();
const twilioFromNumber = process.env.TWILIO_PHONE_NUMBER;
const twilioServiceSid = process.env.TWILIO_SERVICE_SID;

const yargs = require("yargs");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const { sendSms } = require("./twilioClient");
const { generateMessage } = require("./chatgptClient");
const { parse } = require("date-fns");

const parseSendAtInput = (sendAt) => {
  if (sendAt === "now") {
    return Math.floor(Date.now() / 1000);
  }

  if (/\d{10}/.test(sendAt)) {
    return parseInt(sendAt, 10);
  }

  try {
    const parsedDate = parse(sendAt, "yyyy-MM-dd HH:mm:ss", new Date());
    return Math.floor(parsedDate.getTime() / 1000);
  } catch (error) {
    console.error("Invalid sendAt input format. Please use a Unix timestamp, 'now', or 'yyyy-MM-dd HH:mm:ss' format.");
    process.exit(1);
  }
};

const setupDb = async () => {
  const db = await open({
    filename: "sms-scheduler.db",
    driver: sqlite3.Database,
  });

  await db.exec(
    `CREATE TABLE IF NOT EXISTS scheduled_sms (id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, message TEXT, send_at INTEGER)`
  );

  return db;
};

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

yargs
  .usage("Usage: $0 <command> [options]")
  .command("add", "Add a new scheduled SMS", {
    phone: {
      describe: "Phone number to send the SMS",
      demandOption: true,
      type: "string",
    },
    message: {
      describe: "Message to send (use 'ai:' prefix for AI-generated messages)",
      demandOption: true,
      type: "string",
    },
    sendAt: {
      describe: "Unix timestamp to send the message or 'now' or in date format like 2023-12-24 12:00:00",
      demandOption: true,
      type: "string",
    },
  })
  .command("run", "Continuously check the schedule and send messages")
  .command("run-once", "Check the schedule and send messages once")
  .command("start-verify", "Start the phone verification process", {
    phone: {
      describe: "Phone number to verify",
      demandOption: true,
      type: "string",
    },
  })
  .command("check-verify", "Check the verification token", {
    phone: {
      describe: "Phone number to verify",
      demandOption: true,
      type: "string",
    },
    token: {
      describe: "Verification token received via SMS",
      demandOption: true,
      type: "string",
    },
  })
  .example("node $0 add --phone \"+1234567890\" --message \"Hello, World!\" --sendAt 1672448399", "Schedule an SMS")
  .example("node $0 add --phone \"+1234567890\" --message \"ai: write a friendly merry christmas message in 160 characters.\" --sendAt \"2023-12-24 12:00:00\"", "Schedule an AI-generated SMS")
  .example("node $0 add --phone \"+1234567890\" --message \"Now its starting!\" --sendAt \"now\"", "Schedule an SMS to send ASAP")
  .example("node $0 run", "Continuously check the schedule and send messages")
  .example("node $0 run-once", "Check the schedule and send messages once")
  .example("node $0 start-verify --phone \"+1234567890\"", "Start the phone verification process")
  .example("node $0 check-verify --phone \"+1234567890\" --token \"123456\"", "Check the verification token")
  .help()
  .alias("help", "h").argv;

const argv = yargs.argv;

if (argv._.includes("add")) {
  const parsedSendAt = parseSendAtInput(argv.sendAt);
  addScheduledMessage(argv.phone, argv.message, parsedSendAt);
}

if (argv._.includes("run")) {
  setInterval(scheduleMessages, 60 * 1000); // Check every minute
}

if (argv._.includes("run-once")) {
  scheduleMessages();
}

if (argv._.includes("start-verify")) {
  const { startPhoneVerification } = require("./twilioClient");
  startPhoneVerification(argv.phone, twilioServiceSid, (err, verification) => {
    if (err) {
      console.error("Error starting phone verification:", err);
    } else {
      console.log(`Verification token sent to ${argv.phone}`);
    }
  });
}

if (argv._.includes("check-verify")) {
  const { checkPhoneVerification } = require("./twilioClient");
  checkPhoneVerification(argv.phone, twilioServiceSid, argv.token, (err, verification_check) => {
    if (err) {
      console.error("Error checking verification token:", err);
    } else if (verification_check.status === "approved") {
      console.log("Phone number verification successful");
    } else {
      console.log("Phone number verification failed");
    }
  });
}