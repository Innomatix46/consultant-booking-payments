





import React, { useState, useEffect, useRef } from 'react';
import { ConsultationOption } from '../types';
import { BriefcaseIcon, StarIcon, ShieldCheckIcon, RocketLaunchIcon, TargetIcon, QuoteIcon, DocumentTextIcon, UsersIcon, DocumentPencilIcon, CheckIcon, HomeModernIcon } from './IconComponents';

interface LandingPageProps {
    onStartBooking: (consultation: ConsultationOption, price: number) => void;
    onStartGenericBooking: () => void;
}

const AnimatedDiv: React.FC<{ children: React.ReactNode; delay: number; className?: string }> = ({ children, delay, className }) => (
    <div className={`opacity-0 animate-slide-in-up ${className}`} style={{ animationDelay: `${delay}ms`}}>
        {children}
    </div>
);

const LandingPage: React.FC<LandingPageProps> = ({ onStartBooking, onStartGenericBooking }) => {
    
    const testimonials = [
        {
            quote: "The consultation was a turning point. I found so much conflicting information online. Here, I received a clear, step-by-step guide for my IT specialist visa.",
            name: "Samuel A.",
            role: "Software Engineer from Nigeria",
        },
        {
            quote: "I wasn't sure how to find a job in Germany after my Master's degree. The tips on CV optimization and the application process were worth their weight in gold. I have my dream job now!",
            name: "Priya K.",
            role: "Graduate from India",
        },
        {
            quote: "When we planned our family reunion, we were overwhelmed. The consultation helped us prepare all the necessary documents correctly and on time. Absolutely recommended.",
            name: "The Al-Jamil Family",
            role: "Family Reunion from Syria",
        },
        {
            quote: "Finding the right information about the Blue Card was challenging. The expert advice I received was precise, saving me months of research and potential mistakes.",
            name: "Chen L.",
            role: "Data Scientist from China",
        }
    ];

    const [currentTestimonial, setCurrentTestimonial] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
        }, 5000); // Change testimonial every 5 seconds
        return () => clearInterval(timer);
    }, [testimonials.length]);

    const handleScrollToServices = (e: React.MouseEvent<HTMLAnchorElement>) => {
        e.preventDefault();
        const servicesSection = document.getElementById('services');
        if (servicesSection) {
            servicesSection.scrollIntoView({ behavior: 'smooth' });
        }
    };


    return (
        <div className="bg-white">
            {/* Hero Section */}
            <section className="relative h-[90vh] min-h-[600px] flex items-center justify-center text-center text-white overflow-hidden -mt-6 sm:-mt-8 lg:-mt-10">
                <div className="absolute inset-0 z-0">
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                        poster="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2071&auto=format&fit=crop"
                    >
                        {/* Provide a high-quality video source */}
                        <source src="https://assets.mixkit.co/videos/preview/mixkit-women-walking-and-talking-in-an-office-43398-large.mp4" type="video/mp4" />
                    </video>
                    <div className="absolute inset-0 bg-brand-dark/70"></div>
                </div>
                <div className="relative z-10 max-w-4xl mx-auto px-4">
                    <AnimatedDiv delay={100}>
                        <h2 className="text-4xl md:text-6xl font-extrabold mb-4 leading-tight tracking-tight [text-shadow:_0_2px_4px_rgb(0_0_0_/_40%)]">
                            Your Direct Path to Living in Germany
                        </h2>
                    </AnimatedDiv>
                    <AnimatedDiv delay={300}>
                        <p className="max-w-3xl mx-auto text-lg md:text-xl text-gray-200 mb-10 [text-shadow:_0_1px_3px_rgb(0_0_0_/_30%)]">
                            Get clear, actionable answers to your immigration questions. Book a tailored consultation and start your journey with confidence.
                        </p>
                    </AnimatedDiv>
                    <AnimatedDiv delay={500}>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <button 
                                onClick={onStartGenericBooking} 
                                className="w-full sm:w-auto bg-gradient-blue text-white font-bold py-3 px-8 rounded-full text-lg hover:shadow-xl transition-all transform hover:scale-105 shadow-lg animate-pulse-glow"
                            >
                                Book a Consultation
                            </button>
                            <a 
                                href="#services" 
                                onClick={handleScrollToServices} 
                                className="w-full sm:w-auto bg-transparent border-2 border-white text-white font-bold py-3 px-8 rounded-full text-lg hover:bg-white hover:text-brand-dark transition-colors"
                            >
                                View Services
                            </a>
                        </div>
                    </AnimatedDiv>
                </div>
            </section>

             {/* Why Choose Us Section */}
            <section className="py-20 bg-brand-light px-4">
                <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                    <div className="p-6">
                        <div className="inline-flex items-center justify-center p-4 bg-white rounded-full shadow-lg mb-4 text-brand-blue">
                           <ShieldCheckIcon />
                        </div>
                        <h3 className="text-xl font-bold text-brand-dark mb-2">Expert Guidance</h3>
                        <p className="text-gray-600">Navigate complex German bureaucracy with advice from seasoned experts who are up-to-date with the latest immigration laws.</p>
                    </div>
                     <div className="p-6">
                        <div className="inline-flex items-center justify-center p-4 bg-white rounded-full shadow-lg mb-4 text-brand-blue">
                           <TargetIcon />
                        </div>
                        <h3 className="text-xl font-bold text-brand-dark mb-2">Personalized Strategy</h3>
                        <p className="text-gray-600">We don't offer one-size-fits-all solutions. Your consultation focuses on your unique situation to create a tailored action plan.</p>
                    </div>
                     <div className="p-6">
                        <div className="inline-flex items-center justify-center p-4 bg-white rounded-full shadow-lg mb-4 text-brand-blue">
                           <RocketLaunchIcon />
                        </div>
                        <h3 className="text-xl font-bold text-brand-dark mb-2">Accelerate Your Journey</h3>
                        <p className="text-gray-600">Avoid common pitfalls and costly delays. Our insights help you prepare a successful application from the very beginning.</p>
                    </div>
                </div>
            </section>

            {/* What We'll Discuss Section */}
            <section id="services" className="py-20 bg-white px-4">
                <div className="text-center max-w-3xl mx-auto">
                    <h3 className="text-4xl font-bold text-brand-dark mb-12">
                        What We'll Discuss in Your Consultation
                    </h3>
                </div>
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 text-center flex flex-col items-center">
                        <div className="inline-flex items-center justify-center p-4 rounded-full bg-sky-100 text-brand-blue mb-4">
                            <DocumentTextIcon className="w-8 h-8" />
                        </div>
                        <h4 className="text-xl font-bold text-brand-dark mb-2">Visa & Bureaucracy</h4>
                        <p className="text-gray-600">Understand the requirements for various visas (work, study, etc.) and get help with preparing your documents correctly.</p>
                    </div>
                    <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 text-center flex flex-col items-center">
                         <div className="inline-flex items-center justify-center p-4 rounded-full bg-sky-100 text-brand-blue mb-4">
                            <BriefcaseIcon className="w-8 h-8" />
                        </div>
                        <h4 className="text-xl font-bold text-brand-dark mb-2">Job Search & Career</h4>
                        <p className="text-gray-600">Learn about the German job market, resume optimization, and strategies for a successful job search.</p>
                    </div>
                    <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 text-center flex flex-col items-center">
                         <div className="inline-flex items-center justify-center p-4 rounded-full bg-sky-100 text-brand-blue mb-4">
                            <HomeModernIcon />
                        </div>
                        <h4 className="text-xl font-bold text-brand-dark mb-2">Arriving & Living</h4>
                        <p className="text-gray-600">Get practical advice on finding an apartment, city registration (Anmeldung), and opening a bank account.</p>
                    </div>
                </div>
            </section>

             {/* How It Works Section */}
            <section className="py-20 px-4 bg-gradient-radial from-gray-50 to-sky-50">
                 <div className="text-center max-w-3xl mx-auto">
                    <h3 className="text-4xl font-bold text-brand-dark mb-4">Get Started in 4 Easy Steps</h3>
                    <p className="text-lg text-gray-600 mb-16">Your path to clarity is simple, secure, and straightforward.</p>
                </div>
                 <div className="max-w-xl mx-auto relative">
                     <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-200 -translate-x-1/2">
                        {/* Optional: Add animated line drawing */}
                     </div>

                    <div className="space-y-16">
                        {/* Step 1 */}
                        <div className="flex items-center gap-8 relative">
                            <div className="hidden sm:block bg-white text-brand-blue rounded-full p-4 border-2 border-gray-200 shadow-md z-10">
                                <span className="text-2xl font-bold w-8 h-8 flex items-center justify-center">1</span>
                            </div>
                            <div className="flex-1 bg-white p-6 rounded-lg shadow-lg border-l-4 border-brand-blue">
                                <p className="font-bold text-xl mb-1 text-brand-dark">Select a Service & Time</p>
                                <p className="text-gray-600">Choose your desired consultation type and pick a time slot that works for you from our calendar.</p>
                            </div>
                        </div>
                         {/* Step 2 */}
                        <div className="flex items-center flex-row-reverse sm:flex-row gap-8 relative">
                             <div className="hidden sm:block bg-white text-brand-blue rounded-full p-4 border-2 border-gray-200 shadow-md z-10">
                                <span className="text-2xl font-bold w-8 h-8 flex items-center justify-center">2</span>
                            </div>
                            <div className="flex-1 bg-white p-6 rounded-lg shadow-lg border-l-4 sm:border-l-0 sm:border-r-4 border-brand-blue sm:text-right">
                                <p className="font-bold text-xl mb-1 text-brand-dark">Enter Your Details</p>
                                <p className="text-gray-600">Provide your contact information so we can send you a confirmation and prepare for our meeting.</p>
                            </div>
                        </div>
                         {/* Step 3 */}
                        <div className="flex items-center gap-8 relative">
                            <div className="hidden sm:block bg-white text-brand-blue rounded-full p-4 border-2 border-gray-200 shadow-md z-10">
                                <span className="text-2xl font-bold w-8 h-8 flex items-center justify-center">3</span>
                            </div>
                            <div className="flex-1 bg-white p-6 rounded-lg shadow-lg border-l-4 border-brand-blue">
                                <p className="font-bold text-xl mb-1 text-brand-dark">Confirm & Pay Securely</p>
                                <p className="text-gray-600">Complete your booking with a secure payment via Stripe or Paystack. Your spot is now reserved.</p>
                            </div>
                        </div>
                         {/* Step 4 */}
                        <div className="flex items-center flex-row-reverse sm:flex-row gap-8 relative">
                             <div className="hidden sm:block bg-white text-brand-blue rounded-full p-4 border-2 border-gray-200 shadow-md z-10">
                                <span className="text-2xl font-bold w-8 h-8 flex items-center justify-center">4</span>
                            </div>
                            <div className="flex-1 bg-white p-6 rounded-lg shadow-lg border-l-4 sm:border-l-0 sm:border-r-4 border-brand-blue sm:text-right">
                                <p className="font-bold text-xl mb-1 text-brand-dark">Receive Your Call</p>
                                <p className="text-gray-600">Our consultant will call you via WhatsApp at the scheduled time, ready to answer all your questions.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

             {/* New CTA Section */}
            <section className="py-20 bg-white px-4">
                <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                    <div className="p-8 sm:p-10">
                        <h3 className="text-3xl font-bold text-center text-brand-dark">Start Your Journey Now</h3>
                        <p className="text-6xl font-extrabold text-center text-brand-dark my-4">€20</p>
                        <p className="text-center text-gray-600 mb-6">A one-time investment for a clear, personalized strategy.</p>
                        
                        <div className="mt-8">
                            <h4 className="text-lg font-semibold text-brand-dark">What's included?</h4>
                            <ul className="mt-4 space-y-3 text-gray-700">
                                <li className="flex items-start">
                                    <CheckIcon className="w-6 h-6 text-green-500 mr-3 shrink-0 mt-0.5" />
                                    <span>30-minute 1-on-1 video consultation</span>
                                </li>
                                <li className="flex items-start">
                                    <CheckIcon className="w-6 h-6 text-green-500 mr-3 shrink-0 mt-0.5" />
                                    <span>Analysis of your personal situation</span>
                                </li>
                                <li className="flex items-start">
                                    <CheckIcon className="w-6 h-6 text-green-500 mr-3 shrink-0 mt-0.5" />
                                    <span>Answers to all your questions</span>
                                </li>
                            </ul>
                        </div>
                        
                        <div className="mt-10">
                            <button
                                onClick={() => {
                                    const introductoryConsultation: ConsultationOption = {
                                        id: 'introductory_consultation_20',
                                        title: 'Introductory Consultation',
                                        description: 'A one-time investment for a clear, personalized strategy.',
                                        priceKey: 'introductoryPrice20',
                                        defaultPrice: '20',
                                        // IMPORTANT: This is a FAKE ID for testing. Replace with a REAL Stripe Price ID for a 20 EUR product.
                                        stripePriceId: 'price_1P5bZgP0OXBFDAIsFAKE00', 
                                    };
                                    onStartBooking(introductoryConsultation, 20);
                                }}
                                className="w-full bg-green-500 text-white font-bold py-4 px-6 rounded-lg text-lg hover:bg-green-600 transition-all transform hover:scale-105 shadow-lg"
                            >
                                Secure Your Consultation Slot
                            </button>
                        </div>
                    </div>
                </div>
            </section>

             {/* Testimonials Section */}
            <section className="py-20 bg-white px-4 overflow-hidden">
                <div className="text-center max-w-3xl mx-auto">
                    <h3 className="text-4xl font-bold text-brand-dark mb-4">Success Stories</h3>
                    <p className="text-lg text-gray-600 mb-12">Hear from clients who successfully navigated their move to Germany with our help.</p>
                </div>
                <div className="max-w-3xl mx-auto relative h-80">
                    {testimonials.map((testimonial, index) => (
                        <div 
                            key={index} 
                            className={`absolute top-0 left-0 w-full h-full transition-opacity duration-1000 ease-in-out ${index === currentTestimonial ? 'opacity-100' : 'opacity-0'}`}
                        >
                            <div className="bg-gray-50 rounded-xl p-8 flex flex-col text-center items-center h-full justify-center border border-gray-200">
                                <div className="text-brand-blue-light mb-4">
                                    <QuoteIcon />
                                </div>
                                <p className="text-lg font-medium text-gray-700 italic mb-6 flex-grow">"{testimonial.quote}"</p>
                                <div>
                                    <p className="font-bold text-brand-dark text-lg">{testimonial.name}</p>
                                    <p className="text-sm text-gray-500">{testimonial.role}</p>
                                </div>
                             </div>
                        </div>
                    ))}
                </div>
                {/* Dots */}
                <div className="flex justify-center mt-8 space-x-2">
                    {testimonials.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentTestimonial(index)}
                            className={`w-3 h-3 rounded-full transition-all duration-300 ${index === currentTestimonial ? 'bg-brand-blue w-6' : 'bg-gray-300 hover:bg-gray-400'}`}
                            aria-label={`Go to testimonial ${index + 1}`}
                        ></button>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default LandingPage;