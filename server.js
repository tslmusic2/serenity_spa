import http from 'node:http'
import { pool } from './utilities/database.js'
import { sendJson } from './utilities/responses.js'
import { getReqBody } from './utilities/getReqBody.js'
import { isValidISODate } from './utilities/isValidIsoDate.js'



const PORT = 8007


const ADMIN_API_KEY = process.env.ADMIN_API_KEY
if (!ADMIN_API_KEY) {
     throw new Error('ADMIN_API_KEY is missing')
}



const result = await pool.query(`
    SELECT current_database() AS database_name;
`)

console.log('Connected to database:', result.rows[0].database_name)

const server = http.createServer(async (req, res) => {
console.log('Incoming request:', req.method, req.url)
     //Here so this works on my local network----------
	res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE OPTIONS')

    if (req.method === 'OPTIONS') {
    res.statusCode = 204
    return res.end()
    }
	//-------------------------------------------------



    try {

        if (req.url === '/api/packages' && req.method === 'GET') {

            const result = await pool.query(`
                SELECT id, package_name, duration_minutes, description, price
                FROM packages
                WHERE is_active= TRUE
                ORDER BY price, id;
                `)

            return sendJson(res, 200, {message: 'request was successful', packages: result.rows})
        }

        if (req.url.startsWith('/api/packages')  && req.method === 'GET') {

            const id = Number(req.url.split('/').pop())

            if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
                return sendJson(res, 400, {message: 'id must be a number between 1 and 2147483647'})
            }

            const values = [id, true]

            const result = await pool.query(`
                SELECT id, package_name, duration_minutes, description, price
                FROM packages
                WHERE id = $1
                AND is_active = $2;
                `, values)

            if (result.rowCount === 0) {
                return sendJson(res, 404, {message: 'id could not be found'})
            }

            return sendJson(res, 200, {message: 'request was successful', package: result.rows[0]})
        }

        //---------------Admin POST to add new Packages-----------
        if (req.url === '/api/packages' && req.method === 'POST') {

             //----------------------------------------------------------//
			if (!ADMIN_API_KEY || req.headers['x-admin-key'] !== ADMIN_API_KEY) {
				return sendJson(res, 403, { message: 'Admin access required' })
			}
			//----------------------------------------------------------//


            let parsedReqBody
            try {

            
                parsedReqBody = await getReqBody(req)

                if (parsedReqBody === null || typeof parsedReqBody !== 'object' || Array.isArray(parsedReqBody)) {
                    return sendJson(res, 400, {message: 'Request must be a valid JSON object'})
                }

            } catch(err) {

                if(err instanceof SyntaxError) {
                    return sendJson(res, 400, {message: 'Request body must contain valid JSON'})
                }

                    throw err
            }


            const requiredFields = ['package_name', 'duration_minutes', 'description', 'price']
            const allowedFields = ['package_name', 'duration_minutes', 'description', 'price', 'max_daily_bookings']
           

            const parsedReqKeysArr = Object.keys(parsedReqBody)
            for (const field of requiredFields) {
                const hasReqField = parsedReqKeysArr.includes(field)

                if (!hasReqField) {
                    return sendJson(res, 400, {message: `${field} is a required field`})
                }

            }

            for (const field of parsedReqKeysArr) {
                const allowedField = allowedFields.includes(field)

                if (!allowedField) {
                    return sendJson(res, 400, {message: `${field} is not an allowed field`})
                }
            }

            //package_name, 
            if(
                parsedReqBody.package_name === null || 
                typeof parsedReqBody.package_name !== 'string' ||
                parsedReqBody.package_name.trim().length === 0
            ) {
                return sendJson(res, 400, {message: 'package_name must be a non empty string'})
            }
        
            // duration_minutes, 
            if (
                parsedReqBody.duration_minutes === null ||
                !Number.isInteger(parsedReqBody.duration_minutes) ||
                parsedReqBody.duration_minutes < 1 ||
                parsedReqBody.duration_minutes > 600
            ) {
                return sendJson(res, 400, {message: 'duration_minutes must be an integer between 1 and 600'})
            }


            //description, 
            if(
                parsedReqBody.description === null || 
                typeof parsedReqBody.description !== 'string' ||
                parsedReqBody.description.trim().length === 0
            ) {
                return sendJson(res, 400, {message: 'description must be a non empty string'})
            }
            
            //price, 
            if (
                parsedReqBody.price === null ||
                !Number.isFinite(parsedReqBody.price) ||
                parsedReqBody.price < 0 ||
                parsedReqBody.price > 99999999.99
            ) {
                return sendJson(res, 400, {message: 'price must be a number between 0 and 99999999.99'})
            }
            
            //max_daily_bookings,
            const hasOwnMaxBookings = Object.hasOwn(parsedReqBody, 'max_daily_bookings')
            if(hasOwnMaxBookings) {
                if (
                parsedReqBody.max_daily_bookings !== null &&
                (!Number.isInteger(parsedReqBody.max_daily_bookings) ||
                parsedReqBody.max_daily_bookings < 1 ||
                parsedReqBody.max_daily_bookings > 2147483647)
                ) {
                    return sendJson(res, 400, {message: 'max_daily_bookings must be a number between 1 and 2147483647 or null'})
                }
            }


            const placeholders = parsedReqKeysArr.map((field, index) => `$${index + 1}`).join(', ')
        console.log(placeholders)
            const values = Object.values(parsedReqBody)
        console.log(values)

            const result = await pool.query(`
                INSERT INTO packages(
                    ${parsedReqKeysArr}
                ) VALUES (
                    ${placeholders}
                )
                RETURNING *;
                `, values)

            
                return sendJson(res, 201, {message: 'Package successfully created', package: result.rows})
        }


        if (req.url.startsWith('/api/packages') && req.method === 'PATCH') {

             //----------------------------------------------------------//
			if (!ADMIN_API_KEY || req.headers['x-admin-key'] !== ADMIN_API_KEY) {
				return sendJson(res, 403, { message: 'Admin access required' })
			}
			//----------------------------------------------------------//

            const id = Number(req.url.split('/').pop())
            if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
                return sendJson(res, 400, {message: 'id must be an integer between 1 to 2147483647'})
            }


            let parsedReqBody
            try {

            
                parsedReqBody = await getReqBody(req)

                if (parsedReqBody === null || typeof parsedReqBody !== 'object' || Array.isArray(parsedReqBody)) {
                    return sendJson(res, 400, {message: 'Request must be a valid JSON object'})
                }

            } catch(err) {

                if(err instanceof SyntaxError) {
                    return sendJson(res, 400, {message: 'Request body must contain valid JSON'})
                }

                    throw err
            }



            const parsedReqArr = Object.keys(parsedReqBody)
            if (parsedReqArr.length === 0) {
                return sendJson(res, 400, {message: 'Provide at least one field to update'})
            }

            const allowedFields = ['package_name', 'duration_minutes', 'description', 'price', 'max_daily_bookings', 'is_active']

            for (const field of parsedReqArr) {
                const hasField = allowedFields.includes(field)
                if(!hasField) {
                    return sendJson(res, 400, {message: 'Request contains an invalid field'})
                }
            }


             //package_name, 
            const hasOwnPackageName = Object.hasOwn(parsedReqBody, 'package_name')
            if(hasOwnPackageName) {
                if(
                    parsedReqBody.package_name === null || 
                    typeof parsedReqBody.package_name !== 'string' ||
                    parsedReqBody.package_name.trim().length === 0
                ) {
                    return sendJson(res, 400, {message: 'package_name must be a non empty string'})
                }
            }

            // duration_minutes, 
            const hasOwnDurationMinutes = Object.hasOwn(parsedReqBody, 'duration_minutes')
            if(hasOwnDurationMinutes) {
                if (
                    parsedReqBody.duration_minutes === null ||
                    !Number.isInteger(parsedReqBody.duration_minutes) ||
                    parsedReqBody.duration_minutes < 1 ||
                    parsedReqBody.duration_minutes > 600
                ) {
                    return sendJson(res, 400, {message: 'duration_minutes must be an integer between 1 and 600'})
                }
            }


            //description, 
            const hasOwnDescription = Object.hasOwn(parsedReqBody, 'description')
            if(hasOwnDescription) {
                if(
                    parsedReqBody.description === null || 
                    typeof parsedReqBody.description !== 'string' ||
                    parsedReqBody.description.trim().length === 0
                ) {
                    return sendJson(res, 400, {message: 'description must be a non empty string'})
                }
            }

            //price, 
            const hasOwnPrice = Object.hasOwn(parsedReqBody, 'price')
            if(hasOwnPrice) {
                if (
                    parsedReqBody.price === null ||
                    !Number.isFinite(parsedReqBody.price) ||
                    parsedReqBody.price < 0 ||
                    parsedReqBody.price > 99999999.99
                ) {
                    return sendJson(res, 400, {message: 'price must be a number between 0 and 99999999.99'})
                }
            }
            
            //max_daily_bookings,
            const hasOwnMaxBookings = Object.hasOwn(parsedReqBody, 'max_daily_bookings')
            if(hasOwnMaxBookings) {
                if (
                parsedReqBody.max_daily_bookings !== null &&
                (!Number.isInteger(parsedReqBody.max_daily_bookings) ||
                parsedReqBody.max_daily_bookings < 1 ||
                parsedReqBody.max_daily_bookings > 2147483647)
                ) {
                    return sendJson(res, 400, {message: 'max_daily_bookings must be a number between 1 and 2147483647 or null'})
                }
            }

            //is_active
            const hasOwnIsActive = Object.hasOwn(parsedReqBody, 'is_active')
            if(hasOwnIsActive) {
                if (parsedReqBody.is_active === null || typeof parsedReqBody.is_active !== 'boolean') {
                    return sendJson(res, 400, {message: 'is_active must be true or false'})
                }
            }

            const setFields = parsedReqArr.map((field, index) => 
                `${field} = $${index + 1}`
            )

            const idPlaceholder = `$${setFields.length + 1}`

            const values = Object.values(parsedReqBody)
            values.push(id)

            const result = await pool.query(`
                UPDATE packages
                SET ${setFields.join(', ')}
                WHERE id = ${idPlaceholder}  
                RETURNING * 
                `, values)

            if (result.rowCount === 0) {
                return sendJson(res, 404, {message: 'Package could not be found'})
            }

            return sendJson(res, 200, {message: 'Package successfully updated', package: result.rows})


        }


        if (req.url.startsWith('/api/packages') && req.method === 'DELETE') {

            //----------------------------------------------------------//
			if (!ADMIN_API_KEY || req.headers['x-admin-key'] !== ADMIN_API_KEY) {
				return sendJson(res, 403, { message: 'Admin access required' })
			}
			//----------------------------------------------------------//

            const id = Number(req.url.split('/').pop())

            if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
                return sendJson(res, 400, {message: 'id must be an integer between 1 to 2147483647'})
            }


            let result
            try {
                result = await pool.query(`
                    DELETE FROM packages
                        WHERE id = $1
                    RETURNING *;
                    `, [id])

            } catch (err) {
				if (err.code === '23503') {
					return sendJson(res, 409, {
                        message: 'This package is referenced by a reservation and cannot be deleted. Please deaqctivate it instead'})
				}

				throw err
			}

            if (result.rowCount === 0) {
                return sendJson(res, 404, {message: 'Package could not be found'})
            }

            return sendJson(res, 200, {message: 'Package successfully deleted', package: result.rows[0]})

        }



    //-----------------POST RESERVATIONS HANDLER-------------------------
    if (req.url === '/api/reservations' && req.method === 'POST') {

        let parsedReqBody
        try {

            parsedReqBody = await getReqBody(req)

                if (parsedReqBody === null || typeof parsedReqBody !== 'object' || Array.isArray(parsedReqBody)) {
                    return sendJson(res, 400, {message: 'Request must be a valid JSON object'})
                }

        } catch(err) {

                if(err instanceof SyntaxError) {
                    return sendJson(res, 400, {message: 'Request body must contain valid JSON'})
                }

                    throw err
            }


            const requiredFields = ['full_name', 'email', 'phone', 'package_id', 'appointment_date', 'appointment_time']
                //server controlled fields     booking_price, booking_duration_minutes, status, or either generated ID


            const parsedReqArr = Object.keys(parsedReqBody)
            for (const field of requiredFields) {
                if (!parsedReqArr.includes(field)) {
                    return sendJson(res, 400, {message: `${field} is a required field`})
                }
            }

            for (const field of parsedReqArr) {
                if (!requiredFields.includes(field)) {
                    return sendJson(res, 400, {message: `${field} is not an allowed field`})
                }
            }


            //full_name, // email, // phone, 
            const stringFields = ['full_name', 'email', 'phone']

            for (const field of stringFields) {
                const value = parsedReqBody[field]
                if (
                    value === null || 
                    typeof value !== 'string' ||
                    value.trim().length === 0
                ) {
                    return sendJson(res, 400, {message: `${field} must be a non empty string`})
                }
                parsedReqBody[field] = value.trim()
            }

            //----Checks the email pattern is valid
            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            if (!emailPattern.test(parsedReqBody.email)) {
                return sendJson(res, 400, {
                    message: 'email must use a format like name@example.com'
                })
            }

            //----Checks the phone pattern is valid
            const phone = parsedReqBody.phone
            const phonePattern = /^\+?[0-9() .-]+$/
            const phoneDigits = phone.replace(/\D/g, '')

            if (
                !phonePattern.test(phone) ||
                phoneDigits.length < 7 ||
                phoneDigits.length > 15
            ) {
                return sendJson(res, 400, {
                    message: 'phone must contain 7–15 digits and use only an optional leading +, spaces, parentheses, dots, or hyphens'
                })
            }


            // package_id, 
            if (
                parsedReqBody.package_id === null ||
                !Number.isInteger(parsedReqBody.package_id) ||
                parsedReqBody.package_id < 1 ||
                parsedReqBody.package_id > 2147483647
            ) {
                return sendJson(res, 400, {message: 'package_id must be a number between 1 and 2147483647'})
            }

            // appointment_date, 
            if (!isValidISODate(parsedReqBody.appointment_date)) {
                return sendJson(res, 400, {message: `appointment_date must be a valid date`})
            }

            // appointment_time
            if (
                typeof parsedReqBody.appointment_time !== 'string' ||
                !/^([01]\d|2[0-3]):[0-5]\d$/.test(parsedReqBody.appointment_time
                )
            ) {
                return sendJson(res, 400, {message: 'appointment_time must use HH:MM format from 00:00 to 23:59'})
            }
            
            //time must be between 9 and 18:00   but 17:00 for 2hr packages  and 14:00 for 5hr packages
            const [hours, min] = parsedReqBody.appointment_time.split(':').map(Number)
            if(hours < 9 || hours > 18) {
                return sendJson(res, 400, {message: 'appointment_time must be between 9:00(9am) and 18:00(6pm)'})
            }
            if (min !== 0) {
                return sendJson(res, 400, {message: 'appointment_time mimutes must be on the hour(:00)'})
            }

            
            

    
            

        //-----------------APPOINTMENT TRY/CATCH and CREATION---------------------------
            const client = await pool.connect()
            try {

                await client.query('BEGIN')

                await client.query(`
                    SELECT pg_advisory_xact_lock(
                        1,
                        $1::date - DATE '2000-01-01'
                    );
                    `, [parsedReqBody.appointment_date])


                const packageValues = [parsedReqBody.package_id, true]
                
                const result = await client.query(`
                    SELECT id, price, duration_minutes, max_daily_bookings FROM packages
                    WHERE id = $1
                    AND is_active = $2
                    FOR SHARE;
                    `, packageValues)

                if(result.rowCount === 0) {
                    await client.query('ROLLBACK')
                    return sendJson(res, 404, {message: 'package doesnt exist or is inactive'})
                }

                //checks appointment will end before close
                const selectedPackage = result.rows[0]
                if (hours * 60 + selectedPackage.duration_minutes > 19 * 60) {
                    await client.query('ROLLBACK')
                    return sendJson(res, 400, {message: 'appointment would finish after close.  appointment must finish by 19:00'})
                }

                //checks date is in the future
                const futureResult = await client.query(`
                    SELECT 
                    ($1::date + $2::time) >
                    (clock_timestamp()AT TIME ZONE 'America/Costa_Rica') AS is_future;
                    `, [parsedReqBody.appointment_date, parsedReqBody.appointment_time])
            
                if (!futureResult.rows[0].is_future) {
                    await client.query('ROLLBACK')
                    return sendJson(res, 400, {message: 'Appointment must start in the future in Costa Rica time'})
                }

                
                //counting this package’s non-cancelled reservations on the requested date and comparing that count with max_daily_bookings
                const resCountCheckValues = [parsedReqBody.appointment_date, selectedPackage.id, 'cancelled']
                const reservationCount = await client.query(`
                        SELECT id FROM reservations
                            WHERE appointment_date = $1
                            AND package_id = $2
                            AND status != ($3)
                    `, resCountCheckValues)

                if (selectedPackage.max_daily_bookings !== null && reservationCount.rowCount >= selectedPackage.max_daily_bookings) {
                    await client.query('ROLLBACK')
                    return sendJson(res, 409, {message: 'There are no more appointments available on the requested date for your requested package'})     
                }

 //----------------               //Check overlapping appointments
                const appointmentCount = await client.query(`
                        SELECT id, appointment_time, booking_duration_minutes FROM reservations
                            WHERE appointment_date = $1
                            AND status != ($2)
                    `, [parsedReqBody.appointment_date, 'cancelled'])

                const existingReservations = appointmentCount.rows

                const reservationTimes = []
                for (const reservation of existingReservations) {
                    const [hours,minutes] = reservation.appointment_time.split(':').map(Number)
                    const startTime = hours * 60 + minutes
                    const endTime = startTime + reservation.booking_duration_minutes

                    reservationTimes.push({startTime, endTime})

                }

                const newReservationStart = hours * 60 + min
                const newReservationEnd = newReservationStart + selectedPackage.duration_minutes

                for(let minute = newReservationStart; minute < newReservationEnd; minute++) {
                    let activeCount = 0
                    for (const reservation of reservationTimes) {
                        if (reservation.startTime <= minute && minute < reservation.endTime)
                            activeCount += 1
                    }

                    if(activeCount >= 4) {
                        await client.query('ROLLBACK')
                        return sendJson(res, 409, {message: 'There are no more appointments available for this time frame'})
                    }
                }

//--------------






                const email = parsedReqBody.email.trim().toLowerCase()

                const customerResult = await client.query(`
                    INSERT INTO customers (
                        full_name, email, phone
                    ) VALUES (
                        $1, $2, $3
                    )
                    ON CONFLICT (email) DO NOTHING
                    RETURNING id;
                `, [
                    parsedReqBody.full_name,
                    email,
                    parsedReqBody.phone
                    ])

                let customerInfo = customerResult.rows[0]

                if (!customerInfo) {
                    const existingCustomerResult = await client.query(`
                        SELECT id
                        FROM customers
                        WHERE email = $1;
                    `, [email])

                    customerInfo = existingCustomerResult.rows[0]
                }



                //needed fields    customer_id, appointment_date, appointment_time, package_id, booking_price
                const reservationValues = [
                    customerInfo.id, 
                    parsedReqBody.appointment_date, 
                    parsedReqBody.appointment_time,
                    parsedReqBody.package_id,
                    selectedPackage.price,
                    selectedPackage.duration_minutes
                ]

                //save reservation
                const newReservation = await client.query(`
                    INSERT INTO reservations (
                        customer_id, appointment_date, appointment_time, package_id, booking_price, booking_duration_minutes
                    ) VALUES (
                     $1, $2, $3, $4, $5, $6
                    )
                     RETURNING *;
                    `, reservationValues)


                await client.query('COMMIT')

                return sendJson(res, 201, {message: 'Reservation was made successfully', reservation: newReservation.rows[0]})

            } catch (err) {
                await client.query('ROLLBACK')
                throw err
            } finally {
                client.release()
            }


    }


        return sendJson(res, 404, {message: 'URL could not be found'})

    } catch(err) {
        console.log(err)
        return sendJson(res,500, {message: 'Internal Server Error'})

    }

})

server.listen(PORT, () => console.log(`Connected on port: ${PORT}`))