export default function Financial() {
  const data = {
    title: "المدير المالي",
    description: "المدير المالي والحسابات البنكية",
    icon: "💰",
    content:
      "إدارة الشؤون المالية للعائلة والمتابعة المالية للحسابات البنكية والاستثمارات والمصروفات.",
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
