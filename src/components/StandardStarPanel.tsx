import { StandardStarCandidate } from "../types";
import { degToDMS, degToHMS } from "../utils/coordinates";

interface StandardStarPanelProps {
  recommendations: StandardStarCandidate[];
  onFind: () => void;
  hasSelection: boolean;
}

const StandardStarPanel = ({ recommendations, onFind, hasSelection }: StandardStarPanelProps) => {
  return (
    <div className="panel-section standard-panel">
      <button
        className="control-button"
        onClick={onFind}
        disabled={!hasSelection}
        style={{ width: "100%", marginBottom: 12, opacity: hasSelection ? 1 : 0.5 }}
      >
        寻找光谱标准星
      </button>
      {!hasSelection && <div className="muted-text standard-message">请先在列表中选择一个源</div>}
      {hasSelection && recommendations.length === 0 && (
        <div className="muted-text standard-message">暂无符合条件的标准星</div>
      )}
      <div className="standard-grid">
        {recommendations.map(star => (
          <div key={star.name} className="standard-card">
            <strong>{star.name}</strong>
            <span>RA: {degToHMS(star.ra)}</span>
            <span>DEC: {degToDMS(star.dec)}</span>
            <span>角距离: {star.separationArcmin.toFixed(1)} arcmin</span>
            <span>标准星高度: {star.altitudeDeg.toFixed(1)}°</span>
            <span>目标高度: {star.targetAltitudeDeg.toFixed(1)}°</span>
            <span>Vmag: {star.vmag.toFixed(2)}</span>
            <span>类型: {star.type}</span>
            <span style={{ color: star.observable ? "#4cb54cff" : "#b75050ff" }}>
              {star.observable ? "可观测" : "不可观测 (Alt < 15°)"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StandardStarPanel;
