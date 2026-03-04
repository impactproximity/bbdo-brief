import { BriefConfig } from './types';

export const strategyConfig: BriefConfig = {
  type: {
    id: 'strategy',
    label: 'Strategic Campaign Brief',
    description: 'Create a comprehensive strategy campaign brief with objectives, audience targeting, and key messaging.',
    icon: 'Target',
    color: 'blue',
  },
  documentTitle: 'Strategy Campaign Brief',
  questions: [
    {
      id: 'brief_name',
      title: 'Campaign Name',
      prompt: 'What is the name of this campaign or brief?',
      placeholder: 'e.g., Ramadan 2026 Campaign, Q1 Product Launch...',
    },
    {
      id: 'context',
      title: 'The Context',
      prompt: 'Describe the context and situation for this campaign.',
      placeholder: 'e.g., Key points about the situation, competitive environment, relevant research or learnings...',
    },
    {
      id: 'business_objective',
      title: 'Business Objective',
      prompt: 'What is the primary business objective?',
      placeholder: 'e.g., ONE higher-order, precise, measurable goal for the business...',
    },
    {
      id: 'campaign_objective',
      title: 'Campaign Communications Objective',
      prompt: 'What is the campaign communications objective?',
      placeholder: 'e.g., ONE precise, measurable marketing goal to help achieve the business goal...',
    },
    {
      id: 'target_audience',
      title: 'Target Audience',
      prompt: 'Who is the target audience?',
      placeholder: 'e.g., Demographics, behavioral attributes, mindset...',
    },
    {
      id: 'single_minded_message',
      title: 'Single-Minded Message',
      prompt: 'What is the single most important message?',
      placeholder: 'e.g., One concise, powerful thought - what should the target take away?',
    },
    {
      id: 'reasons_to_believe',
      title: 'Reasons to Believe',
      prompt: 'What are the proof points that make our message credible?',
      placeholder: 'e.g., Substantiation points, evidence, proof that supports the message...',
    },
    {
      id: 'consumer_barriers',
      title: 'Consumer Barriers',
      prompt: 'What are the hurdles we need to overcome?',
      placeholder: 'e.g., Consumer objections, mindset barriers, competitive challenges...',
    },
    {
      id: 'assignment_deliverable',
      title: 'The Assignment & Deliverables',
      prompt: 'What are the assignment and deliverables?',
      placeholder: 'e.g., Specific deliverables, channels, formats required...',
      allowUpload: true,
    },
    {
      id: 'channel_considerations',
      title: 'Channel Considerations',
      prompt: 'What channels will be used?',
      placeholder: 'e.g., Social media, email, internal platforms, external sharing...',
    },
    {
      id: 'markets_localization',
      title: 'Markets/Localization',
      prompt: 'What markets will this campaign live in?',
      placeholder: 'e.g., Primary market: UAE, localization needs, languages...',
    },
    {
      id: 'success_criteria',
      title: 'Success Criteria/Measurement',
      prompt: 'How will success be measured?',
      placeholder: 'e.g., Qualitative and quantitative goals, KPIs, metrics...',
    },
    {
      id: 'timing_milestones',
      title: 'Timing & Key Milestones',
      prompt: 'What are the key dates and milestones?',
      placeholder: 'e.g., Deadlines, in-market date, review dates, delivery dates...',
    },
    {
      id: 'people',
      title: 'People',
      prompt: 'Who are the key people involved? Provide roles and names.',
      placeholder: 'e.g., Project Owner: John Doe, Brief Builder: Jane Smith, Approver: Sarah Johnson...',
    },
    {
      id: 'stakeholder_signoff',
      title: 'Stakeholder Sign-off',
      prompt: 'Who needs to sign off? Provide roles.',
      placeholder: 'e.g., Key Decision Maker, Head Of, Executive Director, Agency Teams...',
    },
  ],
};
