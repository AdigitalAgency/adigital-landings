import { useState, useEffect } from 'react';

interface HeaderProps {
  onCTAClick: () => void;
}

export function Header({ onCTAClick }: HeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const menuItems = [
    { label: 'Γλώσσες', href: '#languages' },
    { label: 'Γιατί εμάς', href: '#why-us' },
    { label: 'Μαρτυρίες', href: '#testimonials' },
    { label: 'Πώς ξεκινάς', href: '#process' },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setIsMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      const headerOffset = 80;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled || isMenuOpen ? 'bg-white shadow-md py-2' : 'bg-transparent py-4'
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-between">
        {/* Logo */}
        <div 
          className="flex items-center gap-2 cursor-pointer z-50" 
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setIsMenuOpen(false);
          }}
        >
          <img src="/logo-soeasy.png" alt="SoEasy Logo" className="h-10 md:h-14 object-contain" />
        </div>

        {/* Desktop Menu */}
        <nav className="hidden md:flex items-center gap-6">
          {menuItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-base font-bold text-navy hover:text-primary transition-colors tracking-tight"
              onClick={(e) => handleNavClick(e, item.href)}
            >
              {item.label}
            </a>
          ))}
          
          <div className="flex items-center gap-4 ml-4">
            <a href="tel:2104441909" className="text-navy hover:text-primary transition-all hover:scale-110" title="Καλέστε μας">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            </a>
            <a href="mailto:peristeri@soeasy.gr" className="text-navy hover:text-primary transition-all hover:scale-110" title="Στείλτε μας Email">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            </a>
            <button
              onClick={onCTAClick}
              className="px-6 py-2.5 bg-primary text-white rounded-full text-sm font-black shadow-md hover:shadow-lg transition-all hover:scale-105 active:scale-95 uppercase tracking-wider"
            >
              ΚΛΕΙΣΕ ΡΑΝΤΕΒΟΥ
            </button>
          </div>
        </nav>

        {/* Burger Button (Mobile Only) */}
        <button
          className="md:hidden z-50 p-2 text-navy"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle Menu"
        >
          {isMenuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          )}
        </button>

        {/* Mobile Menu Overlay */}
        <div
          className={`fixed inset-0 bg-white z-40 flex flex-col items-center justify-center gap-8 transition-all duration-300 md:hidden ${
            isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {menuItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-2xl font-black text-navy hover:text-primary transition-colors"
              onClick={(e) => handleNavClick(e, item.href)}
            >
              {item.label}
            </a>
          ))}
          <button
            onClick={() => {
              onCTAClick();
              setIsMenuOpen(false);
            }}
            className="mt-4 px-8 py-4 bg-primary text-white rounded-full text-lg font-black shadow-lg uppercase tracking-wider"
          >
            ΚΛΕΙΣΕ ΡΑΝΤΕΒΟΥ
          </button>
        </div>
      </div>
    </header>
  );
}
