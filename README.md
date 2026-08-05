# Bishops' Storehouse Recipe Books

257 recipes from the storehouse, in two volumes, plus a third that starts empty and
fills with your own — browse them, plan a week, let the shopping list build itself,
and print the lot as a real half-letter book. It works with no signal.

Built from the Claude Design prototype in `design/`.

## Opening it

Double-click `index.html`. That is the whole thing — no install, no build step, no
server. It works with no internet connection once the page has loaded.

To put it on your phones, see **Putting it online** below.

## What is in it

**Browse** — all 257 recipes, filtered by book, section, effort, whether they need
anything beyond standard storehouse items, or your favorites, and ordered by book,
healthiest first, most protein or quickest. Search covers dish names, ingredients
and section names. Tap a card for the full recipe, where you can
scale the ingredients from ¼× to 8× (fractions come out as fractions, not decimals).

**Write a recipe** — yours go in a third volume, *Ours*, which does not exist until
you put something in it. Name it, list the ingredients a line at a time and the method
a step at a time, and it behaves like any of the 257: browse it, favorite it, plan it,
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
week moves both phones together, so you are never shopping off different lists.

**Shopping List** — builds itself from the week showing, one line per thing, split into
what comes from the storehouse and what you need to buy. A diced apple and a sliced
apple are apples; three recipes wanting a cup, a cup and two tablespoons of cottage
cheese ask for 2⅛ cups, not for all three separately. Seasonings get a name and no
number, because nobody shops for two teaspoons of salt. Check-offs stick for as long as
the item is on the list; take the recipe out of the week and its tick is forgotten, so
an item never comes back to a later list already ticked. Ticks belong to their own
week, so shopping for one does not tick things off in another.

**Print Book** — half-letter (5.5 × 8.5 in), printed as **two volumes**: Strong & Simple is 44
pages, Around the Table is 98, and *Ours* joins them once it has anything in it. Each volume opens with a cover, four pages of front matter
(how to read a recipe, temperatures and doneness, weights and swaps, what the storehouse
carries) and its own contents, then is numbered from page one. Front matter carries no
folio, so adding recipes never shifts the numbering.

Recipes are measured in the browser and packed two or three to a page, so a page
holds as many as genuinely fit rather than a fixed number. A recipe is never split
across a page and a section heading never sits alone at the foot of one. Leftover room
is shared between the recipes on a page up to about a quarter-inch a gap; past that it
stays at the foot, because a page holding two recipes has more room than it can spend
without looking sparse. Three sections — the long-recipe ones — open with a title page,
because a 71-point heading and a 639-point recipe will not share a 666-point page and
a heading alone at the top of a blank one looks like a mistake.

Two of the 257 recipes are taller on their own than a page's text area, and there is
nowhere to move them to. Those two pages are set about three percent smaller so that
they fit, rather than having the bottom of the page quietly cut off — which is what a
printed page, being a fixed 7.5 inches with the overflow hidden, does otherwise.

Every page is checked by `tests/print.test.js`: nothing spills, nothing is stranded, and
nothing runs past the bottom of the paper.

You can also print just one volume, just your favorites, or just this week.

Each volume opens on a cover and a title page and closes on a back cover that lists its
sections, and each is padded with blanks to a whole number of folded sheets — 48 pages
for Strong & Simple, 100 for Around the Table.

**In the app, use Download PDF.** The finished books are rendered ahead of time and ship
with the app, so a printable file at exactly 5.5 × 8.5 in is one click, with no print
dialog to argue with about paper size, margins, headers or scaling. *Booklet PDF* beside
it is the same book imposed for folding. The *Print…* button is still there for the
selections that cannot be made ahead of time — your favorites, this week, and your own
recipes.

To regenerate them after changing a recipe or the food table:

```sh
npm run print                      # both volumes, and each on its own
node tools/print-books.js 1        # just Strong & Simple
```

That writes two files per volume into `print/`, which **are committed** — the app links
to them. `tests/pdfs.test.js` fails if they fall behind the recipes, so a stale book
cannot quietly reach a printer:

- **`Strong-and-Simple.pdf`** — reading order, half-letter. This is the one to give a
  print shop; they impose it themselves.
- **`Strong-and-Simple-booklet.pdf`** — the same book imposed two-up on letter paper,
  landscape, in saddle-stitch order. Print it **double-sided, flipping on the short
  edge**, fold the stack in half and staple the spine. The fold on a landscape sheet
  runs down the middle, so a short-edge flip is the one that puts page 2 behind page 1
  rather than upside down under it.

Strong & Simple is 12 sheets, which staples comfortably. Around the Table is 25, which is
thick for a saddle stitch — worth asking a print shop for perfect binding or a coil
instead.

The service worker deliberately does not keep them on your phone: five megabytes of PDF
is the wrong five megabytes to carry into a shop.

The last three sections of Around the Table were written for this edition rather than
carried over, 32 recipes in all:

- **Worth the Afternoon** — bread, braises and custards. The original 225 had nothing that
  asked you to actually cook: no recipe had more than four steps, none used yeast, none
  kneaded, braised, tempered an egg or thickened a sauce. These do.
- **The Copycat Shelf** — the restaurant versions, worked out from storehouse staples.
- **For the Love of Chocolate** — the original books had 25 "chocolate" recipes and almost
  all were protein shakes or cake-mix shortcuts. There was not one cookie in the whole
  collection, and chocolate chips appeared in a single recipe.

## Sharing between the two of you

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

Open that on both phones and use *Add to Home Screen*. It really does behave like an
app: there is a manifest and an icon, and a service worker keeps the page, the styling,
the recipes and the two typefaces on the phone, so tapping the icon in a storehouse
basement with no signal opens the app rather than a browser error. Nothing is fetched
from any other host — the fonts are in this repository, not Google's.

## About the nutrition numbers

Strong & Simple's 100 recipes came with real macros. Around the Table's original 125 came
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

The median across the 257 is 60, so the bands divide the collection rather than
flattering it.

Open a recipe and the panel breaks the score into the five parts it came from, each with
what it measured, a bar drawn to its share, and its points — because a sum hides which of
its parts it came from, and a 60 that is short on sodium is a different dinner from a 60
that is short on protein. Each bar takes its colour from its own share, so the component
dragging a score down is the one that looks different.

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
recovered original reproduces all 100 authored scores exactly, where Strong & Simple's
own macros disagree with its ingredient lists, and every assumption behind the
estimates. Worth reading once before this goes to print.

## Layout

```
index.html            the app
src/style.css         all the styling
src/app.js            browse, plan, list, print
src/sync.js           saving, and sharing between devices
src/config.js         the only file you edit for sharing (see SETUP.md)
data/recipes.js       generated — all 257 recipes with macros, scores and parsed ingredients
data/nutrition.js     generated — the food table, parser and score, for the browser
tools/added-recipes.js the 32 written for this edition (last three sections)
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
writing and editing recipes, every page of the printed book, and opening the whole thing
with the network switched off. `sync` writes to a throwaway household and deletes it
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
