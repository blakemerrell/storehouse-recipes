# Hive & Hearth Recipes

271 recipes from the storehouse, in two volumes, plus a third that starts empty and
fills with your own — browse them, plan a week, let the shopping list build itself,
and print the lot as a real half-letter book. It works with no signal.

Built from the Claude Design prototype in `design/`.

## Opening it

Double-click `index.html`. That is the whole thing — no install, no build step, no
server. It works with no internet connection once the page has loaded.

To put it on your phones, see **Putting it online** below.

## What is in it

**Recipes** — all 271 of them, filtered by book, section, effort, whether they need
anything beyond standard storehouse items, or your favorites, and ordered by book,
healthiest first, most protein or quickest. Search covers dish names, ingredients
and section names. Tap a card for the full recipe, where you can
scale the ingredients from ¼× to 8× (fractions come out as fractions, not decimals).

**Write a recipe** — yours go in a third volume, *Ours*, which does not exist until
you put something in it. Name it, list the ingredients a line at a time and the method
a step at a time, and it behaves like any of the 271: browse it, favorite it, plan it,
shop from it, print it. Its calories, sodium, fiber and score are worked out from the
ingredients as you type, by the same code that measured the printed books.

**Edit** on any printed recipe stores your change beside the book rather than in it,
so the original is never lost and one button puts it back. Fix a temperature, correct
a quantity, rename a dish to what you actually call it.

**Meal Plan** — assign recipes to days of the week from any recipe's panel. There are no
dates: Monday is a slot, not a date, and whatever is in it stays until you take it out or
press *Clear week*. Nothing resets on its own.

Keep as many weeks as you like — *+ Week* starts an empty one, *+ Copy* takes the plan
you are looking at into a new one, and the strip along the top switches between them
with the number of recipes in each. Rename them for what they are (*Fast week*,
*Thanksgiving*, *The one she likes*) and rotate through them instead of building a
week from nothing every Sunday. Each week carries its own shopping list, and switching
week moves every phone together, so nobody is shopping off a different list.

**Shopping List** — builds itself from the week showing, one line per thing, split into
what comes from the storehouse and what you need to buy. A diced apple and a sliced
apple are apples; three recipes wanting a cup, a cup and two tablespoons of cottage
cheese ask for 2⅛ cups, not for all three separately. Seasonings get a name and no
number, because nobody shops for two teaspoons of salt. Check-offs stick for as long as
the item is on the list; take the recipe out of the week and its tick is forgotten, so
an item never comes back to a later list already ticked. Ticks belong to their own
week, so shopping for one does not tick things off in another.

**Strengthen** (the tab was called Train) — a lifting block, the log you keep at the gym, and a review of it. It is
three ideas in one tab:

- *The block* is Renaissance Periodization's mesocycle. Pick two to six days, your kit
  (full gym, barbell and dumbbells, or dumbbells only), how long you have lifted and
  up to three muscles to bring up, and it builds a split — full body, upper/lower,
  push/pull/legs — that trains every major muscle twice a week. Week one starts each
  muscle near RP's MEV; after each session you rate the pump and the workload, and at
  the next session for that muscle you say how it healed. Those answers add up to
  next week's sets by a written-down rule (`feedback()` in `src/train.js`): usually one
  more, two if the muscle is asking for it, none or one fewer if you are not
  recovering, held outright if you are still sore, your joints hurt or you got
  measurably weaker, and never past RP's MRV. Reps in reserve step 3, 2, 1, 0; the
  last week is a deload at half the sets. Weights follow double progression: reach the
  top of the rep range and the next session adds the smallest jump the kit allows.
