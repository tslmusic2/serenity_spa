export function hasOwnValidation(data, field, validations,res, message) {

    const hasOwn = Object.hasOwn(data, field)
                if(hasOwn) {
                    if (validations) {
                        return sendJson(res, 400, message)
                    }
                }
}