import { Application } from "../../../types/application";

// Helper function to check if a string is a UUID
export const isUUID = (str: string) => 
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);

// Helper function to search for answers by keywords
export const getAnswerByKeywords = (answers: any[], keywords: string[]): string => {
  if (!Array.isArray(answers)) return '';
  
  for (const answer of answers) {
    if (!answer?.questionText || !answer?.answer) continue;
    
    const questionText = answer.questionText.toLowerCase();
    const answerText = String(answer.answer).trim();
    
    // Skip empty answers
    if (!answerText) continue;
    
    // Check if any keyword matches
    if (keywords.some(keyword => questionText.includes(keyword.toLowerCase()))) {
      return answerText;
    }
  }
  
  return '';
};

// Enhanced data extraction function for name, email, and position
export const extractDataFromAnswers = (answers: any[], type: 'name' | 'email' | 'position', user?: any): string => {
  if (!Array.isArray(answers)) {
    // If no answers array, check if we have user data
    if (type === 'name' && user?.name) return user.name;
    if (type === 'email' && user?.email) return user.email;
    return type === 'name' ? 'No Application Data' : 'No Contact Info';
  }
  
  switch (type) {
    case 'name':
      // First check user data
      if (user?.name && user.name.trim() !== '') {
        return user.name.trim();
      }
      
      // Try various name field combinations
      const firstName = getAnswerByKeywords(answers, ['first name', 'firstname', 'given name', 'forename']);
      const lastName = getAnswerByKeywords(answers, ['last name', 'lastname', 'surname', 'family name']);
      
      // If we have both parts, combine them
      if (firstName && lastName) {
        return `${firstName} ${lastName}`.trim();
      }
      
      // Try single name fields
      const fullName = getAnswerByKeywords(answers, ['full name', 'name', 'your name', 'applicant name']);
      if (fullName) return fullName;
      
      // Try the first or last name alone if we only have one
      if (firstName) return firstName;
      if (lastName) return lastName;
      
      // Last resort: look for ANY field that might contain a name
      const possibleNameField = answers.find(a => {
        if (!a?.questionText || !a?.answer) return false;
        const question = a.questionText.toLowerCase();
        const answer = String(a.answer).trim();
        
        // Skip obvious non-name fields
        if (question.includes('email') || question.includes('phone') || 
            question.includes('position') || question.includes('experience') ||
            question.includes('cv') || question.includes('resume') ||
            answer.includes('@') || answer.length < 2) {
          return false;
        }
        
        // Look for fields that likely contain names
        return question.includes('name') || 
               (answer.length > 2 && answer.length < 50 && 
                /^[a-zA-Z\s'-]+$/.test(answer));
      });
      
      if (possibleNameField) {
        return String(possibleNameField.answer).trim();
      }
      
      return 'Incomplete Application';
      
    case 'email':
      // First check user data
      if (user?.email && user.email.trim() !== '') {
        return user.email.trim();
      }
      
      const keywords = ['email', 'e-mail', 'email address', 'contact email', 'e mail'];
      const email = getAnswerByKeywords(answers, keywords);
      
      if (email && email.includes('@')) {
        return email;
      }
      
      // Look for any field that looks like an email
      const emailField = answers.find(a => {
        const answer = String(a?.answer || '').trim();
        return answer.includes('@') && answer.includes('.');
      });
      
      return emailField ? String(emailField.answer).trim() : 'No Email Provided';
      
    case 'position':
      // First check user data
      if (user?.position && user.position.trim() !== '') {
        return user.position.trim();
      }
      
      const positionKeywords = ['position', 'job title', 'role', 'applying for', 'job', 'title'];
      const position = getAnswerByKeywords(answers, positionKeywords);
      
      if (position) {
        // Skip motivation answers that are too long or contain personal phrases
        if (position.length > 50 || 
            position.toLowerCase().includes('desire') ||
            position.toLowerCase().includes('motivation') ||
            position.toLowerCase().includes('because') ||
            position.toLowerCase().includes('passionate')) {
          return ''; // Don't use motivation as position
        }
        return position;
      }
      
      return '';
      
    default:
      return '';
  }
};

// Enhanced position extraction that handles jobId references
export const getPositionDisplay = (row: Application, jobTitles: Record<string, string>): string => {
  // Highest priority: resolved title from joined job details
  const joinedJobTitle = (row as any)?.jobDetails?.title;
  if (typeof joinedJobTitle === "string" && joinedJobTitle.trim() !== "") {
    return joinedJobTitle.trim();
  }

  // First priority: Use jobId reference system
  if (row.jobId) {
    // Support string jobId and object-shaped jobId payloads
    if (typeof row.jobId === "string") {
      const jobTitle = jobTitles[row.jobId];
      if (jobTitle) {
        return jobTitle.trim();
      }
    } else if (typeof row.jobId === "object") {
      const objectJobId = (row.jobId as any)?._id;
      const objectJobTitle = (row.jobId as any)?.title;

      if (typeof objectJobTitle === "string" && objectJobTitle.trim() !== "") {
        return objectJobTitle.trim();
      }

      if (typeof objectJobId === "string") {
        const jobTitle = jobTitles[objectJobId];
        if (jobTitle) {
          return jobTitle.trim();
        }
      }
    }
  }
  
  // Second priority: Use existing position field (cleaned)
  if (row.position && row.position.trim() !== '' && row.position !== 'NOT SET') {
    const cleanPosition = row.position.trim();
    // Skip UUIDs that don't have corresponding job titles
    if (!isUUID(cleanPosition)) {
      return cleanPosition;
    }
  }
  
  // Third priority: Extract from answers array
  const positionFromAnswers = extractDataFromAnswers(row.answers || [], 'position', row.user);
  if (positionFromAnswers && positionFromAnswers.trim() !== '') {
    return positionFromAnswers.trim();
  }
  
  return 'Position Not Available';
};

// Enhanced CV URL extraction
export const getCvUrl = (row: Application): string => {
  // First check if cvUrl field exists (older applications)
  if (row.cvUrl && row.cvUrl.trim()) {
    return row.cvUrl.trim();
  }
  
  // Fall back to extracting CV from answers array (newer applications)
  if (Array.isArray(row.answers)) {
    for (const answer of row.answers) {
      const questionText = answer.questionText?.toLowerCase() || '';
      if (questionText.includes('cv') || 
          questionText.includes('resume') || 
          questionText.includes('upload')) {
        const cvUrl = answer.answer?.toString().trim();
        if (cvUrl && cvUrl.length > 10) { // Basic validation for URL
          return cvUrl;
        }
      }
    }
  }
  
  return '';
};

// Enhanced name extraction
export const getNameDisplay = (row: Application): string => {
  // First priority: Use existing name field (cleaned)
  if (row.name && row.name.trim() !== '' && row.name !== 'NOT SET') {
    return row.name.trim();
  }
  
  // Second priority: Extract from answers array
  return extractDataFromAnswers(row.answers || [], 'name', row.user);
};

const DATE_FIELD_STATUS_MAP: Record<string, string> = {
  shortlistedDate: "Shortlisted",
  interviewDate: "Interviewing",
  hiredDate: "Hired",
  hireDate: "Hired",
  disqualifiedDate: "Disqualified",
  appliedDate: "New",
  archivedAt: "Archived",
};

/** Resolve a status-specific date from the legacy field or statusHistory. */
export const getStatusDateValue = (
  application: Application,
  dateField: string
): string | Date | null | undefined => {
  const direct = application[dateField as keyof Application];
  if (typeof direct === "string" || direct instanceof Date) return direct;

  const status = DATE_FIELD_STATUS_MAP[dateField];
  if (!status || !application.statusHistory?.length) return undefined;

  const matches = application.statusHistory
    .filter((entry) => entry.status === status && entry.date)
    .map((entry) => ({ date: entry.date, time: new Date(entry.date).getTime() }))
    .filter((entry) => !Number.isNaN(entry.time));

  if (!matches.length) return undefined;
  matches.sort((a, b) => b.time - a.time);
  return matches[0].date;
};

// Enhanced email extraction
export const getEmailDisplay = (row: Application): string => {
  // First priority: Use existing email field (cleaned)
  if (row.email && row.email.trim() !== '' && row.email !== 'NOT SET') {
    return row.email.trim();
  }
  
  // Second priority: Extract from answers array
  return extractDataFromAnswers(row.answers || [], 'email', row.user);
};
