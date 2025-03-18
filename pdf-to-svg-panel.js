/* DISCLAIMER: The content of this file is subject to the Miro Developer Terms of Use: https://miro.com/legal/developer-terms-of-use/ */

window.miroAppItems = {
  frame: null,
  elements: [] 
};

window.connectingLinesArray = [];
window.textContent = [];
window.sticky_notes = [];
window.baseCells = [];
window.extraCells = [];
window.miroFrames = null;
window.frameToReplicate = {
  id: null,
  index: null,
  element: null
};
window.miroWidgets = null;

/* Function to check if shape is double - The parsing of the PDF into SVG duplicate several shapes */
function isDoubleShape(shape) {
  let shapeRect = shape.getBoundingClientRect();
  let referenceArray = window.extraCells;
  let isDouble = false;
  for(let i=0; i < referenceArray.length; i++) {
    let referenceRect = referenceArray[i].extra_cell_element.getBoundingClientRect();
    if (Math.trunc(shapeRect.x) === Math.trunc(referenceRect.x) || Math.trunc(shapeRect.x - 1) === Math.trunc(referenceRect.x) || Math.trunc(shapeRect.x + 1) === Math.trunc(referenceRect.x) || Math.trunc(shapeRect.x - 2) === Math.trunc(referenceRect.x) || Math.trunc(shapeRect.x + 2) === Math.trunc(referenceRect.x)) {
      if (Math.trunc(shapeRect.y) === Math.trunc(referenceRect.y) || Math.trunc(shapeRect.y - 1) === Math.trunc(referenceRect.y) || Math.trunc(shapeRect.y + 1) === Math.trunc(referenceRect.y) || Math.trunc(shapeRect.y - 2) === Math.trunc(referenceRect.y) || Math.trunc(shapeRect.y + 2) === Math.trunc(referenceRect.y)) {
        shape.setAttribute('data-type', 'duplicate-shape');
        shape.parentElement.parentElement.setAttribute('data-type', 'duplicate-shape-parent');
        isDouble = true;
      }
    }
  }
  return isDouble;
}

/* Function to check if element is the first child of its parent */
function isFirstChild(element) {
  return element.parentNode && element.parentNode.firstElementChild === element;
}

/* Function to get PDF data */
async function getPdfObjectData(pdfObjects, objIds) {
  const promises = objIds.map((objId) => {
    return new Promise((resolve, reject) => {
      pdfObjects.get(objId, (data) => {
        if (data) {
          resolve({ objId, data });
        } else {
          reject(new Error(`Failed to get data for ${objId}`));
        }
      });
    });
  });

  try {
    const results = await Promise.all(promises);
    return results; // Return results for further processing
  }
  catch (error) {
    console.error('Error fetching data:', error);
    throw error; // Re-throw error if necessary
  }
}

/* Function to check if rectangle is a underline of links */
function isRectangularLinkLine(pathElement) {
  let rect = pathElement.getBoundingClientRect();
  if (rect.width < window.mainTable.width && rect.height < window.mainTable.height) {
    if (pathElement.nextSibling && pathElement.nextSibling.tagName === 'svg:text') {

      // Get the 'd' attribute of the path
      var pathData = pathElement.getAttribute('d');

      // Parse the path data into commands and coordinates
      var commands = pathData.split(/[\s,]/).filter(token => token.trim() !== '');

      // Function to calculate the distance between two points
      function distance(point1, point2) {
        return Math.sqrt((point1.x - point2.x) ** 2 + (point1.y - point2.y) ** 2);
      }

      // Function to check if four points form a rectangle
      function isRectangle(points) {
        if (points.length !== 4) return false;

        // Calculate distances between all points
        var distances = [
          distance(points[0], points[1]), // Side 1
          distance(points[1], points[2]), // Side 2
          distance(points[2], points[3]), // Side 3
          distance(points[3], points[0]), // Side 4
          distance(points[0], points[2]), // Diagonal 1
          distance(points[1], points[3]), // Diagonal 2
        ];

        // Check that opposite sides are equal and diagonals are equal
        var tolerance = 0.001; // Adjust based on precision requirements
        var isOppositeSidesEqual =
          Math.abs(distances[0] - distances[2]) < tolerance &&
          Math.abs(distances[1] - distances[3]) < tolerance;
        var isDiagonalsEqual = Math.abs(distances[4] - distances[5]) < tolerance;

        return isOppositeSidesEqual && isDiagonalsEqual;
      }

      // Extract points from the path commands
      var points = [];
      let currentPoint = { x: 0, y: 0 };

      for (let i = 0; i < commands.length; i++) {
        var command = commands[i];
        if (command === 'M' || command === 'L') {
          currentPoint = {
            x: parseFloat(commands[i + 1]),
            y: parseFloat(commands[i + 2]),
          };
          points.push(currentPoint);
        } else if (command === 'H') {
          currentPoint = {
            x: parseFloat(commands[i + 1]),
            y: currentPoint.y,
          };
          points.push(currentPoint);
        } else if (command === 'V') {
          currentPoint = {
            x: currentPoint.x,
            y: parseFloat(commands[i + 1]),
          };
          points.push(currentPoint);
        } else if (command === 'Z') {
          // Close the path by connecting to the first point
          points.push(points[0]);
        }
      }

      // Remove duplicate points (e.g., if the path ends with 'Z')
      var uniquePoints = [];
      for (var point of points) {
        var isDuplicate = uniquePoints.some(
          (p) => Math.abs(p.x - point.x) < 0.001 && Math.abs(p.y - point.y) < 0.001
        );
        if (!isDuplicate) {
          uniquePoints.push(point);
        }
      }

      // Check if the points form a rectangle
      if (uniquePoints.length === 4 && isRectangle(uniquePoints)) {
        return true;
      }
      else {
        return false;
      }
    }
  }
}

/* Function to check if shape is a rectangle */
function isRectangularBox(pathElement) {
  let rect = pathElement.getBoundingClientRect();
  if (rect.width < window.mainTable.width && rect.height < window.mainTable.height) {
    if (!pathElement.nextSibling || pathElement.nextSibling.tagName !== 'svg:text') {
      // Get the 'd' attribute of the path
      var pathData = pathElement.getAttribute('d');

      // Parse the path data into commands and coordinates
      var commands = pathData.split(/[\s,]/).filter(token => token.trim() !== '');

      // Function to calculate the distance between two points
      function distance(point1, point2) {
        return Math.sqrt((point1.x - point2.x) ** 2 + (point1.y - point2.y) ** 2);
      }

      // Function to check if four points form a rectangle
      function isRectangle(points) {
        if (points.length !== 4) return false;

        // Calculate distances between all points
        var distances = [
          distance(points[0], points[1]), // Side 1
          distance(points[1], points[2]), // Side 2
          distance(points[2], points[3]), // Side 3
          distance(points[3], points[0]), // Side 4
          distance(points[0], points[2]), // Diagonal 1
          distance(points[1], points[3]), // Diagonal 2
        ];

        // Check that opposite sides are equal and diagonals are equal
        var tolerance = 0.001; // Adjust based on precision requirements
        var isOppositeSidesEqual =
          Math.abs(distances[0] - distances[2]) < tolerance &&
          Math.abs(distances[1] - distances[3]) < tolerance;
        var isDiagonalsEqual = Math.abs(distances[4] - distances[5]) < tolerance;

        return isOppositeSidesEqual && isDiagonalsEqual;
      }

      // Extract points from the path commands
      var points = [];
      let currentPoint = { x: 0, y: 0 };

      for (let i = 0; i < commands.length; i++) {
        var command = commands[i];
        if (command === 'M' || command === 'L') {
          currentPoint = {
            x: parseFloat(commands[i + 1]),
            y: parseFloat(commands[i + 2])
          };
          points.push(currentPoint);
        } else if (command === 'H') {
          currentPoint = {
            x: parseFloat(commands[i + 1]),
            y: currentPoint.y
          };
          points.push(currentPoint);
        } else if (command === 'V') {
          currentPoint = {
            x: currentPoint.x,
            y: parseFloat(commands[i + 1])
          };
          points.push(currentPoint);
        } else if (command === 'Z') {
          // Close the path by connecting to the first point
          points.push(points[0]);
        }
      }

      // Remove duplicate points (e.g., if the path ends with 'Z')
      var uniquePoints = [];
      for (var point of points) {
        var isDuplicate = uniquePoints.some(
          (p) => Math.abs(p.x - point.x) < 0.001 && Math.abs(p.y - point.y) < 0.001
        );
        if (!isDuplicate) {
          uniquePoints.push(point);
        }
      }

      // Check if the points form a rectangle
      if (uniquePoints.length === 4 && isRectangle(uniquePoints)) {
        return true;
      }
      else {
        return false;
      }
    }
  }
}
    
