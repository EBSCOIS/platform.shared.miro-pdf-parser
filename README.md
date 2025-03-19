# Miro Table Parser (from PDF)

This is a prototype app created to show the capabilities of the Developer Platform of Miro. The app parses a PDF file that contains Miro Tables within a Frame and converts them into SVGs in an HTML page. The app then parses the individual HTML elements and replicates them on the Miro board with Miro widgets (a grid of rectangles) instead of a table.

## DISCLAIMER

The content of this project is subject to the Miro Developer Terms of Use: https://miro.com/legal/developer-terms-of-use/

## What's in this project?

- `README.md`: This file.

- `pdf-to-svg-app.html`: This is the main app file. This is the file that will be connected in Miro to load the app on the board.

- `pdf-to-svg-panel.html`: This is the side panel that opens on the left side of the Miro tool bar when clicking on the app icon.

- `pdf-to-svg-panel.js`: This is the JavaScript file that performs the parsing of the PDF file and recreates the table on the Miro board. It's called from within `pdf-to-svg-panel.html`.

- `mirotone.css`: CSS files add styling rules to the content. The CSS applies styles to the elements in your HTML page. It's called from within `pdf-to-svg-panel.html`.

- `pdf.min.js`: PDF.js library to parse PDF documents and convert them into SVG (https://mozilla.github.io/pdf.js/). It's called from within `pdf-to-svg-panel.html`.

- `pdf.worker.min.js`: PDF.js Worker library, part of PDF.js (https://mozilla.github.io/pdf.js/). It's called from within `pdf.min.js`.

## Developing

### Prerequisites

- In the App settings, set the App Url to `http://localhost:3000/pdf-to-svg-app.html` and save
- Node installed

### Getting Started

Run `npm install -g serve`

Run `server`

Open to your desired Miro Board and start developing.

Set the App Url back to `https://ebscois.github.io/platform.shared.miro-pdf-parser/pdf-to-svg-app.html` to see the changes live. 
