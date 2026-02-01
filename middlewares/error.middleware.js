import logger from "../config/logger.js";

class ErrorMiddleware {
  // Global error handler
  errorHandler = (err, req, res, next) => {
    logger.error("Unhandled error:", {
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query,
      user: req.user?.id,
    });

    // MySQL errors
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        error: "Duplicate entry",
        code: "DUPLICATE_ENTRY",
        message: err.message,
      });
    }

    if (err.code === "ER_NO_REFERENCED_ROW_2") {
      return res.status(400).json({
        success: false,
        error: "Foreign key constraint failed",
        code: "FOREIGN_KEY_VIOLATION",
      });
    }

    // Redis errors
    if (err.code === "ECONNREFUSED" && err.address === process.env.REDIS_HOST) {
      return res.status(503).json({
        success: false,
        error: "Cache service unavailable",
        code: "CACHE_UNAVAILABLE",
      });
    }

    // Default error response
    const statusCode = err.statusCode || 500;
    const response = {
      success: false,
      error:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message,
      code: err.code || "INTERNAL_ERROR",
    };

    if (process.env.NODE_ENV !== "production") {
      response.stack = err.stack;
    }

    res.status(statusCode).json(response);
  };

  // 404 handler
  notFound = (req, res, next) => {
    res.status(404).json({
      success: false,
      error: `Route ${req.method} ${req.originalUrl} not found`,
      code: "ROUTE_NOT_FOUND",
    });
  };

  // Async error wrapper
  catchAsync = (fn) => {
    return (req, res, next) => {
      fn(req, res, next).catch(next);
    };
  };
}

export default new ErrorMiddleware();
