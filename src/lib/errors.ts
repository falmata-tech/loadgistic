const messages: Record<string,string> = {
  INVALID_CREDENTIALS: 'The email or password is incorrect.',
  FORBIDDEN: 'You do not have permission to perform that action.',
  NOT_FOUND: 'The requested record was not found.',
  INVALID_SERVICE_MODE: 'Loadgistic currently supports Road Freight shipments only.',
  INVALID_TRACKING_MODE: 'Choose Status only or Status and approximate location.',
  INVALID_TRACKING_CODE: 'That tracking code is invalid or has expired.',
  INVALID_EMAIL: 'Enter a valid customer owner email address.',
  SHIPMENT_PARTY_EMAILS_MUST_DIFFER: 'Use a different email for the shipper and receiver.',
  INVALID_CARGO_SUMMARY: 'Describe the cargo in 3 to 500 characters.',
  INVALID_DELIVERY_DATE: 'Delivery cannot be before pickup.',
  INVALID_TRACKING_MODE_CHANGE: 'This tracking mode cannot be changed that way.',
  TRACKING_LOCATION_REQUIRED: 'The Driver device location did not resolve to a current area.',
  TRACKING_LOCATION_NOT_ENABLED: 'This shipment uses status updates. Choose the current shipment status instead.',
  TRACKING_DEVICE_LOCATION_REQUIRED: 'Approximate tracking location accepts only the assigned Driver device location.',
  ASSIGNED_DRIVER_LOCATION_REQUIRED: 'The assigned Driver must make this travel update from their workspace.',
  INVALID_APPROXIMATE_LOCATION: 'Refresh the approximate device location and try again.',
  DEVICE_LOCATION_DRIVER_ONLY: 'Only the assigned Driver may update this truck location.',
  TRACKING_ACCESS_DENIED: 'That tracking code is invalid or does not belong to this Business.',
  INVALID_DISTRIBUTION_MODE: 'Choose how this shipment should be shared.',
  INVALID_MOVEMENT_SCOPE: 'Choose Local or Long-distance routes.',
  LOCALITY_REQUIRED: 'Choose an Ethiopian city, town, or local area from the search results.',
  INVALID_LOCALITY: 'Choose a valid Ethiopian place from the search results.',
  INVALID_SERVICE_RADIUS: 'Choose an operating radius from 5 to 100 km.',
  INVALID_ETHIOPIA_POINT: 'Place pickup and drop-off pins within Ethiopia.',
  INVALID_PRICE_MODE: 'Choose a valid pricing option.',
  FIXED_PRICE_REQUIRED: 'Enter the fixed amount in Ethiopian birr.',
  TARGET_PRICE_REQUIRED: 'Enter the target amount in Ethiopian birr.',
  MISSING_REQUIRED_FIELDS: 'Complete the required fields.',
  PROVIDER_REQUIRED: 'Choose a provider for a direct request.',
  INVALID_PROVIDER: 'The selected provider is invalid.',
  BUSINESS_PARTY_REQUIRED: 'Choose the other Business from the search results.',
  EXTERNAL_PARTY_REQUIRED: 'Enter the external shipper or receiver name.',
  INVALID_BUSINESS_PARTY: 'The selected Business is invalid.',
  INVALID_ETB_AMOUNT: 'Enter a valid amount in Ethiopian birr.',
  INVALID_STATUS_TRANSITION: 'That status change is not allowed from the current status.',
  NOTE_REQUIRED: 'Enter a note before saving.',
  INVALID_VEHICLE: 'Choose one of your active vehicles.',
  SHIPMENT_VEHICLE_REQUIRED: 'Choose a truck with an assigned driver before starting this shipment.',
  CAPACITY_CONFIGURATION_REQUIRED: 'A fleet owner must configure this truck before it can return On Duty.',
  CAPACITY_DRIVER_LOCATION_REQUIRED: 'The assigned Driver must allow device location before this truck can be published.',
  CAPACITY_LOCATION_ACTIVE_REQUIRED: 'Set this truck to Empty or Partial before refreshing its public location.',
  INVALID_CAPACITY_STATUS: 'Choose Empty, Partial, or Off Duty.',
  ACCEPTED_LOADS_REQUIRED: 'Choose Full Truckload, Partial Truckload, or Both.',
  CAPACITY_AREA_REQUIRED: 'Allow the Driver device location before publishing this truck.',
  INVALID_CAPACITY_RADIUS: 'Choose a valid Service area.',
  CAPACITY_ROUTE_POINTS_REQUIRED: 'Choose two to five cities for the Capacity route.',
  CAPACITY_AREA_BOUNDARY_REQUIRED: 'Choose three to five surrounding cities for the Service area.',
  CAPACITY_PLACE_DUPLICATE: 'Choose each city only once within this route or Service area.',
  INVALID_CAPACITY_VISIBILITY: 'Choose Public or Partners.',
  INVALID_ROUTE_DATE: 'The selected travel day cannot be in the past.',
  PLANNED_SPACE_STATUS_REQUIRED: 'Choose Full or Partial cargo space for the planned route.',
  ROUTE_ENDPOINTS_REQUIRED: 'Complete both cities for the route, or leave both blank.',
  INVALID_ROUTE_INTENT: 'Choose Anywhere or Specific route.',
  FREIGHT_LOAD_TYPE_REQUIRED: 'Choose Full Truckload or Partial Truckload for this freight shipment.',
  RECEIVER_CONTACT_REQUIRED: 'Add the receiver first name and phone before assigning this shipment.',
  RECEIVER_CONTACT_NOT_READY: 'Receiver contact can be added after the shipment is agreed.',
  LOAD_PROOF_ALREADY_REQUESTED: 'Shipment proof has already been requested.',
  INVALID_INTEREST: 'Choose an interested transporter for this proof.',
  ROUTE_LOCATIONS_MUST_DIFFER: 'Origin and destination branches must be different.',
  CORRIDOR_ALREADY_EXISTS: 'That regular capacity route is already saved.',
  CAPACITY_ROUTE_ALREADY_EXISTS: 'That regular capacity route is already saved.',
  REGULAR_CAPACITY_LIMIT: 'You can publish one regular service signal. Remove it before adding another.',
  INVALID_PROOF_TYPE: 'Choose a valid proof type.',
  FILE_REQUIRED: 'Choose a file to upload.',
  FILE_TOO_LARGE: 'The file is larger than the allowed limit.',
  UNSUPPORTED_FILE_TYPE: 'Upload a JPG, PNG, WebP, or PDF file.',
  FILE_CONTENT_MISMATCH: 'The file contents do not match the selected file type.',
  PRIVATE_STORAGE_WRITE_FAILED: 'The private file could not be stored. Try again.',
  PRIVATE_STORAGE_READ_FAILED: 'The private file is temporarily unavailable.',
  NOT_DIRECT_REQUEST: 'Only a direct request can be accepted from this action.',
  DIRECT_REQUEST_NOT_PENDING: 'This direct request has already been handled.',
  INVALID_STATUS: 'Choose a valid review status.',
  APPLICATION_ALREADY_REVIEWED: 'This application already has a final review outcome.',
  PAYMENT_PROOF_ALREADY_REVIEWED: 'This payment proof already has a final review outcome.',
  INVALID_VERIFICATION_TYPE: 'Choose a verification type that matches this profile or Driver.',
  TRUCK_AUTHORIZATION_DETAILS_REQUIRED: 'Choose the authorized truck and a future expiry date.',
  VERIFICATION_DOCUMENT_REQUIRED: 'Enter the document name and attach the verification document.',
  VERIFICATION_ALREADY_SUBMITTED: 'This verification already has a pending or approved request.',
  VERIFICATION_ALREADY_REVIEWED: 'This verification request already has a final decision.',
  REVIEW_NOT_ALLOWED: 'Only the verified customer owner can review a provider within 30 days of completion.',
  REVIEW_DISPUTE_NOT_ALLOWED: 'Only one-, two-, or three-star reviews can be disputed.',
  REVIEW_ALREADY_DISPUTED: 'This review already has a dispute on record.',
  REVIEW_DISPUTE_REASON_REQUIRED: 'Explain the dispute in at least five characters.',
  ISSUE_NOTE_REQUIRED: 'Describe the shipment issue before saving.',
  PROOF_NOT_ALLOWED_FOR_STATUS: 'Proof files are accepted only for loading, unloading, or an issue.',
  INVALID_RATING: 'Choose a rating from one to five.',
  LOW_RATING_NOTE_REQUIRED: 'Add a note explaining a one-, two-, or three-star rating for administrator review.',
  REVIEW_ALREADY_SUBMITTED: 'This Business has already reviewed the other participant for this shipment.',
  INVALID_RATING_REVIEW_STATUS: 'Choose Publish or Dismiss for this rating.',
  RATING_REVIEW_NOTE_REQUIRED: 'Record an investigation note before completing this rating review.',
  RATING_ALREADY_REVIEWED: 'This rating already has a final review outcome.',
  PASSWORD_TOO_SHORT: 'Use a password with at least 10 characters.',
  EMAIL_ALREADY_EXISTS: 'An account already exists for that email.',
  INVALID_APPLICATION_TYPE: 'Choose a valid business or provider type.',
  SUBSCRIPTION_NOT_FOUND: 'No subscription is assigned to this workspace yet.',
  SUBSCRIPTION_ACCESS_REQUIRED: 'Your trial or paid access has expired. Open Plan & billing to restore access.',
  SPONSORED_ACCESS_BUSINESS_ONLY: 'Sponsored free access is available only to approved Businesses.',
  PAYMENT_NOT_REQUIRED: 'This sponsored Business does not need to submit payment.',
  INVALID_NETWORK_TARGET: 'Choose an eligible Business or transport provider.',
  INVALID_NETWORK_ACTION: 'Choose a valid network action.',
  NETWORK_RELATIONSHIP_NOT_FOUND: 'That network relationship was not found.',
  NETWORK_REQUEST_NOT_ACTIONABLE: 'That network request is no longer available.',
  ADMIN_SELF_SUSPENSION_DENIED: 'An administrator cannot suspend their own account.',
  INVALID_ADMIN_RECORD_TYPE: 'Choose a supported account or truck record.',
  INVALID_ADMIN_OPERATIONS_VIEW: 'Choose a supported platform record view.',
  INVALID_SUPPORT_CATEGORY: 'Choose what you need help with.',
  SUPPORT_MESSAGE_REQUIRED: 'Enter a message before sending.',
  SUPPORT_MESSAGE_TOO_LONG: 'Keep the support message under 2,000 characters.',
  SUPPORT_MESSAGE_RATE_LIMITED: 'Too many messages were sent. Wait a minute and try again.',
  SUPPORT_CONVERSATION_ALREADY_OPEN: 'Your current support conversation is already open.',
  SUPPORT_CONVERSATION_CLOSED: 'This support conversation is closed.',
  SUPPORT_CONVERSATION_NOT_WAITING: 'That conversation has already been assigned.',
  SUPPORT_AGENT_UNAVAILABLE: 'Set yourself available before taking another conversation.',
  SUPPORT_AGENT_AT_CAPACITY: 'Close an assigned conversation before taking another.',
  INVALID_SUPPORT_AGENT_LIMIT: 'Choose an agent limit from 1 to 20 open conversations.',
  INVALID_SUPPORT_VIEW: 'Choose Assigned, Waiting, or Closed support conversations.'
  ,INVALID_PRIVATE_CONTACT_EMAIL: 'Enter a valid email address.'
  ,INVALID_CALLBACK_PHONE: 'Enter a valid callback phone number, or leave it blank.'
  ,CALLBACK_PHONE_REQUIRED: 'Enter a callback phone number so our team can reconnect if the chat is interrupted.'
  ,SHARED_CAPACITY_ACCESS_DENIED: 'That email and one-time code could not be verified.'
  ,GUEST_CONVERSATION_ALREADY_OPEN: 'A conversation for this email is already open. Use the recovery code to return to it.'
  ,GUEST_SUPPORT_ACCESS_DENIED: 'That email and recovery code could not be verified.'
  ,GUEST_FILE_SCANNING_REQUIRED: 'File sharing is temporarily unavailable. Send the written message and our team will follow up.'
  ,FEATURED_DATE_INVALID: 'Choose a valid feature date.'
  ,FEATURED_TIKTOK_URL_INVALID: 'Enter a secure TikTok link, or leave it blank.'
  ,FEATURED_PROVIDER_REQUIRED: 'Choose at least one eligible transporter before publishing.'
  ,FEATURED_PROVIDER_DUPLICATE: 'Each transporter can appear only once per day.'
  ,FEATURED_PROVIDER_INVALID: 'One of the selected transporters is no longer based in this city or town.'
  ,FEATURED_PROVIDER_INELIGIBLE: 'One of the selected transporters no longer meets the review requirements.'
  ,FEATURED_HEADLINE_INVALID: 'Keep the featured-transporter headline between 3 and 90 characters.'
  ,FEATURED_INTRODUCTION_INVALID: 'Keep the featured-transporter introduction between 10 and 240 characters.'
  ,FEATURED_BROADCAST_TIME_INVALID: 'Choose valid livestream start and end times.'
  ,FEATURED_BROADCAST_WINDOW_INVALID: 'The livestream end time must be later than its start time.'
  ,FEATURED_SCHEDULE_MODE_INVALID: 'Choose Automatic or Manual scheduling.'
  ,FEATURED_SCHEDULE_TIME_INVALID: 'Choose valid daily schedule times.'
  ,FEATURED_SCHEDULE_WINDOW_INVALID: 'Keep both presentation sessions within 08:00–22:00 in the correct order.'
  ,FEATURED_INTERMISSION_INVALID: 'Keep exactly four hours between the morning and evening sessions.'
  ,FEATURED_TRANSITION_INVALID: 'Choose a changeover from 5 to 30 minutes.'
  ,FEATURED_SPONSOR_BREAK_FREQUENCY_INVALID: 'Schedule Sponsor breaks after every 2 to 6 transporters.'
  ,FEATURED_SPONSOR_BREAK_DURATION_INVALID: 'Choose a Sponsor break from 10 to 45 minutes.'
  ,FEATURED_PRESENTATION_DURATION_INVALID: 'Choose a target presentation from 15 to 60 minutes.'
  ,FEATURED_SCHEDULE_CAPACITY_EXCEEDED: 'These presentations and breaks do not fit inside the two daily sessions.'
  ,FEATURED_MANUAL_SCHEDULE_INVALID: 'Give every selected transporter a valid start and end time.'
  ,FEATURED_MANUAL_SCHEDULE_INCOMPLETE: 'Give every selected transporter one manual presentation interval.'
  ,FEATURED_MANUAL_SCHEDULE_OUTSIDE_SESSION: 'Manual presentations must stay entirely inside the morning or evening session.'
  ,FEATURED_MANUAL_SCHEDULE_OVERLAP: 'Manual presentation intervals cannot overlap or change roster order.'
  ,SPONSORSHIP_DATE_RANGE_INVALID: 'Choose an inclusive sponsored-placement period of no more than one year.'
  ,SPONSORSHIP_POSITION_INVALID: 'Choose sponsored position 1 through 5.'
  ,SPONSORSHIP_KIND_INVALID: 'Choose a Loadgistic transporter or an outside advertiser.'
  ,SPONSORSHIP_PROVIDER_INVALID: 'Choose an eligible transporter from this regional programme.'
  ,SPONSORSHIP_PROVIDER_INELIGIBLE: 'That transporter no longer meets the public review requirements.'
  ,SPONSOR_NAME_INVALID: 'Enter an advertiser name between 2 and 100 characters.'
  ,SPONSOR_DESCRIPTION_INVALID: 'Enter a clear advertiser description between 10 and 240 characters.'
  ,SPONSOR_WEBSITE_INVALID: 'Enter a complete HTTPS website address.'
  ,SPONSOR_CONTACT_REQUIRED: 'Add an HTTPS website or public phone number for this advertiser.'
  ,SPONSORSHIP_OVERLAP: 'That sponsor or sponsored position is already scheduled during part of this period.'
  ,SPONSORSHIP_NOT_FOUND: 'That sponsored placement no longer exists.'
  ,PROVIDER_BASE_REGION_REQUIRED: 'Choose the transporter’s region or city administration.'
  ,PROFILE_IMAGE_REQUIRED: 'Choose a transporter profile image.'
  ,PROFILE_IMAGE_TYPE_INVALID: 'Upload a JPG, PNG, or WebP transporter image.'
};

export function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  return messages[code] || messages[code.split(':')[0]] || 'Something went wrong. Please try again.';
}
