USE eduportalv;

CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject VARCHAR(50) NOT NULL,
  type ENUM('Lecture','Lab') NOT NULL DEFAULT 'Lecture',
  date DATE NOT NULL,
  status ENUM('Present','Absent') NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  INDEX idx_att_student (student_id),
  INDEX idx_att_date (date),
  INDEX idx_att_subject (subject)
) ENGINE=InnoDB;

DELETE FROM attendance WHERE id > 0;

DELIMITER $$

DROP PROCEDURE IF EXISTS generate_attendance$$

CREATE PROCEDURE generate_attendance()
BEGIN
    DECLARE d DATE DEFAULT '2026-03-01';
    DECLARE end_date DATE DEFAULT '2026-03-28';
    DECLARE sid INT;

    WHILE d <= end_date DO
        SET sid = (SELECT MIN(id) FROM students);
        WHILE sid IS NOT NULL DO
            INSERT INTO attendance (student_id, subject, type, date, status) VALUES
            (sid, 'AM-4', 'Lecture', d, IF(RAND()>0.25,'Present','Absent')),
            (sid, 'AOA', 'Lecture', d, IF(RAND()>0.25,'Present','Absent')),
            (sid, 'OS', 'Lecture', d, IF(RAND()>0.25,'Present','Absent')),
            (sid, 'MDM', 'Lecture', d, IF(RAND()>0.25,'Present','Absent')),
            (sid, 'CTD', 'Lecture', d, IF(RAND()>0.25,'Present','Absent')),
            (sid, 'WT', 'Lecture', d, IF(RAND()>0.25,'Present','Absent')),
            (sid, 'AOA Lab', 'Lab', d, IF(RAND()>0.25,'Present','Absent')),
            (sid, 'OS Lab', 'Lab', d, IF(RAND()>0.25,'Present','Absent')),
            (sid, 'WT Lab', 'Lab', d, IF(RAND()>0.25,'Present','Absent')),
            (sid, 'UHV Lab', 'Lab', d, IF(RAND()>0.25,'Present','Absent'));

            SET sid = (SELECT MIN(id) FROM students WHERE id > sid);
        END WHILE;
        SET d = DATE_ADD(d, INTERVAL 1 DAY);
    END WHILE;
END$$

DELIMITER ;

CALL generate_attendance();

SELECT COUNT(*) AS total_records, COUNT(DISTINCT student_id) AS students_covered FROM attendance;