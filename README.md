# Little Sips Tracker

Little Sips is now a mobile-first web app for newborn feeding logs.

## Features

- Log feed time, milk amount in `ml`, and notes
- See daily total milk, total feeds, average feed, and last feed time
- Share a daily report
- Export and import backups
- Install the app on a phone home screen after hosting it online
- Offline support after the app has loaded once

## Files

- [index.html](./index.html)
- [styles.css](./styles.css)
- [script.js](./script.js)
- [manifest.webmanifest](./manifest.webmanifest)
- [sw.js](./sw.js)

## Share It Online

To make it truly shareable on mobile, upload the whole `feeding-tracker` folder to any static hosting service, such as:

- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

Once it has an `https://` link, you can:

- open it on a phone
- share the link with family
- install it to the phone home screen
- use the browser share sheet

## Data

Feed data is stored in the browser on each device. If you want to move data to a new phone, use `Export backup` and then `Import backup`.
