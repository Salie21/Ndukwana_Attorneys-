export const FIRM = {
  name: 'Ndukwana Attorneys',
  tagline: 'Bespoke legal solutions for every client',
  address: '23 Loveday Street, 108 Howard House, Marshalltown, Johannesburg',
  phones: ['+27 79 628 7607', '+27 10 109 5684'],
  email: 'info@ndukwanainc.co.za',
  whatsapp: import.meta.env.VITE_WHATSAPP || '27796287607',
  socials: [
    { id: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/ndukwanaattorneys' },
    { id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/ndukwanainc/' },
    { id: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@ndukwanaattorneys_' },
  ],
};
export const telHref = (p) => `tel:${p.replace(/\s+/g, '')}`;
export const waHref = (text = 'Hello Ndukwana Attorneys, I would like to enquire about a consultation.') =>
  `https://wa.me/${FIRM.whatsapp}?text=${encodeURIComponent(text)}`;

export const CASE_TYPES = [
  { id: 'estate', label: 'Estate planning & administration', hint: 'Wills, deceased estates, trusts' },
  { id: 'corporate', label: 'Corporate & commercial law', hint: 'Contracts, governance, compliance' },
  { id: 'conveyancing', label: 'Conveyancing & property transfers', hint: 'Buying, selling, transferring property' },
  { id: 'labour', label: 'Labour & employment disputes', hint: 'Dismissals, CCMA, workplace matters' },
  { id: 'litigation', label: 'Litigation & disputes', hint: 'Civil and property disputes' },
  { id: 'drafting', label: 'Agreements, legal opinions & FICA', hint: 'Drafting, opinions, compliance' },
  { id: 'other', label: 'Other / not sure yet', hint: 'Tell us more in the description' },
];
export const caseLabel = (id) => CASE_TYPES.find((c) => c.id === id)?.label ?? id;
