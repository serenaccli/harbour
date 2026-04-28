const DEFAULT_DEPARTURE = {
  lat: -37.0667,
  lng: 149.9,
  label: "Eden, Australia",
  country: "Australia",
  countryCode: "AU",
  admin1: "New South Wales",
};
const PATCH_RADIUS_KM = 54;
const PATCH_STEPS = 72;
const DEFAULT_DIESEL_PRICE = 2.05;
const ROUTE_COLUMNS = 7;
const ROUTE_ROWS = 5;

const FISH_SPECIES = {
  tuna: { label: "Tuna", salePrice: 9.8 },
  snapper: { label: "Snapper", salePrice: 7.9 },
  lobster: { label: "Lobster", salePrice: 26.5 },
  squid: { label: "Squid", salePrice: 6.4 },
  mackerel: { label: "Mackerel", salePrice: 5.6 },
};

const DIESEL_BY_COUNTRY = {
  AU: 2.18,
  NZ: 2.11,
  GB: 1.86,
  NO: 2.07,
  IS: 2.24,
  ES: 1.71,
  ZA: 1.39,
  CA: 1.63,
  US: 1.28,
};

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
  departure: { ...DEFAULT_DEPARTURE },
  target: { ...DEFAULT_DEPARTURE, label: "Selected patch" },
  targetSample: null,
  routeSamples: [],
  routePath: [],
  greenRoutePath: [],
  recommendation: null,
  dieselPrice: DIESEL_BY_COUNTRY.AU,
  map: null,
  mapLoaded: false,
  departureMarker: null,
  targetMarker: null,
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
  fishSpecies: document.getElementById("fishSpecies"),
  dieselPrice: document.getElementById("dieselPrice"),
  fuelBurn: document.getElementById("fuelBurn"),
  cruiseSpeed: document.getElementById("cruiseSpeed"),
  tripHours: document.getElementById("tripHours"),
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

function getDieselPriceForDeparture(departure) {
  const code = (departure.countryCode || "").toUpperCase();
  const fallbackCode = code === "UK" ? "GB" : code;
  return DIESEL_BY_COUNTRY[fallbackCode] || DEFAULT_DIESEL_PRICE;
}

function syncDieselInput() {
  elements.dieselPrice.value = appState.dieselPrice.toFixed(2);
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
        country: result.country || "",
        countryCode: result.country_code || "",
        admin1: result.admin1 || "",
      };
    }
  }

  throw new Error("No matching location found. Try a city, port, coastline, or coordinates.");
}

function parseInputs() {
  const fishKey = elements.fishSpecies.value;
  const fish = FISH_SPECIES[fishKey] || FISH_SPECIES.tuna;
  return {
    sleep24: Number(elements.sleep24.value) || 0,
    sleep48: Number(elements.sleep48.value) || 0,
    daysAtSea: Number(elements.daysAtSea.value) || 0,
    overnight: elements.overnightSelect.value === "yes",
    fishKey,
    fishLabel: fish.label,
    salePrice: fish.salePrice,
    dieselPrice: appState.dieselPrice,
    fuelBurn: Number(elements.fuelBurn.value) || 0,
    cruiseSpeed: Number(elements.cruiseSpeed.value) || 0,
    tripHours: Number(elements.tripHours.value) || 0,
    otherCosts: Number(elements.otherCosts.value) || 0,
    plannedCatch: Number(elements.plannedCatch.value) || 0,
  };
}

async function fetchMarineSamplesForPoints(points) {
  if (!points.length) {
    return [];
  }

  const latitudes = points.map((point) => point.lat.toFixed(4)).join(",");
  const longitudes = points.map((point) => point.lng.toFixed(4)).join(",");

  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${latitudes}&longitude=${longitudes}` +
    "&current=wind_speed_10m,wind_gusts_10m,pressure_msl&timezone=auto";
  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${latitudes}&longitude=${longitudes}` +
    "&current=wave_height,swell_wave_height,swell_wave_direction,sea_surface_temperature&timezone=auto";

  const [weatherResponse, marineResponse] = await Promise.all([fetch(weatherUrl), fetch(marineUrl)]);
  if (!weatherResponse.ok || !marineResponse.ok) {
    throw new Error("Live route sampling failed.");
  }

  const weatherData = await weatherResponse.json();
  const marineData = await marineResponse.json();
  const weatherBlocks = Array.isArray(weatherData) ? weatherData : [weatherData];
  const marineBlocks = Array.isArray(marineData) ? marineData : [marineData];

  return points.map((point, index) => {
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
      weatherScore,
      band: getRiskBand(weatherScore),
    };
  });
}

