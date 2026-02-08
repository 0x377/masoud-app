import React, { useState } from "react";
import { useRoot } from "../context/rootContesxt";

const TestRegisterForm = () => {
  const { register, loading, error, clearError } = useRoot();
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
    phone_number: "",
    terms_accepted: false,
  });
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [registrationResult, setRegistrationResult] = useState(null);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));

    // Clear errors when user types
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: "" }));
    }
    if (error) clearError();
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.full_name.trim()) {
      errors.full_name = "الاسم مطلوب";
    }

    if (!formData.email.trim()) {
      errors.email = "البريد الإلكتروني مطلوب";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = "البريد الإلكتروني غير صحيح";
    }

    if (!formData.phone_number.trim()) {
      errors.phone_number = "رقم الهاتف مطلوب";
    } else if (!/^(?:\+966|0)5[0-9]{8}$/.test(formData.phone_number)) {
      errors.phone_number = "رقم الهاتف غير صحيح (يجب أن يبدأ بـ 05 أو +9665)";
    }
    
    if (!formData.password) {
      errors.password = "كلمة المرور مطلوبة";
    } else if (formData.password.length < 8) {
      errors.password = "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(formData.password)) {
      errors.password = "يجب أن تحتوي على حرف كبير، حرف صغير، رقم، ورمز خاص";
    }
    
    if (formData.password !== passwordConfirmation) {
      errors.password_confirmation = "كلمات المرور غير متطابقة";
    }
    
    if (!formData.terms_accepted) {
      errors.terms_accepted = "يجب الموافقة على الشروط";
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    // Prepare data for API
    const userData = {
      full_name: formData.full_name,
      email: formData.email,
      password: formData.password,
      password_confirmation: passwordConfirmation,
      phone_number: formData.phone_number,
      terms_accepted: formData.terms_accepted,
    };
    
    console.log("Submitting registration data:", userData);
    
    const result = await register(userData);
    setRegistrationResult(result);
    
    if (result.success) {
      console.log("Registration successful:", result.data);
    } else {
      console.log("Registration failed:", result);
    }
  };

  return (
    <div style={styles.container}>
      <h2>Test Registration Form</h2>
      
      {error && (
        <div style={styles.errorAlert}>
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {registrationResult && (
        <div style={registrationResult.success ? styles.successAlert : styles.errorAlert}>
          <strong>Result:</strong> {JSON.stringify(registrationResult, null, 2)}
        </div>
      )}
      
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.formGroup}>
          <label>Full Name:</label>
          <input
            type="text"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            placeholder="Enter full name"
            style={validationErrors.full_name ? styles.inputError : styles.input}
          />
          {validationErrors.full_name && (
            <span style={styles.errorText}>{validationErrors.full_name}</span>
          )}
        </div>
        
        <div style={styles.formGroup}>
          <label>Email:</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter email"
            style={validationErrors.email ? styles.inputError : styles.input}
          />
          {validationErrors.email && (
            <span style={styles.errorText}>{validationErrors.email}</span>
          )}
        </div>
        
        <div style={styles.formGroup}>
          <label>Phone Number:</label>
          <input
            type="tel"
            name="phone_number"
            value={formData.phone_number}
            onChange={handleChange}
            placeholder="05XXXXXXXX or +9665XXXXXXXX"
            style={validationErrors.phone_number ? styles.inputError : styles.input}
          />
          {validationErrors.phone_number && (
            <span style={styles.errorText}>{validationErrors.phone_number}</span>
          )}
        </div>
        
        <div style={styles.formGroup}>
          <label>Password:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="Enter password"
            style={validationErrors.password ? styles.inputError : styles.input}
          />
          {validationErrors.password && (
            <span style={styles.errorText}>{validationErrors.password}</span>
          )}
        </div>
        
        <div style={styles.formGroup}>
          <label>Confirm Password:</label>
          <input
            type="password"
            name="password_confirmation"
            value={passwordConfirmation}
            onChange={(e) => setPasswordConfirmation(e.target.value)}
            placeholder="Confirm password"
            style={validationErrors.password_confirmation ? styles.inputError : styles.input}
          />
          {validationErrors.password_confirmation && (
            <span style={styles.errorText}>{validationErrors.password_confirmation}</span>
          )}
        </div>
        
        <div style={styles.formGroup}>
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="terms_accepted"
              checked={formData.terms_accepted}
              onChange={handleChange}
              style={styles.checkbox}
            />
            I agree to the terms and conditions
          </label>
          {validationErrors.terms_accepted && (
            <span style={styles.errorText}>{validationErrors.terms_accepted}</span>
          )}
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          style={styles.submitButton}
        >
          {loading ? "Registering..." : "Register"}
        </button>
      </form>
      
      <div style={styles.testData}>
        <h3>Test Data:</h3>
        <pre>{JSON.stringify(formData, null, 2)}</pre>
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    padding: "20px",
    fontFamily: "Arial, sans-serif",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  input: {
    padding: "10px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "16px",
  },
  inputError: {
    padding: "10px",
    border: "1px solid #dc2626",
    borderRadius: "4px",
    fontSize: "16px",
    backgroundColor: "#fef2f2",
  },
  errorText: {
    color: "#dc2626",
    fontSize: "14px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },
  checkbox: {
    width: "18px",
    height: "18px",
  },
  submitButton: {
    padding: "12px",
    backgroundColor: "#3b82f6",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "16px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  submitButtonDisabled: {
    backgroundColor: "#93c5fd",
    cursor: "not-allowed",
  },
  errorAlert: {
    backgroundColor: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    padding: "12px",
    borderRadius: "4px",
    marginBottom: "20px",
  },
  successAlert: {
    backgroundColor: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#166534",
    padding: "12px",
    borderRadius: "4px",
    marginBottom: "20px",
  },
  testData: {
    marginTop: "30px",
    padding: "15px",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "4px",
  },
};

export default TestRegisterForm;
