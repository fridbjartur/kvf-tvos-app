# KVF tvOS App

KVF tvOS app built with Expo and React Native TV, featuring a browsable home screen, program detail views, and video playback for KVF `Sjon` and `Vit` content.

This project relies on the KVF scraper API:
https://github.com/fridbjartur/kvf-scraper-api.git

## Stack

- Expo
- React Native TV (`react-native-tvos`)
- React Navigation
- TypeScript
- Jest

## Getting Started

### Prerequisites

- Node.js
- npm
- Xcode
- Apple TV Simulator or a tvOS device

### Install dependencies

```sh
npm install
```

### Configure the API base URL

Set `EXPO_PUBLIC_API_BASE_URL` to point at the KVF API backend.

The app depends on the KVF scraper API project:
https://github.com/fridbjartur/kvf-scraper-api.git

Example:

```sh
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000 npm start
```

If not set, the app defaults to:

```txt
http://localhost:3000
```

## Available Scripts

```sh
npm start
npm run ios
npm run android
npm run prebuild
npm run prebuild:tv
npm run typecheck
npm test
```

## Project Structure

- `src/screens`: Home, program detail, and playback screens
- `src/components`: TV-focused UI components like rails, cards, and hero banners
- `src/api`: API client, types, and mapping utilities
- `src/hooks`: Data-fetching and screen-level state hooks
- `src/__tests__`: Mapper and screen tests

## Notes

- The app is currently configured for Expo on iOS/tvOS-style workflows.
- tvOS support is enabled through `@react-native-tvos/config-tv`.
