const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(
            requestHandler(req, res, next)
        ).catch((err) => next(err))
    }
}

export {asyncHandler}



// TODO: we may need it later