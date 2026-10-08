export function httpError(status, code, message, details = []) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.details = details;
  return err;
}

export function validationError(details) {
  return httpError(400, 'VALIDATION_ERROR', 'The request body has invalid fields.', details);
}

// Shelf count the client can show next to the quantity field.
export function copyAvailability(available, requested) {
  if (available === 0) {
    return `This book is out of stock. You requested ${requested}.`;
  }
  if (available === 1) {
    return `Only 1 copy is available. You requested ${requested}.`;
  }
  return `Only ${available} copies are available. You requested ${requested}.`;
}

export function insufficientStock({ bookId, available, requested, message, detailMessage }) {
  return httpError(409, 'INSUFFICIENT_STOCK', message, [
    {
      field: 'quantity',
      bookId,
      message: detailMessage || copyAvailability(available, requested),
      requested,
      available
    }
  ]);
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err.type === 'entity.parse.failed') {
    res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Request body is not valid JSON.',
        status: 400,
        details: []
      }
    });
    return;
  }

  const status = Number.isInteger(err.status) ? err.status : 500;
  if (status === 500) {
    console.error(err);
  }

  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: status === 500 ? 'Something went wrong while handling the request.' : err.message,
      status,
      details: Array.isArray(err.details) ? err.details : []
    }
  });
}
