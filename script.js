const appConfig = window.APP_CONFIG || {};
const taxiFareApiUrl = (appConfig.taxiFareApiUrl || '').trim();
const centralCoordinates = [-74.00597, 40.71427];

mapboxgl.accessToken = (appConfig.mapboxToken || '').trim();

const defaultTrip = {
  pickup_latitude: 40.747,
  pickup_longitude: -73.989,
  dropoff_latitude: 40.802,
  dropoff_longitude: -73.956,
  passenger_count: 2
};

let map = null;
let mapIsLoaded = false;

const messageEl = document.getElementById('status-message');
const fareCard = document.getElementById('fare');
const fareResult = document.getElementById('predicted-fare');
const submitButton = document.getElementById('get-fare-button');

const setStatus = (message, type = 'info') => {
  if (!messageEl) return;
  messageEl.className = `status-message status-${type}`;
  messageEl.textContent = message;
};

const isCoordinatePair = (coords) => (
  Array.isArray(coords) &&
  coords.length === 2 &&
  Number.isFinite(coords[0]) &&
  Number.isFinite(coords[1])
);

const routeUrl = (start, end) => (
  `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`
);

const initMap = () => {
  if (!mapboxgl.accessToken) {
    setStatus('Map is disabled: add a Mapbox public token in config.js.', 'warning');
    return;
  }

  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v11',
    center: centralCoordinates,
    zoom: 10
  });

  map.on('load', () => {
    mapIsLoaded = true;
    map.addSource('route', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    map.addSource('start', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    map.addSource('end', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });

    map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#3887be',
        'line-width': 5,
        'line-opacity': 0.75
      }
    });
    map.addLayer({
      id: 'start-point',
      type: 'circle',
      source: 'start',
      paint: { 'circle-radius': 8, 'circle-color': '#3887be' }
    });
    map.addLayer({
      id: 'end-point',
      type: 'circle',
      source: 'end',
      paint: { 'circle-radius': 8, 'circle-color': '#f30' }
    });
  });
};

const updateMapRoute = async (start, end) => {
  if (!map || !mapIsLoaded || !isCoordinatePair(start) || !isCoordinatePair(end)) return;
  try {
    const response = await fetch(routeUrl(start, end));
    if (!response.ok) throw new Error(`Mapbox directions failed (${response.status})`);
    const payload = await response.json();
    const routeCoords = payload?.routes?.[0]?.geometry?.coordinates;
    if (!Array.isArray(routeCoords) || routeCoords.length < 2) {
      throw new Error('No route found for selected points');
    }

    map.getSource('route').setData({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: routeCoords
      }
    });
    map.getSource('start').setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: start }
      }]
    });
    map.getSource('end').setData({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: {},
        geometry: { type: 'Point', coordinates: end }
      }]
    });
  } catch (error) {
    setStatus(`Map route unavailable: ${error.message}`, 'warning');
  }
};

const initGeocoder = (element, placeholder) => {
  if (!mapboxgl.accessToken) return null;
  const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    placeholder,
    proximity: { longitude: centralCoordinates[0], latitude: centralCoordinates[1] },
    countries: 'us'
  });
  geocoder.addTo(element);
  return geocoder;
};

const pickupAutocomplete = () => {
  const geocoder = initGeocoder('#pickup', 'Pickup');
  if (!geocoder) return;
  geocoder.on('result', (event) => {
    const coordinates = event?.result?.center;
    if (!isCoordinatePair(coordinates)) return;
    document.getElementById('pickup_latitude').value = coordinates[1];
    document.getElementById('pickup_longitude').value = coordinates[0];
  });
};

const dropoffAutocomplete = () => {
  const geocoder = initGeocoder('#dropoff', 'Drop-off');
  if (!geocoder) return;
  geocoder.on('result', async (event) => {
    const coordinates = event?.result?.center;
    if (!isCoordinatePair(coordinates)) return;
    document.getElementById('dropoff_latitude').value = coordinates[1];
    document.getElementById('dropoff_longitude').value = coordinates[0];
    const start = [
      parseFloat(document.getElementById('pickup_longitude').value),
      parseFloat(document.getElementById('pickup_latitude').value)
    ];
    await updateMapRoute(start, coordinates);
  });
};

const initFlatpickr = () => {
  flatpickr('#pickup_datetime', {
    enableTime: true,
    dateFormat: 'Y-m-d H:i:S',
    defaultDate: Date.now()
  });
};

const collectRequestData = () => ({
  pickup_latitude: parseFloat(document.getElementById('pickup_latitude').value) || defaultTrip.pickup_latitude,
  pickup_longitude: parseFloat(document.getElementById('pickup_longitude').value) || defaultTrip.pickup_longitude,
  dropoff_latitude: parseFloat(document.getElementById('dropoff_latitude').value) || defaultTrip.dropoff_latitude,
  dropoff_longitude: parseFloat(document.getElementById('dropoff_longitude').value) || defaultTrip.dropoff_longitude,
  passenger_count: parseInt(document.getElementById('passenger_count').value, 10) || defaultTrip.passenger_count,
  pickup_datetime: document.getElementById('pickup_datetime').value
});

const setLoading = (isLoading) => {
  if (!submitButton) return;
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? 'Loading...' : 'Get fare';
};

const predict = () => {
  const form = document.querySelector('form');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!taxiFareApiUrl) {
      setStatus('Prediction API URL is missing. Update config.js.', 'error');
      return;
    }

    setLoading(true);
    setStatus('Requesting fare estimate...', 'info');

    try {
      const data = collectRequestData();
      const query = new URLSearchParams(
        Object.entries(data).reduce((acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        }, {})
      );
      const url = `${taxiFareApiUrl}?${query.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Prediction API failed (${response.status})`);
      }

      const payload = await response.json();
      const fare = Number(payload?.fare);
      if (!Number.isFinite(fare)) {
        throw new Error('Unexpected API response: missing numeric fare');
      }

      fareCard.classList.remove('d-none');
      fareResult.textContent = `$${fare.toFixed(2)}`;
      setStatus('Fare prediction completed.', 'success');
    } catch (error) {
      setStatus(error.message, 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  });
};

initMap();
pickupAutocomplete();
dropoffAutocomplete();
initFlatpickr();
predict();
