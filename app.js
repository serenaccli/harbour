const DEFAULT_CENTER = { lat: -37.0667, lng: 149.9, label: "Eden, Australia" };
const GRID_OFFSETS = [-0.45, 0, 0.45];

const LOCATION_ALIASES = {
  "eden, nsw": "Eden, New South Wales, Australia",
  eden: "Eden, New South Wales, Australia",
  "hobart, tas": "Hobart, Tasmania, Australia",
  hobart: "Hobart, Tasmania, Australia",
  "auckland, nz": "Auckland, New Zealand",
  auckland: "Auckland, New Zealand",
  "cape town": "Cape Town, South Africa",
  "london, england": "London, United Kingdom",
  london: "London, United Kingdom",
  "bergen, norway": "Bergen, Norway",
  bergen: "Bergen, Norway",
  "reykjavik, iceland": "Reykjavik, Iceland",
  reykjavik: "Reykjavik, Iceland",
  "vigo, spain": "Vigo, Spain",
  vigo: "Vigo, Spain",
  "new bedford": "New Bedford, Massachusetts, United States",
  "new bedford, ma": "New Bedford, Massachusetts, United States",
  "halifax, ns": "Halifax, Nova Scotia, Canada",
  halifax: "Halifax, Nova Scotia, Canada",
  "wellington, nz": "Wellington, New Zealand",
  wellington: "Wellington, New Zealand",
};

const appState = {
  center: { ...DEFAULT_CENTER },
  samples: [],
  nearestSample: null,
  selectedSample: null,
  recommendation: null,
  map: null,
  centerMarker: null,
  sampleMarkers: [],
  sampleSourceLoaded: false,
};

const elements = {
  locationInput: document.getElementById("locationInput"),
  searchBtn: document.getElementById("searchBtn"),
  useLocationBtn: document.getElementById("useLocationBtn"),
  refreshBtn: document.getElementById("refreshBtn"),
  overrideBtn: document.getElementById("overrideBtn"),
  sleep24: document.getElementById("sleep24"),
  sleep48: document.getElementById("sleep48"),
  daysAtSea: document.getElementById("daysAtSea"),
  overnightSelect: document.getElementById("overnightSelect"),
  dieselPrice: document.getElementById("dieselPrice"),
  fuelBurn: document.getElementById("fuelBurn"),
  tripHours: document.getElementById("tripHours"),
  salePrice: document.getElementById("salePrice"),
  otherCosts: document.getElementById("otherCosts"),
  plannedCatch: document.getElementById("plannedCatch"),
  contactsInput: document.getElementById("contactsInput"),
  statusBanner: document.getElementById("statusBanner"),
  scoreRing: document.getElementById("scoreRing"),
  scoreNumber: document.getElementById("scoreNumber"),
  scoreLabel: document.getElementById("scoreLabel"),
  weatherRiskMetric: document.getElementById("weatherRiskMetric"),
  fatigueRiskMetric: document.getElementById("fatigueRiskMetric"),
  breakEvenMetric: document.getElementById("breakEvenMetric"),
  recommendationText: document.getElementById("recommendationText"),
  reasonList: document.getElementById("reasonList"),
  selectedAreaMetrics: document.getElementById("selectedAreaMetrics"),
  financeMetrics: document.getElementById("financeMetrics"),
  alertState: document.getElementById("alertState"),
  alertLog: document.getElementById("alertLog"),
  missionBand: document.getElementById("missionBand"),
  missionSummary: document.getElementById("missionSummary"),
  coordinateReadout: document.getElementById("coordinateReadout"),
};

function formatNumber(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "--";
}

function formatCurrency(value) {
  return Number.isFinite(value) ? `$${Math.round(value)}` : "--";
}

function formatCoordinate(value, positiveLabel, negativeLabel) {
  if (!Number.isFinite(value)) {
    return "--";
  }
  const suffix = value >= 0 ? positiveLabel : negativeLabel;
  return `${Math.abs(value).toFixed(2)}°${suffix}`;
}

