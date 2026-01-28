import config from "#config/config.js";
import { ApiError } from "#utils/api-error.js";
import getErrorMessage from "#utils/getErrorMessage.js";

function errorHandler(err, req, res, next) {
  // If headers are already sent, delegate to the default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: err.success,
      message: err.message,
      code: err.code || "INTERNAL_SERVER_ERROR",
      ...(config.NODE_ENV !== "production" && { stack: err.stack }),
      ...(err.errors && err.errors.length > 0 && { errors: err.errors }),
    });
    return;
  }

  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: getErrorMessage(err) || "An error occured. Please view logs for more details.",
    code: "INTERNAL_SERVER_ERROR",
    ...(config.NODE_ENV !== "production" && { stack: err.stack }),
  });
}

export default errorHandler;
