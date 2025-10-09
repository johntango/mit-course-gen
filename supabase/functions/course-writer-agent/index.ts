import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { courseId, courseSpec } = await req.json();

    console.log('CourseWriterAgent received courseId:', courseId);

    if (!courseId || !courseSpec) {
      throw new Error('Missing required fields: courseId, courseSpec');
    }

    // Create Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Create agent run record
    const { data: agentRun, error: agentRunError } = await supabase
      .from('agent_runs')
      .insert({
        course_id: courseId,
        agent_type: 'course_writer',
        status: 'running',
        input_data: { courseId, courseSpec }
      })
      .select()
      .single();

    if (agentRunError) {
      throw new Error(`Failed to create agent run: ${agentRunError.message}`);
    }

    // Update course status to generating
    await supabase
      .from('courses')
      .update({ status: 'generating' })
      .eq('id', courseId);

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const courseContent = {
      modules: []
    };

    // Generate content for each suggested module
    for (const suggestedModule of courseSpec.suggestedModules) {
      console.log(`Generating content for module: ${suggestedModule.title}`);

      // Create module record
      const { data: moduleRecord, error: moduleError } = await supabase
        .from('modules')
        .insert({
          course_id: courseId,
          title: suggestedModule.title,
          description: suggestedModule.description,
          position: suggestedModule.position
        })
        .select()
        .single();

      if (moduleError) {
        throw new Error(`Failed to create module: ${moduleError.message}`);
      }

      const systemPrompt = `You are a CourseWriterAgent that generates detailed educational content.

Create comprehensive lessons for the given module. Each lesson should:
1. Have a clear learning objective
2. Include engaging content with examples
3. Be appropriate for the target knowledge level
4. Build upon previous lessons
5. Include practical exercises or activities

Return a JSON object with this structure:
{
  "lessons": [
    {
      "title": "lesson title",
      "content": "comprehensive lesson content in markdown format",
      "position": number
    }
  ]
}`;

      // Calculate number of lessons based on 30 minutes per lesson (2 lessons per hour)
      const numberOfLessons = Math.max(1, Math.round(suggestedModule.estimatedHours * 2));
      
      const userPrompt = `Generate detailed lessons for this module:

Module: ${suggestedModule.title}
Description: ${suggestedModule.description}
Target Knowledge Level: ${courseSpec.targetKnowledgeLevel}
Estimated Hours: ${suggestedModule.estimatedHours}

Course Context:
- Course Title: ${courseSpec.title}
- Learning Objectives: ${courseSpec.learningObjectives.join(', ')}
- Prerequisites: ${courseSpec.prerequisites.join(', ')}

Please generate EXACTLY ${numberOfLessons} lesson${numberOfLessons > 1 ? 's' : ''} that cover this module thoroughly. Each lesson should be approximately 30 minutes of content and include:
- Clear explanations
- Real-world examples
- Practice exercises
- Key takeaways

Format the content in markdown for easy rendering.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-2025-04-14',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 4000,
          temperature: 0.7
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${errorText}`);
      }

      const data = await response.json();
      const lessonsText = data.choices[0].message.content;

      let lessonsData;
      try {
        lessonsData = JSON.parse(lessonsText);
      } catch (parseError) {
        console.error('Failed to parse lessons JSON:', lessonsText);
        throw new Error(`Failed to parse generated lessons for module: ${suggestedModule.title}`);
      }

      // Create lesson records
      const moduleData = {
        id: moduleRecord.id,
        title: suggestedModule.title,
        description: suggestedModule.description,
        position: suggestedModule.position,
        lessons: []
      };

      for (const lesson of lessonsData.lessons) {
        const { data: lessonRecord, error: lessonError } = await supabase
          .from('lessons')
          .insert({
            module_id: moduleRecord.id,
            title: lesson.title,
            content: lesson.content,
            position: lesson.position
          })
          .select()
          .single();

        if (lessonError) {
          throw new Error(`Failed to create lesson: ${lessonError.message}`);
        }

        moduleData.lessons.push({
          id: lessonRecord.id,
          title: lesson.title,
          content: lesson.content,
          position: lesson.position
        });
      }

      courseContent.modules.push(moduleData);
    }

    // Update course status to completed
    await supabase
      .from('courses')
      .update({ status: 'completed' })
      .eq('id', courseId);

    // Update agent run with success
    await supabase
      .from('agent_runs')
      .update({
        status: 'completed',
        output_data: courseContent,
        messages: [{ 
          role: 'system', 
          content: `Successfully generated course content with ${courseContent.modules.length} modules`
        }],
        completed_at: new Date().toISOString()
      })
      .eq('id', agentRun.id);

    console.log('CourseWriterAgent completed successfully');

    return new Response(JSON.stringify({
      success: true,
      courseId,
      courseContent,
      agentRunId: agentRun.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in CourseWriterAgent:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});