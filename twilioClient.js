require("dotenv").config();

const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const client = new twilio(accountSid, authToken);

const sendSms = (to, body, from, callback) => {
  console.log(`Attempting to send message to ${to}`);
  client.messages
    .create({
      body: body,
      to: to,
      from: from,
    })
    .then((message) => {
      console.log(`Message sent successfully to ${to} with SID ${message.sid} and content: ${body}`);
      callback(null, message);
    })
    .catch((error) => {
      console.error(`Failed to send message to ${to}`);
      callback(error, null);
    });
};

const startPhoneVerification = (phoneNumber, serviceSid, callback) => {
  client.verify
    .services(serviceSid)
    .verifications.create({ to: phoneNumber, channel: "sms" })
    .then((verification) => callback(null, verification))
    .catch((error) => callback(error, null));
};

const checkPhoneVerification = (phoneNumber, serviceSid, token, callback) => {
  client.verify
    .services(serviceSid)
    .verificationChecks.create({ to: phoneNumber, code: token })
    .then((verification_check) => callback(null, verification_check))
    .catch((error) => callback(error, null));
};

module.exports = {
  sendSms,
  startPhoneVerification,
  checkPhoneVerification,
};