function formatLatLng(lat, lng) {
  return `${formatCoordinate(lat, "N", "S")} · ${formatCoordinate(lng, "E", "W")}`;
}

function getRiskBand(score) {
  if (score >= 70) {
    return "red";
  }
  if (score >= 40) {
    return "amber";
  }
  return "green";
}

function getBandLabel(band) {
  return band === "red" ? "no-go" : band === "amber" ? "caution" : "go";
}

function bandColor(band) {
  if (band === "red") {
    return "#ff7a94";
  }
  if (band === "amber") {
    return "#ffc86b";
  }
  return "#6effc4";
}

function setStatus(message, tone = "neutral") {
  elements.statusBanner.textContent = message;
  elements.statusBanner.style.borderColor =
    tone === "error" ? "rgba(255, 122, 148, 0.28)" : tone === "success" ? "rgba(110, 255, 196, 0.28)" : "rgba(255,255,255,0.06)";
  elements.statusBanner.style.background =
    tone === "error"
      ? "rgba(255, 122, 148, 0.11)"
      : tone === "success"
        ? "rgba(110, 255, 196, 0.1)"
        : "rgba(255,255,255,0.03)";
}

function setMissionState(label, summary, color = "") {
  elements.missionBand.textContent = label;
  elements.missionBand.style.color = color;
  elements.missionSummary.textContent = summary;
}

function normalizeQuery(query) {
  const lower = query.trim().toLowerCase();
  if (LOCATION_ALIASES[lower]) {
    return LOCATION_ALIASES[lower];
  }

  return query
    .replace(/\bUK\b/gi, "United Kingdom")
    .replace(/\bUAE\b/gi, "United Arab Emirates")
    .replace(/\bUSA\b/gi, "United States")
    .replace(/\bUS\b/gi, "United States")
    .replace(/\bNZ\b/gi, "New Zealand")
    .replace(/\bNSW\b/gi, "New South Wales Australia")
    .replace(/\bQLD\b/gi, "Queensland Australia")
    .replace(/\bVIC\b/gi, "Victoria Australia")
    .replace(/\bTAS\b/gi, "Tasmania Australia")
    .replace(/\bWA\b/gi, "Western Australia")
    .replace(/\bSA\b/gi, "South Australia")
    .replace(/\bENG\b/gi, "England")
    .replace(/\bScot\b/gi, "Scotland");
}

function buildLocationCandidates(query) {
  const normalized = normalizeQuery(query);
  const clean = normalized.replace(/\s+/g, " ").trim();
  const noComma = clean.replace(/,\s*/g, " ").trim();
  const parts = clean
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const candidates = [clean, noComma, parts.slice(0, 2).join(", "), parts[0]].filter(Boolean);

  if (parts.length >= 2) {
    candidates.push(`${parts[0]}, ${parts[parts.length - 1]}`);
  }

  if (parts.length === 2 && /england|scotland|wales|northern ireland/i.test(parts[1])) {
    candidates.push(`${parts[0]}, United Kingdom`);
  }

  if (parts.length === 2 && /new south wales|victoria|tasmania|queensland|western australia|south australia/i.test(parts[1])) {
    candidates.push(`${parts[0]}, ${parts[1]}, Australia`);
  }

  return [...new Set(candidates.map((item) => item.trim()).filter(Boolean))];
}

async function fetchGeocodeCandidate(candidate, count = 5) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(candidate)}&count=${count}&language=en&format=json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Location lookup failed.");
  }
  return response.json();
}

function formatGeocodeLabel(result) {
  const detail = [result.admin1, result.country].filter(Boolean).join(", ");
  return detail ? `${result.name}, ${detail}` : result.name;
}

