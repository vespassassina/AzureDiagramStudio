# Azure Diagram Studio: Short Manual

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

## Import an Icon

Use **Import custom icon** with SVG, PNG, JPEG, GIF or WebP artwork you own or have permission to use. With one component selected, import replaces its displayed icon, preserving its label, type, connections and other properties; **Replace component icon** in Properties does the same. With nothing selected, import adds a component at the canvas center. Canceling the file picker leaves the document unchanged; unsafe SVG or invalid images show an error without changing it. Import is disabled in **Read-only** mode.

Files may be at most **2 MiB**. Imported SVG is validated and rasterized, not stored as executable/vector markup; GIF uses its first frame. Every custom icon becomes a PNG with a maximum **512 px** per side and **384 KiB** encoded data URL. Oversized source dimensions or an image that cannot meet these limits are rejected. Built-in glyphs and named badges remain vector artwork in SVG export.

Select the component and use **Clear custom icon** to restore its built-in type. Changing **Type** also clears the custom image. Either action is one undoable edit; use **Undo** to restore the previous type/image together. The [SimpleBadge SVG](../examples/simple-badge.svg) and [PNG](../examples/simple-badge.png) are original noncorporate samples for trying import.

## Editor Theme

The theme button is labeled **Switch to dark theme** in light mode and **Switch to light theme** in dark mode. On first load the editor follows the system's light/dark preference, unless you have explicitly saved a choice. Your choice is local to that browser/desktop profile, not part of a diagram. Changing it does not change document colors, JSON, SVG or PNG exports.

## Connect and Describe Flows

Choose **Connect components**, click the source and then the target. You can also drag from a component's connector handle to another component. Select a connection to edit its **Label**, **Source**, **Target**, **Source side**, **Target side**, **Line** and **Direction**.

Use a short action such as `Load`, `Queue work` or `Read secrets`. A solid/dashed line describes your chosen meaning, not a verified integration. To insert a component in an existing connection, select the connection and use **Insert component**, then **Insert on connection**.

## Group, Move and Arrange

Use **Select tool** to move objects. Shift-click objects for a multiple selection, then choose **Group selection** to create a boundary. Select a boundary and use **Ungroup selection** to dissolve it without deleting its contents.

Use **Add boundary** to draw an ownership/trust area, and **Parent** in Properties to assign selected objects to it. Merely placing an object over a boundary does not prove parent membership. Resize a selected boundary using its visible handles.

Choose **Right layout** or **Down layout**, then **Auto-arrange**. Changing direction alone does not rearrange the document. Auto-arrange is explicit and undoable; it can replace carefully curated example routing. Use **Undo** to restore that layout. Annotations retain their canvas positions during arrangement.

Use **Pan tool**, **Zoom in**, **Zoom out** and **Fit diagram** to navigate. Select objects for **Copy selection**, **Cut selection**, **Duplicate selection** or **Delete selection**; use **Paste selection** to paste within the editor. This selection clipboard is not a JSON file backup or a promise of cross-application clipboard transfer.

## Annotations, Status and Legend

Use **Add text** for notes and **Add rectangle** for framing. Select text/rectangles to resize them or choose **Bring to foreground** / **Send to background**.

Component **Status** can be **Unset**, **Live**, **Planned**, **Not connected** or **Synthetic**. Unset is not evidence of live deployment. Use Live only for a state you have verified; leave illustrative content Synthetic. In **Document properties**, **Synthetic** labels the whole diagram, and **Show legend** controls the legend. The legend reflects colors and explicit statuses, plus any entries already stored in the document.

## Save, Open and Import

- **Saved** means local autosave succeeded. **JSON backup needed** means your transferable file backup is not current: choose **Save JSON**.
- **Save JSON** writes an editable native document. Keep copies somewhere backed up, and version important milestones.
- Custom icons are embedded PNG data in that backup, not links to local files. Native JSON and skill JSON have a **5 MiB** limit for the whole file, including embedded images; many icons can reach that limit.
- **Open JSON** opens that native document, including these examples. It replaces the active document after any applicable confirmation.
- **Import skill JSON** is separate: it accepts architecture-skill specifications and reports import warnings. Check labels, grouping, unsupported icons and connection meanings after importing.
- If the session shows **Read-only**, another session may own editing. You can still save a JSON backup; close the other editing session and let the app reacquire ownership. Do not clear storage to force ownership.

The schema stays at version 1 with an optional custom-icon field. Older documents still open, but a pre-feature client is not a safe way to edit and resave a document containing custom images: it may reject or lose fields it does not support. Keep the original backup and use a current client.

## Export Pictures

Open **Export** and choose **SVG**, **PNG 1x** or **PNG 2x**. SVG contains native text with bundled font and icon data; PNG is raster output. Enable **Transparent background** when needed. Exports include the diagram metadata and visible legend, not the editor chrome.

Use SVG for scalable diagrams and PNG for a fixed-size image. Large PNGs are capped at 8192 pixels per side and 16,777,216 total pixels; use 1x or SVG if the requested image is too large. Pictures do not replace the editable JSON backup.

## Local Data and Backups

Desktop autosave uses Electron's per-user Windows data profile, separate from the install folder or portable executable. Browser autosave belongs to its browser profile and origin. Different localhost ports, browsers and desktop are separate stores; there is no automatic transfer from the old browser editor.

To transfer: **Save JSON** in the old editor, then **Open JSON** in the new one. Moving only the executable to another computer does not move your diagrams. Before removing the app or deleting any browser/profile data, export and verify JSON backups. Removing the executable alone is not a request to erase the Windows profile.

## Limits and Notices

This is a local drawing tool, not a cloud deployment, inventory, authentication or live-service validation tool. Boundary labels are documentation, not enforced network isolation. No collaboration backend or automatic update service is included. Native JSON and supported skill JSON are document inputs; image import changes a component icon, not a whole diagram. The packaged runtime is designed for complete offline use, but final packaged/offline verification remains pending.

The catalogs are curated snapshots, not a promise of every service/SKU. Historical glyphs may remain in older documents without appearing as new choices. PowerPoint insertion fidelity and uncoached novice usability remain manually unverified.

Azure Diagram Studio is independent and not endorsed by Microsoft or the named vendors. Microsoft glyphs are for permitted architecture/training/documentation use, not our product logo or a general marketing/sublicensing grant. Preserve the [third-party notices](../app/public/THIRD-PARTY-NOTICES.md), [Microsoft application sources and classifications](../app/public/MICROSOFT-APP-NOTICES.md), [vendor badge notices](../app/public/VENDOR-NOTICES.md) and [original terms](../app/public/licenses/). No project open-source license has been selected. Contributors must have rights to their uploaded artwork.