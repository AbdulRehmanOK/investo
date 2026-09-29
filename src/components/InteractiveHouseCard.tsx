import OptimizedImage, { getOptimizedImageProps } from './OptimizedImage';
import { useLanguage } from '../i18n';
import HeroCardMotion from './HeroCardMotion';
import React, { useState } from 'react';
import { m as motion, AnimatePresence } from 'motion/react';
import { Hotspot, TabType } from '../types';
import { CheckCircle2, DollarSign, Calculator, Percent, Sparkles, Play, Award, ArrowUpRight, HelpCircle, X, Check } from 'lucide-react';

const hotspots: Hotspot[] = [
  {
    id: 'wohnbereich',
    name: 'Wohnbereich',
    top: '68%',
    left: '28%',
    title: 'PENTHOUSE RAUM',
    subtitle: 'Wohnbereich & Loft',
    description: 'Großzügige 3.2m Deckenhöhe, Fußbodenheizung und Kamin.',
    image: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'fassade',
    name: 'Holz-Fassade',
    top: '38%',
    left: '62%',
    title: 'NATUR-FASSADE',
    subtitle: 'Lärchenholz & Beton',
    description: 'Nachhaltiges, thermisch behandeltes Holz mit Sichtbeton.',
    image: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'verglasung',
    name: 'Panoramafenster',
    top: '55%',
    left: '78%',
    title: 'LICHTFLUT-DESIGN',
    subtitle: 'Triple-Panorama-Glas',
    description: 'Wärmeschutzverglasung für optimalen Lichteinfall.',
    image: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=600&q=80',
  },
];

interface InteractiveHouseCardProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onCtaClick: () => void;
}

