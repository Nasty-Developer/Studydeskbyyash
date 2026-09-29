# STUDY DESK

A browser-based study timer and daily task desk. Preferences, tasks, timer state, and progress are stored in the browser with `localStorage`; no account, API, or backend is required.

## Run locally

From the project root, install dependencies with `pnpm install`, then start the app:

```sh
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/study-desk run dev
```

## Build for static hosting

```sh
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/study-desk run build
```

The finished static site is written to `artifacts/study-desk/dist/public/`. Upload the contents of that directory to a static host.