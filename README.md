# Orbital Noise

Orbital Noise is a browser-based procedural wallpaper generator that creates cosmos scenes on an HTML canvas.  
It supports multiple visual styles, generates in desktop or mobile formats, and lets you download the result as PNG.

## Features

- Procedural scene generation with seeded randomness
- Three built-in styles:
  - `normal` (neon space palette)
  - `gold` (warm metallic palette)
  - `blue-ink` (ink-style palette)
- Two output formats:
  - Desktop 4K (`3840x2160`)
  - Mobile (`2160x3840`)
- One-click PNG export from the browser UI
- Modular renderer/style architecture for extension

## Screenshots

<p>
  <img src="./docs/screenshots/screenshot-01.png" alt="Normal style mobile screenshot 1" width="32%" />
  <img src="./docs/screenshots/screenshot-02.png" alt="Normal style mobile screenshot 2" width="32%" />
  <img src="./docs/screenshots/screenshot-05.png" alt="Normal style mobile screenshot 3" width="32%" />
</p>
<p>
  <img src="./docs/screenshots/screenshot-03.png" alt="Blue-ink style mobile screenshot" width="48%" />
  <img src="./docs/screenshots/screenshot-04.png" alt="Gold style mobile screenshot" width="48%" />
</p>
<p>
  <img src="./docs/screenshots/screenshot-10.png" alt="Gold style desktop screenshot" width="100%" />
  <img src="./docs/screenshots/screenshot-06.png" alt="Blue-ink style desktop screenshot" width="100%" />
  <img src="./docs/screenshots/screenshot-08.png" alt="Normal style desktop screenshot" width="100%" />
</p>

## Quick Start

No build step or dependencies are required.

1. Start a local static server from the project root:

```bash
python3 -m http.server 5173
```

2. Open [http://localhost:5173](http://localhost:5173) in your browser.
3. Pick a style and format, then click **Generate**.
4. Click **Download PNG** to save the current canvas render.

## How It Works

- `index.html` defines the app shell and controls.
- `app.js` wires UI events, picks a random seed, and runs generation.
- `config.js` defines style and format options.
- `generatorRegistry.js` lazy-loads style generators.
- `modes/*` expose style-specific generator entry points.
- `src/` contains shared rendering, palette, math, and wallpaper logic.

## Programmatic Usage

You can call a mode directly from JavaScript:

```js
import { generateWallpaper } from "./modes/normal/index.js";

const canvas = document.querySelector("canvas");
const info = generateWallpaper(canvas, {
  width: 3840,
  height: 2160,
  seed: 123456,
  mode: "desktop",
});

console.log(info.seed, info.colors, info.planetCount);
```

Each mode also exports `generateWallpaperAsync` for stepped async rendering.

## Generation Options

Default generation parameters live in:

- `src/wallpaper/defaultOptions.js`

Options are merged and style-scaled by:

- `src/wallpaper/updateOptions.js`
- `src/styles/styleProfiles.js`

## Project Structure

```text
.
|-- app.js
|-- config.js
|-- generatorRegistry.js
|-- index.html
|-- modes/
|   |-- normal/
|   |-- gold/
|   `-- blue-ink/
|-- src/
|   |-- core/
|   |-- render/
|   |-- styles/
|   |-- wallpaper/
|   `-- utils/
`-- styles.css
```

## License

MIT. See [LICENSE](./LICENSE).

## Turnstile + Protected Metadata Pipeline

The PNG metadata envelope is now issued by a backend (not by frontend secrets).

### 1) Create Turnstile keys

In Cloudflare Turnstile dashboard, create a widget and set allowed hostnames:

- `thomastoledo.github.io`
- `localhost`

Use in this project:

- Frontend sitekey (public): `0x4AAAAAACllYcR8reFAKBjJ`
- Backend secret: set `TURNSTILE_SECRET` in `server/.env`

### 2) Run backend locally

```bash
cd server
cp .env.example .env
npm install
npm run dev
```

### 3) Frontend/backend wiring

- Frontend uses Turnstile token + `seed` and calls `POST /payload`.
- Backend verifies Turnstile server-side and returns encrypted envelope only.
- Frontend injects envelope in PNG iTXt chunk `suntraz` before first `IDAT`.

### 4) Test the full flow

1. Start backend (`server` folder).
2. Start static frontend server from project root.
3. Open app, complete Turnstile, generate image, download PNG.
4. Verify metadata:

```bash
exiftool -a -G1 -s -iTXt:all cosmos-*.png
```

You should see iTXt keyword `suntraz` containing envelope JSON (`alg`, `iter`, `salt_b64`, `iv_b64`, `ct_b64`).

