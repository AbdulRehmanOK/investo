import AsyncContentBoundary from './components/AsyncContentBoundary';
import OptimizedImage from './components/OptimizedImage';
import { useLanguage } from './i18n';
import { X } from 'lucide-react';
import React, { lazy, Suspense, useEffect, useState } from 'react';
import Navbar from './components/Navbar';
import HeroShowcase from './components/HeroShowcase';
import MetricsFooter from './components/MetricsFooter';
import PromiseSection from './components/PromiseSection';
import InvestmentPathSection from './components/InvestmentPathSection';
import ProblemSolutionSection from './components/ProblemSolutionSection';
import StrategyCheckSection from './components/StrategyCheckSection';
import InvestmentPhilosophySection from './components/InvestmentPhilosophySection';
import TargetGroupsSection from './components/TargetGroupsSection';
import WhyInvestoSection from './components/WhyInvestoSection';
import TrustAuthoritySection from './components/TrustAuthoritySection';
import FinancingPartnersSection from './components/FinancingPartnersSection';
import FaqSection from './components/FaqSection';
import StrategyDecisionSection from './components/StrategyDecisionSection';
import Footer from './components/Footer';
const LegalPage = lazy(() => import('./components/LegalPage'));
const LeadForm = lazy(() => import('./components/LeadForm'));
const ThankYouPage = lazy(() => import('./components/LeadForm').then(module => ({ default: module.ThankYouPage })));

