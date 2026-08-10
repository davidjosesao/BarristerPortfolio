-- Sample briefs for viewing the staff dashboard with realistic content.
-- Party names are invented. TEST DATA ONLY — delete before going live:
--
--   delete from public.briefs where submission_id like 'SAMPLE-%';
--
-- Covers every status and urgency so each badge style is visible, and dates
-- are relative to now() so the list always looks current.

insert into public.briefs (
  submission_id, created_at, your_name, firm_name, your_email, your_phone,
  parties, court, jurisdiction, matter_type, urgency, hearing_date,
  key_facts, ai_summary, status, staff_notes
) values

('SAMPLE-001', now() - interval '3 hours',
 'Alexandra Whitmore', 'Whitmore & Associates', 'a.whitmore@example.com', '(02) 9221 4400',
 'Brightwater Developments Pty Ltd v Kellerman Constructions Pty Ltd',
 'Supreme Court of NSW', 'NSW', 'Construction', 'Immediate', current_date + 9,
 'Our client is the principal under a design and construct contract for a mixed-use development in Parramatta. The builder has purported to terminate for alleged non-payment of a progress claim of $2.4m. We say the claim was never validly made under the Security of Payment Act. An interlocutory injunction is listed for hearing next week to restrain the builder from calling on the performance bonds. We need counsel to appear and to advise on prospects.',
 E'• Principal seeks to restrain call on performance bonds following purported termination.\n• Dispute centres on validity of a $2.4m progress claim under the SOP Act.\n• Interlocutory injunction listed within 9 days — appearance required.\n• Contract is a design and construct for a Parramatta mixed-use development.\n• Advice sought on prospects in addition to the appearance.',
 'new', null),

('SAMPLE-002', now() - interval '1 day 4 hours',
 'Daniel Okonkwo', 'Harrow Legal', 'd.okonkwo@example.com', '(02) 8014 7720',
 'Renata Vasilescu v Southern Cross Logistics Pty Ltd',
 'District Court of NSW', 'NSW', 'Employment', 'Urgent', current_date + 26,
 'Our client was summarily dismissed after raising concerns about fatigue management and unpaid overtime. The employer alleges serious misconduct arising from a single incident, which our client denies. We are pursuing a general protections claim. Conciliation has failed. Seeking advice on quantum and whether to press for reinstatement.',
 E'• General protections claim following summary dismissal.\n• Employee raised fatigue management and unpaid overtime concerns before dismissal.\n• Employer alleges serious misconduct from a single disputed incident.\n• Conciliation has already failed; hearing in approximately four weeks.\n• Advice sought on quantum and viability of reinstatement.',
 'reviewed', 'Called Daniel 11/8 — sending fee agreement. Appears well within capacity.'),

('SAMPLE-003', now() - interval '4 days',
 'Priya Raghunathan', 'Raghunathan Commercial', 'p.raghunathan@example.com', null,
 'Anselm Holdings Pty Ltd v Teodoro Bianchi & Ors',
 'Federal Court of Australia', 'Federal', 'Commercial', 'Standard', current_date + 71,
 'Shareholder oppression proceedings concerning a family-owned import business. Our client holds 32% and alleges the majority has diverted opportunities to a related entity and refused to declare dividends for six years. We seek a buy-out order at a court-determined valuation. Substantial documentary discovery already completed.',
 E'• Shareholder oppression claim by a 32% minority holder in a family import business.\n• Allegations of diverted corporate opportunities to a related entity.\n• No dividends declared for six years.\n• Relief sought is a buy-out at court-determined valuation.\n• Documentary discovery is substantially complete.',
 'accepted', 'Accepted 07/8. Directions hearing diarised. Brief and annexures received in hard copy.'),

('SAMPLE-004', now() - interval '9 days',
 'Marcus Feldman', 'Feldman Dispute Lawyers', 'm.feldman@example.com', '(02) 9299 3311',
 'Estate of the late Josephine Aldritch',
 'Supreme Court of NSW', 'NSW', 'Property', 'Standard', null,
 'Family provision application by an adult child of the deceased. The estate comprises a residential property in Mosman and a modest share portfolio. The executor opposes the claim. We act for the applicant and are seeking advice on prospects before commencing.',
 E'• Family provision application by an adult child of the deceased.\n• Estate comprises a Mosman residence and a modest share portfolio.\n• Executor opposes the claim.\n• Proceedings not yet commenced — advice on prospects sought first.\n• No hearing date set.',
 'declined', 'Declined 03/8 — conflict, acted for the executor''s firm in an unrelated 2024 matter.'),

('SAMPLE-005', now() - interval '17 hours',
 'Grace Lindqvist', null, 'g.lindqvist@example.com', '0412 887 340',
 'Lindqvist v Commissioner of Police (NSW)',
 'NCAT', 'NSW', 'Administrative', 'Urgent', current_date + 15,
 'Administrative review of a firearms licence revocation. The revocation followed an apprehended violence order that was subsequently withdrawn. Our client is a primary producer and the licence is essential to her livelihood. We say the Commissioner failed to take the withdrawal into account.',
 E'• Administrative review of a firearms licence revocation before NCAT.\n• Revocation followed an AVO that was later withdrawn.\n• Applicant is a primary producer; licence is essential to her livelihood.\n• Central ground is failure to consider the AVO withdrawal.\n• Listed in approximately two weeks.',
 'new', null)

on conflict (submission_id) do nothing;
