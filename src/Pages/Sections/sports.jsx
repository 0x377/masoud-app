export default function Sports() {
  const data = {
    title: "اللجنة الرياضية",
    description: "النشاطات الرياضية للعائلة",
    icon: "⚽",
    content:
      "لجنة تنظيم الأنشطة الرياضية والبطولات الداخلية للعائلة وتشجيع المواهب الرياضية.",
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
