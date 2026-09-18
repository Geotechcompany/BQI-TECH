export type CandidateApplicationQuestionType =
  | "text"
  | "textarea"
  | "select"
  | "radio"
  | "boolean"
  | "file"
  | "date";

/** Shape shared by the live apply flow and wizard application preview. */
export interface CandidateApplicationQuestion {
  id: string;
  /** Backend questions often expose Mongo `_id`; either id or `_id` is accepted. */
  _id?: string;
  question: string;
  type: CandidateApplicationQuestionType;
  required: boolean;
  options?: string[];
}

export interface CandidateApplicationAnswer {
  questionId: string;
  questionText: string;
  answer: string;
}

export type CandidateApplicationFormMode = "live" | "preview";
