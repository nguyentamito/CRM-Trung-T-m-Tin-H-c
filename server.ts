import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";
import poolGetter from "./src/db.ts";

dotenv.config();

async function startServer() {
  console.log("Server starting...");
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Request logger
  app.use((req, res, next) => {
    if (req.url.startsWith('/api/')) {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    }
    next();
  });

  // Process-level error handlers
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
  });

  // Ensure API routes always return JSON
  app.use('/api', (req, res, next) => {
    res.setHeader('Content-Type', 'application/json');
    next();
  });

  // API routes
  app.get("/api/health", (req, res) => {
    console.log("Health check requested");
    res.json({ status: "ok" });
  });

  // Initialize database schema in background
  const initDb = async () => {
    try {
      const pool = poolGetter();
      if (!pool) {
        console.warn("Database pool not available for schema initialization");
        return;
      }
      
      console.log("Starting database schema initialization...");
      const schemaPath = path.join(process.cwd(), 'schema.sql');
      if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        const statements = schema
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);
        
        for (const statement of statements) {
          try {
            await pool.query(statement);
          } catch (err: any) {
            if (!err.message.includes("already exists") && !err.message.includes("Duplicate")) {
              console.warn(`Warning executing statement: ${err.message}`);
            }
          }
        }
        console.log("Database schema initialization completed");
      }
    } catch (error) {
      console.error("Error initializing database schema:", error);
    }
  };
  // Don't await here to prevent blocking server start if DB is slow/unreachable
  initDb();

  app.get("/api/db-check", async (req, res) => {
    try {
      const pool = poolGetter();
      if (!pool) return res.status(503).json({ error: "Database not configured" });
      await pool.query("SELECT 1");
      res.json({ status: "connected" });
    } catch (error) {
      console.error("DB Check Error:", error);
      res.status(500).json({ error: "Database connection failed", details: (error as any).message });
    }
  });

  // Ensure classes table has studentIds and studentNames columns if they are missing
  const ensureColumns = async () => {
    try {
      const pool = poolGetter();
      if (!pool) return;
      
      const [columns]: any = await pool.query("DESCRIBE classes");
      const columnNames = columns.map((c: any) => c.Field);
      
      if (!columnNames.includes('studentIds')) {
        await pool.query("ALTER TABLE classes ADD COLUMN studentIds TEXT");
        console.log("Added studentIds column to classes table");
      }
      if (!columnNames.includes('studentNames')) {
        await pool.query("ALTER TABLE classes ADD COLUMN studentNames TEXT");
        console.log("Added studentNames column to classes table");
      }
      if (!columnNames.includes('zaloLink')) {
        await pool.query("ALTER TABLE classes ADD COLUMN zaloLink TEXT");
        console.log("Added zaloLink column to classes table");
      }

      // Ensure teacher columns
      const [teacherCols]: any = await pool.query("DESCRIBE teachers");
      const teacherColNames = teacherCols.map((c: any) => c.Field);
      if (!teacherColNames.includes('dob')) {
        await pool.query("ALTER TABLE teachers ADD COLUMN dob VARCHAR(255)");
      }
      if (!teacherColNames.includes('qualification')) {
        await pool.query("ALTER TABLE teachers ADD COLUMN qualification VARCHAR(255)");
      }
      if (!teacherColNames.includes('pedagogical')) {
        await pool.query("ALTER TABLE teachers ADD COLUMN pedagogical BOOLEAN DEFAULT FALSE");
      }
      if (!teacherColNames.includes('address')) {
        await pool.query("ALTER TABLE teachers ADD COLUMN address TEXT");
      }

      // Ensure receipt columns
      const [receiptCols]: any = await pool.query("DESCRIBE receipts");
      const receiptColNames = receiptCols.map((c: any) => c.Field);
      const attachmentUrlCol = receiptCols.find((c: any) => c.Field === 'attachmentUrl');
      if (!attachmentUrlCol) {
        await pool.query("ALTER TABLE receipts ADD COLUMN attachmentUrl LONGTEXT");
      } else if (attachmentUrlCol.Type.toLowerCase() !== 'longtext') {
        await pool.query("ALTER TABLE receipts MODIFY COLUMN attachmentUrl LONGTEXT");
      }

      // Ensure payment_vouchers columns
      const [voucherCols]: any = await pool.query("DESCRIBE payment_vouchers");
      const voucherAttachmentCol = voucherCols.find((c: any) => c.Field === 'attachmentUrl');
      if (!voucherAttachmentCol) {
        await pool.query("ALTER TABLE payment_vouchers ADD COLUMN attachmentUrl LONGTEXT");
      } else if (voucherAttachmentCol.Type.toLowerCase() !== 'longtext') {
        await pool.query("ALTER TABLE payment_vouchers MODIFY COLUMN attachmentUrl LONGTEXT");
      }

      // Ensure users columns
      const [userCols]: any = await pool.query("DESCRIBE users");
      const userColNames = userCols.map((c: any) => c.Field);
      if (!userColNames.includes('isApproved')) {
        await pool.query("ALTER TABLE users ADD COLUMN isApproved BOOLEAN DEFAULT FALSE");
        console.log("Added isApproved column to users table");
      }
      if (!userColNames.includes('role')) {
        await pool.query("ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'staff'");
        console.log("Added role column to users table");
      }
      if (!userColNames.includes('createdAt')) {
        await pool.query("ALTER TABLE users ADD COLUMN createdAt BIGINT");
      }
      if (!userColNames.includes('updatedAt')) {
        await pool.query("ALTER TABLE users ADD COLUMN updatedAt BIGINT");
      }
    } catch (error) {
      console.error("Error ensuring columns:", error);
    }
  };
  ensureColumns();

  // Generic CRUD helper
  const createCrudRoutes = (collectionName: string, tableName: string, idColumn: string = "id", orderByColumn?: string) => {
    console.log(`Registering CRUD routes for: /api/${collectionName} (table: ${tableName})`);
    app.get(`/api/${collectionName}`, async (req, res) => {
      try {
        const pool = poolGetter();
        if (!pool) return res.status(503).json({ error: "Database not configured" });
        
        let query = `SELECT * FROM ${tableName}`;
        const params: any[] = [];
        
        const filters: string[] = [];
        if (req.query.ownerId) {
          filters.push("ownerId = ?");
          params.push(req.query.ownerId);
        }
        if (req.query.staffId) {
          filters.push("staffId = ?");
          params.push(req.query.staffId);
        }
        if (req.query.uid) {
          filters.push("uid = ?");
          params.push(req.query.uid);
        }

        // Add date range filtering if start/end are provided
        const start = req.query.start;
        const end = req.query.end;
        if (start || end) {
          // Determine which column to use for date filtering
          const [columns]: any = await pool.query(`DESCRIBE ${tableName}`);
          const columnNames = columns.map((c: any) => c.Field);
          const dateCol = columnNames.find((c: string) => ['date', 'time', 'consultationDate', 'createdAt'].includes(c));
          
          if (dateCol) {
            if (start) {
              filters.push(`${dateCol} >= ?`);
              params.push(Number(start));
            }
            if (end) {
              filters.push(`${dateCol} <= ?`);
              params.push(Number(end));
            }
          }
        }

        if (filters.length > 0) {
          query += " WHERE " + filters.join(" AND ");
        }
        
        // Use provided orderByColumn, or fallback to idColumn
        const order = (req.query.order as string) || orderByColumn || idColumn;
        const direction = (req.query.direction as string) === 'ASC' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${order} ${direction}`;
        
        const [rows] = await pool.query(query, params);
        res.json(rows);
      } catch (error: any) {
        console.error(`GET /api/${collectionName} error:`, error);
        res.status(500).json({ 
          error: "Database Error", 
          details: error.message,
          code: error.code 
        });
      }
    });

    app.get(`/api/${collectionName}/:id`, async (req, res) => {
      const { id } = req.params;
      try {
        const pool = poolGetter();
        if (!pool) return res.status(503).json({ error: "Database not configured" });
        const [rows]: any = await pool.query(`SELECT * FROM ${tableName} WHERE ${idColumn} = ?`, [id]);
        if (rows.length > 0) {
          res.json(rows[0]);
        } else {
          res.status(404).json({ error: "Not found" });
        }
      } catch (error: any) {
        console.error(`GET /api/${collectionName}/${id} error:`, error);
        res.status(500).json({ error: "Database Error", details: error.message });
      }
    });

    app.post(`/api/${collectionName}`, async (req, res) => {
      const data = { ...req.body };
      
      try {
        const pool = poolGetter();
        if (!pool) return res.status(503).json({ error: "Database not configured" });

        // Get valid columns for this table to avoid "Unknown column" errors
        const [columns]: any = await pool.query(`DESCRIBE ${tableName}`);
        const validColumns = columns.map((c: any) => c.Field);
        
        const filteredData: any = {};
        for (const key of Object.keys(data)) {
          if (validColumns.includes(key)) {
            filteredData[key] = data[key];
          }
        }

        const fields = Object.keys(filteredData);
        const placeholders = fields.map(() => "?").join(", ");
        const values = Object.values(filteredData);

        const [result] = await pool.query(
          `INSERT INTO ${tableName} (${fields.join(", ")}) VALUES (${placeholders})`,
          values
        );
        res.json({ [idColumn]: (result as any).insertId || data[idColumn], ...filteredData });
      } catch (error: any) {
        console.error(`POST /api/${collectionName} error:`, error);
        res.status(500).json({ error: "Database Error", details: error.message, code: error.code });
      }
    });

    app.put(`/api/${collectionName}/:id`, async (req, res) => {
      const { id } = req.params;
      const data = { ...req.body };
      console.log(`PUT /api/${collectionName}/${id} - Body:`, data);
      
      try {
        const pool = poolGetter();
        if (!pool) return res.status(503).json({ error: "Database not configured" });

        // Get valid columns
        const [columns]: any = await pool.query(`DESCRIBE ${tableName}`);
        const validColumns = columns.map((c: any) => c.Field);

        const filteredData: any = {};
        for (const key of Object.keys(data)) {
          // Don't update the ID column and only include valid columns
          if (key !== idColumn && validColumns.includes(key)) {
            filteredData[key] = data[key];
          }
        }

        const fields = Object.keys(filteredData);
        if (fields.length === 0) {
          return res.json({ [idColumn]: id, ...data });
        }

        const setClause = fields.map(field => `${field} = ?`).join(", ");
        const values = [...Object.values(filteredData), id];

        await pool.query(
          `UPDATE ${tableName} SET ${setClause} WHERE ${idColumn} = ?`,
          values
        );
        res.json({ [idColumn]: id, ...filteredData });
      } catch (error: any) {
        console.error(`PUT /api/${collectionName}/${id} error:`, error);
        res.status(500).json({ error: "Database Error", details: error.message, code: error.code });
      }
    });

    app.delete(`/api/${collectionName}/:id`, async (req, res) => {
      const { id } = req.params;
      try {
        const pool = poolGetter();
        if (!pool) return res.status(503).json({ error: "Database not configured" });
        await pool.query(`DELETE FROM ${tableName} WHERE ${idColumn} = ?`, [id]);
        res.json({ success: true });
      } catch (error: any) {
        console.error(`DELETE /api/${collectionName}/${id} error:`, error);
        res.status(500).json({ error: "Database Error", details: error.message, code: error.code });
      }
    });
  };

  // Center Info API (Legacy/Specific)
  app.get("/api/settings/center_info", async (req, res) => {
    try {
      const pool = poolGetter();
      if (!pool) return res.status(503).json({ error: "Database not configured" });
      const [rows]: any = await pool.query("SELECT * FROM center_info LIMIT 1");
      if (rows.length > 0) {
        res.json(rows[0]);
      } else {
        // Return default if no settings found
        res.json({
          id: 'default',
          name: 'TRUNG TÂM ANH NGỮ ĐH SƯ PHẠM',
          address: '29 Lê Quý Đôn, Quận 3, Thành Phố Hồ Chí Minh',
          website: 'www.anhngusupham.com',
          updatedAt: Date.now()
        });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/settings/center_info", async (req, res) => {
    const { name, address, website } = req.body;
    try {
      const pool = poolGetter();
      if (!pool) return res.status(503).json({ error: "Database not configured" });
      
      // Check if settings record exists
      const [rows]: any = await pool.query("SELECT id FROM center_info LIMIT 1");
      if (rows.length > 0) {
        await pool.query(
          "UPDATE center_info SET name = ?, address = ?, website = ?, updatedAt = ? WHERE id = ?",
          [name, address, website, Date.now(), rows[0].id]
        );
        res.json({ id: rows[0].id, name, address, website });
      } else {
        const [result] = await pool.query(
          "INSERT INTO center_info (id, name, address, website, updatedAt) VALUES (?, ?, ?, ?, ?)",
          ['default', name, address, website, Date.now()]
        );
        res.json({ id: 'default', name, address, website });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.put("/api/settings/center_info", async (req, res) => {
    const { name, address, website } = req.body;
    try {
      const pool = poolGetter();
      if (!pool) return res.status(503).json({ error: "Database not configured" });
      
      const [rows]: any = await pool.query("SELECT id FROM center_info LIMIT 1");
      if (rows.length > 0) {
        await pool.query(
          "UPDATE center_info SET name = ?, address = ?, website = ?, updatedAt = ? WHERE id = ?",
          [name, address, website, Date.now(), rows[0].id]
        );
        res.json({ id: rows[0].id, name, address, website });
      } else {
        await pool.query(
          "INSERT INTO center_info (id, name, address, website, updatedAt) VALUES (?, ?, ?, ?, ?)",
          ['default', name, address, website, Date.now()]
        );
        res.json({ id: 'default', name, address, website });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  createCrudRoutes("customers", "customers", "id", "consultationDate");
  createCrudRoutes("interactions", "interactions", "id", "createdAt");
  createCrudRoutes("subjects", "subjects", "id", "name");
  createCrudRoutes("appointments", "appointments", "id", "time");
  createCrudRoutes("users", "users", "uid", "createdAt");
  createCrudRoutes("settings", "center_info", "id", "id");
  createCrudRoutes("classes", "classes", "id", "createdAt");
  createCrudRoutes("teachers", "teachers", "id", "createdAt");
  createCrudRoutes("teaching_assistants", "teaching_assistants", "id", "createdAt");
  createCrudRoutes("teaching_sessions", "teaching_sessions", "id", "date");
  createCrudRoutes("attendance", "attendance", "id", "updatedAt");
  createCrudRoutes("payment_vouchers", "payment_vouchers", "id", "date");
  createCrudRoutes("receipts", "receipts", "id", "date");

  // Rooms API
  app.get("/api/rooms", async (req, res) => {
    try {
      const pool = poolGetter();
      if (!pool) return res.status(503).json({ error: "Database not configured" });
      const [rows] = await pool.query("SELECT * FROM rooms ORDER BY id DESC");
      res.json(rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/rooms", async (req, res) => {
    const { name, type, location } = req.body;
    try {
      const pool = poolGetter();
      if (!pool) return res.status(503).json({ error: "Database not configured" });
      const [result] = await pool.query(
        "INSERT INTO rooms (name, type, location) VALUES (?, ?, ?)",
        [name, type, location]
      );
      res.json({ id: (result as any).insertId, name, type, location });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.put("/api/rooms/:id", async (req, res) => {
    const { id } = req.params;
    const { name, type, location } = req.body;
    try {
      const pool = poolGetter();
      if (!pool) return res.status(503).json({ error: "Database not configured" });
      await pool.query(
        "UPDATE rooms SET name = ?, type = ?, location = ? WHERE id = ?",
        [name, type, location, id]
      );
      res.json({ id, name, type, location });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.delete("/api/rooms/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const pool = poolGetter();
      if (!pool) return res.status(503).json({ error: "Database not configured" });
      await pool.query("DELETE FROM rooms WHERE id = ?", [id]);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Catch-all for non-existent API routes
  app.all("/api/*", (req, res) => {
    console.log(`API route not found: ${req.method} ${req.url}`);
    res.status(404).json({ error: "API route not found" });
  });

  // Global error handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global Error Handler:", err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
    });
  });

  // Process-level error handlers
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    try {
      console.log("Initializing Vite middleware...");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware initialized.");
    } catch (err) {
      console.error("Failed to initialize Vite middleware:", err);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    } else {
      console.warn("Dist directory not found. Static files will not be served.");
    }
  }

  // Start listening at the very end
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

startServer();
