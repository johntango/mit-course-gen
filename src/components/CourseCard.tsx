import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Users, Star } from "lucide-react";

interface CourseCardProps {
  title: string;
  description: string;
  duration: string;
  students: number;
  rating: number;
  level: string;
  image?: string;
  id?: string;
}

export const CourseCard = ({ 
  title, 
  description, 
  duration, 
  students, 
  rating, 
  level,
  id 
}: CourseCardProps) => {
  return (
    <Card className="group hover:shadow-elegant transition-all duration-300 hover:-translate-y-1 bg-card border-border/50">
      <div className="aspect-video bg-gradient-secondary rounded-t-lg relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-80" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
            <div className="w-0 h-0 border-l-[12px] border-l-white border-y-[8px] border-y-transparent ml-1" />
          </div>
        </div>
        <Badge className="absolute top-4 left-4 bg-white/90 text-primary hover:bg-white">
          {level}
        </Badge>
      </div>
      
      <CardHeader>
        <CardTitle className="text-xl line-clamp-2 group-hover:text-primary transition-colors">
          {title}
        </CardTitle>
        <CardDescription className="line-clamp-3">
          {description}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{duration}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{students.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            <span>{rating}</span>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
          onClick={() => window.location.href = `#/course/${id || 'sample'}`}
        >
          View Course
        </Button>
      </CardContent>
    </Card>
  );
};