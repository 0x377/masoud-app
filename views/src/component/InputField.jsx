import React from "react";

const InputField = ({
  label,
  icon: Icon,
  error,
  type = "text",
  name,
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  dir = "ltr",
}) => {
  return (
    <>
      <style>{`
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-group label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          color: var(--gray-800);
          font-size: 14px;
        }

        .form-group label svg {
          color: var(--primary-color);
        }

        .form-group input {
          padding: 14px 16px;
          border: 2px solid var(--gray-300);
          border-radius: var(--radius-lg);
          font-size: 15px;
          font-family: "Cairo", sans-serif;
          transition: all var(--transition-normal);
          background: var(--white);
          color: var(--gray-900);
          width: 100%;
        }

        .form-group input:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 4px rgba(42, 110, 63, 0.1);
        }

        .form-group input.error {
          border-color: var(--error-color);
          background: #fff5f5;
        }

        .form-group input::placeholder {
          color: var(--gray-400);
          font-size: 14px;
        }

        .error-message {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--error-color);
          font-size: 13px;
          font-weight: 500;
        }

        .error-icon {
          font-weight: bold;
        }
      `}</style>

      <div className="form-group">
        <label htmlFor={id}>
          {Icon && <Icon size={18} />}
          <span>{label}</span>
        </label>

        <input
          type={type}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={error ? "error" : ""}
          dir={dir}
          autoComplete={autoComplete}
        />

        {error && (
          <span className="error-message">
            <span className="error-icon">!</span>
            {error}
          </span>
        )}
      </div>
    </>
  );
};

export default InputField;