/* Function to check if SVG path is within a specific element */
function checkTextPathsWithinElement(refElement) {

  // Define the specific rectangle coordinates (e.g., top-left and bottom-right points)
  const elementRect = refElement.getBoundingClientRect;
  const rect = {
    left: elementRect.left,  // x1
    top: elementRect.top,   // y1
    right: elementRect.right, // x2
    bottom: elementRect.bottom // y2
  };

  // Get all elements with the specified tag name
  const elements = document.getElementsByTagName('tspan');

  // Filter elements within the rectangle
  const firstElementInRect = Array.from(elements).find((element) => {
    const boundingBox = element.getBoundingClientRect();

    // Check if the element's bounding box is within the specified rectangle
    const isWithinRect =
      boundingBox.left >= rect.left &&
      boundingBox.right <= rect.right &&
      boundingBox.top >= rect.top &&
      boundingBox.bottom <= rect.bottom;

    // Check if the element has non-empty textContent
    const hasTextContent = element.textContent.trim().length > 0;

    // Return true if both conditions are met
    return isWithinRect && hasTextContent;
  });
}
    
/* Function to convert PDF coordinates to absolute coordinates */
function convertToAbsoluteCoordinates(pdfX, pdfY, viewport) {

  // Flip the y-coordinate (PDF's origin is bottom-left, web's is top-left)
  const flippedY = viewport.height - pdfY;

  // Apply viewport transformation (scaling and offset)
  const absoluteX = pdfX * viewport.scale + viewport.offsetX;
  const absoluteY = flippedY * viewport.scale + viewport.offsetY;

  return { x: absoluteX, y: absoluteY };
}
    
/* Function to estimate text width and height */
function estimateTextDimensions(text, fontSize) {

  // Approximate width based on font size and text length
  const width = text.length * fontSize * 0.6; // Adjust factor based on font
  const height = fontSize; // Height is approximately equal to font size
  return { width, height };
}

/* Function to find duplicates within an Array */
function findDuplicates(array) {
  const seen = new Set();
  const duplicates = new Set();

  array.forEach(item => {
    if (seen.has(item.title)) {
      duplicates.add(item.title);
    } else {
      seen.add(item.title);
    }
  });

  return Array.from(duplicates);
}

/* Function to get Frame Title */
async function getFrameTitles(title) {
  window.miroFrames = await miro.board.get({type: 'frame'});
  let frames = window.miroFrames;
  const duplicateTitles = findDuplicates(frames);
  if (duplicateTitles.length > 0) {
    console.log("Duplicate titles found:", duplicateTitles);
    alert('There are frames with the same title. To parse the PDF it\'s necessary that each frame in your board has a unique title');
    return false;
  }
  else {
    console.log("All titles are unique.");
  }
  for(let i=0; i < frames.length; i++){
      let htmlString = frames[i].title;
      extractRenderedText(htmlString, 'frame', i);
  }
  let titleFound = false;
  for(let i=0; i < frames.length; i++){
      if (frames[i].plain_text === title) {
        titleFound = true;
        window.frameToReplicate.id = frames[i].id;
        window.frameToReplicate.index = i;
        window.frameToReplicate.element = frames[i];
        return true;
      }
  }
  if (!titleFound) {
    alert('The provided frame title was not found on this board');
    return false;
  }
  else {
    return window.frameToReplicate; 
  }
}

/* Function to extract text as rendered (without spaces and tags) */
function extractRenderedText(htmlString, type, index) {

  // Create a temporary container element
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.top = "-9999px"; // Move off-screen to avoid visibility
  container.style.left = "-9999px";
  container.style.visibility = "hidden";

  // Set the HTML string as the content
  container.innerHTML = htmlString;
  document.body.appendChild(container); // Append to the DOM

  // Extract the rendered text
  const renderedText = container.textContent; // innerText respects rendered spacing
  if (type === 'frame') {
    window.miroFrames[index].plain_text = renderedText;
  }
  else if (type === 'widget') {
    window.miroWidgets[index].plain_text = renderedText.replace(/\s+/g, ''); // Remove all whitespace characters
  }

  // Remove the temporary container
  document.body.removeChild(container);

  return renderedText;
}

/* Function to add individual widgets to Frames */
async function attachToFrame() {
  let frame = window.miroAppItems.frame;
  let array = window.miroAppItems.elements;

  for(let i=0; i < array.length; i++) {
    await frame.add(array[i]);
  }

  return true;
}
    
/* Function to generate cells from intersections */
function generateCellsFromIntersections(intersections) {
  const cells = [];

  // Assuming the cells are rectangular, we can create bounding boxes for each cell
  // This is a simplified approach; you may need more sophisticated logic for irregular tables
  for (let i = 0; i < intersections.length - 1; i++) {
      const cell = {
          x: intersections[i].x,
          y: intersections[i].y,
          width: Math.abs(intersections[i + 1].x - intersections[i].x),
          height: Math.abs(intersections[i + 1].y - intersections[i].y)
      };
      cells.push(cell);
  }

  return cells;
}

/* Function to create Miro Frames */
async function createFrame(title,x,y,width,height,color) {
  const frame = await window.miro.board.createFrame({
    title: title,
    style: {
      fillColor: (color || '#ffffff')
    },
    x: x,
    y: y,
    width: width,
    height: height
  });
  window.miroAppItems.frame = frame;

  return frame;
}

/* Function to create Miro rectangular shapes */
async function createRectangle(text,x,y,w,h,style,frame,htmlId) {
  const shape = await window.miro.board.createShape({
    content: (text || ''),
    shape: 'rectangle',
    style: style,
    x: x,
    y: y,
    width: w,
    height: h
  });
  if (frame) { await frame.add(shape) }
  let p = window.connectingLinesArray.length;
  while (--p >= 0) {
    if (connectingLinesArray[p].startElement.html_id === htmlId) {
      connectingLinesArray[p].startElement.miro_id = shape.id;
    }
    if (connectingLinesArray[p].endElement.html_id === htmlId) {
      connectingLinesArray[p].endElement.miro_id = shape.id;
    }
  }
  window.miroAppItems.elements.push(shape);

  return shape;
}

/* Function to create Miro sticky notes */
async function createStickyNote(text,x,y,w,type,style,tags,frame,htmlId) {
  const sticky = await window.miro.board.createStickyNote({
    content: (text || ''),
    shape: type,
    style: style,
    x: x,
    y: y,
    width: w,
    tagIds: tags
  });
  if (frame) { await frame.add(sticky) }
  let p = window.connectingLinesArray.length;
  while (--p >= 0) {
    if (connectingLinesArray[p].startElement.html_id === htmlId) {
      connectingLinesArray[p].startElement.miro_id = sticky.id;
    }
    if (connectingLinesArray[p].endElement.html_id === htmlId) {
      connectingLinesArray[p].endElement.miro_id = sticky.id;
    }
  }
  window.miroAppItems.elements.push(sticky);

  return sticky;
}
    
/* Function to create Miro connecting lines */
async function createConnectingLine(start,end,snapStart,snapEnd) {
  
  // Create a connector.
  const connector = await miro.board.createConnector({
    shape: 'curved',
    style: {
      startStrokeCap: 'none',
      endStrokeCap: 'rounded_stealth',
      strokeStyle: 'normal',
      strokeColor: '#333333', // Magenta
      strokeWidth: 2
    },
    // Set the start point of the connector.
    start: {
      // Define the start board item for the connector by specifying the 'start' item ID.
      item: start,
      // Set a point on the border of the 'start' shape to mark the start point of the connector.
      snapTo: snapStart
    },
    // Set the end point of the connector.
    end: {
      // Define the end board item for the connector by specifying the 'end' item ID.
      item: end,
      // Set a snapTo of 'end' shape to mark the end point of the connector.
      snapTo: snapEnd
    }
  });
  
  return connector;
}

