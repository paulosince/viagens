const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync('style.css', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const rule = selector => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(escaped + '\\s*\\{([^}]*)\\}'));
  assert(match, 'Missing CSS selector: ' + selector);
  return match[1];
};

const root = rule(':root');
assert(root.includes('--viaggio-tab-bar-height: 76px;'));
assert(root.includes('--viaggio-tab-bar-bottom: max(32px, env(safe-area-max-inset-bottom, 0px), env(safe-area-inset-bottom, 0px));'));
const trip = rule('.trip-tabs');
const home = rule('.home-tabs');
for (const [name, r] of [['trip',trip],['home',home]]) {
  assert(r.includes('height:') && r.includes('var(--viaggio-tab-bar-height)'),
    name + ' navigation must have a fixed height');
  assert(r.includes('min-height:') && r.includes('max-height:'),
    name + ' navigation must not stretch when search opens');
  assert(r.includes('grid-template-rows:') && r.replace(/\s+/g,'').includes('minmax(0,1fr)'),
    name + ' navigation must keep one fixed grid row');
}

assert(trip.includes('bottom: var(--viaggio-tab-bar-bottom)'),
  'Trip navigation must share bottom spacing with Home');
const homeContainer = rule('.home-bottom');
assert(homeContainer.includes('bottom:var(--viaggio-tab-bar-bottom)'),
  'Home navigation must use identical bottom spacing');
for (const match of css.matchAll(/\.home-bottom\s*\{([^}]*)\}/g)) {
  const bottom = /bottom\s*:\s*([^;]+);/.exec(match[1]);
  if (bottom) assert.equal(bottom[1].trim(), 'var(--viaggio-tab-bar-bottom)',
    'Later Home bottom overrides must not drift');
}
const tripButton = rule('.trip-tab');
const homeButton = rule('.home-tabs .home-nav-item');
assert(tripButton.includes('height: 100%') && tripButton.includes('min-height: 0'),
  'Trip buttons fill navigation rather than imposing their own height');
assert(homeButton.includes('height:100%') && homeButton.includes('min-height:0'),
  'Home buttons fill navigation rather than imposing their own height');
assert(html.includes('id="home_search_reveal"') && css.includes('.home-search-reveal[data-open="true"]'),
  'Search show/hide remains independent of navigation geometry');
assert(html.includes('class="trip-tabs"') && html.includes('class="home-tabs"'),
  'Both bars exist in app markup');

const main = fs.readFileSync('experiments/neon-pilot/app/main-neon.js', 'utf8');
assert(html.includes('data-layout="fixed-shell"'));
const scope = 'body[data-layout="fixed-shell"][data-session="authenticated"]';
const shell = rule(scope + ' #app');
assert(shell.includes('position: fixed') && shell.includes('height: 100dvh'));
const scrollport = rule(scope + ' #user_home');
assert(scrollport.includes('overflow-y: auto') && scrollport.includes('overscroll-behavior-y: none'));
const anchor = rule(scope + ' .home-bottom');
assert(anchor.includes('position: absolute') && anchor.includes('transform: none'));
assert(main.includes('home.scrollTop <= 1') && main.includes('home.scrollTop > 64'));
assert(main.includes("home.addEventListener('scroll',"));
assert(main.includes("document.getElementById('user_home').scrollTo("));
assert(main.includes("document.getElementById('user_home').addEventListener('scroll', scheduleHomeHeader"));
console.log('PASS: fixed 76px navigation, independent Home scrollport and stable shell anchor');
