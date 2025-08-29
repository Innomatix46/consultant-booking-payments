import React, { useState } from 'react';
import { CVData, WorkExperience, Education, LanguageSkill, Skill, Reference } from '../types';
import CVFormSection from './CVFormSection';
import { PlusIcon, TrashIcon, PhotoIcon, SparklesIcon, FileDownloadIcon, MarkdownIcon } from './IconComponents';

// Declare global variable from CDN for TypeScript
declare const jsPDF: any;

interface CVFormProps {
    data: CVData;
    onChange: (newData: CVData) => void;
    onGenerate: (jobDescription: string) => void;
    isGenerating: boolean;
    generatedDocs: { coverLetter: string; motivationLetter: string; };
    generationError: string;
}

const Input = (props: React.ComponentProps<'input'>) => (
    <input {...props} className={`mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm ${props.className || ''}`} />
);
const Textarea = (props: React.ComponentProps<'textarea'>) => (
    <textarea {...props} className={`mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm ${props.className || ''}`} />
);
const Label = (props: React.ComponentProps<'label'>) => (
    <label {...props} className="block text-sm font-medium text-gray-700">{props.children}</label>
);

const CVForm: React.FC<CVFormProps> = ({ data, onChange, onGenerate, isGenerating, generatedDocs, generationError }) => {
    
    const [jobDescription, setJobDescription] = useState('');

    const handleChange = (section: keyof CVData, field: string, value: any) => {
        onChange({
            ...data,
            [section]: {
                ...(data[section] as object),
                [field]: value,
            },
        });
    };

    const handleListChange = (section: 'workExperience' | 'education' | 'languageSkills' | 'skills' | 'references', index: number, field: string, value: any) => {
        const list = [...data[section]];
        list[index] = { ...list[index], [field]: value };
        onChange({ ...data, [section]: list });
    };

    const addListItem = (section: 'workExperience' | 'education' | 'languageSkills' | 'skills' | 'references') => {
        let newItem: WorkExperience | Education | LanguageSkill | Skill | Reference;
        if (section === 'workExperience') {
            newItem = { id: Date.now().toString(), jobTitle: '', employer: '', city: '', country: '', startDate: '', endDate: '', description: '', isCurrent: false };
        } else if (section === 'education') {
            newItem = { id: Date.now().toString(), qualification: '', organisation: '', city: '', country: '', startDate: '', endDate: '', isCurrent: false };
        } else if (section === 'languageSkills') {
            newItem = { id: Date.now().toString(), language: '', level: 'A1 - Beginner' };
        } else if (section === 'references') {
            newItem = { id: Date.now().toString(), name: '', company: '', position: '', email: '', phone: '' };
        } else { // section === 'skills'
            newItem = { id: Date.now().toString(), name: '', category: 'Technical Skill' };
        }
        onChange({ ...data, [section]: [...data[section], newItem] as any });
    };
    
    const removeListItem = (section: 'workExperience' | 'education' | 'languageSkills' | 'skills' | 'references', index: number) => {
        const list = [...data[section]];
        list.splice(index, 1);
        onChange({ ...data, [section]: list });
    };
    
    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = (event) => {
                handleChange('personalInfo', 'photo', event.target?.result);
            };
            reader.readAsDataURL(e.target.files[0]);
        }
    };
    
    const handleDownloadTextAsPdf = (content: string, filename: string) => {
        if (!content) return;

        try {
            const pdf = new jsPDF.jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4',
            });

            const margin = 20;
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const usableWidth = pageWidth - margin * 2;
            const usableHeight = pageHeight - margin; // A bit more space at the bottom

            pdf.setFontSize(11);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(40);
            
            const lines = pdf.splitTextToSize(content, usableWidth);
            
            let y = margin;
            const lineHeight = 6; // Adjust line height for 11pt font

            for (let i = 0; i < lines.length; i++) {
                if (y + lineHeight > pageHeight - margin) {
                    pdf.addPage();
                    y = margin;
                }
                pdf.text(lines[i], margin, y);
                y += lineHeight;
            }

            pdf.save(filename);
        } catch (error) {
            console.error("Error generating text PDF:", error);
            alert("Sorry, there was an error generating the PDF. Please try again.");
        }
    };

    const handleDownloadTextAsMd = (content: string, filename: string) => {
        if (!content) return;
        try {
            const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error generating MD file:", error);
            alert("Sorry, there was an error generating the file. Please try again.");
        }
    };


    return (
        <div className="space-y-6">
            <CVFormSection title="Personal Information" initialOpen>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="photo-upload">Profile Photo</Label>
                        <div className="mt-1 flex items-center space-x-4">
                            <span className="inline-block h-16 w-16 rounded-full overflow-hidden bg-gray-100">
                                {data.personalInfo.photo ? (
                                    <img src={data.personalInfo.photo} alt="Profile" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full w-full flex items-center justify-center text-gray-400">
                                        <PhotoIcon className="w-10 h-10" />
                                    </div>
                                )}
                            </span>
                            <label htmlFor="photo-upload" className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-blue">
                                <span>Change</span>
                                <input id="photo-upload" name="photo-upload" type="file" className="sr-only" accept="image/*" onChange={handlePhotoUpload} />
                            </label>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="firstName">First Name</Label>
                            <Input id="firstName" value={data.personalInfo.firstName} onChange={(e) => handleChange('personalInfo', 'firstName', e.target.value)} placeholder="e.g., Jane" />
                        </div>
                        <div>
                            <Label htmlFor="lastName">Last Name</Label>
                            <Input id="lastName" value={data.personalInfo.lastName} onChange={(e) => handleChange('personalInfo', 'lastName', e.target.value)} placeholder="e.g., Doe" />
                        </div>
                    </div>
                     <div>
                        <Label htmlFor="jobTitle">Your Job Title</Label>
                        <Input id="jobTitle" value={data.personalInfo.jobTitle} onChange={(e) => handleChange('personalInfo', 'jobTitle', e.target.value)} placeholder="e.g., Web Developer" />
                    </div>
                    <div>
                        <Label htmlFor="email">Email</Label>
                        <Input type="email" id="email" value={data.personalInfo.email} onChange={(e) => handleChange('personalInfo', 'email', e.target.value)} placeholder="e.g., jane.doe@email.com" />
                    </div>
                     <div>
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input type="tel" id="phone" value={data.personalInfo.phone} onChange={(e) => handleChange('personalInfo', 'phone', e.target.value)} placeholder="e.g., +49 123 4567890" />
                    </div>
                     <div>
                        <Label htmlFor="address">Address</Label>
                        <Input id="address" value={data.personalInfo.address} onChange={(e) => handleChange('personalInfo', 'address', e.target.value)} placeholder="e.g., Main St 1, 10115 Berlin, Germany" />
                    </div>
                </div>
            </CVFormSection>

            <CVFormSection title="Professional Summary">
                <Label htmlFor="summary">Write a brief summary about your professional background and goals.</Label>
                <Textarea id="summary" value={data.summary} onChange={(e) => onChange({...data, summary: e.target.value})} placeholder="A brief summary of your skills, experience, and career goals, tailored for the German job market." rows={4}/>
            </CVFormSection>

            <CVFormSection title="Work Experience">
                {data.workExperience.map((exp, index) => (
                    <div key={exp.id} className="space-y-4 p-4 mb-4 border border-gray-200 rounded-md relative">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label>Job Title</Label>
                                <Input value={exp.jobTitle} onChange={e => handleListChange('workExperience', index, 'jobTitle', e.target.value)} placeholder="e.g., Software Engineer" />
                            </div>
                            <div>
                                <Label>Employer</Label>
                                <Input value={exp.employer} onChange={e => handleListChange('workExperience', index, 'employer', e.target.value)} placeholder="e.g., Tech Solutions GmbH" />
                            </div>
                             <div>
                                <Label>City</Label>
                                <Input value={exp.city} onChange={e => handleListChange('workExperience', index, 'city', e.target.value)} placeholder="e.g., Berlin" />
                            </div>
                            <div>
                                <Label>Country</Label>
                                <Input value={exp.country} onChange={e => handleListChange('workExperience', index, 'country', e.target.value)} placeholder="e.g., Germany" />
                            </div>
                            <div>
                                <Label>Start Date</Label>
                                <Input type="month" value={exp.startDate} onChange={e => handleListChange('workExperience', index, 'startDate', e.target.value)} />
                            </div>
                            <div>
                                <Label>End Date</Label>
                                <Input type="month" value={exp.endDate} onChange={e => handleListChange('workExperience', index, 'endDate', e.target.value)} disabled={exp.isCurrent}/>
                                 <div className="flex items-center mt-2">
                                    <input type="checkbox" id={`current-job-${index}`} checked={exp.isCurrent} onChange={e => handleListChange('workExperience', index, 'isCurrent', e.target.checked)} className="h-4 w-4 text-brand-blue border-gray-300 rounded focus:ring-brand-blue" />
                                    <label htmlFor={`current-job-${index}`} className="ml-2 block text-sm text-gray-900">I currently work here</label>
                                </div>
                            </div>
                        </div>
                        <div>
                            <Label>Description</Label>
                            <Textarea value={exp.description} onChange={e => handleListChange('workExperience', index, 'description', e.target.value)} placeholder="Describe your responsibilities and achievements." rows={4}/>
                        </div>
                        <button onClick={() => removeListItem('workExperience', index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1 rounded-full bg-red-50 hover:bg-red-100">
                            <TrashIcon />
                        </button>
                    </div>
                ))}
                <button type="button" onClick={() => addListItem('workExperience')} className="flex items-center font-semibold text-brand-blue hover:underline">
                    <PlusIcon className="mr-1" /> Add Work Experience
                </button>
            </CVFormSection>

            <CVFormSection title="Education">
                {data.education.map((edu, index) => (
                    <div key={edu.id} className="space-y-4 p-4 mb-4 border border-gray-200 rounded-md relative">
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                           <div>
                                <Label>Qualification / Degree</Label>
                                <Input value={edu.qualification} onChange={e => handleListChange('education', index, 'qualification', e.target.value)} placeholder="e.g., B.Sc. Computer Science" />
                            </div>
                            <div>
                                <Label>School / University</Label>
                                <Input value={edu.organisation} onChange={e => handleListChange('education', index, 'organisation', e.target.value)} placeholder="e.g., Technical University Munich" />
                            </div>
                             <div>
                                <Label>City</Label>
                                <Input value={edu.city} onChange={e => handleListChange('education', index, 'city', e.target.value)} placeholder="e.g., Munich" />
                            </div>
                            <div>
                                <Label>Country</Label>
                                <Input value={edu.country} onChange={e => handleListChange('education', index, 'country', e.target.value)} placeholder="e.g., Germany" />
                            </div>
                             <div>
                                <Label>Start Date</Label>
                                <Input type="month" value={edu.startDate} onChange={e => handleListChange('education', index, 'startDate', e.target.value)} />
                            </div>
                            <div>
                                <Label>End Date</Label>
                                <Input type="month" value={edu.endDate} onChange={e => handleListChange('education', index, 'endDate', e.target.value)} disabled={edu.isCurrent} />
                                 <div className="flex items-center mt-2">
                                    <input type="checkbox" id={`current-edu-${index}`} checked={edu.isCurrent} onChange={e => handleListChange('education', index, 'isCurrent', e.target.checked)} className="h-4 w-4 text-brand-blue border-gray-300 rounded focus:ring-brand-blue" />
                                    <label htmlFor={`current-edu-${index}`} className="ml-2 block text-sm text-gray-900">I currently study here</label>
                                </div>
                            </div>
                       </div>
                        <button onClick={() => removeListItem('education', index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1 rounded-full bg-red-50 hover:bg-red-100">
                           <TrashIcon />
                        </button>
                    </div>
                ))}
                 <button type="button" onClick={() => addListItem('education')} className="flex items-center font-semibold text-brand-blue hover:underline">
                    <PlusIcon className="mr-1" /> Add Education
                </button>
            </CVFormSection>

            <CVFormSection title="Skills">
                {data.skills.map((skill, index) => (
                    <div key={skill.id} className="flex items-end space-x-4 p-4 mb-4 border border-gray-200 rounded-md relative">
                        <div className="flex-grow">
                            <Label>Skill</Label>
                            <Input value={skill.name} onChange={e => handleListChange('skills', index, 'name', e.target.value)} placeholder="e.g., JavaScript" />
                        </div>
                        <div className="flex-grow">
                            <Label>Category</Label>
                            <select value={skill.category} onChange={e => handleListChange('skills', index, 'category', e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm">
                                <option>Technical Skill</option>
                                <option>Soft Skill</option>
                                <option>Tool</option>
                                <option>Certification</option>
                            </select>
                        </div>
                         <button onClick={() => removeListItem('skills', index)} className="text-red-500 hover:text-red-700 p-1 rounded-full bg-red-50 hover:bg-red-100 mb-1">
                            <TrashIcon />
                        </button>
                    </div>
                ))}
                <button type="button" onClick={() => addListItem('skills')} className="flex items-center font-semibold text-brand-blue hover:underline">
                    <PlusIcon className="mr-1" /> Add Skill
                </button>
            </CVFormSection>

             <CVFormSection title="Language Skills">
                {data.languageSkills.map((skill, index) => (
                    <div key={skill.id} className="flex items-end space-x-4 p-4 mb-4 border border-gray-200 rounded-md relative">
                        <div className="flex-grow">
                            <Label>Language</Label>
                            <Input value={skill.language} onChange={e => handleListChange('languageSkills', index, 'language', e.target.value)} placeholder="e.g., German" />
                        </div>
                        <div className="flex-grow">
                            <Label>Level</Label>
                            <select value={skill.level} onChange={e => handleListChange('languageSkills', index, 'level', e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm">
                                <option>A1 - Beginner</option>
                                <option>A2 - Elementary</option>
                                <option>B1 - Intermediate</option>
                                <option>B2 - Upper-Intermediate</option>
                                <option>C1 - Advanced</option>
                                <option>C2 - Proficient</option>
                                <option>Native</option>
                            </select>
                        </div>
                         <button onClick={() => removeListItem('languageSkills', index)} className="text-red-500 hover:text-red-700 p-1 rounded-full bg-red-50 hover:bg-red-100 mb-1">
                            <TrashIcon />
                        </button>
                    </div>
                ))}
                <button type="button" onClick={() => addListItem('languageSkills')} className="flex items-center font-semibold text-brand-blue hover:underline">
                    <PlusIcon className="mr-1" /> Add Language
                </button>
            </CVFormSection>

            <CVFormSection title="References">
                {data.references.map((ref, index) => (
                    <div key={ref.id} className="space-y-4 p-4 mb-4 border border-gray-200 rounded-md relative">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <Label>Full Name</Label>
                                <Input value={ref.name} onChange={e => handleListChange('references', index, 'name', e.target.value)} placeholder="e.g., John Smith" />
                            </div>
                            <div>
                                <Label>Company</Label>
                                <Input value={ref.company} onChange={e => handleListChange('references', index, 'company', e.target.value)} placeholder="e.g., ACME Inc." />
                            </div>
                             <div>
                                <Label>Position</Label>
                                <Input value={ref.position} onChange={e => handleListChange('references', index, 'position', e.target.value)} placeholder="e.g., Senior Manager" />
                            </div>
                             <div>
                                <Label>Email</Label>
                                <Input type="email" value={ref.email} onChange={e => handleListChange('references', index, 'email', e.target.value)} placeholder="e.g., john.smith@email.com" />
                            </div>
                             <div className="sm:col-span-2">
                                <Label>Phone</Label>
                                <Input type="tel" value={ref.phone} onChange={e => handleListChange('references', index, 'phone', e.target.value)} placeholder="e.g., +49 123 987654" />
                            </div>
                        </div>
                        <button onClick={() => removeListItem('references', index)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1 rounded-full bg-red-50 hover:bg-red-100">
                            <TrashIcon />
                        </button>
                    </div>
                ))}
                <button type="button" onClick={() => addListItem('references')} className="flex items-center font-semibold text-brand-blue hover:underline">
                    <PlusIcon className="mr-1" /> Add Reference
                </button>
            </CVFormSection>
            
            <CVFormSection title="AI Document Generation">
                <div>
                    <Label htmlFor="job-description">Paste Job Description Here</Label>
                    <Textarea 
                        id="job-description"
                        value={jobDescription}
                        onChange={(e) => setJobDescription(e.target.value)}
                        placeholder="Paste the full job description to generate tailored documents."
                        rows={6}
                    />
                </div>
                <button
                    type="button"
                    onClick={() => onGenerate(jobDescription)}
                    disabled={isGenerating || !jobDescription}
                    className="mt-4 w-full flex justify-center items-center bg-purple-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400"
                >
                    {isGenerating ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <span>Generating...</span>
                        </>
                    ) : (
                        <><SparklesIcon className="mr-2"/> Generate Documents</>
                    )}
                </button>
                {generationError && <p className="mt-2 text-sm text-red-600">{generationError}</p>}
                {(generatedDocs.coverLetter || generatedDocs.motivationLetter) && !isGenerating && (
                    <div className="mt-6 space-y-4 animate-fade-in">
                        {generatedDocs.coverLetter && (
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <Label>Generated Cover Letter</Label>
                                    <div className="flex items-center space-x-4">
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadTextAsPdf(generatedDocs.coverLetter, 'Cover_Letter.pdf')}
                                            className="flex items-center text-sm font-semibold text-brand-blue hover:underline"
                                        >
                                            <FileDownloadIcon className="w-4 h-4 mr-1" />
                                            PDF
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadTextAsMd(generatedDocs.coverLetter, 'Cover_Letter.md')}
                                            className="flex items-center text-sm font-semibold text-brand-blue hover:underline"
                                        >
                                            <MarkdownIcon className="w-4 h-4 mr-1" />
                                            MD
                                        </button>
                                    </div>
                                </div>
                                <Textarea
                                    readOnly
                                    value={generatedDocs.coverLetter}
                                    rows={12}
                                    className="bg-gray-50 text-sm"
                                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                                />
                            </div>
                        )}
                        {generatedDocs.motivationLetter && (
                            <div>
                                 <div className="flex justify-between items-center mb-1">
                                    <Label>Generated Motivation Letter</Label>
                                    <div className="flex items-center space-x-4">
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadTextAsPdf(generatedDocs.motivationLetter, 'Motivation_Letter.pdf')}
                                            className="flex items-center text-sm font-semibold text-brand-blue hover:underline"
                                        >
                                            <FileDownloadIcon className="w-4 h-4 mr-1" />
                                            PDF
                                        </button>
                                         <button
                                            type="button"
                                            onClick={() => handleDownloadTextAsMd(generatedDocs.motivationLetter, 'Motivation_Letter.md')}
                                            className="flex items-center text-sm font-semibold text-brand-blue hover:underline"
                                        >
                                            <MarkdownIcon className="w-4 h-4 mr-1" />
                                            MD
                                        </button>
                                    </div>
                                </div>
                                <Textarea
                                    readOnly
                                    value={generatedDocs.motivationLetter}
                                    rows={12}
                                    className="bg-gray-50 text-sm"
                                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                                />
                            </div>
                        )}
                    </div>
                )}
            </CVFormSection>
        </div>
    );
};

export default CVForm;