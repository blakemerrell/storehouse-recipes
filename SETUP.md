# Sharing one plan between two phones

Without this, the app saves everything in whatever browser you opened it in. Your
phone and your wife's phone keep separate favorites, separate weeks, separate lists.

This connects both phones to one shared record. It is free — nothing here approaches
the paid tier, and there is no card to enter.

Roughly five minutes.

---

## 1. Make a Firebase project

1. Go to **<https://console.firebase.google.com>** and sign in with your Google account.
2. **Create a project**. Name it anything — `storehouse-recipes` works.
3. It offers Google Analytics. Turn it **off**; you do not need it.
4. Wait for it to finish, then **Continue**.

## 2. Turn on the database

1. In the left sidebar: **Build → Firestore Database**.
2. **Create database**.
3. Pick a location near you (`nam5 (United States)` is fine). This cannot be changed later.
4. When it asks for a mode, choose **Start in production mode**. Step 4 sets the rules.

## 3. Turn on anonymous sign-in

This is what stops strangers from reaching the database. Neither of you makes an
account or types a password — the app signs itself in silently.

1. Left sidebar: **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Anonymous** → toggle **Enable** → **Save**.

## 4. Set the security rules

1. Back in **Firestore Database**, open the **Rules** tab.
2. Replace everything there with this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /households/{code} {
      allow get, create, update: if request.auth != null;
      allow list, delete: if false;
    }
  }
}
```

The split matters. `read` is two permissions wearing one name — `get`, which
fetches the one household whose code you typed, and `list`, which queries the
collection and hands back all of them. The app never lists: it asks for exactly
one document by its code and nothing else. Granting `list` therefore buys you
nothing and costs you the whole premise, because a household code stops being a
secret worth keeping the moment someone can ask for every code there is. And
anyone can ask — the app signs visitors in anonymously by design, so
`request.auth != null` is true for every person who opens the page.

`delete` is off for the same reason it is never used: nothing in the app removes
a household, so nothing should be allowed to.

3. **Publish**. Typing them is not enough — an unpublished rule is not in force.

> The same rules are kept in `firestore.rules` in this repository, so what is
> supposed to be live is reviewable rather than only remembered. If you would
> rather not use the console: `firebase login` once, then
> `firebase deploy --only firestore:rules` from the project folder does the
> same thing.

This says: only a signed-in app can touch the household records, and nothing else in
the database is reachable at all.

## 5. Copy your six values into the app

1. Click the **gear** next to *Project Overview* → **Project settings**.
2. Scroll to **Your apps** and click the **`</>`** (web) icon.
3. Nickname it anything. **Do not** tick "Firebase Hosting". → **Register app**.
4. It shows a code block containing `const firebaseConfig = { ... }`.
5. Open **`src/config.js`** in this project and copy each value across, keeping the
   quotes:

```js
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSy…",
  authDomain: "storehouse-recipes.firebaseapp.com",
  projectId: "storehouse-recipes",
  storageBucket: "storehouse-recipes.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abc123"
};
```

Save the file. If the app is online, push the change so both phones get it.

> These values are not secrets — every web app that uses Firebase ships them in
> plain sight, and they are safe in a public repository. The security rules in
> step 4 are what actually protect the data.

## 6. Pair the two phones

1. Open the app and tap **Local** in the top-right corner.
2. It offers a household code, something like `KETTLE-4827-ORCHARD`. Tap
   **Use this code**. The badge turns to **Synced**.
3. On the other phone, open the same link, tap the badge, type that same code into
   *Or type a code you already have*, and tap **Join**.

That is it. Favorites, every week you have planned, which one is showing, and the
shopping-list check-offs are now the same on both.

Whatever was already saved on the first phone seeds the shared record, so you do not
lose a week you had already planned. The second phone adopts the shared version.

---

## Worth knowing

**The code is the key.** There is no password. Anyone who has the household code can
see and change your meal plan and shopping list. Keep it between the two of you. What
is in there is a grocery list — no names, no addresses, no payment anything — so the
practical risk is small, but that is the honest description.

**It works without signal.** Changes made offline queue up and go out when the phone
reconnects. The badge reads *Offline* while it waits.

**Both editing at once is fine.** Adding a recipe to Tuesday touches only Tuesday, and
ticking off milk touches only milk, so you will not overwrite each other.

**To stop sharing on one device**, tap the badge → *Stop sharing on this device*. That
device keeps its current copy and stops sending changes; the other phone is untouched.

## If something goes wrong

**Badge says "Sync issue"** — open the panel and read the message underneath.

- *Firestore refused the connection* → step 3 or step 4 did not take. Check that
  Anonymous sign-in is enabled and that the rules were **published**, not just typed.
- *Could not start syncing* → usually no internet, or an ad-blocker blocking
  `gstatic.com`. The app keeps saving on the device either way.

**Badge stays "Local"** — `src/config.js` still has empty values, or the edited file
was not pushed to where the phone loads the app from.

**Nothing appears on the second phone** — check the code matches exactly, including the
hyphens. It is case-insensitive; the app upper-cases it for you.
