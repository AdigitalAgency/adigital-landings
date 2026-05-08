import { useState } from 'react';

interface AccordionItemProps {
  language: { name: string; flag: string };
  audience: 'adult' | 'child';
  onCTAClick: (language: string, audience: 'adult' | 'child') => void;
}

function AccordionItem({ language, audience, onCTAClick }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getContent = () => {
    const common = [
      'Επίπεδα: αρχάριοι έως προχωρημένοι',
      language.name !== 'Εξειδικευμένα Πτυχία για ενήλικες' && 'Προετοιμασία για πιστοποιήσεις',
      'Ολιγομελή τμήματα',
      'Έμπειροι καθηγητές',
    ].filter(Boolean);

    const specific = audience === 'child'
      ? ['Διαδραστική εκμάθηση', 'Προσαρμογή ανά ηλικία']
      : ['Επαγγελματική χρήση', 'Ευέλικτα ωράρια'];

    return [...common, ...specific];
  };

  return (
    <div
      className="border-b border-border last:border-b-0 transition-all duration-300"
      style={{ animation: 'slideIn 0.4s ease-out' }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-4 px-5 flex items-center justify-between hover:bg-muted/30 transition-colors duration-200 text-left"
      >
        <span className="font-medium flex items-center gap-3">
          <span className="text-2xl">{language.flag}</span>
          <span>{language.name}</span>
        </span>
        <span
          className="text-primary transition-transform duration-300 text-xl"
          style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
        >
          +
        </span>
      </button>

      <div
        className="overflow-hidden transition-all duration-300"
        style={{
          maxHeight: isOpen ? '500px' : '0px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="px-5 pb-5 space-y-4">
          <h4 className="text-sm opacity-70 mb-3">
            Μαθήματα {language.name} στο Περιστέρι
          </h4>

          <ul className="space-y-2">
            {getContent().map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm opacity-80">
                <span className="text-primary mt-1">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => onCTAClick(language.name, audience)}
            className="mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-lg text-sm"
          >
            Ενδιαφέρομαι για {language.name}
          </button>
        </div>
      </div>
    </div>
  );
}

interface LanguageAccordionProps {
  audience: 'adult' | 'child';
  languages: { name: string; flag: string }[];
  onCTAClick: (language: string, audience: 'adult' | 'child') => void;
}

export function LanguageAccordion({ audience, languages, onCTAClick }: LanguageAccordionProps) {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden border border-border">
      {languages.map((language) => (
        <AccordionItem
          key={language.name}
          language={language}
          audience={audience}
          onCTAClick={onCTAClick}
        />
      ))}
    </div>
  );
}
