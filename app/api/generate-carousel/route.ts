import { google } from "@ai-sdk/google"
import { generateObject } from "ai"
import { z } from "zod"

export const maxDuration = 60

const CarouselSchema = z.object({
  titleSlide: z.object({
    title: z.string().describe("Main topic title for the first slide"),
    subtitle: z.string().describe("Engaging subtitle for the first slide"),
  }),
  contentSlides: z
    .array(
      z.object({
        headline: z.string().max(60).describe("Concise and impactful headline"),
        subtext: z.string().max(200).describe("Informative subtext explaining the point"),
      }),
    )
    .length(8)
    .describe("Exactly 8 content slides with key points"),
  linkedinPost: z.string().describe("Engaging LinkedIn post text to accompany the carousel"),
})

async function fetchWebContent(url: string): Promise<string> {
  try {
    console.log("Fetching content from URL:", url)

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
    }

    const html = await response.text()

    // Basic HTML content extraction
    let content = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    content = content.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")

    // Extract text content from common article containers
    const articlePatterns = [
      /<article[^>]*>(.*?)<\/article>/gis,
      /<main[^>]*>(.*?)<\/main>/gis,
      /<div[^>]*class="[^"]*content[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*article[^"]*"[^>]*>(.*?)<\/div>/gis,
      /<div[^>]*class="[^"]*post[^"]*"[^>]*>(.*?)<\/div>/gis,
    ]

    let extractedContent = ""
    for (const pattern of articlePatterns) {
      const matches = content.match(pattern)
      if (matches && matches.length > 0) {
        extractedContent = matches[0]
        break
      }
    }

    if (!extractedContent) {
      const bodyMatch = content.match(/<body[^>]*>(.*?)<\/body>/gis)
      if (bodyMatch) {
        extractedContent = bodyMatch[0]
      } else {
        extractedContent = content
      }
    }

    // Remove HTML tags and clean up
    extractedContent = extractedContent.replace(/<[^>]*>/g, " ")
    extractedContent = extractedContent.replace(/\s+/g, " ")
    extractedContent = extractedContent.trim()

    // Limit content length
    if (extractedContent.length > 8000) {
      extractedContent = extractedContent.substring(0, 8000) + "..."
    }

    console.log("Extracted content length:", extractedContent.length)

    if (extractedContent.length < 100) {
      throw new Error(
        "Could not extract meaningful content from the URL. The page might be protected or require JavaScript.",
      )
    }

    return extractedContent
  } catch (error) {
    console.error("Error fetching web content:", error)
    throw new Error(`Failed to fetch content from URL: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

async function fetchYouTubeTranscript(url: string): Promise<string> {
  try {
    console.log("Fetching YouTube transcript for URL:", url)

    // Dynamic import of youtube-transcript-plus
    const { fetchTranscript } = await import("youtube-transcript-plus")

    // Extract video ID from URL
    let videoId = url
    const urlObj = new URL(url)

    if (urlObj.hostname === "youtu.be") {
      videoId = urlObj.pathname.slice(1)
    } else if (urlObj.hostname.includes("youtube.com")) {
      videoId = urlObj.searchParams.get("v") || ""
    }

    if (!videoId) {
      throw new Error("Could not extract video ID from YouTube URL")
    }

    console.log("Extracted video ID:", videoId)

    // Fetch transcript with custom user agent
    const transcriptData = await fetchTranscript(videoId, {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      lang: "en", // Default to English, can be made configurable
    })

    // Combine all transcript segments into a single text
    const fullTranscript = transcriptData
      .map((segment) => segment.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()

    console.log("Transcript length:", fullTranscript.length)

    if (fullTranscript.length < 100) {
      throw new Error("Transcript is too short or empty")
    }

    return fullTranscript
  } catch (error) {
    console.error("Error fetching YouTube transcript:", error)

    // Provide more specific error messages based on the error type
    if (error instanceof Error) {
      if (error.message.includes("Video unavailable") || error.message.includes("private")) {
        throw new Error("This YouTube video is unavailable, private, or has been removed.")
      } else if (error.message.includes("Transcript disabled") || error.message.includes("not available")) {
        throw new Error("Transcripts are not available for this YouTube video. Try using the manual transcript option.")
      } else if (error.message.includes("language")) {
        throw new Error(
          "Transcript is not available in English for this video. Try using the manual transcript option.",
        )
      } else {
        throw new Error(`Failed to fetch YouTube transcript: ${error.message}`)
      }
    }

    throw new Error("Failed to fetch YouTube transcript. Please try the manual transcript option.")
  }
}

export async function POST(request: Request) {
  console.log("API route called")

  try {
    const formData = await request.formData()
    const apiKey = formData.get("apiKey") as string
    const inputType = formData.get("inputType") as string
    const file = formData.get("file") as File | null
    const url = formData.get("url") as string | null
    const youtubeUrl = formData.get("youtubeUrl") as string | null
    const youtubeInputMethod = formData.get("youtubeInputMethod") as string | null
    const manualTranscript = formData.get("manualTranscript") as string | null

    console.log("Input type:", inputType)
    console.log("API key provided:", !!apiKey)
    if (inputType === "youtube") {
      console.log("YouTube input method:", youtubeInputMethod)
    }

    if (!apiKey) {
      console.error("No API key provided")
      return new Response(JSON.stringify({ error: "No API key provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    // Validate API key format for Google
    if (!apiKey.startsWith("AIza")) {
      console.error("Invalid API key format")
      return new Response(
        JSON.stringify({
          error: "Invalid Gemini API key format. Should start with 'AIza'",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      )
    }

    if (inputType === "file" && !file) {
      console.error("No file provided for file input type")
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (inputType === "url" && !url) {
      console.error("No URL provided for URL input type")
      return new Response(JSON.stringify({ error: "No URL provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (inputType === "youtube") {
      if (youtubeInputMethod === "auto-transcript" && !youtubeUrl) {
        console.error("No YouTube URL provided for Auto Transcript input method")
        return new Response(JSON.stringify({ error: "No YouTube URL provided" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }
      if (youtubeInputMethod === "manual" && (!manualTranscript || manualTranscript.length < 100)) {
        console.error("No or too short manual transcript provided")
        return new Response(
          JSON.stringify({
            error: "Please provide a transcript with at least 100 characters",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        )
      }
    }

    console.log("Setting up Google model...")

    const basePrompt = `Analyze the provided content and create a LinkedIn carousel post with exactly 10 slides AND a LinkedIn post to accompany it.

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
- The post should educate founders, entrepreneurs, executives, and professionals on emerging AI technologies
- goals: Educate, not overwhelm; Add value, not hype; Position the author (you) as a trusted advisor for AI adoption
- Include two compelling Hooks in the first 2 lines — short and sharp. Remember: LinkedIn truncates after ~2 lines.
- Mention three key insights from the carousel
- Frames the strategic importance — Why should they care now?
- Subtly positions the author as a helpful guide — trustworthy, experienced, approachable.
- Ends with a clear CTA — e.g., "Read the slides," "Connect if you're evaluating AI," or "Drop a question in the comments."
- Use emojis strategically for better engagement
- Tone: Confident, practical, forward-looking; Conversational, but not chatty; Avoid jargon, overuse of buzzwords, or overpromising
- Output Format: Just the LinkedIn post text. No hashtags. No extra formatting. 

The 10th slide will be a CTA slide and will be added automatically.
Please extract the most important 8 key points from the content and create engaging content for each, plus the LinkedIn post.`

    let messages
    const geminiModelName = "gemini-2.0-flash-exp"
    console.log(`Using Gemini Model: ${geminiModelName}`)

    if (inputType === "youtube") {
      if (youtubeInputMethod === "auto-transcript" && youtubeUrl) {
        console.log("Processing YouTube URL with Auto Transcript:", youtubeUrl)

        let transcriptContent = ""
        try {
          transcriptContent = await fetchYouTubeTranscript(youtubeUrl)
          console.log("Successfully fetched YouTube transcript")
        } catch (error) {
          console.error("Failed to fetch YouTube transcript:", error)
          return new Response(
            JSON.stringify({
              error: `Failed to fetch YouTube transcript: ${error instanceof Error ? error.message : "Unknown error"}`,
            }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            },
          )
        }

        messages = [
          {
            role: "user" as const,
            content: `${basePrompt}

YouTube video transcript:
${transcriptContent}`,
          },
        ]
      } else if (youtubeInputMethod === "manual" && manualTranscript) {
        console.log("Processing manual transcript, length:", manualTranscript.length)
        messages = [
          {
            role: "user" as const,
            content: `${basePrompt}

YouTube video transcript:
${manualTranscript}`,
          },
        ]
      } else {
        return new Response(JSON.stringify({ error: "Invalid YouTube input method or missing content" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        })
      }
    } else if (inputType === "url" && url) {
      console.log("Processing URL:", url)
      let contentToAnalyze = ""
      try {
        contentToAnalyze = await fetchWebContent(url)
        console.log("Successfully fetched web content")
      } catch (error) {
        console.error("Failed to fetch web content:", error)
        return new Response(
          JSON.stringify({
            error: `Failed to fetch content from URL: ${error instanceof Error ? error.message : "Unknown error"}`,
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        )
      }

      messages = [
        {
          role: "user" as const,
          content: `${basePrompt}

Web content from ${url}:
${contentToAnalyze}`,
        },
      ]
    } else if (inputType === "file" && file) {
      console.log("Processing file:", file.name, "type:", file.type)

      if (file.type === "application/pdf") {
        messages = [
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const,
                text: basePrompt,
              },
              {
                type: "file" as const,
                data: await file.arrayBuffer(),
                mimeType: "application/pdf",
              },
            ],
          },
        ]
      } else {
        const fileContent = await file.text()
        if (!fileContent.trim()) {
          console.error("File is empty")
          return new Response(JSON.stringify({ error: "File appears to be empty" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          })
        }

        messages = [
          {
            role: "user" as const,
            content: `${basePrompt}

Document content:
${fileContent}`,
          },
        ]
      }
    } else {
      return new Response(JSON.stringify({ error: "Invalid input type or missing content" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    console.log("Calling generateObject...")

    process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey

    const result = await generateObject({
      model: google(geminiModelName),
      messages,
      schema: CarouselSchema,
    })

    console.log("Raw AI Result Object:", JSON.stringify(result.object, null, 2))

    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY

    const slides = [
      {
        type: "title" as const,
        title: result.object.titleSlide.title,
        subtitle: result.object.titleSlide.subtitle,
      },
      ...result.object.contentSlides.map((slide) => ({
        type: "content" as const,
        headline: slide.headline,
        subtext: slide.subtext,
      })),
      {
        type: "cta" as const,
        title: "Follow for More Vibe Coding Tips",
      },
    ]

    console.log("Constructed slides:", slides.length, "slides")

    return new Response(
      JSON.stringify({
        slides,
        linkedinPost: result.object.linkedinPost,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    )
  } catch (error) {
    console.error("Error generating carousel:", error)
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY

    if (error instanceof Error) {
      console.error("Error details:", error.message)
      console.error("Error stack:", error.stack)

      let errorMessage = "Failed to generate carousel"
      let statusCode = 500

      if (
        error.message.includes("401") ||
        error.message.includes("403") ||
        error.message.includes("API_KEY") ||
        error.message.includes("API key not valid")
      ) {
        errorMessage = "Invalid API key or insufficient permissions. Please check your Google Gemini API key."
        statusCode = 401
      } else if (error.message.includes("429")) {
        errorMessage = "Rate limit exceeded. Please try again later."
        statusCode = 429
      } else if (error.message.includes("quota")) {
        errorMessage = "Quota exceeded. Please check your Google Cloud account."
        statusCode = 402
      } else if (error.message.includes("transcript") || error.message.includes("YouTube")) {
        errorMessage = `YouTube transcript error: ${error.message}`
        statusCode = 400
      } else if (error.message.includes("model") && error.message.includes("not found")) {
        errorMessage = `The specified Gemini model ("${geminiModelName}") was not found or is not available with your API key. Please verify the model name and your access.`
        statusCode = 400
      } else {
        errorMessage = `Failed to generate carousel: ${error.message}`
      }

      return new Response(JSON.stringify({ error: errorMessage }), {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ error: "Unknown error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