- *The logger* is Strong's. Each set shows what you did last time; empty boxes show
  the target, and ticking a set with them empty takes it. Ticking starts a rest timer
  (three minutes on compound lifts, ninety seconds on isolation, both changeable)
  that beeps and buzzes when it runs out and survives the screen locking. There is a
  warm-up ramp, a plate calculator, swap and add, records as they fall, and the screen
  stays awake while a workout is open. A swap in a block is *just today* (the machine is
  taken) or *the rest of the block*; exercises move up and down, a pair as one; a note on
  an exercise ("seat 4") comes up every time it does, and a workout takes a note at Finish.
  Turn it on and every set has a reps-in-reserve box, which the review then grades against
  what the plan asked. A saved workout can be edited — weights, reps, sets in or out, an
  exercise forgotten — and records, charts and next week's weights follow the correction.
  The foot of the screen holds when you started (tap to change it), the running time and
  Finish, with the rest timer on top of it while you rest; Finish lets you set the end time
  too, and a saved workout's date and times can be edited, so it exports at the hour it
  happened. A saved workout copies as text (the date, the times, every set), and Nourish's
  copy of the day names the day's workouts with their times. Barbell and Smith lifts draw
  the plates for each side where Previous is — in every set, or only in the set you are
  typing and the next one to do — on a bar each lift remembers (an EZ bar, a Smith machine). The back check asks "How's your
  back today?" and folds away once answered. Tap a set's number to make it a warm-up (W),
  a drop set (D) or a set to failure (F): warm-ups are never records or targets and rest a
  minute, a drop set follows with no rest, a failure set counts as nothing in reserve. Bars
  are named (Olympic 45, Short 33, EZ 15, Hex 75, Smith, none, or your own) and the plates
  are drawn in competition colours. Each lift can keep its own rest, drawn between its sets.
  Once a working set is done, a badge beside the lift says how today compares, set for set
  with the same sets last time (never -100% before you start), or with the plan in a deload
  or wherever the plan asked for less: the change in volume, or tap for the volume, the reps
  or the best set's estimated max; each lift remembers its choice, and bodyweight lifts show
  their reps. Settings can turn it off.
- *Ready workouts:* beside "Just log a workout", *Pick a ready workout* lists the blocks' own
  days (Full Body A/B/C, Upper and Lower A/B, Push, Pull, Legs), filled for your equipment,
  back and joints, preferring lifts you already do, with the weights from what you last
  lifted. A *30 minutes* switch keeps the big lifts first at two sets each. Open one and it
  lists every lift and asks *how hard today*: Easy (a set fewer, 3 in reserve), Normal (3
  sets, 2 in reserve) or Hard (a set more, 1 in reserve); a tap starts it. *Next up* follows
  the rotation (Full Body B after A). It is saved like any workout and never starts or
  moves a block. Any finished workout can be kept with *Save as routine* (its lifts in
  order with the sets you did); routines sync, appear under *Your routines*, and delete
  with two taps.
- *Warm-ups and safety nets:* the warm-up sheet ramps to the heaviest working set (more,
  smaller steps before heavy triples; no empty-bar set before a pull from the floor) and
  can add the ramp to the log as W sets. Removing a lift that has done sets asks twice.
  Settings says whether your training is only on this phone or saved to your account, and
  a save that fails is shown and retried rather than dropped silently.
- *For the serious lifter:* a set can be marked *Missed* (M) — an attempt that didn't go
  up: its weight is kept with the reps you got (0 if none), shown in history, and never a
  record, volume, target or hard set. *Assisted Pull-Up* and *Assisted Dip* take the
  machine's help as the weight: your strength is you less the help (from your weigh-ins),
  less help is the progression, and help is never a heaviest or volume. *Sumo* and
  *Trap-Bar Deadlift* are in the library (trap bar on the hex bar); none of the four is
  ever picked for a program on its own. Effort can be logged as reps in reserve (the
  default) or as RPE by half steps (Settings → Effort on each set); it is stored as
  reps in reserve either way (RPE 8 = 2). *Export as a spreadsheet* writes every set as a
  CSV in Strong's columns (plus RPE, RIR, set type and your weight), which *Bring in from
  Strong* reads back.
