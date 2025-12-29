import { useCallback, useEffect, useMemo, useState } from "react";
import ControlsPanel from "./components/ControlsPanel";
import SkyMap, { projections } from "./components/SkyMap";
import AltitudeChart from "./components/AltitudeChart";
import CatalogTable, { NewSourceDraft } from "./components/CatalogTable";
import StandardStarPanel from "./components/StandardStarPanel";
import NotesPanel from "./components/NotesPanel";
import useWindowSize from "./hooks/useWindowSize";
import { useCatalog } from "./hooks/useCatalog";
import { useStandardStars } from "./hooks/useStandardStars";
import { computeMoonInfo, computeNextObservableTime, degToDMS, degToHMS, formatDatetimeLocal } from "./utils/coordinates";
import { DisplayMode, ObserverLocation, Source, StandardStarCandidate } from "./types";

const observatories: Array<ObserverLocation & { name: string }> = [
  { name: "Lenghu", lat: 38.6068, lon: 93.8961, alt: 4000 },
  { name: "Lijiang", lat: 26.7, lon: 100.01, alt: 3000 },
  { name: "La Silla", lat: -29.3, lon: -70.7, alt: 2400 },
];

const initialTimeRange = () => {
  const base = new Date();
  const start = new Date(base);
  start.setHours(12, 0, 0, 0);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return [formatDatetimeLocal(start), formatDatetimeLocal(end)] as [string, string];
};

