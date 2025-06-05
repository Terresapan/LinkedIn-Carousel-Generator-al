"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, FileText, Loader2, FileDown, Copy, Check, Globe, Link, Play, Sparkles } from "lucide-react"
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Slide {
  type: "title" | "content" | "cta"
  title?: string
  subtitle?: string
  headline?: string
  subtext?: string
}

interface CarouselData {
  slides: Slide[]
  linkedinPost?: string
}

interface SlideComponentProps {
  slide: Slide
  slideIndex: number
  totalSlides: number
}

export default function LinkedInCarouselGenerator() {
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string>("")
  const [youtubeUrl, setYoutubeUrl] = useState<string>("")
  const [manualTranscript, setManualTranscript] = useState<string>("")
  const [inputType, setInputType] = useState<"file" | "url" | "youtube">("file")
  const [youtubeInputMethod, setYoutubeInputMethod] = useState<"auto-transcript" | "manual">("auto-transcript") // Changed from ai-search to auto-transcript
  const [loading, setLoading] = useState(false)
  const [carouselData, setCarouselData] = useState<CarouselData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState<string>("")
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [copiedPost, setCopiedPost] = useState(false)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile && (selectedFile.type === "text/plain" || selectedFile.type === "application/pdf")) {
      setFile(selectedFile)
      setError(null)
    } else {
      setError("Please select a TXT or PDF file")
    }
  }

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value)
    setError(null)
  }

  const handleYoutubeUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setYoutubeUrl(event.target.value)
    setError(null)
  }

  const handleManualTranscriptChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setManualTranscript(event.target.value)
    setError(null)
  }

  const isValidUrl = (string: string) => {
    try {
      new URL(string)
      return true
    } catch (_) {
      return false
    }
  }

  const isValidYouTubeUrl = (string: string) => {
    try {
      const url = new URL(string)
      return (
        (url.hostname === "www.youtube.com" || url.hostname === "youtube.com" || url.hostname === "youtu.be") &&
        (url.pathname.includes("/watch") || url.pathname.includes("/v/") || url.hostname === "youtu.be")
      )
    } catch (_) {
      return false
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!apiKey) {
      setError("Please provide your Google Gemini API key")
      return
    }

    if (inputType === "file" && !file) {
      setError("Please select a file")
      return
    }

    if (inputType === "url" && (!url || !isValidUrl(url))) {
      setError("Please enter a valid URL")
      return
    }

    if (inputType === "youtube") {
      if (youtubeInputMethod === "auto-transcript" && (!youtubeUrl || !isValidYouTubeUrl(youtubeUrl))) {
        setError("Please enter a valid YouTube URL for Auto Transcript")
        return
      }
      if (youtubeInputMethod === "manual" && (!manualTranscript || manualTranscript.length < 100)) {
        setError("Please enter a transcript with at least 100 characters")
        return
      }
    }

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("apiKey", apiKey)
      formData.append("inputType", inputType)

      if (inputType === "file" && file) {
        formData.append("file", file)
        console.log("Sending request with file:", file.name, "type:", file.type)
      } else if (inputType === "url") {
        formData.append("url", url)
        console.log("Sending request with URL:", url)
      } else if (inputType === "youtube") {
        if (youtubeInputMethod === "auto-transcript") {
          formData.append("youtubeUrl", youtubeUrl)
          console.log("Sending request with YouTube URL for Auto Transcript:", youtubeUrl)
        } else {
          formData.append("manualTranscript", manualTranscript)
          console.log("Sending request with manual transcript, length:", manualTranscript.length)
        }
        formData.append("youtubeInputMethod", youtubeInputMethod)
      }

      const response = await fetch("/api/generate-carousel", {
        method: "POST",
        body: formData,
      })

      console.log("Response status:", response.status)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }))
        console.error("Error response data:", errorData)
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const responseText = await response.text()
        console.error("Non-JSON response:", responseText)
        throw new Error("Server returned non-JSON response")
      }

      const data = await response.json()
      console.log("Received data:", data)
      console.log("Number of slides:", data.slides?.length)

      if (!data || !data.slides || !Array.isArray(data.slides)) {
        throw new Error("Invalid response format from server")
      }

      if (data.slides.length !== 10) {
        console.warn(`Expected 10 slides, got ${data.slides.length}`)
      }

      setCarouselData(data)
    } catch (err) {
      console.error("Full error:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to generate carousel. Please try again."
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const downloadPdf = async () => {
    if (!carouselData) return

    setDownloadingPdf(true)
    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ slides: carouselData.slides }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate PDF")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.style.display = "none"
      a.href = url
      a.download = "linkedin-carousel.pdf"
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error("Error downloading PDF:", err)
      setError("Failed to download PDF. Please try again.")
    } finally {
      setDownloadingPdf(false)
    }
  }

  const copyLinkedInPost = async () => {
    if (!carouselData?.linkedinPost) return

    try {
      await navigator.clipboard.writeText(carouselData.linkedinPost)
      setCopiedPost(true)
      setTimeout(() => setCopiedPost(false), 2000)
    } catch (err) {
      console.error("Failed to copy text:", err)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-br from-[#D946EF] via-[#A855F7] to-[#6366F1] bg-clip-text text-transparent mb-2">
            LinkedIn Carousel Generator
          </h1>
          <p className="text-lg text-slate-300">
            Upload a file, enter a URL, or use a YouTube video to generate a 10-slide LinkedIn carousel
          </p>
        </div>

        {!carouselData && (
          <Card className="max-w-md mx-auto bg-slate-800 border-slate-700 shadow-xl shadow-purple-500/10">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="api-key" className="text-sm font-medium text-slate-200">
                    Google Gemini API Key
                  </label>
                  <input
                    id="api-key"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIza..."
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#A855F7] focus:border-transparent transition-all duration-200"
                    required
                  />
                  <p className="text-xs text-slate-400">Your API key is only used for this request and not stored</p>
                </div>

                {/* Input Type Selector */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-200">Content Source</label>
                  <div className="flex flex-col space-y-2">
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="inputType"
                        value="file"
                        checked={inputType === "file"}
                        onChange={(e) => setInputType(e.target.value as "file" | "url" | "youtube")}
                        className="text-[#A855F7] bg-slate-700 border-slate-600 focus:ring-[#A855F7]"
                      />
                      <FileText className="h-4 w-4 text-slate-400 group-hover:text-[#D946EF] transition-colors" />
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                        Upload File
                      </span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="inputType"
                        value="url"
                        checked={inputType === "url"}
                        onChange={(e) => setInputType(e.target.value as "file" | "url" | "youtube")}
                        className="text-[#A855F7] bg-slate-700 border-slate-600 focus:ring-[#A855F7]"
                      />
                      <Globe className="h-4 w-4 text-slate-400 group-hover:text-[#D946EF] transition-colors" />
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Web URL</span>
                    </label>
                    <label className="flex items-center space-x-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="inputType"
                        value="youtube"
                        checked={inputType === "youtube"}
                        onChange={(e) => setInputType(e.target.value as "file" | "url" | "youtube")}
                        className="text-[#A855F7] bg-slate-700 border-slate-600 focus:ring-[#A855F7]"
                      />
                      <Play className="h-4 w-4 text-slate-400 group-hover:text-[#D946EF] transition-colors" />
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                        YouTube Video
                      </span>
                    </label>
                  </div>
                </div>

                {/* File Upload */}
                {inputType === "file" && (
                  <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center bg-slate-700/30 hover:bg-slate-700/50 transition-all duration-300">
                    <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <span className="text-sm font-medium text-slate-200">Click to upload or drag and drop</span>
                      <p className="text-xs text-slate-400 mt-1">PDF and TXT files supported</p>
                    </label>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".pdf,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                )}

                {/* URL Input */}
                {inputType === "url" && (
                  <div className="space-y-2">
                    <label htmlFor="url-input" className="text-sm font-medium text-slate-200">
                      Website URL
                    </label>
                    <div className="relative">
                      <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        id="url-input"
                        type="url"
                        value={url}
                        onChange={handleUrlChange}
                        placeholder="https://example.com/article"
                        className="w-full pl-10 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#A855F7] focus:border-transparent transition-all duration-200"
                        required={inputType === "url"}
                      />
                    </div>
                    <p className="text-xs text-slate-400">
                      Enter any article URL (Medium, blog posts, news articles, etc.)
                    </p>
                  </div>
                )}

                {/* YouTube Input */}
                {inputType === "youtube" && (
                  <div className="space-y-4">
                    <Tabs
                      defaultValue="auto-transcript"
                      value={youtubeInputMethod}
                      onValueChange={(value) => setYoutubeInputMethod(value as "auto-transcript" | "manual")}
                      className="w-full"
                    >
                      <TabsList className="grid w-full grid-cols-2 bg-slate-700 border-slate-600">
                        <TabsTrigger
                          value="auto-transcript"
                          className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#D946EF] data-[state=active]:via-[#A855F7] data-[state=active]:to-[#6366F1] data-[state=active]:text-white text-slate-300 transition-all duration-200"
                        >
                          <Sparkles className="h-4 w-4 mr-2" />
                          Auto Transcript
                        </TabsTrigger>
                        <TabsTrigger
                          value="manual"
                          className="data-[state=active]:bg-gradient-to-br data-[state=active]:from-[#D946EF] data-[state=active]:via-[#A855F7] data-[state=active]:to-[#6366F1] data-[state=active]:text-white text-slate-300 transition-all duration-200"
                        >
                          Manual Transcript
                        </TabsTrigger>
                      </TabsList>
                      <TabsContent value="auto-transcript" className="space-y-2 mt-2">
                        <div className="space-y-2">
                          <label htmlFor="youtube-input" className="text-sm font-medium text-slate-200">
                            YouTube Video URL
                          </label>
                          <div className="relative">
                            <Play className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                              id="youtube-input"
                              type="url"
                              value={youtubeUrl}
                              onChange={handleYoutubeUrlChange}
                              placeholder="https://www.youtube.com/watch?v=..."
                              className="w-full pl-10 pr-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#A855F7] focus:border-transparent transition-all duration-200"
                              required={inputType === "youtube" && youtubeInputMethod === "auto-transcript"}
                            />
                          </div>
                          <div className="bg-green-900/20 border border-green-700/50 rounded-md p-3">
                            <p className="text-xs text-green-200">
                              <strong>✨ Auto Transcript:</strong> This method automatically extracts the transcript
                              directly from YouTube using the youtube-transcript-plus library.
                            </p>
                          </div>
                          <p className="text-xs text-slate-400">
                            Enter a YouTube video URL for automatic transcript extraction.
                          </p>
                        </div>
                      </TabsContent>
                      <TabsContent value="manual" className="space-y-2 mt-2">
                        <div className="space-y-2">
                          <label htmlFor="manual-transcript" className="text-sm font-medium text-slate-200">
                            Paste Video Transcript
                          </label>
                          <Textarea
                            id="manual-transcript"
                            value={manualTranscript}
                            onChange={handleManualTranscriptChange}
                            placeholder="Paste the video transcript here..."
                            className="min-h-[150px] bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-2 focus:ring-[#A855F7] focus:border-transparent transition-all duration-200"
                            required={inputType === "youtube" && youtubeInputMethod === "manual"}
                          />
                          <div className="bg-blue-900/20 border border-blue-700/50 rounded-md p-3">
                            <p className="text-xs text-blue-200 mb-2">
                              <strong>How to get YouTube transcript:</strong>
                            </p>
                            <ol className="text-xs text-blue-200 list-decimal list-inside space-y-1">
                              <li>Open the YouTube video</li>
                              <li>Click the three dots (...) below the video</li>
                              <li>Select "Show transcript"</li>
                              <li>Copy the transcript text and paste it here</li>
                            </ol>
                          </div>
                          <p className="text-xs text-slate-400">
                            Alternative method: Use this when you have direct access to the transcript.
                          </p>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                )}

                {/* Selected File Display */}
                {inputType === "file" && file && (
                  <div className="flex items-center space-x-2 text-sm text-slate-200 bg-slate-700/50 p-3 rounded-md border border-purple-500/30">
                    <FileText className="h-4 w-4 text-[#D946EF]" />
                    <span>{file.name}</span>
                  </div>
                )}

                {/* Selected URL Display */}
                {inputType === "url" && url && isValidUrl(url) && (
                  <div className="flex items-center space-x-2 text-sm text-slate-200 bg-slate-700/50 p-3 rounded-md border border-purple-500/30">
                    <Globe className="h-4 w-4 text-[#D946EF]" />
                    <span className="truncate">{url}</span>
                  </div>
                )}

                {/* Selected YouTube URL Display */}
                {inputType === "youtube" &&
                  youtubeInputMethod === "auto-transcript" &&
                  youtubeUrl &&
                  isValidYouTubeUrl(youtubeUrl) && (
                    <div className="flex items-center space-x-2 text-sm text-slate-200 bg-slate-700/50 p-3 rounded-md border border-purple-500/30">
                      <Sparkles className="h-4 w-4 text-[#D946EF]" />
                      <span className="truncate">{youtubeUrl}</span>
                    </div>
                  )}

                {/* Manual Transcript Length Display */}
                {inputType === "youtube" && youtubeInputMethod === "manual" && manualTranscript && (
                  <div className="flex items-center space-x-2 text-sm text-slate-200 bg-slate-700/50 p-3 rounded-md border border-purple-500/30">
                    <FileText className="h-4 w-4 text-[#D946EF]" />
                    <span>Transcript: {manualTranscript.length} characters</span>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-900/50 border border-red-700 rounded-md space-y-2">
                    <p className="text-sm text-red-200">{error}</p>
                    {(error.includes("transcript") || error.includes("YouTube URL")) && (
                      <div className="text-xs text-red-300">
                        <p className="font-medium">💡 Suggestion:</p>
                        <p>
                          Try using the "Manual Transcript" tab above and copy the transcript directly from YouTube.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={
                    !apiKey ||
                    loading ||
                    (inputType === "file" && !file) ||
                    (inputType === "url" && (!url || !isValidUrl(url))) ||
                    (inputType === "youtube" &&
                      ((youtubeInputMethod === "auto-transcript" && (!youtubeUrl || !isValidYouTubeUrl(youtubeUrl))) ||
                        (youtubeInputMethod === "manual" && (!manualTranscript || manualTranscript.length < 100))))
                  }
                  className="w-full bg-gradient-to-br from-[#D946EF] via-[#A855F7] to-[#6366F1] hover:from-[#D946EF]/90 hover:via-[#A855F7]/90 hover:to-[#6366F1]/90 text-white font-medium py-2 px-4 rounded-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {inputType === "url" && "Fetching & Generating..."}
                      {inputType === "youtube" &&
                        (youtubeInputMethod === "auto-transcript"
                          ? "Extracting Transcript & Generating..."
                          : "Generating Carousel...")}
                      {inputType === "file" && "Generating Carousel..."}
                    </>
                  ) : (
                    "Generate Carousel"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {carouselData && (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <p className="text-sm text-slate-300">Generated {carouselData.slides.length} slides</p>
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={downloadPdf}
                  disabled={downloadingPdf}
                  className="bg-gradient-to-br from-[#D946EF] via-[#A855F7] to-[#6366F1] hover:from-[#D946EF]/90 hover:via-[#A855F7]/90 hover:to-[#6366F1]/90 text-white font-medium shadow-lg shadow-purple-500/25"
                >
                  {downloadingPdf ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <FileDown className="mr-2 h-4 w-4" />
                      Download PDF
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setCarouselData(null)
                    setFile(null)
                    setUrl("")
                    setYoutubeUrl("")
                    setManualTranscript("")
                    setApiKey("")
                  }}
                  variant="outline"
                  className="border-slate-600 text-[#6366F1] hover:bg-slate-700 hover:text-white hover:border-[#A855F7] transition-all duration-200"
                >
                  Generate New Carousel
                </Button>
              </div>
            </div>

            <div className="max-w-2xl mx-auto">
              <Carousel className="w-full">
                <CarouselContent>
                  {carouselData.slides.map((slide, index) => (
                    <CarouselItem key={index}>
                      <div className="p-1">
                        <SlideComponent slide={slide} slideIndex={index + 1} totalSlides={carouselData.slides.length} />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:border-[#A855F7] transition-all duration-200" />
                <CarouselNext className="bg-slate-800 border-slate-600 text-white hover:bg-slate-700 hover:border-[#A855F7] transition-all duration-200" />
              </Carousel>
            </div>

            <div className="text-center">
              <p className="text-sm text-slate-300 mb-4">
                Use the arrow buttons to navigate through all {carouselData.slides.length} slides
              </p>
            </div>

            {/* LinkedIn Post Section */}
            {carouselData.linkedinPost && (
              <Card className="max-w-4xl mx-auto bg-slate-800 border-slate-700 shadow-xl shadow-purple-500/10">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="bg-gradient-to-br from-[#D946EF] via-[#A855F7] to-[#6366F1] bg-clip-text text-transparent">
                      LinkedIn Post
                    </span>
                    <Button
                      onClick={copyLinkedInPost}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 border-slate-600 text-[#6366F1] hover:bg-slate-700 hover:text-white hover:border-[#A855F7] transition-all duration-200"
                    >
                      {copiedPost ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy Post
                        </>
                      )}
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
                    <pre className="whitespace-pre-wrap text-sm text-slate-100 font-sans leading-relaxed">
                      {carouselData.linkedinPost}
                    </pre>
                  </div>
                  <div className="mt-4 text-sm text-slate-300">
                    <p className="font-medium mb-2 text-slate-100">How to use:</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Copy the post text above</li>
                      <li>Download the PDF carousel</li>
                      <li>Create a new LinkedIn post</li>
                      <li>Paste the text and upload the PDF as a document</li>
                      <li>Publish your engaging carousel post!</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function SlideComponent({ slide, slideIndex, totalSlides }: SlideComponentProps) {
  // Common aspect ratio and base styling for all slides
  const slideBaseStyle = "w-full rounded-lg shadow-lg overflow-hidden relative flex flex-col"
  const slideAspectRatioStyle = { aspectRatio: "1080/1350" }

  // Unified background gradient for all slides
  const unifiedBackground = "bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900"

  if (slide.type === "title") {
    return (
      <div className="relative">
        <div
          id={`slide-${slideIndex - 1}`}
          className={`${slideBaseStyle} ${unifiedBackground} text-white p-10`}
          style={slideAspectRatioStyle}
        >
          {/* Middle Section: Title and Subtitle - centered */}
          <div className="flex-grow flex flex-col justify-center">
            <h1 className="text-7xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent leading-tight mb-6">
              {slide.title}
            </h1>
            {slide.subtitle && <p className="text-slate-200 text-[22px] leading-relaxed">{slide.subtitle}</p>}
          </div>

          {/* Bottom Section: Profile and Follow Text */}
          <div className="flex justify-between items-center mt-8">
            <div className="flex items-center space-x-3">
              <img
                src="/images/MM.png"
                alt="Terresa Pan"
                className="w-14 h-14 rounded-full border-2 border-white object-cover"
              />
              <div>
                <p className="font-semibold text-lg">Terresa Pan</p>
                <p className="text-slate-400 text-sm">@PanTerresa</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-slate-100 text-base">Follow for more</p>
              <p className="text-slate-400 text-sm">Vibe Coding Tips</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (slide.type === "content") {
    return (
      <div className="relative">
        <div
          id={`slide-${slideIndex - 1}`}
          className={`${slideBaseStyle} ${unifiedBackground} text-white p-12`}
          style={slideAspectRatioStyle}
        >
          {/* Main content area - left aligned */}
          <div className="flex-grow flex flex-col justify-center">
            <h2 className="text-6xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent mb-8 leading-tight text-left">
              {slide.headline}
            </h2>
            {slide.subtext && <p className="text-2xl text-gray-200 leading-relaxed text-left">{slide.subtext}</p>}
          </div>

          {/* Right side: "Follow for" text */}
          <div className="absolute bottom-12 right-12">
            <div className="text-right">
              <p className="text-xs text-gray-400">Follow for</p>
              <p className="text-sm text-white font-medium">Vibe Coding Tips</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (slide.type === "cta") {
    return (
      <div className="relative">
        <div
          id={`slide-${slideIndex - 1}`}
          className={`${slideBaseStyle} ${unifiedBackground} text-white p-10`}
          style={slideAspectRatioStyle}
        >
          {/* Main content area - left aligned to match content slides */}
          <div className="flex-grow flex flex-col justify-center">
            <h2 className="text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-300 leading-tight text-left">
              Follow For More About Vibe Coding
            </h2>
          </div>

          {/* Bottom Section: Profile and Follow Text - same as first slide */}
          <div className="flex justify-between items-center mt-8">
            <div className="flex items-center space-x-3">
              <img
                src="/images/MM.png"
                alt="Terresa Pan"
                className="w-14 h-14 rounded-full border-2 border-white object-cover"
              />
              <div>
                <p className="font-semibold text-lg">Terresa Pan</p>
                <p className="text-slate-400 text-sm">@PanTerresa</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-slate-100 text-base">Follow for more</p>
              <p className="text-slate-400 text-sm">Vibe Coding Tips</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-1">
      <div
        className="w-full bg-gray-700 rounded-lg shadow-lg text-white text-center py-20"
        style={slideAspectRatioStyle}
      >
        Unknown slide type
      </div>
    </div>
  )
}
