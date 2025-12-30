# CV / Resume Repository

This repository contains my curriculum vitae, CV, in both Icelandic and English, along with various cover letters for job applications.

## 📄 CV Documents

- **[ferilskrá.md](ferilskrá.md)** - Icelandic CV
- **[resume.md](resume.md)** - English CV

## 🚀 PDF Generation

This repository includes a custom Markdown to PDF converter (`genpdf.js`) that generates professional PDFs from the Markdown files.

### Prerequisites

```bash
npm install
```

The script requires fonts to be present in the `fonts/` directory:
- `Roboto-Regular.ttf`
- `Roboto-Bold.ttf`
- `Roboto-Italic.ttf`
- `Roboto-BoldItalic.ttf`
- `RobotoMono-Regular.ttf`

### Usage

**Basic usage:**
```bash
node genpdf.js <input.md> <output.pdf>
```

**With preset metadata for CV:**
```bash
node genpdf.js ./ferilskrá.md ./Ferilskra_Halldor_Valberg.pdf --cv
```

**With preset metadata for cover letter:**
```bash
node genpdf.js ./kynningarbref/hugsmidjan.md ./kynningarbref/Kynningarbref_Hugsmidjan.pdf --cl
```

**Read from stdin:**
```bash
cat input.md | node genpdf.js - output.pdf
```

### Advanced Options

The PDF generator supports various customization options:

**Metadata flags:**
- `--cv` - Preset for curriculum vitae metadata
- `--cl` - Preset for cover letter (kynningarbréf) metadata
- `--title="Custom Title"` - Set PDF title
- `--author="Author Name"` - Set PDF author
- `--subject="Subject"` - Set PDF subject
- `--keywords="Keywords"` - Set PDF keywords

**Heading size flags:**
- `--h1=14` - Set absolute font size for H1 headings
- `--h2=13` - Set absolute font size for H2 headings
- `--h3=12` - Set absolute font size for H3 headings
- `--h1d=2` - Set relative delta for H1 (default: +2pt over body)
- `--h2d=1.5` - Set relative delta for H2 (default: +1.5pt over body)
- `--h3d=1` - Set relative delta for H3 (default: +1pt over body)

**Other flags:**
- `--txt` - Also generate a plain text version

### Features

The PDF generator includes:
- **Two-page A4 layout** with automatic font-size tuning
- **Markdown support**: headings, lists, bold/italic, code blocks, links, blockquotes
- **Professional typography** using Roboto fonts
- **Clickable links** for email, phone, and web URLs
- **Metadata embedding** for proper PDF properties
- **Minimal dependencies** (only pdfmake required)

### Example Commands

```bash
# Generate Icelandic CV
node genpdf.js ./ferilskrá.md ./Ferilskra_Halldor_Valberg.pdf --cv

# Generate English Resume
node genpdf.js ./resume.md ./Resume_Halldor_Valberg.pdf --cv

# Generate cover letter for Hugsmiðjan
node genpdf.js ./kynningarbref/hugsmidjan.md ./kynningarbref/Kynningarbref_Hugsmidjan.pdf --cl

# Generate cover letter for Dineout
node genpdf.js ./kynningarbref/dineout.md ./kynningarbref/Kynningarbref_dineout.pdf --cl
```

## Repository Structure

```
.
├── ferilskrá.md              # Icelandic CV
├── resume.md                  # English CV
├── genpdf.js                  # PDF generator script
├── package.json               # Node.js dependencies
└── fonts/                     # Font files for PDF generation
    └── README.md
```

## 📧 Contact

**Halldór Valberg Aðalbjargarson**  
Email: halldor.valberg@hotmail.com  
Phone: (+354) 866-6298  
LinkedIn: [linkedin.com/in/halldor-valberg](https://www.linkedin.com/in/halldor-valberg/)  
GitHub: [github.com/halldorvalberg](https://github.com/halldorvalberg)

## 📄 License

Personal CV repository - all rights reserved.
