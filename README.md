# My Journey - An Interactive Life

A mobile-first interactive map tracing a 17-stop personal journey from San Francisco to Milan. Repeated cities are collected in a separate places-of-return section.

## Local development

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and add a Google Maps browser key with the Places API enabled to load high-resolution location photography:

```bash
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_browser_key
```

Restrict the key to the deployed site domain in Google Cloud Console.

## Production

```bash
npm run build
```
