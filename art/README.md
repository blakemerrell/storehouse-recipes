# Section art

Source images go in `art/src/`, one per section, named for the section. They
are the originals as generated — full size, with the title band still on them.
Nothing here is used by the app directly.

`art/src/alt/` holds spare generations of sections that already have a picture.
Nothing reads that folder — the tool lists `art/src` and the extension filter
drops the directory entry. They are kept because which of two near-identical
engravings is better is a judgement worth being able to revisit.

`node tools/prep-art.js` reads `art/src/` and writes prepared images beside it
in `art/`: title band cropped off, frame removed, grayscale, toned to the
book's own ink and page colour, and no larger than half-letter at 300dpi needs.
Those are what the books embed.

`--preview` also writes `contact-sheet.png`, which is worth a look — a seam
found two lines too high loses the top of a picture, and no test can see that.

The band comes off because it is set in a typeface that appears nowhere else in
the book, and because it carries a typo that cannot be fixed in pixels: the
title reads `'BISHOPS' STOREHOUSE RECIPE BOOKS'`, quote marks and all. The book
sets each section name itself, so renaming a section never orphans its picture.
