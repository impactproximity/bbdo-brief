export interface Question {
  id: string;
  title: string;
  prompt: string;
  placeholder: string;
  allowUpload?: boolean;
}

export interface BriefType {
  id: string;
  label: string;
  description: string;
  icon: string;
  color: string;
}

export interface BriefConfig {
  type: BriefType;
  questions: Question[];
  documentTitle: string;
}

export interface QuestionResponse {
  questionId: string;
  userInput: string;
  enhancedResponse: string;
}
