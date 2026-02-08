export default function Social() {
  const data = {
    title: "اللجنة الاجتماعية",
    description: "إعانة الزواج وإعانة الأسرة",
    icon: "🤝",
    content:
      "لجنة مسؤولة عن النشاطات الاجتماعية ودعم المناسبات العائلية وإعانات الزواج والأسرة.",
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
