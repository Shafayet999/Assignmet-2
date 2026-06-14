// src/app.ts
import express from "express";
import CookieParser from "cookie-parser";
import cors from "cors";

// src/modules/auth/auth.route.ts
import { Router } from "express";

// src/config/index.ts
import dotenv from "dotenv";
import path from "path";
dotenv.config({
  path: path.join(process.cwd(), ".env")
});
var config = {
  connection_string: process.env.CONNECTIONSTRING,
  port: process.env.PORT,
  secret: process.env.JWT_SECRET,
  refresh_secret: process.env.JWT_REFRESH_SECRET
};
var config_default = config;

// src/db/index.ts
import { Pool } from "pg";
var pool = new Pool({
  connectionString: config_default.connection_string
});
var initDB = async () => {
  try {
    await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(150) UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role VARCHAR(20) DEFAULT 'contributor' CHECK (role IN ('contributor', 'maintainer')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    await pool.query(`
            CREATE TABLE IF NOT EXISTS issues (
                id SERIAL PRIMARY KEY,
                title VARCHAR(150) NOT NULL,
                description TEXT NOT NULL,
                type VARCHAR(20) NOT NULL CHECK (type IN ('bug', 'feature_request')),
                status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
                reporter_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    console.log("Database connected & tables initialized successfully! \u{1F680}");
  } catch (error) {
    console.error("Database initialization failed:", error);
    process.exit(1);
  }
};

// src/modules/auth/auth.service.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
var signUpUserIntoDB = async (payload) => {
  const { name, email, password, role } = payload;
  const hashPassword = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `
        INSERT INTO users (name, email, password, role) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, name, email, role, created_at, updated_at
        `,
    [name, email, hashPassword, role]
  );
  return result.rows[0];
};
var logInUserIntoDB = async (payload) => {
  const { email, password } = payload;
  const userData = await pool.query(`SELECT * FROM users WHERE email=$1`, [
    email
  ]);
  if (userData.rows.length === 0) {
    throw new Error("invalid credentials");
  }
  const user = userData.rows[0];
  const matchPassword = await bcrypt.compare(password, user.password);
  if (!matchPassword) {
    throw new Error("invalid credentials");
  }
  const jwtpayload = {
    id: user.id,
    name: user.name,
    role: user.role
    // is_active: user.is_active,
    // email: user.email,
  };
  const accessToken = jwt.sign(jwtpayload, config_default.secret, {
    expiresIn: "1d"
  });
  const refreshToken = jwt.sign(jwtpayload, config_default.refresh_secret, {
    expiresIn: "90d"
  });
  const { password: userPassword, ...userWithoutPassword } = user;
  return { token: accessToken, user: userWithoutPassword, refreshToken };
};
var generateNewAccessToken = async (token) => {
  if (!token) {
    throw new Error("unauthorized");
  }
  const decoded = jwt.verify(
    token,
    config_default.refresh_secret
  );
  const userData = await pool.query(
    `
            SELECT * FROM users WHERE email=$1
        `,
    [decoded.email]
  );
  const user = userData.rows[0];
  if (userData.rows.length === 0) {
    throw new Error("user not found");
  }
  const jwtpayload = {
    id: user.id,
    name: user.name,
    role: user.role,
    is_active: user.is_active,
    email: user.email
  };
  const accessToken = jwt.sign(jwtpayload, config_default.secret, {
    expiresIn: "1d"
  });
  return { accessToken };
};
var authService = {
  signUpUserIntoDB,
  logInUserIntoDB,
  generateNewAccessToken
};

// src/modules/auth/auth.controller.ts
var signUpUser = async (req, res) => {
  try {
    const result = await authService.signUpUserIntoDB(req.body);
    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to create user",
      error: error.message
    });
  }
};
var logInUser = async (req, res) => {
  try {
    const result = await authService.logInUserIntoDB(req.body);
    const { refreshToken } = result;
    res.cookie("refreshToken", refreshToken, {
      secure: false,
      //in production => true
      httpOnly: true,
      sameSite: "lax"
    });
    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token: result.token,
        user: result.user
      }
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to login user",
      error: error.message
    });
  }
};
var getNewAccessToken = async (req, res) => {
  try {
    const oldRefreshToken = req.cookies.refreshToken;
    const newAccessToken = await authService.generateNewAccessToken(oldRefreshToken);
    return res.status(200).json({
      success: true,
      message: "Access Token generated successfully",
      data: {
        accessToken: newAccessToken
        // নামগুলো এখন একদম ক্লিয়ার!
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
      error
    });
  }
};
var authController = {
  signUpUser,
  logInUser,
  getNewAccessToken
};

// src/modules/auth/auth.route.ts
var router = Router();
router.post("/signup", authController.signUpUser);
router.post("/login", authController.logInUser);
var authRoute = router;

// src/modules/issue/issue.route.ts
import { Router as Router2 } from "express";

// src/middleware/auth.ts
import jwt2 from "jsonwebtoken";
var auth = (...roles) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
      if (!token) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized access"
        });
      }
      const decoded = jwt2.verify(
        token,
        config_default.secret
      );
      const userData = await pool.query(
        `SELECT * FROM users WHERE id=$1`,
        [decoded.id]
      );
      if (userData.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: "User not found or token invalid"
        });
      }
      const user = userData.rows[0];
      if (roles.length && !roles.includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You do not have the required permissions"
        });
      }
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid or expired token"
      });
    }
  };
};
var auth_default = auth;

// src/modules/issue/issue.service.ts
var createIssueIntoDB = async (payload, reporter_id) => {
  const { title, description, type } = payload;
  const result = await pool.query(
    `
        INSERT INTO issues (title, description, type, reporter_id) 
        VALUES ($1, $2, $3, $4) 
        RETURNING id, title, description, type, status, reporter_id, created_at, updated_at
        `,
    [title, description, type, reporter_id]
  );
  return result.rows[0];
};
var getAllIssuesFromDB = async (sort, type, status) => {
  let queryStr = `SELECT * FROM issues`;
  const queryValues = [];
  const whereConditions = [];
  if (type) {
    queryValues.push(type);
    whereConditions.push(`type = $${queryValues.length}`);
  }
  if (status) {
    queryValues.push(status);
    whereConditions.push(`status = $${queryValues.length}`);
  }
  if (whereConditions.length > 0) {
    queryStr += ` WHERE ` + whereConditions.join(" AND ");
  }
  if (sort === "oldest") {
    queryStr += ` ORDER BY created_at ASC`;
  } else {
    queryStr += ` ORDER BY created_at DESC`;
  }
  const issuesResult = await pool.query(queryStr, queryValues);
  const issues = issuesResult.rows;
  if (issues.length === 0) {
    return [];
  }
  const reporterIds = issues.map((issue) => issue.reporter_id);
  const usersResult = await pool.query(
    `SELECT id, name, role FROM users WHERE id = ANY($1::int[])`,
    [reporterIds]
  );
  const users = usersResult.rows;
  const finalResult = issues.map((issue) => {
    const reporterInfo = users.find((user) => user.id === issue.reporter_id);
    return {
      id: issue.id,
      title: issue.title,
      description: issue.description,
      type: issue.type,
      status: issue.status,
      reporter: {
        id: reporterInfo?.id,
        name: reporterInfo?.name,
        role: reporterInfo?.role
      },
      created_at: issue.created_at,
      updated_at: issue.updated_at
    };
  });
  return finalResult;
};
var getSingleIssueFromDB = async (id) => {
  const issueResult = await pool.query(`SELECT * FROM issues WHERE id = $1`, [id]);
  if (issueResult.rows.length === 0) {
    throw new Error("Issue not found");
  }
  const issue = issueResult.rows[0];
  const userResult = await pool.query(
    `SELECT id, name, role FROM users WHERE id = $1`,
    [issue.reporter_id]
  );
  const reporterInfo = userResult.rows[0];
  return {
    id: issue.id,
    title: issue.title,
    description: issue.description,
    type: issue.type,
    status: issue.status,
    reporter: {
      id: reporterInfo?.id,
      name: reporterInfo?.name,
      role: reporterInfo?.role
    },
    created_at: issue.created_at,
    updated_at: issue.updated_at
  };
};
var deleteIssueFromDB = async (id) => {
  const result = await pool.query(
    `DELETE FROM issues WHERE id = $1 RETURNING id`,
    [id]
  );
  if (result.rowCount === 0) {
    throw new Error("Issue not found");
  }
  return true;
};
var updateIssueInDB = async (id, payload, user) => {
  const issueResult = await pool.query(`SELECT * FROM issues WHERE id = $1`, [id]);
  if (issueResult.rows.length === 0) {
    throw new Error("Issue not found");
  }
  const issue = issueResult.rows[0];
  if (user.role === "contributor") {
    if (issue.reporter_id !== user.id) {
      throw new Error("Forbidden: You can only update your own issues");
    }
    if (issue.status !== "open") {
      throw new Error("Forbidden: You can only update issues that are currently open");
    }
  }
  const fields = [];
  const values = [];
  let index = 1;
  if (payload.title) {
    fields.push(`title = $${index++}`);
    values.push(payload.title);
  }
  if (payload.description) {
    fields.push(`description = $${index++}`);
    values.push(payload.description);
  }
  if (payload.type) {
    fields.push(`type = $${index++}`);
    values.push(payload.type);
  }
  if (payload.status) {
    if (user.role === "contributor") {
      throw new Error("Forbidden: Contributors cannot change issue status");
    }
    fields.push(`status = $${index++}`);
    values.push(payload.status);
  }
  if (fields.length === 0) {
    throw new Error("No fields provided for update");
  }
  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);
  const queryStr = `UPDATE issues SET ${fields.join(", ")} WHERE id = $${index} RETURNING *`;
  const updatedResult = await pool.query(queryStr, values);
  return updatedResult.rows[0];
};
var issueService = {
  createIssueIntoDB,
  getAllIssuesFromDB,
  getSingleIssueFromDB,
  deleteIssueFromDB,
  updateIssueInDB
};

// src/modules/issue/issue.controller.ts
var createIssue = async (req, res) => {
  try {
    const reporter_id = req.user.id;
    const result = await issueService.createIssueIntoDB(req.body, reporter_id);
    res.status(201).json({
      success: true,
      message: "Issue created successfully",
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to create issue",
      error: error.message
    });
  }
};
var getAllIssues = async (req, res) => {
  try {
    const { sort, type, status } = req.query;
    const result = await issueService.getAllIssuesFromDB(
      sort,
      type,
      status
    );
    res.status(200).json({
      success: true,
      message: "Issues retrieved successfully",
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to retrieve issues",
      error: error.message
    });
  }
};
var getSingleIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await issueService.getSingleIssueFromDB(Number(id));
    return res.status(200).json({
      success: true,
      message: "Issue retrieved successfully",
      data: result
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: "Failed to retrieve issue",
      error: error.message
    });
  }
};
var deleteIssue = async (req, res) => {
  try {
    const { id } = req.params;
    await issueService.deleteIssueFromDB(Number(id));
    return res.status(200).json({
      success: true,
      message: "Issue deleted successfully"
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: "Failed to delete issue",
      error: error.message
    });
  }
};
var updateIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const issueData = req.body;
    const user = req.user;
    const result = await issueService.updateIssueInDB(Number(id), issueData, user);
    return res.status(200).json({
      success: true,
      message: "Issue updated successfully",
      data: result
    });
  } catch (error) {
    const statusCode = error.message.includes("Forbidden") ? 403 : 400;
    return res.status(statusCode).json({
      success: false,
      message: "Failed to update issue",
      error: error.message
    });
  }
};
var issueController = {
  createIssue,
  getAllIssues,
  getSingleIssue,
  deleteIssue,
  updateIssue
};

// src/modules/issue/issue.route.ts
var router2 = Router2();
router2.post("/", auth_default("contributor", "maintainer"), issueController.createIssue);
router2.get("/", issueController.getAllIssues);
router2.get("/:id", issueController.getSingleIssue);
router2.delete("/:id", auth_default("maintainer"), issueController.deleteIssue);
router2.patch("/:id", auth_default("contributor", "maintainer"), issueController.updateIssue);
var issueRoutes = router2;

// src/middleware/globalErrorHandler.ts
var globalErrorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(statusCode).json({
    success: false,
    message,
    errors: err
  });
};
var globalErrorHandler_default = globalErrorHandler;

// src/app.ts
var app = express();
app.use(CookieParser());
app.use(express.json());
app.use(express.text());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));
app.get("/", async (req, res) => {
  res.status(200).json({
    message: "expres server",
    author: "next-level"
  });
});
app.use("/api/auth", authRoute);
app.use("/api/issues", issueRoutes);
app.use(globalErrorHandler_default);
var app_default = app;

// src/server.ts
var main = () => {
  initDB();
  app_default.listen(config_default.port, () => {
    console.log(`Example app listening on port ${config_default.port}`);
  });
};
main();
//# sourceMappingURL=server.js.map