# FixReady

Mobile-first maintenance app for a fixed 62-room property (100-113, 200-222, 300-323 and 325).
Built for two people — the maintenance tech and the manager — who both see the same list, live.

## The workflow

The app opens straight to the list of maintenance reports. There's no sign-in and no role to pick.

1. **Report it.** Tap the round **+** at the bottom right. Pick the room (type any part of the
   number — `08` offers 108, 208 and 308) and write what's wrong.
2. **It appears in the list**, newest first, with open jobs always above finished ones.
3. **Work it.** Tap a report to open it. You can read the original problem, add photos from the
   camera or the photo library, and write down what you did and what tools and materials it took.
   **Save for later** keeps the notes without closing the job.
4. **Close it.** Tap **Mark complete**. The report turns green and drops below the open ones.
   Marked done by mistake? Open it again and tap **Reopen this ticket**.
5. **Export it.** The **Export** button in the header downloads an .xlsx of every report.

The two counts at the top are also the filter: tap **Open** to see only open jobs, tap it again to
go back to all.

## The spreadsheet

One row per report, grouped by room and oldest-first within each room, so it reads like a logbook:

| Room | Reported | Problem | Fix | Materials Used | Completed | Status | Photos |
| ---- | -------- | ------- | --- | -------------- | --------- | ------ | ------ |

Dates are written `2026-09-20 14:05` so the columns sort correctly, and the header row has Excel's
filter dropdowns switched on. Photos are counted rather than embedded — they stay in the app.

## Photos

Photos are shrunk on the phone to about 1024px on the longest edge before being saved, and each one
is stored as its own Firestore document. That's what keeps the app on Firebase's **free Spark
plan** — Cloud Storage would require a billing account. The practical ceiling is roughly 5,000
photos, which is far more than a 62-room property will produce.

A photo is never stored on the report itself, only counted there, so opening the list doesn't
download any images. They load when you open a report.

## Running it right now (demo mode)

```
npm install
npm run dev
```

With no Firebase config present the app runs in **demo mode** and stores everything in that
browser's `localStorage`. Nothing syncs between phones — it's just there so you can click through
the interface before setting up a backend. Note that browsers cap local storage at around 5MB, so
demo mode runs out of room after a handful of photos.

## Making it real (Firebase setup)

You have to do these steps yourself since they're tied to your Google account.

1. **Create the project** — go to the Firebase console and create a new project. The free Spark
   plan covers everything this app uses.
2. **Add a Web app** to the project. Copy the config values it shows you.
3. **Enable Firestore** (start in production mode) and **enable Anonymous authentication** under
   Authentication → Sign-in method.
4. **Fill in your env file**:
   ```
   cp .env.example .env.local
   ```
   Paste in the values from step 2.
5. **Deploy the rules** in `firestore.rules`:
   ```
   npx firebase deploy --only firestore:rules
   ```

## Data model

```
tickets/{ticketId}
  room         "214"
  problem      what's wrong, written when the report is made
  reportedAt   ms since epoch
  status       "open" | "complete"
  fix          what was done about it
  materials    parts, materials and tools used
  completedAt  ms since epoch, or null
  photoCount   how many photos the subcollection holds

tickets/{ticketId}/photos/{photoId}
  dataUrl      compressed JPEG, capped at 700KB
  createdAt    ms since epoch
```

Times are written by the phone rather than by the server. `serverTimestamp()` reads back as null
until the write confirms, which would drop a just-created report to the bottom of the list on the
phone that made it.