async function fetchMarineSample(point) {
  const weatherUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${point.lat.toFixed(4)}&longitude=${point.lng.toFixed(4)}` +
    "&current=wind_speed_10m,wind_gusts_10m,pressure_msl&timezone=auto";
  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${point.lat.toFixed(4)}&longitude=${point.lng.toFixed(4)}` +
    "&current=wave_height,swell_wave_height,swell_wave_direction,sea_surface_temperature&timezone=auto";

  const [weatherResponse, marineResponse] = await Promise.all([fetch(weatherUrl), fetch(marineUrl)]);
  if (!weatherResponse.ok || !marineResponse.ok) {
    throw new Error("Live marine sync failed.");
  }

  const weather = (await weatherResponse.json()).current || {};
  const marine = (await marineResponse.json()).current || {};
  const weatherScore = scoreWeather({
    waveHeight: marine.wave_height,
    swellHeight: marine.swell_wave_height,
    windSpeed: weather.wind_speed_10m,
    gusts: weather.wind_gusts_10m,
    pressure: weather.pressure_msl,
  });

  return {
    ...point,
    label: point.label || "Selected patch",
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

function scoreFinance(inputs, departure, sample) {
  const distanceToPatchKm = departure && sample ? haversineKm(departure, sample) : 0;
  const roundTripKm = distanceToPatchKm * 2;
  const travelHours = inputs.cruiseSpeed > 0 ? roundTripKm / inputs.cruiseSpeed : 0;
  const totalTripHours = travelHours + inputs.tripHours;
  const fuelUsedLitres = inputs.fuelBurn * totalTripHours;
  const fuelCost = inputs.dieselPrice * fuelUsedLitres;
  const tripCost = fuelCost + inputs.otherCosts;
  const breakEvenKg = inputs.salePrice > 0 ? tripCost / inputs.salePrice : Infinity;
  const pressureRatio = inputs.plannedCatch > 0 ? breakEvenKg / inputs.plannedCatch : 1.5;
  let score = 0;
  score += Math.max(0, pressureRatio - 0.55) * 90;

  return {
    fishLabel: inputs.fishLabel,
    fishSalePrice: inputs.salePrice,
    dieselPrice: inputs.dieselPrice,
    distanceToPatchKm,
    roundTripKm,
    travelHours,
    totalTripHours,
    fuelUsedLitres,
    fuelCost,
    tripCost,
    breakEvenKg,
    pressureRatio,
    financeScore: Math.max(0, Math.min(100, Math.round(score))),
  };
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

function interpolatePoint(from, to, t) {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  };
}

function routeBandPenalty(band) {
  if (band === "red") {
    return 8;
  }
  if (band === "amber") {
    return 2.6;
  }
  return 1;
}

function buildRouteGrid(departure, target) {
  const directDistanceKm = Math.max(haversineKm(departure, target), 1);
  const corridorWidthKm = Math.max(18, Math.min(60, directDistanceKm * 0.22));
  const latPerKm = 1 / 111.32;
  const avgLatRadians = toRadians((departure.lat + target.lat) / 2);
  const lngPerKm = 1 / (111.32 * Math.max(Math.cos(avgLatRadians), 0.15));
  const dx = target.lng - departure.lng;
  const dy = target.lat - departure.lat;
  const length = Math.hypot(dx, dy) || 1;
  const perpLat = dx / length;
  const perpLng = -dy / length;
  const lateralOffsets = Array.from({ length: ROUTE_ROWS }, (_, index) => index - Math.floor(ROUTE_ROWS / 2));

  const points = [];
  for (let column = 0; column < ROUTE_COLUMNS; column += 1) {
    const t = column / (ROUTE_COLUMNS - 1);
    const base = interpolatePoint(departure, target, t);

    lateralOffsets.forEach((offset, row) => {
      const offsetKm = (offset / Math.max(1, Math.floor(ROUTE_ROWS / 2))) * corridorWidthKm;
      const lat = base.lat + perpLat * offsetKm * latPerKm;
      const lng = base.lng + perpLng * offsetKm * lngPerKm;
      const isDeparture = column === 0 && row === Math.floor(ROUTE_ROWS / 2);
      const isTarget = column === ROUTE_COLUMNS - 1 && row === Math.floor(ROUTE_ROWS / 2);

      points.push({
        id: `${column}-${row}`,
        column,
        row,
        lat: isDeparture ? departure.lat : isTarget ? target.lat : lat,
        lng: isDeparture ? departure.lng : isTarget ? target.lng : lng,
        label: isDeparture ? "Departure route node" : isTarget ? "Destination route node" : `Route node ${column + 1}-${row + 1}`,
        locked: isDeparture || isTarget,
      });
    });
  }

  return points;
}

function buildRouteGeoJson(path) {
  if (!path.length) {
    return { type: "FeatureCollection", features: [] };
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: path.map((point) => [point.lng, point.lat]),
        },
        properties: {},
      },
    ],
  };
}

