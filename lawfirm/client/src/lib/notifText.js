// The server writes notifications in English. These maps translate the fixed titles and the sentence
// patterns on the client, keeping names, dates and file names exactly as the server wrote them.
const TITLES = {
  'Consultation requested': 'nt.requested', 'New consultation request': 'nt.newRequest', 'Consultation rescheduled': 'nt.rescheduled',
  'Consultation cancelled': 'nt.cancelled', 'Consultation approved': 'nt.approved', 'Consultation declined': 'nt.declined',
  'Consultation completed': 'nt.completed', 'Consultation assigned to you': 'nt.assigned', 'Consultation reassigned': 'nt.reassigned',
  'Your consultation has a new attorney': 'nt.newAttorney', 'New document': 'nt.document', 'New task assigned': 'nt.taskAssigned',
  'Task updated': 'nt.taskUpdated', 'New contact form message': 'nt.contact', 'New team member': 'nt.teamMember',
};
const BODIES = [
  [/^Your request with (.+) is awaiting approval\.$/, 'nb.requested', ['name']],
  [/^New time: (.+)\. It needs approval again\.$/, 'nb.reschedMine', ['when']],
  [/^(.+) moved their consultation to (.+)\.$/, 'nb.reschedStaff', ['name', 'when']],
  [/^(.+) cancelled the consultation on (.+)\.$/, 'nb.cancelled', ['name', 'when']],
  [/^Your consultation with (.+) on (.+) is confirmed\.$/, 'nb.approved', ['name', 'when']],
  [/^(.+) could not accept the (.+) slot\.\s*(?:Note: (.+?) )?Please book another time\.$/, 'nb.declined', ['name', 'when', 'note']],
  [/^Your consultation on (.+) is marked complete\.$/, 'nb.completed', ['when']],
  [/^(.+)'s consultation moved to (.+)\.$/, 'nb.reassigned', ['client', 'name']],
  [/^(.+) will now handle your consultation\.$/, 'nb.newAttorney', ['name']],
  [/^(.+) uploaded “(.+)”\.$/, 'nb.document', ['name', 'file']],
];
export function notifText(t, n) {
  const tk = TITLES[n.title];
  let body = n.body;
  for (const [re, key, names] of BODIES) {
    const m = String(n.body || '').match(re);
    if (!m) continue;
    const vars = Object.fromEntries(names.map((k, i) => [k, m[i + 1] || '']));
    body = t(key, vars) + (key === 'nb.declined' && vars.note ? ` ${t('nb.note', { note: vars.note })}` : '');
    break;
  }
  return { title: tk ? t(tk) : n.title, body };
}
