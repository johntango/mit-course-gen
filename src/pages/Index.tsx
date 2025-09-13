import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { CourseCatalog } from "@/components/CourseCatalog";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Hero />
      <Features />
      <CourseCatalog />
    </div>
  );
};

export default Index;
