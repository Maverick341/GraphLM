class ApiError extends Error {
    /**
     * @param {number} statusCode - HTTP status code.
     * @param {string} message - Error message.
     * @param {object} [options] - Optional fields.
     * @param {any[]} [options.errors] - Detailed error array.
     * @param {string} [options.code] - Custom machine-readable error code.
     * @param {string} [options.stack] - Stack trace override.
     */
    constructor(statusCode, message, options = {}) {
        super(message);
        this.statusCode = statusCode;
        this.success = false;
        this.message = message;
        this.code = options.code;
        this.errors = options.errors || [];

        if (options.stack) {
            this.stack = options.stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export { ApiError };


// class ApiError extends Error {
//     /**
//      * @param {number} statusCode - The HTTP status code.
//      * @param {string} message - The error message.
//      * @param {any[]} errors - Additional error details (optional).
//      * @param {string} stack - The stack trace (optional).
//      */
//     constructor(
//         statusCode,
//         message,
//         errors = [],
//         stack = ""
//     ) {
//         super(message);
//         this.statusCode = statusCode;
//         this.message = message;
//         this.success = false;
//         this.errors = errors;

//         if (stack) {
//             this.stack = stack;
//         } else {
//             Error.captureStackTrace(this, this.constructor)
//         }
//     }
// }

// export { ApiError }