function parseInputs() {
  return {
    sleep24: Number(elements.sleep24.value) || 0,
    sleep48: Number(elements.sleep48.value) || 0,
    daysAtSea: Number(elements.daysAtSea.value) || 0,
    overnight: elements.overnightSelect.value === "yes",
    dieselPrice: Number(elements.dieselPrice.value) || 0,
    fuelBurn: Number(elements.fuelBurn.value) || 0,
    tripHours: Number(elements.tripHours.value) || 0,
    salePrice: Number(elements.salePrice.value) || 0,
    otherCosts: Number(elements.otherCosts.value) || 0,
    plannedCatch: Number(elements.plannedCatch.value) || 0,
  };
}

function buildGrid(center) {
  const labels = [
    "Northwest sector",
    "North sector",
    "Northeast sector",
    "West sector",
    "Departure point",
    "East sector",
    "Southwest sector",
    "South sector",
    "Southeast sector",
  ];

  const points = [];
  let labelIndex = 0;

  for (const latOffset of GRID_OFFSETS) {
    for (const lngOffset of GRID_OFFSETS) {
      points.push({
        lat: center.lat + latOffset,
        lng: center.lng + lngOffset,
        label: labels[labelIndex],
      });
      labelIndex += 1;
    }
  }

  return points;
}

async function geocodePlace(query) {
  const directCoordinates = query.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (directCoordinates) {
    return {
      lat: Number(directCoordinates[1]),
      lng: Number(directCoordinates[2]),
      label: "Custom coordinates",
    };
  }

  const candidates = buildLocationCandidates(query);

  for (const candidate of candidates) {
    const data = await fetchGeocodeCandidate(candidate, 5);
    if (data.results && data.results.length) {
      const result =
        data.results.find((item) => item.feature_code === "PPL" || item.feature_code === "PPLA" || item.feature_code === "PPLA2") ||
        data.results[0];
      return {
        lat: result.latitude,
        lng: result.longitude,
        label: formatGeocodeLabel(result),
      };
    }
  }

  throw new Error("No matching location found. Try a city, port, coastline, or coordinates.");
}

async function fetchMarineSamples(center) {
  const grid = buildGrid(center);
  const latitudes = grid.map((point) => point.lat.toFixed(4)).join(",");
  const longitudes = grid.map((point) => point.lng.toFixed(4)).join(",");

  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitudes}&longitude=${longitudes}` +
    "&current=wind_speed_10m,wind_gusts_10m,pressure_msl&timezone=auto";
  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${latitudes}&longitude=${longitudes}` +
    "&current=wave_height,swell_wave_height,swell_wave_direction,sea_surface_temperature&timezone=auto";

  const [weatherResponse, marineResponse] = await Promise.all([fetch(weatherUrl), fetch(marineUrl)]);
  if (!weatherResponse.ok || !marineResponse.ok) {
    throw new Error("Live marine sync failed.");
  }

  const weatherData = await weatherResponse.json();
  const marineData = await marineResponse.json();
  const weatherBlocks = Array.isArray(weatherData) ? weatherData : [weatherData];
  const marineBlocks = Array.isArray(marineData) ? marineData : [marineData];

  return grid.map((point, index) => {
    const weather = weatherBlocks[index]?.current || {};
    const marine = marineBlocks[index]?.current || {};
    const weatherScore = scoreWeather({
      waveHeight: marine.wave_height,
      swellHeight: marine.swell_wave_height,
      windSpeed: weather.wind_speed_10m,
      gusts: weather.wind_gusts_10m,
      pressure: weather.pressure_msl,
    });

    return {
      ...point,
      waveHeight: marine.wave_height,
      swellHeight: marine.swell_wave_height,
      windSpeed: weather.wind_speed_10m,
      gusts: weather.wind_gusts_10m,
      pressure: weather.pressure_msl,
      seaTemperature: marine.sea_surface_temperature,
      swellDirection: marine.swell_wave_direction,
      weatherScore,
      band: getRiskBand(weatherScore),
    };
  });
}

