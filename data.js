/* ============================================================
   BocheClub — data.js
   SINGLE SOURCE OF TRUTH for every data value in the app.
   UI files (index.html, app.js) hold structure and labels only.
   In production these objects are replaced by API responses
   (member service, POS integration, offers CMS) with the same shape.
   ============================================================ */

var BC_BRAND = {
  name: 'BocheClub',
  superApp: 'BocheApp',
  group: 'Chemmannur International Gold & Diamonds',
  tagline: 'One card. Every pub. Every visit rewarded.',
  intro: 'Join free in a minute. Earn points on every bill, unlock member-only nights and move up to Gold and Diamond.',
  demoOtp: '246810',
  supportPhone: '1800 000 0000',
  supportEmail: 'care@bocheclub.example'
};

var BC_ONBOARD = [
  { icon: 'card',  text: 'A premium digital card with a live QR — always in your pocket' },
  { icon: 'gift',  text: 'Points on every bill, redeemable at any of our pubs' },
  { icon: 'music', text: 'Member-only events, priority tables and cross-pub offers' }
];

/* Legal drinking age per state — enforced via Aadhaar age verification */
var BC_STATES = {
  KL: { name: 'Kerala',    drinkingAge: 23 },
  KA: { name: 'Karnataka', drinkingAge: 21 }
};

/* Demo member (fictional) */
var BC_MEMBER = {
  id: 'BC-KL-240718',
  cardNo: '7181 2407 0526',
  name: 'Arun Mathew',
  firstName: 'Arun',
  mobile: '98470 12345',
  email: 'arun.mathew@example.com',
  dob: '1991-03-14',
  city: 'Kochi',
  homePub: 'kochi',
  tier: 'gold',
  memberSince: 'Jul 2024',
  validThru: '07/27',
  points: 4820,
  tierSpendYear: 62400,
  kyc: {
    aadhaarMasked: 'XXXX XXXX 4417',
    method: 'DigiLocker · Aadhaar offline e-KYC',
    verifiedOn: '18 Jul 2024'
  }
};

/* Membership tiers — free sign-up plus paid tiers.
   qualifySpend: annual spend that earns a complimentary upgrade (assumption — to confirm) */
var BC_TIERS = [
  { id: 'classic', name: 'Classic', price: 0, priceLabel: 'Free', earnRate: 2, qualifySpend: 0, welcomeBonus: 0,
    perks: ['2 points per ₹100 spent', 'Birthday treat at any pub', 'Access to member events', 'Cross-pub offers'] },
  { id: 'gold', name: 'Gold', price: 2999, priceLabel: '₹2,999 / year', earnRate: 5, qualifySpend: 50000, welcomeBonus: 1000,
    perks: ['5 points per ₹100 spent', '1,000 welcome points', 'Priority table booking', '1 guest pass every month', '10% off food, Mon–Thu'] },
  { id: 'diamond', name: 'Diamond', price: 9999, priceLabel: '₹9,999 / year', earnRate: 8, qualifySpend: 150000, welcomeBonus: 3000,
    perks: ['8 points per ₹100 spent', '3,000 welcome points', 'Reserved lounge seating', '4 guest passes every month', '15% off food, all week', 'Private event invitations'] }
];

var BC_POINTS_RULES = {
  rupeeValue: 0.5,        // 1 point = ₹0.50
  minRedeem: 500,         // minimum points per redemption
  maxBillPct: 30,         // points can cover up to 30% of a bill
  expiryMonths: 12,
  expiring: { points: 600, date: '30 Nov 2026' }
};

