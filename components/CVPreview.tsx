import React from 'react';
import { CVData } from '../types';
import { UserIcon } from './IconComponents';

interface CVPreviewProps {
    data: CVData;
    template: string;
    language: 'en' | 'de';
}

const translations = {
    en: {
        personalDetails: 'Personal Details',
        address: 'Address:',
        phone: 'Phone:',
        email: 'Email:',
        skills: 'Skills',
        languages: 'Languages',
        summary: 'Professional Summary',
        workExperience: 'Work Experience',
        professionalExperience: 'Professional Experience',
        education: 'Education',
        references: 'References',
        present: 'Present',
        referencesDefault: 'Available upon request',
        yourJobTitle: 'Your Job Title',
        firstName: 'First Name',
        lastName: 'Last Name',
        qualification: 'Qualification',
        organisation: 'Organisation',
        jobTitle: 'Job Title',
        employer: 'Employer',
        city: 'City',
        country: 'Country',
        language: 'Language',
        completed: 'Completed',
        ongoing: 'Ongoing'
    },
    de: {
        personalDetails: 'Persönliche Daten',
        address: 'Adresse:',
        phone: 'Telefon:',
        email: 'E-Mail:',
        skills: 'Kenntnisse',
        languages: 'Sprachen',
        summary: 'Berufliches Profil',
        workExperience: 'Berufserfahrung',
        professionalExperience: 'Berufserfahrung',
        education: 'Ausbildung',
        references: 'Referenzen',
        present: 'Heute',
        referencesDefault: 'Auf Anfrage erhältlich',
        yourJobTitle: 'Ihre Berufsbezeichnung',
        firstName: 'Vorname',
        lastName: 'Nachname',
        qualification: 'Qualifikation',
        organisation: 'Organisation',
        jobTitle: 'Berufsbezeichnung',
        employer: 'Arbeitgeber',
        city: 'Stadt',
        country: 'Land',
        language: 'Sprache',
        completed: 'Abgeschlossen',
        ongoing: 'Laufend'
    },
};

const formatDate = (dateString: string, language: 'en' | 'de', format: 'short' | 'long' = 'long') => {
    if (!dateString) return '';
    const [year, month] = dateString.split('-');
    const date = new Date(Number(year), Number(month) - 1);
    const locale = language === 'de' ? 'de-DE' : 'en-US';

    if (format === 'short') {
        return date.toLocaleString(locale, { month: 'short', year: 'numeric' });
    }
    return date.toLocaleString(locale, { month: 'long', year: 'numeric' });
};

const groupSkillsByCategory = (skills: CVData['skills']) => {
    return skills.reduce((acc, skill) => {
        const category = skill.category || 'Other';
        if (!acc[category]) {
            acc[category] = [];
        }
        if (skill.name) { // Only add if skill has a name
          acc[category].push(skill);
        }
        return acc;
    }, {} as Record<string, typeof skills>);
};


