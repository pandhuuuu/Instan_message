const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  registerUser,
  authUser,
  allUsers,
  quickConnectUser,
} = require("../controllers/userControllers");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { message: "Too many authentication requests from this IP, please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
});

router.route("/").get(protect, allUsers);
router.route("/").post(registerUser);
router.post("/login", authLimiter, authUser);
router.post("/quick-connect", authLimiter, quickConnectUser);

module.exports = router;
