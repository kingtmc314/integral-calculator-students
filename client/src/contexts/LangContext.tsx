// ============================================================
// LangContext — bilingual (EN/ZH) state management
// ============================================================
import { createContext, useContext, useState, ReactNode } from "react";
import { Lang, translations } from "@/lib/i18n";

interface LangContextType {
  lang: Lang;
  t: typeof translations.en;
  toggleLang: () => void;
}

const LangContext = createContext<LangContextType>({
  lang: "en",
  t: translations.en,
  toggleLang: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  const toggleLang = () => setLang((l) => (l === "en" ? "zh" : "en"));

  return (
    <LangContext.Provider
      value={{ lang, t: translations[lang] as typeof translations.en, toggleLang }}
    >
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
