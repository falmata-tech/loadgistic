const messages: Record<string,string> = {
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  FORBIDDEN: 'You do not have permission to perform that action.',
  NOT_FOUND: 'The requested record was not found.',
  INVALID_SERVICE_MODE: 'Choose parcel delivery or road freight.',
  INVALID_DISTRIBUTION_MODE: 'Choose how this shipment should be shared.',
  INVALID_PRICE_MODE: 'Choose a valid pricing option.',
  FIXED_PRICE_REQUIRED: 'Enter the fixed amount in Ethiopian birr.',
  TARGET_PRICE_REQUIRED: 'Enter the target amount in Ethiopian birr.',
  MISSING_REQUIRED_FIELDS: 'Complete the required fields.',
  PROVIDER_REQUIRED: 'Choose a provider for a direct request.',
  PARCEL_PROVIDER_REQUIRED: 'Parcel requests must be directed to a parcel delivery company.',
  INVALID_PROVIDER: 'The selected provider is invalid.',
  INVALID_STATUS_TRANSITION: 'That status change is not allowed from the current status.',
  NOTE_REQUIRED: 'Enter a note before saving.',
  INVALID_VEHICLE: 'Choose one of your active vehicles.',
  INVALID_CAPACITY_STATUS: 'Choose Empty, Partial, or Full.',
  CAPACITY_PERCENT_REQUIRED: 'Enter a whole percentage from 1 to 99 for partial capacity.',
  ROUTE_LOCATIONS_MUST_DIFFER: 'Origin and destination centers must be different.',
  INVALID_LOCATION: 'Choose centers owned by this parcel company.',
  INVALID_PROOF_TYPE: 'Choose a valid proof type.',
  FILE_REQUIRED: 'Choose a file to upload.',
  FILE_TOO_LARGE: 'The file is larger than the allowed limit.',
  UNSUPPORTED_FILE_TYPE: 'Upload a JPG, PNG, WebP, or PDF file.',
  NOT_DIRECT_REQUEST: 'Only a direct request can be accepted from this action.',
  DIRECT_REQUEST_NOT_PENDING: 'This direct request has already been handled.',
  INVALID_STATUS: 'Choose a valid review status.',
  APPLICATION_ALREADY_REVIEWED: 'This application already has a final review outcome.',
  PAYMENT_PROOF_ALREADY_REVIEWED: 'This payment proof already has a final review outcome.',
  PASSWORD_TOO_SHORT: 'Use a password with at least 10 characters.',
  EMAIL_ALREADY_EXISTS: 'An account already exists for that email.',
  INVALID_APPLICATION_TYPE: 'Choose a valid business or provider type.',
  SUBSCRIPTION_NOT_FOUND: 'No subscription is assigned to this workspace yet.'
};

export function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  return messages[code] || 'Something went wrong. Please try again.';
}
