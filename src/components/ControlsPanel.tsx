import { ObserverLocation, DisplayMode } from "../types";
import { projections } from "./SkyMap";

interface Observatory extends ObserverLocation {
  name: string;
}

interface ControlsPanelProps {
  projectionName: string;
  onProjectionChange: (name: string) => void;
  displayMode: DisplayMode;
  onDisplayModeChange: (mode: DisplayMode) => void;
  observer: ObserverLocation;
  onObserverChange: (observer: ObserverLocation) => void;
  observatories: Observatory[];
  obsTime: string;
  onObsTimeChange: (value: string) => void;
  timeRange: [string, string];
  onTimeRangeChange: (range: [string, string]) => void;
  calculateTimes: boolean;
  onCalculateTimesChange: (value: boolean) => void;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  moonInfo?: { fraction: number; phase: number; name: string } | null;
}

const ControlsPanel = ({
  projectionName,
  onProjectionChange,
  displayMode,
  onDisplayModeChange,
  observer,
  onObserverChange,
  observatories,
  obsTime,
  onObsTimeChange,
  timeRange,
  onTimeRangeChange,
  calculateTimes,
  onCalculateTimesChange,
  darkMode,
  onToggleDarkMode,
  moonInfo,
}: ControlsPanelProps) => {
  const handleObserverSelect = (value: string) => {
    const [lat, lon, alt] = value.split(",").map(Number);
    onObserverChange({ lat, lon, alt });
  };

  return (
    <div className="controls-container panel-section">
      <header className="controls-header">
        <img className="controls-logo" src="figure/logo.png" alt="logo" />
        <h2 style={{ margin: 0 }}>WHU telescope</h2>
      </header>

      <div className="controls-group">
        <label>
          投影方式：
          <select
            className="control-select"
            value={projectionName}
            onChange={e => onProjectionChange(e.target.value)}
          >
            {Object.keys(projections).map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label>
          显示模式：
          <select
            className="control-select"
            value={displayMode}
            onChange={e => onDisplayModeChange(e.target.value as DisplayMode)}
          >
            <option value="hms">HMS</option>
            <option value="deg">度</option>
          </select>
        </label>

        <button className="control-button" onClick={onToggleDarkMode}>
          {darkMode ? "日间模式" : "夜间模式"}
        </button>
      </div>

      <div className="controls-group">
        <label>
          选择观测站：
          <select
            className="control-select"
            value={`${observer.lat},${observer.lon},${observer.alt}`}
            onChange={e => handleObserverSelect(e.target.value)}
          >
            {observatories.map(obs => (
              <option key={obs.name} value={`${obs.lat},${obs.lon},${obs.alt}`}>
                {obs.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          纬度
          <input
            className="control-input"
            type="number"
            value={observer.lat}
            onChange={e => onObserverChange({ ...observer, lat: parseFloat(e.target.value) })}
            style={{ width: 90 }}
          />
        </label>
        <label>
          经度
          <input
            className="control-input"
            type="number"
            value={observer.lon}
            onChange={e => onObserverChange({ ...observer, lon: parseFloat(e.target.value) })}
            style={{ width: 90 }}
          />
        </label>
        <label>
          海拔 (m)
          <input
            className="control-input"
            type="number"
            value={observer.alt}
            onChange={e => onObserverChange({ ...observer, alt: parseFloat(e.target.value) })}
            style={{ width: 110 }}
          />
        </label>

        <label>
          观测时间
          <input
            className="control-input"
            type="datetime-local"
            value={obsTime}
            onChange={e => onObsTimeChange(e.target.value)}
            style={{ width: 200 }}
          />
        </label>

        <label>
          昏影时间范围
          <input
            className="control-input"
            type="datetime-local"
            value={timeRange[0]}
            onChange={e => onTimeRangeChange([e.target.value, timeRange[1]])}
            style={{ width: 200 }}
          />
          -
          <input
            className="control-input"
            type="datetime-local"
            value={timeRange[1]}
            onChange={e => onTimeRangeChange([timeRange[0], e.target.value])}
            style={{ width: 200 }}
          />
        </label>
      </div>

      <div className="controls-group">
        <label>
          <input
            className="control-checkbox"
            type="checkbox"
            checked={calculateTimes}
            onChange={e => onCalculateTimesChange(e.target.checked)}
          />
          计算下次可观测时间
        </label>
        <span>时间基于浏览器本地时区</span>
        {moonInfo && (
          <span>
            Moon: {(moonInfo.fraction * 100).toFixed(1)}% {moonInfo.name}
          </span>
        )}
      </div>
    </div>
  );
};

export default ControlsPanel;
