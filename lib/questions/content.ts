import { BriefConfig } from './types';

export const contentConfig: BriefConfig = {
  type: {
    id: 'content',
    label: 'Content Shoot',
    description: 'Brief a content shoot including objectives, shot lists, talent, permissions, and delivery timelines.',
    icon: 'PenTool',
    color: 'green',
  },
  documentTitle: 'Content Shoot Briefing Form',
  questions: [
    {
      id: 'brief_name',
      title: 'Brand',
      prompt: 'What is the brand name for this content shoot?',
      placeholder: 'e.g., Dubai Harbour, Kite Beach, NAIA, Five Guys...',
    },
    {
      id: 'topic',
      title: 'Topic',
      prompt: 'What is the topic or theme of this content shoot?',
      placeholder: 'e.g., Ramadan Campaign Visuals, Product Launch Shoot, Lifestyle Content...',
    },
    {
      id: 'shoot_dates',
      title: 'Shoot Date(s)',
      prompt: 'What are the planned shoot dates?',
      placeholder: 'e.g., March 15-16 2026, TBD pending location confirmation...',
    },
    {
      id: 'shoot_timings',
      title: 'Shoot Timings',
      prompt: 'What are the shoot timings?',
      placeholder: 'e.g., 6AM-6PM, golden hour 5-7PM, morning session 8-12...',
    },
    {
      id: 'shoot_location',
      title: 'Shoot Location',
      prompt: 'Where will the shoot take place?',
      placeholder: 'e.g., On-site at project, studio, outdoor location, multiple locations...',
    },
    {
      id: 'point_of_contact',
      title: 'Point of Contact',
      prompt: 'Who is the point of contact for this shoot?',
      placeholder: 'e.g., Name, role, phone number, email...',
    },
    {
      id: 'deadline_assets',
      title: 'Deadline for Assets',
      prompt: 'What are the deadlines for first draft, final delivery, approvers, and feedback turnaround?',
      placeholder: 'e.g., First draft: March 20, Final delivery: March 28, Approvers: Brand Manager, Feedback turnaround: 2 business days...',
    },
    {
      id: 'shoot_objective',
      title: 'Main Objective of the Shoot',
      prompt: 'What is the main objective of the shoot?',
      placeholder: 'e.g., Evergreen content, campaign visuals, product spotlight, event coverage...',
    },
    {
      id: 'content_type',
      title: 'Type of Content Required',
      prompt: 'What type of content is required?',
      placeholder: 'e.g., Stills, video, reels, stories, drone footage, behind-the-scenes...',
    },
    {
      id: 'shot_list',
      title: 'Shot List / Must-Capture Moments',
      prompt: 'Is there a shot list or must-capture moments?',
      placeholder: 'e.g., Hero shots, detail shots, lifestyle moments, specific angles, key scenes...',
    },
    {
      id: 'talent_props_permissions',
      title: 'Talent / Props / Permissions',
      prompt: 'Are there any talent, props, or permissions that need to be arranged?',
      placeholder: 'e.g., Models, influencers, product props, location permits, NDAs, styling requirements...',
    },
    {
      id: 'intended_usage',
      title: 'Intended Usage of Content',
      prompt: 'What is the intended usage of the content?',
      placeholder: 'e.g., Social only, PR, paid media, website, OOH, internal, other...',
    },
    {
      id: 'references',
      title: 'References',
      prompt: 'Are there any references we should follow?',
      placeholder: 'e.g., Mood boards, competitor examples, previous campaigns, style references, links...',
    },
    {
      id: 'dos_and_donts',
      title: 'Must Dos and Don\'ts',
      prompt: 'What are the must dos and don\'ts for this shoot?',
      placeholder: 'e.g., Required angles, styling guidelines, settings, brand restrictions, things to avoid...',
    },
    {
      id: 'additional_notes',
      title: 'Additional Notes',
      prompt: 'Any additional notes or information for the shoot?',
      placeholder: 'e.g., Special requirements, logistics notes, post-production preferences, any other details...',
    },
  ],
};
