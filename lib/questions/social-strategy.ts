import { BriefConfig } from './types';

export const socialStrategyConfig: BriefConfig = {
  type: {
    id: 'social-strategy',
    label: 'Social Media Strategy',
    description: 'Define the overarching social media strategy with objectives, key metrics, and business alignment.',
    icon: 'Share2',
    color: 'cyan',
  },
  documentTitle: 'Social Media Strategy Briefing Form',
  questions: [
    {
      id: 'brief_name',
      title: 'Brand',
      prompt: 'What is the brand name for this social media strategy?',
      placeholder: 'e.g., Dubai Harbour, Kite Beach, NAIA, Five Guys...',
    },
    {
      id: 'deadline',
      title: 'Deadline',
      prompt: 'What is the deadline for this strategy? Note: allow for a minimum of seven business days.',
      placeholder: 'e.g., March 15 2026, end of Q1, ASAP...',
    },
    {
      id: 'strategy_objective',
      title: 'Main Objective of the Strategy',
      prompt: 'What is the main objective of the strategy?',
      placeholder: 'e.g., Grow brand awareness, increase engagement, drive conversions, build community...',
    },
    {
      id: 'key_metrics',
      title: 'Key Metrics',
      prompt: 'If applicable, what are the key metrics you want to focus on?',
      placeholder: 'e.g., Follower growth, engagement rate, reach, impressions, website traffic, conversions...',
    },
    {
      id: 'business_objective',
      title: 'Wider Business Objective',
      prompt: 'What is the wider business objective we are attempting to achieve through this strategy?',
      placeholder: 'e.g., Increase sales, build brand equity, launch new product, enter new market...',
    },
    {
      id: 'must_dos_and_donts',
      title: 'Must-Dos and Must-Don\'ts',
      prompt: 'If applicable, what are some must-dos and must-don\'ts?',
      placeholder: 'e.g., Platforms to prioritize, content to avoid, brand tone requirements, competitive considerations...',
    },
    {
      id: 'deliverables',
      title: 'Deliverables',
      prompt: 'What should the strategy deliverable include?',
      placeholder: 'e.g., Full strategy document, content calendar, platform recommendations, posting frequency, tone of voice guidelines...',
      allowUpload: true,
    },
    {
      id: 'additional_notes',
      title: 'Additional Notes',
      prompt: 'Is there anything else you want us to be aware of?',
      placeholder: 'e.g., Upcoming launches, market changes, internal initiatives, references, any other context...',
    },
  ],
};
