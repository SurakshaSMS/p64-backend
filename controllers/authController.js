const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserModel = require("../models/userModel");

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN,
    },
  );
};

const sanitizeUser = (user) => {
  const { password, ...safeUser } = user;
  return safeUser;
};

const AuthController = {
  async register(req, res) {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "Name, email, and password are required",
        });
      }

      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, and one number",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await UserModel.findUserByEmail(normalizedEmail);

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Email is already registered",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await UserModel.createUser({
        name,
        email,
        password: hashedPassword,
      });

      const accessToken = generateAccessToken(user);

      return res.status(201).json({
        success: true,
        message: "Register successful",
        data: {
          user: sanitizeUser(user),
          accessToken,
        },
      });
    } catch (error) {
      if (error.code === 6 || error.code === "already-exists") {
        return res.status(409).json({
          success: false,
          message: "Email is already registered",
        });
      }

      console.error("Register error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to register user",
      });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Email and password are required",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const user = await UserModel.findUserByEmail(normalizedEmail);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid email or password",
        });
      }

      const accessToken = generateAccessToken(user);

      return res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: sanitizeUser(user),
          accessToken,
        },
      });
    } catch (error) {
      console.error("Login error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to login",
      });
    }
  },
};

module.exports = AuthController;
