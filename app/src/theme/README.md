# DGM-090 Theme Integration

Status: implemented inside the theme ownership boundary. Production placement belongs to the UI integrator.

```tsx
import { ThemeToggle } from '../theme/index.ts'

// Insert directly in the existing tool rail, after its spacer/actions.
<ThemeToggle />
```

No required props or provider. Do not pass document/session writability or wrap the toggle in a disabled fieldset. The existing `icon-button` class supplies dimensions, focus and hover states, including mobile rail sizing. Its accessible action is `Switch to dark theme` in light mode and `Switch to light theme` in dark mode. Moon/Sun icons are from the existing Lucide dependency.

`useTheme()` returns `{ theme, preferenceError, toggleTheme, setTheme }`; `Theme` is exported as `'light' | 'dark'`. A shared store per DOM document means additional consumers, Strict Mode remounts and reloading the control do not fork preferences. The hook optionally accepts a `ThemeStore` for isolated tests. The component also accepts an optional test store; production needs none.

Storage key: `azure-diagram-studio.ui.theme`. Only explicit actions write it. Missing/invalid values use initial `prefers-color-scheme`; later system changes are intentionally ignored. No media listeners are installed, and React subscriptions clean up on unmount. Cross-tab preference synchronization is intentionally not implemented. Node/server rendering needs no DOM and defaults to light.

Read/write denial retains an ephemeral theme and a truthful `preferenceError`. The button exposes it in `title`, `aria-description` and `data-preference-error="true"`. Nothing calls diagram commands, preview, history, backup, locking, or save-status APIs. Do not connect preference errors to diagram autosave messages.

Chrome tokens and overrides live in the existing editor CSS, keyed by `html[data-theme]`. Document SVG fills/text and export inputs remain unchanged. Document-owned standalone text still uses its designed color, including on the dark canvas; UI chrome contrast checks intentionally exclude artwork. Native PNG/SVG bytes are compared across themes by the browser diagnostic.

## Verification

- `npm --prefix app test -- src/theme`
- `npm --prefix app run typecheck`
- `node app/scripts/verify-theme.mjs`

The diagnostic owns an ephemeral Vite server and Edge browser, closes both on success/failure, and writes evidence under `app/test-results/theme/`. It renders the real editor, adding a test-only rail portal only when production has no toggle. Checks cover writable/read-only sessions at 1440x900 and 390x844, both themes, reload/system choice, invalid/denied storage, native keyboard activation, unchanged canonical document/callbacks/artwork DOM/native SVG+PNG, visible text/control contrast, group/search/inspector/menu views and overflow.

Production root wiring, packaged offline checks, existing performance gates and final release verification remain with their owners. No package, EditorSurface, App, contract, catalog, renderer, desktop, spec or spike edits are part of this implementation.