- *A lifetime of workouts:* signed in, workouts are kept in the account one record per
  calendar year (`users/{uid}/train/2026`), each far inside Firestore's 1 MB a record,
  so the history has no ceiling; everything else stays in the one record. It needs the
  `users/{uid}/train/{year}` rule in `firestore.rules` published (SETUP.md, step 4).
  Until it is, the app keeps everything in the one record as before and Settings says
  so; once it is, it copies each workout to its year and only then takes it out of the
  one record. A session's first push sends only workouts newer than their year holds.
  Deleting the account deletes every year's record first. Imports (Strong, or a
  restored copy) that would overfill a record, or the phone, are refused with the
  reason, and a phone whose storage is full says so instead of dropping changes.
- *New to lifting:* answering *New, or under a year* (or tapping *I'm new — choose for me*
  on the first question) gets one program, Start here, with the rest a tap away, and
  exercises that are easy to learn first: machines, dumbbells and a pulldown before
  barbells and pull-ups, two feet before one. The first workout opens with a short card
  on how a workout goes. A lift never done says how to find a starting weight, a barbell
  bench or squat says to set the safety bars first, and *How to do it* opens the lift's
  steps, with a YouTube search when there's no link of your own. The words are plain
  (*stop with 2 reps to spare*, *Last time*, *Front of thighs*, *Total lifted*), a changed
  weight says why, a tick with nothing to go on says what to type, and the Next card
  says when today's muscles are better rested a day. The review wants three sets a muscle
  only where the plan does, and a joint rated *hurting* says to stop and see someone.
