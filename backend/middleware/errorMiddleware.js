const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  const isProd = process.env.NODE_ENV === "production";
  res.json({
    message: statusCode === 500 && isProd ? "Internal Server Error" : err.message,
    stack: isProd ? null : err.stack,
  });
};

module.exports = { notFound, errorHandler };
