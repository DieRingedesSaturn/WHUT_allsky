import { ChangeEvent } from "react";
import DataTable, { createTheme } from "react-data-table-component";
import { DisplayMode, Source } from "../types";
import { degToDMS, degToHMS, parseDEC, parseRA } from "../utils/coordinates";

createTheme(
  "darkMode",
  {
    text: {
      primary: "#ffffff",
      secondary: "#aaaaaa",
    },
    background: {
      default: "#1e1e1e",
    },
    context: {
      background: "#333333",
      text: "#ffffff",
    },
    divider: {
      default: "#444444",
    },
    highlightOnHover: {
      default: "#2a2a2a",
      text: "#ffffff",
    },
  },
  "dark"
);

export interface NewSourceDraft {
  name: string;
  raInput: string;
  decInput: string;
  ra: number;
  dec: number;
  type: string;
  vmag: number;
}

interface CatalogTableProps {
  filtered: Source[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  displayMode: DisplayMode;
  onRowSelect: (source: Source) => void;
  highlight: Source | null;
  onCsvUpload: (file: File) => void;
  onAddSource: (source: Source) => void;
  onDeleteSelected: () => void;
  draft: NewSourceDraft;
  onDraftChange: (draft: NewSourceDraft) => void;
  query: string;
  onQueryChange: (value: string) => void;
  onQuerySubmit: () => void;
  nextObservableTimes: Record<string, Date | null>;
  isCalculatingTimes: boolean;
  darkMode: boolean;
}

const defaultDraft: NewSourceDraft = {
  name: "",
  raInput: "",
  decInput: "",
  ra: 0,
  dec: 0,
  type: "",
  vmag: 0,
};

const CatalogTable = ({
  filtered,
  searchTerm,
  onSearchChange,
  displayMode,
  onRowSelect,
  highlight,
  onCsvUpload,
  onAddSource,
  onDeleteSelected,
  draft,
  onDraftChange,
  query,
  onQueryChange,
  onQuerySubmit,
  nextObservableTimes,
  isCalculatingTimes,
  darkMode,
}: CatalogTableProps) => {

  const handleExport = () => {
    if (!filtered.length) return;
    const header = "name,ra,dec,type,vmag";
    const rows = filtered.map(source =>
      [
        source.name,
        source.ra.toFixed(6),
        source.dec.toFixed(6),
        source.type,
        Number.isFinite(source.vmag) ? source.vmag : "",
      ].join(",")
    );
    const csvContent = [header, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `catalog_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  const columns = [
    { name: "Name", selector: (row: Source) => row.name, sortable: true },
    {
      name: "RA",
      selector: (row: Source) => (displayMode === "hms" ? degToHMS(row.ra) : row.ra.toFixed(4)),
      sortFunction: (rowA: Source, rowB: Source) => rowA.ra - rowB.ra,
    },
    {
      name: "DEC",
      selector: (row: Source) => (displayMode === "hms" ? degToDMS(row.dec) : row.dec.toFixed(4)),
      sortFunction: (rowA: Source, rowB: Source) => rowA.dec - rowB.dec,
    },
    { name: "Type", selector: (row: Source) => row.type, sortable: true },
    { name: "Vmag", selector: (row: Source) => row.vmag, sortable: true },
    {
      name: "下次可观测时间",
      selector: (row: Source) => {
        if (isCalculatingTimes) return "计算中...";
        const next = nextObservableTimes[row.name];
        if (!next) return "无";
        return `${next.getFullYear()}-${(next.getMonth() + 1).toString().padStart(2, "0")}-${next
          .getDate()
          .toString()
          .padStart(2, "0")} ${next.toTimeString().slice(0, 5)}`;
      },
      sortable: true,
    },
  ];

  const handleDraftChange = (key: keyof NewSourceDraft) => (value: string) => {
    if (key === "raInput") {
      const parsed = parseRA(value);
      onDraftChange({ ...draft, raInput: value, ra: Number.isFinite(parsed) ? parsed : draft.ra });
      return;
    }
    if (key === "decInput") {
      const parsed = parseDEC(value);
      onDraftChange({ ...draft, decInput: value, dec: Number.isFinite(parsed) ? parsed : draft.dec });
      return;
    }
    if (key === "name" || key === "type") {
      onDraftChange({ ...draft, [key]: value } as NewSourceDraft);
      return;
    }
    if (key === "vmag") {
      onDraftChange({ ...draft, vmag: parseFloat(value) || 0 });
    }
  };

  const handleAdd = () => {
    if (!draft.name.trim()) return;
    onAddSource({
      name: draft.name,
      ra: draft.ra,
      dec: draft.dec,
      type: draft.type,
      vmag: draft.vmag,
    });
    onDraftChange({ ...defaultDraft });
  };

  return (
    <div className="catalog-container panel-section">
      <div className="catalog-toolbar">
        <label>
          <span>搜索</span>
          <input
            className="control-input"
            type="text"
            value={searchTerm}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onSearchChange(e.target.value)}
            placeholder="输入名称"
          />
        </label>

        <label className="control-file-label">
          导入 CSV
          <input
            type="file"
            accept=".csv"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) onCsvUpload(file);
            }}
            style={{ display: "none" }}
          />
        </label>

        <label>
          <span>SIMBAD</span>
          <input
            className="control-input"
            type="text"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="输入源名称"
          />
        </label>
        <button className="control-button" onClick={onQuerySubmit}>从 SIMBAD 搜索</button>
        <button className="control-button" onClick={handleExport}>导出 CSV</button>
        <button
          className="control-button"
          onClick={onDeleteSelected}
          disabled={!highlight}
        >
          删除选中源
        </button>
      </div>

      <div className="catalog-form">
        <input
          className="control-input"
          type="text"
          placeholder="名称"
          value={draft.name}
          onChange={e => handleDraftChange("name")(e.target.value)}
        />
        <input
          className="control-input"
          type="text"
          placeholder="RA (hh:mm:ss 或度)"
          value={draft.raInput}
          onChange={e => handleDraftChange("raInput")(e.target.value)}
        />
        <input
          className="control-input"
          type="text"
          placeholder="DEC (dd:mm:ss 或度)"
          value={draft.decInput}
          onChange={e => handleDraftChange("decInput")(e.target.value)}
        />
        <input
          className="control-input"
          type="text"
          placeholder="类型"
          value={draft.type}
          onChange={e => handleDraftChange("type")(e.target.value)}
        />
        <input
          className="control-input"
          type="number"
          placeholder="Vmag"
          value={Number.isFinite(draft.vmag) ? draft.vmag : ""}
          onChange={e => handleDraftChange("vmag")(e.target.value)}
          style={{ width: 80 }}
        />
        <button className="control-button" onClick={handleAdd}>添加</button>
      </div>

      <div className="data-table-wrapper">
        <DataTable
          columns={columns as any}
          data={filtered}
          highlightOnHover
          pointerOnHover
          onRowClicked={onRowSelect}
          theme={darkMode ? "darkMode" : "default"}
          customStyles={{
            rows: {
              style: {
                fontSize: "15px",
                color: "var(--color-text)",
              },
            },
            headCells: {
              style: {
                fontSize: "16px",
                fontWeight: "bold",
                justifyContent: "center",
                color: "var(--color-text)",
              },
            },
            cells: {
              style: {
                fontSize: "15px",
                justifyContent: "center",
                color: "var(--color-text)",
              },
            },
          }}
          pagination
          paginationPerPage={10}
          paginationRowsPerPageOptions={[5, 10, 20, 50]}
          conditionalRowStyles={[
            {
              when: row => highlight?.name === row.name,
              style: {
                fontWeight: "bold",
              },
            },
          ]}
        />
      </div>
    </div>
  );
};

export default CatalogTable;
