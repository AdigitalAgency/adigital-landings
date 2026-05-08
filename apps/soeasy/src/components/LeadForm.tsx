import { useState, useEffect } from 'react';
import { saveLead } from '../utils/crmStorage';

interface LeadFormProps {
  id?: string;
  variant?: 'hero' | 'default';
  prefilledLanguage?: string;
  prefilledAudience?: string;
}

export function LeadForm({ id = 'lead-form', variant = 'default', prefilledLanguage, prefilledAudience }: LeadFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    audience: prefilledAudience || '',
    language: prefilledLanguage || '',
  });

  useEffect(() => {
    if (prefilledLanguage || prefilledAudience) {
      setFormData(prev => ({
        ...prev,
        language: prefilledLanguage || prev.language,
        audience: prefilledAudience || prev.audience,
      }));
    }
  }, [prefilledLanguage, prefilledAudience]);

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    try {
      // Save to Supabase (Online Database)
      await saveLead({
        ...formData,
        status: 'new',
        notes: '',
      });

      // Try to send to Formspree, but don't fail if it doesn't work
      try {
        await fetch('https://formspree.io/f/YOUR_FORM_ID', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        });
      } catch (e) {
        console.warn('Email notification failed, but lead was saved to CRM.');
      }

      // If we got here, Supabase save worked (or we would be in the catch block)
      setStatus('success');
      
      // Track conversion events
      if (typeof window !== 'undefined') {
        if ((window as any).gtag) {
          (window as any).gtag('event', 'conversion', {
            'send_to': 'AW-CONVERSION_ID/CONVERSION_LABEL',
          });
        }
        if ((window as any).fbq) {
          (window as any).fbq('track', 'Lead');
        }
      }
      setFormData({ name: '', phone: '', audience: '', language: '' });
      setTimeout(() => setStatus('idle'), 5000);
    } catch (error) {
      console.error('Form error:', error);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  return (
    <form
      id={id}
      onSubmit={handleSubmit}
      className={`rounded-2xl p-6 md:p-8 ${variant === 'hero' ? 'bg-white shadow-lg' : 'bg-white/90 backdrop-blur-sm shadow-xl'}`}
      style={{
        border: '1px solid rgba(255, 141, 1, 0.2)',
        animation: 'fadeIn 0.6s ease-out',
      }}
    >
      <div className="space-y-4">
        <div>
          <label htmlFor={`${id}-name`} className="block mb-2 text-sm opacity-70">
            Όνομα
          </label>
          <input
            id={`${id}-name`}
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            placeholder="Το όνομά σας"
          />
        </div>

        <div>
          <label htmlFor={`${id}-phone`} className="block mb-2 text-sm opacity-70">
            Τηλέφωνο
          </label>
          <input
            id={`${id}-phone`}
            type="tel"
            required
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            placeholder="Το τηλέφωνό σας"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${id}-audience`} className="block mb-2 text-sm opacity-70">
              Για ποιον
            </label>
            <select
              id={`${id}-audience`}
              required
              value={formData.audience}
              onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
              className="w-full px-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%232B2520' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}
            >
              <option value="">Επιλέξτε...</option>
              <option value="child">Παιδί</option>
              <option value="adult">Ενήλικας</option>
            </select>
          </div>

          <div>
            <label htmlFor={`${id}-language`} className="block mb-2 text-sm opacity-70">
              Γλώσσα
            </label>
            <select
              id={`${id}-language`}
              required
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              className="w-full px-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all appearance-none cursor-pointer"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%232B2520' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center' }}
            >
              <option value="">Επιλέξτε...</option>
              <option value="Αγγλικά">Αγγλικά</option>
              <option value="Γαλλικά">Γαλλικά</option>
              <option value="Γερμανικά">Γερμανικά</option>
              <option value="Ισπανικά">Ισπανικά</option>
              <option value="Ιταλικά">Ιταλικά</option>
              <option value="Κινέζικα">Κινέζικα</option>
              <option value="Ρωσικά">Ρωσικά</option>
              <option value="Αραβικά">Αραβικά</option>
              <option value="Τουρκικά">Τουρκικά</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="w-full py-4 px-6 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-[1.02] disabled:opacity-50"
        >
          {status === 'loading' ? 'Αποστολή...' : 'Αποστολή'}
        </button>

        {status === 'success' && (
          <div className="text-center text-green-600 p-3 bg-green-50 rounded-lg animate-pulse font-medium">
            Ευχαριστούμε! Θα επικοινωνήσουμε σύντομα.
          </div>
        )}

        {status === 'error' && (
          <div className="text-center text-red-600 p-3 bg-red-50 rounded-lg font-medium">
            Κάτι πήγε στραβά. Δοκιμάστε ξανά ή καλέστε μας.
          </div>
        )}
      </div>
    </form>
  );
}
