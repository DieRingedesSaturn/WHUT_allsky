import SunCalc from "suncalc";
import { coord, julian, sidereal, globe } from "astronomia";

const degToRad = Math.PI / 180;
const radToDeg = 180 / Math.PI;
const GlobeCoord = globe.Coord;

export const formatDatetimeLocal = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

export const parseRA = (input: string): number => {
  const trimmed = input.trim();
  if (/[hms]/i.test(trimmed) || trimmed.split(/[:\s]+/).length === 3) {
    const parts = trimmed
      .replace(/[hms]/gi, " ")
      .trim()
      .split(/[:\s]+/)
      .map(Number);
    const [h, m, s] = [parts[0] || 0, parts[1] || 0, parts[2] || 0];
    return (h + m / 60 + s / 3600) * 15;
  }
  return parseFloat(trimmed);
};

export const parseDEC = (input: string): number => {
  const trimmed = input.trim();
  if (/[dms]/i.test(trimmed) || trimmed.split(/[:\s]+/).length === 3) {
    const parts = trimmed
      .replace(/[dms]/gi, " ")
      .trim()
      .split(/[:\s]+/)
      .map(Number);
    const sign = trimmed.startsWith("-") ? -1 : 1;
    const [d, m, s] = [Math.abs(parts[0] || 0), parts[1] || 0, parts[2] || 0];
    return sign * (d + m / 60 + s / 3600);
  }
  return parseFloat(trimmed);
};

export const degToHMS = (raDeg: number): string => {
  let totalSeconds = (raDeg / 15) * 3600;
  const h = Math.floor(totalSeconds / 3600);
  totalSeconds -= h * 3600;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds - m * 60;
  return `${h.toString().padStart(2, "0")}h${m.toString().padStart(2, "0")}m${s
    .toFixed(2)
    .padStart(5, "0")}s`;
};

export const degToDMS = (decDeg: number): string => {
  const sign = decDeg < 0 ? "-" : "+";
  let totalSeconds = Math.abs(decDeg) * 3600;
  const d = Math.floor(totalSeconds / 3600);
  totalSeconds -= d * 3600;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds - m * 60;
  return `${sign}${d.toString().padStart(2, "0")}d${m.toString().padStart(2, "0")}m${s
    .toFixed(2)
    .padStart(5, "0")}s`;
};

export const convertEquatorialToGalactic = (ra: number, dec: number) => {
  const eq = new coord.Equatorial(ra * degToRad, dec * degToRad);
  const gal = eq.toGalactic();
  return { l: gal.lon * radToDeg, b: gal.lat * radToDeg };
};

export const convertGalacticToEquatorial = (l: number, b: number) => {
  const gal = new coord.Galactic(l * degToRad, b * degToRad);
  const eq = gal.toEquatorial();
  return { ra: eq.ra * radToDeg, dec: eq.dec * radToDeg };
};

export const toGST = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes();
  const second = date.getUTCSeconds() + date.getUTCMilliseconds() / 1000;
  const jd =
    julian.CalendarToJD(year, month, day) +
    (hour + minute / 60 + second / 3600) / 24;
  return sidereal.apparent(jd);
};

export const equatorialToHorizontal = (
  raDeg: number,
  decDeg: number,
  latDeg: number,
  lonDeg: number,
  date: Date
) => {
  const g = new GlobeCoord(latDeg * degToRad, -lonDeg * degToRad);
  const eq = new coord.Equatorial(raDeg * degToRad, decDeg * degToRad);
  const st = toGST(date);
  const hor = eq.toHorizontal(g, st);
  return { alt: hor.alt * radToDeg, az: hor.az * radToDeg };
};

export const angularSeparationArcmin = (
  a: { ra: number; dec: number },
  b: { ra: number; dec: number }
) => {
  const ra1 = a.ra * degToRad;
  const dec1 = a.dec * degToRad;
  const ra2 = b.ra * degToRad;
  const dec2 = b.dec * degToRad;
  const cosTheta =
    Math.sin(dec1) * Math.sin(dec2) +
    Math.cos(dec1) * Math.cos(dec2) * Math.cos(ra1 - ra2);
  return Math.acos(Math.min(1, Math.max(-1, cosTheta))) * (radToDeg * 60);
};

export const moonPhaseName = (phase: number) => {
  if (phase < 0.03 || phase > 0.97) return "新月 🌑";
  if (phase < 0.22) return "峨眉月 🌒";
  if (phase < 0.28) return "上弦月 🌓";
  if (phase < 0.47) return "盈凸月 🌔";
  if (phase < 0.53) return "满月 🌕";
  if (phase < 0.72) return "亏凸月 🌖";
  if (phase < 0.78) return "下弦月 🌗";
  return "残月 🌘";
};

