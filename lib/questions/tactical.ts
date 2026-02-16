import { BriefConfig } from './types';

export const tacticalConfig: BriefConfig = {
  type: {
    id: 'tactical',
    label: 'Tactical Adaptation',
    description: 'Amend an existing strategy brief with additional tactical deliverables, specs, and messaging.',
    icon: 'Settings',
    color: 'orange',
  },
  documentTitle: 'Shamal Tactical Adaptation',
  questions: [
    {
      id: 'brief_name',
      title: 'Brand',
      prompt: 'What is the brand name for this tactical adaptation?',
      placeholder: 'e.g., Shamal Living, The Opus, Omniyat...',
    },
    {
      id: 'communications_objective',
      title: 'Communications Objective',
      prompt: 'What is the objective of this tactic? What should the target audience Think, Feel & Do?',
      placeholder: 'e.g., Think: (one sentence, first-person), Feel: (one sentence, first-person), Do: (one sentence, first-person). This should reflect the desired consumer takeaway...',
    },
    {
      id: 'deliverables_specs',
      title: 'Deliverable(s) & Specs',
      prompt: 'What are the specific deliverables, detailed specs, and file formats required?',
      placeholder: 'e.g., 3 stories (min 3 frames/max 5), image specs (1080x1920, .jpg/.png), video specs (1080x1920, .mp4/.mov, max 60s), asset tracker link...',
    },
    {
      id: 'single_minded_message',
      title: 'Single-Minded Message',
      prompt: 'What is the single most important message for this deliverable?',
      placeholder: 'e.g., One concise, powerful, singular thought — no "ands" allowed. What is the benefit/value/claim the consumer should take away? (ex: "Convince the target that...")',
    },
    {
      id: 'markets',
      title: 'Markets',
      prompt: 'In what market will this live? What are the localization needs?',
      placeholder: 'e.g., UAE, KSA, multi-market, language requirements, cultural adaptations...',
    },
    {
      id: 'call_to_action',
      title: 'Call to Action (CTA)',
      prompt: 'What is the specific action desired from the audience?',
      placeholder: 'e.g., View the menu, Book now, Register interest, Visit website, Download app...',
    },
    {
      id: 'mandatories_considerations',
      title: 'Mandatories & Considerations',
      prompt: 'What are the requirements or nuances to be considered?',
      placeholder: 'e.g., Lifestyle vs product shots, music/sound needs, VO requirements, accessibility guidelines, logo animations, brand bar, customer journey insights...',
    },
    {
      id: 'timing_milestones',
      title: 'Timing & Key Milestones',
      prompt: 'What are the key dates and milestones? Include any out-of-office dates during the project.',
      placeholder: 'e.g., Round 1 review date (soft), in-market date (hard), due to media agency for trafficking (soft), legal review rounds, final delivery date...',
    },
  ],
};
