# Shine Logout — iPhone home-screen app

The finalized logged-out app (homepage option 3 · job cards & recruiters) as an iPhone home-screen web app — the iPhone version of `../android-preview/app-logout.apk`.

| Folder | App name | Homepage |
|---|---|---|
| `logout/` | Shine Logout | Job cards & recruiters (`app-home-logout3.html`) |

The app opens on its splash (`splash.html`, dark, ≈ 2.4 s — two shooting stars meet at the logo, then a sunrise glow rises from the bottom), which then hands over to the homepage; the homepage sends a fresh launch to the splash itself, so an already-installed icon gets it too.

**Launch screen:** iPhone shows a launch screen before a home-screen app has loaded. The app ships plain midnight-navy #0C1731 launch images (`logout/icons/launch-*.png`, one exact size per iPhone screen, linked as `apple-touch-startup-image`), the same colour as the splash's first frame. iOS saves the launch screen when the app is **added** to the Home Screen.

`logout/` is a self-contained app: the splash, the homepage, log-in, sign-up and job search pages, fonts, a web-app manifest, home-screen icons and an offline cache (`sw.js`). `index.html` at the root is the install page.

**Home-screen icon:** the logged-in app's icon — the splash's midnight navy with its sunrise glow and the white Shine logo (85% size). An icon already on the Home Screen only changes after it is deleted and added again.

## Publish (GitHub Pages)
Repo `https://github.com/Rmallick89/ios-app-git` → **Settings → Pages → Deploy from a branch → `main` / root**. The install page is at `https://rmallick89.github.io/ios-app-git/` and the app at `…/ios-app-git/logout/`.

## Install on an iPhone
Open the install page in **Safari** → tap **Open** → **Share → Add to Home Screen → Add**. Open it once while online; after that it also works offline.

## Updating
The pages are copied from the Android APK so both platforms show the same build. After the APK is rebuilt, run `python3 build_ios.py ../android-preview .` (it refreshes `logout/` and the offline cache version), commit and push. The installed app picks up the new version the next time it's opened online.

Limits on iPhone: no tap vibration (iOS doesn't allow it for web apps); the status bar is the standard light bar.

## Changelog
- **2026-11-12** — Only the finalized app ships: `cards/` (Shine Cards) renamed to `logout/` (**Shine Logout**); `preview/` (Shine Preview) and `folder/` (Shine Folder) removed. An icon added from the old `cards/` address no longer opens — delete it and add Shine Logout again.
