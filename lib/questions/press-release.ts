import { BriefConfig } from './types';

export const pressReleaseConfig: BriefConfig = {
  type: {
    id: 'press-release',
    label: 'Press Release',
    description: 'Brief a press release with key announcements, spokesperson quotes, target media, and visual assets.',
    icon: 'Newspaper',
    color: 'indigo',
  },
  documentTitle: 'Press Release Briefing Form',
  questions: [
    {
      id: 'brief_name',
      title: 'Brand',
      prompt: 'What is the brand name for this press release?',
      placeholder: 'e.g., Dubai Harbour, Kite Beach, NAIA, Five Guys...',
    },
    {
      id: 'topic',
      title: 'Topic',
      prompt: 'What is the topic of this press release?',
      placeholder: 'e.g., New project launch, partnership announcement, milestone achievement...',
    },
    {
      id: 'release_dates',
      title: 'Release Dates',
      prompt: 'When should the press release be distributed?',
      placeholder: 'e.g., March 15 2026, under embargo until March 20, immediate release...',
    },
    {
      id: 'release_languages',
      title: 'Release Languages',
      prompt: 'What languages is the press release needed in?',
      placeholder: 'e.g., English only, English and Arabic, multi-language...',
    },
    {
      id: 'budget',
      title: 'Budget',
      prompt: 'Is there a budget allocated for this release?',
      placeholder: 'e.g., Wire distribution budget, media event budget, N/A...',
    },
    {
      id: 'key_communication',
      title: 'Single Most Important Message',
      prompt: 'What is the single most important thing you want to communicate in the press release?',
      placeholder: 'e.g., The core announcement, the one thing media should take away...',
    },
    {
      id: 'partners',
      title: 'Partners Involved',
      prompt: 'Are there any partners involved?',
      placeholder: 'e.g., Partner organizations, co-brands, government entities, sponsors...',
    },
    {
      id: 'program_details',
      title: 'Program Details',
      prompt: 'Please share details about the program.',
      placeholder: 'e.g., What is this about, key features, scope, timeline, impact...',
    },
    {
      id: 'key_announcement',
      title: 'Key Announcement',
      prompt: 'What is the key announcement?',
      placeholder: 'e.g., The headline news, what is being launched/revealed/achieved...',
    },
    {
      id: 'target_media',
      title: 'Target Media / Audience',
      prompt: 'Who are we hoping to reach? What media outlets or audience?',
      placeholder: 'e.g., Business press, trade publications, lifestyle media, broadcast, regional vs international...',
    },
    {
      id: 'spokesperson',
      title: 'Spokesperson & Quote',
      prompt: 'Who will be the spokesperson for the quote? Provide their name, role, and what they think about the news.',
      placeholder: 'e.g., CEO: John Doe - excited about the milestone, VP Marketing: Jane Smith - impact on community...',
    },
    {
      id: 'one_sentence',
      title: 'One Sentence Through the Clutter',
      prompt: 'If you could get only one sentence through all the clutter, what would that be?',
      placeholder: 'e.g., The single most impactful sentence that captures the essence of the news...',
    },
    {
      id: 'other_points',
      title: 'Other Major Points',
      prompt: 'What other major points do we want to communicate?',
      placeholder: 'e.g., Supporting details, secondary messages, context, future plans...',
    },
    {
      id: 'numbers_sources',
      title: 'Numbers & Sources',
      prompt: 'If you would like us to include numbers, please share a report, research report, or preferred sources to refer to.',
      placeholder: 'e.g., Research reports, statistics, data points, annual reports, third-party studies...',
    },
    {
      id: 'journalist_source',
      title: 'Journalist Source',
      prompt: 'If a journalist requests for a source, what would that be?',
      placeholder: 'e.g., Approved spokesperson, PR contact, official statement, data reference...',
    },
    {
      id: 'topical_story',
      title: 'Topical Story Link',
      prompt: 'Would you like us to link any topical story with the announcement?',
      placeholder: 'e.g., Related news article, industry trend, government initiative, share link if applicable...',
    },
    {
      id: 'visual_assets',
      title: 'Visual Assets',
      prompt: 'What visual assets should accompany the release?',
      placeholder: 'e.g., High-res images, renders, headshots, logos, video, infographics...',
    },
    {
      id: 'measurement',
      title: 'Measurement',
      prompt: 'How will the success of this press release be measured?',
      placeholder: 'e.g., Media pickups, reach, sentiment, coverage targets, share of voice...',
    },
    {
      id: 'additional_notes',
      title: 'Additional Notes',
      prompt: 'Any additional notes or context?',
      placeholder: 'e.g., Sensitivities, embargo details, coordination with other teams, special requirements...',
    },
  ],
};
