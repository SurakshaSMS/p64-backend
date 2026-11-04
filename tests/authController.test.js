
jest.mock("../models/userModel", () => ({
  createUser: jest.fn(),
  findUserByEmail: jest.fn(),
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(),
}));

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserModel = require("../models/userModel");
const AuthController = require("../controllers/authController");

const mockRequest = (body = {}) => ({
  body,
});

const mockResponse = () => {
  const res = {};

  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);

  return res;
};

describe("AuthController", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    process.env.JWT_SECRET = "test-secret";
    process.env.JWT_EXPIRES_IN = "1h";

    bcrypt.hash.mockResolvedValue("hashed-password");
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("mock-access-token");
  });

  describe("Register", () => {
    const validUser = {
      name: "John",
      email: "john@gmail.com",
      password: "Password123",
    };

    test("should register a user successfully", async () => {
      const req = mockRequest(validUser);
      const res = mockResponse();

      UserModel.findUserByEmail.mockResolvedValue(null);

      UserModel.createUser.mockResolvedValue({
        id: "user123",
        name: "John",
        email: "john@gmail.com",
        password: "hashed-password",
      });

      await AuthController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(201);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Register successful",
        data: {
          user: {
            id: "user123",
            name: "John",
            email: "john@gmail.com",
          },
          accessToken: "mock-access-token",
        },
      });

      expect(bcrypt.hash).toHaveBeenCalledWith(
        "Password123",
        10,
      );

      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: "user123",
          email: "john@gmail.com",
        },
        "test-secret",
        {
          expiresIn: "1h",
        },
      );
    });

    test("should reject missing required fields", async () => {
      const req = mockRequest({
        email: "john@gmail.com",
        password: "Password123",
      });

      const res = mockResponse();

      await AuthController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Name, email, and password are required",
      });

      expect(UserModel.createUser).not.toHaveBeenCalled();
    });

    test.each([
      ["short password", "Pass1"],
      ["missing uppercase", "password123"],
      ["missing lowercase", "PASSWORD123"],
      ["missing number", "PasswordABC"],
    ])("should reject %s", async (_, password) => {
      const req = mockRequest({
        ...validUser,
        password,
      });

      const res = mockResponse();

      await AuthController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message:
          "Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, and one number",
      });

      expect(UserModel.createUser).not.toHaveBeenCalled();
    });

    test("should normalize email before checking duplicates", async () => {
      const req = mockRequest({
        ...validUser,
        email: "  JOHN@GMAIL.COM  ",
      });

      const res = mockResponse();

      UserModel.findUserByEmail.mockResolvedValue({
        id: "user123",
        email: "john@gmail.com",
      });

      await AuthController.register(req, res);

      expect(UserModel.findUserByEmail).toHaveBeenCalledWith(
        "john@gmail.com",
      );

      expect(res.status).toHaveBeenCalledWith(409);

      expect(UserModel.createUser).not.toHaveBeenCalled();
    });

    test("should reject an already registered email", async () => {
      const req = mockRequest(validUser);
      const res = mockResponse();

      UserModel.findUserByEmail.mockResolvedValue({
        id: "existing-user",
        email: "john@gmail.com",
      });

      await AuthController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Email is already registered",
      });
    });

    test("should handle Firestore duplicate creation errors", async () => {
      const req = mockRequest(validUser);
      const res = mockResponse();

      UserModel.findUserByEmail.mockResolvedValue(null);

      UserModel.createUser.mockRejectedValue({
        code: 6,
        message: "Document already exists",
      });

      await AuthController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Email is already registered",
      });
    });

    test("should return 500 when registration fails", async () => {
      const req = mockRequest(validUser);
      const res = mockResponse();

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      UserModel.findUserByEmail.mockRejectedValue(
        new Error("Database unavailable"),
      );

      await AuthController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to register user",
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Login", () => {
    const validLogin = {
      email: "john@gmail.com",
      password: "Password123",
    };

    const existingUser = {
      id: "user123",
      name: "John",
      email: "john@gmail.com",
      password: "hashed-password",
    };

    test("should login successfully", async () => {
      const req = mockRequest(validLogin);
      const res = mockResponse();

      UserModel.findUserByEmail.mockResolvedValue(existingUser);

      await AuthController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      expect(bcrypt.compare).toHaveBeenCalledWith(
        "Password123",
        "hashed-password",
      );

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: "user123",
            name: "John",
            email: "john@gmail.com",
          },
          accessToken: "mock-access-token",
        },
      });
    });

    test("should normalize email before login", async () => {
      const req = mockRequest({
        email: "  JOHN@GMAIL.COM  ",
        password: "Password123",
      });

      const res = mockResponse();

      UserModel.findUserByEmail.mockResolvedValue(existingUser);

      await AuthController.login(req, res);

      expect(UserModel.findUserByEmail).toHaveBeenCalledWith(
        "john@gmail.com",
      );

      expect(res.status).toHaveBeenCalledWith(200);
    });

    test("should reject missing credentials", async () => {
      const req = mockRequest({
        email: "john@gmail.com",
      });

      const res = mockResponse();

      await AuthController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(UserModel.findUserByEmail).not.toHaveBeenCalled();
    });

    test("should reject an unregistered email", async () => {
      const req = mockRequest(validLogin);
      const res = mockResponse();

      UserModel.findUserByEmail.mockResolvedValue(null);

      await AuthController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid email or password",
      });

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    test("should reject an incorrect password", async () => {
      const req = mockRequest({
        ...validLogin,
        password: "WrongPassword123",
      });

      const res = mockResponse();

      UserModel.findUserByEmail.mockResolvedValue(existingUser);
      bcrypt.compare.mockResolvedValue(false);

      await AuthController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid email or password",
      });

      expect(jwt.sign).not.toHaveBeenCalled();
    });

    test("should not expose hashed password in response", async () => {
      const req = mockRequest(validLogin);
      const res = mockResponse();

      UserModel.findUserByEmail.mockResolvedValue(existingUser);

      await AuthController.login(req, res);

      const response = res.json.mock.calls[0][0];

      expect(response.data.user.password).toBeUndefined();
    });

    test("should return 500 when login fails", async () => {
      const req = mockRequest(validLogin);
      const res = mockResponse();

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      UserModel.findUserByEmail.mockRejectedValue(
        new Error("Database unavailable"),
      );

      await AuthController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(500);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to login",
      });

      consoleSpy.mockRestore();
    });
  });
});
