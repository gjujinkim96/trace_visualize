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
        host_interface_arrival_time INT NOT NULL,
        tsu_arrival_time INT NOT NULL,
        flash_scheduling_time INT NOT NULL,
        flash_service_finish_time INT NOT NULL,
        txSource TEXT NOT NULL, 
        txType TEXT NOT NULL,
        txId INT,

        FOREIGN KEY (traceID)
            REFERENCES trace(id)
            ON DELETE CASCADE
    );

    