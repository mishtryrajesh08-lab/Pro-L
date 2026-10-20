# Pro L browser

## Build the .exe (on Windows, one time)
1. Install Node.js LTS from https://nodejs.org
2. Open a terminal in this folder and run:
   npm install
   npm start          (test the browser)
   npm run dist       (builds the installer and portable .exe)
3. Find the files in the `dist` folder: `Pro L Setup 1.0.0.exe` (installer) and `Pro L 1.0.0.exe` (portable).

The app and installer use `build/icon.ico`, made from your 12367.ico.
Your original icon is only 32x25 pixels, so it was padded to a square and enlarged to 256x256.
It will look soft. For a sharp logo, replace `build/icon.ico` and `src/logo.png` with a 256x256 (or larger) square version.

## Files
- src/main.js     tabs, navigation, ad blocking, HTTPS-only, fake-site blocking, downloads, bookmarks, settings storage
- src/index.html  browser window: tab strip, address bar, sidebar
- src/pages.html  first-run setup, settings, new tab, downloads, bookmarks, blocked-site page
- src/ui.css      themes and styling
