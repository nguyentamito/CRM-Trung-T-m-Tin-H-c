import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import poolGetter from "./src/db.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

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

  // Generic CRUD helper
  const createCrudRoutes = (collectionName: string, tableName: string, idColumn: string = "id", orderByColumn?: string) => {
    app.get(`/api/${collectionName}`, async (req, res) => {
      try {
        const pool = poolGetter();
        if (!pool) return res.status(503).json({ error: "Database not configured" });
        
        let query = `SELECT * FROM ${tableName}`;
        const params: any[] = [];
        
        // Simple filtering for ownerId if provided
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

        if (filters.length > 0) {
          query += " WHERE " + filters.join(" AND ");
        }
        
        // Use provided orderByColumn, or fallback to idColumn
        const order = orderByColumn || idColumn;
        query += ` ORDER BY ${order} DESC`;
        
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

  createCrudRoutes("customers", "customers", "id", "id");
  createCrudRoutes("interactions", "interactions", "id", "id");
  createCrudRoutes("subjects", "subjects", "id", "id");
  createCrudRoutes("appointments", "appointments", "id", "id");
  createCrudRoutes("users", "users", "uid", "uid");
  createCrudRoutes("settings", "center_info", "id", "id");
  createCrudRoutes("classes", "classes", "id", "id");
  createCrudRoutes("teachers", "teachers", "id", "id");
  createCrudRoutes("teaching_assistants", "teaching_assistants", "id", "id");
  createCrudRoutes("teaching_sessions", "teaching_sessions", "id", "id");
  createCrudRoutes("attendance", "attendance", "id", "id");
  createCrudRoutes("payment_vouchers", "payment_vouchers", "id", "id");

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

  // Receipts API
  app.get("/api/receipts", async (req, res) => {
    try {
      const pool = poolGetter();
      if (!pool) return res.status(503).json({ error: "Database not configured" });
      const [rows] = await pool.query("SELECT * FROM receipts ORDER BY createdAt DESC");
      res.json(rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/receipts", async (req, res) => {
    const data = req.body;
    const fields = Object.keys(data);
    const placeholders = fields.map(() => "?").join(", ");
    const values = Object.values(data);
    try {
      const pool = poolGetter();
      if (!pool) return res.status(503).json({ error: "Database not configured" });
      const [result] = await pool.query(
        `INSERT INTO receipts (${fields.join(", ")}) VALUES (${placeholders})`,
        values
      );
      res.json({ id: (result as any).insertId, ...data });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
