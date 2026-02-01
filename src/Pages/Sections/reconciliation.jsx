export default function Reconciliation() {
  const data = {
    title: "لجنة إصلاح ذات البين",
    description: "لجنة حل النزاعات داخل العائلة",
    icon: "⚖️",
    content:
      "لجنة متخصصة في حل النزاعات العائلية وإصلاح ذات البين وفق مبادئ الشريعة والتقاليد العائلية.",
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