// ===================================
//         CLASSIC TEMPLATE
// ===================================
const ClassicTemplate: React.FC<{ data: CVData; language: 'en' | 'de' }> = ({ data, language }) => {
    const { personalInfo, summary, workExperience, education, languageSkills, skills, references } = data;
    const groupedSkills = groupSkillsByCategory(skills);
    const t = translations[language];

    return (
        <div className="p-8 font-sans text-sm text-gray-800 bg-white min-h-[297mm]">
            <header className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-4xl font-bold text-brand-dark">
                        {personalInfo.firstName || t.firstName} {personalInfo.lastName || t.lastName}
                    </h1>
                    <p className="text-xl text-brand-blue font-semibold">{personalInfo.jobTitle || t.yourJobTitle}</p>
                </div>
                {personalInfo.photo && (
                    <div className="w-32 h-32 bg-gray-200 rounded-md flex items-center justify-center shrink-0">
                        <img src={personalInfo.photo} alt="Profile" className="w-full h-full object-cover rounded-md" />
                    </div>
                )}
            </header>

            <div className="flex flex-row">
                {/* Left Column */}
                <aside className="w-1/3 pr-8">
                     <section>
                        <h2 className="text-lg font-bold text-brand-blue border-b-2 border-brand-blue pb-1 mb-2">
                            {t.personalDetails}
                        </h2>
                        <ul className="space-y-1 text-xs">
                            {personalInfo.address && <li><p className="font-semibold">{t.address}</p><p>{personalInfo.address}</p></li>}
                            {personalInfo.phone && <li className="pt-1"><p className="font-semibold">{t.phone}</p><p>{personalInfo.phone}</p></li>}
                            {personalInfo.email && <li className="pt-1"><p className="font-semibold">{t.email}</p><p>{personalInfo.email}</p></li>}
                        </ul>
                    </section>

                    {skills.length > 0 && Object.keys(groupedSkills).length > 0 && (
                        <section className="mt-6">
                            <h2 className="text-lg font-bold text-brand-blue border-b-2 border-brand-blue pb-1 mb-2">
                                {t.skills}
                            </h2>
                            {Object.entries(groupedSkills).map(([category, skillsInCategory]) => (
                                <div key={category} className="mb-2">
                                    <h3 className="font-semibold text-sm">{category}</h3>
                                    <p className="text-xs">
                                        {skillsInCategory.map(s => s.name).join(', ')}
                                    </p>
                                </div>
                            ))}
                        </section>
                    )}

                    {languageSkills.length > 0 && languageSkills.some(s => s.language) && (
                        <section className="mt-6">
                            <h2 className="text-lg font-bold text-brand-blue border-b-2 border-brand-blue pb-1 mb-2">
                                {t.languages}
                            </h2>
                            <ul className="space-y-1">
                                {languageSkills.map(skill => (
                                    skill.language && <li key={skill.id}>
                                        <span className="font-semibold">{skill.language}:</span> {skill.level}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </aside>

                {/* Right Column */}
                <main className="w-2/3">
                    {summary && (
                        <section className="mb-6">
                            <h2 className="text-lg font-bold text-brand-blue border-b-2 border-brand-blue pb-1 mb-2">
                                {t.summary}
                            </h2>
                            <p className="text-justify whitespace-pre-wrap">{summary}</p>
                        </section>
                    )}

                    {workExperience.length > 0 && workExperience.some(e => e.jobTitle) && (
                        <section className="mb-6">
                            <h2 className="text-lg font-bold text-brand-blue border-b-2 border-brand-blue pb-1 mb-2">
                                {t.workExperience}
                            </h2>
                            <div className="space-y-4">
                                {workExperience.map(exp => (
                                    exp.jobTitle && <div key={exp.id}>
                                        <h3 className="text-md font-bold">{exp.jobTitle}</h3>
                                        <p className="font-semibold text-brand-dark">{exp.employer || t.employer} | {exp.city || t.city}, {exp.country || t.country}</p>
                                        <p className="text-xs text-gray-500 mb-1">
                                            {formatDate(exp.startDate, language)} - {exp.isCurrent ? t.present : formatDate(exp.endDate, language)}
                                        </p>
                                        <p className="whitespace-pre-wrap text-sm">{exp.description}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                     {education.length > 0 && education.some(e => e.qualification) && (
                        <section className="mb-6">
                            <h2 className="text-lg font-bold text-brand-blue border-b-2 border-brand-blue pb-1 mb-2">
                                {t.education}
                            </h2>
                            <div className="space-y-4">
                                {education.map(edu => (
                                    edu.qualification && <div key={edu.id}>
                                        <h3 className="text-md font-bold">{edu.qualification}</h3>
                                        <p className="font-semibold text-brand-dark">{edu.organisation || t.organisation} | {edu.city || t.city}, {edu.country || t.country}</p>
                                         <p className="text-xs text-gray-500 mb-1">
                                            {formatDate(edu.startDate, language)} - {edu.isCurrent ? t.present : formatDate(edu.endDate, language)}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {references.length > 0 && references.some(r => r.name) && (
                        <section>
                            <h2 className="text-lg font-bold text-brand-blue border-b-2 border-brand-blue pb-1 mb-2">
                                {t.references}
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                {references.map(ref => (
                                    ref.name && <div key={ref.id}>
                                        <p className="font-semibold">{ref.name}</p>
                                        <p className="text-xs">{ref.position}, {ref.company}</p>
                                        <p className="text-xs">{ref.email}</p>
                                        {ref.phone && <p className="text-xs">{ref.phone}</p>}
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </main>
            </div>
        </div>
    );
};


// ===================================
//         MODERN TEMPLATE
// ===================================
const ModernTemplate: React.FC<{ data: CVData; language: 'en' | 'de' }> = ({ data, language }) => {
    const { personalInfo, summary, workExperience, education, languageSkills, skills, references } = data;
    const groupedSkills = groupSkillsByCategory(skills);
    const t = translations[language];
    
    return (
        <div className="p-8 font-sans text-gray-800 bg-white min-h-[297mm]">
            <header className="text-center mb-10 pb-6 border-b-2 border-gray-200">
                {personalInfo.photo && (
                    <div className="w-28 h-28 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                        <img src={personalInfo.photo} alt="Profile" className="w-full h-full object-cover rounded-full" />
                    </div>
                )}
                <h1 className="text-4xl font-bold text-brand-dark">
                    {personalInfo.firstName || t.firstName} {personalInfo.lastName || t.lastName}
                </h1>
                 <p className="text-xl text-gray-600 uppercase tracking-wider mt-1">{personalInfo.jobTitle || t.yourJobTitle}</p>
                <div className="mt-2 text-sm text-gray-500 flex justify-center items-center flex-wrap gap-x-4 gap-y-1">
                    {personalInfo.address && <span>{personalInfo.address}</span>}
                    {personalInfo.phone && <span>{personalInfo.phone}</span>}
                    {personalInfo.email && <span>{personalInfo.email}</span>}
                </div>
            </header>

            <main className="space-y-6">
                {summary && (
                    <section>
                        <h2 className="text-xl font-bold text-brand-blue pb-1 mb-3 uppercase tracking-wider">{t.summary}</h2>
                        <p className="text-justify whitespace-pre-wrap text-sm">{summary}</p>
                    </section>
                )}
                {workExperience.length > 0 && workExperience.some(e => e.jobTitle) && (
                    <section>
                        <h2 className="text-xl font-bold text-brand-blue pb-1 mb-3 uppercase tracking-wider">{t.workExperience}</h2>
                        <div className="space-y-4">
                            {workExperience.map(exp => (
                                exp.jobTitle && <div key={exp.id}>
                                    <div className="flex justify-between items-baseline">
                                        <h3 className="text-md font-bold">{exp.jobTitle}</h3>
                                        <p className="text-xs text-gray-500 font-medium">
                                            {formatDate(exp.startDate, language)} - {exp.isCurrent ? t.present : formatDate(exp.endDate, language)}
                                        </p>
                                    </div>
                                    <p className="font-semibold text-brand-dark text-sm">{exp.employer || t.employer} | {exp.city || t.city}</p>
                                    <p className="whitespace-pre-wrap text-sm mt-1">{exp.description}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
                {education.length > 0 && education.some(e => e.qualification) && (
                     <section>
                        <h2 className="text-xl font-bold text-brand-blue pb-1 mb-3 uppercase tracking-wider">{t.education}</h2>
                        <div className="space-y-4">
                            {education.map(edu => (
                                edu.qualification && <div key={edu.id}>
                                     <div className="flex justify-between items-baseline">
                                        <h3 className="text-md font-bold">{edu.qualification}</h3>
                                        <p className="text-xs text-gray-500 font-medium">
                                            {formatDate(edu.startDate, language)} - {edu.isCurrent ? t.present : formatDate(edu.endDate, language)}
                                        </p>
                                    </div>
                                    <p className="font-semibold text-brand-dark text-sm">{edu.organisation || t.organisation} | {edu.city || t.city}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
                {skills.length > 0 && Object.keys(groupedSkills).length > 0 && (
                    <section>
                        <h2 className="text-xl font-bold text-brand-blue pb-1 mb-3 uppercase tracking-wider">{t.skills}</h2>
                        <div className="space-y-2">
                             {Object.entries(groupedSkills).map(([category, skillsInCategory]) => (
                                <div key={category}>
                                    <h3 className="font-semibold">{category}</h3>
                                    <p className="text-sm">
                                        {skillsInCategory.map(s => s.name).join(' • ')}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
                {languageSkills.length > 0 && languageSkills.some(s => s.language) && (
                    <section>
                        <h2 className="text-xl font-bold text-brand-blue pb-1 mb-3 uppercase tracking-wider">{t.languages}</h2>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {languageSkills.map(skill => (
                                skill.language && <div key={skill.id}>
                                    <span className="font-semibold">{skill.language}:</span> {skill.level}
                                </div>
                            ))}
                        </div>
                    </section>
                )}
                 {references.length > 0 && references.some(r => r.name) && (
                    <section>
                        <h2 className="text-xl font-bold text-brand-blue pb-1 mb-3 uppercase tracking-wider">{t.references}</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {references.map(ref => (
                                ref.name && <div key={ref.id}>
                                    <p className="font-semibold">{ref.name}</p>
                                    <p className="text-sm">{ref.position}, {ref.company}</p>
                                    <p className="text-sm text-gray-600">{ref.email}{ref.phone && ` | ${ref.phone}`}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
};

// ===================================
//         COMPACT TEMPLATE
// ===================================
const CompactTemplate: React.FC<{ data: CVData; language: 'en' | 'de' }> = ({ data, language }) => {
     const { personalInfo, summary, workExperience, education, languageSkills, skills, references } = data;
     const groupedSkills = groupSkillsByCategory(skills);
     const t = translations[language];

    return (
        <div className="p-6 font-sans text-xs text-gray-800 bg-white min-h-[297mm]">
            <header className="text-center mb-4 pb-2 border-b">
                 <h1 className="text-3xl font-bold text-brand-dark">
                    {personalInfo.firstName || t.firstName} {personalInfo.lastName || t.lastName}
                </h1>
                <p className="text-lg font-semibold text-gray-700">{personalInfo.jobTitle || t.yourJobTitle}</p>
                <div className="text-gray-600 flex justify-center flex-wrap gap-x-3">
                    {personalInfo.address && <span>{personalInfo.address}</span>}
                    {personalInfo.phone && <span>{personalInfo.phone}</span>}
                    {personalInfo.email && <span>{personalInfo.email}</span>}
                </div>
            </header>

            <main className="space-y-4">
                {summary && (
                    <section>
                        <h2 className="text-sm font-bold uppercase text-brand-blue tracking-wider mb-1">{t.summary}</h2>
                        <p className="whitespace-pre-wrap">{summary}</p>
                    </section>
                )}
                 {workExperience.length > 0 && workExperience.some(e => e.jobTitle) && (
                    <section>
                        <h2 className="text-sm font-bold uppercase text-brand-blue tracking-wider mb-1">{t.workExperience}</h2>
                        <div className="space-y-2">
                            {workExperience.map(exp => (
                                exp.jobTitle && <div key={exp.id}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-sm">{exp.jobTitle}</h3>
                                            <p className="font-semibold text-brand-dark">{exp.employer || t.employer} | {exp.city || t.city}</p>
                                        </div>
                                        <p className="text-gray-500 text-right shrink-0 ml-4">
                                            {formatDate(exp.startDate, language, 'short')} - {exp.isCurrent ? t.present : formatDate(exp.endDate, language, 'short')}
                                        </p>
                                    </div>
                                    <p className="whitespace-pre-wrap mt-0.5">{exp.description}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
                 {education.length > 0 && education.some(e => e.qualification) && (
                     <section>
                        <h2 className="text-sm font-bold uppercase text-brand-blue tracking-wider mb-1">{t.education}</h2>
                        <div className="space-y-2">
                            {education.map(edu => (
                                edu.qualification && <div key={edu.id} className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-sm">{edu.qualification}</h3>
                                        <p className="font-semibold text-brand-dark">{edu.organisation || t.organisation} | {edu.city || t.city}</p>
                                    </div>
                                     <p className="text-gray-500 text-right shrink-0 ml-4">
                                        {formatDate(edu.startDate, language, 'short')} - {edu.isCurrent ? t.present : formatDate(edu.endDate, language, 'short')}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
                 {skills.length > 0 && Object.keys(groupedSkills).length > 0 && (
                    <section>
                        <h2 className="text-sm font-bold uppercase text-brand-blue tracking-wider mb-1">{t.skills}</h2>
                        {Object.entries(groupedSkills).map(([category, skillsInCategory]) => (
                            <p key={category} className="mb-1">
                                <span className="font-semibold">{category}:</span> {skillsInCategory.map(s => s.name).join(', ')}
                            </p>
                        ))}
                    </section>
                )}
                {languageSkills.length > 0 && languageSkills.some(s => s.language) && (
                    <section>
                        <h2 className="text-sm font-bold uppercase text-brand-blue tracking-wider mb-1">{t.languages}</h2>
                        <p>{languageSkills.filter(s => s.language).map(s => `${s.language} (${s.level})`).join(' | ')}</p>
                    </section>
                )}
                {references.length > 0 && references.some(r => r.name) && (
                    <section>
                        <h2 className="text-sm font-bold uppercase text-brand-blue tracking-wider mb-1">{t.references}</h2>
                        <div className="grid grid-cols-2 gap-x-4">
                            {references.map(ref => (
                                ref.name && <div key={ref.id} className="mb-1">
                                    <p className="font-semibold">{ref.name}</p>
                                    <p>{ref.position}, {ref.company}</p>
                                    <p>{ref.email}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
};

// ===================================
//      PROFESSIONAL TEMPLATE
// ===================================
const ProfessionalTemplate: React.FC<{ data: CVData; language: 'en' | 'de' }> = ({ data, language }) => {
    const { personalInfo, summary, workExperience, education, languageSkills, skills, references } = data;
    const groupedSkills = groupSkillsByCategory(skills);
    const t = translations[language];

    const Section: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = '' }) => (
        <section className={`mb-5 ${className}`}>
            <h2 className="text-sm font-bold uppercase tracking-wider text-black">
                {title}
            </h2>
            <div className="border-b border-gray-400 mt-1 mb-3"></div>
            {children}
        </section>
    );

    return (
        <div className="p-8 font-sans text-[10pt] leading-relaxed text-gray-800 bg-white min-h-[297mm]">
            {/* Header */}
            <header className="flex justify-between items-start pb-2 mb-4 border-b border-gray-400">
                <div className="text-left">
                    <h1 className="text-4xl font-extrabold uppercase tracking-wide text-black">
                        {personalInfo.firstName || t.firstName} {personalInfo.lastName || t.lastName}
                    </h1>
                    <p className="text-lg uppercase tracking-wider font-semibold text-gray-700 mt-1">
                        {personalInfo.jobTitle || t.yourJobTitle}
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                       <span>{personalInfo.address || 'Your Address, City'}</span>
                       <span className="mx-2 text-gray-300">|</span>
                       <span>{personalInfo.phone || 'Your Phone Number'}</span>
                       <span className="mx-2 text-gray-300">|</span>
                       <span>{personalInfo.email || 'your.email@example.com'}</span>
                    </p>
                </div>
                 {personalInfo.photo && (
                    <div className="w-28 h-28 bg-gray-200 shrink-0 ml-8">
                        <img src={personalInfo.photo} alt="Profile" className="w-full h-full object-cover" />
                    </div>
                )}
            </header>

            <main>
                {/* Summary */}
                {summary && (
                    <Section title={t.summary}>
                        <p className="whitespace-pre-wrap">{summary}</p>
                    </Section>
                )}

                {/* Experience */}
                {workExperience.length > 0 && workExperience.some(e => e.jobTitle) && (
                    <Section title={t.professionalExperience}>
                        <div className="space-y-4">
                            {workExperience.map(exp => (
                                exp.jobTitle && <div key={exp.id}>
                                    <h3 className="text-base font-bold">{exp.jobTitle}</h3>
                                    <p className="font-semibold text-sm text-gray-700">{exp.employer || t.employer}, {exp.city || t.city}</p>
                                    <p className="text-xs text-gray-500 italic mb-2">
                                        {formatDate(exp.startDate, language)} - {exp.isCurrent ? t.present : formatDate(exp.endDate, language)}
                                    </p>
                                    <ul className="list-disc list-inside space-y-1 pl-2">
                                        {(exp.description || '').split('\n').filter(line => line.trim()).map((line, i) => (
                                            <li key={i}>{line}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {/* Education */}
                {education.length > 0 && education.some(e => e.qualification) && (
                    <Section title={t.education}>
                        <div className="space-y-3">
                            {education.map(edu => (
                                edu.qualification && <div key={edu.id}>
                                    <h3 className="text-base font-bold">{edu.qualification}</h3>
                                    <p className="font-semibold text-sm text-gray-700">{edu.organisation || t.organisation}, {edu.city || t.city}</p>
                                    <p className="text-xs text-gray-500">
                                       {t.completed}: {edu.isCurrent ? t.ongoing : (edu.endDate ? edu.endDate.substring(0,4) : '')}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </Section>
                )}

                {/* Skills */}
                {skills.length > 0 && Object.keys(groupedSkills).length > 0 && (
                     <Section title={t.skills}>
                         <div className="space-y-2">
                             {Object.entries(groupedSkills).map(([category, skillsInCategory]) => (
                                <div key={category} className="flex">
                                    <p className="w-1/4 font-semibold shrink-0">{category}</p>
                                    <p>{skillsInCategory.map(s => s.name).join(', ')}</p>
                                </div>
                             ))}
                         </div>
                    </Section>
                )}
                
                {/* Languages */}
                {languageSkills.length > 0 && languageSkills.some(s => s.language) && (
                     <Section title={t.languages}>
                         <ul className="list-disc list-inside">
                             {languageSkills.map(skill => (
                                skill.language && <li key={skill.id}>
                                    <span className="font-semibold">{skill.language}:</span> {skill.level}
                                </li>
                             ))}
                         </ul>
                    </Section>
                )}

                {/* References */}
                 <Section title={t.references}>
                    {references.length > 0 && references.some(r => r.name) ? (
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                            {references.map(ref => (
                                ref.name && <div key={ref.id}>
                                    <p className="font-bold">{ref.name}</p>
                                    <p>{ref.position}, {ref.company}</p>
                                    <p className="text-xs">{ref.email}{ref.phone && ` | ${ref.phone}`}</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p>{t.referencesDefault}</p>
                    )}
                </Section>
            </main>
        </div>
    );
};


const CVPreview: React.FC<CVPreviewProps> = ({ data, template, language }) => {
    switch (template) {
        case 'modern':
            return <ModernTemplate data={data} language={language} />;
        case 'compact':
            return <CompactTemplate data={data} language={language} />;
        case 'professional':
            return <ProfessionalTemplate data={data} language={language} />;
        case 'classic':
        default:
            return <ClassicTemplate data={data} language={language} />;
    }
};

export default CVPreview;