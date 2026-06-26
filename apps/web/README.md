# Harbor Lantern static frontend

Run from the repository root with no package installation:

```sh
node apps/web/server.mjs
```

Then open `http://localhost:4173`.

The application uses semantic HTML, CSS, browser-native ES modules, and SVG. Domain state,
graph view-model construction, and rendering are separated so they can later be wrapped by
React components without changing the analysis contracts.

Run the browser-independent tests with:

```sh
node --test tests/frontend/*.test.mjs
```