var BC_PUBS = [
  { id: 'kochi', name: 'BocheClub Kochi', city: 'Kochi', area: 'MG Road, Ernakulam', state: 'KL',
    hours: '12 PM – 11 PM', phone: '+91 484 000 0101', distance: '2.4 km', rating: 4.6,
    tags: ['Live music Fri', 'Rooftop', 'Craft brews'], tone: 'a' },
  { id: 'tvm', name: 'BocheClub Thiruvananthapuram', city: 'Thiruvananthapuram', area: 'Kowdiar', state: 'KL',
    hours: '12 PM – 11 PM', phone: '+91 471 000 0102', distance: '218 km', rating: 4.5,
    tags: ['Quiz nights', 'Sports screening'], tone: 'b' },
  { id: 'kozhikode', name: 'BocheClub Kozhikode', city: 'Kozhikode', area: 'Beach Road', state: 'KL',
    hours: '12 PM – 11 PM', phone: '+91 495 000 0103', distance: '186 km', rating: 4.4,
    tags: ['Sea view', 'Malabar kitchen'], tone: 'c' },
  { id: 'blr', name: 'BocheClub Bengaluru', city: 'Bengaluru', area: 'Indiranagar', state: 'KA',
    hours: '12 PM – 1 AM', phone: '+91 80 0000 0104', distance: '548 km', rating: 4.7,
    tags: ['DJ weekends', 'Microbrewery'], tone: 'd' },
  { id: 'mlr', name: 'BocheClub Mangaluru', city: 'Mangaluru', area: 'Lighthouse Hill Road', state: 'KA',
    hours: '12 PM – 11:30 PM', phone: '+91 824 000 0105', distance: '412 km', rating: 4.5,
    tags: ['Coastal grill', 'Open deck'], tone: 'e' }
];

/* Promotions — cross-pub first; tea & gold later */
var BC_OFFERS = [
  { id: 'o1', kind: 'Cross-pub', title: 'Pub Trail', desc: 'Visit any 3 different BocheClub pubs this month and earn 1,500 bonus points.',
    pubs: 'all', valid: 'Till 31 Oct 2026', tiers: ['classic', 'gold', 'diamond'] },
  { id: 'o2', kind: 'Double points', title: 'Bengaluru weekends', desc: 'Earn 2× points on every bill on Saturdays and Sundays.',
    pubs: ['blr'], valid: 'Every weekend', tiers: ['classic', 'gold', 'diamond'] },
  { id: 'o3', kind: 'Members only', title: 'Free starter over ₹2,500', desc: 'A complimentary starter on food bills above ₹2,500.',
    pubs: ['kozhikode', 'tvm'], valid: 'Mon – Thu', tiers: ['gold', 'diamond'] },
  { id: 'o4', kind: 'Refer', title: 'Bring a friend', desc: 'Earn 500 points when a friend joins and makes their first visit.',
    pubs: 'all', valid: 'Always on', tiers: ['classic', 'gold', 'diamond'] },
  { id: 'o5', kind: 'Early evening', title: '20% off food, 4–7 PM', desc: 'Beat the rush — 20% off the food menu every early evening.',
    pubs: ['kochi', 'mlr'], valid: 'Daily, 4 – 7 PM', tiers: ['classic', 'gold', 'diamond'] }
];

var BC_EVENTS = [
  { id: 'e1', date: '2026-10-24', title: 'Friday Live: Indie Night', pub: 'kochi', time: '8:00 PM', price: 'Free for members', seats: 18 },
  { id: 'e2', date: '2026-10-31', title: 'Halloween Social', pub: 'blr', time: '9:00 PM', price: '₹499 · free for Gold & Diamond', seats: 40 },
  { id: 'e3', date: '2026-11-07', title: 'Quiz Night', pub: 'tvm', time: '7:30 PM', price: 'Free for members', seats: 12 },
  { id: 'e4', date: '2026-11-14', title: 'Coastal Food Fest', pub: 'mlr', time: '7:00 PM', price: '₹299 for members', seats: 30 }
];

