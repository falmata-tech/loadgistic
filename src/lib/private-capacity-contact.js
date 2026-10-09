// Organizer labels are private notes, never recipient identity or authority.
export function privateCapacityContactName(value) {
 if (typeof value !== 'string' || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) throw Error('CONTACT_NAME_REQUIRED');
 const name = value.trim();
 if (!name || name.length > 100) throw Error('CONTACT_NAME_REQUIRED');
 return name;
}
