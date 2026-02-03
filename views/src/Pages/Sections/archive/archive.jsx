import React from "react";
import './archive.css';

export default function Archive() {
  const data = {
    title: "أرشيف العائلة",
    description: "يشمل شجرة العائلة، أرشيف الاجتماعات، الأرشيف الرياضي",
    icon: "📚",
    content:
      "أرشيف شامل يوثق تاريخ عائلة المسعود يشمل شجرة العائلة، محاضر الاجتماعات، الأنشطة الرياضية، والذكريات العائلية.",
    sections: [
      {
        id: 1,
        title: "شجرة العائلة",
        description: "التكوين الكامل لشجرة العائلة مع تفاصيل الأفراد",
        icon: "🌳",
      },
      {
        id: 2,
        title: "محاضر الاجتماعات",
        description: "توثيق كامل لجميع اجتماعات العائلة",
        icon: "📋",
      },
      {
        id: 3,
        title: "الأرشيف الرياضي",
        description: "البطولات والأنشطة الرياضية للعائلة",
        icon: "⚽",
      },
      {
        id: 4,
        title: "الذكريات العائلية",
        description: "صور وفيديوهات ومناسبات العائلة",
        icon: "📸",
      },
    ],
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
          <p className="archive-intro">{data.content}</p>

          <div className="archive-sections">
            {data.sections.map((section) => (
              <div key={section.id} className="archive-section-card">
                <div className="section-card-header">
                  <span className="section-card-icon">{section.icon}</span>
                  <h3>{section.title}</h3>
                </div>
                <p className="section-card-description">
                  {section.description}
                </p>
                <button className="section-card-button">
                  عرض الأرشيف
                  <span className="arrow">→</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
