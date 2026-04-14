import { createContext, useContext, useState, type PropsWithChildren } from "react";
import type { ContentSection } from "../api/types";

type SectionContextValue = {
  activeSection: ContentSection;
  setActiveSection: (section: ContentSection) => void;
};

const SectionContext = createContext<SectionContextValue>({
  activeSection: "sjon",
  setActiveSection: () => {},
});

export function SectionProvider({ children }: PropsWithChildren) {
  const [activeSection, setActiveSection] = useState<ContentSection>("sjon");
  return (
    <SectionContext.Provider value={{ activeSection, setActiveSection }}>
      {children}
    </SectionContext.Provider>
  );
}

export function useSection() {
  return useContext(SectionContext);
}
