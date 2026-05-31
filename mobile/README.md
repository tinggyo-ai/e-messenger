# E-Messenger Mobile

This folder is the Capacitor wrapper for the shared React app.

## Setup

```bash
npm install
npm run add:android
npm run add:ios
```

## Build and sync

```bash
npm run sync
```

`npm run build:web` builds `../web` with Vite `mobile` mode, so it uses `../web/.env.mobile` for the production API and Socket.io endpoints.

Android builds require Android Studio. iOS builds require macOS and Xcode.