function buildRouteSegmentsGeoJson(path) {
  if (path.length < 2) {
    return { type: "FeatureCollection", features: [] };
  }

  return {
    type: "FeatureCollection",
    features: path.slice(1).map((point, index) => ({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [path[index].lng, path[index].lat],
          [point.lng, point.lat],
        ],
      },
      properties: {
        band: point.band || "green",
      },
    })),
  };
}

function buildRouteNodesGeoJson(points) {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [point.lng, point.lat],
      },
      properties: {
        band: point.band || "green",
        locked: point.locked ? "yes" : "no",
      },
    })),
  };
}

function computeRoutePath(points, options = {}) {
  if (!points.length) {
    return [];
  }

  const {
    allowNeighbor = () => true,
    edgeWeight = (current, neighbor) => haversineKm(current, neighbor) * routeBandPenalty(neighbor.band),
  } = options;

  const pointMap = new Map(points.map((point) => [point.id, point]));
  const neighbors = new Map();

  for (const point of points) {
    const nextIds = [];
    const nextColumn = point.column + 1;
    if (nextColumn < ROUTE_COLUMNS) {
      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        const neighborId = `${nextColumn}-${point.row + rowOffset}`;
        if (pointMap.has(neighborId)) {
          nextIds.push(neighborId);
        }
      }
    }
    neighbors.set(point.id, nextIds);
  }

  const startId = `0-${Math.floor(ROUTE_ROWS / 2)}`;
  const endId = `${ROUTE_COLUMNS - 1}-${Math.floor(ROUTE_ROWS / 2)}`;
  const distances = new Map(points.map((point) => [point.id, Infinity]));
  const previous = new Map();
  const visited = new Set();
  distances.set(startId, 0);

  while (visited.size < points.length) {
    let currentId = null;
    let currentDistance = Infinity;

    for (const [id, distance] of distances.entries()) {
      if (!visited.has(id) && distance < currentDistance) {
        currentDistance = distance;
        currentId = id;
      }
    }

    if (!currentId || currentId === endId) {
      break;
    }

    visited.add(currentId);
    const current = pointMap.get(currentId);

    for (const neighborId of neighbors.get(currentId) || []) {
      const neighbor = pointMap.get(neighborId);
      if (!allowNeighbor(current, neighbor)) {
        continue;
      }
      const candidateDistance = currentDistance + edgeWeight(current, neighbor);
      if (candidateDistance < distances.get(neighborId)) {
        distances.set(neighborId, candidateDistance);
        previous.set(neighborId, currentId);
      }
    }
  }

  if (!previous.has(endId) && startId !== endId) {
    return [];
  }

  const path = [];
  let currentId = endId;
  while (currentId) {
    path.unshift(pointMap.get(currentId));
    currentId = previous.get(currentId);
  }

  return path;
}

function computeGreenRoutePath(points) {
  return computeRoutePath(points, {
    allowNeighbor: (current, neighbor) => {
      if (current.locked || neighbor.locked) {
        return true;
      }
      return current.band === "green" && neighbor.band === "green";
    },
    edgeWeight: (current, neighbor) => haversineKm(current, neighbor),
  });
}

function circleCoordinates(center, radiusKm = PATCH_RADIUS_KM, steps = PATCH_STEPS) {
  const earthRadiusKm = 6371;
  const latRadians = toRadians(center.lat);
  const latPerKm = 1 / 111.32;
  const lngPerKm = 1 / (111.32 * Math.max(Math.cos(latRadians), 0.15));
  const points = [];

  for (let step = 0; step <= steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2;
    const deltaLat = Math.sin(angle) * radiusKm * latPerKm;
    const deltaLng = Math.cos(angle) * radiusKm * lngPerKm;
    points.push([center.lng + deltaLng, center.lat + deltaLat]);
  }

  return points;
}