export default function InteractiveHouseCard({ activeTab, onTabChange, onCtaClick }: InteractiveHouseCardProps) {
  const { t, locale } = useLanguage();
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot>(hotspots[0]);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  // Strategy interactive states
  const [budget, setBudget] = useState(350000);
  const [equity, setEquity] = useState(70000);

  // Mortgage/Financing calculations
  const interestRate = 4; // %
  const repaymentRate = 1.5; // %
  const totalLoan = Math.max(0, budget - equity);
  const monthlyRate = Math.round((totalLoan * ((interestRate + repaymentRate) / 100)) / 12);
  const rentalYield = 4.2; // % expected
  const monthlyRent = Math.round((budget * (rentalYield / 100)) / 12);
  const monthlyCashflow = monthlyRent - monthlyRate;

  return (
    <div className="w-full relative" id="interactive-showcase">
      <HeroCardMotion />
      {/* Main card background */}
      <div className="bg-white text-gray-900 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] flex flex-col relative z-10 border border-white/5 md:min-h-[580px]">
        
        {/* Upper Header: Tabs */}
        <div className="flex flex-wrap items-center gap-2.5 mb-6 md:mb-8" id="showcase-tabs">
          {(['strategie', 'finanzierung', 'immobilie'] as TabType[]).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                aria-pressed={isActive}
                aria-controls="hero-showcase-panel"
                onClick={() => onTabChange(tab)}
                className={`px-5 py-2 rounded-full text-xs font-sans font-semibold tracking-wide transition-all duration-300 cursor-pointer ${
                  isActive
                    ? 'bg-[#091726] text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200/80 border border-transparent'
                }`}
              >
                {t(tab === 'strategie' && 'Strategie')}
                {t(tab === 'finanzierung' && 'Finanzierung')}
                {t(tab === 'immobilie' && 'Immobilie')}
              </button>
            );
          })}
        </div>

        {/* Dynamic content wrapper with animation */}
        <div className="flex-1 flex flex-col" id="hero-showcase-panel">
          <AnimatePresence initial={false} mode="wait">
            
            {/* TAB 1: STRATEGIE */}
            {activeTab === 'strategie' && (
              <motion.div
                key="strategie-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="flex-1 flex flex-col justify-between"
              >
                <div>
                  <h2 className="text-xl md:text-2xl font-serif font-semibold text-[#091726] tracking-tight mb-2">{t("Ihre individuelle Investment-Strategie")}</h2>
                  <p className="text-sm text-gray-500 font-sans leading-relaxed mb-6">{t("Wir analysieren den Markt und stellen sicher, dass Ihre Wunsch-Immobilie perfekt zu Ihrer langfristigen Vermögensplanung passt.")}</p>

                  {/* Strategic Milestones */}
                  <div className="space-y-4">
                    {[
                      {
                        step: '01',
                        title: 'Analyse & Zielsetzung',
                        desc: 'Bedarfsanalyse, Eigenkapital-Prüfung & Cashflow-Vorgaben.',
                        status: 'completed',
                      },
                      {
                        step: '02',
                        title: 'Standort- & Bonitätsprüfung',
                        desc: 'Makro- und Mikrolagen-Prüfung in wachstumsstarken Regionen.',
                        status: 'completed',
                      },
                      {
                        step: '03',
                        title: 'Matching & Besichtigung',
                        desc: 'Präsentation handverlesener, renditestarker Off-Market Immobilien.',
                        status: 'active',
                      },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start p-3 rounded-xl transition-all duration-300 border ${
                          item.status === 'active'
                            ? 'bg-[#d4b27c]/10 border-[#d4b27c]/40 shadow-sm'
                            : 'bg-gray-50 border-gray-100'
                        }`}
                      >
                        <div className="mr-3 mt-0.5">
                          {item.status === 'completed' ? (
                            <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-investo-gold/20 flex items-center justify-center text-[#9c7b48] font-sans text-xs font-bold">
                              {t(item.step)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xs font-sans font-bold text-gray-800 uppercase tracking-wider flex items-center">
                            {t(item.title)}
                            {item.status === 'active' && (
                              <span className="ml-2 px-1.5 py-0.5 bg-investo-gold text-[#040911] text-[9px] font-sans font-extrabold rounded-md uppercase tracking-widest leading-none">{t("Aktiv")}</span>
                            )}
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{t(item.desc)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-investo-card/5 flex items-center justify-center text-[#091726]">
                      <Award className="w-5 h-5 text-investo-gold-dark" />
                    </div>
                    <div>
                      <p className="text-xs font-sans font-bold text-gray-800">{t("Eigene Strategie besprechen?")}</p>
                      <p className="text-[11px] text-gray-500">{t("Kostenloses 15-Minuten Erstgespräch vereinbaren.")}</p>
                    </div>
                  </div>
                  <button type="button" onClick={onCtaClick} aria-label={t("Eigene Strategie besprechen?")} className="flex items-center justify-center w-8 h-8 rounded-full bg-[#091726] text-white hover:bg-[#d4b27c] hover:text-[#040911] transition-all duration-300">
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {/* TAB 2: FINANZIERUNG */}
            {activeTab === 'finanzierung' && (
              <motion.div
                key="finanzierung-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="flex-1 flex flex-col justify-between"
              >
                <div>
                  <h2 className="text-xl md:text-2xl font-serif font-semibold text-[#091726] tracking-tight mb-2">{t("Finanzierungsrechner für Investoren")}</h2>
                  <p className="text-sm text-gray-500 font-sans leading-relaxed mb-6">{t("Berechnen Sie schnell und flexibel die monatliche Kreditrate sowie Ihren potenziellen monatlichen Cashflow.")}</p>

                  {/* Slider 1: Kaufpreis */}
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-sans font-bold text-gray-700 uppercase tracking-wider">{t("Kaufpreis")}</span>
                      <span className="text-sm font-mono font-bold text-[#091726]">€ {budget.toLocaleString(locale)}</span>
                    </div>
                    <input
                      type="range"
                      aria-label={t("Kaufpreis")}
                      min="100000"
                      max="1500000"
                      step="25000"
                      value={budget}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setBudget(val);
                        if (equity > val * 0.5) setEquity(Math.round(val * 0.2));
                      }}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#d4b27c]"
                    />
                  </div>

                  {/* Slider 2: Eigenkapital */}
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-sans font-bold text-gray-700 uppercase tracking-wider flex items-center">{t("Eigenkapital")}<span className="ml-1 text-gray-400 text-[10px] lowercase font-normal">({Math.round((equity/budget)*100)}%)</span>
                      </span>
                      <span className="text-sm font-mono font-bold text-[#091726]">€ {equity.toLocaleString(locale)}</span>
                    </div>
                    <input
                      type="range"
                      aria-label={t("Eigenkapital")}
                      min="10000"
                      max={Math.round(budget * 0.6)}
                      step="5000"
                      value={equity}
                      onChange={(e) => setEquity(Number(e.target.value))}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#d4b27c]"
                    />
                  </div>

                  {/* Calculated metrics in a grid */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-left">
                      <span className="text-[10px] font-sans text-gray-500 uppercase tracking-wider block">{t("Kreditbedarf")}</span>
                      <span className="text-base font-mono font-bold text-[#091726]">€ {t(totalLoan.toLocaleString(locale))}</span>
                    </div>
                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-left">
                      <span className="text-[10px] font-sans text-gray-500 uppercase tracking-wider block">{t("Est. Sollzins")}</span>
                      <span className="text-base font-mono font-bold text-[#091726] flex items-center">
                        {interestRate}%
                      </span>
                    </div>
                    <div className="bg-[#091726]/5 border border-[#091726]/10 rounded-xl p-3 text-left">
                      <span className="text-[10px] font-sans text-gray-600 uppercase tracking-wider block">{t("Soll-Monatsrate")}</span>
                      <span className="text-base font-mono font-bold text-[#091726]">€ {monthlyRate}</span>
                    </div>
                    <div className={`border rounded-xl p-3 text-left transition-colors duration-300 ${
                      monthlyCashflow >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'
                    }`}>
                      <span className="text-[10px] font-sans text-gray-600 uppercase tracking-wider block">{t("Mtl. Cashflow (Est.)")}</span>
                      <span className={`text-base font-mono font-bold ${monthlyCashflow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {t(monthlyCashflow >= 0 ? '+' : '')}€ {monthlyCashflow}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/50 flex items-start space-x-2">
                  <Sparkles className="w-4.5 h-4.5 text-investo-gold-dark mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-900 leading-relaxed font-sans font-medium">{t("Investoren-Tipp: Durch steuerliche Abschreibung (AfA) und den Abzug der Darlehenszinsen kann sich Ihr realer Cashflow in einem typischen Beispiel um rund 300 € monatlich verbessern.")}</p>
                </div>
              </motion.div>
            )}

            {/* TAB 3: IMMOBILIE (DEFAULT AS IN REFERENCE MOCKUP) */}
            {activeTab === 'immobilie' && (
              <motion.div
                key="immobilie-tab"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="flex-1 flex flex-col justify-between"
              >
                <div className="mb-4">
                  <h2 className="text-xl md:text-2xl font-serif font-semibold text-[#091726] tracking-tight mb-2">{t("Von der Strategie zur passenden Kapitalanlage.")}</h2>
                  <p className="text-sm text-gray-500 font-sans leading-relaxed">{t("Wir prüfen Ziele, Budget, Finanzierung und Objektart, bevor ausgewählte Immobilien empfohlen werden.")}</p>
                </div>

                {/* Overlapping Interactive Property Container */}
                <div className="relative w-full min-h-[230px] aspect-[4/3] md:aspect-[16/10] bg-gray-100 rounded-2xl overflow-hidden shadow-inner group">
                  {/* Real Berlin Apartment Building */}
                  <OptimizedImage
                    src="/images/berlin-apartments.jpg"
                    loading="eager"
                    fetchPriority="high"
                    sizes="(min-width: 1280px) 560px, (min-width: 1024px) 50vw, calc(100vw - 80px)"
                    alt={t("Wohngebäude in Berlin – Symbolbild")}
                    decoding="async"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-[40%_center] transition-transform duration-700 group-hover:scale-102"
                  />

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent pointer-events-none" />

                  {/* Dynamic Hotspots */}
                  {hotspots.map((spot) => {
                    const isSelected = selectedHotspot.id === spot.id;
                    return (
                      <button
                        key={spot.id}
                        onClick={() => setSelectedHotspot(spot)}
                        className="absolute w-8 h-8 flex items-center justify-center cursor-pointer transition-all duration-300 z-20 group/spot"
                        style={{ top: spot.top, left: spot.left }}
                      >
                        {/* Outer Pulse Ring */}
                        <span className={`absolute inset-0 rounded-full bg-investo-gold opacity-50 hotspot-pulse ${isSelected ? 'scale-130' : 'scale-100'}`} />
                        {/* Inner Core */}
                        <span className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${isSelected ? 'bg-white scale-110 shadow-lg' : 'bg-investo-gold scale-100'}`} />
                        
                        {/* Hover Tooltip (Desktop) */}
                        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-[#091726] text-white text-[10px] font-sans font-bold uppercase tracking-wider py-1 px-2.5 rounded shadow-xl opacity-0 scale-90 group-hover/spot:opacity-100 group-hover/spot:scale-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-30">
                          {t(spot.name)}
                        </span>
                      </button>
                    );
                  })}

                  {/* Floating Beige interior details card exactly matching reference */}
                  <div className="absolute top-4 right-4 md:top-6 md:right-6 w-36 md:w-44 bg-[#f4efe8] p-2.5 md:p-3 rounded-2xl border border-white/40 shadow-xl flex flex-col text-left transition-all duration-500 hover:translate-y-[-2px] z-30">
                    <span className="text-[8px] md:text-[9px] font-sans font-extrabold tracking-[0.18em] text-[#091726]/60 mb-2 uppercase">{t("STRATEGISCH AUSGEWÄHLT")}</span>

                    {/* Small interior visual */}
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-2 shadow-sm bg-gray-200">
                      <AnimatePresence initial={false} mode="wait">
                        <motion.img
                          key={selectedHotspot.id}
                          {...getOptimizedImageProps(selectedHotspot.image)}
                    sizes="(min-width: 768px) 160px, 124px"
                          alt={t(selectedHotspot.name)}
                          referrerPolicy="no-referrer"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="w-full h-full object-cover"
                        />
                      </AnimatePresence>

                      {/* Golden Play button overlay */}
                      <button 
                        onClick={() => setIsVideoModalOpen(true)}
                        aria-label={t("Video abspielen")}
                        className="absolute inset-0 m-auto w-7 h-7 md:w-8 md:h-8 rounded-full bg-investo-gold text-[#040911] flex items-center justify-center shadow-md hover:bg-white hover:scale-110 transition-all duration-300 cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current ml-0.5" />
                      </button>
                    </div>

                    {/* Changing Metadata */}
                    <AnimatePresence initial={false} mode="wait">
                      <motion.div
                        key={selectedHotspot.id}
                        initial={{ opacity: 0, x: 5 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -5 }}
                        transition={{ duration: 0.2 }}
                      >
                        <h3 className="text-[10px] md:text-[11px] font-sans font-bold text-[#091726] uppercase tracking-wider truncate">{t("PASSEND ZUM ANLEGERPROFIL")}</h3>
                        <p className="text-[9px] text-[#091726]/70 leading-normal mt-0.5">{t("Standort, Objektart und Strategie")}</p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  
                  {/* Subtle dynamic background descriptor on bottom left */}
                  <div className="absolute bottom-3 left-3 md:bottom-4 md:left-4 bg-[#142131] px-3 py-1.5 rounded-lg border border-white/10 text-white/90 text-[10px] font-sans max-w-[50%] pointer-events-none z-10 transition-opacity duration-300 hidden sm:block">
                    <p className="font-bold uppercase tracking-wider text-investo-gold">{t("DATENBASIERTE PRÜFUNG")}</p>
                    <p className="text-white/70 leading-normal mt-0.5 text-[9px] line-clamp-1">{t("Standort, Vermietbarkeit, Finanzierung und Risiko.")}</p>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* Interactive Video Modal Overlay */}
      <AnimatePresence>
        {isVideoModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsVideoModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-[#091726] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-10"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsVideoModalOpen(false)}
                className="absolute top-4 right-4 p-2 bg-black/40 text-white hover:text-investo-gold hover:bg-black/60 rounded-full transition-colors duration-200 cursor-pointer z-20"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="p-6 md:p-8 text-left">
                <span className="text-[10px] font-sans font-bold tracking-widest text-investo-gold uppercase mb-2 block">{t("3D VIRTUAL TOUR & SHOWCASE")}</span>
                <h2 className="text-xl md:text-2xl font-serif text-white mb-4">{t("Virtueller Rundgang: ")}{t(selectedHotspot.name)}
                </h2>

                {/* Simulated Tour Frame */}
                <div className="relative aspect-video rounded-xl overflow-hidden bg-black/50 border border-white/5 flex items-center justify-center">
                  <OptimizedImage
                    {...getOptimizedImageProps(selectedHotspot.image)}
                    sizes="(min-width: 768px) 608px, calc(100vw - 80px)"
                    alt={t("Tour frame")}
                    className="absolute inset-0 w-full h-full object-cover opacity-40 blur-[2px]"
                  />
                  <div className="relative z-10 text-center flex flex-col items-center p-6">
                    <div className="w-16 h-16 rounded-full bg-investo-gold/10 border border-investo-gold/30 text-investo-gold flex items-center justify-center mb-4 animate-pulse">
                      <Play className="w-6 h-6 fill-current ml-1" />
                    </div>
                    <p className="text-sm text-white font-sans font-semibold">{t("Starte hochauflösenden Video-Rundgang")}</p>
                    <p className="text-xs text-white/60 font-sans mt-1 max-w-sm">{t("Erleben Sie die Premium-Bauqualität und Raumaufteilung hautnah in unserem interaktiven 4K Video-Walkthrough.")}</p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="text-white/80 text-xs font-sans max-w-md">
                    <p className="font-semibold text-white">{t(selectedHotspot.title)} — {t(selectedHotspot.subtitle)}</p>
                    <p className="text-white/60 mt-0.5">{t(selectedHotspot.description)}</p>
                  </div>
                  <button
                    onClick={() => setIsVideoModalOpen(false)}
                    className="px-5 py-2.5 bg-investo-gold text-black text-xs font-sans font-bold tracking-wider rounded-lg hover:bg-white transition-all duration-200 shrink-0 uppercase"
                  >{t("Schließen")}</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
