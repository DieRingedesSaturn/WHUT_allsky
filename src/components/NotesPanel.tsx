interface NotesPanelProps {
  title?: string;
  children?: React.ReactNode;
}

const NotesPanel = ({ title = "注释", children }: NotesPanelProps) => {
  return (
    <section className="panel-section notes-panel">
      <header style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
      </header>
      <div className="notes-content">{children}</div>
    </section>
  );
};

export default NotesPanel;
