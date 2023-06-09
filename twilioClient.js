require("dotenv").config();
const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const DRY_RUN = process.env.DRY_RUN === "1";


const client = new twilio(accountSid, authToken);

const sendSms = (to, body, from, callback) => {
  if( DRY_RUN == 1 ) {
    console.log(`DRY_RUN: Message sent successfully to ${to} and content: ${body}`);
    return null;
  }

  return client.messages
    .create({
      body: body,
      to: to,
      from: from,
    })
    .then((message) => {
      console.log(`[${new Date().toLocaleString()}] Message sent successfully to ${to} with SID ${message.sid} and content: ${body}`);
      if(callback) callback(null, message);
    })
    .catch((error) => {
      console.error(`[${new Date().toLocaleString()}] Failed to send message to ${to}`);
      if(callback) callback(error, null);
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