function ScrollToHash() {
  useEffect(() => {
    if (!window.location.hash) return;
    document.documentElement.classList.add('render-all-sections');
    const frame = requestAnimationFrame(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, []);
  return null;
}

export default function App() {
  const { t } = useLanguage();
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [hasRequestedForm, setHasRequestedForm] = useState(false);
  const openForm = () => { setHasRequestedForm(true); setIsCheckModalOpen(true); };
  const loading = <div role="status" className="min-h-screen flex items-center justify-center text-investo-gold">{t('Wird geladen …')}</div>;
  const loadError = <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-5 p-6 text-center"><p>{t('Inhalt konnte nicht geladen werden.')}</p><button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-investo-gold px-5 py-3 text-[#091726]">{t('Seite neu laden')}</button><a href="/" className="text-investo-gold underline">{t('Zur Startseite')}</a></div>;
  const formError = isCheckModalOpen ? <div role="alert" className="fixed inset-0 z-[100] bg-[#16273D] flex flex-col items-center justify-center gap-5 p-6 text-center"><p>{t('Inhalt konnte nicht geladen werden.')}</p><button type="button" onClick={() => window.location.reload()} className="rounded-xl bg-investo-gold px-5 py-3 text-[#091726]">{t('Seite neu laden')}</button><button type="button" onClick={() => setIsCheckModalOpen(false)} className="text-investo-gold underline">{t('Schließen')}</button></div> : null;
  const pathname = typeof window === 'undefined' ? '/' : window.location.pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/danke') return <AsyncContentBoundary fallback={loadError}><Suspense fallback={loading}><ThankYouPage /></Suspense></AsyncContentBoundary>;
  if (pathname === '/impressum' || pathname === '/datenschutz') return <AsyncContentBoundary fallback={loadError}><Suspense fallback={loading}><LegalPage page={pathname.slice(1) as 'impressum' | 'datenschutz'} /><ScrollToHash /></Suspense></AsyncContentBoundary>;

  return (
    <div className="min-h-screen bg-[#16273D] relative flex flex-col" id="investo-root">
      
      {/* 1. Hero Block Wrapper with localized dark background and mountains */}
      <div className="relative w-full overflow-hidden flex flex-col pt-24 pb-16 min-h-screen" id="hero-wrapper">
        
        {/* Dramatic Background Image & High-end Gradients */}
        <div className="hidden lg:block absolute inset-0 z-0 pointer-events-none" id="bg-visual-layer">
          {/* Mountain range background */}
          <OptimizedImage loading="lazy" fetchPriority="low" sizes="640px"
            src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80"
            alt={t("Majestätische Alpengipfel")}
            referrerPolicy="no-referrer"
            className="hidden lg:block absolute inset-0 w-full h-full object-cover opacity-[0.12] md:opacity-[0.15] select-none"
          />
          
          {/* Layered custom gradients for atmospheric lighting */}
          <div className="absolute inset-0 bg-gradient-to-tr from-[#16273D] via-[#16273D]/80 to-[#16273D]/95" />
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at top right, rgba(30,58,138,0.10), transparent 65%), radial-gradient(ellipse at bottom left, rgba(8,47,73,0.07), transparent 65%)' }}
          />
        </div>

        {/* Brand Header (Navbar) */}
        <Navbar onCheckClick={() => openForm()} />

        {/* Primary Hero Section Stage */}
        <main className="relative z-10 flex-1 flex flex-col justify-center px-4 md:px-8 lg:px-12 pt-16 pb-10 max-w-7xl mx-auto w-full">
          
          <HeroShowcase onCtaClick={openForm} />

          {/* Bottom Section (Metrics & Features Footer) */}
          <div className="mt-auto border-t border-white/5 pt-8 md:pt-10">
            <MetricsFooter 
              onLearnMoreClick={() => openForm()}
              onMetricItemClick={(metricName) => {
                openForm();
              }}
            />
          </div>

        </main>
      </div>

      {/* 2. Promise / Brand value section from design reference mockup (crisp elegant beige theme) */}
      <Suspense fallback={null}><PromiseSection /></Suspense>

      {/* 3. Strategy Check details section (crisp elegant white theme) */}
      <Suspense fallback={null}><StrategyCheckSection onStartClick={() => openForm()} /></Suspense>

      {/* 4. Problem & Solution split section from reference mockup (dark slate theme with VS element) */}
      <Suspense fallback={null}><ProblemSolutionSection /></Suspense>

      {/* 5. Five-step Investment Path timeline section from reference mockup (dark slate / gold outline theme) */}
      <Suspense fallback={null}><InvestmentPathSection onCtaClick={() => openForm()} /></Suspense>


      {/* 6. Investment Philosophy section (crisp elegant white theme with wave) */}
      <Suspense fallback={null}><InvestmentPhilosophySection onCtaClick={() => openForm()} /></Suspense>

      {/* 8. Target Groups section (deep space-blue/gold theme with connection tree) */}
      <Suspense fallback={null}><TargetGroupsSection onCtaClick={() => openForm()} /></Suspense>

      {/* 9. Warum Investo comparison section (mockup matched, split layout with gold glowing line and details popups) */}
      <Suspense fallback={null}><WhyInvestoSection onCtaClick={() => openForm()} /></Suspense>

      {/* 10. Trust & Authority section (mockup matched, with autoplay interactive video, dual-portrait testimonial, and statistics row) */}
      <Suspense fallback={null}><TrustAuthoritySection /></Suspense>

      {/* 11. Financing Partner Network section with continuous infinite logo marquee */}
      <Suspense fallback={null}><FinancingPartnersSection /></Suspense>

      {/* 12. FAQ Section (mockup matched, with gold accents and sequential accordion) */}
      <Suspense fallback={null}><FaqSection onCtaClick={() => openForm()} /></Suspense>

      {/* 12. Abschluss & Strategie Section (mockup matched, with step timeline, dual-portrait card elements, action options and highlights bar) */}
      <StrategyDecisionSection 
        onCtaClick={() => openForm()}
        onContactClick={() => openForm()}
      />

      {/* 13. Brand Footer Section */}
      <Footer onContactClick={() => openForm()} />

      {hasRequestedForm && <AsyncContentBoundary fallback={formError}><Suspense fallback={isCheckModalOpen ? <div className="fixed inset-0 z-[100] bg-black/75 flex items-center justify-center" role="dialog" aria-modal="true" aria-label={t("Wird geladen …")} onKeyDown={event => { if (event.key === "Escape") setIsCheckModalOpen(false); }}><button type="button" autoFocus aria-label={t("Schließen")} onClick={() => setIsCheckModalOpen(false)} className="absolute top-6 right-6 p-3 text-white"><X aria-hidden="true" /></button><p role="status" className="text-investo-gold">{t('Wird geladen …')}</p></div> : null}>
        <LeadForm open={isCheckModalOpen} onClose={() => setIsCheckModalOpen(false)} />
      </Suspense></AsyncContentBoundary>}
      <ScrollToHash />
    </div>
  );
}
