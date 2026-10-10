# Shine — iPhone home-screen apps

The three logged-out homepage options as iPhone home-screen web apps — the iPhone version of the Android APKs in `../android-preview/`.

| Folder | App name | Homepage |
|---|---|---|
| `preview/` | Shine Preview | Option 1 · animated logos (`App homepage hero/app-home-logout.html`) |
| `folder/` | Shine Folder | Option 2 · career folder (`app-home-logout2.html`) |
| `cards/` | Shine Cards | Option 3 · job cards & recruiters (`app-home-logout3.html`) |

Each app opens on its splash (`splash.html`, dark, ≈ 2.4 s — the same **Merged** splash on all three — two shooting stars meet at the logo, then a sunrise glow rises from the bottom), which then hands over to the homepage; the homepage sends a fresh launch to the splash itself, so already-installed icons get it too.

**Launch screen:** iPhone shows a launch screen before a home-screen app has loaded. Each app ships plain midnight-navy #0C1731 launch images (`icons/launch-*.png`, one exact size per iPhone screen, linked as `apple-touch-startup-image`), the same colour as the splash's first frame, so tapping the icon shows only the Shine splash. iOS saves the launch screen when the app is **added** to the Home Screen — after this update, delete the three icons and add them again once.

Each folder is a self-contained app: the splash, the homepage, login and job search pages, fonts, a web-app manifest, home-screen icons and an offline cache (`sw.js`). `index.html` at the root is the install page that links to all three.

## Publish (GitHub Pages)
1. Create an empty GitHub repo named `ios-app-git`, then from this folder: `git add -A`, `git commit -m "iPhone previews"`, `git remote add origin <repo-url>`, `git push -u origin main`.
2. On GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → `main` / root → Save**.
3. After a minute the install page is at `https://<username>.github.io/ios-app-git/`.

## Install on an iPhone
Open the install page in **Safari** → tap an app → **Share → Add to Home Screen → Add**. Repeat for the other two. Open each once while online; after that they also work offline.

## Updating
The pages are copied from the Android APKs so both platforms show the same build. After a homepage changes and its APK is rebuilt, run `build_ios.py` again (it refreshes the three folders and the offline cache version), commit and push. Installed apps pick up the new version the next time they're opened online.

Limits on iPhone: no tap vibration (iOS doesn't allow it for web apps); the status bar is the standard light bar.
