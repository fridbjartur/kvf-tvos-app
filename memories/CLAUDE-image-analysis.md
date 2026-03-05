# Image Analysis Skill for Claude

## The Problem

When processing large images (especially full-page screenshots), small UI elements like icons, buttons, and fine text become a tiny fraction of the total image data. Claude's holistic image processing loses these details, leading to:

- **Confabulation**: Stating details with confidence that are actually incorrect
- **Assumption filling**: Guessing what icons/elements "should be" based on common patterns
- **False confidence**: Claiming to see things clearly when they're ambiguous

This is unacceptable for UI review, design feedback, or any task requiring accurate visual analysis.

---

## The Solution

**Never interpret small details from large images. Always slice, crop, and zoom first.**

Claude has access to ImageMagick and other image processing tools. Use them.

---

## Required Workflow for Image Analysis

### Step 1: Assess the Image

```bash
identify /path/to/image.png
```

This returns dimensions. If the image is larger than 800px in any dimension and you need to analyze small elements, proceed to slicing.

### Step 2: Identify Regions of Interest

For a typical full-page screenshot, regions include:

- Header/Navigation (top 80-150px)
- Hero section (varies)
- Content sections (middle)
- Footer (bottom 100-200px)
- Any specific UI element the user asks about

### Step 3: Crop Regions

```bash
# Syntax: convert input.png -crop WIDTHxHEIGHT+X+Y output.png

# Example: Extract footer from a 904x2000 image
convert screenshot.png -crop 904x200+0+1800 footer.png

# Example: Extract header/nav
convert screenshot.png -crop 904x100+0+0 header.png

# Example: Extract a specific region (middle section)
convert screenshot.png -crop 904x400+0+600 middle-section.png
```

### Step 4: Zoom Small Elements

For icons, buttons, or fine text, zoom 2-4x:

```bash
# 200% zoom
convert cropped-region.png -resize 200% zoomed.png

# 300% zoom for very small elements
convert icon-region.png -resize 300% icon-zoomed.png
```

### Step 5: View and Analyze

```bash
view /path/to/processed-image.png
```

Only after viewing the processed image should Claude make specific claims about what elements contain.

---

## Slicing Strategy for Full-Page Screenshots

For screenshots taller than 1500px, automatically slice into manageable sections:

```bash
# Create output directory
mkdir -p /home/claude/image-slices

# Get image dimensions
HEIGHT=$(identify -format "%h" input.png)
WIDTH=$(identify -format "%w" input.png)

# Slice into 500px tall sections
convert input.png -crop ${WIDTH}x500 /home/claude/image-slices/slice-%02d.png
```

Then view each slice as needed for the analysis.

---

## Icon and Small Element Analysis

Icons are typically 16-48px. In a 2000px tall screenshot, a 32px icon is 1.6% of the image height.

**Always isolate and zoom icons before identifying them:**

```bash
# If you know approximate icon location (e.g., footer icons at bottom center)
# 1. Crop the region generously
convert screenshot.png -crop 200x100+450+1900 icon-region.png

# 2. Zoom 3x
convert icon-region.png -resize 300% icons-zoomed.png

# 3. View
view icons-zoomed.png
```

---

## What Claude Must NOT Do

1. **Never claim to identify small UI elements from full-page screenshots without cropping/zooming first**

2. **Never assume what an icon is based on its location** (e.g., "footer icons are probably social links")

3. **Never state visual details with confidence when the source image lacks resolution for certainty**

4. **Never skip the crop/zoom process to save time** — accuracy matters more than speed

5. **Never say "I can see..." for small elements without having actually processed the image**

---

## Honest Uncertainty

If after cropping and zooming an element is still unclear:

- Say so: "Even after zooming, I cannot clearly distinguish this icon"
- Ask for a higher-resolution image or direct screenshot of that element
- Suggest fetching the actual HTML/code if available

**Admitting uncertainty is always better than confident confabulation.**

---

## Quick Reference Commands

```bash
# Get image dimensions
identify image.png

# Crop region (WIDTH x HEIGHT + X_OFFSET + Y_OFFSET)
convert image.png -crop 800x400+0+600 cropped.png

# Zoom 2x
convert image.png -resize 200% zoomed.png

# Crop and zoom in one command
convert image.png -crop 400x200+100+1800 -resize 200% output.png

# Slice tall image into 500px sections
convert image.png -crop 0x500 slices/slice-%02d.png

# Extract specific pixel region around a point (100px box around coordinates 450,1850)
convert image.png -crop 100x100+400+1800 -resize 300% element.png
```

---

## When to Apply This Skill

**Always apply when:**

- Reviewing UI screenshots for design feedback
- Identifying icons, buttons, or small text
- Verifying specific visual elements the user mentions
- Any task where visual accuracy matters

**May skip when:**

- Image is already small/focused (under 800px)
- User is asking about large, obvious elements (hero text, main headings)
- The question doesn't require identifying specific small elements

---

## Example: Correct UI Review Process

**User uploads a full-page screenshot and asks about footer icons**

❌ **Wrong approach:**

> "I can see GitHub and LinkedIn icons in the footer"

✅ **Correct approach:**

```bash
# 1. Check dimensions
identify screenshot.png
# Output: 904x2000

# 2. Crop footer region
convert screenshot.png -crop 904x150+0+1850 footer.png

# 3. Zoom for clarity
convert footer.png -resize 200% footer-zoomed.png

# 4. View processed image
view footer-zoomed.png
```

Then: "Looking at the zoomed footer, I can see a crescent moon icon (dark mode toggle) and an RSS icon (broadcast waves symbol)."

---

## Summary

**The rule is simple: If you can't see it clearly, process it until you can — or admit you can't.**

Claude has the tools. Use them. Never guess.
