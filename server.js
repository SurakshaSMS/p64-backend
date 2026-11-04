require("dotenv").config();

const express = require("express");
const cors = require("cors");

const requiredEnv = ["JWT_SECRET", "JWT_EXPIRES_IN", "PORT"];

const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`Missing environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const authRoutes = require("./routes/authRoutes");

const app = express();

const PORT = process.env.PORT;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Express MVC + Firestore + JWT backend is running");
});

app.use("/api/auth", authRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});