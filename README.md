> **Also in this repository:** [Technical Submission Builder](tech-submission/README.md), which builds
> street lighting technical submissions for client approval. It is installable and is published at
> https://vinuphilipos-boop.github.io/Project/tech-submission/

# Eisenhower Box

An installable app (Progressive Web App) for prioritizing tasks with the Eisenhower Matrix.
It works on phones, tablets and computers, and keeps working offline.

|                   | Urgent       | Not urgent   |
|-------------------|--------------|--------------|
| **Important**     | **Do**       | **Schedule** |
| **Not important** | **Delegate** | **Delete**   |

## Features

- Add tasks and tick **Urgent** / **Important** to place them in the right box
- Move tasks by dragging (desktop) or with the menu on each task (phones and tablets)
- Mark tasks complete, double-click to edit, × to delete, **Clear completed** to tidy up
- **Export** / **Import** your tasks as a JSON file (backups or moving to another device)
- Installable with its own icon; opens full-screen and works offline
- Tasks are stored on your device (localStorage). Nothing is sent to a server.

## Publish it (GitHub Pages, free)

1. On GitHub, open the repository's **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose `master` and `/ (root)`, then **Save**.
3. After a minute the app is live at `https://vinuphilipos-boop.github.io/Project/`.

## Install it

- **Android (Chrome):** open the link, then tap **Install app** (or menu ⋮ → *Install app*).
- **iPhone / iPad (Safari):** open the link, tap **Share** → **Add to Home Screen**.
- **Windows / Mac (Chrome or Edge):** click **Install app** on the page, or the install icon in the address bar.

## Run it locally

```sh
python3 -m http.server 8000
```

then visit http://localhost:8000. (Offline support and installing need `http://localhost` or HTTPS;
opening `index.html` directly as a file still works but can't be installed.)

## Releasing updates

When you change any app file, bump `CACHE_VERSION` in `sw.js` (e.g. `eisenhower-v2`) so installed
copies pick up the new version.
