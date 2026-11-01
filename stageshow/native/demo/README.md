# Stageshow Native demo

A standalone Expo app for the React Native Stageshow kit. Requires Node 22.13+
and an Expo 57 compatible simulator, device or Expo Go installation.

```sh
npm ci
npm run ios
# or npm run android / npm run web
```

**Examples** opens native versions of the original Messages, Subscriptions and
Dark Bento compositions. **Components** contains Inbox, Kit, Motion and Devices, with four themes, three
fidelities, poster/replay and a frame stepping mode. **Compare** contains
two shared web/native scenes with opening, typing and payoff states, compact and
wide layouts, a reduced motion switch and live replay. Tap states in quick
succession to interrupt an animation. Rotate the simulator or use a tablet for
the wide layout; a phone portrait viewport stays compact.

To recreate this app from the contribution checkout, run
`npm run create:demo -- /path/to/new-folder` from `stageshow/native`. The generator
refuses existing folders. All kit code, artwork and licenses travel with the app;
it has no imports back into the source checkout.

Run `npm run typecheck` to check source and `npm run export` to check iOS/Android
bundling (stop the development server first). Bundling is not a device test.

The contribution is a review preview. Android device behavior, physical-device
performance, accessibility services and full RTL validation remain open. The
original web kit is at https://github.com/benjitaylor/skills/tree/main/stageshow.

## Authoring guidance

Read [AUTHORING.md](../AUTHORING.md) before creating a scene. The standalone app
includes the shared skill, all 15 craft references and original web example
sources in `guidance/`, plus the native API contract in `NATIVE-API.md`.
`AGENTS.md` directs coding agents to that guidance. Web references explain the
visual standard; native `examples/` are the runnable starting points.
