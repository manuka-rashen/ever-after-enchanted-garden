import { useState, type FormEvent } from 'react';
import { ArrowRight, ArrowUpRight, Heart, Mail } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { invitation } from '@/lib/invitation';
import { buildRsvpDraft, type RsvpDetails } from '@/lib/rsvp-draft';

export function RsvpForm() {
  const [details,setDetails] = useState<RsvpDetails>({name:'',email:'',attendance:'yes',guests:1,dietary:''});
  const [draft,setDraft] = useState<ReturnType<typeof buildRsvpDraft>|null>(null);
  const prepare = (event:FormEvent<HTMLFormElement>) => { event.preventDefault(); setDraft(buildRsvpDraft(details,invitation)); };
  if (draft) return <div className="rsvp-draft" aria-live="polite">
    <p className="eyebrow">YOUR REPLY IS READY</p>
    <h3>Send a little love.</h3>
    <p className="form-intro">Choose WhatsApp or email, then press send in that app. Your reply has not been sent yet.</p>
    <pre className="draft-preview">{draft.message}</pre>
    <div className="draft-actions">
      <a className="gold-button" href={draft.whatsapp} target="_blank" rel="noopener noreferrer">Continue in WhatsApp <ArrowUpRight size={18}/></a>
      <a className="outline-link email-rsvp" href={draft.email}>Continue in email <Mail size={17}/></a>
    </div>
    <button className="text-button" onClick={()=>setDraft(null)}>Edit my reply</button>
    <p className="privacy-note">Replies go to the couple through the app you choose. This page does not store your details.</p>
  </div>;
  return <form onSubmit={prepare}>
    <div className="form-header"><h3>Kindly RSVP</h3><Heart size={22} strokeWidth={1}/></div>
    <p className="form-intro">Prepare a personal reply to send by WhatsApp or email.</p>
    <div className="form-grid">
      <label>Full name<input name="name" value={details.name} onChange={e=>setDetails({...details,name:e.target.value})} placeholder="Your full name" autoComplete="name" required minLength={2} maxLength={120}/></label>
      <label>Email address<input name="email" type="email" value={details.email} onChange={e=>setDetails({...details,email:e.target.value})} placeholder="you@example.com" autoComplete="email" required maxLength={254}/></label>
    </div>
    <fieldset><legend>Will you be joining us?</legend><RadioGroup value={details.attendance} onValueChange={attendance=>setDetails({...details,attendance})} className="attendance-options">
      <label className={details.attendance==='yes'?'selected':''}><RadioGroupItem value="yes" id="accept"/><span>Joyfully accept</span></label>
      <label className={details.attendance==='no'?'selected':''}><RadioGroupItem value="no" id="decline"/><span>Regretfully decline</span></label>
    </RadioGroup></fieldset>
    {details.attendance==='yes'&&<div className="form-grid">
      <label>Number of guests<input name="guests" type="number" min={1} max={6} value={details.guests} onChange={e=>setDetails({...details,guests:Number(e.target.value)})} required/><small>Including yourself · up to 6</small></label>
      <label>Dietary requirements <span className="optional">(optional)</span><input name="dietary" value={details.dietary} onChange={e=>setDetails({...details,dietary:e.target.value})} placeholder="Anything we should know?" maxLength={500}/></label>
    </div>}
    <button className="gold-button" type="submit">Prepare my RSVP <ArrowRight size={18}/></button>
    <p className="privacy-note">You will review your reply before sending it in WhatsApp or email.</p>
  </form>;
}
