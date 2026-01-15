const getErrorMessage = (err) => {
  if (!err) return "Unknown error occurred";

  if (typeof err === "string") return err;

  if (err instanceof Error && err.message) return err.message;

  if (typeof err === "object" && err.message) return err.message;

  try {
    return JSON.stringify(err);
  } catch {
    return "Unhandled error type";
  }
};

export default getErrorMessage;