/* Function to trigger multiple shape creations */
async function createShapes(array, type, frame) {
  const shapeCreationPromises = []; // Array to hold all promises
  const viewport = await miro.board.viewport.get();

  // Loop through the shapes and trigger creation
  if (!array) {debugger;}
  for (let i = 0; i < array.length; i++) {
      if (type === 'base_cells') {
        let el = array[i].element;
        let rect = el.getBoundingClientRect();
        let text = (array[i].formatted_text ? array[i].formatted_text : array[i].text_content_orig ? array[i].text_content_orig : '');              
        let x = ((rect.left + rect.width / 2) + (frame.x - (frame.width / 2)));
        let y = ((rect.top + rect.height / 2) + (frame.y - (frame.height / 2)));
        let w = rect.width;
        let h = rect.height;

        let style = {
          color: (array[i].font_color ? array[i].font_color : '#ff0000'),
          fillColor: (array[i]?.text_style?.fillColor ? array[i]?.text_style?.fillColor : array[i]?.background_color ? array[i]?.text_style?.fillColor : '#ffffff'),
          fontSize: 5,
          fontFamily: 'arial',
          textAlign: 'center',
          textAlignVertical: 'middle',
          borderStyle: 'normal',
          borderOpacity: 1.0,
          borderColor: linesColor,
          borderWidth: 1.0,
          fillOpacity: (array[i]?.text_style?.fillOpacity ? array[i]?.text_style?.fillOpacity : array[i]?.background_opacity ? array[i]?.background_opacity : 1.0)
        };

        shapeCreationPromises.push(createRectangle(text,x,y,w,h,style,frame));
      }
      else if (type === 'extra_cells') {
        for(let f=0; f < window.miroWidgets.length; f++) {
          if (window.miroWidgets[f].type === 'shape') {
            if (array[i].text_content === window.miroWidgets[f].plain_text) {
              array[i].formatted_text = window.miroWidgets[f].content;
              array[i].text_style = window.miroWidgets[f].style;
            }
          }
        }
        let el = array[i].extra_cell_element
        let rect = el.getBoundingClientRect();
        let text = (array[i].formatted_text ? array[i].formatted_text : array[i].text_content_orig ? array[i].text_content_orig : '');            
        let x = ((rect.left + rect.width / 2) + (frame.x - (frame.width / 2)));
        let y = ((rect.top + rect.height / 2) + (frame.y - (frame.height / 2)));
        let w = rect.width;
        let h = rect.height;

        let style = {
          color: (array[i]?.text_style?.color ? array[i]?.text_style?.color : array[i].font_color ? array[i].font_color : '#1a1a1a'),
          fillColor: (array[i]?.text_style?.fillColor ? array[i]?.text_style?.fillColor : array[i]?.background_color ? array[i]?.background_color : '#ffffff'),
          fontSize: 4,
          fontFamily: array[i]?.text_style?.fontFamily ? array[i]?.text_style?.fontFamily : 'arial',
          textAlign: array[i]?.text_style?.textAlign ? array[i].text_style.textAlign : 'center',
          textAlignVertical: array[i]?.text_style?.textAlignVertical ? array[i]?.text_style?.textAlignVertical : 'middle',
          borderStyle: array[i]?.text_style?.borderStyle ? array[i].text_style.borderStyle : 'normal',
          borderOpacity: array[i]?.text_style?.borderOpacity ? array[i].text_style.borderOpacity : 1.0,
          borderColor: array[i]?.text_style?.borderColor ? array[i].text_style.borderColor : linesColor,
          borderWidth: array[i]?.text_style?.borderWidth ? array[i].text_style.borderWidth : 2.0,
          fillOpacity: (array[i]?.text_style?.fillOpacity ? array[i]?.text_style?.fillOpacity : array[i]?.background_opacity ? array[i]?.background_opacity : 1.0)
        };

        shapeCreationPromises.push(createRectangle(text,x,y,w,h,style,frame,array[i].extra_cell));
      }
      else if (type === 'stickies') {
        for(let f=0; f < window.miroWidgets.length; f++) {
          if (window.miroWidgets[f].type === 'sticky_note') {
            if (array[i].text_content === window.miroWidgets[f].plain_text) {
              array[i].formatted_text = window.miroWidgets[f].content;
              array[i].text_style = window.miroWidgets[f].style;
              array[i].tags = window.miroWidgets[f].tagIds;
            }
          }
        }
        const colorMapping = {
          '#f5f6f8': 'gray',
          '#fff9b1': 'light_yellow',
          '#f5d128': 'yellow',
          '#ff9d48': 'orange',
          '#d5f692': 'light_green',
          '#c9df56': 'green',
          '#93d275': 'dark_green',
          '#67c6c0': 'cyan',
          '#ffcee0': 'light_pink',
          '#ea94bb': 'pink',
          '#c6a2d2': 'violet',
          '#f0939d': 'red',
          '#a6ccf5': 'light_blue',
          '#6cd8fa': 'blue',
          '#9ea9ff': 'dark_blue',
          '#000000': 'black'
        };
        let el = array[i].element
        let rect = el.getBoundingClientRect();
        let text = (array[i].formatted_text ? array[i].formatted_text : '');              
        let x = ((rect.left + rect.width / 2) + (frame.x - (frame.width / 2)));
        let y = ((rect.top + rect.height / 2) + (frame.y - (frame.height / 2)));
        
        let w = rect.width;
        let type = array[i].shape;
        let style = {
          fillColor: colorMapping[el.getAttribute('fill')],
          textAlign: 'center',
          textAlignVertical: 'middle'
        };
        let tags = (array[i].tags ? array[i].tags : []);

        shapeCreationPromises.push(createStickyNote(text,x,y,w,type,style,tags,frame,array[i].id));
      }
      else if (type === 'frame') {
        const frame = array[i];
        const frameRect = frame.getBoundingClientRect();
        const frameX = (frameRect.left + (frameRect.width / 2) + (viewport.x + (viewport.width / 2)));
        const frameY = (frameRect.top + (frameRect.height / 2) + (viewport.y + (viewport.height / 2)));
        
        shapeCreationPromises.push(createFrame('App Frame',frameX,frameY,frameRect.width,frameRect.height,window.miroFrames[0]?.style?.fillColor));
      }
      else if (type === 'floating_boxes') {
        for(let f=0; f < window.miroWidgets.length; f++) {
          if (window.miroWidgets[f].type === 'shape') {
            if (array[i].text_content === window.miroWidgets[f].plain_text) {
              array[i].formatted_text = window.miroWidgets[f].content;
              array[i].text_style = window.miroWidgets[f].style;
            }
          }
        }
        let el = array[i].element
        let rect = el.getBoundingClientRect();
        let text = (array[i].formatted_text ? array[i].formatted_text : '');             
        let x = ((rect.left + rect.width / 2) + (frame.x - (frame.width / 2)));
        let y = ((rect.top + rect.height / 2) + (frame.y - (frame.height / 2)));
        let w = rect.width;
        let h = rect.height;

        let style = {
          color: (array[i]?.text_style?.color ? array[i].text_style.color : '#ff0000'),
          fillColor: (array[i].background_color ? array[i].background_color : array[i].text_style.fillColor ? array[i].text_style.fillColor : '#ff0000'),
          fontSize: (array[i].font_size ? array[i].font_size : (array[i].text_style.fontSize ? array[i].text_style.fontSize : 14)),
          fontFamily: array[i].text_style.fontFamily ? array[i].text_style.fontFamily : 'arial',
          textAlign: array[i].text_style.textAlign ? array[i].text_style.textAlign : 'center',
          textAlignVertical: array[i].text_style.textAlignVertical ? array[i].text_style.textAlignVertical : 'middle',
          borderStyle: array[i].text_style.borderStyle ? array[i].text_style.borderStyle : 'normal',
          borderOpacity: array[i].text_style.borderOpacity ? array[i].text_style.borderOpacity : 1.0,
          borderColor: array[i].text_style.borderColor ? array[i].text_style.borderColor : '#ffffff',
          borderWidth: array[i].text_style.borderWidth ? array[i].text_style.borderWidth : 1.0,
          fillOpacity: (array[i].opacity ? array[i].opacity : array[i]?.text_style?.fillOpacity ? array[i]?.text_style?.fillOpacity : 1.0)
        };

        shapeCreationPromises.push(createRectangle(text,x,y,w,h,style,frame,array[i].element));
      }
      else if (type === 'connecting_lines') {
        const line = array[i];
        const startEl = array[i].startElement.miro_id;
        const endEl = array[i].endElement.miro_id;
        const startSnap = array[i].startElement.side;
        const endSnap = array[i].endElement.side;
        
        shapeCreationPromises.push(createConnectingLine(startEl,endEl,startSnap,endSnap));
      }
  }

  // Wait for all shape creations to complete
  const allShapes = await Promise.all(shapeCreationPromises);

  // Return the results once all are completed
  return allShapes;
}

/* Function to classify a path as a square or rectangle */
function classifyShape(path, THRESHOLD) {
  const bbox = path.getBBox(); // Get the bounding box
  const width = bbox.width;
  const height = bbox.height;

  // Calculate the difference between width and height
  const difference = Math.abs(width - height);
  const maxDimension = Math.max(width, height);

  // Normalize the difference to a ratio (0 to 1)
  const ratio = difference / maxDimension;

  // Classify based on the threshold
  if (ratio <= THRESHOLD) {
    return 'square';
  } else {
    return 'rectangle';
  }
}

/* Function check if an element is within another */
function isElementWithin(elementA, elementB) {
  const rectA = elementA.getBoundingClientRect();
  const rectB = elementB.getBoundingClientRect();

  // Check if B's edges are within A's edges
  const isWithin =
      rectB.left >= rectA.left &&
      rectB.right <= rectA.right &&
      rectB.top >= rectA.top &&
      rectB.bottom <= rectA.bottom;

  return isWithin;
}
    
/* Function to check if a specific text is within a specific element */
function isTextElementWithin(elementA, elementB) {
  const rectA = elementA.getBoundingClientRect()
  const rectB = elementB.rect;

  // Check if B's edges are within A's edges
  const isWithin =
      rectB.left >= rectA.left &&
      rectB.right <= rectA.right &&
      rectB.top >= rectA.top &&
      rectB.bottom <= rectA.bottom;

  return isWithin;
}
    
/* Function to locate the SVG html text element that is within a specific SVG element */
function findTHtmlTextElementWithin(elementA,string) {
  const rectA = elementA.getBoundingClientRect();
  const arrayOfTextElements = document.querySelectorAll('tspan:not([data-matched])');
  let rectB;
  
  for(let i=0; i < arrayOfTextElements.length; i++) {
    if (string !== '' && (arrayOfTextElements[i].textContent&& arrayOfTextElements[i].textConent !== '')) {
      rectB = arrayOfTextElements[i].getBoundingClientRect();
      
      // Check if B's edges are within A's edges
      let isWithin =
          rectB.left >= rectA.left &&
          rectB.right <= rectA.right &&
          rectB.top >= rectA.top &&
          rectB.bottom <= rectA.bottom;
      if (isWithin) {
        //if (string === 'F84379') {debugger;}
        return arrayOfTextElements[i];
      }
    }
  }
}
    
