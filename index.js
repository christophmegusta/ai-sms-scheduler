require("dotenv").config();
const yargs = require("yargs");

const { startServer } = require("./server");
const { addScheduledMessage, scheduleMessages } = require("./smsScheduler");
const { setupDb } = require("./db");

const twilioServiceSid = process.env.TWILIO_SERVICE_SID;


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
  .command("server", "Run the SMS Scheduler web app")
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

setupDb();

if (argv._.includes("add")) {
  addScheduledMessage(argv.phone, argv.message, argv.sendAt);
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

if (argv._.includes("server")) {
  startServer();
}
