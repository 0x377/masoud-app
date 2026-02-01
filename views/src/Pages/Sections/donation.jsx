export default function Donation() {
  const data = {
    title: "منصة التبرعات",
    description: "منصة تبرعات مفتوحة للجميع",
    icon: "💳",
  };

  const bankAccounts = [
    { label: "الحساب العام", value: "SA3180000252608013271122" },
    { label: "حساب الزكاة", value: "SA1380000252608018635255" },
    { label: "حساب الوقف", value: "SA2080000121608017406772" },
  ];

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
          <div className="section-description">
            <h3>حسابات الاسرة المعتمدة</h3>
            {bankAccounts.map((ba, index) => (
              <p className="p1" key={index}>
                {ba.label}
                <br />
                <span>{ba.value}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
