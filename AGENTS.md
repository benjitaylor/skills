# Skills

This repository contains standalone skills for AI coding agents. Keep each skill's
instructions, references, examples and supporting tools together in its folder.

## Quick start

For the Stageshow example playground, with Node 20.19 or later:

```sh
cd stageshow
npm install
npm run dev
```

Open the local URL Vite prints. The skill's README has the rest.

## Stack and checks

Stageshow uses React, TypeScript and CSS. Run `npm run typecheck`,
`npm run check:css` and `npm run check:rtl` in its folder after changing code. Follow its rehearsal
guidance when changing examples or motion. Do not run a production build while
the same workspace's development server is running.

## Branch workflow

Use a feature or fix branch for changes. Keep unrelated skills and experiments
separate. Do not include generated recordings, dependencies, credentials or
machine-specific paths in commits. Keep references local to their skill so the
installed folder works independently.
