# Slasha Marketplace — Netlify test build

This version is prepared for a simple Netlify deployment.

## Important
For testing, data is stored in the browser's `localStorage`. That means:
- It works without Firebase, Supabase, Appwrite, or another database.
- Data is tied to the browser/device being used.
- Clearing browser site data can erase the test data.
- It is NOT suitable yet for a real multi-user marketplace.

## Run locally
1. Install Node.js 18+.
2. Open this folder in a terminal.
3. Run `npm install`
4. Run `npm run dev`
5. Open the local URL shown by Vite.

## Deploy to Netlify
Either:
- Upload the project to GitHub and import the repository in Netlify, or
- Drag the project folder into Netlify Drop after running `npm install && npm run build`.

Netlify build settings:
- Build command: `npm run build`
- Publish directory: `dist`

After testing, replace localStorage with a real backend (such as Appwrite) for shared users, accounts, products, and images.
