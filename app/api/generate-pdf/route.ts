import type { NextRequest } from "next/server"

interface Slide {
  type: "title" | "content" | "cta"
  title?: string
  subtitle?: string
  headline?: string
  subtext?: string
}

export async function POST(request: NextRequest) {
  try {
    const { slides } = await request.json()

    if (!slides || !Array.isArray(slides)) {
      return new Response("Invalid slides data", { status: 400 })
    }

    // Import jsPDF dynamically to avoid SSR issues
    const { jsPDF } = await import("jspdf")

    // Create new PDF document in portrait mode with custom dimensions
    // LinkedIn carousel dimensions: 1080x1350 pixels
    // Convert to mm: 1080px = ~190mm, 1350px = ~238mm at 144 DPI
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: [190, 238],
    })

    slides.forEach((slide: Slide, index: number) => {
      if (index > 0) {
        pdf.addPage()
      }

      // Create a clean gradient background using a single rectangle with gradient colors
      // Use the darkest color from the gradient as the base
      pdf.setFillColor(17, 24, 39) // Dark gray base (from-gray-900)
      pdf.rect(0, 0, 190, 238, "F")

      // Add a subtle overlay for the gradient effect without lines
      pdf.setFillColor(30, 58, 138, 0.3) // Blue overlay with transparency effect
      pdf.rect(0, 120, 190, 118, "F") // Bottom half with blue tint

      if (slide.type === "title") {
        // Title text - positioned in upper-middle area
        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(32) // Larger font for better readability
        pdf.setFont("helvetica", "bold")

        if (slide.title) {
          const titleLines = pdf.splitTextToSize(slide.title, 150)
          let currentY = 70

          titleLines.forEach((line: string) => {
            pdf.text(line, 20, currentY, { align: "left" })
            currentY += 14
          })

          // Subtitle
          if (slide.subtitle) {
            pdf.setFontSize(18)
            pdf.setFont("helvetica", "normal")
            pdf.setTextColor(200, 200, 200)

            const subtitleLines = pdf.splitTextToSize(slide.subtitle, 150)
            currentY += 10

            subtitleLines.forEach((line: string) => {
              pdf.text(line, 20, currentY, { align: "left" })
              currentY += 9
            })
          }
        }

        // Profile section at bottom (NO BOOKMARK ICON)
        const bottomY = 200

        // Avatar circle with gradient color
        pdf.setFillColor(217, 70, 239) // #D946EF
        pdf.circle(30, bottomY, 8, "F") // Slightly larger circle

        // Avatar text
        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(12)
        pdf.setFont("helvetica", "bold")
        pdf.text("VC", 30, bottomY + 4, { align: "center" })

        // Profile info
        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(14)
        pdf.setFont("helvetica", "bold")
        pdf.text("Vibe Coding", 45, bottomY - 2)

        pdf.setTextColor(156, 163, 175)
        pdf.setFontSize(11)
        pdf.setFont("helvetica", "normal")
        pdf.text("@VibeCoding", 45, bottomY + 8)

        // Follow for section
        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(12)
        pdf.setFont("helvetica", "normal")
        pdf.text("Follow for", 170, bottomY - 2, { align: "right" })

        pdf.setTextColor(156, 163, 175)
        pdf.setFontSize(10)
        pdf.text("Vibe Coding Tips", 170, bottomY + 8, { align: "right" })

        // NO BOOKMARK ICON FOR TITLE SLIDE
      } else if (slide.type === "content") {
        // Headline with gradient color (using the first color for PDF)
        pdf.setTextColor(217, 70, 239) // #D946EF
        pdf.setFontSize(28) // Larger font for better readability
        pdf.setFont("helvetica", "bold")

        if (slide.headline) {
          const headlineLines = pdf.splitTextToSize(slide.headline, 150)
          let currentY = 70

          headlineLines.forEach((line: string) => {
            pdf.text(line, 20, currentY, { align: "left" })
            currentY += 12
          })

          // Body text
          if (slide.subtext) {
            pdf.setTextColor(255, 255, 255)
            pdf.setFontSize(16)
            pdf.setFont("helvetica", "normal")

            const subtextLines = pdf.splitTextToSize(slide.subtext, 150)
            currentY += 15

            subtextLines.forEach((line: string) => {
              pdf.text(line, 20, currentY, { align: "left" })
              currentY += 8
            })
          }
        }

        // Profile section at bottom (same as title)
        const bottomY = 200

        pdf.setFillColor(217, 70, 239) // #D946EF
        pdf.circle(30, bottomY, 8, "F")

        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(12)
        pdf.setFont("helvetica", "bold")
        pdf.text("VC", 30, bottomY + 4, { align: "center" })

        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(14)
        pdf.setFont("helvetica", "bold")
        pdf.text("Vibe Coding", 45, bottomY - 2)

        pdf.setTextColor(156, 163, 175)
        pdf.setFontSize(11)
        pdf.setFont("helvetica", "normal")
        pdf.text("@VibeCoding", 45, bottomY + 8)

        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(12)
        pdf.setFont("helvetica", "normal")
        pdf.text("Follow for", 170, bottomY - 2, { align: "right" })

        pdf.setTextColor(156, 163, 175)
        pdf.setFontSize(10)
        pdf.text("Vibe Coding Tips", 170, bottomY + 8, { align: "right" })
      } else if (slide.type === "cta") {
        // CTA text
        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(32) // Larger font for better impact
        pdf.setFont("helvetica", "bold")

        const ctaText = "Follow For More About Vibe Coding"
        const ctaLines = pdf.splitTextToSize(ctaText, 150)
        let currentY = 90

        ctaLines.forEach((line: string) => {
          pdf.text(line, 20, currentY, { align: "left" })
          currentY += 14
        })

        // Profile section at bottom (same as others)
        const bottomY = 200

        pdf.setFillColor(217, 70, 239) // #D946EF
        pdf.circle(30, bottomY, 8, "F")

        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(12)
        pdf.setFont("helvetica", "bold")
        pdf.text("VC", 30, bottomY + 4, { align: "center" })

        pdf.setTextColor(255, 255, 255)
        pdf.setFontSize(14)
        pdf.setFont("helvetica", "bold")
        pdf.text("Vibe Coding", 45, bottomY - 2)

        pdf.setTextColor(156, 163, 175)
        pdf.setFontSize(11)
        pdf.setFont("helvetica", "normal")
        pdf.text("@VibeCoding", 45, bottomY + 8)
      }
    })

    // Generate PDF buffer
    const pdfBuffer = pdf.output("arraybuffer")

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=linkedin-carousel.pdf",
      },
    })
  } catch (error) {
    console.error("Error generating PDF:", error)
    return new Response("Failed to generate PDF", { status: 500 })
  }
}
