# ai sms scheduler

schedule sms messages and let ai (openai's chatgpt) write it.
by starting a message with "ai:" the program will treat the parts following the "ai:" as prompt for chatgpt and will send the generated output then. if the message does not start with "ai:" it will be sent as is without ai involvement.

to run this software the `npm start run` scheduler should be running in the background or `npm start run-once` must be frequently executed by a CRON job like every 5 minutes. this will check if there are any messages due and will send those.

messages can be scheduled manually in the CLI with `npm start add ...` or the webinterface at http://localhost:3000 (after setting up 
frontend repo https://github.com/christophmegusta/ai-sms-scheduler-frontend.git) can be used after 
starting the server with `npm start server`. the server command does *not* run the scheduler, this must still be done separately as explained above.


## Prerequesites and setup

install node packages and dependencies:
```
npm install
```

create .env file and fill the required values in
```
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_SERVICE_SID=#optional
OPENAI_API_KEY=
```


run server with
```
npm start server
```
access in browser with http://127.0.0.1:3000 if you did the next step.

optional: download web frontend and build it.
```
git clone https://github.com/christophmegusta/ai-sms-scheduler-frontend.git frontend
cd frontend
npm install
npm run build
cd ..
```
the application expects the built frontend files in public/ folder. its a symlink on linux/unix/mac but on windows this might not work. in that case copy files from frontend/dist/* to public/ after frontend was build in step above.


run cli tool to send sms
```
npm start run #in a loop
# or
npm start run-once #one time
```

add messages to schedule with
```
npm start add --phone "+1234567890" --message "ai: write a friendly merry christmas message in 160 characters." --sendAt 
"2023-12-24 12:00:00"
```


## Usage Instructions
```
Usage: node index.js <command> [options]

Commands:
  index.js add           Add a new scheduled SMS
  index.js run           Continuously check the schedule and send messages
  index.js run-once      Check the schedule and send messages once
  index.js start-verify  Start the phone verification process
  index.js check-verify  Check the verification token
  index.js server        Run the SMS Scheduler web app

Options:
      --version  Show version number                                   [boolean]
  -h, --help     Show help                                             [boolean]

Examples:
  node index.js add --phone "+1234567890"   Schedule an SMS
  --message "Hello, World!" --sendAt
  1672448399
  node index.js add --phone "+1234567890"   Schedule an AI-generated SMS
  --message "ai: write a friendly merry
  christmas message in 160 characters."
  --sendAt "2023-12-24 12:00:00"
  node index.js add --phone "+1234567890"   Schedule an SMS to send ASAP
  --message "Now its starting!" --sendAt
  "now"
  node index.js run                         Continuously check the schedule and
                                            send messages
  node index.js run-once                    Check the schedule and send messages
                                            once
  node index.js start-verify --phone        Start the phone verification process
  "+1234567890"
  node index.js check-verify --phone        Check the verification token
  "+1234567890" --token "123456"
```

## LICENSE as of 2023/04/12
do the fuck whatever you want with this code. if you make millions in revenues you might cut me some financial slack. appreciated.
quality of this code is alpha. i am not liable for any damages and compensations. use at your own risk!
check with all involved parties like openai if you are allowed to run this software the way you plan it to.
(so for example, if this code deletes your bitcoin wallet or formats your computer or someone gets mentally or physically hurt or dies or somebody like openai sues you for illegal usage, its your problem, not mine!)