function buildPatchGeoJson(sample) {
  if (!sample) {
    return { type: "FeatureCollection", features: [] };
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [circleCoordinates(sample)],
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
      },
    ],
  };
}

function buildReasons(weatherScore, fatigueScore, finance) {
  const reasons = [];
  const sample = appState.targetSample;

  if (sample) {
    reasons.push(
      `The selected patch is reading ${formatNumber(sample.waveHeight)}m waves, ${formatNumber(sample.windSpeed)} km/h wind, and ${formatNumber(sample.pressure, 0)} hPa pressure.`
    );
  }

  if (fatigueScore >= 70) {
    reasons.push("Crew fatigue is severe enough to push the recommendation toward a no-go even if the water itself looks workable.");
  } else if (fatigueScore >= 40) {
    reasons.push("Fatigue is elevated, so this area should be treated with caution even if conditions are only moderate.");
  } else {
    reasons.push("Crew fatigue inputs are still within a more manageable range.");
  }

  reasons.push(
    `With ${finance.fishLabel.toLowerCase()} at $${formatNumber(finance.fishSalePrice, 2)}/kg and a ${formatNumber(finance.roundTripKm, 0)} km round trip from departure, break-even sits at ${formatNumber(finance.breakEvenKg, 0)}kg against a planned ${formatNumber(parseInputs().plannedCatch, 0)}kg trip, which ${
      finance.pressureRatio > 1 ? "adds strong economic pressure to launch" : "keeps financial pressure moderate"
    }.`
  );

  if (weatherScore >= 70) {
    reasons.push("This water patch is scoring as hazardous, so Harbour recommends staying in or moving the pin to a safer pocket.");
  } else if (weatherScore >= 40) {
    reasons.push("This patch is mixed and caution-rated, so Harbour suggests a shorter trip or a better nearby area.");
  } else {
    reasons.push("This patch is reading as manageable right now, with no dominant hazard signal in the selected area.");
  }

  return reasons;
}

function buildRecommendation() {
  const inputs = parseInputs();
  const fatigueScore = scoreFatigue(inputs);
  const finance = scoreFinance(inputs, appState.departure, appState.targetSample);
  const weatherScore = appState.targetSample ? appState.targetSample.weatherScore : 0;
  const overallScore = Math.round(weatherScore * 0.48 + fatigueScore * 0.37 + finance.financeScore * 0.15);
  const band = getRiskBand(overallScore);

  let message = "Conditions look manageable for the selected patch.";
  if (band === "red") {
    message = "No-go. The selected patch and the crew profile combine into an unsafe departure.";
  } else if (band === "amber") {
    message = "Proceed with caution. This patch is workable only if the crew and economics still justify the trip.";
  }

  appState.recommendation = {
    overallScore,
    band,
    fatigueScore,
    weatherScore,
    finance,
    reasons: buildReasons(weatherScore, fatigueScore, finance),
    message,
  };

  renderRecommendation();
}

function metricCard(label, value) {
  return `<div class="metric-card"><span>${label}</span><strong>${value}</strong></div>`;
}

