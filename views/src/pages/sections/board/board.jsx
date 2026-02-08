import React from "react";
import "./board.css";

export default function Doard() {
  const data = {
    title: "أعضاء مجلس الإدارة",
    description: "أسماء أعضاء مجلس الإدارة",
    icon: "👥",
    persons: [
      {
        category: "الادارة التنفيذية",
        name: "احمد جمال سيد ابراهيم",
      },
      {
        category: "الادارة التنفيذية",
        name: "احمد جمال سيد ابراهيم",
      },
      {
        category: "الادارة التنفيذية",
        name: "احمد جمال سيد ابراهيم",
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
          {data.persons.map((person) => (
            <div className="section-description" key={person.id}>
              <p className="p-board">
                {person.category}
                <span>{person.name}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