/* Function to check if a point is near a square */
function isNearSquare(point, threshold = 34) {
  const squares = document.querySelectorAll('path[data-type="sticky_note"]');
  
  for(let i=0; i < squares.length;i++) {
    const rect = squares[i].getBoundingClientRect();
    const { left, right, top, bottom } = rect;

    // Check if the point is close to any edge of the square
    const nearLeft = Math.abs(point.x - left) <= threshold && point.y >= top && point.y <= bottom;
    const nearRight = Math.abs(point.x - right) <= threshold && point.y >= top && point.y <= bottom;
    const nearTop = Math.abs(point.y - top) <= threshold && point.x >= left && point.x <= right;
    const nearBottom = Math.abs(point.y - bottom) <= threshold && point.x >= left && point.x <= right;
    
    if (nearLeft || nearRight || nearTop || nearBottom) {
      return {
        html_id: squares[i].id,
        side: (nearLeft ? 'left' : (nearRight ? 'right' : (nearTop ? 'top' : (nearBottom ? 'bottom' : null))))
      };
    }
  }

  return null; 
}
    
/* Function to capture and log the X, Y coordinates of a mouse click */
function getClickCoordinates(event) {
  const x = event.clientX;  // X coordinate of the mouse click
  const y = event.clientY;  // Y coordinate of the mouse click
  console.log(`Mouse clicked at X: ${x}, Y: ${y}`);
}

/* Attach the event listener to the document */
//document.addEventListener('click', getClickCoordinates); // (used only for debugging purposes)

/* Function to identify the location of an element taking transformations into a account */
function parseTransformMatrix(matrixString) {
  let matrixValues = matrixString.replaceAll('matrix(','');
  matrixValues = matrixValues.replaceAll(')','');
  matrixValues = matrixValues.split(' ');

  return {
    a: parseFloat(matrixValues[0]), // Scale X
    b: parseFloat(matrixValues[1]), // Skew Y
    c: parseFloat(matrixValues[2]), // Skew X
    d: parseFloat(matrixValues[3]), // Scale Y
    e: parseFloat(matrixValues[4]), // Translate X
    f: parseFloat(matrixValues[5]) // Translate Y
  };
}

/* Function to identify to a point to determine its location */
function applyMatrixToPoint(x, y, matrix) {
  let result = {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f
  }; 
  return result;
}

/* Function to parse the 'd' attribute and extract line segments */
function parsePathElement(path) {
  const d = path.getAttribute('d'); // Get the 'd' attribute
  const commands = d.match(/[a-zA-Z][^a-zA-Z]*/g); // Split commands and their coordinates

  let previousPoint = null; // Track the previous point for segments

  commands.forEach(command => {
      const type = command[0]; // The command type (e.g., M, L)
      const values = command.slice(1).trim().split(/[\s,]+/).map(Number); // Extract coordinates

      if (type === 'M' || type === 'L') {
          const x = values[0];
          const y = values[1];

          if (previousPoint) {
              // Store the line segment coordinates
              lines.push({
                  x1: previousPoint.x,
                  y1: previousPoint.y,
                  x2: x,
                  y2: y
              });
          }

          // Update the previous point
          previousPoint = { x, y };
      }
  });
}

/* Function to get intersection point */
function getIntersection(vLine, hLine) {

  // Getting the bounding rectangles of vertical and horizontal lines
  const vRect = vLine.getBoundingClientRect();  // Vertical line bounding box
  const hRect = hLine.getBoundingClientRect();  // Horizontal line bounding box

  // The vertical line (vLine) must have the same x position in the range of the horizontal line (hLine)
  // And the horizontal line (hLine) must have the same y position in the range of the vertical line (vLine)

  if (
    vRect.left <= hRect.right && vRect.right >= hRect.left &&   // Vertical line intersects with horizontal line's x range
    hRect.top <= vRect.bottom && hRect.bottom >= vRect.top       // Horizontal line intersects with vertical line's y range
  ) {
    // Return the intersection point (x, y), using the center of the bounding box
    return { 
      x: (vRect.left + vRect.right) / 2, 
      y: (hRect.top + hRect.bottom) / 2 
    };
  }

  return null;  // No intersection
}

/* Function to calculate boxes from line intersections */
function generateCellsFromIntersections3(verticalLines, horizontalLines, color) {
  const cells = [];
  let count = 0;

  // Iterate over vertical lines using a for loop
  for (let i = 0; i < verticalLines.length - 1; i++) {
    const vLine1 = verticalLines[i];
    const vLine2 = verticalLines[i + 1];

    // Iterate over horizontal lines using a for loop
    for (let j = 0; j < horizontalLines.length - 1; j++) {
      const hLine1 = horizontalLines[j];
      const hLine2 = horizontalLines[j + 1];

      // Get the intersection points (e.g., use the bounding boxes of the lines)
      const intersectionTopLeft = getIntersection(vLine1, hLine1);
      const intersectionBottomRight = getIntersection(vLine2, hLine2);

      if (intersectionTopLeft && intersectionBottomRight) {
        let { x: x1, y: y1 } = intersectionTopLeft; // Top-left corner
        let { x: x2, y: y2 } = intersectionBottomRight; // Bottom-right corner

        // Create a new div element for the cell
        const cell = document.createElement('div');
        cell.style.position = 'absolute';  // Position using absolute positioning

        // Position the cell based on the top-left corner of the intersection
        cell.style.left = `${x1}px`; // Horizontal position of the cell
        cell.style.top = `${y1}px`; // Vertical position of the cell

        // Set the width and height based on the intersection dimensions
        cell.style.width = `${(Math.abs(x2 - x1) - 1)}px`;  // Width based on intersection distance
        cell.style.height = `${(Math.abs(y2 - y1) - 1)}px`; // Height based on intersection distance
        
        // Style the cell (e.g., color, border)
        cell.style.backgroundColor = 'white'; // Color for the cell
        cell.style.border = `1px solid ${color}`; // Border for visibility
        cell.id = `base_cell_${count}`;
        cell.className = 'base_cell';
        cell.style.zIndex = '-1';
        cell.setAttribute('fill', '#ffffff');

        // Append the cell to the parent container (usually an SVG or HTML container)
        document.getElementById('output').appendChild(cell);  // Append to the body or a specific parent element
        count = count + 1;
        cells.push(cell);
      }
    }
  }

  let firstCell = cells[0].getBoundingClientRect();
  let lastCell = cells[cells.length - 1].getBoundingClientRect();
  
  window.mainTable = {
    top: Math.trunc(firstCell.top),
    left: Math.trunc(firstCell.left),
    bottom: Math.trunc(lastCell.bottom),
    right: Math.trunc(lastCell.right),
    width: (Math.trunc(lastCell.right) - Math.trunc(firstCell.left)),
    height: (Math.trunc(lastCell.bottom) - Math.trunc(firstCell.top))
  }

  return cells;
}

/* Function to start parsing the created SVGs created by the PDF parser */
function postProcessSVG(svg) {
  const lines = [];

  // Get all lines (or paths that represent table borders)
  var paths = svg.querySelectorAll('svg path[stroke-linejoin="miter"]');
  var table = svg.querySelectorAll('#output svg g > [clip-path="url(#clippath3)"]')[0];
  var tableHeight = table.getBoundingClientRect().height;
  var tableWidth = table.getBoundingClientRect().width; 

  for(let i=0; i < paths.length; i++) {  
    if (paths[i].getBoundingClientRect().height + 52 > tableHeight || paths[i].getBoundingClientRect().width === tableWidth) {
      paths[i].setAttribute('id',`table_line${i}`);
      paths[i].setAttribute('data-type','table-line');
      linesColor = paths[i].getAttribute('stroke');
      const boundingBox = paths[i].getBoundingClientRect();

      // Extract coordinates
      const x1 = boundingBox.left;
      const y1 = boundingBox.top;
      const x2 = boundingBox.right;
      const y2 = boundingBox.bottom;
      
      // Store the line segment coordinates
      lines.push({
          x1: x1,
          y1: y1,
          x2: x2,
          y2: y2
      });    
    }
  }

  const verticalLines = [];
  const horizontalLines = [];

  for(let i=0; i < lines.length; i++) {
      if (lines[i].y1 === lines[i].y2) {
          horizontalLines.push(lines[i]);
      }
      else {
          verticalLines.push(lines[i]);
      }
  }

  if (verticalLines.length > 0 && horizontalLines.length > 0) {
    window.linesGrid = true;
    const cells = generateCellsFromIntersections3(verticalLines, horizontalLines, linesColor);
  }
  else {
    window.linesGrid = false;
    let principalTable = document.querySelector('svg > g > g:nth-of-type(8)');
    principalTableRect = principalTable.getBoundingClientRect();
    
    window.mainTable = {
      top: Math.trunc(principalTableRect.top),
      left: Math.trunc(principalTableRect.left),
      bottom: Math.trunc(principalTableRect.bottom),
      right: Math.trunc(principalTableRect.right),
      width: (Math.trunc(principalTableRect.right) - Math.trunc(principalTableRect.left)),
      height: (Math.trunc(principalTableRect.bottom) - Math.trunc(principalTableRect.top))
    }
  }
}

