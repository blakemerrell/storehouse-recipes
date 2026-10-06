/* Doors from the day to the recipe, and the way back (Blake, 2026-10-06).
 *
 * "I tried to open the recipe card for my meal. And it just opened the meal
 * picker. I need easy links to the recipes when I click on the recipe
 * names." The day's tray was one button, so a recipe's name on it could only
 * open the meal; the recipe was two taps and an opened tray away, inside the
 * meal's sheet. A recipe's line on the day is now a door of its own, opening
 * the card scaled to the plate the way the sheet's own door does. A food's
 * line, and the rest of the tray, still open the meal.
 *
 * And, from the same report: "After I try and exit the food picker it shows
 * this recipe card." The card he sent was the meatloaf at 1x, which only a
 * history entry restores. He had looked at the meatloaf, the app was
 * reloaded (a phone reopening it from the background is a reload), and the
 * next meal sheet pushed on top of that entry; Done stepped back onto it and
 * the popstate handler put the meatloaf up. An entry a previous load left
 * behind is the bottom of the stack now, whatever it carries. */
const DAY = '2026-10-06';

const SETUP = () => {
  localStorage.setItem('bsc.macroProfile', JSON.stringify({ sex: 'm', age: 43, ft: 5, inch: 11, lb: 192, act: 1.55, goal: 'cut1' }));
  localStorage.setItem('bsc.macroTargets', JSON.stringify({ p: 190, f: 70, c: 230 }));
  localStorage.setItem('bsc.macroSlots', JSON.stringify({ list: [{ k: 'b', n: 'Breakfast', t: 'b' }, { k: 'l', n: 'Lunch', t: 'l' },
    { k: 'd', n: 'Dinner', t: 'd' }], names: { b: 'Breakfast', l: 'Lunch', d: 'Dinner' } }));
  // dinner holds three slices of the meatloaf (eight to the loaf) and a food
  localStorage.setItem('bsc.macroDays', JSON.stringify({ '2026-10-06': {
    b: [{ id: 'f:greek_yogurt', x: 1, eaten: 1 }], l: [],
    d: [{ id: 351, x: 3, eaten: 0 }, { id: 'f:greek_yogurt', x: 1, eaten: 0 }] } }));
};

