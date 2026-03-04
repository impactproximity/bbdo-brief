import { BriefConfig } from './types';

export const adhocConfig: BriefConfig = {
  type: {
    id: 'adhoc',
    label: 'Ad-Hoc Post',
    description: 'Quick-turn brief for one-off social posts including objective, messaging, format, and assets.',
    icon: 'Zap',
    color: 'red',
  },
  documentTitle: 'Ad-Hoc Post Briefing Form',
  questions: [
    {
      id: 'brief_name',
      title: 'Brand',
      prompt: 'What is the brand name for this ad-hoc post?',
      placeholder: 'e.g., Dubai Harbour, Kite Beach, NAIA, Five Guys...',
    },
    {
      id: 'post_date',
      title: 'Post Date',
      prompt: 'When should this post go live?',
      placeholder: 'e.g., March 10 2026, ASAP, TBD pending approval...',
    },
    {
      id: 'post_topic',
      title: 'Post Topic',
      prompt: 'What is the topic of this post? What is the occasion, event, or reason?',
      placeholder: 'e.g., National Day, product launch, event coverage, seasonal moment, announcement...',
    },
    {
      id: 'post_objective',
      title: 'Post Objective',
      prompt: 'What is the main objective of this post?',
      placeholder: 'e.g., Awareness, engagement, announcement, traffic, lead generation...',
    },
    {
      id: 'key_message',
      title: 'Key Message / Call to Action',
      prompt: 'What is the key message or call to action?',
      placeholder: 'e.g., Register now, Save the date, Learn more, Celebrate with us...',
    },
    {
      id: 'platforms',
      title: 'Platforms',
      prompt: 'Which platform or platforms should it be published on?',
      placeholder: 'e.g., Instagram, Facebook, LinkedIn, X, TikTok, all platforms...',
    },
    {
      id: 'format_visual_direction',
      title: 'Post Format & Visual Direction',
      prompt: 'What is the required post format and visual direction?',
      placeholder: 'e.g., Video, static, carousel, story, VO, supers, animation, specific dimensions...',
    },
    {
      id: 'assets',
      title: 'Assets',
      prompt: 'Are there any assets to use or do we need to shoot?',
      placeholder: 'e.g., New asset links, existing assets, new shoot required, stock imagery...',
      allowUpload: true,
    },
    {
      id: 'organic_or_paid',
      title: 'Organic or Paid',
      prompt: 'Should this post be organic only, or is paid media considered?',
      placeholder: 'e.g., Organic only, paid boost with budget, paid campaign, TBD...',
    },
    {
      id: 'must_dos_and_donts',
      title: 'Must-Dos & Must-Don\'ts',
      prompt: 'Any must-dos or must-don\'ts for copy and visuals?',
      placeholder: 'e.g., Tone of voice, mandatory brand elements, things to avoid, hashtags, legal disclaimers...',
    },
    {
      id: 'deliverables',
      title: 'Deliverables',
      prompt: 'What are the exact deliverables needed for this post?',
      placeholder: 'e.g., 1 static post + caption, 3 story frames, 1 reel with VO, all in required platform specs...',
      allowUpload: true,
    },
    {
      id: 'additional_references',
      title: 'Additional References or Context',
      prompt: 'Any additional references or context?',
      placeholder: 'e.g., Reference posts, mood boards, competitor examples, background context...',
    },
  ],
};
