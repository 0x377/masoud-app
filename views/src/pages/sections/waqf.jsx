export default function Waqf() {
  const data = {
    title: "وقف العائلة",
    description: "معلومات عن وقف العائلة",
    icon: "🕌",
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
          <div className="section-description">{/* content page */}</div>
        </div>
      </div>
    </>
  );
}