function scoreWeather({ waveHeight, swellHeight, windSpeed, gusts, pressure }) {
  let score = 0;
  score += Math.max(0, (waveHeight || 0) - 1.2) * 24;
  score += Math.max(0, (swellHeight || 0) - 1.0) * 16;
  score += Math.max(0, (windSpeed || 0) - 18) * 1.55;
  score += Math.max(0, (gusts || 0) - 25) * 0.9;
  if (Number.isFinite(pressure) && pressure < 1008) {
    score += (1008 - pressure) * 2.2;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreFatigue(inputs) {
  let score = 0;
  score += Math.max(0, 8 - inputs.sleep24) * 8;
  score += Math.max(0, 14 - inputs.sleep48) * 4.5;
  score += Math.max(0, inputs.daysAtSea - 3) * 7;
  if (inputs.overnight) {
    score += 12;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreFinance(inputs) {
  const fuelCost = inputs.dieselPrice * inputs.fuelBurn * inputs.tripHours;
  const tripCost = fuelCost + inputs.otherCosts;
  const breakEvenKg = inputs.salePrice > 0 ? tripCost / inputs.salePrice : Infinity;
  const pressureRatio = inputs.plannedCatch > 0 ? breakEvenKg / inputs.plannedCatch : 1.5;
  let score = 0;
  score += Math.max(0, pressureRatio - 0.55) * 90;

  return {
    fuelCost,
    tripCost,
    breakEvenKg,
    pressureRatio,
    financeScore: Math.max(0, Math.min(100, Math.round(score))),
  };
}

function chooseNearestSample() {
  const center = appState.center;
  return appState.samples.reduce((best, sample) => {
    const bestDistance = best ? Math.hypot(best.lat - center.lat, best.lng - center.lng) : Infinity;
    const nextDistance = Math.hypot(sample.lat - center.lat, sample.lng - center.lng);
    return nextDistance < bestDistance ? sample : best;
  }, null);
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineKm(from, to) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDegrees(from, to) {
  const y = Math.sin(toRadians(to.lng - from.lng)) * Math.cos(toRadians(to.lat));
  const x =
    Math.cos(toRadians(from.lat)) * Math.sin(toRadians(to.lat)) -
    Math.sin(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.cos(toRadians(to.lng - from.lng));
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

function bearingLabel(degrees) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

function patchBounds(sample, halfStep = 0.24) {
  return [
    [sample.lng - halfStep, sample.lat - halfStep],
    [sample.lng + halfStep, sample.lat - halfStep],
    [sample.lng + halfStep, sample.lat + halfStep],
    [sample.lng - halfStep, sample.lat + halfStep],
    [sample.lng - halfStep, sample.lat - halfStep],
  ];
}

function buildReasons(weatherScore, fatigueScore, finance) {
  const reasons = [];
  const sample = appState.selectedSample || appState.nearestSample;

  if (sample) {
    reasons.push(
      `Nearest marker shows ${formatNumber(sample.waveHeight)}m waves, ${formatNumber(sample.windSpeed)} km/h wind, and ${formatNumber(sample.pressure, 0)} hPa pressure.`
    );
  }

  if (fatigueScore >= 70) {
    reasons.push("Crew fatigue is severe enough to push the recommendation toward a no-go even if some nearby markers look manageable.");
  } else if (fatigueScore >= 40) {
    reasons.push("Fatigue is elevated, so even moderate conditions should be treated with caution.");
  } else {
    reasons.push("Fatigue inputs are still within a more manageable range.");
  }

  reasons.push(
    `Break-even sits at ${formatNumber(finance.breakEvenKg, 0)}kg against a planned ${formatNumber(parseInputs().plannedCatch, 0)}kg trip, which ${
      finance.pressureRatio > 1 ? "adds strong economic pressure" : "keeps financial pressure moderate"
    }.`
  );

  if (weatherScore >= 70) {
    reasons.push("Nearby sampled positions include red-risk water, so Harbour recommends staying in.");
  } else if (weatherScore >= 40) {
    reasons.push("Conditions are mixed around the area, with amber pockets that justify caution.");
  } else {
    reasons.push("Most nearby sampled positions remain green, with no dominant severe-weather pocket in the immediate area.");
  }

  return reasons;
}

function buildRecommendation() {
  const inputs = parseInputs();
  const fatigueScore = scoreFatigue(inputs);
  const finance = scoreFinance(inputs);
  const weatherScore = appState.nearestSample ? appState.nearestSample.weatherScore : 0;
  const overallScore = Math.round(weatherScore * 0.48 + fatigueScore * 0.37 + finance.financeScore * 0.15);
  const band = getRiskBand(overallScore);
  const reasons = buildReasons(weatherScore, fatigueScore, finance);

  let message = "Conditions look manageable for departure.";
  if (band === "red") {
    message = "No-go. Live area conditions and crew readiness combine into an unsafe departure profile.";
  } else if (band === "amber") {
    message = "Proceed with caution. There is enough risk to justify delaying departure or shortening the trip.";
  }

  appState.recommendation = {
    overallScore,
    band,
    fatigueScore,
    weatherScore,
    finance,
    reasons,
    message,
  };

  renderRecommendation();
}

function renderRecommendation() {
  const data = appState.recommendation;
  if (!data) {
    return;
  }

  const band = data.band;
  const ringAngle = `${Math.max(18, Math.round((data.overallScore / 100) * 360))}deg`;
  elements.scoreRing.style.setProperty("--ring-angle", ringAngle);
  elements.scoreRing.style.setProperty("--ring-color", bandColor(band));
  elements.scoreNumber.textContent = String(data.overallScore);
  elements.scoreLabel.textContent = getBandLabel(band);
  elements.scoreLabel.style.color = bandColor(band);
  elements.weatherRiskMetric.textContent = `${data.weatherScore}/100`;
  elements.fatigueRiskMetric.textContent = `${data.fatigueScore}/100`;
  elements.breakEvenMetric.textContent = `${formatNumber(data.finance.breakEvenKg, 0)}kg`;
  elements.recommendationText.textContent = data.message;
  setMissionState(getBandLabel(band).toUpperCase(), data.message, bandColor(band));
  elements.coordinateReadout.textContent = formatLatLng(appState.center.lat, appState.center.lng);
  elements.reasonList.innerHTML = data.reasons.map((reason) => `<li>${reason}</li>`).join("");

  const sample = appState.selectedSample || appState.nearestSample;
  const distanceKm = sample ? haversineKm(appState.center, sample) : 0;
  const bearing = sample ? bearingDegrees(appState.center, sample) : 0;
  elements.selectedAreaMetrics.innerHTML = [
    metricCard("Area", sample?.label || "--"),
    metricCard("Travel distance", `${formatNumber(distanceKm, 1)} km`),
    metricCard("Heading", `${bearingLabel(bearing)} · ${formatNumber(bearing, 0)}°`),
    metricCard("Wave height", `${formatNumber(sample?.waveHeight)} m`),
    metricCard("Wind speed", `${formatNumber(sample?.windSpeed)} km/h`),
    metricCard("Pressure", `${formatNumber(sample?.pressure, 0)} hPa`),
  ].join("");

  elements.financeMetrics.innerHTML = [
    metricCard("Fuel cost", formatCurrency(data.finance.fuelCost)),
    metricCard("Trip cost", formatCurrency(data.finance.tripCost)),
    metricCard("Break-even catch", `${formatNumber(data.finance.breakEvenKg, 0)} kg`),
    metricCard("Pressure score", `${data.finance.financeScore}/100`),
  ].join("");
}

function metricCard(label, value) {
  return `<div class="metric-card"><span>${label}</span><strong>${value}</strong></div>`;
}

function createMarkerElement(band, isCenter = false) {
  const element = document.createElement("div");
  element.className = `gps-marker ${isCenter ? "gps-marker-center" : `gps-marker-${band}`}`;
  return element;
}

function buildPatchGeoJson(samples) {
  return {
    type: "FeatureCollection",
    features: samples.map((sample) => ({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [patchBounds(sample)],
      },
      properties: {
        label: sample.label,
        band: sample.band,
        score: sample.weatherScore,
        waveHeight: formatNumber(sample.waveHeight),
        windSpeed: formatNumber(sample.windSpeed),
        pressure: formatNumber(sample.pressure, 0),
        lat: sample.lat,
        lng: sample.lng,
      },
    })),
  };
}

function ensureMap() {
  if (appState.map || !window.maplibregl) {
    return;
  }

  appState.map = new maplibregl.Map({
    container: "map",
    style: "https://demotiles.maplibre.org/style.json",
    center: [appState.center.lng, appState.center.lat],
    zoom: 7.2,
    attributionControl: true,
  });

  appState.map.addControl(new maplibregl.NavigationControl(), "top-right");
  appState.map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");

  appState.map.on("load", () => {
    appState.map.addSource("risk-patches", {
      type: "geojson",
      data: buildPatchGeoJson([]),
    });

    appState.map.addLayer({
      id: "risk-patches-fill",
      type: "fill",
      source: "risk-patches",
      paint: {
        "fill-color": [
          "match",
          ["get", "band"],
          "red",
          "rgba(255, 122, 148, 0.40)",
          "amber",
          "rgba(255, 200, 107, 0.34)",
          "rgba(110, 255, 196, 0.30)",
        ],
        "fill-outline-color": [
          "match",
          ["get", "band"],
          "red",
          "#ff7a94",
          "amber",
          "#ffc86b",
          "#6effc4",
        ],
        "fill-opacity": 0.9,
      },
    });

    appState.map.addLayer({
      id: "risk-patches-outline",
      type: "line",
      source: "risk-patches",
      paint: {
        "line-color": [
          "match",
          ["get", "band"],
          "red",
          "#ff7a94",
          "amber",
          "#ffc86b",
          "#6effc4",
        ],
        "line-width": 2,
        "line-opacity": 0.85,
      },
    });

    const onAreaClick = (event) => {
      const feature = event.features && event.features[0];
      if (!feature) {
        return;
      }

      appState.selectedSample =
        appState.samples.find(
          (sample) =>
            sample.label === feature.properties.label &&
            Math.abs(sample.lat - Number(feature.properties.lat)) < 0.0001 &&
            Math.abs(sample.lng - Number(feature.properties.lng)) < 0.0001
        ) || appState.nearestSample;
      buildRecommendation();

      new maplibregl.Popup({ offset: 14 })
        .setLngLat(event.lngLat)
        .setHTML(`
          <div class="map-popup-card">
            <strong>${feature.properties.label}</strong>
            <span>${feature.properties.band.toUpperCase()} · ${feature.properties.score}/100</span>
            <p>${feature.properties.waveHeight}m wave · ${feature.properties.windSpeed} km/h wind</p>
            <p>${feature.properties.pressure} hPa pressure</p>
            <p>Clicking this patch selects it for travel and economics analysis.</p>
          </div>
        `)
        .addTo(appState.map);
    };

    appState.map.on("click", "risk-patches-fill", onAreaClick);

    appState.map.on("mouseenter", "risk-patches-fill", () => {
      appState.map.getCanvas().style.cursor = "pointer";
    });

    appState.map.on("mouseleave", "risk-patches-fill", () => {
      appState.map.getCanvas().style.cursor = "";
    });

    appState.sampleSourceLoaded = true;
    renderMap();
  });
}

function renderMap() {
  if (!appState.map) {
    return;
  }

  if (appState.centerMarker) {
    appState.centerMarker.remove();
  }

  appState.centerMarker = new maplibregl.Marker({
    element: createMarkerElement("green", true),
    anchor: "bottom",
  })
    .setLngLat([appState.center.lng, appState.center.lat])
    .setPopup(
      new maplibregl.Popup({ offset: 18 }).setHTML(`
        <div class="map-popup-card">
          <strong>${appState.center.label}</strong>
          <span>${formatLatLng(appState.center.lat, appState.center.lng)}</span>
          <p>Primary departure marker.</p>
        </div>
      `)
    )
    .addTo(appState.map);

  if (appState.sampleSourceLoaded) {
    const patchSource = appState.map.getSource("risk-patches");
    if (patchSource) {
      patchSource.setData(buildPatchGeoJson(appState.samples));
    }
  }

  appState.map.flyTo({
    center: [appState.center.lng, appState.center.lat],
    zoom: 5.6,
    speed: 0.8,
    curve: 1.1,
    essential: true,
  });
}

async function refreshConditions() {
  try {
    setStatus(`Syncing live conditions for ${appState.center.label}...`);
    setMissionState("SYNCING", `Scanning sampled GPS positions around ${appState.center.label}.`);
    const samples = await fetchMarineSamples(appState.center);
    appState.samples = samples;
    appState.nearestSample = chooseNearestSample();
    appState.selectedSample = appState.nearestSample;
    renderMap();
    buildRecommendation();
    setStatus(`Live conditions synced for ${appState.center.label}. Real GPS markers reflect nearby marine samples.`, "success");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Unable to sync live data.", "error");
    setMissionState("ERROR", "Live marine sync failed. Check connection and try again.", "#ff7a94");
  }
}

async function searchLocation() {
  const query = elements.locationInput.value.trim();
  if (!query) {
    return;
  }

  try {
    setStatus(`Finding ${query}...`);
    appState.center = await geocodePlace(query);
    await refreshConditions();
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Unable to find that area.", "error");
    setMissionState("ERROR", "The location lookup failed. Try a nearby town, port, or coordinates.", "#ff7a94");
  }
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    setStatus("Geolocation is not available in this browser.", "error");
    return;
  }

  setStatus("Requesting your location...");
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      appState.center = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        label: "Current location",
      };
      elements.locationInput.value = `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`;
      await refreshConditions();
    },
    () => {
      setStatus("Location permission was denied.", "error");
      setMissionState("ERROR", "Location access was denied, so Harbour could not center the scan.", "#ff7a94");
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function handleOverride() {
  const data = appState.recommendation;
  if (!data) {
    return;
  }

  if (data.band !== "red") {
    elements.alertState.textContent = "Override available, but the current recommendation is not red so no alerts were prepared.";
    elements.alertLog.innerHTML = "";
    return;
  }

  const contacts = elements.contactsInput.value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);

  elements.alertState.textContent =
    "Red recommendation overridden. Harbour prepared alert messages for emergency contacts and logged the event.";

  const timestamp = new Date().toLocaleString();
  elements.alertLog.innerHTML = contacts.length
    ? contacts
        .map(
          (contact) => `
            <div class="alert-item">
              <strong>${contact}</strong>
              <p>${timestamp}: Override triggered for ${appState.center.label}. Departure remained red at ${data.overallScore}/100.</p>
            </div>
          `
        )
        .join("")
    : `<div class="alert-item"><strong>No contacts listed.</strong><p>Add emergency contacts to prepare outbound alerts.</p></div>`;
}

function wireInputs() {
  elements.searchBtn.addEventListener("click", searchLocation);
  elements.useLocationBtn.addEventListener("click", useCurrentLocation);
  elements.refreshBtn.addEventListener("click", refreshConditions);
  elements.overrideBtn.addEventListener("click", handleOverride);

  elements.locationInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchLocation();
    }
  });

  [
    elements.sleep24,
    elements.sleep48,
    elements.daysAtSea,
    elements.overnightSelect,
    elements.dieselPrice,
    elements.fuelBurn,
    elements.tripHours,
    elements.salePrice,
    elements.otherCosts,
    elements.plannedCatch,
  ].forEach((element) => {
    element.addEventListener("input", buildRecommendation);
  });
}

async function boot() {
  ensureMap();
  wireInputs();
  await refreshConditions();
}

boot();
