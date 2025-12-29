import { useCallback, useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import { Source, ObserverLocation, StandardStarCandidate } from "../types";
import { angularSeparationArcmin, equatorialToHorizontal, parseDEC, parseRA } from "../utils/coordinates";

const DEFAULT_STANDARD_URL = "data/spec_standard.csv";

type RowParser = (row: string[]) => Source | null;

const rowToSource: RowParser = row => {
  if (row.length < 9) return null;
  const [name, rah, ram, ras, decd, decm, decs, vmag, type] = row;
  const trimmedDec = decd.trim().startsWith("+") || decd.trim().startsWith("-") ? decd.trim() : `+${decd.trim()}`;
  const raString = `${rah.trim()}h${ram.trim()}m${ras.trim()}s`;
  const decString = `${trimmedDec}d${decm.trim()}m${decs.trim()}s`;
  const ra = parseRA(raString);
  const dec = parseDEC(decString);
  const visualMag = parseFloat(vmag);
  return {
    name: name.trim(),
    ra,
    dec,
    type: type?.trim() ?? "",
    vmag: Number.isFinite(visualMag) ? visualMag : 0,
  };
};

export const useStandardStars = (url = DEFAULT_STANDARD_URL) => {
  const [standards, setStandards] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`加载标准星失败: ${response.statusText}`);
        const text = await response.text();
        const rows = d3.csvParseRows(text, rowToSource).filter(Boolean) as Source[];
        if (!cancelled) {
          setStandards(rows);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const recommend = useCallback(
    (
      target: Source | null,
      observer: ObserverLocation,
      obsTime: string,
      count = 3,
      minAltitude = 15
    ): StandardStarCandidate[] => {
      if (!target) return [];
      const observationDate = new Date(obsTime);
      const altFrame = equatorialToHorizontal(target.ra, target.dec, observer.lat, observer.lon, observationDate);
      const targetAltitude = altFrame.alt;
      return standards
        .map(star => {
          const separationArcmin = angularSeparationArcmin(target, star);
          const altAz = equatorialToHorizontal(star.ra, star.dec, observer.lat, observer.lon, observationDate);
          const altitudeDeg = altAz.alt;
          return {
            name: star.name,
            ra: star.ra,
            dec: star.dec,
            type: star.type,
            vmag: star.vmag,
            separationArcmin,
            altitudeDeg,
            observable: altitudeDeg >= minAltitude,
            targetAltitudeDeg: targetAltitude,
          };
        })
        .sort((a, b) => a.separationArcmin - b.separationArcmin)
        .slice(0, count);
    },
    [standards]
  );

  return useMemo(
    () => ({
      standards,
      recommend,
      error,
    }),
    [standards, recommend, error]
  );
};
