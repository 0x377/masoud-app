import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";

import router from "./routes/index.route.js";
import db from "./database/database.js";
import config from "./config/index.js";

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
    origin: config.cors.origin,
    optionsSuccessStatus: 200,
    credentials: config.cors.credentials,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(`/${config.api.prefix}`, router);

if (config.app.env === "production") {
  app.use(express.static(path.join(__dirname, "views", "dist")));
  app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "views", "dist", "index.html"));
  });
}

const PORT = config.app.port;
(async () => {
  try {
    await db.connect();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    await db.close();
    console.error("Server failed to start:", error);
    process.exit(1);
  }
})();
