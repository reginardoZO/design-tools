# LV Cable Voltage Drop

Web app to compute low-voltage cable voltage drop using Southwire / NEC Chapter 9
Table 9 parameters (R, X at 75°C in PVC conduit). It suggests the next valid cable
to keep the drop under 5% and checks 75°C ampacity (NEC 310.16).

## Publish to GitHub Pages (automatic, recommended)

1. Create a new repository on GitHub (public), e.g. `lv-voltage-drop`.
2. From this folder, push the code:

   ```bash
   git init
   git add .
   git commit -m "LV voltage drop app"
   git branch -M main
   git remote add origin https://github.com/<your-user>/<your-repo>.git
   git push -u origin main
   ```

3. On GitHub: **Settings -> Pages -> Build and deployment -> Source: GitHub Actions**.
4. The included workflow builds and deploys on every push to `main`.
   Your site will be at `https://<your-user>.github.io/<your-repo>/`.

## Run locally

```bash
npm install
npm run dev
```

## Notes
- `vite.config.js` uses `base: "./"` so assets load correctly from any repo path.
- Support tool only; final sizing must be verified by the responsible engineer.
