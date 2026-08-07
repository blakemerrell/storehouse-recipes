# Drawn section art — a proposal, not a decision

Three samples, one per book where it matters: two for *Around the Table*
(Worth the Afternoon, For the Love of Chocolate) and one for *Run and Not Be
Weary* (Zero-Cook & Grab-and-Go Fuel), which has no art of any kind yet.

These exist because the generated engravings in `art/src/` cannot be reached
from a cloud session — they live on a local machine, and an image pasted into
a conversation is seen, not saved. Drawing them here needs no upload.

**They are not equivalent to the engravings.** These read as clean contour
line art; the generated ones are dense crosshatch with real warmth. What they
win instead: vector, so sharp at any size and no 186dpi problem; about 2 KB
each rather than 700; the book's own ink by way of `currentColor`; and text in
git, so a diff shows what changed. Nothing to crop, tone, or get wrong at
print time.

Conventions, if the set is finished: `viewBox="0 0 480 180"` — a banner, since
these sit above a section heading rather than filling a page. `fill="none"`,
`stroke="currentColor"`, round caps and joins. Three weights: 2.2 for the
outline that carries the shape, 1.3 for interior detail, 0.7 at reduced
opacity for hatching and shadow.

Known weak spots in this batch, should it go forward: the braided loaf reads
as a dome because no strand crosses the outline, and the crock beside it is
nearly a box.
