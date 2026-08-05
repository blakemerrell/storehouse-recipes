# Bishops' Storehouse Recipe Books

225 recipes from the storehouse, in two volumes — browse them, plan a week, let the
shopping list build itself, and print the whole thing as a real half-letter book.

Built from the Claude Design prototype in `design/`.

## Opening it

Double-click `index.html`. That is the whole thing — no install, no build step, no
server. It works with no internet connection once the page has loaded.

To put it on your phones, see **Putting it online** below.

## What is in it

**Browse** — all 225 recipes, filtered by book, section, effort, whether they need
anything beyond standard storehouse items, or your favorites. Search covers dish
names, ingredients and section names. Tap a card for the full recipe, where you can
scale the ingredients from ¼× to 8× (fractions come out as fractions, not decimals).

**Meal Plan** — assign recipes to days of the week from any recipe's panel.

**Shopping List** — builds itself from the week, deduplicated, split into what comes
from the storehouse and what you need to buy. Check-offs stick.

**Print Book** — half-letter (5.5 × 8.5 in), printed as **two volumes**: Strong & Simple is 36
pages, Around the Table is 55. Each opens on its own cover and is numbered from page one.

Recipes are measured in the browser and packed two or three to a page, so a page
holds as many as genuinely fit rather than a fixed number. A recipe is never split
across a page, a section heading never sits alone at the foot of one, and leftover
room is shared out between the recipes rather than left in a heap at the bottom.
Every page has been checked to make sure nothing spills.

You can also print just one volume, just your favorites, or just this week.

## Sharing between the two of you

Out of the box, favorites, the week's plan and the shopping list save in whatever
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

Open that on both phones and use *Add to Home Screen* — it then behaves like an app.

## About the nutrition numbers

Strong & Simple's 100 recipes came with real macros. Around the Table's 125 came with **none** — the
original had taglines where the nutrition data should be, so the scores shown on those
recipes in the very first version were invented.

This version computes macros for all of Around the Table from the ingredient lists and marks
every one of them as an estimate: the score chip is drawn with a dashed border, the
panel says *estimated*, and the printed page says *(est.)*. Strong & Simple's authored numbers
are never labelled that way, so you can always tell which is which.

**[AUDIT.md](AUDIT.md)** shows the work: the scoring formula recovered from the original
data, the verification that it reproduces all 100 Strong & Simple scores exactly, where Strong & Simple's
own macros disagree with its ingredient lists, and every assumption behind the Around the Table
estimates. Worth reading once before this goes to print.

## Layout

```
index.html            the app
src/style.css         all the styling
src/app.js            browse, plan, list, print
src/sync.js           saving, and sharing between devices
src/config.js         the only file you edit for sharing (see SETUP.md)
data/recipes.js       generated — all 225 recipes with macros and scores
tools/food-db.js      nutrition reference table used for the estimates
tools/build-data.js   regenerates data/recipes.js and AUDIT.md
design/               the original Claude Design prototype and chat transcript
AUDIT.md              generated — the nutrition audit
```

Changing a nutrition figure means editing `tools/food-db.js` and running:

```sh
node tools/build-data.js
```

Recipe text itself lives in `design/project/recipes.js`, which the build reads.
