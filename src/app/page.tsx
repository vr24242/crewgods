import {
  Nav,
  Hero,
  LogoStrip,
  WhoWeAre,
  HowWeWork,
  PlaybooksSection,
  CaseStudies,
  Testimonials,
  FAQ,
  FinalCTA,
  Footer,
} from "@/components/landing/sections";
import { TechSection, WorkflowsSection } from "@/components/landing/tech-section";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <LogoStrip />
        <WhoWeAre />
        <HowWeWork />
        <PlaybooksSection />
        <TechSection />
        <WorkflowsSection />
        <CaseStudies />
        <Testimonials />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