/* Function to find intersections of lines */
function findIntersections(lines) {
  const intersections = [];

  for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
          const intersection = getIntersection(lines[i], lines[j]);
          if (intersection) {
              intersections.push(intersection);
          }
      }
  }

  // Assuming the cells are rectangular, generate cell bounding boxes based on intersections
  return generateCellsFromIntersections(intersections);
}

/* Function to get intersection of two lines */
function getIntersection(line1, line2) {

  // Calculate intersection of two lines (if any)
  const denominator = (line1.x1 - line1.x2) * (line2.y1 - line2.y2) - (line1.y1 - line1.y2) * (line2.x1 - line2.x2);
  if (denominator === 0) {
      return null; // Lines are parallel
  }

  const x = ((line1.x1 * line1.y2 - line1.y1 * line1.x2) * (line2.x1 - line2.x2) - (line1.x1 - line1.x2) * (line2.x1 * line2.y2 - line2.y1 * line2.x2)) / denominator;
  const y = ((line1.x1 * line1.y2 - line1.y1 * line1.x2) * (line2.y1 - line2.y2) - (line1.y1 - line1.y2) * (line2.x1 * line2.y2 - line2.y1 * line2.x2)) / denominator;

  // Return intersection point
  return { x, y };
}

/* Function to detect if the selection on the board includes a Frame and a Table */
async function catchSelection() {
  const getItems = await miro.board.getSelection();
  let hasFrame = false;
  let hasTable = false;
  const uploadEl = document.getElementById('upload');
  for (let i=0; i < getItems.length; i++) {
    if (getItems[i].type === 'frame') {
      hasFrame = true;
    }
    if (getItems[i].type === 'table') {
      hasTable = true;
    }
  }
  if (hasFrame && hasTable) {
    uploadEl.removeAttribute('disabled');
  }
  else {
    uploadEl.setAttribute('disabled','disabled');
  }
}
    
/* Listen to the 'selection:update' event */
miro.board.ui.on('selection:update', catchSelection);

/* Catch initial board selection */
catchSelection();

let linesColor;
const lines = []; // Array to store line coordinates