function renderRecommendation() {
  const data = appState.recommendation;
  const sample = appState.targetSample;
  if (!data || !sample) {
    return;
  }

  const band = data.band;
  const ringAngle = `${Math.max(18, Math.round((data.overallScore / 100) * 360))}deg`;
  const distanceKm = haversineKm(appState.departure, sample);
  const bearing = bearingDegrees(appState.departure, sample);

  elements.scoreRing.style.setProperty("--ring-angle", ringAngle);
  elements.scoreRing.style.setProperty("--ring-color", bandColor(band));
  elements.scoreNumber.textContent = String(data.overallScore);
  elements.scoreLabel.textContent = getBandLabel(band);
  elements.scoreLabel.style.color = bandColor(band);
  elements.weatherRiskMetric.textContent = `${data.weatherScore}/100`;
  elements.fatigueRiskMetric.textContent = `${data.fatigueScore}/100`;
  elements.breakEvenMetric.textContent = `${formatNumber(data.finance.breakEvenKg, 0)}kg`;
  elements.recommendationText.textContent = data.message;
  elements.coordinateReadout.textContent = formatLatLng(sample.lat, sample.lng);
  elements.reasonList.innerHTML = data.reasons.map((reason) => `<li>${reason}</li>`).join("");
  setMissionState(
    getBandLabel(band).toUpperCase(),
    `${data.message} Drag the pin to compare another patch of water.`,
    bandColor(band)
  );

  elements.selectedAreaMetrics.innerHTML = [
    metricCard("Patch center", sample.label),
    metricCard("Patch radius", `${PATCH_RADIUS_KM} km`),
    metricCard("Travel distance", `${formatNumber(distanceKm, 1)} km`),
    metricCard("Safer route hops", `${Math.max(0, appState.routePath.length - 1)}`),
    metricCard("All-green route", appState.greenRoutePath.length > 1 ? "Available" : "Not available"),
    metricCard("Heading", `${bearingLabel(bearing)} · ${formatNumber(bearing, 0)}°`),
    metricCard("Wave height", `${formatNumber(sample.waveHeight)} m`),
    metricCard("Wind speed", `${formatNumber(sample.windSpeed)} km/h`),
    metricCard("Pressure", `${formatNumber(sample.pressure, 0)} hPa`),
    metricCard("Coordinates", formatLatLng(sample.lat, sample.lng)),
  ].join("");

  elements.financeMetrics.innerHTML = [
    metricCard("Target species", `${data.finance.fishLabel} · $${formatNumber(data.finance.fishSalePrice, 2)}/kg`),
    metricCard("Departure diesel", `$${formatNumber(data.finance.dieselPrice, 2)}/L`),
    metricCard("Round-trip distance", `${formatNumber(data.finance.roundTripKm, 0)} km`),
    metricCard("Travel time", `${formatNumber(data.finance.travelHours, 1)} hrs`),
    metricCard("Fuel used", `${formatNumber(data.finance.fuelUsedLitres, 0)} L`),
    metricCard("Fuel cost", formatCurrency(data.finance.fuelCost)),
    metricCard("Trip cost", formatCurrency(data.finance.tripCost)),
    metricCard("Break-even catch", `${formatNumber(data.finance.breakEvenKg, 0)} kg`),
    metricCard("Pressure score", `${data.finance.financeScore}/100`),
  ].join("");
}

function createMarkerElement(kind, band = "green") {
  const element = document.createElement("div");
  if (kind === "departure") {
    element.className = "gps-marker-departure";
    return element;
  }

  element.className = `gps-marker-target gps-marker-target-${band}`;
  return element;
}

