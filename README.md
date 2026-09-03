# FixReady

Mobile-first maintenance app for a fixed 62-room property (100-113, 200-222, 300-323 and 325).

On open, the app asks who's using the device:

- **Front Desk** — a read-only board showing the maintenance status of every room.
- **Maintenance** — the same board, but tapping a room lets you set its status.

Statuses are **Needs Repair** (yellow), **Out of Service** (red), and **Operational** (green). Every
phone sees a change instantly. Tap **Switch** in the header to change roles.

## Finding a room

Rooms are grouped into collapsible **floor sections**, closed by default. Each floor header shows how
many rooms it holds and a colored count per status, so the board fits on one screen without scrolling.

The **search box** filters as you type, and each digit narrows the list: `21` → 121 and 210-219;
`214` → one room. It matches the digits anywhere in the room number, so `14` finds 114, 214, and 314.
Non-digits are ignored.

The three **counters at the top are the status filter**: tap "Out of Service" to see only those rooms,
tap it again to go back to all. Searching or filtering opens every floor automatically, so a match is
never hidden inside a collapsed section.

## Running it right now (demo mode)

```
npm install
npm run dev
```

With no Firebase config present the app runs in **demo mode**: it seeds all 62 rooms and stores
everything in that browser's `localStorage`. Nothing syncs between phones — it's just there so you
can see and click through the interface before setting up a backend.

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
5. **Deploy the rules and the site**:
   ```
   npm install -g firebase-tools
   firebase login
   firebase use --add          # select your project
   npm run build
   firebase deploy
   ```

## How access works

- There is no passcode. Anyone with the URL reaches the board, picks a role, and — for
  maintenance — enters a name before making changes.
- The access boundary is `firestore.rules`, which requires an authenticated (anonymous) session.
- If you later want real accountability — knowing which specific technician did what, and being
  able to revoke one person's access — swap anonymous auth for per-user email/password accounts.
  The UI already records a name with each change; it's just self-reported today.


## The room list

The 62 rooms are fixed in code — there is no add or remove room in the UI. The first time the app
connects to an empty Firestore project it creates the missing room documents (one per number, using
the room number as the document ID) and marks them Clean. Anything else in the `rooms` collection is
ignored.

To change the property's room list, edit `ROOM_NUMBERS` in `src/types.ts`; new numbers get created
on the next load. Numbers you removed are left behind in Firestore as documents the app filters out
— clear them with the one-off cleanup script:

```sh
node scripts/prune-rooms.mjs           # dry run: lists what would be deleted
node scripts/prune-rooms.mjs --delete  # actually deletes them
```

It uses the same `.env.local` config as the app and signs in anonymously, so it needs no
service-account key. Run it only once every client has picked up the new build — a stale cached
client still holding the old list would re-create the numbers you just removed.

## Maintenance history and Excel export

Every save is recorded as a dated entry in a per-room, append-only history rather than overwriting the
room's last note. Opening a room shows its full history below the form (newest first), and the room's
latest entry is what appears on the board.

- In **Firebase mode** each entry is a document in the room's `log` subcollection (`rooms/{room}/log`).
  The room document still holds the current status so the board stays a single fast listener; the
  subcollection holds the history.
- In **demo mode** the history lives alongside the rooms in `localStorage`.

Tap **Export** in the header to download the whole property's history as a real `.xlsx` file — one row
per entry, with columns for the room, date, status, issue, material used, fix, and who made the change.
The file is built in the browser (no backend needed, works in demo mode too) and is always current at
the moment you export.

> The export uses SheetJS (`xlsx`) to write the file. The library is loaded only when you tap Export, so
> it stays out of the initial download. Note: this pinned version carries published advisories, but they
> are all in the file-**parsing** path — the app only ever **writes** files, never reads them — so they
> don't apply here. To clear `npm audit` anyway, install the maintained build from SheetJS's own CDN:
> `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`.

## Project layout

```
src/
  App.tsx                 role routing, search, floor grouping, filters, summary counts, export
  firebase.ts             SDK init, anonymous sign-in
  localStore.ts           demo-mode persistence (rooms + history)
  exportXlsx.ts           builds the .xlsx download from the history
  types.ts                Room, RoomStatus, RoomDetails, LogEntry, the fixed ROOM_NUMBERS list
  hooks/useRooms.ts       Firestore subscription, status writes, history reads
  components/             RoomCard, FloorSection, StatusSheet, RolePicker, NameGate
firestore.rules           access rules
```
