const map = L.map("map").setView([-7.8054, 110.3649], 12);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

const osrmBaseUrl = "https://router.project-osrm.org";
const googleSat = L.tileLayer(
  "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
  {
    maxZoom: 20,
    attribution: "Google Satellite"
  }
);

// Google Terrain
const googleTerrain = L.tileLayer(
  "https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
  {
    maxZoom: 20,
    attribution: "Google Terrain"
  }
);

// OpenTopoMap (Terrain-style)
const opentopo = L.tileLayer(
  "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 17,
    attribution:
      "Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap"
  }
);

// --- Layer Control ---
const baseMaps = {
  "OpenStreetMap": L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"),
  "Google Satellite": googleSat,
  "Google Terrain": googleTerrain,
  "OpenTopoMap": opentopo
};

L.control.layers(baseMaps, null, { collapsed: false }).addTo(map);
let waypoints = [];  
let tripLayer = null;

const wisataIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -28]
});
  const wisata = [
      { name: "Candi Prambanan", lat: -7.751797345678377, lng: 110.49144593648123 },
      { name: "Candi Borobudur", lat: -7.607770438245611, lng: 110.20372317007548 },
      { name: "Malioboro", lat: -7.793571786771061, lng: 110.36569696531767 },
      { name: "Keraton Yogyakarta", lat: -7.8051465740200365, lng: 110.3643625229894 },
      { name: "Taman Sari", lat: -7.81037609328611, lng: 110.36014600347076 },
      { name: "Pantai Parangtritis", lat: -8.023612601272404, lng: 110.32954815924307 },
      { name: "HeHa Sky View", lat:  -7.849224494651154,  lng:  110.478142290183 },
      { name: "Hutan Pinus Mangunan", lat: -7.9259266442588565, lng: 110.43043300764863 },
      { name: "Bukit Bintang", lat:  -7.84556435360445,  lng: 110.4798564229901}
    ];


const profileSelect = document.getElementById("profile");
const clearBtn = document.getElementById("clear");
const matrixBtn = document.getElementById("btn-matrix");
const tripBtn = document.getElementById("btn-trip");
const listDiv = document.getElementById('places-list');
const stopsList = document.getElementById("stops-list");
const matrixContainer = document.getElementById("matrix-container");
const tripOrderList = document.getElementById("trip-order");
const infoDiv = document.getElementById("info");
wisata.forEach(place => {
      const marker = L.marker([place.lat, place.lng], { icon: wisataIcon }).addTo(map);
      marker.bindPopup(`<b>${place.name}</b>`);
      const item = document.createElement('div');
      item.className = 'place-item';
      item.innerHTML = `• ${place.name}`;
      listDiv.appendChild(item);
  // Jadikan marker sebagai waypoint
  marker.on("click", function() {
    addWaypoint(marker.getLatLng());
  });
});
// Add waypoint on map click
map.on("click", (e) => {
  addWaypoint(e.latlng);
});

function addWaypoint(latlng) {
  const index = waypoints.length;
  const marker = L.marker(latlng, { draggable: true })
    .addTo(map)
    .bindPopup(`Stop ${index + 1}`)
    .openPopup();

  marker.on("dragend", () => {
    const pos = marker.getLatLng();
    waypoints[index].lat = pos.lat;
    waypoints[index].lng = pos.lng;
    renderStopsList();
  });

  waypoints.push({
    lat: latlng.lat,
    lng: latlng.lng,
    marker
  });

  renderStopsList();
}
// --- Tambahan: tampilkan nama wisata di popup waypoint ---
function findWisataName(lat, lng) {
  const tolerance = 0.0001; // toleransi kecil agar lat-long sama
  for (let w of wisata) {
    if (Math.abs(w.lat - lat) < tolerance && Math.abs(w.lng - lng) < tolerance) {
      return w.name;
    }
  }
  return null;
}

// Modifikasi tambahan saat addWaypoint dipanggil
const originalAddWaypoint = addWaypoint;
addWaypoint = function(latlng) {
  const name = findWisataName(latlng.lat, latlng.lng);

  // panggil fungsi asli
  originalAddWaypoint(latlng);

  // update popup terakhir (waypoint yang baru saja dibuat)
  const wp = waypoints[waypoints.length - 1];
  const popupText = name 
      ? `Stop ${waypoints.length}<br><b>${name}</b>` 
      : `Stop ${waypoints.length}`;

  wp.marker.setPopupContent(popupText);
};

function clearAll() {
  waypoints.forEach((w) => map.removeLayer(w.marker));
  waypoints = [];
  if (tripLayer) {
    map.removeLayer(tripLayer);
    tripLayer = null;
  }
  matrixContainer.innerHTML = "";
  stopsList.innerHTML = "";
  tripOrderList.innerHTML = "";
  infoDiv.innerHTML = "";
}

