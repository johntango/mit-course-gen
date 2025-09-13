import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Brain, Users, BarChart } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Generate complete course outlines and content in minutes, not hours. Our AI understands educational best practices."
  },
  {
    icon: Brain,
    title: "AI-Powered",
    description: "Advanced AI creates engaging, pedagogically sound content tailored to your subject matter and audience."
  },
  {
    icon: Users,
    title: "Student-Focused",
    description: "Built with student engagement in mind. Interactive elements and clear learning objectives drive results."
  },
  {
    icon: BarChart,
    title: "Analytics Ready",
    description: "Track student progress and course effectiveness with built-in analytics and assessment tools."
  }
];

export const Features = () => {
  return (
    <section className="py-20 px-6 bg-gradient-secondary">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Everything You Need to Create
            <span className="block text-primary">Amazing Courses</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Powerful tools designed to help educators create engaging, effective online courses with ease.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <Card key={index} className="text-center hover:shadow-card transition-all duration-300 hover:-translate-y-2 bg-card/80 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <div className="mx-auto mb-4 w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center shadow-elegant">
                    <IconComponent className="w-8 h-8 text-white" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};