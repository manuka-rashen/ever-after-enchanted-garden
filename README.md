# Ever After — Kavindu & Methmi

A cinematic enchanted garden wedding invitation for 28 November 2027 at Shangri-La Colombo.

**[Open the invitation](https://manuka-rashen.github.io/ever-after-enchanted-garden/)**

## Experience

Four chapters combine animated flower growth, 26 instanced butterflies, a turning 3D storybook, interlocking gold rings, fairy dust, wedding details and a venue map. The invitation supports responsive layouts, reduced motion, pausing, adaptive rendering and optional device tilt.

The garden and couple artwork are AI-generated illustrations. The portrait is labelled as an illustration in the invitation.

## RSVP

Guests fill in their reply, review it, and choose WhatsApp or email. They must press send in their chosen app. This GitHub Pages edition has no database, does not store guest details, and never claims that preparing a draft sends a reply. Contact values match those supplied for the invitation.

## Run and publish

Use Node 24 or later. Run `npm ci`, `npm test`, then `npm run build`. Use `npm run dev` for development or `npm run preview` to inspect the production build.

GitHub Pages must use **GitHub Actions** as its publishing source. Pushing to `main` runs the tests, checks TypeScript, builds the site, verifies project-relative asset paths and deploys the `dist` artifact.

Update wedding details in `lib/invitation.ts`. If renaming the repository, update `base` in `vite.config.ts`, the check in `scripts/verify-build.mjs`, and the absolute sharing metadata in `index.html`.

The original server-backed Sites edition remains a separate deployment. No private RSVP records or server credentials are included here.
