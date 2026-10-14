# Azure Diagram Studio: Short Manual

This manual includes the Sprint 3 source candidate. Existing v0.1.0 executables have not been rebuilt or republished with these changes; see [Sprint 3 verification](verification/sprint-3-review.md) for the tested browser build and remaining manual checks.

## Install and Launch

Download from the verified [v0.1.0 release](https://github.com/vespassassina/AzureDiagramStudio/releases/tag/v0.1.0), or use the [README download links](../README.md#release-downloads). The source repository is public. Both portable files bundle the runtime and work without Node.js, a local server or a cloud account.

1. In Windows **Settings > System > About**, check **System type**. Choose **ARM64** for Windows on ARM/Snapdragon, or **x64** for Intel/AMD Windows PCs.
2. Choose the matching `Azure-Diagram-Studio-0.1.0-win-{arch}-portable.exe` and [SHA256SUMS.txt](https://github.com/vespassassina/AzureDiagramStudio/releases/download/v0.1.0/SHA256SUMS.txt) from the same release. Downloads are approximately 403-404 MB.
3. Compare `Get-FileHash '.\your-downloaded-file.exe' -Algorithm SHA256` with the matching manifest entry. A mismatch means do not run the file.
4. Launch the portable executable. No separate Node.js installation or cloud sign-in is needed for the packaged runtime. Unsigned executables can trigger SmartScreen: follow your organization's policy, and do not disable security protections.

Source/browser setup is in the [README](../README.md#build-from-source). Packaged offline launch, workers, image import, exports, themes and autosave/relaunch were tested. ARM64 ran natively; x64 ran under Windows ARM64 emulation rather than native Intel/AMD hardware. SmartScreen behavior and native save-dialog appearance remain manual checks. Browser diagrams do not automatically appear in desktop: Save JSON in the browser and Open JSON in the executable.

## Start With an Example

Use **Open JSON** and select [Azure web/API](../examples/azure-web-app.json), [Fabric/OneLake](../examples/fabric-onelake.json), [event-driven integration](../examples/event-driven.json) or [Microsoft/enterprise integration](../examples/enterprise-integration.json). These are native schema-1 documents, not skill-import files. All components are synthetic illustrations; none asserts a real deployment or verified integration.

Use **New diagram** for a blank document. Save a JSON backup before replacing work. Edit the document title in the top bar; use **Document properties** for its subtitle.

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

Use a short action such as `Load`, `Queue work` or `Read secrets`. A solid/dashed line describes your chosen meaning, not a verified integration. To insert a component in an existing connection, select the connection and use **Insert component**, then **Insert on connection**.

With a single component or boundary selected, use a directional **Add connected component** button and choose a service. It adds the new component and connection together in one undoable action. A boundary adds a child; a component adds a sibling. Ancestors may expand to contain it, while existing content keeps its canvas position. Escape cancels without changing the diagram.

## Direct Editing and Commands

Double-click a component, connection label or text note, or select it and press F2, to edit inline. Enter commits a single-line label; Escape cancels. For notes, Enter adds a newline and Ctrl/Command+Enter commits. Leaving a valid field commits once; invalid content remains editable with an error. These edits are disabled in Present and Read-only mode.

Choose **Commands**, or Ctrl/Command+K while the editor owns focus, to search existing actions. Arrow keys and Enter choose an enabled action; Escape closes the menu and returns focus. Text fields retain their own shortcuts. Background and grid commands focus the corresponding document setting.

## Group, Move and Arrange

Use **Select tool** to move objects. Shift-click objects for a multiple selection, then choose **Group selection** to create a boundary. Select a boundary and use **Ungroup selection** to dissolve it without deleting its contents.

Use **Add boundary** to draw an ownership/trust area, and **Parent** in Properties to assign selected objects to it. Merely placing an object over a boundary does not prove parent membership. Resize a selected boundary using its visible handles.

Choose **Right layout** or **Down layout**, then **Auto-arrange**. Changing direction alone does not rearrange the document. Auto-arrange is explicit and undoable; it can replace carefully curated example routing. Use **Undo** to restore that layout. Annotations retain their canvas positions during arrangement.

Arrangement now sizes boundaries from their contents and wrapped headers instead of inheriting obsolete expanded dimensions. Removing children and arranging again can shrink a boundary. Ordinary editing still does not rearrange unrelated objects.

Use **Pan tool**, **Zoom in**, **Zoom out** and **Fit diagram** to navigate. **Fit selection** frames selected objects, including a selected boundary's descendants; it changes only the camera. Select objects for **Copy selection**, **Cut selection**, **Duplicate selection** or **Delete selection**; use **Paste selection** to paste within the editor. This selection clipboard is not a JSON file backup or a promise of cross-application clipboard transfer.

The inspector starts closed. On constrained screens, opening Properties or the library swaps the active panel. **Pin component library** allows both panels on desktop. On small/short screens, scroll the tool rail to reach remaining commands; mobile drawer navigation stays below the drawer. Icon descriptions appear on keyboard focus as well as hover.

## Present in a Meeting

Choose **Present** to hide editing controls, handles and selection outlines. Grid is hidden unless **Show grid in Present** is enabled. With objects selected, entry frames their content; with nothing selected, it frames the whole diagram. Use **Fit diagram** to return to the full architecture or **Fit selection** for the retained selection. Content outside a focused selection can still be visible when panning: this is focus, not redaction.

Pan and zoom remain available. **Presentation pointer** shows a temporary pointer; it follows pointer movement and supports arrow keys when focused. It is not saved or included in exports. **Fullscreen presentation** is optional; if denied, presentation continues in the window. **Exit** or Escape restores the previous camera, panel preferences, selection and tool. A storage-lock change still applies after exit.

Document editing, drag/drop, imports, arrange and mutation shortcuts are blocked during Present. Pending file/image/layout operations are invalidated on entry. Existing autosave of a previously committed edit can finish. Present does not remove customer names, hide OS notifications or control Teams sharing. Choose appropriate content and share the intended window. Actual Teams recipient readability and native fullscreen Escape remain manual checks.

## Annotations, Status and Legend

Use **Add text** for notes and **Add rectangle** for framing. Selected objects expose **Bring forward**, **Send backward**, **Bring to top** and **Send to bottom** in Properties. These reorder applicable siblings while retaining parent/child visibility and semantic render bands: default foreground tiles stay above connection lines, and lines stay above containers. Ordering alone does not change geometry or routes; an already-extreme action is a no-op. Text/rectangles can also be resized.

Component **Status** can be **Unset**, **Live**, **Planned**, **Not connected** or **Synthetic**. Unset is not evidence of live deployment. Use Live only for a state you have verified; leave illustrative content Synthetic. In **Document properties**, **Synthetic** labels the whole diagram, and **Show legend** controls the legend. The legend reflects colors and explicit statuses, plus any entries already stored in the document.

## Save, Open and Import

- **Saved** means local autosave succeeded. **JSON backup needed** means your transferable file backup is not current: choose **Save JSON**.
- **Save JSON** writes an editable native document. Keep copies somewhere backed up, and version important milestones.
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

This is a local drawing tool, not a cloud deployment, inventory, authentication or live-service validation tool. Boundary labels are documentation, not enforced network isolation. No collaboration backend or automatic update service is included. Native JSON and supported skill JSON are document inputs; image import changes a component icon, not a whole diagram. Earlier packaged offline results apply to the earlier release, not to this unbuilt Sprint 3 desktop candidate.

The catalogs are curated snapshots, not a promise of every service/SKU. Historical glyphs may remain in older documents without appearing as new choices. PowerPoint insertion fidelity and uncoached novice usability remain manually unverified.

Azure Diagram Studio is independent and not endorsed by Microsoft or the named vendors. Microsoft glyphs are for permitted architecture/training/documentation use, not our product logo or a general marketing/sublicensing grant. Preserve the [third-party notices](../app/public/THIRD-PARTY-NOTICES.md), [Microsoft application sources and classifications](../app/public/MICROSOFT-APP-NOTICES.md), [vendor badge notices](../app/public/VENDOR-NOTICES.md) and [original terms](../app/public/licenses/). No project open-source license has been selected. Contributors must have rights to their uploaded artwork.