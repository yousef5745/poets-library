// Site configuration. Every value marked PLACEHOLDER must be filled in before going live.
// Only public values belong here (this file ships to the browser). Never put the Supabase
// service_role key, the Lemon Squeezy API key or the webhook signing secret in this file.
export const CONFIG = {
  siteName: 'حكايا',
  defaultLocale: 'ar',
  locales: ['ar'],               // add 'en' later: create i18n/en.js and list it here

  supabase: {
    url: 'https://mcmkcplgbslykiwuknhc.supabase.co',
    anonKey: 'sb_publishable_OQJhjLv6SKJPM4ArH8rRRQ_2D7PEax9', // publishable key (public, safe in the browser)
    sdkUrl: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
  },

  // Login providers. Google and email + password are on. Facebook and X are coded and stay off
  // until each provider is set up in Supabase -> Authentication -> Providers.
  auth: {
    google:   { enabled: true },
    facebook: { enabled: false },
    x:        { enabled: false, supabaseProvider: 'x' },   // use 'twitter' if the project still has the legacy provider
    email:    { enabled: true, mode: 'password' },            // email + password (sign-up confirms by email); 'magic' = one-time link
  },

  lemonSqueezy: {
    scriptUrl: 'https://app.lemonsqueezy.com/js/lemon.js',
    storeSubdomain: 'arapicpoemsstyl',   // https://arapicpoemsstyl.lemonsqueezy.com
    variants: {
      monthly: 'a69921fe-5b36-409c-a2b5-24323976742a',  // checkout UUID (the part after /buy/)
      yearly:  'ff936a27-80d0-4143-b47b-5793e8150e57',
    },
    testMode: true,
  },

  // Legal pages (js/pages/legal.js). contactEmail: the public address for privacy, refund and
  // rights requests.
  legal: { contactEmail: 'Yousef_jodah@hotmail.com', updated: '2026-10-30' },
  plans: {
    monthly: { price: '3.99', currency: 'USD' },
    yearly:  { price: '29.99', currency: 'USD', perMonth: '2.50', savePct: 37 },
    monthlyPearls: 30,           // pearls added to subscribers each month (adjust before launch)
  },

  freeChaptersDefault: 2,        // first N chapters of every story are free
  startingPearls: 10,
};
