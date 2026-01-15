export class ApiResponse {
    constructor(statusCode, data, message = "Success") {
        this.statusCode = statusCode;
        this.message = message;
        this.data = data;
        this.success = true;

        Object.defineProperty(this, "statusCode", {
            value: statusCode,
            enumerable: false,
        });
    }
}