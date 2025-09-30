# Web server

This contains the code for my web server hosted at home. Originally written for [Elimination](https://orbiit.github.io/elimination/), this is now a monorepo providing backend services for various little-used projects, involving probably like 3 or 4 different databases.

The server used to run 24/7 on my mom's old laptop, but it was prone to shutting down when someone closed the lid. For the past 5-ish years, my server now runs on a Windows mini PC with 4 GB RAM. It has decent uptime, except for when our home IP address changes (infrequently) or Palo Alto surprises us with a blackout (happens more often than it should).

It was a pain to get the server running reliably in the first place, and I dread having to touch any part of this shit. The server is a ticking time bomb because I have performed no backups beyond copying some JSON files into a different folder on the same machine. Eventually, I plan on winding down this web server, but I would first like to provide a static archive for the frontend projects that rely on this server.

## Development

```bash
# Starts server locally at http://localhost:3000/
npm start

# Starts server for production (aggressively restarts when stops)
npm run serve

# Lint using StandardJS
npm test
```

Local server is available at http://localhost:3000/

### Help. Something broke.

Shockingly I left very little detail about how the server is hosted on my mini PC, granting me an opportunity to rediscover it all each time. That stops now.

In the Task Scheduler app, under "Task Scheduler Library," you can find "Epic Auto Server Start" at the top of the list. Yep, that's the web server. You can end and run it in the right sidebar. In the Actions tab, you can see what command it runs. It runs the action "Start a program," with the program `"C:\Program Files\Git\git-bash.exe"` and arguments `--cd="C:\Users\seant\Documents\web-server" -c "npm run serve >> public/stdout.txt 2>> public/stderr.txt"`.

If I recall, I've made many attempts to add logging to the server manually by piping them into text files in public/, but it's still a pain to figure out what errors makes the server crash. Good luck.
