import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Check, Menu, X } from "lucide-react";
import { useLang } from "@/contexts/LangContext";

export default function Navbar({
  activeSection,
}: {
  activeSection: string;
  onNavigate?: (section: string) => void;
}) {
  const { lang, toggleLang } = useLang();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const items = [
    { id: "part1", route: "/", zh: "不定積分", en: "Indefinite integral" },
    {
      id: "definite",
      route: "/definite",
      zh: "定積分",
      en: "Definite integral",
    },
    {
      id: "formulae",
      route: "/formulae",
      zh: "公式整理",
      en: "Formula library",
    },
    {
      id: "part4",
      route: "/multi",
      zh: "多題處理模式",
      en: "Multi-Problem Mode",
    },
  ];
  return (
    <>
      <header className="mobile-bar">
        <Link href="/" className="brand">
          <span className="brand-mark">∫</span>
          <span>
            Integral<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            className="language-button"
            onClick={toggleLang}
            aria-label={lang === "zh" ? "Switch to English" : "切換至繁體中文"}
          >
            {lang === "zh" ? "EN" : "繁中"}
          </button>
          <button
            className="icon-button"
            aria-expanded={open}
            aria-controls="studio-nav"
            aria-label={lang === "zh" ? "開啟導覽" : "Open navigation"}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </header>
      {open && (
        <button
          className="nav-backdrop"
          aria-label={lang === "zh" ? "關閉導覽" : "Close navigation"}
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="studio-nav"
        className={`studio-sidebar ${open ? "is-open" : ""}`}
      >
        <Link
          href="/"
          className="brand desktop-brand"
          onClick={() => setOpen(false)}
        >
          <span className="brand-mark">∫</span>
          <span>
            Integral<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="sidebar-kicker">HKDSE M2 · MATH STUDIO</div>
        <div className="nav-caption">
          {lang === "zh" ? "你的積分工作室" : "YOUR WORKSPACE"}
        </div>
        <nav
          className="studio-navigation"
          aria-label={lang === "zh" ? "主導覽" : "Main navigation"}
        >
          {items.map((item, i) => (
            <Link
              key={item.id}
              href={item.route}
              onClick={() => {
                setOpen(false);
                window.scrollTo(0, 0);
              }}
              aria-current={item.id === activeSection ? "page" : undefined}
              className={`studio-nav-link ${item.id === activeSection ? "active" : ""}`}
            >
              <span className="nav-number">0{i + 1}</span>
              <span>{lang === "zh" ? item.zh : item.en}</span>
              {item.id === activeSection && (
                <ArrowUpRight size={16} className="ml-auto" />
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="scope-chip">
            <Check size={13} /> DSE M2
          </div>
          <p>
            {lang === "zh"
              ? "精確答案，清晰思考。"
              : "Exact answers. Clear thinking."}
          </p>
          <span>
            {lang === "zh"
              ? "以課程內的方法，走好每一步。"
              : "One curriculum-based step at a time."}
          </span>
          <div className="sidebar-language">
            <span>LANGUAGE</span>
            <button onClick={toggleLang}>
              {lang === "zh" ? "English ↗" : "繁體中文 ↗"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
