import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

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
    const { courseId } = await req.json();

    if (!courseId) {
      return new Response(
        JSON.stringify({ error: 'Course ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting image population for course:', courseId);

    // Fetch all lessons for the course
    const { data: modules, error: modulesError } = await supabase
      .from('modules')
      .select(`
        id,
        title,
        lessons (
          id,
          title,
          content
        )
      `)
      .eq('course_id', courseId)
      .order('position');

    if (modulesError) {
      console.error('Error fetching modules:', modulesError);
      throw modulesError;
    }

    let totalLessons = 0;
    let processedLessons = 0;

    // Count total lessons
    modules?.forEach(module => {
      totalLessons += module.lessons?.length || 0;
    });

    console.log(`Found ${totalLessons} lessons to process`);

    // Process each lesson
    for (const module of modules || []) {
      for (const lesson of module.lessons || []) {
        try {
          console.log(`Processing lesson: ${lesson.title}`);

          // Skip if lesson already has an image
          if (lesson.content && lesson.content.includes('![')) {
            console.log(`Lesson "${lesson.title}" already has an image, skipping`);
            processedLessons++;
            continue;
          }

          // Search for an image based on lesson title and module context
          const searchQuery = `${lesson.title} ${module.title} educational illustration`;
          console.log(`Searching for images with query: ${searchQuery}`);

          const searchResponse = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&per_page=1&orientation=landscape`, {
            headers: {
              'Authorization': `Client-ID ${Deno.env.get('UNSPLASH_ACCESS_KEY')}`
            }
          });

          if (!searchResponse.ok) {
            console.error(`Unsplash API error for lesson "${lesson.title}":`, searchResponse.status);
            processedLessons++;
            continue;
          }

          const searchData = await searchResponse.json();
          
          if (!searchData.results || searchData.results.length === 0) {
            console.log(`No images found for lesson: "${lesson.title}"`);
            processedLessons++;
            continue;
          }

          const image = searchData.results[0];
          const imageUrl = image.urls.regular;
          const imageAlt = image.alt_description || lesson.title;
          const imageCredit = image.user.name;

          // Create image markdown with credit
          const imageMarkdown = `![${imageAlt}](${imageUrl})
*Image by [${imageCredit}](${image.user.links.html}) on [Unsplash](https://unsplash.com)*

`;

          // Add image to the top of the lesson content
          const updatedContent = imageMarkdown + (lesson.content || '');

          // Update the lesson in the database
          const { error: updateError } = await supabase
            .from('lessons')
            .update({ content: updatedContent })
            .eq('id', lesson.id);

          if (updateError) {
            console.error(`Error updating lesson "${lesson.title}":`, updateError);
          } else {
            console.log(`Successfully added image to lesson: "${lesson.title}"`);
          }

          processedLessons++;

          // Add a small delay to respect API rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
          console.error(`Error processing lesson "${lesson.title}":`, error);
          processedLessons++;
        }
      }
    }

    console.log(`Image population completed. Processed ${processedLessons}/${totalLessons} lessons`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully processed ${processedLessons}/${totalLessons} lessons`,
        totalLessons,
        processedLessons
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in populate-course-images function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});