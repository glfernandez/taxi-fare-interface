# taxi-fare-interface

Frontend interface for NYC taxi fare prediction.

## Overview
This project provides a lightweight web UI where users can:
- select pickup/dropoff locations,
- set passenger count and pickup time,
- call a fare prediction API,
- view estimated fare and optional route visualization.

## Tech Stack
- HTML/CSS/JavaScript
- Mapbox GL + Geocoder
- Flatpickr

## Configuration
Set runtime values in `config.js`:

```js
window.APP_CONFIG = {
  taxiFareApiUrl: 'https://YOUR_API_URL/predict',
  mapboxToken: 'YOUR_MAPBOX_PUBLIC_TOKEN'
};
```

A starter template is provided in `config.example.js`.

## Run Locally
```bash
python -m http.server 5001
```
Open:
- http://localhost:5001

## Notes
- No private credentials are committed.
- If `mapboxToken` is empty, map/geocoder features are disabled but API prediction still works with default coordinates.
