import express from "express";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";

import router from "./routes/index.route.js";
import db from "./config/database.js";
// import BaseModel from "./models/core/BaseModel.js";

dotenv.config();

const app = express();
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "script-src": ["'self'", "example.com"],
        "style-src": null,
      },
    },
    referrerPolicy: {
      policy: "no-referrer",
    },
    xFrameOptions: { action: "sameorigin" },
    xPoweredBy: false,
    xXssProtection: false,
  }),
);
app.use(
  cors({
    origin: "http://127.0.0.1:3000",
    optionsSuccessStatus: 200,
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/api", router);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "views", "dist")));
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "dist", "index.html"));
  });
}

const PORT = process.env.PORT || 4000;
(async () => {
  try {
    await db.connect();
    // BaseModel().dbConnect(db);
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    await db.close();
    console.error("Server failed to start:", error);
    process.exit(1);
  }
})();