function ensureMap() {
  if (appState.map || !window.maplibregl) {
    return;
  }

  appState.map = new maplibregl.Map({
    container: "map",
    style: "https://demotiles.maplibre.org/style.json",
    center: [appState.departure.lng, appState.departure.lat],
    zoom: 6.3,
    attributionControl: true,
  });

  appState.map.addControl(new maplibregl.NavigationControl(), "top-right");
  appState.map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");

  appState.map.on("load", () => {
    appState.mapLoaded = true;

    appState.map.addSource("risk-area", {
      type: "geojson",
      data: buildPatchGeoJson(null),
    });

    appState.map.addSource("route-line", {
      type: "geojson",
      data: buildRouteGeoJson([]),
    });

    appState.map.addSource("route-segments", {
      type: "geojson",
      data: buildRouteSegmentsGeoJson([]),
    });

    appState.map.addSource("green-route-segments", {
      type: "geojson",
      data: buildRouteSegmentsGeoJson([]),
    });

    appState.map.addSource("route-nodes", {
      type: "geojson",
      data: buildRouteNodesGeoJson([]),
    });

    appState.map.addLayer({
      id: "risk-area-fill",
      type: "fill",
      source: "risk-area",
      paint: {
        "fill-color": [
          "match",
          ["get", "band"],
          "red",
          "rgba(255, 122, 148, 0.28)",
          "amber",
          "rgba(255, 200, 107, 0.24)",
          "rgba(110, 255, 196, 0.24)",
        ],
        "fill-opacity": 0.95,
      },
    });

    appState.map.addLayer({
      id: "risk-area-outline",
      type: "line",
      source: "risk-area",
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
        "line-width": 2.6,
        "line-opacity": 0.95,
      },
    });

    appState.map.addLayer({
      id: "route-line-glow",
      type: "line",
      source: "route-segments",
      paint: {
        "line-color": [
          "match",
          ["get", "band"],
          "red",
          "rgba(255, 122, 148, 0.30)",
          "amber",
          "rgba(255, 200, 107, 0.28)",
          "rgba(110, 255, 196, 0.28)",
        ],
        "line-width": 14,
        "line-opacity": 0.92,
      },
    });

    appState.map.addLayer({
      id: "route-line-main",
      type: "line",
      source: "route-segments",
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
        "line-width": 5.2,
        "line-dasharray": [1.1, 0.9],
        "line-opacity": 0.98,
      },
    });

    appState.map.addLayer({
      id: "green-route-glow",
      type: "line",
      source: "green-route-segments",
      paint: {
        "line-color": "rgba(110, 255, 196, 0.26)",
        "line-width": 16,
        "line-opacity": 0.95,
      },
    });

    appState.map.addLayer({
      id: "green-route-main",
      type: "line",
      source: "green-route-segments",
      paint: {
        "line-color": "#6effc4",
        "line-width": 6,
        "line-dasharray": [0.9, 0.7],
        "line-opacity": 1,
      },
    });

    appState.map.addLayer({
      id: "route-nodes-layer",
      type: "circle",
      source: "route-nodes",
      paint: {
        "circle-radius": [
          "case",
          ["==", ["get", "locked"], "yes"],
          6.4,
          5.1,
        ],
        "circle-color": [
          "match",
          ["get", "band"],
          "red",
          "#ff7a94",
          "amber",
          "#ffc86b",
          "#6effc4",
        ],
        "circle-stroke-color": "rgba(6, 17, 29, 0.96)",
        "circle-stroke-width": 1.8,
        "circle-opacity": 0.98,
      },
    });

    appState.map.on("click", (event) => {
      updateTargetFromMap(event.lngLat.lng, event.lngLat.lat, "Dropped patch");
    });

    appState.map.on("mouseenter", "risk-area-fill", () => {
      appState.map.getCanvas().style.cursor = "pointer";
    });

    appState.map.on("mouseleave", "risk-area-fill", () => {
      appState.map.getCanvas().style.cursor = "";
    });

    renderMap();
  });
}

function renderMap() {
  if (!appState.mapLoaded) {
    return;
  }

  if (!appState.departureMarker) {
    const departureMarker = new maplibregl.Marker({
      element: createMarkerElement("departure"),
      anchor: "center",
    });
    departureMarker.setLngLat({ lng: appState.departure.lng, lat: appState.departure.lat });
    departureMarker.setPopup(new maplibregl.Popup({ offset: 18 }));
    departureMarker.addTo(appState.map);
    appState.departureMarker = departureMarker;
  }

  const targetBand = appState.targetSample?.band || "green";
  if (!appState.targetMarker) {
    const targetMarker = new maplibregl.Marker({
      element: createMarkerElement("target", targetBand),
      anchor: "center",
      draggable: true,
    });
    targetMarker.setLngLat({ lng: appState.target.lng, lat: appState.target.lat });
    targetMarker.setPopup(new maplibregl.Popup({ offset: 18 }));
    targetMarker.addTo(appState.map);
    appState.targetMarker = targetMarker;

    appState.targetMarker.on("dragstart", () => {
      setStatus("Dragging patch marker. Drop it anywhere on the water to rescan that area.");
    });

    appState.targetMarker.on("dragend", () => {
      const lngLat = appState.targetMarker.getLngLat();
      updateTargetFromMap(lngLat.lng, lngLat.lat, "Dragged patch");
    });
  }

  appState.departureMarker.setLngLat([appState.departure.lng, appState.departure.lat]);
  appState.departureMarker.getPopup().setHTML(`
    <div class="map-popup-card">
      <strong>${appState.departure.label}</strong>
      <span>${formatLatLng(appState.departure.lat, appState.departure.lng)}</span>
      <p>Departure reference point.</p>
    </div>
  `);

  appState.targetMarker.setLngLat([appState.target.lng, appState.target.lat]);
  appState.targetMarker.getPopup().setHTML(`
    <div class="map-popup-card">
      <strong>${appState.target.label}</strong>
      <span>${formatLatLng(appState.target.lat, appState.target.lng)}</span>
      <p>Drag this pin to test a different patch of water.</p>
    </div>
  `);
  const targetElement = appState.targetMarker.getElement();
  targetElement.className = `gps-marker-target gps-marker-target-${targetBand}`;

  const riskSource = appState.map.getSource("risk-area");
  if (riskSource) {
    riskSource.setData(buildPatchGeoJson(appState.targetSample));
  }

  const routeLineSource = appState.map.getSource("route-line");
  if (routeLineSource) {
    routeLineSource.setData(buildRouteGeoJson(appState.routePath));
  }

  const routeSegmentsSource = appState.map.getSource("route-segments");
  if (routeSegmentsSource) {
    routeSegmentsSource.setData(buildRouteSegmentsGeoJson(appState.routePath));
  }

  const greenRouteSegmentsSource = appState.map.getSource("green-route-segments");
  if (greenRouteSegmentsSource) {
    greenRouteSegmentsSource.setData(buildRouteSegmentsGeoJson(appState.greenRoutePath));
  }

  const routeNodesSource = appState.map.getSource("route-nodes");
  if (routeNodesSource) {
    routeNodesSource.setData(buildRouteNodesGeoJson(appState.routePath));
  }
}

