export default function Executive() {
  const data = {
    title: "الإدارة التنفيذية",
    description: "المدير التنفيذي والسكرتير",
    icon: "💼",
    content:
      "الفريق التنفيذي المسؤول عن تنفيذ قرارات مجلس الإدارة وإدارة شؤون العائلة اليومية.",
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