- *Bodyweight lifts:* pull-ups, chin-ups, negatives and dips count you as well as anything
  added. Your weight is the week's average when there are three or more weigh-ins in the
  seven days to the workout, else that day's weigh-in, else the latest in the fortnight
  before (the day's weight is kept with the workout). Only when a workout has one of these
  lifts and there's no week to average and no weigh-in today does it ask *What do you weigh
  today?*: saved, it becomes today's weigh-in on Nourish (through Nourish's own guard, never
  over a day already weighed) and syncs; *Use* the last weigh-in or *Not now* write nothing,
  and *Don't ask again* (or Settings) stops the question. Their estimated max, records and lift-page
  charts use it, with *strength × bodyweight* beside, so a lighter you doing the same reps
  isn't shown as weaker; the badge beside the lift keeps to reps. With no weigh-in, they
  are counted in reps as before.
  Saving a workout opens its summary: the time, sets, volume and records, each set that
  beat a record tagged 🥇 (only the day's best set takes each one), and a milestone when
  there is one (the 10th workout, a block finished). A chime and confetti mark every
  workout, more of both for a record; none of the confetti for a phone set to reduce
  motion, and Options can turn both off. Finishing a workout ticks "trained today" on
  Nourish.
- *The review* holds the last seven days against the research, as rules rather than
  opinions: weekly hard sets per muscle against the 10–20 band, how often each muscle
  is trained, reps per set against 5–30, rest measured from the gap between ticks,
  and whether each lift's estimated max is climbing or has slid two sessions running.
  Every line names its source, the sources are listed in full, and it says what it
  cannot see — how close to failure you went, unless you log it, and anything about
  sleep or food.

It starts with **seven quick questions** — what you train for (muscle, strength, both, keeping
what you have, losing fat, or just feeling better), how long you have lifted, days and
minutes, your equipment (a gym, a barbell, dumbbells, or nothing), anything to look after
(your back, and neck, shoulder, elbow, wrist, hip, knee or ankle), what your days are like
(a desk, on your feet, physical work) and what you do outside the gym, and an optional age
range. It does not ask whether you are a man or a woman: both gain muscle at about the same
relative rate (Roberts 2020), so no program would change. Then it shows **three programs
picked for you**, each with the rules that put it there and the ones that count against it,
and a library of all nine: *Start here* (full-body basics for beginners, ACSM 2009), *Build
muscle* (RP-style), *Bring up a body part* (chest, back, shoulders, arms, glutes or legs
first and hardest, the rest held near maintenance), *Strength waves* (in the style of the
Juggernaut Method: a training max per lift, four-week waves of tens, eights, fives and
threes ending in one all-out set that moves the max), *Powerbuilding* (a heavy top set and
back-offs, then RP-style accessories), *Strength & conditioning* (in the style of CrossFit:
a few strength sets, then an AMRAP, EMOM or rounds-for-time circuit with a clock that calls
the minutes, and the same circuit back next week as the score to beat), *Lean & strong* (for
a fat-loss phase: a lower volume roof, one set at a time, a rep short of failure), *Keep
strength*, and *Home & bodyweight* (exercises that climb a ladder — incline push-up to
archer, negative to pull-up — when the top of the rep range comes easily). Each names the style it borrows from; none
claims to be anybody's program. Your life moves it too, and the draft says how: a sport
that works the legs hard or a physical job starts those sets lower, past sixty keeping uses
three sets rather than two, and a beginner at home starts a rung down.

It builds around you, not a template. Say you want to **keep your strength** rather than
build more and it switches to maintenance: full body two or three days a week, three sets
of the big movements about two reps short of failure, no climbing volume and no deload —
strength that has been built held for months on a fraction of the training that built it
(Bickel 2011; Spiering 2021). Give it **your minutes** and it pairs exercises for different
muscles so one rests while the other works, trims sets to fit, and never adds a set that
would not. Tell it what **sets your back off** — bending forward, weight on the spine,
arching — and every exercise is tagged for the load it puts through the lower back:
the ones that load it your way are left out (no deadlifts, back squats, bent-over rows or
crunches for a back that hates bending), the ones that load it a little carry a cue, every
session opens by asking how your back is, and anything you swap out can go on a never
list. Joints work the same way. **Anything outside the gym** — golf, walks, a run, soccer,
basketball, swimming, hiking, or something you name yourself — is one tap to log, marked
light, moderate or vigorous, and counts toward the WHO's 150 minutes a week in the review,
a vigorous minute twice. **Every day?** Seven days a week is six lifting days and an *easy
day*: a walk, a ride, a swim or your golf, logged in a tap and counted as that day of the
block.

History lists every workout with its time of day. Each lift has its own page, laid out as
Strong's is: About (three short how-to steps for every lift in the library, what it trains,
its bar and rest, a how-to link of your own, and a slot for a picture or clip), History
(every session with an estimated max for each working set), Charts (estimated max, heaviest
set, volume) and Records (the heaviest you have lifted for 1 to 12 reps beside what your
best estimated max says, and the records as they fell). Workouts are yours rather than the household's: they save on the device,
and travel with your account when you sign in, in the same record as Nourish. Settings
has kilograms, bar weight, rest times, export and restore of the whole log as a file, and
**Bring in from Strong**: Strong's CSV export comes in as history — each lift matched to the
library where it is the same lift on the same kit, the rest brought in as your own with
their muscle guessed for you to check, warm-ups kept as warm-ups, RPE turned into reps in
reserve, and as much as fits beside Nourish in the account's 1 MB.

**The printed book** (opened with *Print the book* on Recipes; it used to be a tab) — half-letter (5.5 × 8.5 in), printed as **two volumes**: Run and Not Be Weary is 52
pages, Around the Table is 116, and *Ours* joins them once it has anything in it. Each volume opens with a cover, four pages of front matter
(how to read a recipe, temperatures and doneness, weights and swaps, what the storehouse
carries) and its own contents, then is numbered from page one. Front matter carries no
folio, so adding recipes never shifts the numbering.

Each section of *Around the Table* opens on a full page of its own: an engraving,
the section name, and the note that section carries. Those pages sit outside the
numbering the way the front matter does — a reader turns past them, but they
neither carry a folio nor advance one, so the contents still points where it says.
A section finds its picture by slugifying its own name, so putting a file in
`art/src` named for a section and running `npm run art` is the whole of adding
one. Eight of the fourteen sections have one; Warm Drinks and Made, Not Bought were
added later and open on their heading alone until somebody draws them a picture.

