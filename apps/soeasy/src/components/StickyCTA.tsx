import { useState, useEffect } from 'react';

export function StickyCTA() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show sticky CTA after scrolling 300px
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToForm = () => {
    const form = document.getElementById('lead-form');
    if (form) {
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Track CTA click
      if ((window as any).gtag) {
        (window as any).gtag('event', 'cta_click', { location: 'sticky' });
      }
    }
  };

  return (
    <button
      onClick={scrollToForm}
      className={`fixed bottom-6 right-6 z-50 px-8 py-4 bg-primary text-primary-foreground rounded-full shadow-2xl transition-all duration-300 hover:scale-105 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
      }`}
      style={{
        boxShadow: '0 10px 40px rgba(255, 141, 1, 0.3)',
      }}
    >
      <span className="hidden md:inline">Κλείσε Δωρεάν Ραντεβού</span>
      <span className="md:hidden">Ραντεβού</span>
    </button>
  );
}