const App = () => {
  const { catalog, filteredCatalog, searchTerm, setSearchTerm, setCatalog, importCsv } = useCatalog();
  const { recommend } = useStandardStars();

  const [highlightName, setHighlightName] = useState<string | null>(null);
  const [projectionName, setProjectionName] = useState<keyof typeof projections>("Mollweide");
  const [rotation, setRotation] = useState<[number, number]>([0, 0]);
  const [observer, setObserver] = useState<ObserverLocation>({ lat: 38.6068, lon: 93.8961, alt: 4000 });
  const [obsTime, setObsTime] = useState<string>(() => formatDatetimeLocal(new Date()));
  const [timeRange, setTimeRange] = useState<[string, string]>(() => initialTimeRange());
  const [darkMode, setDarkMode] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("hms");
  const [calculateTimes, setCalculateTimes] = useState(false);
  const [nextObservableTimes, setNextObservableTimes] = useState<Record<string, Date | null>>({});
  const [isCalculatingTimes, setIsCalculatingTimes] = useState(false);
  const [moonInfo, setMoonInfo] = useState<{ fraction: number; phase: number; name: string } | null>(null);
  const [draft, setDraft] = useState<NewSourceDraft>({
    name: "",
    raInput: "",
    decInput: "",
    ra: 0,
    dec: 0,
    type: "",
    vmag: 0,
  });
  const [query, setQuery] = useState("");
  const [recommendations, setRecommendations] = useState<StandardStarCandidate[]>([]);
  const { width: viewportWidth } = useWindowSize();

  const { mapWidth, chartWidth, stacked } = useMemo(() => {
    const padding = 64;
    const available = Math.max(900, viewportWidth - padding);
    const stack = viewportWidth < 1280;

    if (stack) {
      const width = Math.max(600, Math.min(available, 1080));
      const chart = Math.max(540, Math.min(width, 960));
      return { mapWidth: width, chartWidth: chart, stacked: true };
    }

    const desiredMap = Math.max(760, Math.min(1024, available * 0.62));
    let desiredChart = available - desiredMap - 40;
    if (desiredChart < 560) {
      desiredChart = 560;
    }
    let map = available - desiredChart - 40;
    if (map < 760) {
      map = 760;
      desiredChart = Math.max(560, available - map - 40);
    }
    map = Math.min(map, 1100);
    desiredChart = Math.min(desiredChart, 820);
    return { mapWidth: map, chartWidth: desiredChart, stacked: false };
  }, [viewportWidth]);

  const sharedHeight = useMemo(() => {
    return Math.max(400, Math.min(560, mapWidth * 0.48));
  }, [mapWidth]);

  const highlight = useMemo(
    () => (highlightName ? catalog.find(source => source.name === highlightName) ?? null : null),
    [catalog, highlightName]
  );

  useEffect(() => {
    setMoonInfo(computeMoonInfo(new Date(obsTime)));
  }, [obsTime]);

  useEffect(() => {
    document.body.classList.toggle("dark-mode", darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (!calculateTimes) {
      setNextObservableTimes({});
      setIsCalculatingTimes(false);
      return;
    }
    const startDate = new Date(obsTime);
    setIsCalculatingTimes(true);
    const updates: Record<string, Date | null> = {};
    Promise.all(
      catalog.map(source =>
        new Promise<void>(resolve => {
          const next = computeNextObservableTime(source, observer.lat, observer.lon, startDate);
          updates[source.name] = next;
          resolve();
        })
      )
    )
      .then(() => {
        setNextObservableTimes(updates);
      })
      .finally(() => setIsCalculatingTimes(false));
  }, [catalog, observer, obsTime, calculateTimes]);

  const handleRowSelect = (source: Source) => {
    setHighlightName(source.name);
    setRecommendations([]);
  };

  const handleAddSource = (source: Source) => {
    setCatalog(prev => [...prev, source]);
  };

  const handleDeleteSelected = () => {
    if (!highlight) return;
    setCatalog(prev => prev.filter(source => source.name !== highlight.name));
    setHighlightName(null);
    setRecommendations([]);
  };

  const handleCsvUpload = (file: File) => {
    importCsv(file);
  };

  const handleSimbadSearch = async () => {
    if (!query.trim()) return;
    try {
      const url = `https://simbad.u-strasbg.fr/simbad/sim-id?Ident=${encodeURIComponent(
        query
      )}&output.format=VOTable&list.otypesel=on&obj.cooN=on&obj.fluxsel=on&V=on`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("SIMBAD 请求失败");
      const text = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(text, "application/xml");
      const fields = Array.from(xmlDoc.querySelectorAll("FIELD")).map(
        field => field.getAttribute("name") || field.getAttribute("ID")
      );
      const values = Array.from(xmlDoc.querySelectorAll("TABLEDATA TR TD")).map(td => td.textContent?.trim() || "");
      const data: Record<string, string> = {};
      fields.forEach((field, index) => {
        if (field) data[field] = values[index];
      });
      const raDeg = parseFloat(data["RA_d"] ?? "");
      const decDeg = parseFloat(data["DEC_d"] ?? "");
      const vmag = parseFloat(data["FLUX_V"] ?? "");
      setDraft(prev => ({
        name: query,
        raInput: Number.isFinite(raDeg) ? degToHMS(raDeg) : prev.raInput,
        decInput: Number.isFinite(decDeg) ? degToDMS(decDeg) : prev.decInput,
        ra: Number.isFinite(raDeg) ? raDeg : prev.ra,
        dec: Number.isFinite(decDeg) ? decDeg : prev.dec,
        type: data["OTYPE_S"] ?? prev.type,
        vmag: Number.isFinite(vmag) ? vmag : prev.vmag,
      }));
      setQuery("");
    } catch (err) {
      console.error(err);
    }
  };

  const handleFindStandards = () => {
    const recs = recommend(highlight ?? null, observer, obsTime, 3);
    setRecommendations(recs);
  };

  const appStyle = {
    minHeight: "100vh",
    minWidth: "100vw",
    width: "100%",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "stretch",
    color: "var(--color-text)",
    backgroundColor: "var(--color-bg)",
    transition: "background-color 0.3s ease",
    boxSizing: "border-box" as const,
  };

  return (
    <div style={appStyle} className={darkMode ? "dark-mode" : ""}>
      <ControlsPanel
        projectionName={projectionName}
        onProjectionChange={name => setProjectionName(name as keyof typeof projections)}
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
        observer={observer}
        onObserverChange={setObserver}
        observatories={observatories}
        obsTime={obsTime}
        onObsTimeChange={setObsTime}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        calculateTimes={calculateTimes}
        onCalculateTimesChange={setCalculateTimes}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(prev => !prev)}
        moonInfo={moonInfo}
      />

      {/**
       * 原布局（可恢复使用）
       * <section style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 24, padding: "0 24px" }}>
       *   <SkyMap
       *     sources={catalog}
       *     highlight={highlight}
       *     projectionName={projectionName}
       *     rotation={rotation}
       *     onRotationChange={setRotation}
       *     obsLat={observer.lat}
       *     obsLon={observer.lon}
       *     obsTime={obsTime}
       *   />
       *
       *   <AltitudeChart source={highlight} obsLat={observer.lat} obsLon={observer.lon} timeRange={timeRange} />
      * </section>
       */}

      <section className="map-chart-row" style={{ flexWrap: stacked ? "wrap" : "nowrap" }}>
        {/* Use percentage-based flex sizing derived from the computed pixel widths so
            the layout remains proportional but becomes responsive to container size. */}
        <div
          className="map-wrapper"
          style={{
            flex: stacked ? "0 0 100%" : `0 0 ${Math.round((mapWidth / (mapWidth + chartWidth)) * 100)}%`,
            maxWidth: "100%",
          }}
        >
          <SkyMap
            sources={catalog}
            highlight={highlight}
            projectionName={projectionName}
            rotation={rotation}
            onRotationChange={setRotation}
            obsLat={observer.lat}
            obsLon={observer.lon}
            obsTime={obsTime}
            width={Math.round(mapWidth)}
            height={Math.round(sharedHeight)}
          />
        </div>

        <div
          className="chart-wrapper"
          style={{
            flex: stacked ? "0 0 100%" : `0 0 ${Math.round((chartWidth / (mapWidth + chartWidth)) * 100)}%`,
            maxWidth: "100%",
          }}
        >
          <AltitudeChart
            source={highlight}
            obsLat={observer.lat}
            obsLon={observer.lon}
            timeRange={timeRange}
            width={Math.round(chartWidth)}
            height={Math.round(sharedHeight)}
          />
        </div>
      </section>

      <section className="panel-stack">
        <CatalogTable
          filtered={filteredCatalog}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          displayMode={displayMode}
          onRowSelect={handleRowSelect}
          highlight={highlight}
          onCsvUpload={handleCsvUpload}
          onAddSource={handleAddSource}
          onDeleteSelected={handleDeleteSelected}
          draft={draft}
          onDraftChange={setDraft}
          query={query}
          onQueryChange={setQuery}
          onQuerySubmit={handleSimbadSearch}
          nextObservableTimes={nextObservableTimes}
          isCalculatingTimes={isCalculatingTimes}
          darkMode={darkMode}
        />

        <StandardStarPanel
          recommendations={recommendations}
          onFind={handleFindStandards}
          hasSelection={Boolean(highlight)}
        />

        <NotesPanel title="Useful links">
          <h4>Weather </h4>
            <p> MUST全天相机 &nbsp;
              <a href="http://62.234.26.56/allsky/ " target="_blank" rel="noopener noreferrer">
              MUST allsky
              </a>
            </p>
            <p> Windy 云图预报 （冷湖） &nbsp;
              <a href="https://www.windy.com/38.611/93.901?clouds,35.681,94.343,7,i:pressure " target="_blank" rel="noopener noreferrer">
              https://www.windy.com
              </a>
            </p>
            <p> meteoblue 天气预报 （冷湖） &nbsp;
              <a href="https://www.meteoblue.com/en/weather/forecast/meteogramweb/38.6%C2%B0N+93.9%C2%B0E_38.6N93.9E4078_Asia%2FShanghai " target="_blank" rel="noopener noreferrer">
              https://www.meteoblue.com
              </a>
            </p>
            <p> CLEAR OUTSIDE 天气预报 （冷湖） &nbsp;
              <a href="https://clearoutside.com/forecast/38.60/93.90 " target="_blank" rel="noopener noreferrer">
              https://clearoutside.com
              </a>
            </p>
          <h4>Astronomy Tools </h4>
            <p> Heavens-Above 卫星及国际空间站过境 &nbsp;
              <a href="https://www.heavens-above.com/ " target="_blank" rel="noopener noreferrer">
              https://www.heavens-above.com
              </a>
            </p>
            <p> 查看星高 &nbsp;
              <a href="https://astro.ing.iac.es/staralt/" target="_blank" rel="noopener noreferrer">
              https://astro.ing.iac.es/staralt
              </a>
            </p>
            <p> aavso star find chart 用于认证源 &nbsp;
              <a href="https://apps.aavso.org/vsp " target="_blank" rel="noopener noreferrer">
              https://apps.aavso.org/vsp
              </a>
            </p>
            <p> MJD 转换 &nbsp;
              <a href="http://www.csgnetwork.com/julianmodifdateconv.html " target="_blank" rel="noopener noreferrer">
              http://www.csgnetwork.com/julianmodifdateconv.html
              </a>
            </p>
          <h4>Explore </h4>
            <p> Atel &nbsp;
              <a href="https://www.astronomerstelegram.org/ " target="_blank" rel="noopener noreferrer">
              https://www.astronomerstelegram.org
              </a>
            </p>
          <h4>Astronomy Data </h4>
            <p> simbad 天体数据库 &nbsp;
              <a href="https://simbad.u-strasbg.fr/simbad/ " target="_blank" rel="noopener noreferrer">
              https://simbad.u-strasbg.fr/simbad
              </a>
            </p>
            <p> All-Sky Automated Survey for Supernovae 查询天体光变 &nbsp;
              <a href="https://asas-sn.osu.edu/ " target="_blank" rel="noopener noreferrer">
              https://asas-sn.osu.edu
              </a>
            </p>
            <p> aavso lightcurve generator &nbsp;
              <a href="https://www.aavso.org/LCGv2/ " target="_blank" rel="noopener noreferrer">
              https://www.aavso.org/LCGv2
              </a>
            </p>
            <p> MAXI X-ray lightcurve &nbsp;
              <a href="https://maxi.riken.jp/top/slist.html " target="_blank" rel="noopener noreferrer">
              https://maxi.riken.jp/top/slist.html
              </a>
            </p>



          
        </NotesPanel>
      </section>

      <footer style={{ padding: "16px", fontSize: 14, textAlign: "center" }}>
        <p> 在图表上悬停可查看该时刻的星高、月亮高度和月亮夹角。 </p>
        <p> 下次可观测时间仅计算之后一个月内的。如果要之后的可调整观测时间。 </p>
        <p> 选中源后点击寻找光谱标准星会返回离得最近的几个标准星，建议选择高度角差不多且比较亮的源。 </p>
        <p> 支持从SIMBAD检索源信息。目前支持源名称检索，点击从SIMBAD检索后会自动填充，点击添加即可。部分源可能没有Vmag信息。 </p>
        <p> 输入以及导入csv星表的坐标支持 11h22m33s, -12d34m56s 或 11:22:33, -12:34:56 或 11 22 33, -12 34 56 或 170.63, -12.58. 显示模式可切换。 </p>
      </footer>
    </div>
  );
};

export default App;
