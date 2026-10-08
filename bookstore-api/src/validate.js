import { validationError, httpError } from './errors.js';

export { validationError };

export function assertObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(400, 'VALIDATION_ERROR', 'The request body must be a JSON object.', []);
  }
}

export function rejectClientPrice(body) {
  const sent = ['unitPrice', 'price', 'totalAmount'].filter((field) =>
    Object.prototype.hasOwnProperty.call(body, field)
  );
  if (sent.length === 0) return;

  throw httpError(
    400,
    'PRICE_NOT_ACCEPTED',
    'Price is taken from the catalog and cannot be sent by the client.',
    sent.map((field) => ({ field, message: 'Remove this field.' }))
  );
}

export function readBookId(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw validationError([{ field: 'bookId', message: 'bookId is required.' }]);
  }
  const bookId = value.trim();
  if (bookId.length > 40) {
    throw validationError([{ field: 'bookId', message: 'bookId is too long.' }]);
  }
  return bookId;
}

export function readQuantity(value) {
  if (!Number.isInteger(value) || value < 1) {
    throw validationError([
      { field: 'quantity', message: 'quantity must be a whole number greater than zero.' }
    ]);
  }
  return value;
}

export function readPrice(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw validationError([
      { field: 'price', message: 'price must be a number greater than or equal to 0.' }
    ]);
  }
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(value - rounded) > 1e-9) {
    throw validationError([
      { field: 'price', message: 'price can have at most two decimal places.' }
    ]);
  }
  return rounded;
}

export function readIdempotencyKey(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const key = String(value).trim();
  if (key.length > 200) {
    throw validationError([
      { field: 'Idempotency-Key', message: 'Idempotency-Key must be 200 characters or fewer.' }
    ]);
  }
  return key;
}

function takeAddressField(details, address, field, max, required) {
  const value = address[field];
  if (value === undefined || value === null || value === '') {
    if (required) {
      details.push({ field: `shippingAddress.${field}`, message: `${field} is required.` });
    }
    return null;
  }
  if (typeof value !== 'string') {
    details.push({ field: `shippingAddress.${field}`, message: `${field} must be a string.` });
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    if (required) {
      details.push({ field: `shippingAddress.${field}`, message: `${field} is required.` });
    }
    return null;
  }
  if (trimmed.length > max) {
    details.push({
      field: `shippingAddress.${field}`,
      message: `${field} must be ${max} characters or fewer.`
    });
    return null;
  }
  return trimmed;
}

export function readAddress(address) {
  if (!address || typeof address !== 'object' || Array.isArray(address)) {
    throw validationError([{ field: 'shippingAddress', message: 'shippingAddress is required.' }]);
  }

  const details = [];
  const normalized = {
    fullName: takeAddressField(details, address, 'fullName', 120, true),
    line1: takeAddressField(details, address, 'line1', 160, true),
    line2: takeAddressField(details, address, 'line2', 160, false),
    city: takeAddressField(details, address, 'city', 80, true),
    state: takeAddressField(details, address, 'state', 80, true),
    postalCode: takeAddressField(details, address, 'postalCode', 16, true),
    country: takeAddressField(details, address, 'country', 56, true),
    phone: takeAddressField(details, address, 'phone', 20, false)
  };

  if (details.length > 0) throw validationError(details);
  return normalized;
}

export function readText(details, body, field, max) {
  const value = body[field];
  if (typeof value !== 'string' || value.trim() === '') {
    details.push({ field, message: `${field} is required.` });
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    details.push({ field, message: `${field} must be ${max} characters or fewer.` });
    return null;
  }
  return trimmed;
}

export function readStock(details, value) {
  if (!Number.isInteger(value) || value < 0) {
    details.push({ field: 'stock', message: 'stock must be a whole number, zero or more.' });
    return null;
  }
  return value;
}
