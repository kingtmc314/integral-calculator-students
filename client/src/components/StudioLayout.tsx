import type { ReactNode } from "react";
import { ArrowUpRight, Check } from "lucide-react";
import { Link } from "wouter";
import Navbar from "./Navbar";
import { useLang } from "@/contexts/LangContext";
export default function StudioLayout({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  const { lang } = useLang();
  return (
    <div className="studio-app">
      <Navbar activeSection={active} />
      <div className="studio-main">
        <div className="workspace-bar">
          <span>
            WORKSPACE{" "}
            <span className="crumb">
              / {lang === "zh" ? "積分工作室" : "Integration studio"}
            </span>
          </span>
          <span className="workspace-status">
            <span /> {lang === "zh" ? "DSE M2 範圍" : "DSE M2 methods"}
          </span>
        </div>
        <main className="workspace-content">{children}</main>
        <footer className="studio-footer">
          <span>
            Integral.{" "}
            <span className="muted">
              {lang === "zh" ? "為理解而計算。" : "Calculate to understand."}
            </span>
          </span>
          <Link href="/formulae">
            {lang === "zh" ? "課程範圍與使用說明" : "Scope & input guide"}
            <ArrowUpRight size={13} />
          </Link>
        </footer>
      </div>
    </div>
  );
}
export function PageHeading({
  number,
  title,
  english,
  description,
  symbol = "∫",
}: {
  number: string;
  title: string;
  english: string;
  description: string;
  symbol?: string;
}) {
  const { lang } = useLang();
  return (
    <section className="page-heading">
      <div>
        <div className="eyebrow">
          <span>{number}</span> INTEGRATION STUDIO
        </div>
        <h1>
          {lang === "zh" ? title : english}
          <span className="heading-period">.</span>
        </h1>
        <p>{description}</p>
      </div>
      <div className="heading-art" aria-hidden="true">
        <span>{symbol}</span>
        <i>dx</i>
        <div className="art-line" />
      </div>
    </section>
  );
}
export function ScopeNote() {
  const { lang } = useLang();
  return (
    <div className="scope-note">
      <Check size={14} />
      <span>
        {lang === "zh"
          ? "使用 DSE M2 方法 · 精確符號答案 · 不以小數近似"
          : "DSE M2 methods · Exact symbolic answers · No decimal approximations"}
      </span>
    </div>
  );
}
