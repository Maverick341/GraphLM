import { body, cookie, param, query } from "express-validator";

const userRegistrationValidator = () => {
    return [
        body('fullname')
            .trim()
            .notEmpty().withMessage("Fullname is required")
            .isAlpha().withMessage("Fullname is invalid"),
        body('email')
            .trim()
            .notEmpty().withMessage("Email is required")
            .isEmail().withMessage("Email is invalid"),
        body('username')
            .trim()
            .notEmpty().withMessage("username is required")
            .isLength({ min: 3 }).withMessage("username should be at least 3 char")
            .isLength({ max: 13 }).withMessage("username cannot exceed 13 char"),
        body('password')
            .notEmpty().withMessage("Password is required")
            .isLength({ min: 6 }).withMessage("Password should be at least 6 char")
    ]
}

const updateUserValidator = () => {
    return [
        body('fullname')
            .trim()
            .notEmpty().withMessage("Fullname is required")
            .matches(/^[a-zA-Z\s.'-]+$/).withMessage("Fullname is invalid"),
        
        body('username')
            .trim()
            .notEmpty().withMessage("username is required")
            .isLength({ min: 3 }).withMessage("username should be at least 3 char")
            .isLength({ max: 13 }).withMessage("username cannot exceed 13 char")
            .isAlphanumeric().withMessage("Username must contain only letters and numbers"),
    ]
}

const userLoginValidator = () => {
    return [
        body("email")
            .trim()
            .notEmpty().withMessage("Email is required")
            .isEmail().withMessage("Email is not valid"),
        body("password")
            .notEmpty().withMessage("Password cannot be empty.")
            .isLength({ min: 6 }).withMessage("Password should be at least 6 char")
    ];
};

const cookieBasedTokenValidator = () => {
    return [
        cookie('refreshToken')
            .exists().withMessage('Refresh token is missing')
            .isString().withMessage('Refresh token must be a string')
            // .notEmpty().withMessage('Refresh token cannot be empty'),
            ,
        cookie('accessToken')
            .optional()
            .isString().withMessage('Access token must be a string'),
    ]
}

const verifyEmailValidator = () => {
    return [
        param('token')
            .exists().withMessage('Token param is required')
            .isString().withMessage('Token must be a string')
            .isLength({ min: 40, max: 80 }) // Typical hex token length (adjust as needed)
            .withMessage('Invalid token format'),
    ]
}

const emailOnlyValidator = () => {
    return [
        body('email')
            .trim()
            .notEmpty().withMessage("Email is required")
            .isEmail().withMessage("Email is invalid"),
    ]
}

const userIdValidator = () => {
    return [
        param("userId").trim().isMongoId().withMessage("User id is invalid"),
    ];
};

const resetPasswordValidator = () => {
    return [
        param('token')
            .exists().withMessage('Token param is required')
            .isString().withMessage('Token must be a string')
            .isLength({ min: 40, max: 80 }) // Typical hex token length (adjust as needed)
            .withMessage('Invalid token format'),
        body('password')
            .exists({ checkFalsy: true }).withMessage('You must type a password'),
        body('confPassword')
            .exists({ checkFalsy: true }).withMessage('You must type a confirmation password')
            .custom((value, { req }) => value === req.body.password).withMessage("The passwords do not match"),
        // https://stackoverflow.com/questions/12548624/validate-a-password-with-express-validator
    ]
}
export { userRegistrationValidator, updateUserValidator, userLoginValidator, cookieBasedTokenValidator, verifyEmailValidator, emailOnlyValidator, userIdValidator, resetPasswordValidator };

