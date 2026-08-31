/* ---------------------------------------------------------------------------
 * Sharing setup — this is the only file you need to edit.
 *
 * Leave it exactly as it is and the app still works: everything saves on the
 * device you are using, and nothing is shared. Fill it in and the two of you
 * can share one meal plan, one set of favorites and one shopping list.
 *
 * SETUP.md walks through where these six values come from. It takes about five
 * minutes and costs nothing.
 * ------------------------------------------------------------------------- */

/* Looking food up rather than typing it.
 *
 * Optional, free, and takes about two minutes: api.data.gov/signup gives you
 * a key for the USDA's FoodData Central, which is where "chicken tamale" and
 * every other generic food comes from. Leave it empty and the lookup box
 * simply says it needs one; barcodes work either way, because Open Food
 * Facts asks for no key at all.
 *
 * The key is not a secret in any meaningful sense — it is in the page, like
 * the Firebase config below — it is a courtesy so the USDA can tell one
 * caller from another. */
window.USDA_KEY = "";

window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyApxpcitqo7qHLVDRS4UX5Xa4XNUKa0Qh0",
  authDomain: "storehouse-recipe-book.firebaseapp.com",
  projectId: "storehouse-recipe-book",
  storageBucket: "storehouse-recipe-book.firebasestorage.app",
  messagingSenderId: "1048714331242",
  appId: "1:1048714331242:web:83f2d3988c9e24017b3613"
};
