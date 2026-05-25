// ============================================================
// Navbar — responsive navigation with language toggle
// Design: Elegant Calculus / Professional Mathematical Studio
// Desktop: horizontal nav bar with section links
// Mobile: hamburger menu with full-screen drawer
// ============================================================
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useLang } from "@/contexts/LangContext";
import { Menu, X, Sigma } from "lucide-react";

interface NavbarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
}

export default function Navbar({ activeSection, onNavigate }: NavbarProps) {
  const { t, toggleLang } = useLang();
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const sections = [
    { id: "part1", label: t.navPart1, route: "/" },
    { id: "definite", label: t.navDefinite, route: "/definite" },
    { id: "formulae", label: t.navPart2, route: "/formulae" },
    { id: "part3", label: t.navPart3, route: "/" },
  ];

  const handleNav = (id: string, route: string) => {
    if (route === "/") {
      setLocation("/");
      window.setTimeout(() => onNavigate(id), 0);
    } else {
      setLocation(route);
    }
    setMenuOpen(false);
  };

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-[#080B13]/88 backdrop-blur-xl shadow-lg shadow-black/30 border-b border-[#F4EDE0]/8"
            : "bg-[#080B13]/72 backdrop-blur-md border-b border-[#F4EDE0]/6"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F4EDE0] via-[#C8A45D] to-[#7CA7D9] flex items-center justify-center flex-shrink-0 shadow-md shadow-[#C8A45D]/18 ring-1 ring-white/20">
                <Sigma className="w-4 h-4 text-[#080B13]" strokeWidth={2.5} />
              </div>
              <div className="min-w-0">
                <div className="text-[#F4EDE0] font-bold text-sm sm:text-base leading-tight truncate" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
                  {t.appTitle}
                </div>
                <div className="text-[#C8A45D] text-[10px] sm:text-xs leading-tight opacity-80">
                  {t.appSubtitle}
                </div>
              </div>
            </div>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1">
              {sections.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => handleNav(s.id, s.route)}
                  className={`relative px-3 py-1.5 text-sm rounded-full transition-all duration-200 ${
                    activeSection === s.id
                      ? "text-[#C8A45D] bg-[#C8A45D]/10"
                      : "text-[#F4EDE0]/70 hover:text-[#F4EDE0] hover:bg-white/7"
                  }`}
                >
                    <span className="text-[#7CA7D9] text-xs mr-1 font-mono">0{i + 1}</span>
                  {s.label}
                  {activeSection === s.id && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-[#C8A45D] rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2">
              {/* Language toggle */}
              <button
                onClick={toggleLang}
                className="px-3 py-1.5 text-xs font-semibold rounded-full border border-[#C8A45D]/45 bg-[#C8A45D]/6 text-[#C8A45D] hover:bg-[#C8A45D]/12 transition-all duration-200 tracking-wide"
              >
                {t.langToggle}
              </button>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="md:hidden p-2 rounded-full text-[#F4EDE0]/70 hover:text-[#F4EDE0] hover:bg-white/7 transition-colors"
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
          <div className="border-t border-[#F4EDE0]/10 bg-[#080B13]/96 backdrop-blur-xl px-4 py-3 space-y-1">
            {sections.map((s, i) => (
              <button
                key={s.id}
                onClick={() => handleNav(s.id, s.route)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  activeSection === s.id
                    ? "text-[#C8A45D] bg-[#C8A45D]/10"
                    : "text-[#F4EDE0]/70 hover:text-[#F4EDE0] hover:bg-white/7"
                }`}
              >
                <span className="text-[#7CA7D9] text-xs font-mono w-5">0{i + 1}</span>
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
