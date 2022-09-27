const express = require('express')
const mysql = require('mysql2/promise')
// const csv = require('fast-csv')

async function createConn() {
    return mysql.createConnection({
        host: 'db',
        user: 'root',
        password: '',
        database: 'records'
    })
}


// connection.query('SELECT 1 + 1 AS solution', (err, rows, fields) => {
//   if (err) throw err

//   console.log('The solution is: ', rows[0].solution)
// })

// connection.end()


const app = express()

app.use(express.static('public'))
app.use(express.static('node_modules'))
app.use(express.json())
app.use(express.urlencoded({
    extended: true,
    limit: '100mb'
}))

const port = 3000

console.log(`Starting server at port: ${port}`)

app.get('/', (req, res) => {
    res.send('HW')
})

app.get('/tx/:traceId', async (req, res) => {
    let traceId = req.params.traceId;
    let sqlStmt = req.query.sql;
    let traceIdStmt = sqlStmt.replace(/\btx\b/ig, `tx_${traceId}`)

    console.log(`Querying: ${traceIdStmt}`)
    var connection;
    try {
        connection = await createConn()

        let result = await connection.query(traceIdStmt)
        connection.end()

        console.log(`TX Query Result: ${result[0].length} rows`)
        return res.send(result[0])
    } catch (e) {
        let clientMsg = 'sqlMessage' in e ? e.sqlMessage : 'Something went wrong'
        console.log('cm', clientMsg)
        return handleErrorMsg(res, e, 500, clientMsg,
            `Some problem with db: /tx/${traceId}?sql=${sqlStmt}`)
    }
})

function handleErrorMsg(res, e, statusCode, clientMsg, logMsg) {
    console.log(logMsg)
    if (e != null) {
        console.log(e)
    }
    return res.status(statusCode).send(clientMsg)
}

app.get('/trace', async (req, res) => {
    let sqlStmt = 'SELECT * FROM trace order by id';
    var connection;
    try {
        connection = await createConn()

        let result = await connection.query(sqlStmt)
        connection.end()

        console.log(`Trace Query Result: ${result[0].length} rows`)
        return res.send(result[0])
    } catch (e) {
        return handleErrorMsg(res, e, 500, 'Something wrong with db.',
            `Some problem with db: /trace`)
    }
})

app.delete('/trace/:traceId', async (req, res)=> {
    let traceId = req.params.traceId

    let delStmt = `DELETE FROM trace WHERE id = ${traceId}`;
    var connection;
    try {
        connection = await createConn()

        let result = await connection.query(delStmt)
        connection.end()

        let deleted = result[0].affectedRows == 1;

        var msg;
        if (deleted) {
            msg = `Deleted trace id: ${traceId}`
        } else {
            msg = `Trace with ${traceId} not found.`
        }
        console.log(msg)
        return res.send(msg)
    } catch (e) {
        return handleErrorMsg(res, e, 500, 'Something wrong with db.',
            `Some problem with db: delete /trace/${traceId}`)
    }
}) 

app.post('/trace/:traceName?', async (req, res)=> {
    let traceName = req.params.traceName ? req.params.traceName :new Date().toLocaleString('en-KR', {timeZone: 'Asia/Seoul'});
    var connection;
    console.log('traceName', traceName)
    try {
        connection = await createConn()

        await connection.beginTransaction();

        let checkTrace = 'SELECT * FROM trace WHERE name = ?'
        let checked = await connection.query(checkTrace, [traceName])
        if (checked[0].length >= 1) {
            if (req.params.traceName) {
                await connection.rollback()
                return handleErrorMsg(res, null, 422, 'Trace name must be unique.',
                    `Duplicate trace name received: ${traceName}`)
            } else {
                let cnt = 1;
                while (true) {
                    let newName = `${traceName}_${cnt}`
                    let checked2 = await connection.query(checkTrace, [newName])
                    if (checked2[0].length == 0) {
                        traceName = newName;
                        break;
                    } else {
                        cnt += 1
                    }
                }
            }
        }

        let traceSql = 'INSERT INTO trace (name) VALUES (?)'
        let traceResult = await connection.query(traceSql, [traceName])
        let traceId = traceResult[0].insertId
        console.log(`New trace inserted: ${traceName}`)


        let csv = Object.keys(req.body)[0].trim();
        let lines = csv.split(/\n|\r\n/)
        let rows = lines.map(function (v) {
            let line = v.split(',');
            var host_interface_arrival_time = parseInt(line[0]),
                tsu_arrival_time = parseInt(line[1]),
                flash_scheduling_time = parseInt(line[2]),
                flash_service_finish_time = parseInt(line[3]),

                requestsId,
                txSource,
                txType,
                txId,
                channel,
                chip,
                die;
        
            if (line.length === 9) {
                requestsId = null;
                txSource = line[4];
                txType = line[5];
                txId = null;
                channel = parseInt(line[6]);
                chip = parseInt(line[7]);
                die = parseInt(line[8]);
            } else {
                requestsId = line[4],
                txSource = line[5];
                txType = line[6];
                txId = parseInt(line[7]);
                channel = parseInt(line[8]);
                chip = parseInt(line[9]);
                die = parseInt(line[10]);
            }

            console.log(channel, chip, die);
            return [traceId, 
                host_interface_arrival_time, tsu_arrival_time,
                flash_scheduling_time, flash_service_finish_time, 
                requestsId, txSource, txType, txId, channel, chip, die]
        })
    
        let txSql = 'INSERT INTO tx (traceId, host_interface_arrival_time, tsu_arrival_time, flash_scheduling_time, flash_service_finish_time, requestsId, txSource, txType, txId, channel, chip, die) VALUES ?'
        let result = await connection.query(txSql, [rows])

        let viewSql = `CREATE VIEW tx_${traceId} AS SELECT * FROM tx WHERE traceId=${traceId}`
        await connection.query(viewSql)

        await connection.commit()

        console.log(`Inserted ${result[0].affectedRows} txs to trace: ${traceName}`)
        return res.send(`Inserted ${result[0].affectedRows} txs to trace: ${traceName}`)
    } catch (e) {
        if (connection) {
            console.log('Rollback')
            await connection.rollback()
        }
        return handleErrorMsg(res, e, 500, 'Something wrong with db.',
            `Some problem with db: /trace/${traceName}`)
    }
})

app.listen(port);
