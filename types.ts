export enum Step {
  SELECT_DATE,
  SELECT_APPOINTMENT_TYPE,
  SELECT_TIME,
  USER_DETAILS,
  PAYMENT,
  CONFIRMATION,
}

export interface ConsultationOption {
  id: string;
  title: string;
  description: string;
  priceKey: string;
  defaultPrice: string;
  stripePriceId?: string;
}

export interface AppointmentDetails {
  consultation: ConsultationOption;
  price: number;
  date: Date;
  time: string;
  name: string;
  email: string;
  whatsapp: string;
  paymentMethod: string;
}

export type Availability = {
  [date: string]: string[];
};

export interface Booking {
    name: string;
    date: string; // YYYY-MM-DD
    time: string;
    consultationTitle: string;
}

export type RecurringAvailability = {
  [dayOfWeek: number]: string[]; // 0=Sun, 1=Mon, ..., 6=Sat
};

// CV Builder Types
export interface WorkExperience {
  id: string;
  jobTitle: string;
  employer: string;
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  description: string;
  isCurrent: boolean;
}

export interface Education {
  id: string;
  qualification: string;
  organisation: string;
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface LanguageSkill {
  id: string;
  language: string;
  level: string;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
}

export interface Reference {
  id: string;
  name: string;
  company: string;
  position: string;
  email: string;
  phone: string;
}

export interface CVData {
  personalInfo: {
    firstName: string;
    lastName: string;
    jobTitle: string;
    email: string;
    phone: string;
    address: string;
    photo: string | null; // Base64 string for the image
  };
  summary: string;
  workExperience: WorkExperience[];
  education: Education[];
  languageSkills: LanguageSkill[];
  skills: Skill[];
  references: Reference[];
}