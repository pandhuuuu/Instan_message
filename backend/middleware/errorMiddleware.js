const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  const isDev = process.env.NODE_ENV === "development";
  res.json({
    message: !isDev && statusCode === 500 ? "Internal Server Error" : err.message,
    stack: isDev ? err.stack : null,
  });
};

module.exports = { notFound, errorHandler };
