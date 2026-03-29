import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

let pool: mysql.Pool | null = null;

export function getPool() {
  if (!pool) {
    const host = process.env.DB_HOST;
    if (!host) {
      console.warn('DB_HOST is not configured. MySQL connection will fail.');
      return null;
    }
    pool = mysql.createPool({
      host: host,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'english_center',
      port: parseInt(process.env.DB_PORT || '3306'),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Test connection immediately to log errors
    pool.getConnection()
      .then(conn => {
        console.log('Successfully connected to MySQL database');
        conn.release();
      })
      .catch(err => {
        console.error('CRITICAL: Failed to connect to MySQL database:', err.message);
        if (err.code === 'ER_ACCESS_DENIED_ERROR') {
          console.error('Check your DB_USER and DB_PASSWORD in AI Studio Secrets.');
        } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
          console.error('Check your DB_HOST and ensure your MySQL server allows remote connections from AI Studio Build IP.');
        }
      });
  }
  return pool;
}

export default getPool;
