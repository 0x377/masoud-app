// User-Person.js - ALTERNATIVE VERSION (MySQL generates UUIDs)
import db from "../database/database.js";
import bcrypt from "bcryptjs";

export class UserPerson {
  constructor() {}

  // Helper method to format date for MySQL
  formatDate(date) {
    return date.toISOString().slice(0, 19).replace("T", " ");
  }

  async createUserWithPerson(userData, personData = {}) {
    return await db.transaction(async (connection) => {
      try {
        console.log('📝 Creating user with person...');
        
        // 1. Create person record (MySQL will generate UUID via DEFAULT)
        await connection.query(
          `INSERT INTO persons (
            national_id,
            full_name_arabic, 
            full_name_english, 
            gender,
            birth_date,
            birth_place,
            email, 
            phone_number,
            current_address,
            marital_status,
            is_alive,
            created_by,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            personData.national_id || null,
            personData.full_name_arabic || "",
            personData.full_name_english || "",
            personData.gender || 'M',
            personData.birth_date || null,
            personData.birth_place || null,
            userData.email,
            userData.phone_number || null,
            personData.current_address || null,
            personData.marital_status || 'single',
            personData.is_alive !== undefined ? personData.is_alive : true,
            userData.created_by || "system"
          ],
        );

        // 2. Get the generated person ID
        const [personResult] = await connection.query(
          "SELECT id FROM persons WHERE email = ? ORDER BY created_at DESC LIMIT 1",
          [userData.email]
        );

        if (!personResult || personResult.length === 0) {
          throw new Error("Failed to retrieve created person ID");
        }

        const personId = personResult[0].id;
        console.log(`✅ Person created with ID: ${personId}`);

        // 3. Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

        // 4. Create user record (MySQL will generate UUID via DEFAULT)
        await connection.query(
          `INSERT INTO users (
            person_id,
            username,
            email,
            password,
            email_verified_at,
            phone_number,
            phone_verified_at,
            password_changed_at,
            user_type,
            status,
            preferences,
            notification_settings,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [
            personId,
            userData.username,
            userData.email,
            hashedPassword,
            userData.email_verified ? new Date() : null,
            userData.phone_number || null,
            userData.phone_verified ? new Date() : null,
            this.formatDate(new Date()),
            userData.user_type || "FAMILY_MEMBER",
            userData.status || "PENDING_VERIFICATION",
            JSON.stringify(userData.preferences || { theme: "light", language: "ar" }),
            JSON.stringify(userData.notification_settings || { email: true, sms: true, push: true }),
          ],
        );

        // 5. Get the generated user ID
        const [userResult] = await connection.query(
          "SELECT id FROM users WHERE email = ? ORDER BY created_at DESC LIMIT 1",
          [userData.email]
        );

        if (!userResult || userResult.length === 0) {
          throw new Error("Failed to retrieve created user ID");
        }

        const userId = userResult[0].id;
        console.log(`✅ User created with ID: ${userId}`);

        // 6. Fetch created records
        const [personRows] = await connection.query(
          "SELECT * FROM persons WHERE id = ?",
          [personId],
        );

        const [userRows] = await connection.query(
          `SELECT id, username, email, status, user_type, email_verified_at, 
           phone_verified_at, created_at, updated_at FROM users WHERE id = ?`,
          [userId],
        );

        // Remove sensitive data
        const user = userRows[0];
        if (user) {
          delete user.password;
        }

        return {
          success: true,
          user: user,
          person: personRows[0],
          userId,
          personId,
          message: "User and person created successfully",
        };
      } catch (error) {
        console.error("❌ Error in createUserWithPerson transaction:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        
        if (error.code === "ER_BAD_FIELD_ERROR") {
          throw new Error(`Database schema error: ${error.message}`);
        }

        if (error.code === "ER_DUP_ENTRY") {
          if (error.sqlMessage.includes("users.email")) {
            throw new Error("Email already exists");
          } else if (error.sqlMessage.includes("users.username")) {
            throw new Error("Username already exists");
          } else if (error.sqlMessage.includes("persons.email")) {
            throw new Error("Email already exists in persons table");
          } else if (error.sqlMessage.includes("persons.national_id")) {
            throw new Error("National ID already exists");
          } else if (error.sqlMessage.includes("users.phone_number")) {
            throw new Error("Phone number already exists");
          }
        }

        throw error;
      }
    });
  }
}

const userPersonModel = new UserPerson();
export default userPersonModel;




// // User-Person.js - SIMPLIFIED VERSION
// import db from "../database/database.js";
// import bcrypt from "bcryptjs";

// export class UserPerson {
//   constructor() {}

//   // Helper method to format date for MySQL
//   formatDate(date) {
//     return date.toISOString().slice(0, 19).replace("T", " ");
//   }

//   async createUserWithPerson(userData, personData = {}) {
//     return await db.transaction(async (connection) => {
//       try {
//         console.log('📝 Creating user with person...');
        
//         // 1. Create person record
//         const personResult = await connection.query(
//           `INSERT INTO persons (
//             national_id,
//             full_name_arabic, 
//             full_name_english, 
//             gender,
//             birth_date,
//             birth_place,
//             email, 
//             phone_number,
//             current_address,
//             marital_status,
//             is_alive,
//             created_by,
//             created_at,
//             updated_at
//           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
//           [
//             personData.national_id || null,
//             personData.full_name_arabic || "",
//             personData.full_name_english || "",
//             personData.gender || 'M',
//             personData.birth_date || null,
//             personData.birth_place || null,
//             userData.email,
//             userData.phone_number || null,
//             personData.current_address || null,
//             personData.marital_status || 'single',
//             personData.is_alive !== undefined ? personData.is_alive : true,
//             userData.created_by || "system"
//           ],
//         );

//         const personId = personResult.insertId;
//         console.log(`✅ Person created with ID: ${personId}`);

//         // 2. Hash the password
//         const saltRounds = 10;
//         const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

//         // 3. Create user record
//         const userResult = await connection.query(
//           `INSERT INTO users (
//             person_id,
//             username,
//             email,
//             password,
//             email_verified_at,
//             phone_number,
//             phone_verified_at,
//             password_changed_at,
//             user_type,
//             status,
//             preferences,
//             notification_settings,
//             created_at,
//             updated_at
//           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
//           [
//             personId,
//             userData.username,
//             userData.email,
//             hashedPassword,
//             userData.email_verified ? new Date() : null,
//             userData.phone_number || null,
//             userData.phone_verified ? new Date() : null,
//             this.formatDate(new Date()),
//             userData.user_type || "FAMILY_MEMBER",
//             userData.status || "PENDING_VERIFICATION",
//             JSON.stringify(userData.preferences || { theme: "light", language: "ar" }),
//             JSON.stringify(userData.notification_settings || { email: true, sms: true, push: true }),
//           ],
//         );

//         const userId = userResult.insertId;
//         console.log(`✅ User created with ID: ${userId}`);

//         // 4. Fetch created records
//         const [personRows] = await connection.query(
//           "SELECT * FROM persons WHERE id = ?",
//           [personId],
//         );

//         const [userRows] = await connection.query(
//           `SELECT id, username, email, status, user_type, email_verified_at, 
//            phone_verified_at, created_at, updated_at FROM users WHERE id = ?`,
//           [userId],
//         );

//         // Remove sensitive data
//         const user = userRows[0];
//         if (user) {
//           delete user.password;
//         }

//         return {
//           success: true,
//           user: user,
//           person: personRows[0],
//           userId,
//           personId,
//           message: "User and person created successfully",
//         };
//       } catch (error) {
//         console.error("❌ Error in createUserWithPerson transaction:", error);
//         console.error("Error code:", error.code);
//         console.error("Error message:", error.message);
        
//         // Enhanced error handling
//         if (error.code === "ER_BAD_FIELD_ERROR") {
//           throw new Error(`Database schema error: ${error.message}`);
//         }

//         if (error.code === "ER_DUP_ENTRY") {
//           if (error.sqlMessage.includes("users.email")) {
//             throw new Error("Email already exists");
//           } else if (error.sqlMessage.includes("users.username")) {
//             throw new Error("Username already exists");
//           } else if (error.sqlMessage.includes("persons.email")) {
//             throw new Error("Email already exists in persons table");
//           } else if (error.sqlMessage.includes("persons.national_id")) {
//             throw new Error("National ID already exists");
//           } else if (error.sqlMessage.includes("users.phone_number")) {
//             throw new Error("Phone number already exists");
//           }
//         }

//         throw error;
//       }
//     });
//   }
// }

// const userPersonModel = new UserPerson();
// export default userPersonModel;
