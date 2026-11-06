# RFD 003: Low-Friction Local CLI And Headless MCP

Date: 2026-11-04. Status: APPROVED / SOURCE IMPLEMENTATION AUTHORIZED.
Task: [DGM-150](../specs/DGM-150.md).

## Problem

PO request: "also add capability to use the app headless. via cli it can be used
directly (expose cli commands) or via cli it can activate the mcp. idea is that
other local ai tools/agents can use it directly".
Follow-ups: "also add this stuff to the guide";
"lowest possible usage resistance".

The current MCP server is authenticated loopback HTTP and delegates to the live
editor. It is not headless: loading/ownership, dialogs and the renderer can make
the current workspace unavailable. PNG uses browser Image/canvas/font APIs;
layout/assets use Vite workers and bundled URLs. A launcher for the existing
window alone would not meet the request.

## Options

1. Launch the existing GUI and its HTTP server from the command line.
   Small change, but still requires a visible session, editor guards and token
   configuration. Reject: not independent headless operation.
2. Rewrite the renderer for pure Node, add raster/browser dependencies or use a
   separately installed browser. Avoids Electron UI host but duplicates scene,
   font, asset and raster behavior and adds setup. Reject for the initial task.
3. Use the already bundled Electron runtime with a dedicated, sandboxed,
   never-visible worker and shared document/layout/export code. Expose one-shot
   CLI commands and stdio MCP. Recommend: no extra runtime, browser download,
   token copying, port configuration or second drawing implementation.

## Approved Decision

The PO selected "Approve the low-friction CLI and stdio MCP interface
(Recommended)" after reviewing the one-CLI, stdio-default, no visible UI/port
setup/token copying design, explicit CLI file arguments, in-memory MCP edits,
sandboxed rendering worker and guide coverage. This approves the public and
internal headless contracts below, not packaging or external delivery.

- One app executable recognizes CLI commands before normal GUI startup.
  Normal double-click stays unchanged. `--help` and `--version` work without
  creating a worker or starting MCP. A source runner exposes the same grammar.
- Commands: `new`, `validate`, `inspect`, `edit`, `arrange`, `export`,
  `catalog`, `templates`, `mcp`. Defaults are useful and documented;
  machine-readable results go to stdout, diagnostics to stderr, failures use
  nonzero exit codes. Explicit file/stdin inputs and output paths; existing
  outputs are not overwritten unless explicitly requested.
- `mcp` defaults to stdio for local AI clients. It has no listening socket,
  launch secret, login, config mutation or GUI. Startup may read an explicitly
  named JSON file; otherwise use an empty in-memory diagram. Existing diagram
  operations/exports use current-state tokens and shared validation.
- MCP edits stay in process memory; returned JSON/images are saved by the client
  under its own permissions. Do not add general file-read/write or shell tools.
  CLI file IO belongs to explicitly invoked one-shot commands.
- A dedicated worker uses the existing local protocol, bundled resources and
  security settings, with a narrow, active-frame-validated job/result bridge.
  It never mounts the interactive editor or touches GUI autosave/preferences,
  recent files, lock, credentials or profile. Separate disposable runtime data
  and in-memory session allow GUI/headless processes to coexist.
- Reuse protocol dispatch/tool schemas where possible without changing existing
  GUI HTTP authentication, origin restrictions or GUI confirmation behavior.
  Standard streams must remain clean, bounded and cancellable; EOF/interrupt
  shuts down workers and jobs. Headless budgets do not change GUI timeouts.

## Safety, Delivery And Verification

Implementation direction: the existing `createSession` already injects storage,
ownership, layout, export and confirmation dependencies. Prefer reusing its
validated MCP operations with in-memory storage/ownership adapters in the
dedicated renderer, rather than a second command/history engine. No App/Editor
mount, IndexedDB, Web Lock, GUI profile or interactive confirmation belongs in
that host. File paths and one-shot output writing stay in the CLI main process;
the sandboxed worker receives only validated job data and returns bounded
results. Keep CLI smoke/stdio/EOF tests early to catch Windows launch issues
before implementing the full command surface.

The PO approved these new public CLI/stdio and internal privileged worker
contracts on2026-11-04. No dependencies or weakened sandbox,
origin, navigation or network policies are proposed. Source staging/build wiring
may include the new runtime files; no package format/version change, binary
build, release, install, Git delivery or modification of old releases is implied.

TDD and independent actual subprocess tests must prove command outputs, exit
codes, no visible window, clean stdio MCP handshake/tool round trips, file bounds,
overwrite refusal, stale tokens, deterministic shared rendering, EOF cleanup,
GUI profile isolation and unchanged GUI HTTP policy. Windows GUI/portable
executable stdio/exit behavior is a real platform risk, not an assumed pass.
Source Electron checks do not certify a later packaged launcher.

Document actual runnable commands, an AI-client stdio configuration, file
semantics, error recovery and source-versus-installed limitations in the guide.
No global PATH changes, aliases, auto-installed agent configs or persistent
service are needed.