Recipes are measured in the browser and packed two or three to a page, so a page
holds as many as genuinely fit rather than a fixed number. A recipe is never split
across a page and a section heading never sits alone at the foot of one. Leftover room
is shared between the recipes on a page up to about a quarter-inch a gap; past that it
stays at the foot, because a page holding two recipes has more room than it can spend
without looking sparse. Three sections — the long-recipe ones — open with a title page,
because a 71-point heading and a 639-point recipe will not share a 666-point page and
a heading alone at the top of a blank one looks like a mistake.

Two of the 271 recipes are taller on their own than a page's text area, and there is
nowhere to move them to. Those two pages are set about three percent smaller so that
they fit, rather than having the bottom of the page quietly cut off — which is what a
printed page, being a fixed 7.5 inches with the overflow hidden, does otherwise.

Every page is checked by `tests/print.test.js`: nothing spills, nothing is stranded, and
nothing runs past the bottom of the paper.

You can also print just one volume, just your favorites, or just this week.

Each volume opens on a cover and a title page and closes on a back cover that lists its
sections, and each is padded with blanks to a whole number of folded sheets — 52 pages
for Run and Not Be Weary, 116 for Around the Table.

**In the app, use Download PDF.** The finished books are rendered ahead of time and ship
with the app, so a printable file at exactly 5.5 × 8.5 in is one click, with no print
dialog to argue with about paper size, margins, headers or scaling. *Booklet PDF* beside
it is the same book imposed for folding. The *Print…* button is still there for the
selections that cannot be made ahead of time — your favorites, this week, and your own
recipes.

To regenerate them after changing a recipe or the food table:

```sh
npm run print                      # both volumes, and each on its own
node tools/print-books.js 1        # just Run and Not Be Weary
```

That writes two files per volume into `print/`, which **are committed** — the app links
to them. `tests/pdfs.test.js` fails if they fall behind the recipes, so a stale book
cannot quietly reach a printer:

- **`Run-and-Not-Be-Weary.pdf`** — reading order, half-letter. This is the one to give a
  print shop; they impose it themselves.
- **`Run-and-Not-Be-Weary-booklet.pdf`** — the same book imposed two-up on letter paper,
  landscape, in saddle-stitch order. Print it **double-sided, flipping on the short
  edge**, fold the stack in half and staple the spine. The fold on a landscape sheet
  runs down the middle, so a short-edge flip is the one that puts page 2 behind page 1
  rather than upside down under it.

Run and Not Be Weary is 13 sheets, which staples comfortably. Around the Table is 29, which is
thick for a saddle stitch — worth asking a print shop for perfect binding or a coil
instead.

The service worker deliberately does not keep them on your phone: five megabytes of PDF
is the wrong five megabytes to carry into a shop.

The last five sections of Around the Table were written for this edition rather than
carried over, 41 recipes in all:

- **Worth the Afternoon** — bread, braises and custards. The original 225 had nothing that
  asked you to actually cook: no recipe had more than four steps, none used yeast, none
  kneaded, braised, tempered an egg or thickened a sauce. These do.
- **The Copycat Shelf** — the restaurant versions, worked out from storehouse staples.
- **For the Love of Chocolate** — the original books had 25 "chocolate" recipes and almost
  all were protein shakes or cake-mix shortcuts. There was not one cookie in the whole
  collection, and chocolate chips appeared in a single recipe.
- **Warm Drinks** — every high-protein drink in Volume One runs on whey or Crio Bru and
  the storehouse stocks neither. These six run on non-fat dry milk, which it does.
- **Made, Not Bought** — barbecue sauce, gravy and a lighter mayonnaise. Counting what
  blocks a recipe, those three were between them the only thing standing between thirteen
  recipes and a week with no shopping trip, and the order list has every part of all three.

## Sharing one list between phones

Out of the box, favorites, the weeks and their shopping lists save in whatever
browser you are using. Your phone and your wife's phone each keep their own.

To share one plan between both of you, follow **[SETUP.md](SETUP.md)** — it takes about
five minutes, costs nothing, and afterwards you both open the same link, type the same
household code once, and you are looking at the same list. Tick milk off in the store
and it greys out on her phone a second later.