var BC_REWARDS = [
  { id: 'r1', title: '₹250 off your bill',            pts: 500,  cat: 'Bill credit', icon: 'receipt' },
  { id: 'r2', title: 'Mocktail pitcher',              pts: 700,  cat: 'Beverages',   icon: 'gift' },
  { id: 'r3', title: 'Starter platter',               pts: 900,  cat: 'Food',        icon: 'gift' },
  { id: 'r4', title: 'Priority table for 6, Friday',  pts: 1200, cat: 'Experience',  icon: 'users' },
  { id: 'r5', title: 'Live night event pass',         pts: 1500, cat: 'Events',      icon: 'music' },
  { id: 'r6', title: 'BocheClub merch tee',           pts: 2000, cat: 'Merch',       icon: 'tag' },
  { id: 'r7', title: '₹1,500 off your bill',          pts: 3000, cat: 'Bill credit', icon: 'receipt' },
  { id: 'r8', title: 'Private lounge for 10 (2 hrs)', pts: 8000, cat: 'Experience',  icon: 'crown' }
];

var BC_POINTS_HISTORY = [
  { date: '17 Oct 2026', title: 'Bill · BocheClub Kochi',       ref: 'KCH-87102', pts: 186 },
  { date: '12 Oct 2026', title: 'Redeemed · Starter platter',    ref: 'VCH-2231',  pts: -900 },
  { date: '05 Oct 2026', title: 'Pub Trail bonus · 3 pubs',      ref: 'PROMO-O1',  pts: 1500 },
  { date: '04 Oct 2026', title: 'Bill · BocheClub Bengaluru',    ref: 'BLR-40918', pts: 240 },
  { date: '28 Sep 2026', title: 'Bill · BocheClub Mangaluru',    ref: 'MLR-11873', pts: 155 },
  { date: '19 Sep 2026', title: 'Referral · Nikhil joined',      ref: 'REF-0931',  pts: 500 },
  { date: '14 Jul 2026', title: 'Gold welcome bonus',            ref: 'TIER-GOLD', pts: 1000 }
];

/* Sample bill as returned by the pub POS integration (API / DB) */
var BC_POS_SAMPLE = {
  table: '12',
  items: [
    { name: 'Paneer tikka',         qty: 1, price: 380 },
    { name: 'Chicken 65',           qty: 1, price: 420 },
    { name: 'Bar beverages',        qty: 1, price: 1640 },
    { name: 'Fresh lime soda',      qty: 2, price: 140 }
  ],
  taxes: 136
};

/* Payment gateway methods — direct payment, no stored wallet balance */
var BC_PAY_METHODS = [
  { id: 'upi',  label: 'UPI',                 sub: 'GPay, PhonePe, Paytm, BHIM' },
  { id: 'card', label: 'Credit / debit card', sub: 'Visa, Mastercard, RuPay' },
  { id: 'nb',   label: 'Net banking',         sub: 'All major banks' }
];

var BC_BOOKING = {
  times: ['7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM', '9:30 PM'],
  occasions: ['Casual', 'Birthday', 'Anniversary', 'Business', 'Celebration'],
  maxGuests: 12
};

var BC_KYC = {
  methods: [
    { id: 'digilocker', title: 'DigiLocker', sub: 'Fastest — fetch Aadhaar details with your consent', recommended: true },
    { id: 'offline',    title: 'Aadhaar offline e-KYC', sub: 'Upload the Aadhaar XML or scan the QR on your card' }
  ],
  steps: ['Connecting securely', 'Fetching masked Aadhaar with your consent', 'Reading date of birth', 'Checking legal drinking age by state'],
  consent: 'I consent to BocheClub verifying my age using my Aadhaar details. Only my name, year of birth and a verified-age flag are stored — never my Aadhaar number.'
};

/* Super-app teaser — future businesses joining BocheApp */
var BC_COMING_SOON = [
  { id: 'tea',  title: 'Tea Estates', desc: 'Estate-fresh tea, delivered. Earn club points.', icon: 'leaf' },
  { id: 'gold', title: 'Gold & Diamonds', desc: 'Exclusive member pricing on jewellery.', icon: 'gem' }
];
