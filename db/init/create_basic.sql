SET GLOBAL local_infile=1; /* For loading local files  */

ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY '';

USE records;

CREATE TABLE trace 
    (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100),
        UNIQUE (name)
    );

CREATE TABLE tx
    (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        traceId INT,
        requestsId TEXT, 
        gen INT NOT NULL,
        wait INT NOT NULL,
        sch INT NOT NULL,
        fin INT NOT NULL,
        txSource TEXT NOT NULL, 
        txType TEXT NOT NULL,
        txId INT,

        FOREIGN KEY (traceID)
            REFERENCES trace(id)
            ON DELETE CASCADE
    );

    