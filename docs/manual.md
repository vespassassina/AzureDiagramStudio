# Azure Diagram Studio: Short Manual

This manual describes the Sprint 4 source controls, [first-use UI guide](verification/DGM-117.md) and [editor/markup improvements](verification/DGM-118.md). See [Sprint 4 verification](verification/sprint-4-review.md) for the historical passing integration gate (5,488 tests), retained failures and remaining manual checks. The [public 0.2.0 ARM64 prerelease](https://github.com/vespassassina/AzureDiagramStudio/releases/tag/arm64-v0.2.0) is unchanged. The latest [local DGM-121 package](verification/DGM-121.md) includes Help, quick delete, larger handles, corrected Escape gestures/tooltips, context actions and presentation markup, with bounded native automated acceptance. No general platform or human acceptance is inferred. The separate v0.1.0 links below identify the historical stable release.

## Install and Launch

Download from the verified [v0.1.0 release](https://github.com/vespassassina/AzureDiagramStudio/releases/tag/v0.1.0), or use the [README download links](../README.md#release-downloads). The source repository is public. Both portable files bundle the runtime and work without Node.js, a local server or a cloud account.

For the published Windows ARM64 prerelease, use [arm64-v0.2.0](https://github.com/vespassassina/AzureDiagramStudio/releases/tag/arm64-v0.2.0) and its own checksum manifest. There is no 0.2.0 x64/Mac asset in that release. Its attached source candidate ZIP, not GitHub's automatic tag archives, contains that older verified candidate; at its publication no source branch was pushed. The later source milestone and local guide package do not replace those release assets.

1. In Windows **Settings > System > About**, check **System type**. Choose **ARM64** for Windows on ARM/Snapdragon, or **x64** for Intel/AMD Windows PCs.
2. Choose the matching `Azure-Diagram-Studio-0.1.0-win-{arch}-portable.exe` and [SHA256SUMS.txt](https://github.com/vespassassina/AzureDiagramStudio/releases/download/v0.1.0/SHA256SUMS.txt) from the same release. Downloads are approximately 403-404 MB.
3. Compare `Get-FileHash '.\your-downloaded-file.exe' -Algorithm SHA256` with the matching manifest entry. A mismatch means do not run the file.
4. Launch the portable executable. No separate Node.js installation or cloud sign-in is needed for the packaged runtime. Unsigned executables can trigger SmartScreen: follow your organization's policy, and do not disable security protections.

Source/browser setup is in the [README](../README.md#build-from-source). Packaged offline launch, workers, image import, exports, themes and autosave/relaunch were tested. ARM64 ran natively; x64 ran under Windows ARM64 emulation rather than native Intel/AMD hardware. SmartScreen behavior and native save-dialog appearance remain manual checks. Browser diagrams do not automatically appear in desktop: Save JSON in the browser and Open JSON in the executable.

The current **published 0.2.0 ARM64 candidate** passed independent automated portable-runtime checks: layout/undo, custom images, JSON/SVG/PNG output, themes and autosave after moving/relaunching the executable. See the [ARM64 runtime report](verification/DGM-113-windows-arm64.md) and [publication report](verification/release-0.2.0-arm64.md) for the exact artifact, hashes and retained failures. It remains unsigned and prerelease. Network-offline emulation is not physical-disconnection, SmartScreen, native-dialog or Teams/Office acceptance.

## Latest Local Editor And Markup ARM64 Package

[Open the rebuilt local portable](../app/test-results/platform/windows-arm64/20261016T165838092Z/candidate/app/release/Azure-Diagram-Studio-0.2.0-win-arm64-portable.exe).
This unsigned 0.2.0 package is **403,360,240 bytes** and contains the accepted
editor/markup source from merge `15a3438`. It is not a new public binary release.

```text
SHA256 94e6cf183dd36e4577b99ab55957b7f8a7c9b0fbb61021a6e0fc2bab22c2baeb
```

The [DGM-121 report](verification/DGM-121.md) records 10 accepted general groups
(nine dated passes plus a fresh final continuation), 10 fresh targeted native
groups, retained driver failures/repairs and identity-checked cleanup. The driver
repair is outside the packaged ASAR; executable bytes did not change for it.

The PO launch uses a separate persistent profile beneath
`app/test-results/platform/windows-arm64/20261016T165838092Z/po-profile/`
through the existing `--user-data-dir` option, without debugger flags. It does
not migrate or clear earlier diagrams. Old PID31104 disappeared during the
build without an agent close/kill; its cause and unsaved state are UNKNOWN.
The old profile was not read or reopened. Transfer previously exported diagrams
using Open JSON; do not clear a profile or disable SmartScreen to force access.

The source milestone is
[source-v0.2.0-dgm120](https://github.com/vespassassina/AzureDiagramStudio/tree/source-v0.2.0-dgm120).
It includes the tested harness and delivery documentation; package provenance
identifies its earlier executable-input merge separately. Physical offline,
downloaded-file policy, human dialogs/IME/clipboard, Teams/Office, novice and
other-platform acceptance remain separate.

## Local Current-Guide ARM64 Candidate

This preceding Help-only candidate remains unchanged; the later DGM-121 package
above adds the editor gestures, context menu and presentation markup.

The [new local portable EXE](../app/test-results/platform/windows-arm64/20261016T130515040Z/candidate/app/release/Azure-Diagram-Studio-0.2.0-win-arm64-portable.exe)
contains the Help guide from merged source `52f6630`. It is unsigned, version
0.2.0, **403,339,602 bytes**, and is not a new public release. Its identical
version/filename does not make it the older prerelease artifact.

SHA256:

```text
89eefd80ccfa78ef5ceb7fb366e980df05dd42d728d4476ae34db240023b9f8c
```

Compare `Get-FileHash -Algorithm SHA256` for this exact EXE before running it.
Use a native Windows ARM64 device, follow normal organizational protections,
and do not disable SmartScreen. Keep JSON backups and do not clear existing
profiles to test ownership. The [current native report](verification/DGM-113-windows-arm64-guide.md)
records passing automated desktop/Help checks, retained failures, isolation and
cleanup. It does not establish physical offline, downloaded-file policy, human
file dialogs/IME/clipboard, Teams/Office or novice acceptance. Those are the
next human checks; publication remains a separate decision.

## First-Use UI Guide

Choose the question-mark **Help** button at the top of the left tool rail.
The ten numbered callouts cover starting and naming a diagram, adding components,
navigating, connecting and annotating, editing properties, arranging, saving
editable JSON, exporting artwork and presenting. Each callout highlights the
corresponding control; **Next** and **Back** move through the guide without
executing those actions. Close the guide to try them in the editor.

Use **Close guide**, Escape or the final **Finish** button to return to editing.
Tab and Shift+Tab stay within the guide, and closing returns focus to Help.
Library and Properties panels may open temporarily for a step; closing restores
the previous panel choice without changing the document, selection, camera or
pending label/title draft. The guide is available in Read-only mode, does not
start automatically and can be replayed from Help at any time while editing.

## Start With an Example

Use **Open JSON** and select [Azure web/API](../examples/azure-web-app.json), [Fabric/OneLake](../examples/fabric-onelake.json), [event-driven integration](../examples/event-driven.json) or [Microsoft/enterprise integration](../examples/enterprise-integration.json). These are native schema-1 documents, not skill-import files. All components are synthetic illustrations; none asserts a real deployment or verified integration.

Choose **New diagram**, then **Blank** or one of the four bundled synthetic starters. Escape or Close cancels the chooser without replacing work; opening or canceling it preserves an active label/property draft. An explicit choice uses the existing replacement confirmation and draft-validation rules. A starter is a fresh editable copy and needs its own JSON backup; it is not a deployed architecture. Save a JSON backup before replacing work. Edit the document title in the top bar; use **Document properties** for its subtitle.

## Add and Find Components

Open the component library and use **Search components**. **Azure / Microsoft** has eight top-level groups, including **Microsoft Fabric** and **Microsoft Apps**. Each group starts with up to four familiar choices, followed by an alphabetical tail; search includes the remaining current choices. For OneLake, expand **Microsoft Fabric**, or search `OneLake`. **Software** contains generic components and the **Vendors** group; HP and HPE are separate choices.

Microsoft Apps includes five official architecture glyphs, seven bundled Microsoft product PNGs and two original named badges. Vendors contains 17 bundled vendor PNG icons. Their presence is not evidence of a working integration; consult the included notices for trademark limitations.

Choose a service, then click the canvas to place it; alternatively drag it from the library. Select the placed component to edit **Label**, **Subtitle**, **Type**, **Status**, **Color** or **Hex color** in Properties. A familiar menu name and a raw icon-archive filename are not necessarily the same thing.

Search also recognizes familiar aliases such as `APIM`, `AAD`, `Entra ID`, `ACA` and `AKS`. Use arrow keys and Enter to choose a result, or Escape to cancel. Favorites (up to 12) and recent successful insertions (up to 8) last only for the current editor session; clearing them does not change the diagram.

## Import an Icon

Use **Import custom icon** with SVG, PNG, JPEG, GIF or WebP artwork you own or have permission to use. With one component selected, import replaces its displayed icon, preserving its label, type, connections and other properties; **Replace component icon** in Properties does the same. With nothing selected, import adds a component at the canvas center. Canceling the file picker leaves the document unchanged; unsafe SVG or invalid images show an error without changing it. Import is disabled in **Read-only** mode.

Files may be at most **2 MiB**. Imported SVG is validated and rasterized, not stored as executable/vector markup; GIF uses its first frame. Every custom icon becomes a PNG with a maximum **512 px** per side and **384 KiB** encoded data URL. Oversized source dimensions or an image that cannot meet these limits are rejected. Built-in glyphs and named badges remain vector artwork in SVG export.

Select the component and use **Clear custom icon** to restore its built-in type. Changing **Type** also clears the custom image. Either action is one undoable edit; use **Undo** to restore the previous type/image together. The [SimpleBadge SVG](../examples/simple-badge.svg) and [PNG](../examples/simple-badge.png) are original noncorporate samples for trying import.

## Editor Theme

The theme button is labeled **Switch to dark theme** in light mode and **Switch to light theme** in dark mode. On first load the editor follows the system's light/dark preference, unless you have explicitly saved a choice. Your choice is local to that browser/desktop profile, not part of a diagram. Changing it does not change document colors, JSON, SVG or PNG exports.

The surrounding editor chrome follows the chosen theme. The diagram background defaults to white but can be changed independently in **Document properties**; Present and opaque diagram exports use that saved color.

## Background and Grid

In **Document properties**, use the background color picker or hex input (`#RGB` or `#RRGGBB`). Reset restores the white default. Changing background does not move objects or change their saved colors.

**Show grid** and **Snap to grid** are independent. Choose **Dots** or **Lines** and integer **Grid spacing** from 4 to 128. Snapping uses a shared canvas origin, including nested objects; switching it off permits free placement without moving existing content. **Show grid in Present** and **Include grid in exports** are separate opt-ins. Auto-arrange is not quantized to this grid.

## Connect and Describe Flows

Choose **Connect components**, click the source and then the target. You can also drag from a component's connector handle to another component. Select a connection to edit its **Label**, **Source**, **Target**, **Source side**, **Target side**, **Line** and **Direction**.

Connection dots now have larger visible and pointer-hit areas. Press Escape
while holding a component move, multi-selection move, resize, connection,
reconnection or library drag to cancel it; releasing afterward does not commit
the canceled gesture. A fresh drag starts normally.

Use a short action such as `Load`, `Queue work` or `Read secrets`. A solid/dashed line describes your chosen meaning, not a verified integration. To insert a component in an existing connection, select the connection and use **Insert component**, then **Insert on connection**.

With a single component or boundary selected, use a directional **Add connected component** button and choose a service. It adds the new component and connection together in one undoable action. A boundary adds a child; a component adds a sibling. Ancestors may expand to contain it, while existing content keeps its canvas position. Escape cancels without changing the diagram.

With one component selected, the same small toolbar also has **Delete component**
(trash icon). It removes that component and its incident connections; one Undo
restores them. It does not delete unrelated selected content and is unavailable
when editing is disabled.

## Direct Editing and Commands

Double-click a component, connection label or text note, or select it and press F2, to edit inline. Enter commits a single-line label; Escape cancels. For notes, Enter adds a newline and Ctrl/Command+Enter commits. Leaving a valid field commits once; invalid content remains editable with an error. These edits are disabled in Present and Read-only mode.

Choose **Commands**, or Ctrl/Command+K while the editor owns focus, to search existing actions. Arrow keys and Enter choose an enabled action; Escape closes the menu and returns focus. Text fields retain their own shortcuts. Background and grid commands focus the corresponding document setting.

Right-click a component, connection or canvas to open **Canvas actions** for
that target: add a component/boundary/text/rectangle at the clicked point,
connect from a component, copy, duplicate, delete, Undo/Redo, paste or Properties
where applicable. Properties on blank canvas means document properties. Adding
an item does not replace the diagram. A right-button pan drag does not execute
an action. Shift+F10 or the ContextMenu key opens the menu from editor focus;
Arrow/Home/End navigate, Enter/Space activate, and Escape/Tab/outside click close.
Read-only and modal/presentation guards still apply.

## Group, Move and Arrange

Use **Select tool** to move objects. Shift-click objects for a multiple selection, then choose **Group selection** to create a boundary. Select a boundary and use **Ungroup selection** to dissolve it without deleting its contents.

Use **Add boundary** to draw an ownership/trust area, and **Parent** in Properties to assign selected objects to it. Merely placing an object over a boundary does not prove parent membership. Resize a selected boundary using its visible handles.

For a same-parent selection, use **Align left**, **Align center** (horizontal centers) or **Align top** in the selection tools or Commands. Alignment needs at least two selected roots; its anchor is the first root in document order, not the first object clicked. **Distribute horizontally** and **Distribute vertically** need at least three roots and equalize gaps between object edges while retaining the outside ends. A selected boundary moves its subtree once, even when a descendant is also selected.

These commands do not snap their results to the grid or run Auto-arrange. Mixed-parent selections, connections, negative distribution gaps, unchanged results and moves that would change containment are unavailable. They do not grow boundaries or resize content. An accepted action is one undoable move; editing remains disabled in Present and Read-only mode.

Choose **Right layout** or **Down layout**, then **Auto-arrange**. Changing direction alone does not rearrange the document. Auto-arrange is explicit and undoable; it can replace carefully curated example routing. Use **Undo** to restore that layout. Annotations retain their canvas positions during arrangement.

Arrangement now sizes boundaries from their contents and wrapped headers instead of inheriting obsolete expanded dimensions. Removing children and arranging again can shrink a boundary. Ordinary editing still does not rearrange unrelated objects.

Use **Pan tool**, **Zoom in**, **Zoom out** and **Fit diagram** to navigate. **Fit selection** frames selected objects, including a selected boundary's descendants; it changes only the camera. Select objects for **Copy selection**, **Cut selection**, **Duplicate selection** or **Delete selection**; use **Paste selection** to paste within the editor. This selection clipboard is not a JSON file backup or a promise of cross-application clipboard transfer.

The inspector starts closed. On constrained screens, opening Properties or the library swaps the active panel. **Pin component library** allows both panels on desktop. On small/short screens, scroll the tool rail to reach remaining commands; mobile drawer navigation stays below the drawer. Icon descriptions appear on keyboard focus as well as hover, then dismiss on interaction, pointer leave, Escape or layout/mode changes rather than remaining pinned by mouse-created focus.

## Present in a Meeting

Choose **Present** to hide editing controls, handles and selection outlines. Grid is hidden unless **Show grid in Present** is enabled. With objects selected, entry frames their content; with nothing selected, it frames the whole diagram. Use **Fit diagram** to return to the full architecture or **Fit selection** for the retained selection. Content outside a focused selection can still be visible when panning: this is focus, not redaction.

Pan and zoom remain available in **Navigate**, the initial markup mode. **Presentation pointer** shows a temporary pointer; it follows pointer movement and supports arrow keys when focused. It is not saved or included in exports. **Fullscreen presentation** is optional; if denied, presentation continues in the window. **Exit**, or Escape when no drawing stroke is active, restores the previous camera, panel preferences, selection and tool. A storage-lock change still applies after exit.

Choose **Draw** (pencil) for temporary whiteboard markup. Pick red, blue, green,
yellow or black; red is initially selected. Primary click+drag draws a thick
round freehand line. Shift+drag draws a rectangle, Alt+drag an ellipse, and
Ctrl/Command+drag a straight arrow. When modifiers are combined, arrow takes
precedence over ellipse, then rectangle. A stroke keeps the shape chosen when
the drag started; reverse-direction drags also work.

Escape during a stroke cancels that stroke and stays in Present. The local
**Undo markup**, **Redo markup** and **Clear markup** controls affect only ink;
Clear can be undone. Ctrl/Command+Z and redo variants work while Draw owns focus.
Switch to Navigate to pan, or use zoom controls; ink follows diagram coordinates.
Read-only diagrams can be marked up without editing their saved contents.
Markup is not saved, exported or added to diagram history, and is discarded on
Exit/re-entry. Empty clicks do not create empty ink objects.

Document editing, drag/drop, imports, arrange and mutation shortcuts are blocked during Present. Pending file/image/layout operations are invalidated on entry. Existing autosave of a previously committed edit can finish. Present does not remove customer names, hide OS notifications or control Teams sharing. Choose appropriate content and share the intended window. Actual Teams recipient readability and native fullscreen Escape remain manual checks.

## Annotations, Status and Legend

Use **Add text** for notes and **Add rectangle** for framing. Selected objects expose **Bring forward**, **Send backward**, **Bring to top** and **Send to bottom** in Properties. These reorder applicable siblings while retaining parent/child visibility and semantic render bands: default foreground tiles stay above connection lines, and lines stay above containers. Ordering alone does not change geometry or routes; an already-extreme action is a no-op. Text/rectangles can also be resized.

Component **Status** can be **Unset**, **Live**, **Planned**, **Not connected** or **Synthetic**. Unset is not evidence of live deployment. Use Live only for a state you have verified; leave illustrative content Synthetic. In **Document properties**, **Synthetic** labels the whole diagram, and **Show legend** controls the legend. The legend reflects colors and explicit statuses, plus any entries already stored in the document.

## Save, Open and Import

- **Loading local work**, **Saving locally** and **Saved on this device** describe local storage, not a transferable file backup. **Editable JSON copy needed** independently means choose **Save JSON** for newer work.
- **Local save failed** means local storage did not succeed. Download JSON now; free storage and edit again to retry. A successful JSON callback does not turn a local failure into local success.
- **Save JSON** downloads an editable native document. **No newer JSON changes** means the current revision's download callback completed, not that the OS acknowledged a durable file write. Check the downloaded file, keep copies somewhere backed up, and version important milestones. Native save-dialog cancellation/completion remains unverified.
- Custom icons are embedded PNG data in that backup, not links to local files. Native JSON and skill JSON have a **5 MiB** limit for the whole file, including embedded images; many icons can reach that limit.
- **Open JSON** opens that native document, including these examples. It replaces the active document after any applicable confirmation.
- **Import skill JSON** is separate: it accepts architecture-skill specifications and reports import warnings. Check labels, grouping, unsupported icons and connection meanings after importing.
- If the session shows **Read-only**, another session may own editing. You can still save a JSON backup; close the other editing session and let the app reacquire ownership. Do not clear storage to force ownership.

The schema stays at version 1 with optional custom-icon, numeric-order, background and grid fields. Older documents still open, but a pre-feature client is not a safe way to edit and resave a document containing these fields: it may reject or lose fields it does not support. Keep the original backup and use a current client.

## Export Pictures

Open **Export** to preview the picture. Choose **All** or **Selection**, then **Content** or **16:9** framing. Selection includes descendants and internal connections, not unrelated objects or external connections; diagram metadata and the scoped visible legend remain included. Framing adds space without stretching artwork.

Choose **Diagram**, **White** or **Transparent** background and optionally **Include grid**. These output settings do not change the saved diagram. Use **SVG**, **PNG 1x** or **PNG 2x** to download; **Copy image** copies a PNG for pasting. If clipboard access is denied, the app downloads a PNG and reports that it was not copied. Browser clipboard verification does not establish Teams/Office paste fidelity, which remains a manual check.

Use SVG for scalable diagrams and PNG for a fixed-size image. Large PNGs are capped at 8192 pixels per side and 16,777,216 total pixels; use 1x or SVG if the requested image is too large. Pictures do not replace the editable JSON backup.

## Local Data and Backups

Desktop autosave uses Electron's per-user Windows data profile, separate from the install folder or portable executable. Browser autosave belongs to its browser profile and origin. Different localhost ports, browsers and desktop are separate stores; there is no automatic transfer from the old browser editor.

To transfer: **Save JSON** in the old editor, then **Open JSON** in the new one. Moving only the executable to another computer does not move your diagrams. Before removing the app or deleting any browser/profile data, export and verify JSON backups. Removing the executable alone is not a request to erase the Windows profile.

## Limits and Notices

This is a local drawing tool, not a cloud deployment, inventory, authentication or live-service validation tool. Boundary labels are documentation, not enforced network isolation. No collaboration backend or automatic update service is included. Native JSON and supported skill JSON are document inputs; image import changes a component icon, not a whole diagram. Earlier packaged offline results apply only to their identified artifacts; local builds do not qualify the current source or a different release. See the [platform readiness packet](specs/DGM-113.md) for target-specific blockers.

The catalogs are curated snapshots, not a promise of every service/SKU. Historical glyphs may remain in older documents without appearing as new choices. PowerPoint insertion fidelity and uncoached novice usability remain manually unverified.

Azure Diagram Studio is independent and not endorsed by Microsoft or the named vendors. Microsoft glyphs are for permitted architecture/training/documentation use, not our product logo or a general marketing/sublicensing grant. Preserve the [third-party notices](../app/public/THIRD-PARTY-NOTICES.md), [Microsoft application sources and classifications](../app/public/MICROSOFT-APP-NOTICES.md), [vendor badge notices](../app/public/VENDOR-NOTICES.md) and [original terms](../app/public/licenses/). No project open-source license has been selected. Contributors must have rights to their uploaded artwork.