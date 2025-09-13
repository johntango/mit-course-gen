import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-education.jpg";

export const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-hero overflow-hidden">
      {/* Background Image Overlay */}
      <div className="absolute inset-0 bg-black/20" />
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      
      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center text-white">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          Generate Amazing
          <span className="block bg-gradient-to-r from-white to-primary-glow bg-clip-text text-transparent">
            Courses Instantly
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl mb-8 text-white/90 max-w-2xl mx-auto leading-relaxed">
          Create professional courses with AI assistance. Build engaging content, 
          interactive lessons, and comprehensive curricula in minutes.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button variant="hero" size="lg" className="text-lg px-8 py-6">
            Start Creating
          </Button>
          <Button variant="secondary" size="lg" className="text-lg px-8 py-6">
            View Examples
          </Button>
        </div>
        
        <div className="mt-12 text-sm text-white/70">
          Join 10,000+ educators creating amazing courses
        </div>
      </div>
      
      {/* Decorative Elements */}
      <div className="absolute top-20 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl" />
      <div className="absolute bottom-20 right-10 w-32 h-32 bg-primary-glow/20 rounded-full blur-2xl" />
    </section>
  );
};