export const computeMoonInfo = (date: Date) => {
  const info = SunCalc.getMoonIllumination(date);
  return { fraction: info.fraction, phase: info.phase, name: moonPhaseName(info.phase) };
};

export const galacticX = (l: number) => {
  let val = ((l + 180) % 360) - 180;
  return -val;
};

export const formatLon = (l: number) => {
  let val = ((l % 360) + 360) % 360;
  if (val === 360) val = 0;
  return val === 0 ? "0" : `${val}`;
};

export const computeObservableRegions = (
  lat: number,
  lon: number,
  date: Date,
  minAlt = 30
) => {
  const points: [number, number][] = [];
  for (let l = 0; l <= 360; l += 5) {
    for (let b = -90; b <= 90; b += 5) {
      const { ra, dec } = convertGalacticToEquatorial(l, b);
      const { alt } = equatorialToHorizontal(ra, dec, lat, lon, date);
      if (!Number.isNaN(alt) && alt >= minAlt) {
        points.push([l, b]);
      }
    }
  }
  return points;
};

export const sunAltitudeDeg = (date: Date, lat: number, lon: number) => {
  const sunPos = SunCalc.getPosition(date, lat, lon);
  return (sunPos.altitude * radToDeg);
};

export const isAstronomicalNight = (date: Date, lat: number, lon: number) => {
  return sunAltitudeDeg(date, lat, lon) < -18;
};

export const computeNextObservableTime = (
  source: { ra: number; dec: number },
  lat: number,
  lon: number,
  startDate: Date,
  maxDays = 30,
  altThreshold = 30
) => {
  const searchDurationHours = 24 * maxDays;
  const stepMinutes = 5;
  const endTime = new Date(startDate.getTime() + searchDurationHours * 60 * 60 * 1000);
  let currentTime = new Date(startDate);
  while (currentTime < endTime) {
    const sunAlt = sunAltitudeDeg(currentTime, lat, lon);
    const { alt } = equatorialToHorizontal(source.ra, source.dec, lat, lon, currentTime);
    if (sunAlt < -18 && alt >= altThreshold) {
      return currentTime;
    }
    currentTime = new Date(currentTime.getTime() + stepMinutes * 60 * 1000);
  }
  return null;
};

export const computeAltitudeSeries = (
  source: { ra: number; dec: number; name?: string },
  lat: number,
  lon: number,
  start: Date,
  end: Date,
  stepMinutes = 5
) => {
  const samples = [] as { time: Date; targetAlt: number; moonAlt: number; moonAngle: number }[];
  for (let ts = start.getTime(); ts <= end.getTime(); ts += stepMinutes * 60 * 1000) {
    const time = new Date(ts);
    const moon = SunCalc.getMoonPosition(time, lat, lon);
    const { alt, az } = equatorialToHorizontal(source.ra, source.dec, lat, lon, time);
    const rad = degToRad;
    const targetAltRad = alt * rad;
    const targetAzRad = az * rad;
    const moonAlt = moon.altitude * radToDeg;
    const cosTheta =
      Math.sin(targetAltRad) * Math.sin(moon.altitude) +
      Math.cos(targetAltRad) * Math.cos(moon.altitude) * Math.cos(targetAzRad - moon.azimuth);
    const angle = Math.acos(Math.min(1, Math.max(-1, cosTheta))) * radToDeg;
    if (alt >= 10) {
      samples.push({ time, targetAlt: alt, moonAlt, moonAngle: angle });
    }
  }
  return samples;
};

export const decodeTimeRange = (range: [string, string]) => {
  return [new Date(range[0]), new Date(range[1])];
};

export const encodeTimeRange = (start: Date, end: Date) => [formatDatetimeLocal(start), formatDatetimeLocal(end)] as [string, string];

export const findNightInterval = (
  lat: number,
  lon: number,
  start: Date,
  end: Date,
  stepMinutes = 5
) => {
  const nightTimes: Date[] = [];
  for (let ts = start.getTime(); ts <= end.getTime(); ts += stepMinutes * 60 * 1000) {
    const time = new Date(ts);
    if (sunAltitudeDeg(time, lat, lon) < -18) {
      nightTimes.push(time);
    }
  }
  if (!nightTimes.length) return { start: null, end: null };
  return { start: nightTimes[0], end: nightTimes[nightTimes.length - 1] };
};

export { degToRad, radToDeg };
