export default function Doard() {
  const data = {
    title: "أعضاء مجلس الإدارة",
    description: "أسماء أعضاء مجلس الإدارة",
    icon: "👥",
  };

  return (
    <>
      <div className="content-header">
        <div className="section-title">
          <span className="section-icon">{data.icon}</span>
          <div>
            <h2>{data.title}</h2>
            <p className="section-description">{data.description}</p>
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="content-body">
          <div className="section-description">{/* names */}</div>
        </div>
      </div>
    </>
  );
}
