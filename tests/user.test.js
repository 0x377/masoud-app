// user.test.js - CORRECTED TEST FILE
import userPersonModel from "../models/User-Person.js";

async function registerUser() {
  try {
    const userData = {
      username: "john_doe",
      email: "john@example.com",
      password: "SecurePassword123",
      phone_number: "+966500000000",
      user_type: "FAMILY_MEMBER",
      status: "PENDING_VERIFICATION",
      email_verified: false,
      phone_verified: false,
      created_by: "registration_system",
    };

    const personData = {
      full_name_arabic: "جون دو",
      full_name_english: "John Doe",
      national_id: "12345678901234",
      gender: "M",
      birth_date: "1990-05-15",
      birth_place: "Riyadh",
      marital_status: "single",
      is_alive: true,
      current_address: "123 Main Street, Riyadh, Saudi Arabia",
    };

    const result = await userPersonModel.createUserWithPerson(
      userData,
      personData,
    );

    console.log("✅ Registration successful!");
    console.log("User ID:", result.userId);
    console.log("Person ID:", result.personId);
    console.log("Username:", result.user.username);

    return result;
  } catch (error) {
    console.error("❌ Registration failed:", error.message);
    throw error;
  }
}

// Test the function
registerUser().catch(console.error);
