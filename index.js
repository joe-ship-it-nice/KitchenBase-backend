const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const supabase = require("./supabaseClient");
const express = require("express");
const path = require("path");
const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(3000, () => {
  console.log("App is listening on port 3000");
});

app.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  if (!email.includes("@")) {
    return res.status(400).json({ message: "Please enter a valid email." });
  }
  if (password.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters." });
  }

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required." });
  }
  const passwordHash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from("users")
    .insert({ email, password_hash: passwordHash })
    .select()
    .single();
  if (error) {
    return res.status(400).json({ message: "Email may already exist." });
  }

  res.status(201).json({ message: "User created!", userId: data.id });
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (!user) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );

  res.json({ message: "Logged in!", token });
});

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err)
      return res.status(403).json({ message: "Invalid or expired token." });
    req.user = decoded;
    next();
  });
}
app.get("/profile", verifyToken, (req, res) => {
  res.json({ message: `Welcome, ${req.user.email}!`, userId: req.user.userId });
});
