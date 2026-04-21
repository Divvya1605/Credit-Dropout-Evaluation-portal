-- Create and use mentor DB
CREATE DATABASE IF NOT EXISTS mentor_system;
USE mentor_system;

-- Mentors table
CREATE TABLE mentors (
    mentor_id   VARCHAR(10)  PRIMARY KEY,
    mentor_name VARCHAR(100) NOT NULL,
    email       VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT INTO mentors (mentor_id, mentor_name, email) VALUES
('M101', 'Priya Iyer', 'iyerpriyasece@outlook.com'),
('M102', 'Ananya Nair', 'ananyanairsece@outlook.com'),
('M103', 'Aarav Mehta', 'aaravmehtasece@outlook.com'),
('M104', 'Bhavya Menon', 'bhavyamenonsece@outlook.com'),
('M105', 'Raghav Sharma', 'raghavsharmasece@outlook.com'),
('M106', 'Zaheen Amir', 'zaheenamirsece@outlook.com');

CREATE TABLE mentor_students (
    mentor_id VARCHAR(10) NOT NULL,
    student_id INT NOT NULL,

    PRIMARY KEY (mentor_id, student_id),

    CONSTRAINT fk_ms_mentor
        FOREIGN KEY (mentor_id)
        REFERENCES mentors(mentor_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ms_student
        FOREIGN KEY (student_id)
        REFERENCES eduportalv.students(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;

-- Enforce max 30 students per mentor
DELIMITER $$
CREATE TRIGGER trg_limit_30_students
BEFORE INSERT ON mentor_students
FOR EACH ROW
BEGIN
    DECLARE current_count INT;

    SELECT COUNT(*)
      INTO current_count
      FROM mentor_students
     WHERE mentor_id = NEW.mentor_id;

    IF current_count >= 30 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'This mentor already has 30 students assigned';
    END IF;
END$$
DELIMITER ;

INSERT INTO mentor_students (mentor_id, student_id)
SELECT 
    CASE 
        WHEN rn BETWEEN 1 AND 30 THEN 'M101'
        WHEN rn BETWEEN 31 AND 60 THEN 'M102'
        WHEN rn BETWEEN 61 AND 90 THEN 'M103'
        WHEN rn BETWEEN 91 AND 120 THEN 'M104'
        WHEN rn BETWEEN 121 AND 150 THEN 'M105'
        WHEN rn BETWEEN 151 AND 180 THEN 'M106'
    END,
    id
FROM (
    SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
    FROM eduportalv.students
) AS numbered_students;