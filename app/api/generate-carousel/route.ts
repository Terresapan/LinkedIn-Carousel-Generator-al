import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

export const maxDuration = 60;

const CarouselSchema = z.object({
  titleSlide: z.object({
    title: z.string().describe("Main topic title for the first slide"),
    subtitle: z.string().describe("Engaging subtitle for the first slide"),
  }),
  contentSlides: z
    .array(
      z.object({
        headline: z.string().max(60).describe("Concise and impactful headline"),
        subtext: z
          .string()
          .max(200)
          .describe("Informative subtext explaining the point"),
      })
    )
    .length(8)
    .describe("Exactly 8 content slides with key points"),
  linkedinPost: z
    .string()
    .describe("Engaging LinkedIn post text to accompany the carousel"),
});

async function fetchWebContent(url: string): Promise<string> {
  try {
    console.log("Fetching content from URL:", url);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch URL: ${response.status} ${response.statusText}`
      );
    }

    const html = await response.text();

    // Basic HTML content extraction
    let content = html.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ""
    );
    content = content.replace(
      /<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi,
      ""
    );

    // Extract text content from common article containers
    const articlePatterns = [
      /<article[^>]*>(.*?)<\/article>/gis,
      /<main[^>]*>(.*?)<\/main>/gis,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*article[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*post[^"]*"[^>]*>(.*?)<\/div>/gis,
    ];

    let extractedContent = "";
    for (const pattern of articlePatterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        extractedContent = matches[0];
        break;
      }
    }

    if (!extractedContent) {
      const bodyMatch = content.match(/<body[^>]*>(.*?)<\/body>/gis);
      if (bodyMatch) {
        extractedContent = bodyMatch[0];
      } else {
        extractedContent = content;
      }
    }

    // Remove HTML tags and clean up
    extractedContent = extractedContent.replace(/<[^>]*>/g, " ");
    extractedContent = extractedContent.replace(/\s+/g, " ");
    extractedContent = extractedContent.trim();

    // Limit content length
    if (extractedContent.length > 8000) {
      extractedContent = extractedContent.substring(0, 8000) + "...";
    }

    console.log("Extracted content length:", extractedContent.length);

    if (extractedContent.length < 100) {
      throw new Error(
        "Could not extract meaningful content from the URL. The page might be protected or require JavaScript."
      );
    }

    return extractedContent;
  } catch (error) {
    console.error("Error fetching web content:", error);
    throw new Error(
      `Failed to fetch content from URL: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

async function getYouTubeTranscript(url: string): Promise<string> {
  try {
    console.log("Attempting to fetch YouTube transcript for:", url);

    // Extract video ID from various YouTube URL formats
    let videoId = "";
    const urlObj = new URL(url);

    if (urlObj.hostname === "youtu.be") {
      videoId = urlObj.pathname.slice(1);
    } else if (urlObj.hostname.includes("youtube.com")) {
      videoId = urlObj.searchParams.get("v") || "";
      if (!videoId && urlObj.pathname.includes("/v/")) {
        videoId = urlObj.pathname.split("/v/")[1].split("/")[0];
      }
    }

    if (!videoId) {
      throw new Error("Could not extract video ID from YouTube URL");
    }

    // Clean video ID (remove any additional parameters)
    videoId = videoId.split("&")[0].split("?")[0];
    console.log("Extracted video ID:", videoId);

    // Try multiple transcript services with better error handling
    const transcriptServices = [
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=json3`,
      `https://youtubetranscript.com/api/transcript?video_id=${videoId}`,
    ];

    for (const serviceUrl of transcriptServices) {
      try {
        console.log("Trying transcript service:", serviceUrl);

        const response = await fetch(serviceUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; LinkedInCarouselBot/1.0)",
            Accept: "application/json, text/plain, */*",
          },
          signal: AbortSignal.timeout(15000), // 15 second timeout
        });

        if (response.ok) {
          const responseText = await response.text();
          console.log("Response received, length:", responseText.length);

          if (responseText.length > 50) {
            try {
              // Try to parse as JSON first
              const data = JSON.parse(responseText);

              let transcript = "";

              // Handle YouTube API format
              if (data.events && Array.isArray(data.events)) {
                transcript = data.events
                  .filter((event: any) => event.segs)
                  .map((event: any) =>
                    event.segs.map((seg: any) => seg.utf8 || "").join("")
                  )
                  .join(" ");
              }
              // Handle other service formats
              else if (data.transcript && Array.isArray(data.transcript)) {
                transcript = data.transcript
                  .map((item: any) => item.text || "")
                  .join(" ");
              } else if (data.text) {
                transcript = data.text;
              }

              if (transcript && transcript.length > 100) {
                // Clean up the transcript
                let cleanTranscript = transcript
                  .replace(/\[.*?\]/g, "") // Remove [Music], [Applause], etc.
                  .replace(/\s+/g, " ") // Normalize whitespace
                  .replace(/\n+/g, " ") // Replace newlines with spaces
                  .trim();

                // Limit transcript length
                if (cleanTranscript.length > 12000) {
                  cleanTranscript = cleanTranscript.substring(0, 12000) + "...";
                }

                console.log(
                  "Successfully extracted transcript, length:",
                  cleanTranscript.length
                );
                return cleanTranscript;
              }
            } catch (parseError) {
              console.log("Failed to parse JSON response from", serviceUrl);
              // Try treating as plain text
              if (responseText.length > 100) {
                let cleanText = responseText
                  .replace(/<[^>]*>/g, " ") // Remove HTML tags
                  .replace(/\[.*?\]/g, "") // Remove [Music], [Applause], etc.
                  .replace(/\s+/g, " ") // Normalize whitespace
                  .trim();

                if (cleanText.length > 100) {
                  if (cleanText.length > 12000) {
                    cleanText = cleanText.substring(0, 12000) + "...";
                  }
                  console.log(
                    "Successfully extracted transcript as plain text, length:",
                    cleanText.length
                  );
                  return cleanText;
                }
              }
            }
          }
        }
      } catch (serviceError) {
        console.log(`Service ${serviceUrl} failed:`, serviceError);
        continue; // Try next service
      }
    }

    // If all services fail, provide a helpful error message
    throw new Error(
      "Unable to automatically extract transcript from this YouTube video.\n\n" +
        "This is common and can happen because:\n" +
        "• The video doesn't have auto-generated captions\n" +
        "• The captions are not in English\n" +
        "• The video is private, unlisted, or age-restricted\n" +
        "• The video is too new (captions not yet generated)\n" +
        "• YouTube's transcript service is temporarily unavailable\n\n" +
        "Please use the 'Manual Transcript' option instead:\n" +
        "1. Open the YouTube video in a new tab\n" +
        "2. Click the three dots (...) below the video\n" +
        "3. Select 'Show transcript'\n" +
        "4. Copy the transcript text and paste it in the manual input field"
    );
  } catch (error) {
    console.error("Error in getYouTubeTranscript:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(
      "Failed to process YouTube URL. Please check the URL and try again, or use the manual transcript option."
    );
  }
}