clearBtn.addEventListener("click", clearAll);

function renderStopsList() {
  stopsList.innerHTML = "";
  waypoints.forEach((wp, idx) => {
    const li = document.createElement("li");
    li.textContent = `Stop ${idx + 1}: (${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)})`;
    stopsList.appendChild(li);
    // update popup
    wp.marker.setPopupContent(`Stop ${idx + 1}`);
  });
}

// Helper: format
function formatDurationMinutes(seconds) {
  return (seconds / 60).toFixed(1);
}
function formatDistanceKm(meters) {
  return (meters / 1000).toFixed(2);
}

// Compute OD Matrix
matrixBtn.addEventListener("click", async () => {
  if (waypoints.length < 2) {
    infoDiv.innerHTML = "Tambah minimal 2 titik untuk matrix.";
    return;
  }
  infoDiv.innerHTML = "Computing OD matrix...";
  matrixContainer.innerHTML = "";
  tripOrderList.innerHTML = "";
  if (tripLayer) {
    map.removeLayer(tripLayer);
    tripLayer = null;
  }

  const profile = profileSelect.value;
  const coords = waypoints
    .map((wp) => `${wp.lng},${wp.lat}`)
    .join(";");

  const url = `${osrmBaseUrl}/table/v1/${profile}/${coords}?annotations=duration`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== "Ok") {
      infoDiv.innerHTML = `Error from OSRM: ${data.message || data.code}`;
      return;
    }

    const durations = data.durations;
    renderMatrix(durations);
    infoDiv.innerHTML = "OD matrix computed.";
  } catch (err) {
    console.error(err);
    infoDiv.innerHTML = "Failed to fetch table.";
  }
});

function renderMatrix(durations) {
  const n = durations.length;
  let html = "<table><tr><th></th>";
  for (let j = 0; j < n; j++) {
    html += `<th>${j + 1}</th>`;
  }
  html += "</tr>";
  for (let i = 0; i < n; i++) {
    html += `<tr><th>${i + 1}</th>`;
    for (let j = 0; j < n; j++) {
      const val = durations[i][j];
      html += `<td>${val == null ? "-" : formatDurationMinutes(val)}</td>`;
    }
    html += "</tr>";
  }
  html += "</table>";
  matrixContainer.innerHTML = html;
}

// Optimize Trip (TSP-like)
tripBtn.addEventListener("click", async () => {
  if (waypoints.length < 3) {
    infoDiv.innerHTML = "Minimal 3 titik untuk trip.";
    return;
  }
  infoDiv.innerHTML = "Optimizing trip (TSP heuristic)...";
  matrixContainer.innerHTML = "";
  tripOrderList.innerHTML = "";
  if (tripLayer) {
    map.removeLayer(tripLayer);
    tripLayer = null;
  }

  const profile = profileSelect.value;
  const coords = waypoints
    .map((wp) => `${wp.lng},${wp.lat}`)
    .join(";");

  // first point as start & end (roundtrip)
  const url = `${osrmBaseUrl}/trip/v1/${profile}/${coords}?roundtrip=true&source=first&destination=last&geometries=geojson`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== "Ok") {
      infoDiv.innerHTML = `Error from OSRM: ${data.message || data.code}`;
      return;
    }

    const trip = data.trips[0];
    if (!trip) {
      infoDiv.innerHTML = "No trip found.";
      return;
    }

    const coordsTrip = trip.geometry.coordinates.map((c) => [c[1], c[0]]);
    tripLayer = L.polyline(coordsTrip, {
      color: "#1976d2",
      weight: 5,
      opacity: 0.9
    }).addTo(map);
    map.fitBounds(tripLayer.getBounds(), { padding: [40, 40] });

    infoDiv.innerHTML = `
      <b>Trip found!</b><br/>
      Total distance: ${formatDistanceKm(trip.distance)} km<br/>
      Total duration: ${(trip.duration / 3600).toFixed(2)} hours
    `;

    renderTripOrder(data.waypoints);
  } catch (err) {
    console.error(err);
    infoDiv.innerHTML = "Failed to fetch trip.";
  }
});

// Render urutan kunjungan dari waypoints trip
function renderTripOrder(waypointsTrip) {
  tripOrderList.innerHTML = "";
  // waypointsTrip mengandung info "waypoint_index" = urutan di trip
  const sorted = [...waypointsTrip].sort(
    (a, b) => a.waypoint_index - b.waypoint_index
  );

  sorted.forEach((wp, idx) => {
    const li = document.createElement("li");
    const originalIndex = wp.waypoint_index;
    li.textContent = `Visit Stop ${originalIndex + 1} at (${wp.location[1].toFixed(
      5
    )}, ${wp.location[0].toFixed(5)})`;
    tripOrderList.appendChild(li);
  });
}
