import { BriefConfig } from './types';

export const socialCampaignConfig: BriefConfig = {
  type: {
    id: 'social-campaign',
    label: 'Social Media Campaign',
    description: 'Brief a social media campaign with objectives, targeting, paid media, key messaging, and assets.',
    icon: 'Megaphone',
    color: 'pink',
  },
  documentTitle: 'Social Media Campaign Briefing Form',
  questions: [
    {
      id: 'brief_name',
      title: 'Brand',
      prompt: 'What is the brand name for this social media campaign?',
      placeholder: 'e.g., Dubai Harbour, Kite Beach, NAIA, Five Guys...',
    },
    {
      id: 'campaign_launch_date',
      title: 'Campaign Launch Date',
      prompt: 'When is the campaign launch date?',
      placeholder: 'e.g., March 1 2026, Ramadan start date, TBD...',
    },
    {
      id: 'duration',
      title: 'Duration',
      prompt: 'What is the duration of the campaign?',
      placeholder: 'e.g., 2 weeks, 1 month, ongoing, Ramadan period...',
    },
    {
      id: 'key_dates',
      title: 'Key Dates',
      prompt: 'Are there any key dates to be aware of?',
      placeholder: 'e.g., Launch day, mid-campaign push, end date, tentpole moments...',
    },
    {
      id: 'specific_product',
      title: 'Specific Product / Service',
      prompt: 'Is there a specific product or service this campaign is for?',
      placeholder: 'e.g., New tower launch, specific unit type, service offering, general brand...',
    },
    {
      id: 'campaign_objective',
      title: 'Campaign Objective',
      prompt: 'What is the campaign trying to achieve?',
      placeholder: 'e.g., Booking, footfall, awareness, website conversion, engagement...',
    },
    {
      id: 'target_audience',
      title: 'Target Audience',
      prompt: 'Who is the campaign targeting?',
      placeholder: 'e.g., Demographics, interests, location, behavior, existing vs new audience...',
    },
    {
      id: 'paid_media',
      title: 'Paid Media',
      prompt: 'Is paid media considered? If yes, what is the budget?',
      placeholder: 'e.g., Yes - AED 50,000, organic only, boosting strategy, platform split...',
    },
    {
      id: 'key_message',
      title: 'Key Message / Call to Action',
      prompt: 'What is the key message or call to action?',
      placeholder: 'e.g., Register now, Book a viewing, Learn more, Shop the collection...',
    },
    {
      id: 'available_assets',
      title: 'Available Assets',
      prompt: 'Are there any available assets to use or are we shooting?',
      placeholder: 'e.g., Existing photography, new shoot required, CGI renders, video footage, UGC...',
      allowUpload: true,
    },
    {
      id: 'deliverables',
      title: 'Deliverables',
      prompt: 'What are the specific deliverables required for this campaign?',
      placeholder: 'e.g., 3 feed posts, 5 stories, 1 reel, 2 paid banners, copy for each format...',
      allowUpload: true,
    },
    {
      id: 'additional_notes',
      title: 'Additional Notes',
      prompt: 'Any additional notes including references, platforms to use or avoid, and formats?',
      placeholder: 'e.g., References, platforms to use/avoid, preferred formats, mandatory inclusions, brand guidelines...',
    },
  ],
};
