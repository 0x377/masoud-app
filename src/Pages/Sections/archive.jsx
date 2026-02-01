import { sectionPages as sections } from "../../data/sections";

export default function Archive() {
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

      {/* Additional Info Cards */}
      <div className="cards-grid">
        <div className="info-card">
          <div className="info-card-header">
            <span className="info-icon">📅</span>
            <h4>الفعاليات القادمة</h4>
          </div>
          <div className="info-card-body">
            <p>ورشة عمل حول السلامة الغذائية - 15 ديسمبر 2024</p>
            <p>المؤتمر السنوي للجودة - 20 يناير 2025</p>
          </div>
        </div>
        <div className="info-card">
          <div className="info-card-header">
            <span className="info-icon">📞</span>
            <h4>اتصل بنا</h4>
          </div>
          <div className="info-card-body">
            <p>هاتف: 8001234567</p>
            <p>البريد الإلكتروني: info@masoud.com</p>
          </div>
        </div>
      </div>
    </>
  );
}
