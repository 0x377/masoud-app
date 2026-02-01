export default function Social() {
  return (
    <>
      <div className="content-header">
        <div className="section-title">
          <span className="section-icon">
            {sections[activeSection]?.icon || "💰"}
          </span>
          <div>
            <h2>{sections[activeSection]?.title || "التبرعات"}</h2>
            <p className="section-description">
              {sections[activeSection]?.description ||
                "معلومات شاملة حول السلامة الغذائية والمعايير المطبقة"}
            </p>
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="content-body">
          <p className="section-description">
            <h3>حسابات الاسرة المعتمدة</h3>
            {bankAccounts.map((ba, index) => (
              <p className="p1" key={index}>
                {ba.label}
                <br />
                <span>{ba.value}</span>
              </p>
            ))}
          </p>
        </div>
      </div>
    </>
  );
}