export async function POST(request: Request) {
  console.log("API route called");

  try {
    const formData = await request.formData();
    const apiKey = formData.get("apiKey") as string;
    const inputType = formData.get("inputType") as string;
    const file = formData.get("file") as File | null;
    const url = formData.get("url") as string | null;
    const youtubeUrl = formData.get("youtubeUrl") as string | null;
    const youtubeInputMethod = formData.get("youtubeInputMethod") as
      | string
      | null;
    const manualTranscript = formData.get("manualTranscript") as string | null;

    console.log("Input type:", inputType);
    console.log("API key provided:", !!apiKey);
    if (inputType === "youtube") {
      console.log("YouTube input method:", youtubeInputMethod);
    }

    if (!apiKey) {
      console.error("No API key provided");
      return new Response(JSON.stringify({ error: "No API key provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate API key format for Google
    if (!apiKey.startsWith("AIza")) {
      console.error("Invalid API key format");
      return new Response(
        JSON.stringify({
          error: "Invalid Gemini API key format. Should start with 'AIza'",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (inputType === "file" && !file) {
      console.error("No file provided for file input type");
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (inputType === "url" && !url) {
      console.error("No URL provided for URL input type");
      return new Response(JSON.stringify({ error: "No URL provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (inputType === "youtube") {
      if (youtubeInputMethod === "url" && !youtubeUrl) {
        console.error("No YouTube URL provided for YouTube URL input method");
        return new Response(
          JSON.stringify({ error: "No YouTube URL provided" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
      if (
        youtubeInputMethod === "manual" &&
        (!manualTranscript || manualTranscript.length < 100)
      ) {
        console.error("No or too short manual transcript provided");
        return new Response(
          JSON.stringify({
            error: "Please provide a transcript with at least 100 characters",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    console.log("Setting up Google model...");

    const prompt = `Analyze the following content and create a LinkedIn carousel post with exactly 10 slides AND a LinkedIn post to accompany it.

IMPORTANT: You must provide:
1. ONE title slide with a main topic title and engaging subtitle
2. EXACTLY 8 content slides, each with a headline and subtext covering the main points from the content
3. ONE LinkedIn post text that promotes the carousel

Requirements for content slides:
- Each slide should cover a distinct key point or insight from the content
- Headlines must be concise and impactful (maximum 60 characters)
- Subtext should be informative but readable (maximum 200 characters)
- Make each slide valuable on its own
- Use professional, engaging language suitable for LinkedIn
- Focus on practical insights and actionable tips
- Ensure all 8 slides are unique and cover different aspects of the content

Requirements for LinkedIn post:
- Write an engaging LinkedIn post (300-500 words) that promotes the carousel
- The post should educate founders, entrepreneurs, executives, and professionals  on emerging AI technologies
- goals: Educate, not overwhelm; Add value, not hype; Position the author (you) as a trusted advisor for AI adoption
- Include two compelling Hooks in the first 2 lines — short and sharp. Remember: LinkedIn truncates after ~2 lines.
- Mention three key insights from the carousel
- Frames the strategic importance — Why should they care now?
- Subtly positions the author as a helpful guide — trustworthy, experienced, approachable.
- Ends with a clear CTA — e.g., “Read the slides,” “Connect if you’re evaluating AI,” or “Drop a question in the comments.”
- Use emojis strategically for better engagement
- Tone: Confident, practical, forward-looking; Conversational, but not chatty; Avoid jargon, overuse of buzzwords, or overpromising
- Output Format: Just the LinkedIn post text. No hashtags. No extra formatting. 

Example Output:
GPT-4.1 just dropped. It isn’t just smarter — it’s stricter.

If your prompts are vague, your results will be too.

I distilled OpenAI’s new GPT-4.1 Prompting Guide into this 60-second explainer for SBOs and professionals who want to actually use AI to get things done.

1️⃣ Precision is power – Clear, specific prompts = clear, specific outcomes.
2️⃣ AI goes agentic – GPT-4.1 can now take multi-step actions, not just answer questions.
3️⃣ No magic bullet – Effective use still depends on your context, goals, and iteration.

👉 Read the video for practical tips.
💬 Questions about using GPT-4.1 in your business? Let’s talk.

The 10th slide will be a CTA slide and will be added automatically.
Please extract the most important 8 key points from the content and create engaging content for each, plus the LinkedIn post.`;

    let messages;
    let contentToAnalyze = "";

    if (inputType === "youtube") {
      if (youtubeInputMethod === "url" && youtubeUrl) {
        console.log("Processing YouTube URL:", youtubeUrl);
        try {
          contentToAnalyze = await getYouTubeTranscript(youtubeUrl);
          console.log("Successfully fetched YouTube transcript");
        } catch (error) {
          console.error("Failed to fetch YouTube transcript:", error);

          // Provide more specific error message
          let errorMessage = "Failed to get YouTube transcript";
          if (error instanceof Error) {
            errorMessage = error.message;
          }

          return new Response(
            JSON.stringify({
              error: errorMessage,
              suggestion:
                "Try using the 'Manual Transcript' option instead. You can copy the transcript directly from YouTube.",
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        messages = [
          {
            role: "user" as const,
            content: `${prompt}

YouTube video transcript from ${youtubeUrl}:
${contentToAnalyze}`,
          },
        ];
      } else if (youtubeInputMethod === "manual" && manualTranscript) {
        console.log(
          "Processing manual transcript, length:",
          manualTranscript.length
        );
        contentToAnalyze = manualTranscript;
        messages = [
          {
            role: "user" as const,
            content: `${prompt}

YouTube video transcript:
${contentToAnalyze}`,
          },
        ];
      }
    } else if (inputType === "url" && url) {
      console.log("Processing URL:", url);
      try {
        contentToAnalyze = await fetchWebContent(url);
        console.log("Successfully fetched web content");
      } catch (error) {
        console.error("Failed to fetch web content:", error);
        return new Response(
          JSON.stringify({
            error: `Failed to fetch content from URL: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      messages = [
        {
          role: "user" as const,
          content: `${prompt}

Web content from ${url}:
${contentToAnalyze}`,
        },
      ];
    } else if (inputType === "file" && file) {
      console.log("Processing file:", file.name, "type:", file.type);

      if (file.type === "application/pdf") {
        // Handle PDF files
        messages = [
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const,
                text: prompt,
              },
              {
                type: "file" as const,
                data: await file.arrayBuffer(),
                mimeType: "application/pdf",
              },
            ],
          },
        ];
      } else {
        // Handle text files
        const fileContent = await file.text();
        if (!fileContent.trim()) {
          console.error("File is empty");
          return new Response(
            JSON.stringify({ error: "File appears to be empty" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        messages = [
          {
            role: "user" as const,
            content: `${prompt}

Document content:
${fileContent}`,
          },
        ];
      }
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid input type or missing content" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    console.log("Calling generateObject...");

    // Set the API key as environment variable temporarily for this request
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;

    const result = await generateObject({
      model: google("gemini-1.5-flash"),
      messages,
      schema: CarouselSchema,
    });

    console.log("Generated result:", result.object);

    // Clean up the environment variable
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    // Construct the 10 slides
    const slides = [
      // Slide 1: Title slide
      {
        type: "title" as const,
        title: result.object.titleSlide.title,
        subtitle: result.object.titleSlide.subtitle,
      },
      // Slides 2-9: Content slides
      ...result.object.contentSlides.map((slide, index) => ({
        type: "content" as const,
        headline: slide.headline,
        subtext: slide.subtext,
      })),
      // Slide 10: CTA slide
      {
        type: "cta" as const,
        title: "Follow for More Vibe Coding Tips",
      },
    ];

    console.log("Constructed slides:", slides.length, "slides");

    return new Response(
      JSON.stringify({
        slides,
        linkedinPost: result.object.linkedinPost,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating carousel:", error);

    // Clean up the environment variable in case of error
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    // Handle specific Gemini errors
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);

      let errorMessage = "Failed to generate carousel";
      let statusCode = 500;

      if (
        error.message.includes("401") ||
        error.message.includes("403") ||
        error.message.includes("API_KEY")
      ) {
        errorMessage = "Invalid API key or insufficient permissions";
        statusCode = 401;
      } else if (error.message.includes("429")) {
        errorMessage = "Rate limit exceeded. Please try again later.";
        statusCode = 429;
      } else if (error.message.includes("quota")) {
        errorMessage =
          "Quota exceeded. Please check your Google Cloud account.";
        statusCode = 402;
      } else {
        errorMessage = `Failed to generate carousel: ${error.message}`;
      }

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
