-- MySQL Schema for English Center Management System

CREATE TABLE IF NOT EXISTS users (
    uid VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    displayName VARCHAR(255),
    role ENUM('admin', 'staff', 'teacher', 'ta', 'collaborator') NOT NULL DEFAULT 'staff',
    isApproved BOOLEAN DEFAULT FALSE,
    photoURL TEXT,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    fbLink TEXT,
    subject VARCHAR(255),
    status VARCHAR(50),
    notes TEXT,
    closedAmount VARCHAR(50),
    source VARCHAR(100),
    ownerId VARCHAR(255),
    ownerName VARCHAR(255),
    consultationDate BIGINT,
    createdAt BIGINT,
    updatedAt BIGINT,
    FOREIGN KEY (ownerId) REFERENCES users(uid) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS interactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customerId INT,
    content TEXT NOT NULL,
    notes TEXT,
    status VARCHAR(50),
    staffId VARCHAR(255),
    createdAt BIGINT,
    FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (staffId) REFERENCES users(uid) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customerId INT,
    customerName VARCHAR(255),
    customerPhone VARCHAR(20),
    time BIGINT NOT NULL,
    content TEXT,
    staffId VARCHAR(255),
    status VARCHAR(50),
    createdAt BIGINT,
    FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (staffId) REFERENCES users(uid) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS subjects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    createdAt BIGINT
);

CREATE TABLE IF NOT EXISTS teachers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    subjects TEXT, -- JSON array of subject names
    createdAt BIGINT
);

CREATE TABLE IF NOT EXISTS teaching_assistants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    createdAt BIGINT
);

CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50),
    location TEXT,
    createdAt BIGINT,
    updatedAt BIGINT
);

CREATE TABLE IF NOT EXISTS classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    teacherId INT,
    teacherName VARCHAR(255),
    taId INT,
    taName VARCHAR(255),
    schedule TEXT,
    startDate BIGINT,
    status VARCHAR(50),
    roomId INT,
    roomName VARCHAR(255),
    roomLink TEXT,
    createdAt BIGINT,
    updatedAt BIGINT,
    FOREIGN KEY (teacherId) REFERENCES teachers(id) ON DELETE SET NULL,
    FOREIGN KEY (taId) REFERENCES teaching_assistants(id) ON DELETE SET NULL,
    FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS class_students (
    classId INT,
    studentId INT,
    studentName VARCHAR(255),
    PRIMARY KEY (classId, studentId),
    FOREIGN KEY (classId) REFERENCES classes(id) ON DELETE CASCADE,
    FOREIGN KEY (studentId) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teaching_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    classId INT,
    className VARCHAR(255),
    subject VARCHAR(255),
    teacherId INT,
    teacherName VARCHAR(255),
    taId INT,
    taName VARCHAR(255),
    date BIGINT,
    startTime VARCHAR(10),
    endTime VARCHAR(10),
    roomId INT,
    roomName VARCHAR(255),
    roomLink TEXT,
    status VARCHAR(50),
    createdAt BIGINT,
    FOREIGN KEY (classId) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sessionId INT,
    classId INT,
    studentId INT,
    studentName VARCHAR(255),
    status VARCHAR(50),
    note TEXT,
    takenById VARCHAR(255),
    takenByName VARCHAR(255),
    updatedAt BIGINT,
    FOREIGN KEY (sessionId) REFERENCES teaching_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (studentId) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS receipts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    receiptNumber VARCHAR(50) UNIQUE,
    customerId INT,
    customerName VARCHAR(255),
    customerPhone VARCHAR(20),
    subject VARCHAR(255),
    amount DECIMAL(15, 2),
    totalAmount DECIMAL(15, 2),
    remainingAmount DECIMAL(15, 2),
    type VARCHAR(50),
    paymentMethod VARCHAR(50),
    note TEXT,
    staffId VARCHAR(255),
    staffName VARCHAR(255),
    date BIGINT,
    status VARCHAR(20),
    attachmentUrl TEXT,
    createdAt BIGINT,
    updatedAt BIGINT,
    FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS center_info (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255),
    address TEXT,
    website VARCHAR(255),
    updatedAt BIGINT
);

CREATE TABLE IF NOT EXISTS payment_vouchers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    voucherNumber VARCHAR(50) UNIQUE,
    category VARCHAR(100),
    recipientName VARCHAR(255),
    recipientId VARCHAR(255),
    amount DECIMAL(15, 2),
    description TEXT,
    paymentMethod VARCHAR(50),
    staffId VARCHAR(255),
    staffName VARCHAR(255),
    date BIGINT,
    status VARCHAR(20),
    attachmentUrl TEXT,
    createdAt BIGINT,
    updatedAt BIGINT
);
