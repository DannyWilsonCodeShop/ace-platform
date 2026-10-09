/**
 * Default "app-build" project template.
 *
 * Modeled on the Green-Casting agency dashboard config (`FRONTEND` / `BACKEND`
 * / `MIDDLEWARE` arrays) but generalized for a client software/app build so the
 * full lifecycle stages surface (payments backend, contract/entity/stripe
 * middleware). When a Quote is promoted to a Project with
 * `templateKey: 'app-build'`, one `ProjectPage` row is seeded per item below,
 * keyed by `key` (-> ProjectPage.pageKey).
 */

import type { ProjectTemplate, TrackedItem } from './types';

/** Default soft-launch window: a 30-day push from the build start. */
const LAUNCH = {
  start: '2026-01-01',
  target: '2026-01-31', // 30 days — "finish early" framing
};

/** Backend drip ceiling — never shows more than the real backend completion. */
const BACKEND_CEILING = 65;

/** Frontend — the pages the user sees. */
const FRONTEND: TrackedItem[] = [
  { key: 'fe-landing', label: 'Landing / home', category: 'frontend', blurb: 'Public marketing home.', baseline: 20 },
  { key: 'fe-auth', label: 'Sign up / log in', category: 'frontend', blurb: 'Account registration and returning-user sign in.', baseline: 10 },
  { key: 'fe-dashboard', label: 'User dashboard', category: 'frontend', blurb: 'Signed-in home: status, quick actions.', baseline: 10 },
  { key: 'fe-detail', label: 'Detail / content pages', category: 'frontend', blurb: 'The core content/detail views of the app.', baseline: 5 },
  { key: 'fe-forms', label: 'Forms & editors', category: 'frontend', blurb: 'Create/edit flows with validation.', baseline: 5 },
  { key: 'fe-billing', label: 'Account & billing', category: 'frontend', blurb: 'Subscription plan + payment management.', baseline: 5 },
  { key: 'fe-admin', label: 'Admin portal', category: 'frontend', blurb: 'Back-office admin: accounts, moderation, broadcasts.', baseline: 10 },
];

/** Backend — the systems. baseline is the honest current state; the client
 *  only ever sees the drip, capped at BACKEND_CEILING. */
const BACKEND: TrackedItem[] = [
  { key: 'be-data', label: 'Data models', category: 'backend', blurb: 'Core data models and relationships.', baseline: 40 },
  { key: 'be-auth', label: 'Accounts & auth', category: 'backend', blurb: 'Sign-up/login, roles, account creation triggers.', baseline: 30 },
  { key: 'be-api', label: 'API & business logic', category: 'backend', blurb: 'Server-side validation, queries, mutations.', baseline: 20 },
  { key: 'be-payments', label: 'Payments & subscriptions', category: 'backend', blurb: 'Stripe billing, plans, webhooks, plan enforcement.', baseline: 0 },
  { key: 'be-email', label: 'Email & notifications', category: 'backend', blurb: 'Transactional email + broadcasts.', baseline: 10 },
  { key: 'be-admin', label: 'Admin tools / audit', category: 'backend', blurb: 'Moderation actions, audit log, segmented broadcast.', baseline: 5 },
];

/** Middleware — the supporting setup steps, each tagged with an owner. */
const MIDDLEWARE: TrackedItem[] = [
  {
    key: 'mw-domain', label: 'Choose the domain name', category: 'middleware',
    owner: 'client', done: false, priority: true,
    blocks: 'Email, the live site address, and SSL all wait on the domain.',
    blurb: 'Decide and register the production domain name.',
    baseline: 10,
  },
  {
    key: 'mw-brand', label: 'Finalize branding', category: 'middleware',
    owner: 'client', done: false,
    blurb: 'Pick the final logo, colors, and typography so branding can be locked.',
    baseline: 20,
  },
  {
    key: 'mw-contract', label: 'Sign the written agreement', category: 'middleware',
    owner: 'client', done: false, priority: true,
    blocks: 'The build kicks off once the contract is signed.',
    blurb: 'Turn the agreement into the written contract and sign it.',
    baseline: 30,
  },
  {
    key: 'mw-entity', label: 'Set up your business entity', category: 'middleware',
    owner: 'client', done: false, priority: true,
    blocks: 'You need a registered business (LLC/EIN + bank account) before Stripe.',
    blurb: 'Register the business (LLC/EIN) and open a business bank account — required before Stripe.',
    baseline: 0,
  },
  {
    key: 'mw-stripe', label: 'Set up Stripe (payments)', category: 'middleware',
    owner: 'client', done: false,
    blurb: 'Create the Stripe account in your business\u2019s name once the entity is set up; we wire it in.',
    baseline: 0,
  },
  {
    key: 'mw-analytics', label: 'Set up analytics', category: 'middleware',
    owner: 'client', done: false,
    blurb: 'Create an analytics property (e.g. GA4); we wire the tracking in. Needs a privacy policy + consent.',
    baseline: 0,
  },
];

export const appBuildTemplate: ProjectTemplate = {
  key: 'app-build',
  name: 'App build',
  launch: LAUNCH,
  backendCeiling: BACKEND_CEILING,
  frontend: FRONTEND,
  backend: BACKEND,
  middleware: MIDDLEWARE,
};