The app still works normally if you never do this, and it keeps working with no signal
either way.

## Putting it online

The app is plain static files, so GitHub Pages hosts it for free:

1. Push this repository to GitHub.
2. **Settings → Pages → Source: Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Wait a minute. Your link is `https://<your-username>.github.io/<repo-name>/`.

That is the whole deployment. There is deliberately no Actions workflow: Pages
is either served from a branch or built by Actions, never both, and a repository
carrying the machinery for the one it is not using is a repository where nobody
can tell which is real. This one had both for a while, and the answer to "why
has the site not updated" was harder than it needed to be for exactly that
reason.

If a push ever does not appear: the service worker serves the shell cache-first,
so check `?v=` in the page source before suspecting the deploy. Everything the
browser loads carries one, and a version that has not moved means the deploy has
not landed rather than that the cache is stale.

There is a landing page at `/welcome/` — what the app is, what it does, the two
books, and how to install it — for sharing with someone who has not seen it
before. The app itself stays at the root so that installed shortcuts and
bookmarks keep working.

Open that on both phones and use *Add to Home Screen*. It really does behave like an
app: there is a manifest and an icon, and a service worker keeps the page, the styling,
the recipes and the two typefaces on the phone, so tapping the icon in a storehouse
basement with no signal opens the app rather than a browser error. Nothing is fetched
from any other host — the fonts are in this repository, not Google's.

## About the nutrition numbers

Run and Not Be Weary's 100 recipes came with real macros. Around the Table's original 125 came
with **none** — the source had taglines where the nutrition data should be, so the scores
shown on those recipes in the very first version were invented.

This version computes macros for all of Around the Table from the ingredient lists, and
computes sodium and fiber from the ingredient lists for every recipe in both volumes,
because the book never carried either figure.

Recipes no longer carry an *est.* mark. Almost every number in the collection is worked
out rather than measured, so marking most of them and not the rest told you less than it
looked like it did; the title page and the *How to read a recipe* page say plainly where
the numbers come from, once, for the whole book. `AUDIT.md` has the detail.

### The leaf

The score sits in a leaf, coloured in three bands so a shelf of recipes can be read at a
glance rather than compared digit by digit:

| | | |
|---|---|---|
| **Green** | 70 and up | worth eating often |
| **Blue** | 45 to 69 | worth eating |
| **Grey** | under 45 | worth knowing about |

The median across the 271 is 60, so the bands divide the collection rather than
flattering it.

Open a recipe and one bar shows where the score came from. It has a slot per part, each
as wide as the points that part is worth — 30 for protein, 20 for calories, 10 for fat,
25 for sodium, 15 for fiber — and each slot fills by what the recipe earned. So the ink
across the whole bar *is* the score out of a hundred, and the empty stretches say where
the missing points went. A sum hides that: a 60 short on sodium is a different dinner
from a 60 short on protein.

The points are set inside their own slot, with the part named underneath it, so the
whole breakdown is two short lines rather than five rows — on a two-step recipe the
panel used to be taller than the recipe. The fill is a tint rather than a solid so the
number stays legible wherever it ends: knocked out in white it would read at 27 out of
30 and disappear at 5 out of 20, which is the one worth reading.

### The score

Out of 100, from five things:

| | | |
|---|---|---|
| Protein | 30 | share of the energy, full marks at 45% |
| Calories | 20 | full marks to 300 a serving |
| Fat | 10 | share of the energy, full marks at or below a tenth |
| Sodium | 25 | full marks to 300 mg, nothing left by 1,200 |
| Fiber | 15 | full marks at 7 g |

The original book scored the first three and two other things: ten points for needing
nothing beyond the standard storehouse order, which is shopping convenience rather than
nutrition, and nothing at all for sodium or fiber. In a collection built on canned
chicken, canned soup, deli ham and boxed mixes — and one that counted salt as a free
ingredient — that meant a can of tuna with mayonnaise scored 98 while a pot of beans and
vegetables scored in the sixties. Sorting by *healthiest first* ran backwards.

