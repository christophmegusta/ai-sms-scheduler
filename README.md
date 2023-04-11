# sms scheduler

install node packages:
```
npm install
```

run server with
```
npm start server
```
access in browser with http://127.0.0.1:3000


run cli tool to send sms
```
npm start run
```

add messages to schedule with
```
npm start add --phone "+1234567890" --message "ai: write a friendly merry christmas message in 160 characters." --sendAt 
"2023-12-24 12:00:00"
```


Usage Instructions
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
