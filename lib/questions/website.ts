import { BriefConfig } from './types';

export const websiteConfig: BriefConfig = {
  type: {
    id: 'website',
    label: 'Website Development',
    description: 'Brief for website amendment requests including content updates, new pages, functionality changes, and go-live requirements.',
    icon: 'Globe',
    color: 'teal',
  },
  documentTitle: 'Website Amendment Brief',
  questions: [
    {
      id: 'campaign_name',
      title: 'Offer / Campaign Name',
      prompt: 'What is the offer or campaign name to be added?',
      placeholder: 'e.g., Summer Sale 2026, Ramadan Offer, New Collection Launch...',
    },
    {
      id: 'context_objective',
      title: 'Context / Objective',
      prompt: 'Why is this change needed? What is the goal or campaign behind it?',
      placeholder: 'e.g., Drive bookings for the upcoming summer season, promote a new product line, fix broken checkout flow...',
    },
    {
      id: 'website_name_url',
      title: 'Website Name / URL',
      prompt: 'Which website does this request apply to?',
      placeholder: 'e.g., www.shamal.com, staging.brand.ae, the hotel booking portal...',
    },
    {
      id: 'placement_on_website',
      title: 'Placement on Website',
      prompt: 'Where on the website should the change appear?',
      placeholder: 'e.g., Homepage hero section, Services page booking module, Footer, Landing page header...',
    },
    {
      id: 'type_of_request',
      title: 'Type of Request',
      prompt: 'What type of website change is this? For example: content population, adding a new element or module, adding a new page, a change in functionality, a bug fix, or something else?',
      placeholder: 'e.g., Content population, Add new module, New page, Functionality change, Bug fix, Other...',
    },
    {
      id: 'request_summary',
      title: 'Request Summary',
      prompt: 'Briefly describe what you need changed or added on the website.',
      placeholder: 'e.g., Update the hero banner image and headline copy, add a new promotional banner on the homepage...',
    },
    {
      id: 'target_audience',
      title: 'Target Audience',
      prompt: 'Who is the target audience for this update? Describe who they are, what they do in the category, what they think, and their drives or barriers.',
      placeholder: 'e.g., Families planning a summer holiday, health-conscious adults aged 25–40, business travellers looking for last-minute deals...',
    },
    {
      id: 'offer_validity',
      title: 'Offer Validity',
      prompt: 'If this is time-sensitive content, what are the start and end dates of the offer?',
      placeholder: 'e.g., Starts 1 March, ends 31 March 2026, no expiry, ongoing evergreen content...',
    },
    {
      id: 'copy_heading',
      title: 'Copy Content – Heading',
      prompt: 'What is the preferred heading or spotlight copy for this update?',
      placeholder: 'e.g., "Escape to Summer", "Book Now & Save 20%", "Introducing Our New Collection"...',
    },
    {
      id: 'copy_body',
      title: 'Copy Content – Description Body',
      prompt: 'What is the preferred body copy for this update?',
      placeholder: 'e.g., Full description text, key selling points, terms and conditions snippet...',
    },
    {
      id: 'visual_assets',
      title: 'Visual Assets',
      prompt: 'Are there any images, banners, or graphics to use? Please share links or describe what is needed.',
      placeholder: 'e.g., SharePoint link to assets, new photography to be shot, existing brand imagery, specific dimensions required...',
      allowUpload: true,
    },
    {
      id: 'booking_mechanics',
      title: 'Booking Mechanics',
      prompt: 'Are there any booking links, sign-up forms, promo codes, or calls to action to include?',
      placeholder: 'e.g., Link to booking engine, promo code SUMMER26, email sign-up form, WhatsApp CTA...',
    },
    {
      id: 'tracking_requirements',
      title: 'Tracking Requirements',
      prompt: 'Is tracking required? If so, please provide UTM parameters or campaign details for GA.',
      placeholder: 'e.g., UTM source=email&medium=newsletter&campaign=summer26, no tracking needed, GA event tagging required...',
    },
    {
      id: 'deliverables',
      title: 'Deliverables',
      prompt: 'What are the specific deliverables expected from this website request?',
      placeholder: 'e.g., Updated homepage banner, new landing page, revised copy on 3 pages, functional booking widget...',
      allowUpload: true,
    },
    {
      id: 'additional_notes',
      title: 'Additional Notes or References',
      prompt: 'Any other details, references, or context we should know about?',
      placeholder: 'e.g., Reference websites, mood board links, brand guidelines, legal disclaimers, accessibility requirements...',
    },
    {
      id: 'go_live_date',
      title: 'Requested Go-Live Date',
      prompt: 'When would you like this update to go live on the website?',
      placeholder: 'e.g., 1 March 2026, ASAP, by end of week, flexible...',
    },
    {
      id: 'point_of_contact',
      title: 'Point of Contact',
      prompt: 'Who should we reach out to if we have questions about this request?',
      placeholder: 'e.g., Jane Smith, jane@brand.com, +971 50 000 0000...',
    },
  ],
};
