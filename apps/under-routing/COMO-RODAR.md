# How to run in VS Code

The app is made of static files (HTML/CSS/JS). Because it uses **ES modules**,
`index.html` must be served over `http://` — opening `index.html` directly
with a double-click (file://) does **not** load the modules.

Choose **one** of the options below.

## Option 1 — Live Server (easiest in VS Code) ✅
1. Open the folder in VS Code: **File → Open Folder…** and select this folder.
2. Install the recommended **Live Server** extension (VS Code will suggest it
   when you open the folder; or search for `ritwickdey.LiveServer` in Extensions).
3. Right-click **`index.html` → "Open with Live Server"**.
   The browser opens at `http://127.0.0.1:5510` with the app running.

## Option 2 — Terminal (npm)
In the VS Code integrated terminal (**Terminal → New Terminal**):
```bash
npm start
```
This starts a local server and opens the browser at `http://localhost:8099`.
(Requires Node.js installed: https://nodejs.org)

## Option 3 — Python (no Node)
```bash
python -m http.server 8099
```
Then open `http://localhost:8099` in the browser.

## Option 4 — No server at all
Open the **`standalone.html`** file with a double-click. It is the same app
bundled into a single file (all CSS/JS inlined), so it works directly via file://.
Great for a quick look; for development, prefer options 1–3.

---

## How to use the app
1. Open it → the **SETUP** dialog shows a sample panel. Adjust the name,
   number of columns (each one = 3 ft / 36 in) and labels; click **Save panels**.
   The drawing automatically includes a 4.156 in **END SECTION** at the start
   and another at the end of the panel; they do not accept loads.
2. **Drag the panel** to reposition it; click it and use the **↻** handle to
   rotate it 90° (the column order is always preserved).
3. Click an empty spot → enter **tag / panel / column** → the load is added
   already routed. Drag to move it; **double-click** deletes it.
4. Click **DRAW FOUNDATION** and drag on the plan to draw a rectangular deep
   foundation. Routes now go around it with **12 in of clearance**.
   Drag the foundation to move it; select it and drag a corner to resize it;
   **double-click** to delete it.
5. Click **DRAW REC** and drag to add a labelled drawing rectangle. Select it
   and drag a corner to change its width and length.
6. Routes use only **45° bends** + straight runs, seek the **shortest
   path**, and the app tries several orderings to **reduce crossings**.
   The status bar shows routes / crossings / blocked routes / foundations
   / total length. A connection inside a foundation is shown dashed in
   red and counted as **BLOCKED**.
7. **EXPORT PDF** opens a print-ready version (Save as PDF).