/* Listen to the 'change' event on the upload PDF file button */
document.getElementById('upload').addEventListener('change', async (event) => {

  /* Reset variables */
  window.miroAppItems = {
    frame: null,
    elements: [] 
  };
  window.connectingLinesArray = [];
  window.textContent = [];
  window.sticky_notes = [];
  window.baseCells = [];
  window.extraCells = [];
  window.miroFrames = [];
  window.frameToReplicate = {
    id: null,
    index: null,
    element: null
  };
  window.miroWidgets = null;
  window.miroTags = null;
  window.miroHyperlinks = [];
  window.fontsData = {};
  document.getElementById('output').innerHTML = '';

  let uploadEl = document.getElementById('upload');
  let processingMsg = document.getElementById('processing_message');
  let completeMsg = document.getElementById('complete_message');
  let waitingSection = document.getElementById('waiting_section');
  let loadingSpinner = document.getElementById('loading_spinner');
  let completeIcon = document.getElementById('complete_icon');
  let instructions = document.getElementById('frame_wrapper');

  uploadEl.style.display = 'none';
  instructions.style.display = 'none';
  processingMsg.style.display = 'block';
  waitingSection.style.display = 'block';

  const file = event.target.files[0];
  if (!file) return;
  
  window.miroWidgets = await miro.board.getSelection();
  window.miroTags = await miro.board.get({type: 'tag'});
  
  /* Extract text content of elements selected */
  for(let i=0; i < window.miroWidgets.length; i++) {
    if (window.miroWidgets[i].type === 'shape' || window.miroWidgets[i].type === 'sticky_note') {
      let content = window.miroWidgets[i].content;
        extractRenderedText(content, 'widget', i); 
    }
    else if (window.miroWidgets[i].type === 'frame') {
      window.miroFrames.push(window.miroWidgets[i]);
    }
  }

  const pdfData = new Uint8Array(await file.arrayBuffer());
  window.globalPdfData = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;

  const output = document.getElementById('output');
  output.innerHTML = ''; // Clear previous content

  // Build objects for Miro
  let page;
  let viewport;
  let opList;
  let svgGfx;
  let svg;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    page = await pdf.getPage(pageNum);
    window.globalPage = await pdf.getPage(pageNum);
    
    viewport = page.getViewport({ scale: 1 });
    window.textContent = await page.getTextContent();
    window.textAnnotations = await page.getAnnotations();
    let operatorList = await page.getOperatorList(); // needed to call page.commonObjs
    
    let fontsInDocument = Object.keys(window.textContent.styles);
    let fontsInfo = await getPdfObjectData(page.commonObjs, fontsInDocument);

    // Capture fonts used in the PDF by name and identify if they are Bold or not
    for(let q=0; q < fontsInfo.length; q++) {
      let fontName = fontsInfo[q].data.name.toLowerCase();
      let fontNameSimple = (fontName.indexOf('arial') !== -1 ? 'arial' : fontName.indexOf('opensans') !== -1 ? 'open_sans' : fontsInfo[q].data.name);
      let isBold = (fontName.indexOf('bold') !== -1 ? 'bold' : 'regular');
      
      window.fontsData[fontsInfo[q].objId] = {
        id: fontsInfo[q].objId,
        font_name: fontsInfo[q].data.name,
        font_name_short: fontNameSimple,
        font_weight: isBold
      };
    }
    
    // Get hyplinks within the PDF */
    for(let n=0; n < window.textAnnotations.length; n++) {
      if (window.textAnnotations[n].subtype === 'Link' && window.textAnnotations[n].url) {
        let link = {
          url: window.textAnnotations[n].url
        };
        window.miroHyperlinks.push(link);
      }
    }

    // Render page to SVG
    opList = await page.getOperatorList();
    svgGfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs);
    svg = await svgGfx.getSVG(opList, viewport);
    
    // Append the SVG to the output container
    const divContainer = document.createElement('div');
    divContainer.appendChild(svg);
    output.appendChild(divContainer);
    
    // Post-process the SVG to add cells
    postProcessSVG(svg);
  }

  /* Parse text */
  for(let a=0; a < window.textContent.items.length; a++) {

    // Extract x and y from the transformation matrix
    var pdfX = window.textContent.items[a].transform[4]; // x-coordinate
    var pdfY = window.textContent.items[a].transform[5]; // y-coordinate
    
    // Convert to absolute coordinates
    let { x, y } = convertToAbsoluteCoordinates(pdfX, pdfY, viewport);
    
    // Extract width and height from the text item
    let width = window.textContent.items[a].width * viewport.scale;
    let height = window.textContent.items[a].height * viewport.scale;

    // Calculate the bounding box
    let left = x;
    let top = y - height; // Adjust for y-origin
    let right = left + width;
    let bottom = top + height;
    
    let boundingBox = {
      top: top,
      left: left,
      right: right,
      bottom: bottom,
      width: width,
      height: height,
      x: x,
      y: y
    };
    
    window.textContent.items[a].rect = boundingBox;
  }

  // Get Sticky Notes in the SVG
  let stickyShadows = document.querySelectorAll('svg image[*|href^="blob:"]');

  // Identify all Stickies and Text within Stykies
  for(let i=0; i < stickyShadows.length; i++) {
    stickyShadows[i].setAttribute('data-type','sticky_shadow');
    stickyShadows[i].setAttribute('id',`sticky_shadow_${i}`);
    let stickyShadowParent = stickyShadows[i].parentElement.parentElement;
    stickyShadowParent.setAttribute('data-type','sticky_shadow_parent');
    let stickyShadowParentNextSibling = stickyShadowParent.nextSibling;
    
    if (stickyShadowParentNextSibling.querySelector('path[fill]:not([fill="none"])')) {
      stickyShadowParentNextSibling.setAttribute('data-type','sticky_note_parent');
      stickyShadowParentNextSibling.querySelector(`path`).setAttribute('data-type','sticky_note');
      stickyShadowParentNextSibling.querySelector(`path`).setAttribute('id',`sticky_note_${i}`);
      
      if (stickyShadowParentNextSibling.nextSibling.querySelector(`tspan`)) {
        stickyShadowParentNextSibling.nextSibling.setAttribute('data-type','sticky_note_text_parent');
        stickyShadowParentNextSibling.nextSibling.querySelector(`tspan`).setAttribute('data-type','sticky_note_text');
        stickyShadowParentNextSibling.nextSibling.querySelector(`tspan`).setAttribute('id',`sticky_note_${i}_text`);
        stickyShadowParentNextSibling.querySelector(`path`).setAttribute('data-text-content',stickyShadowParentNextSibling.nextSibling.querySelector(`tspan`).id);
      }
    }
  }
  
  // Get true sticky notes once correctly labeled 
  const stickyNoteElements = document.querySelectorAll('path[data-type="sticky_note"]');
  window.sticky_notes = [];
  
  // Identify text within each sticky note
  for(let i=0; i < stickyNoteElements.length; i++) {
    let dimensions = stickyNoteElements[i].getBoundingClientRect();
    let THRESHOLD = 0.1;
    let shapeType = classifyShape(stickyNoteElements[i], THRESHOLD);
    let sticky = {
      id: stickyNoteElements[i].id,
      element: stickyNoteElements[i],
      text_content: `${stickyNoteElements[i].id}_text`,
      text_content_element: document.getElementById(`${stickyNoteElements[i].id}_text`),
      shape: shapeType
    };
    let text = [];

    for(let c=0; c < window.textContent.items.length; c++) {
      if (!window.textContent.items.matched) {
        let isTextWithinCell = isTextElementWithin(stickyNoteElements[i], window.textContent.items[c]);
        if (isTextWithinCell) {
          let isTag = false;
          for(let j=0; j < window.miroTags.length; j++) {
              if (window.textContent.items[c].str.indexOf('...') !== -1) {
                let stringCapped = window.textContent.items[c].str.replaceAll('...','');
                if (window.miroTags[j].title.indexOf(stringCapped) !== -1) {
                  isTag = true;
                }
              }
              else if (window.textContent.items[c].str === window.miroTags[j].title) {
                isTag = true;
              }
          }

          if (!isTag) {
            text.push(window.textContent.items[c].str); 
          }

          window.textContent.items[c].matched = true;
          let textHtmlElementInCell = findTHtmlTextElementWithin(stickyNoteElements[i]);

          if (textHtmlElementInCell) {
            let fontSize = textHtmlElementInCell.getAttribute('font-size');
            fontSize = fontSize.replaceAll('px','');
            fontSize = parseFloat(fontSize);
            window.textContent.items[c].font_size = fontSize;
          }
        }
      }
      if (text.length > 0) {
        let string = text.join('');
        string = string.replace(/\s+/g, '');
        sticky.text_content = string; 
      }
    }
    window.sticky_notes.push(sticky);
  }

  // Identify Base Cells and Extra Cells
  window.extraCells = [];
  if (window.linesGrid) {
    const pathsWithFill = document.querySelectorAll('svg path[fill]:not([fill="none"])');
    let baseElements = document.getElementsByClassName('base_cell');
    window.baseCells = [];

    for(let i=0; i < pathsWithFill.length; i++) {
      let hasMatch = false;
      let origCoordinates = pathsWithFill[i].getBoundingClientRect();
      origCoordinates.x = Math.trunc(origCoordinates.x);
      origCoordinates.y = Math.trunc(origCoordinates.y);

      for(let a=0; a < baseElements.length; a++) {

        let baseCoordinates = baseElements[a].getBoundingClientRect();
        baseCoordinates.x = Math.trunc(baseCoordinates.x);
        baseCoordinates.y = Math.trunc(baseCoordinates.y);

        if ((origCoordinates.x === baseCoordinates.x || origCoordinates.x === (baseCoordinates.x + 1) || origCoordinates.x === (baseCoordinates.x - 1)) && (origCoordinates.y === baseCoordinates.y || origCoordinates.y === baseCoordinates.y + 1 || origCoordinates.y === baseCoordinates.y - 1)) {
          pathsWithFill[i].setAttribute('id',`orig_${baseElements[a].id}`);
          pathsWithFill[i].setAttribute('class','orig_base_cell');
          let item = {
            extra_cell: pathsWithFill[i].id,
            extra_cell_element: pathsWithFill[i],
            base_cell: baseElements[a].id,
            base_cell_element: baseElements[a],
            text_content: null,
            text_content_element: null
          };

          pathsWithFill[i].setAttribute('data-type', 'extra_cell');
          baseElements[a].setAttribute('data-type', 'base_cell_with_extra_cell');

          window.extraCells.push(item);
          break;
        }
      }
    }
  }
  else {
    // Detect floating boxes and rectangles
    let pathsWithFill = document.querySelectorAll('path[fill-opacity]:not([data-type]):not([fill="none"]');
    let count = 0;

    for(let i=0; i < pathsWithFill.length; i++) {
      let isBox = isRectangularBox(pathsWithFill[i]);
      let isDouble = isDoubleShape(pathsWithFill[i]);

      if (isBox && !isDouble) {
        pathsWithFill[i].setAttribute('id',`orig_base_cell_${count}`);
        pathsWithFill[i].setAttribute('class','orig_base_cell');
        pathsWithFill[i].setAttribute('data-type','extra_cell');
        let box = {
          extra_cell: pathsWithFill[i].id,
          extra_cell_element: pathsWithFill[i],
          text_content: null,
          text_content_element: null,
          font_size: null,
          background_color: pathsWithFill[i].getAttribute('fill'),
          opacity: parseFloat(pathsWithFill[i].getAttribute('fill-opacity'))
        };
        window.extraCells.push(box);
        count = count + 1;
      }
    }
  }

  // Add font into to Text Elements
  let textHtmlElements = document.querySelectorAll('tspan[font-family]');
  for(let i=0; i < textHtmlElements.length; i++) {
    let fontNameAttr = textHtmlElements[i].getAttribute('font-family');
    textHtmlElements[i].setAttribute('data-font-name',window.fontsData[fontNameAttr].font_name_short);
    textHtmlElements[i].parentElement.setAttribute('data-parent-font-name',window.fontsData[fontNameAttr].font_name_short);
    textHtmlElements[i].setAttribute('data-font-weight',window.fontsData[fontNameAttr].font_weight);
    textHtmlElements[i].parentElement.setAttribute('data-parent-font-weight',window.fontsData[fontNameAttr].font_weight);
    textHtmlElements[i].parentElement.setAttribute('data-parent-text','true');
  }

  // Detect floating boxes and rectangles
  let floatingShapes = document.querySelectorAll('path[fill-opacity]:not([data-type]):not([fill="none"]');
  window.floatingBoxes = [];
  for(let i=0; i < floatingShapes.length; i++) {
    let isBox = isRectangularBox(floatingShapes[i]);

    if (isBox) {
        floatingShapes[i].setAttribute('id',`floating_box_${i}`);
        floatingShapes[i].setAttribute('data-type',`floating_box`);
        let box = {
          id: floatingShapes[i].id,
          element: floatingShapes[i],
          text_content: null,
          font_size: null,
          background_color: floatingShapes[i].getAttribute('fill'),
          opacity: parseFloat(floatingShapes[i].getAttribute('fill-opacity'))
        };

        window.floatingBoxes.push(box);
    }
  }

  // Detect text within floating boxes
  for(let i=0; i < window.floatingBoxes.length; i++) {
    let text = [];
    for(let c=0; c < window.textContent.items.length; c++) {
      if (!window.textContent.items[c].hasOwnProperty('matched')) {
        let isTextWithinCell = isTextElementWithin(window.floatingBoxes[i].element, window.textContent.items[c]);
        
        if (isTextWithinCell) {
          text.push(window.textContent.items[c].str);
          window.textContent.items[c].matched = true;
          let textHtmlElementInCell = findTHtmlTextElementWithin(window.floatingBoxes[i].element);
          
          if (textHtmlElementInCell) {
            let fontSize = textHtmlElementInCell.getAttribute('font-size');
            fontSize = fontSize.replaceAll('px','');
            fontSize = parseFloat(fontSize);
            window.textContent.items[c].font_size = fontSize;
          }
        }
      }
    }
    if (text.length > 0) {
      let string = text.join('');
      string = string.replace(/\s+/g, '');
      window.floatingBoxes[i].text_content = string; 
    }
  }

  // Identify URL Lines
  let urlCount = 0;
  for(let i=0; i < floatingShapes.length; i++) {
    
    if (floatingShapes[i].nextSibling && floatingShapes[i].nextSibling.tagName === 'svg:text') {
      let isHyperLinkLine = isRectangularLinkLine(floatingShapes[i]);
      
      if (isHyperLinkLine && window?.miroHyperlinks[urlCount]?.url) {
        floatingShapes[i].setAttribute('data-type','url_line');
        floatingShapes[i].setAttribute('id',`url_line_${i}`);
        floatingShapes[i].nextSibling && floatingShapes[i].nextSibling.firstElementChild.setAttribute('data-type','url_text');
        floatingShapes[i].nextSibling && floatingShapes[i].nextSibling.firstElementChild.setAttribute('id',`url_text_${urlCount}`);
        floatingShapes[i].nextSibling && floatingShapes[i].nextSibling.firstElementChild.setAttribute('data-index',urlCount);
        floatingShapes[i].nextSibling && floatingShapes[i].nextSibling.firstElementChild.setAttribute('data-content',window.miroHyperlinks[urlCount].url);
        urlCount = urlCount + 1;
      }
    }
  }

  // Identify Extra Cells Text
  for(let i=0; i < window.extraCells.length; i++) {
    let text = [];
    
    for(let c=0; c < window.textContent.items.length; c++) {
      let tempString = window.textContent.items[c].str;
      let cleanedString = window.textContent.items[c].str.replace(/\s+/g, '');
      
      if (!window.textContent.items[c].hasOwnProperty('matched')) {
        let isTextWithinCell = isTextElementWithin(window.extraCells[i].extra_cell_element, window.textContent.items[c]);
        
        if (isTextWithinCell) {

          if (window.textContent.items[c].str === '') { 
            text.push(window.textContent.items[c].str);
            window.textContent.items[c].matched = true;
          }
          else {
            let textHtmlElementInCell = findTHtmlTextElementWithin(window.extraCells[i].extra_cell_element);

            if (textHtmlElementInCell) {

              if (textHtmlElementInCell.textContent && textHtmlElementInCell.textContent !== '') {

                if (textHtmlElementInCell.textContent.length === cleanedString.length) {
                  window.textContent.items[c].matched = true;
                  textHtmlElementInCell.setAttribute('data-matched','true');
                  textHtmlElementInCell.setAttribute('data-text-content', tempString);
                }
                else if (textHtmlElementInCell.textContent.length < cleanedString.length) {
                  
                  textHtmlElementInCell.setAttribute('data-matched','true');
                  var textElementsWithinParent = textHtmlElementInCell.parentElement.querySelectorAll('tspan');
                  let numberOfCharacters = 0;

                  for(q=0; q < textElementsWithinParent.length; q++){
                    numberOfCharacters = numberOfCharacters + textElementsWithinParent[q].textContent.length;
                  }

                  if (numberOfCharacters === cleanedString.length) {
                    for(q=0; q < textElementsWithinParent.length; q++){
                      textElementsWithinParent[q].setAttribute('data-matched','true');
                      textElementsWithinParent[q].setAttribute('data-text-content', tempString);
                    }
                  }
                  window.textContent.items[c].matched = true;

                }
                else if (textHtmlElementInCell.textContent.length > cleanedString.length) {
                  let numberOfMatchedCharacters = textHtmlElementInCell.getAttribute('data-partly-matched');
                  
                  if (!numberOfMatchedCharacters) {
                    numberOfMatchedCharacters = 0 + cleanedString.length;
                  }
                  else {
                    numberOfMatchedCharacters = parseFloat(numberOfMatchedCharacters) + cleanedString.length;
                  }

                  let addedTextContent = textHtmlElementInCell.getAttribute('data-text-content');
                  if (!addedTextContent) {
                    addedTextContent = tempString;
                  }
                  else {
                    addedTextContent = addedTextContent + tempString;
                  }

                  if (numberOfMatchedCharacters === textHtmlElementInCell.textContent.length || numberOfMatchedCharacters === textHtmlElementInCell.textContent.length + 1) {
                    textHtmlElementInCell.setAttribute('data-matched', 'true');
                    textHtmlElementInCell.setAttribute('data-text-content', addedTextContent);
                    textHtmlElementInCell.removeAttribute('data-partly-matched');
                  }
                  else {
                    textHtmlElementInCell.setAttribute('data-partly-matched', numberOfMatchedCharacters);
                    textHtmlElementInCell.setAttribute('data-text-content', addedTextContent);
                  }

                  window.textContent.items[c].matched = true;
                }

                if (textHtmlElementInCell.getAttribute('data-font-weight') === 'bold') {
                  tempString = `<strong>${tempString}</strong>`;
                }

                if (textHtmlElementInCell.getAttribute('data-type') === 'url_text') {
                  let hyperlinkIndex = parseFloat(textHtmlElementInCell.getAttribute('data-index'));
                  if (!window.miroHyperlinks[hyperlinkIndex].hasOwnProperty('matched')) {
                    let url = window.miroHyperlinks[hyperlinkIndex].url;
                    tempString = `<a href="${url}">${tempString}</a>`;
                    window.miroHyperlinks[hyperlinkIndex].matched = true;
                    textHtmlElementInCell.setAttribute('data-text-content', tempString);
                  }
                }

                let isFirstChildEl = isFirstChild(textHtmlElementInCell);
                if (isFirstChildEl) {
                  let currentElPosition = textHtmlElementInCell.parentElement.getBoundingClientRect();
                  let previousSibling = textHtmlElementInCell.parentElement.previousElementSibling;

                  if (previousSibling && previousSibling.tagName === 'svg:text') {
                    let isPreviousSiblingWithinCell = isElementWithin(window.extraCells[i].extra_cell_element, previousSibling);
                    
                    if (isPreviousSiblingWithinCell) {
                      let previousSiblingPosition = previousSibling.getBoundingClientRect();
                      
                      if (currentElPosition.top - previousSiblingPosition.bottom > 3.5) {
                        tempString = `<br>${tempString}`;
                      }
                    }
                  }
                }
                text.push(tempString);

                let fontSize = textHtmlElementInCell.getAttribute('font-size');
                fontSize = fontSize.replaceAll('px','');
                fontSize = parseFloat(fontSize);
                window.textContent.items[c].font_size = fontSize;
                window.extraCells[i].font_size = fontSize;

                let fontColor = textHtmlElementInCell.getAttribute('fill');
                window.textContent.items[c].font_color = fontColor;
                window.extraCells[i].font_color = fontColor;

                let cellColor = window.extraCells[i].extra_cell_element.getAttribute('fill');
                window.extraCells[i].background_color = cellColor;

                let cellOpacity = window.extraCells[i].extra_cell_element.getAttribute('fill-opacity');
                cellOpacity = parseFloat(cellOpacity);
                window.extraCells[i].background_opacity = cellOpacity;
              }
            }
          }
        }
      }
    }
    if (text.length > 0) {
      let htmlTextArr = [];
      let htmlText;
      for (let m=0; m < text.length; m++) {
        if (text[m] === '') {
          if (m !== 0 && m !== m.length - 1) {
            htmlTextArr.push('<br>');
          }
        }
        else {
          let textCopy = text[m].toString();
          htmlTextArr.push(textCopy);
        }
      }
      let string = text.join('');
      string = extractRenderedText(string);
      htmlText = htmlTextArr.join('');
      window.extraCells[i].text_content_orig = `<p>${htmlText.toString()}</p>`; 
      string = string.replace(/\s+/g, '');
      window.extraCells[i].text_content = string; 
    }
  }

  // Remove Base Cells covered by Extra Cells
  if (window.linesGrid) {
    for(let i=0; i < window.extraCells.length; i++){
      window.extraCells[i].base_cell_element.remove();
    }
  }

  // Identify base cells with content within (without an extra box)
  baseElements = document.getElementsByClassName('base_cell');
  
  // Detect text within Base boxes
  for(let i=0; i < baseElements.length; i++) {
    let item = {
      id: baseElements[i].id,
      element: baseElements[i],
      text_content: null,
      text_content_element: null
    };

    let text = [];
    for(let c=0; c < window.textContent.items.length; c++) {
      let tempString = window.textContent.items[c].str;
      let cleanedString = window.textContent.items[c].str.replace(/\s+/g, '');
      if (!window.textContent.items[c].hasOwnProperty('matched')) {
        
        let isTextWithinCell = isTextElementWithin(baseElements[i], window.textContent.items[c]);
        if (isTextWithinCell) {

          if (window.textContent.items[c].str === '') { 
            text.push(window.textContent.items[c].str);
            window.textContent.items[c].matched = true;
          }
          else {
            let textHtmlElementInCell = findTHtmlTextElementWithin(baseElements[i],window.textContent.items[c].str);
            
            if (textHtmlElementInCell) {

              if (textHtmlElementInCell.textContent && textHtmlElementInCell.textContent !== '') {

                if (textHtmlElementInCell.textContent.length === cleanedString.length) {

                  window.textContent.items[c].matched = true;
                  textHtmlElementInCell.setAttribute('data-matched','true');
                  textHtmlElementInCell.setAttribute('data-text-content', tempString);
                }
                else if (textHtmlElementInCell.textContent.length < cleanedString.length) {

                  textHtmlElementInCell.setAttribute('data-matched','true');
                  var textElementsWithinParent = textHtmlElementInCell.parentElement.querySelectorAll('tspan');
                  let numberOfCharacters = 0;

                  for(q=0; q < textElementsWithinParent.length; q++){
                    numberOfCharacters = numberOfCharacters + textElementsWithinParent[q].textContent.length;
                  }
                  if (numberOfCharacters === cleanedString.length) {

                    for(q=0; q < textElementsWithinParent.length; q++){
                      textElementsWithinParent[q].setAttribute('data-matched','true');
                      textElementsWithinParent[q].setAttribute('data-text-content', tempString);
                    }
                  }
                  window.textContent.items[c].matched = true;
                }
                else if (textHtmlElementInCell.textContent.length > cleanedString.length) {
                  
                  let numberOfMatchedCharacters = textHtmlElementInCell.getAttribute('data-partly-matched');
                  if (!numberOfMatchedCharacters) {
                    numberOfMatchedCharacters = 0 + cleanedString.length;
                  }
                  else {
                    numberOfMatchedCharacters = parseFloat(numberOfMatchedCharacters) + cleanedString.length;
                  }

                  let addedTextContent = textHtmlElementInCell.getAttribute('data-text-content');

                  if (!addedTextContent) {
                    addedTextContent = tempString;
                  }
                  else {
                    addedTextContent = addedTextContent + tempString;
                  }

                  if (numberOfMatchedCharacters === textHtmlElementInCell.textContent.length || numberOfMatchedCharacters === textHtmlElementInCell.textContent.length + 1) {
                    textHtmlElementInCell.setAttribute('data-matched', 'true');
                    textHtmlElementInCell.setAttribute('data-text-content', addedTextContent);
                    textHtmlElementInCell.removeAttribute('data-partly-matched');
                  }
                  else {
                    textHtmlElementInCell.setAttribute('data-partly-matched', numberOfMatchedCharacters);
                    textHtmlElementInCell.setAttribute('data-text-content', addedTextContent);
                  }

                  window.textContent.items[c].matched = true;
                }

                if (textHtmlElementInCell.getAttribute('data-font-weight') === 'bold') {
                  tempString = `<strong>${tempString}</strong>`;
                }

                if (textHtmlElementInCell.getAttribute('data-type') === 'url_text') {
                  let hyperlinkIndex = parseFloat(textHtmlElementInCell.getAttribute('data-index'));
                  if (!window.miroHyperlinks[hyperlinkIndex].hasOwnProperty('matched')) {
                    let url = window.miroHyperlinks[hyperlinkIndex].url;
                    tempString = `<a href="${url}">${tempString}</a>`;
                    window.miroHyperlinks[hyperlinkIndex].matched = true;
                  }
                }

                let isFirstChildEl = isFirstChild(textHtmlElementInCell);
                
                if (isFirstChildEl) {
                  let currentElPosition = textHtmlElementInCell.parentElement.getBoundingClientRect();
                  let previousSibling = textHtmlElementInCell.parentElement.previousElementSibling;

                  if (previousSibling && previousSibling.tagName === 'svg:text') {
                    let isPreviousSiblingWithinCell = isElementWithin(baseElements[i], previousSibling);
                    if (isPreviousSiblingWithinCell) {
                      let previousSiblingPosition = previousSibling.getBoundingClientRect();
                      if (currentElPosition.top - previousSiblingPosition.bottom > 3.5) {
                        tempString = `<br>${tempString}`;
                      }
                    }
                  }
                }

                text.push(tempString);

                let fontSize = textHtmlElementInCell.getAttribute('font-size');
                fontSize = fontSize.replaceAll('px','');
                fontSize = parseFloat(fontSize);
                window.textContent.items[c].font_size = fontSize;
                item.font_size = fontSize;

                let fontColor = textHtmlElementInCell.getAttribute('fill');
                window.textContent.items[c].font_color = fontColor;
                item.font_color = fontColor;
                
                let cellColor = baseElements[i].getAttribute('fill');
                item.background_color = cellColor;

                let cellOpacity = baseElements[i].getAttribute('fill-opacity');
                cellOpacity = parseFloat(cellOpacity);
                item.background_opacity = cellOpacity;                
              }
            }
          }
        }
      }
    }

    if (text.length > 0) {
      let htmlTextArr = [];
      let htmlText;
      for (let m=0; m < text.length; m++) {
        if (text[m] === '') {
          if (m !== 0 && m !== m.length - 1) {
            htmlTextArr.push('<br>');
          }
        }
        else {
          let textCopy = text[m].toString();
          htmlTextArr.push(textCopy);
        }
      }

      let string = text.join('');
      string = extractRenderedText(string);
      item.text_content = string; 
      htmlText = htmlTextArr.join('');
      item.text_content_orig = `<p>${htmlText.toString()}</p>`; 
      item.text_content = string;
      console.dir(item.text_content_orig);
    }

    window.baseCells.push(item);
  }
  
  // Connecting Lines
  let connectingLines = document.querySelectorAll('path[stroke-dasharray]:not([data-type="table-line"])');
  window.connectingLinesArray = [];
  
  for(let i=0; i < connectingLines.length; i++) {
    let parent = connectingLines[i].parentElement.parentElement;
    let lineEndParent = parent.nextSibling;
    
    // Check if the next path element after the line is the arrow tip (triangle)
    if (!!lineEndParent?.querySelector('path')?.getAttribute('fill') && lineEndParent?.querySelector('path')?.getAttribute('fill') !== 'none') {
      connectingLines[i].setAttribute('id',`connecting_line_${i}`);
      connectingLines[i].setAttribute('data-type',`connecting_line`);
      parent.setAttribute('data-type',`connecting_line_parent`);
      lineEndParent.setAttribute('data-type',`connecting_line_end_parent`);

      let lineEndEl = lineEndParent.querySelector('path');
      lineEndEl.setAttribute('data-type',`connecting_line_end`);
      lineEndEl.setAttribute('id',`connecting_line_${i}_end`);
      connectingLines[i].setAttribute('data-line-end',`connecting_line_${i}_end`);

      /* =========== GET ABSOLUTE COORDINATES OF START AND POINTS OF ARROWS - BEGIN ======== */
      // Get the SVG path element
      const pathElement = connectingLines[i];
      const triangle = lineEndEl;

      // Get the 'd' attribute of the path
      const pathData = pathElement.getAttribute('d');

      // Fix spacing for 'M' and 'C'
      const fixed = pathData
        .replace(/M(?=\S)/, "M ")           // Add a space after 'M' if it doesn't have one
        .replace(/(?<!\s)C(?!\s)/g, " C ")  // Add a space before and after 'C' if missing
        .replace(/(?<!\s)C(?=\s)/g, " C")   // Ensure there's a space only before 'C'
        .replace(/(?<=\s)C(?!\s)/g, "C ");  // Ensure there's a space only after 'C'
      
      const commands = fixed.split(/[\s,]/).filter(token => token.trim() !== '');
      
      let startPoint, endPoint;

      for (let i = 0; i < commands.length; i++) {
        if (commands[i] === 'M') {
          // Extract the start point (x, y) after 'M'
          startPoint = {
            x: parseFloat(commands[i + 1]),
            y: parseFloat(commands[i + 2])
          };
        }
        else if (commands[i] === 'C') {
          // Extract the end point (x, y) from the last two values of the 'C' command
          console.dir('===== comnads =====');
          console.dir(commands);
          console.dir('index --> ' + i);
          console.dir('x --> ' + parseFloat(commands[i + 5]));
          console.dir('x --> ' + parseFloat(commands[i + 6]));
          endPoint = {
            x: parseFloat(commands[i + 5]),
            y: parseFloat(commands[i + 6])
          };
          if (!endPoint.hasOwnProperty('x')) {
            debugger; // breakpoint only for debugging. This condition should never be true
          }
        }
          else if (commands[i] === 'L') {
          // Extract the end point (x, y) from the 'L' command
          endPoint = {
            x: parseFloat(commands[i + 1]),
            y: parseFloat(commands[i + 2])
          };
        }
      }
      
      if (typeof endPoint === 'undefined') {
        debugger; // breakpoint only for debugging. This condition should never be true
      }

      // Use getScreenCTM() to get the transformation matrix relative to the viewport
      const ctm = pathElement.getScreenCTM();

      // Transform the start and end points
      const absoluteStartPoint = {
        x: startPoint.x * ctm.a + startPoint.y * ctm.c + ctm.e,
        y: startPoint.x * ctm.b + startPoint.y * ctm.d + ctm.f
      };
      const absoluteEndPoint = {
        x: endPoint.x * ctm.a + endPoint.y * ctm.c + ctm.e,
        y: endPoint.x * ctm.b + endPoint.y * ctm.d + ctm.f
      };

      const absoluteEndPoint2 = {
        x: triangle.getBoundingClientRect().left + (triangle.getBoundingClientRect().width / 2),
        y: triangle.getBoundingClientRect().top + (triangle.getBoundingClientRect().height / 2)
      }

      console.log('Absolute Start Point:', absoluteStartPoint);
      console.log('Absolute End Point:', absoluteEndPoint);
      console.log('Absolute End Point2:', absoluteEndPoint2);

      let lineCoordinates = {
        id: `connecting_line_${i}`,
        start: absoluteStartPoint,
        end: absoluteEndPoint
      };
      window.connectingLinesArray.push(lineCoordinates);
    }
  }
  
  for(let i=0; i < window.connectingLinesArray.length; i++) {

    // Find the square connected to the start of the arrow
    const arrowStart = window.connectingLinesArray[i].start;
    const arrowEnd = window.connectingLinesArray[i].end;
    const startSquare = isNearSquare(arrowStart);
    
    // Find the square connected to the end of the arrow
    const endSquare = isNearSquare(arrowEnd);

    console.dir(`=== ${window.connectingLinesArray[i].id} ====`);
    console.log('Start Square:', startSquare);
    console.log('End Square:', endSquare);
    
    window.connectingLinesArray[i].startElement = startSquare;
    window.connectingLinesArray[i].endElement = endSquare;
  }
  
  const frameEl = document.querySelector('svg g:first-of-type > g:first-of-type  > path');
  const frameArray = [
    frameEl
  ];

  //return false;

  let triggerFrame = await createShapes(frameArray, 'frame', null);
  let triggerBaseCells = await createShapes(window.baseCells, 'base_cells', triggerFrame[0]);
  let triggerExtraCells = await createShapes(window.extraCells, 'extra_cells', triggerFrame[0]);
  let triggerStickies = await createShapes(window.sticky_notes, 'stickies', triggerFrame[0]);
  let triggerBoxes = await createShapes(window.floatingBoxes, 'floating_boxes', triggerFrame[0]);
  let triggerConnectingLines = await createShapes(window.connectingLinesArray, 'connecting_lines');
  
  processingMsg.style.display = 'none';
  completeMsg.style.display = 'block';
  loadingSpinner.style.display = 'none';
  completeIcon.style.display = 'block';

  await miro.board.viewport.zoomTo(triggerFrame[0]);
  let attachItemsToFrame = await attachToFrame();
  await miro.board.ui.closePanel();
});