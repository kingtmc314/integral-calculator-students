// ============================================================
// Navbar — responsive navigation with language toggle
// Design: Dark Academic / Chalkboard
// Desktop: horizontal nav bar with section links
// Mobile: hamburger menu with full-screen drawer
// ============================================================
import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LangContext";
import { Menu, X, Sigma } from "lucide-react";

interface NavbarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
}

export default function Navbar({ activeSection, onNavigate }: NavbarProps) {
  const { t, toggleLang } = useLang();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const sections = [
    { id: "part1", label: t.navPart1 },
    { id: "part2", label: t.navPart2 },
    { id: "part3", label: t.navPart3 },
  ];

  const handleNav = (id: string) => {
    onNavigate(id);
    setMenuOpen(false);
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#1E2433]/95 backdrop-blur-md shadow-lg shadow-black/30"
            : "bg-[#1E2433]"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D4A843] to-[#B8860B] flex items-center justify-center flex-shrink-0">
                <Sigma className="w-4 h-4 text-[#1E2433]" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div className="text-[#E8DFC8] font-bold text-sm sm:text-base leading-tight truncate" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                  {t.appTitle}
                </div>
                <div className="text-[#D4A843] text-[10px] sm:text-xs leading-tight opacity-80">
                  {t.appSubtitle}
                </div>
              </div>
            </div>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {sections.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => handleNav(s.id)}
                  className={`relative px-3 py-1.5 text-sm rounded-md transition-all duration-200 ${
                    activeSection === s.id
                      ? "text-[#D4A843] bg-[#D4A843]/10"
                      : "text-[#E8DFC8]/70 hover:text-[#E8DFC8] hover:bg-white/5"
                  }`}
                >
                  <span className="text-[#6B9BD2] text-xs mr-1 font-mono">0{i + 1}</span>
                  {s.label}
                  {activeSection === s.id && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#D4A843] rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              {/* Language toggle */}
              <button
                onClick={toggleLang}
                className="px-3 py-1.5 text-xs font-semibold rounded-md border border-[#D4A843]/40 text-[#D4A843] hover:bg-[#D4A843]/10 transition-all duration-200 tracking-wide"
              >
                {t.langToggle}
              </button>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="md:hidden p-2 rounded-md text-[#E8DFC8]/70 hover:text-[#E8DFC8] hover:bg-white/5 transition-colors"
                aria-label="Toggle menu"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-out ${
            menuOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="border-t border-white/10 bg-[#252D3D] px-4 py-3 space-y-1">
            {sections.map((s, i) => (
              <button
                key={s.id}
                onClick={() => handleNav(s.id)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  activeSection === s.id
                    ? "text-[#D4A843] bg-[#D4A843]/10"
                    : "text-[#E8DFC8]/70 hover:text-[#E8DFC8] hover:bg-white/5"
                }`}
              >
                <span className="text-[#6B9BD2] text-xs font-mono w-5">0{i + 1}</span>
                <span className="text-sm">{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Spacer */}
      <div className="h-16" />
    </>
  );
}
