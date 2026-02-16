import { BriefConfig } from './types';

export const brandConfig: BriefConfig = {
  type: {
    id: 'brand',
    label: 'Brand Positioning',
    description: 'Define brand positioning, DNA, target audience, unique value, and strategic direction for branding initiatives.',
    icon: 'Gem',
    color: 'purple',
  },
  documentTitle: 'Brand Positioning Alignment Brief',
  questions: [
    {
      id: 'brief_name',
      title: 'Project Name',
      prompt: 'What is the name of this brand positioning project?',
      placeholder: 'e.g., New Residential Brand Launch, Hotel Brand Repositioning...',
    },
    {
      id: 'context',
      title: 'The Context',
      prompt: 'Describe the context and situation for this brand positioning initiative.',
      placeholder: 'e.g., Key points about the situation, referencing research/stats/learnings, competitive environment & future, relevant context...',
    },
    {
      id: 'project_information',
      title: 'Project Information',
      prompt: 'Provide key project information.',
      placeholder: 'e.g., Project name, product type (BTS, BTL, retail complex, destination, F&B, L&E etc.), location, timeline, new brand or extension of brand...',
    },
    {
      id: 'business_objective',
      title: 'Business Objective & Vision',
      prompt: 'What are the business objectives and vision for this brand?',
      placeholder: 'e.g., What are we trying to achieve, what impact will this have, what does success look like for the project and brand...',
    },
    {
      id: 'branding_approach',
      title: 'Required Branding Approach',
      prompt: 'What branding approach is required?',
      placeholder: 'e.g., Brand positioning for new brand, brand re-positioning, brand re-vitalization, brand re-branding...',
    },
    {
      id: 'market_research',
      title: 'Market Research',
      prompt: 'Share internal market research insights covering consumers, competitive landscape, and company considerations.',
      placeholder: 'e.g., Consumer needs/behaviors/jobs to be done, feature/benefit/value claims, competitive vertical & horizontal positioning, perceptual map, brand feasibility & authenticity...',
    },
    {
      id: 'target_audience',
      title: 'Target Audience',
      prompt: 'Who is the target audience? Segment for whom, for when, and for where.',
      placeholder: 'e.g., Who are they, what they do in category, what they think, their drives/barriers, value perception map...',
    },
    {
      id: 'unique_selling_points',
      title: 'Unique Selling Points',
      prompt: 'What are the unique selling points and value the brand offers?',
      placeholder: 'e.g., Economic, functional, experiential and/or social value, why consumers should engage, how we stand out, reasons to believe with evidence...',
    },
    {
      id: 'brand_personality',
      title: 'Brand Personality',
      prompt: 'What is the brand personality?',
      placeholder: 'e.g., Choose from the 5 codes: Sincerity, Excitement, Competence, Sophistication, Ruggedness...',
    },
    {
      id: 'strategic_positioning',
      title: 'Strategic Positioning',
      prompt: 'What is the strategic positioning statement?',
      placeholder: 'e.g., For (target market), brand X is the only brand among all (competitive set) that (unique value claim) because (reasons to believe). Rational or emotional statement...',
    },
    {
      id: 'assignment_deliverables',
      title: 'The Assignment & Deliverables',
      prompt: 'What are the required deliverables?',
      placeholder: 'e.g., Brand DNA, Brand Positioning, Target Audience, USPs, Brand Promise, Brand Values, Brand Purpose, Brand Vision, Brand Codes, Brand Name, Identity, Operationalization, Messaging/Comms Matrix, Measurement...',
    },
    {
      id: 'budget',
      title: 'Budget',
      prompt: 'What is the budget for this project?',
      placeholder: 'e.g., Total budget allocation, phasing if applicable...',
    },
    {
      id: 'success_criteria',
      title: 'Success Criteria / Measurement',
      prompt: 'What are the measures of success and expectations?',
      placeholder: 'e.g., Qualitative and quantitative goals, key performance indicators (KPIs)...',
    },
    {
      id: 'timing_milestones',
      title: 'Timing & Key Milestones',
      prompt: 'What are the key dates and milestones?',
      placeholder: 'e.g., Soft/hard deadlines, desired in-market date, stakeholder review date, final delivery date...',
    },
    {
      id: 'key_considerations',
      title: 'Key Considerations',
      prompt: 'Are there any key considerations to be aware of?',
      placeholder: 'e.g., Project milestones, additional sign-off processes, urgent deadlines, project implications...',
    },
    {
      id: 'people',
      title: 'RASCI',
      prompt: 'Who are the key people involved? Provide roles and names using RASCI.',
      placeholder: 'e.g., R (Responsible - executes work): Name, A (Accountable - owner/decision-maker): Name, S (Support): Name, C (Consulted): Name, I (Informed): Name...',
    },
  ],
};
