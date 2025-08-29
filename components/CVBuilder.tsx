
import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { CVData } from '../types';
import CVForm from './CVForm';
import CVPreview from './CVPreview';
import { SparklesIcon, MarkdownIcon } from './IconComponents';

// Declare global variables from CDN for TypeScript
declare const jsPDF: any;
declare const html2canvas: any;

const initialCVData: CVData = {
  personalInfo: {
    firstName: '',
    lastName: '',
    jobTitle: '',
    email: '',
    phone: '',
    address: '',
    photo: null,
  },
  summary: '',
  workExperience: [],
  education: [],
  languageSkills: [],
  skills: [],
  references: [],
};

// Helper functions and translations moved here for MD generation
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

const formatDate = (dateString: string, language: 'en' | 'de') => {
    if (!dateString) return '';
    const [year, month] = dateString.split('-');
    const date = new Date(Number(year), Number(month) - 1);
    const locale = language === 'de' ? 'de-DE' : 'en-US';
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

const convertCvDataToMarkdown = (data: CVData, lang: 'en' | 'de'): string => {
    const { personalInfo, summary, workExperience, education, languageSkills, skills, references } = data;
    const t = translations[lang];
    const nl = '\n';
    const nl2 = '\n\n';

    let md = `# ${personalInfo.firstName || t.firstName} ${personalInfo.lastName || t.lastName}${nl}`;
    if (personalInfo.jobTitle) md += `### ${personalInfo.jobTitle}${nl2}`;

    if (personalInfo.email) md += `**${t.email}** ${personalInfo.email}  \n`;
    if (personalInfo.phone) md += `**${t.phone}** ${personalInfo.phone}  \n`;
    if (personalInfo.address) md += `**${t.address}** ${personalInfo.address}${nl2}`;

    if (summary) {
        md += `## ${t.summary}${nl}`;
        md += `${summary}${nl2}`;
    }

    if (workExperience.length > 0 && workExperience.some(e => e.jobTitle)) {
        md += `## ${t.workExperience}${nl}`;
        workExperience.forEach(exp => {
            if (!exp.jobTitle) return;
            md += `### ${exp.jobTitle} at ${exp.employer || t.employer}${nl}`;
            md += `*${formatDate(exp.startDate, lang)} - ${exp.isCurrent ? t.present : formatDate(exp.endDate, lang)} | ${exp.city || t.city}, ${exp.country || t.country}*${nl}`;
            if (exp.description) {
                const descriptionItems = exp.description.split('\n').filter(line => line.trim()).map(line => `- ${line}`).join(nl);
                md += `${descriptionItems}${nl2}`;
            } else {
                md += nl;
            }
        });
    }

    if (education.length > 0 && education.some(e => e.qualification)) {
        md += `## ${t.education}${nl}`;
        education.forEach(edu => {
            if (!edu.qualification) return;
            md += `### ${edu.qualification}${nl}`;
            md += `*${edu.organisation || t.organisation} | ${formatDate(edu.startDate, lang)} - ${edu.isCurrent ? t.present : formatDate(edu.endDate, lang)}*${nl2}`;
        });
    }
    
    const groupedSkills = groupSkillsByCategory(skills);
    if (skills.length > 0 && Object.keys(groupedSkills).length > 0) {
        md += `## ${t.skills}${nl}`;
        Object.entries(groupedSkills).forEach(([category, skillsInCategory]) => {
            md += `**${category}:** ${skillsInCategory.map(s => s.name).join(', ')}${nl}`;
        });
        md += nl;
    }

    if (languageSkills.length > 0 && languageSkills.some(s => s.language)) {
        md += `## ${t.languages}${nl}`;
        languageSkills.forEach(lang => {
             if (!lang.language) return;
             md += `- ${lang.language}: ${lang.level}${nl}`;
        });
        md += nl;
    }

    if (references.length > 0 && references.some(r => r.name)) {
        md += `## ${t.references}${nl}`;
         references.forEach(ref => {
            if (!ref.name) return;
            md += `**${ref.name}** - ${ref.position} at ${ref.company}${nl}`;
            if (ref.email || ref.phone) md += `  *${[ref.email, ref.phone].filter(Boolean).join(' | ')}*${nl2}`;
        });
    } else {
        md += `## ${t.references}${nl}`;
        md += `${t.referencesDefault}${nl}`;
    }

    return md;
};


const CVBuilder: React.FC = () => {
    const [cvData, setCvData] = useState<CVData>(initialCVData);
    const [isDownloading, setIsDownloading] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<string>('classic');
    const [language, setLanguage] = useState<'en' | 'de'>('en');
    
    // AI state
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedDocs, setGeneratedDocs] = useState({ coverLetter: '', motivationLetter: '' });
    const [generationError, setGenerationError] = useState('');

    const handleDownloadPdf = async () => {
        const elementToCapture = previewRef.current;
        if (!elementToCapture) {
            console.error("Preview element not found");
            return;
        }
        setIsDownloading(true);

        try {
            const canvas = await html2canvas(elementToCapture, {
                scale: 2,
                useCORS: true,
                logging: false,
                width: elementToCapture.scrollWidth,
                height: elementToCapture.scrollHeight,
            });
            
            const imgData = canvas.toDataURL('image/png');
            // A4 size in mm: 210 x 297
            const pdf = new jsPDF.jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4',
            });

            const pdfWidth = pdf.internal.pageSize.getWidth(); // 210
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const canvasAspectRatio = canvasWidth / canvasHeight;

            const imgHeight = pdfWidth / canvasAspectRatio;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
            heightLeft -= pdf.internal.pageSize.getHeight();

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
                heightLeft -= pdf.internal.pageSize.getHeight();
            }

            pdf.save(`${(cvData.personalInfo.firstName || 'CV')}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Sorry, there was an error generating the PDF. Please try again.");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadMd = () => {
        setIsDownloading(true);
        try {
            const markdownContent = convertCvDataToMarkdown(cvData, language);
            const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${(cvData.personalInfo.firstName || 'CV')}.md`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error generating MD file:", error);
            alert("Sorry, there was an error generating the Markdown file.");
        } finally {
            setIsDownloading(false);
        }
    };

    const handleGenerateDocuments = async (jobDescription: string) => {
        if (!jobDescription.trim()) {
            setGenerationError("Please paste a job description.");
            return;
        }
        if (!process.env.API_KEY) {
            setGenerationError("AI features are not configured. API Key is missing.");
            return;
        }

        setIsGenerating(true);
        setGeneratedDocs({ coverLetter: '', motivationLetter: '' });
        setGenerationError('');

        const formatDateForPrompt = (dateString: string): string => {
            if (!dateString) return 'N/A';
            const [year, month] = dateString.split('-');
            const date = new Date(Number(year), Number(month) - 1);
            return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
        };
        
        const formatCVDataForPrompt = (data: CVData): string => {
            return `
            - Name: ${data.personalInfo.firstName} ${data.personalInfo.lastName}
            - Job Title: ${data.personalInfo.jobTitle}
            - Email: ${data.personalInfo.email}
            - Phone: ${data.personalInfo.phone}
            - Address: ${data.personalInfo.address}
            - Professional Summary: ${data.summary}
            - Work Experience: 
              ${data.workExperience.map(exp => `  - ${exp.jobTitle} at ${exp.employer} (${formatDateForPrompt(exp.startDate)} - ${exp.isCurrent ? 'Present' : formatDateForPrompt(exp.endDate)}): ${exp.description}`).join('\n')}
            - Education: 
              ${data.education.map(edu => `  - ${edu.qualification} at ${edu.organisation}`).join('\n')}
            - Language Skills: ${data.languageSkills.map(skill => `${skill.language} (${skill.level})`).join(', ')}
            - Skills:
              ${data.skills.map(skill => `  - ${skill.category}: ${skill.name}`).join('\n')}
            - References:
              ${data.references.map(ref => `  - ${ref.name}, ${ref.position} at ${ref.company}. Contact: ${ref.email}, ${ref.phone}`).join('\n')}
            `.trim();
        };

        const cvString = formatCVDataForPrompt(cvData);

        const coverLetterPrompt = `
            Based on the following CV data and job description, write a professional and compelling cover letter for the German job market.
            The tone should be enthusiastic and tailored specifically to the role described.
            Address it to the "Hiring Manager" if no name is provided. Ensure it follows a standard professional cover letter format.
            Do not invent skills or experiences not mentioned in the CV. Highlight the most relevant qualifications from the CV.

            **CV Data:**
            ${cvString}

            **Job Description:**
            ${jobDescription}
        `;
        
        const motivationLetterPrompt = `
            Based on the following CV data and job description, write a detailed and persuasive motivation letter for the German job market. 
            Focus on why the candidate is passionate about this specific role and company, and how their skills and experiences from the CV align with the company's mission and the job requirements.
            It should complement a cover letter, not repeat it. Go deeper into their personal motivations and connect them to the company's values and the role's challenges.

            **CV Data:**
            ${cvString}

            **Job Description:**
            ${jobDescription}
        `;

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            const coverLetterResponsePromise = ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: coverLetterPrompt,
            });

            const motivationLetterResponsePromise = ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: motivationLetterPrompt,
            });

            const [coverLetterResponse, motivationLetterResponse] = await Promise.all([
                coverLetterResponsePromise,
                motivationLetterResponsePromise,
            ]);

            setGeneratedDocs({
                coverLetter: coverLetterResponse.text,
                motivationLetter: motivationLetterResponse.text,
            });

        } catch (error) {
            console.error("Error generating documents:", error);
            setGenerationError("Sorry, there was an error generating the documents. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const templates = [
        { id: 'classic', name: 'Classic' },
        { id: 'modern', name: 'Modern' },
        { id: 'compact', name: 'Compact' },
        { id: 'professional', name: 'Professional' },
    ];

    const TemplateThumbnail = ({ type }: { type: string }) => {
        if (type === 'classic') {
            return (
                <div className="w-full h-12 bg-gray-100 rounded flex border border-gray-300">
                    <div className="w-1/3 h-full bg-gray-300 rounded-l"></div>
                    <div className="w-2/3 h-full p-1 space-y-1">
                        <div className="w-full h-1/4 bg-gray-400 rounded-sm"></div>
                        <div className="w-1/2 h-1/4 bg-gray-400 rounded-sm"></div>
                    </div>
                </div>
            );
        }
        if (type === 'modern') {
            return (
                <div className="w-full h-12 bg-gray-100 rounded flex flex-col border border-gray-300">
                    <div className="w-full h-1/3 bg-gray-300 rounded-t p-1 flex items-center">
                        <div className="w-1/2 h-1/2 bg-gray-400 rounded-sm"></div>
                    </div>
                    <div className="w-full h-2/3 p-1 space-y-1">
                        <div className="w-full h-1/4 bg-gray-400 rounded-sm"></div>
                        <div className="w-full h-1/4 bg-gray-400 rounded-sm"></div>
                    </div>
                </div>
            );
        }
        if (type === 'compact') {
            return (
                 <div className="w-full h-12 bg-gray-100 rounded flex flex-col border border-gray-300 p-1 space-y-1">
                    <div className="w-full h-1/4 bg-gray-300 rounded-sm"></div>
                    <div className="w-full h-1/4 bg-gray-400 rounded-sm"></div>
                    <div className="w-full h-1/4 bg-gray-400 rounded-sm"></div>
                </div>
            );
        }
        if (type === 'professional') {
            return (
                 <div className="w-full h-12 bg-gray-100 rounded flex flex-col border border-gray-300 p-1 space-y-1">
                    <div className="w-3/4 h-1/4 bg-gray-400 rounded-sm"></div>
                    <div className="w-full h-px bg-gray-300 my-0.5"></div>
                    <div className="w-1/2 h-1/4 bg-gray-300 rounded-sm"></div>
                    <div className="w-full h-1/4 bg-gray-400 rounded-sm"></div>
                </div>
            );
        }
        return null;
    };


    return (
        <div className="flex flex-col lg:flex-row bg-white min-h-[calc(100vh-200px)]">
            {/* Form Panel */}
            <div className="w-full lg:w-1/2 lg:max-h-[calc(100vh-180px)] overflow-y-auto p-4 sm:p-6 lg:p-8 border-r border-gray-200">
                <div className="max-w-xl mx-auto">
                    <h2 className="text-3xl font-bold text-brand-dark mb-6">CV Builder</h2>
                    <CVForm 
                        data={cvData} 
                        onChange={setCvData} 
                        onGenerate={handleGenerateDocuments}
                        isGenerating={isGenerating}
                        generatedDocs={generatedDocs}
                        generationError={generationError}
                    />
                </div>
            </div>

            {/* Preview Panel */}
            <div className="w-full lg:w-1/2 lg:max-h-[calc(100vh-180px)] overflow-y-auto p-4 sm:p-6 lg:p-8 bg-gray-50 flex flex-col">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-4">
                    <h3 className="text-xl font-bold text-brand-dark">Live Preview</h3>
                    <div className="flex items-center space-x-2">
                         <button 
                            onClick={handleDownloadMd} 
                            disabled={isDownloading}
                            className="flex items-center bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            title="Download as Markdown"
                        >
                            <MarkdownIcon className="w-5 h-5 mr-2" />
                            <span>MD</span>
                        </button>
                        <button 
                            onClick={handleDownloadPdf} 
                            disabled={isDownloading}
                            className="flex items-center bg-green-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                            title="Download as PDF"
                        >
                            {isDownloading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                    <span>Downloading...</span>
                                </>
                            ) : (
                                'Download as PDF'
                            )}
                        </button>
                    </div>
                </div>
                
                 {/* Template Selector */}
                 <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Choose a Template</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {templates.map(template => (
                            <button
                                key={template.id}
                                onClick={() => setSelectedTemplate(template.id)}
                                className={`border-2 rounded-lg p-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue ${selectedTemplate === template.id ? 'border-brand-blue shadow-md' : 'border-gray-200 hover:border-gray-400'}`}
                                aria-pressed={selectedTemplate === template.id}
                            >
                                <TemplateThumbnail type={template.id} />
                                <span className="text-xs font-semibold capitalize mt-2 block text-center">{template.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Language Selector */}
                <div className="mb-6">
                    <label htmlFor="language-select" className="block text-sm font-medium text-gray-700 mb-2">
                        CV Language
                    </label>
                    <select
                        id="language-select"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value as 'en' | 'de')}
                        className="block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm"
                    >
                        <option value="en">English</option>
                        <option value="de">Deutsch</option>
                    </select>
                </div>

                <div className="bg-white shadow-lg flex-grow">
                    <div ref={previewRef}>
                        <CVPreview data={cvData} template={selectedTemplate} language={language} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CVBuilder;
