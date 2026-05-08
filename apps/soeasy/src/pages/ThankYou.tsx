import { CheckCircle2, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ThankYou() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full animate-in zoom-in duration-500">
        <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
        </div>
        
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Ευχαριστούμε!</h1>
        <p className="text-lg text-gray-600 mb-10">
          Το ραντεβού σας κατοχυρώθηκε επιτυχώς. Θα λάβετε σύντομα επιβεβαίωση από έναν εκπρόσωπό μας.
        </p>

        <div className="space-y-4">
          <Link 
            to="/" 
            className="flex items-center justify-center gap-2 w-full py-4 bg-primary text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 font-bold"
          >
            <Home className="w-5 h-5" />
            Επιστροφή στην Αρχική
          </Link>
          
          <p className="text-sm text-gray-400">
            Design & Support by ADIGITAL
          </p>
        </div>
      </div>
    </div>
  );
}
