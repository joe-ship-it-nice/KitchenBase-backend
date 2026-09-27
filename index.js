const express = require("express");
const cors = require("cors");
const path = require("path");
const supabase = require("./supabaseClient");

const app = express();
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`App is listening on port ${PORT}`);
});

app.use(cors());
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

// Check that a value is a non-empty string.
function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

// Our database IDs are positive PostgreSQL integers.
function isValidId(value) {
  return (
    Number.isInteger(value) &&
    value > 0 &&
    value <= 2147483647
  );
}

// Homepage: API documentation
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// GET all recipes
app.get("/recipes", async (req, res) => {
  const { data, error } = await supabase
    .from("recipe")
    .select("*")
    .order("id");

  if (error) throw error;

  res.json(data);
});

// GET one recipe by ID
app.get("/recipes/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!/^\d+$/.test(req.params.id) || !isValidId(id)) {
    return res.status(400).json({
      message: "Recipe ID must be a positive integer.",
    });
  }

  const { data, error } = await supabase
    .from("recipe")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return res.status(404).json({
      message: "Recipe not found.",
    });
  }

  res.json(data);
});

// POST a new recipe
app.post("/recipes", async (req, res) => {
  const {
    name,
    ingredients,
    author,
    category,
    instructions,
  } = req.body || {};

  if (
    !isText(name) ||
    !isText(ingredients) ||
    !isText(instructions)
  ) {
    return res.status(400).json({
      message: "Name, ingredients and instructions are required text fields.",
    });
  }

  if (!isValidId(author) || !isValidId(category)) {
    return res.status(400).json({
      message: "Author and category must be positive integer IDs.",
    });
  }

  const { data, error } = await supabase
    .from("recipe")
    .insert({
      name: name.trim(),
      ingredients: ingredients.trim(),
      author,
      category,
      instructions: instructions.trim(),
    })
    .select("*")
    .single();

  if (error) throw error;

  res.status(201).json(data);
});

// GET all users
app.get("/users", async (req, res) => {
  const { data, error } = await supabase
    .from("users")
    .select("id, username, email")
    .order("id");

  if (error) throw error;

  res.json(data);
});

// POST a new user
app.post("/users", async (req, res) => {
  const { username, email } = req.body || {};

  if (!isText(username) || !isText(email)) {
    return res.status(400).json({
      message: "Username and email are required.",
    });
  }

  const cleanEmail = email.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({
      message: "Please enter a valid email.",
    });
  }

  const { data, error } = await supabase
    .from("users")
    .insert({
      username: username.trim(),
      email: cleanEmail,
    })
    .select("id, username, email")
    .single();

  if (error) throw error;

  res.status(201).json(data);
});

// GET all categories
app.get("/categories", async (req, res) => {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("id");

  if (error) throw error;

  res.json(data);
});

// Handle unknown endpoints.
app.use((req, res) => {
  res.status(404).json({
    message: "Endpoint not found.",
  });
});

// Handle request and database errors.
// Keep this AFTER all routes.
app.use((error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "Request body must contain valid JSON.",
    });
  }

  if (error.type === "entity.too.large") {
    return res.status(413).json({
      message: "Request body is too large.",
    });
  }

  // PostgreSQL unique constraint violation.
  if (error.code === "23505") {
    return res.status(409).json({
      message: "That username or email already exists.",
    });
  }

  // PostgreSQL foreign key violation.
  if (error.code === "23503") {
    return res.status(400).json({
      message: "The author or category does not exist.",
    });
  }

  console.error("Request failed:", error.message);

  res.status(500).json({
    message: "Something went wrong on the server.",
  });
});

app.listen(PORT, () => {
  console.log(`App is listening on port ${PORT}`);
});