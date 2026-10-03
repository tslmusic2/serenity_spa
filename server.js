import http from 'node:http'
import { pool } from './utilities/database.js'
import { sendJson } from './utilities/responses.js'



const PORT = 8007




const result = await pool.query(`
    SELECT current_database() AS database_name;
`)

console.log('Connected to database:', result.rows[0].database_name)

const server = http.createServer(async (req, res) => {



})

server.listen(PORT, () => console.log(`Connected on port: ${PORT}`))