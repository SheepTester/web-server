module.exports.asyncHandler = fn =>
  (req, res, next) =>
    fn(req, res, next).catch(next)

module.exports.has = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop)
