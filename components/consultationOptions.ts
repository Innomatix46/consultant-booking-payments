import { ConsultationOption } from '../types';

// ===================================================================================
// !! IMPORTANT FOR LIVE PAYMENTS !!
// These are FAKE placeholder Price IDs for testing purposes only.
// To accept real payments, you MUST replace these values with your actual Price IDs
// from your Stripe Dashboard.
//
// How to get your Price IDs:
// 1. Log in to your Stripe Dashboard.
// 2. Go to the "Products" section.
// 3. Create a Product for each service (e.g., "Degree Recognition").
// 4. Create a Price for that Product (e.g., 50 EUR, one-time).
// 5. Copy the Price ID (it looks like 'price_1P5bZgP0OXBFDAIs...') and paste it here.
// ===================================================================================

export const CONSULTATION_OPTIONS: ConsultationOption[] = [
  {
    id: 'degree_recognition',
    title: 'Degree Recognition (ZAB)',
    description: 'Support for the recognition of your school/university degrees via the Central Office for Foreign Education (ZAB).',
    priceKey: 'degreeRecognitionPrice',
    defaultPrice: '50',
    stripePriceId: 'price_1P5bZgP0OXBFDAIsFAKE01', // <-- REPLACE ME
  },
  {
    id: 'integration_course',
    title: 'Integration Course Application',
    description: 'We help you apply for a government-funded integration course to learn German and integrate successfully.',
    priceKey: 'integrationCoursePrice',
    defaultPrice: '30',
    stripePriceId: 'price_1P5bZgP0OXBFDAIsFAKE02', // <-- REPLACE ME
  },
  {
    id: 'study_apprenticeship',
    title: 'CV & Application Letter Service',
    description: 'Professional CV, motivation Letter and Cover letter tailored to fit your professional job market.',
    priceKey: 'studyApprenticeshipPrice',
    defaultPrice: '50',
    stripePriceId: 'price_1P5bZgP0OXBFDAIsFAKE03', // <-- REPLACE ME
  },
  {
    id: 'visa_extension',
    title: 'Visa & Residence Permit',
    description: 'General consultation on all questions regarding visa applications, extensions, and residence permits.',
    priceKey: 'visaExtensionPrice',
    defaultPrice: '40',
    stripePriceId: 'price_1P5bZgP0OXBFDAIsFAKE04', // <-- REPLACE ME
  },
];