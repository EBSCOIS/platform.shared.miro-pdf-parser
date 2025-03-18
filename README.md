# Miro Table Parser (from PDF)

This is a protorype app created to show the capabilities of the Developer Platform of Miro. The app parses a PDF file that contains Miro Tables within a Frame and converts them into SVGs in an HTML page. The app then parses the individual HTML elements and replicates them on the Miro board with Miro widgets (a grid of rectangles) instead of a table.

## DISCLAIMER

The content of this project is subject to the Miro Developer Terms of Use: https://miro.com/legal/developer-terms-of-use/

## What's in this project?

- `README.md`: This file.

- `pdf-to-svg-app.html`: This is the main app file. This is the file that will be connected in Miro to load the app on the board.

- `pdf-to-svg-panel.html`: This is the side panel that opens on the left side of the Miro tool bar when clicking on the app icon.

- `pdf-to-svg-panel.js`: This the JavaScript file that performs the parsing of the PDF file and recreates the table on the Miro board.

- `mirotone.css`: CSS files add styling rules to the content. The CSS applies styles to the elements in your HTML page.

- `pdf.min.js`: PDF.js library to parse PDF documents and convert them into SVG (https://mozilla.github.io/pdf.js/).

- `pdf.worker.min.js`: PDF Worker JavaScript file, part of PDF.js (https://mozilla.github.io/pdf.js/).