Sodium and fiber are in, the storehouse bonus is out, and **printed scores differ from
the original book's substantially and by design**. Scores now run 15 to 96 with a median
of 60, rather than clustering in the nineties. The ham and cheddar stack fell from 90 to
49; microwave apple crisp rose from 43 to 71. Whether a recipe needs anything beyond the
standard order is still on every recipe, on the line at its foot.

Sodium and fiber are worked out from the ingredient lists for **every** recipe in both
volumes, including the hundred whose calories and protein were authored — the book never
carried either figure. So half the weight of every score rests on the food table in
`tools/food-db.js`, and the app says so on each recipe.

**[AUDIT.md](AUDIT.md)** shows the work: both formulas, the verification that the
recovered original reproduces all 100 authored scores exactly, where Run and Not Be Weary's
own macros disagree with its ingredient lists, and every assumption behind the
estimates. Worth reading once before this goes to print.

## Layout

```
index.html            the app
src/style.css         all the styling
src/app.js            browse, plan, list, print
src/sync.js           saving, and sharing between devices
src/train.js          the Strengthen tab: the block, the logger, records and the review
src/config.js         the only file you edit for sharing (see SETUP.md)
data/recipes.js       generated — all 271 recipes with macros, scores and parsed ingredients
data/nutrition.js     generated — the food table, parser and score, for the browser
share/index.html     the handout — eight recipes over one sheet, both sides, rendered from the data
tools/print-handout.js renders that sheet to print/Storehouse-Handout.pdf
tools/added-recipes.js the 41 written for this edition (last five sections)
tools/food-db.js      nutrition reference table used for the estimates
tools/parse-lib.js    turns an ingredient line into a food and a weight
tools/recipe-fixes.js corrections applied to the original text at build time
tools/score-lib.js    the score, and what an ingredient list is worth
tools/build-data.js   regenerates data/recipes.js, data/nutrition.js and AUDIT.md
tools/print-books.js  renders the volumes to PDF in print/
tools/booklet.js      imposes a book onto folded letter sheets
tools/check-recipes.js checks recipes against standard kitchen ratios
sw.js                 service worker — makes it open with no signal
manifest.webmanifest  makes Add to Home Screen a real install
fonts/ icons/         the two typefaces and the app icon
tests/                the test suite; node tests/run.js
print/                the finished books, committed so the app can hand them over
design/               the original Claude Design prototype and chat transcript
AUDIT.md              generated — the nutrition audit
```

Changing a nutrition figure means editing `tools/food-db.js` and running:

```sh
node tools/build-data.js
```

That rewrites `data/recipes.js` and `AUDIT.md`, and also `data/nutrition.js` — the food
table, the parser and the score, bundled for the browser so a recipe you write yourself
is measured by exactly the same code as a printed one. Do not edit either generated file.

## Tests

```sh
node tests/run.js            # everything that needs no network
node tests/run.js weeks      # just one file
node tests/run.js --headed   # watch it happen
node tests/run.js sync       # two phones against the live Firestore project
```

Needs Playwright and nothing else — the runner serves the repository itself and drives a
real Chromium, so what is asserted is what the app renders. 83 checks in the default run,
covering browsing and filters, the weeks, the shopping list's names and quantities,
writing and editing recipes, every page of the printed book, opening the whole thing
with the network switched off, and Train — `tests/train.test.js` feeds the block logged
workouts and checks the sets, weights, records, review and sync that come back. `sync` writes to a throwaway household and deletes it
afterwards; it never touches a real one.

To check recipes against standard kitchen ratios — hydration and salt in yeasted
dough, leavening per cup of flour, baking soda with nothing acidic to react
against, eggs per cup of dairy in a custard, oven temperatures, doneness cues on
chicken:

```sh
node tools/check-recipes.js        # the ones written for this edition
node tools/check-recipes.js --all  # every recipe in both books
```

Recipe text itself lives in `design/project/recipes.js`, which the build reads.
