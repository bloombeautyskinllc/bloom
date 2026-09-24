export type Faq = { question: string; answer: string };

// Only the first answer comes from the Figma design. The rest are DRAFTS
// written as placeholders: have the BLOOM team review them before launch.
export const faqs: Faq[] = [
  {
    question: 'Do I need to book in advance?',
    answer:
      "We recommend booking a few days ahead, especially for micropigmentation and weekend appointments. If you need something sooner, message us on WhatsApp and we'll check for openings.",
  },
  {
    question: 'Which treatment is right for me?',
    answer:
      "That's exactly what your skin consultation is for. We assess your skin, listen to your goals and recommend a personalized plan, so you never have to guess from a menu.",
  },
  {
    question: 'How long do appointments take?',
    answer:
      'It depends on the treatment. Most facials take 60 to 90 minutes, laser sessions are usually quicker, and micropigmentation appointments can take longer. We confirm the exact time when you book.',
  },
  {
    question: 'Is diode laser safe for my skin type?',
    answer:
      'Diode laser is suitable for a wide range of skin types. Before your first session we review your skin and history to confirm it is right for you and adjust the settings to your skin.',
  },
  {
    question: 'Are treatments personalized?',
    answer:
      'Always. Every protocol at BLOOM starts with a diagnosis, and each session is adapted to what your skin needs that day.',
  },
  {
    question: 'How should I prepare for my appointment?',
    answer:
      "After booking you'll receive preparation and aftercare guidance for your treatment. Please complete the client intake form before your visit and arrive a few minutes early.",
  },
  {
    question: 'How do I book?',
    answer:
      'You can book your skin consultation online in a few steps, or message us on WhatsApp and a specialist will help you find the right time.',
  },
];
