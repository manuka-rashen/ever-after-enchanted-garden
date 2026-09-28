export type RsvpDetails = { name: string; email: string; attendance: string; guests: number; dietary: string };
export function buildRsvpDraft(details: RsvpDetails, contact: {whatsapp:string; email:string}) {
  const message = [
    'RSVP · Kavindu & Methmi · 28 November 2027',
    `Name: ${details.name.trim()}`,
    `Email: ${details.email.trim()}`,
    `Attendance: ${details.attendance === 'yes' ? 'Joyfully accept' : 'Regretfully decline'}`,
    ...(details.attendance === 'yes' ? [`Guests (including myself): ${details.guests}`, ...(details.dietary.trim() ? [`Dietary requirements: ${details.dietary.trim()}`] : [])] : []),
    '', 'With love and best wishes.'
  ].join('\n');
  return {
    message,
    whatsapp: `https://wa.me/${contact.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`,
    email: `mailto:${contact.email}?subject=${encodeURIComponent('Wedding RSVP · Kavindu & Methmi')}&body=${encodeURIComponent(message)}`
  };
}
