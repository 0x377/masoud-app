export default function Archive() {
  const data = {
    title: "أرشيف العائلة",
    description: "يشمل شجرة العائلة، أرشيف الاجتماعات، الأرشيف الرياضي",
    icon: "📚",
    content:
      "أرشيف شامل يوثق تاريخ عائلة المسعود يشمل شجرة العائلة، محاضر الاجتماعات، الأنشطة الرياضية، والذكريات العائلية.",
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
          <div className="section-description"></div>
        </div>
      </div>
    </>
  );
}