async function updateTargetFromMap(lng, lat, label = "Selected patch") {
  appState.target = {
    lat,
    lng,
    label,
  };
  await refreshConditions(true);
}

async function refreshConditions(keepView = false) {
  try {
    setStatus(`Syncing live conditions for ${appState.target.label}...`);
    setMissionState("SYNCING", `Evaluating a ${PATCH_RADIUS_KM} km circular patch around the current pin.`);

    const [targetSample, routeSamples] = await Promise.all([
      fetchMarineSample(appState.target),
      fetchMarineSamplesForPoints(buildRouteGrid(appState.departure, appState.target)),
    ]);

    appState.targetSample = targetSample;
    appState.routeSamples = routeSamples;
    appState.routePath = computeRoutePath(routeSamples);
    appState.greenRoutePath = computeGreenRoutePath(routeSamples);
    appState.target = {
      lat: appState.targetSample.lat,
      lng: appState.targetSample.lng,
      label: appState.targetSample.label,
    };

    renderMap();
    buildRecommendation();

    const routeMessage = appState.greenRoutePath.length > 1
      ? "Harbour found both a best-available route and an alternate all-green route."
      : "Harbour mapped the best available safer connection route, but no fully green corridor was found.";

    setStatus(`Live conditions synced for the selected patch. ${routeMessage}`, "success");

    if (!keepView && appState.mapLoaded) {
      appState.map.flyTo({
        center: [appState.target.lng, appState.target.lat],
        zoom: 6.1,
        speed: 0.8,
        curve: 1.1,
        essential: true,
      });
    }
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
    const departure = await geocodePlace(query);
    appState.departure = departure;
    appState.dieselPrice = getDieselPriceForDeparture(departure);
    syncDieselInput();
    appState.routeSamples = [];
    appState.routePath = [];
    appState.greenRoutePath = [];
    appState.target = {
      lat: departure.lat,
      lng: departure.lng,
      label: "Selected patch",
    };
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
      appState.departure = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        label: "Current location",
        country: "",
        countryCode: "",
        admin1: "",
      };
      appState.dieselPrice = DEFAULT_DIESEL_PRICE;
      syncDieselInput();
      appState.routeSamples = [];
      appState.routePath = [];
      appState.greenRoutePath = [];
      appState.target = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        label: "Selected patch",
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
    elements.alertState.textContent = "Override is available, but the current patch is not red so no alerts were prepared.";
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
              <p>${timestamp}: Override triggered for ${appState.target.label}. Selected patch remained red at ${data.overallScore}/100.</p>
            </div>
          `
        )
        .join("")
    : `<div class="alert-item"><strong>No contacts listed.</strong><p>Add emergency contacts to prepare outbound alerts.</p></div>`;
}

function wireInputs() {
  elements.searchBtn.addEventListener("click", searchLocation);
  elements.useLocationBtn.addEventListener("click", useCurrentLocation);
  elements.refreshBtn.addEventListener("click", () => refreshConditions());
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
    elements.fishSpecies,
    elements.fuelBurn,
    elements.cruiseSpeed,
    elements.tripHours,
    elements.otherCosts,
    elements.plannedCatch,
  ].forEach((element) => {
    element.addEventListener("input", buildRecommendation);
  });
}

async function boot() {
  ensureMap();
  wireInputs();
  syncDieselInput();
  await refreshConditions();
}

boot();
