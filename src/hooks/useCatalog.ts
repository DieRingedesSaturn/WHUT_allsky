import { useCallback, useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import { Source } from "../types";
import { parseDEC, parseRA } from "../utils/coordinates";

const DEFAULT_CATALOG_URL = "data/catalog.csv";

export interface UseCatalogResult {
  catalog: Source[];
  filteredCatalog: Source[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  setCatalog: (updater: Source[] | ((prev: Source[]) => Source[])) => void;
  importCsv: (file: File) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const useCatalog = (url = DEFAULT_CATALOG_URL): UseCatalogResult => {
  const [catalog, setCatalogState] = useState<Source[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const data = await d3.csv(url, d => ({
          name: (d.name as string) ?? "",
          ra: parseRA((d.ra as string) ?? "0"),
          dec: parseDEC((d.dec as string) ?? "0"),
          type: (d.type as string) ?? "",
          vmag: +(d.vmag ?? 0),
        }));
        if (!cancelled) {
          setCatalogState(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const importCsv = useCallback(async (file: File) => {
    const text = await file.text();
    const parsed = d3.csvParse(text, d => ({
      name: (d.name as string) ?? "",
      ra: parseRA((d.ra as string) ?? "0"),
      dec: parseDEC((d.dec as string) ?? "0"),
      type: (d.type as string) ?? "",
      vmag: +(d.vmag ?? 0),
    }));
    setCatalogState(parsed);
  }, []);

  const setCatalog = useCallback(
    (updater: Source[] | ((prev: Source[]) => Source[])) => {
      setCatalogState(prev => (typeof updater === "function" ? (updater as (prev: Source[]) => Source[])(prev) : updater));
    },
    []
  );

  const filteredCatalog = useMemo(() => {
    if (!searchTerm) return catalog;
    const lower = searchTerm.toLowerCase();
    return catalog.filter(source => source.name.toLowerCase().includes(lower));
  }, [catalog, searchTerm]);

  return {
    catalog,
    filteredCatalog,
    searchTerm,
    setSearchTerm,
    setCatalog,
    importCsv,
    loading,
    error,
  };
};