async function day(t) {
  const p = await t.fresh({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await p.clock.setFixedTime(new Date(2026, 9, 6, 17, 30, 0));
  await p.reload();
  await p.waitForTimeout(700);
  await p.evaluate(SETUP);
  await p.reload();
  await p.waitForTimeout(900);
  await p.click('.tab[data-view="macros"]');
  await p.waitForTimeout(600);
  return p;
}

const open = (p) => p.evaluate(() => ({
  meal: !!document.querySelector('#modalRoot .msheet'),
  recipe: (document.querySelector('#modalRoot .sheet-name') || {}).textContent || '',
  scale: (document.querySelector('#modalRoot .scaler-val') || {}).textContent || '',
}));

module.exports = {
  name: 'Doors from the day',
  async run(t) {
    const p = await day(t);

    const lines = await p.evaluate(() => {
      const tr = document.querySelector('[data-mopen="d"]').closest('.mtray');
      return [...tr.querySelectorAll('.mtray-f')].map((f) => ({
        tag: f.tagName, open: f.dataset.open || '', mx: f.dataset.mx || '',
        name: (f.querySelector('.mtray-fn') || {}).textContent || '',
        deco: getComputedStyle(f.querySelector('.mtray-fn')).textDecorationLine,
        color: getComputedStyle(f.querySelector('.mtray-fn')).color,
        h: f.getBoundingClientRect().height,
      }));
    });
    const rec = lines.find((l) => /Meatloaf/.test(l.name));
    const food = lines.find((l) => /yogurt/i.test(l.name));
    t.ok('on the day, a recipe’s line is a door to the recipe, with the plate’s servings',
      !!rec && rec.tag === 'BUTTON' && rec.open === '351' && rec.mx === '3', JSON.stringify(lines));
    t.ok('and a food’s line is not: it is part of the tray',
      !!food && food.tag === 'SPAN' && !food.open, JSON.stringify(lines));
    t.ok('the recipe’s name wears the link colour, never a line through or under it, and stays one line',
      !!rec && !!food && rec.color !== food.color && rec.deco === 'none' && rec.h <= 24, JSON.stringify(lines));

    // a press on the recipe's name opens the recipe, scaled to make the plate
    await p.click('[data-mopen="d"] ~ .mtray-fs .mtray-go .mtray-fn');
    await p.waitForTimeout(600);
    const card = await open(p);
    t.ok('pressing the recipe’s name opens the recipe, not the meal',
      !card.meal && /Traditional Meatloaf/.test(card.recipe), JSON.stringify(card));
    t.ok('and opens it scaled to the plate: three slices of eight', card.scale === '⅜×', JSON.stringify(card));
    await p.goBack();
    await p.waitForTimeout(600);
    const back = await open(p);
    t.ok('back from it is the day again, nothing open', !back.meal && !back.recipe, JSON.stringify(back));

    // the rest of the tray is still the meal's door: the food's line, and the head
    const at = await p.evaluate(() => {
      const tr = document.querySelector('[data-mopen="d"]').closest('.mtray');
      const f = [...tr.querySelectorAll('.mtray-f')].find((x) => /yogurt/i.test(x.textContent)).getBoundingClientRect();
      const g = tr.querySelector('.mtray-go').getBoundingClientRect();
      const hit = (x, y) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('[data-mopen]') ? 'meal' : e.closest('[data-open]') ? 'recipe' : e.className) : 'none'; };
      return {
        food: hit(f.left + f.width * 0.3, f.top + f.height / 2),
        weight: hit(f.right - 4, f.top + f.height / 2),
        recipe: hit(g.left + 20, g.top + g.height / 2),
        // the recipe's reach runs past its line, but not into the next one's middle
        above: hit(g.left + 20, g.top - 3),
        nextMiddle: hit(f.left + 20, f.top + f.height / 2),
      };
    });
    t.ok('a press on a food’s line still lands on the meal’s door, the recipe’s on the recipe',
      at.food === 'meal' && at.weight === 'meal' && at.recipe === 'recipe' && at.above === 'recipe' && at.nextMiddle === 'meal',
      JSON.stringify(at));
    const food2 = await p.evaluate(() => {
      const tr = document.querySelector('[data-mopen="d"]').closest('.mtray');
      const f = [...tr.querySelectorAll('.mtray-f')].find((x) => /yogurt/i.test(x.textContent)).getBoundingClientRect();
      return { x: f.left + f.width * 0.3, y: f.top + f.height / 2 };
    });
    await p.mouse.click(food2.x, food2.y);
    await p.waitForTimeout(600);
    const meal = await open(p);
    t.ok('and pressing it opens the meal', meal.meal && !meal.recipe, JSON.stringify(meal));
    await p.click('#modalRoot .msh-done');
    await p.waitForTimeout(600);

    /* The way back after a reload. Look at the meatloaf in Recipes, reload
       on it, open dinner's sheet and leave it, by Done and by back. Before,
       both put the meatloaf up at 1x. */
    for (const how of ['Done', 'back']) {
      await p.click('.tab[data-view="browse"]');
      await p.waitForTimeout(300);
      await p.fill('#search', 'meatloaf');
      await p.waitForTimeout(400);
      await p.click('#grid [data-open="351"], [data-open="351"]');
      await p.waitForTimeout(500);
      const looked = await open(p);
      await p.reload();
      await p.waitForTimeout(900);
      await p.click('.tab[data-view="macros"]');
      await p.waitForTimeout(500);
      await p.click('[data-mopen="d"]');
      await p.waitForTimeout(500);
      const sheetUp = await open(p);
      if (how === 'Done') await p.click('#modalRoot .msh-done');
      else await p.goBack();
      await p.waitForTimeout(700);
      const after = await open(p);
      t.ok('after a reload on a recipe, leaving a meal’s sheet by ' + how + ' lands on the day, not on that recipe',
        /Meatloaf/.test(looked.recipe) && sheetUp.meal && !after.meal && !after.recipe,
        JSON.stringify({ looked, sheetUp, after }));
    }

    // and a recipe opened in this life still comes back on back, as it always has
    await p.click('[data-mopen="d"]');
    await p.waitForTimeout(500);
    await p.click('#modalRoot .msh-tray [data-mtray="1"]').catch(() => {});
    await p.waitForTimeout(300);
    const door = await p.$('#modalRoot .mrow .mitem-name[data-open="351"]');
    if (door) {
      await door.click();
      await p.waitForTimeout(500);
      const over = await open(p);
      await p.goBack();
      await p.waitForTimeout(600);
      const under = await open(p);
      t.ok('a recipe opened from the meal’s sheet still steps back to that sheet',
        /Meatloaf/.test(over.recipe) && under.meal && !under.recipe, JSON.stringify({ over, under }));
    } else {
      t.ok('a recipe opened from the meal’s sheet still steps back to that sheet', false, 'no recipe door in the open tray');
    }

    await p.context().close();
  },
};
