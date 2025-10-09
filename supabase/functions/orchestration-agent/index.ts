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
    const { username, user_knowledge_level, course_title, course_length_hours } = await req.json();

    console.log('OrchestrationAgent received:', { username, user_knowledge_level, course_title, course_length_hours });

    // Validate inputs
    if (!username || !user_knowledge_level || !course_title || !course_length_hours) {
      throw new Error('Missing required fields: username, user_knowledge_level, course_title, course_length_hours');
    }

    if (!['beginner', 'intermediate', 'advanced'].includes(user_knowledge_level)) {
      throw new Error('Invalid knowledge level. Must be: beginner, intermediate, or advanced');
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
        agent_type: 'orchestration',
        status: 'running',
        input_data: { username, user_knowledge_level, course_title, course_length_hours }
      })
      .select()
      .single();

    if (agentRunError) {
      throw new Error(`Failed to create agent run: ${agentRunError.message}`);
    }

    // Generate normalized CourseSpec using OpenAI
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = `You are an OrchestrationAgent that normalizes course generation requests into a structured CourseSpec.

Given user input, create a normalized schema with:
1. Learning objectives based on knowledge level
2. Suggested module breakdown
3. Estimated time per module
4. Prerequisites and difficulty assessment
5. Target audience analysis

CRITICAL: The totalHours represents the ENTIRE course duration. The sum of all module estimatedHours MUST equal totalHours.
Distribute the total time across modules appropriately - each module gets a portion of the total, not the full duration.

Return a JSON object with this exact structure:
{
  "courseSpec": {
    "id": "generated-uuid",
    "title": "normalized course title",
    "description": "detailed course description",
    "targetKnowledgeLevel": "beginner|intermediate|advanced",
    "totalHours": number,
    "createdBy": "username",
    "learningObjectives": ["objective1", "objective2", ...],
    "prerequisites": ["prerequisite1", "prerequisite2", ...],
    "targetAudience": "description of target audience",
    "difficultyRating": 1-5,
    "suggestedModules": [
      {
        "title": "module title",
        "description": "module description", 
        "estimatedHours": number,
        "position": number
      }
    ],
    "metadata": {
      "generatedAt": "ISO timestamp",
      "version": "1.0"
    }
  }
}`;

    const userPrompt = `Create a normalized CourseSpec for:
- Title: ${course_title}
- Target Knowledge Level: ${user_knowledge_level}
- Duration: ${course_length_hours} hours
- Created by: ${username}

Please analyze this request and create a comprehensive CourseSpec that breaks down the course into logical modules, defines clear learning objectives, and provides a structured foundation for course content generation.`;

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
        max_tokens: 2000,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await response.json();
    const courseSpecText = data.choices[0].message.content;
    
    let courseSpec;
    try {
      const parsed = JSON.parse(courseSpecText);
      courseSpec = parsed.courseSpec;
    } catch (parseError) {
      console.error('Failed to parse CourseSpec JSON:', courseSpecText);
      throw new Error('Failed to parse generated CourseSpec');
    }

    // Create course record
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .insert({
        title: courseSpec.title,
        description: courseSpec.description,
        length_hours: courseSpec.totalHours,
        target_knowledge_level: courseSpec.targetKnowledgeLevel,
        created_by: courseSpec.createdBy,
        status: 'draft'
      })
      .select()
      .single();

    if (courseError) {
      throw new Error(`Failed to create course: ${courseError.message}`);
    }

    // Store the normalized CourseSpec
    const { error: specError } = await supabase
      .from('course_specs')
      .insert({
        course_id: course.id,
        spec_data: courseSpec
      });

    if (specError) {
      throw new Error(`Failed to store CourseSpec: ${specError.message}`);
    }

    // Update agent run with success
    await supabase
      .from('agent_runs')
      .update({
        status: 'completed',
        output_data: courseSpec,
        messages: [{ role: 'system', content: 'Successfully generated normalized CourseSpec' }],
        completed_at: new Date().toISOString(),
        course_id: course.id
      })
      .eq('id', agentRun.id);

    console.log('OrchestrationAgent completed successfully');

    return new Response(JSON.stringify({
      success: true,
      courseId: course.id,
      courseSpec,
      agentRunId: agentRun.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in OrchestrationAgent:', error);

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});