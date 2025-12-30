# How to Connect to Google Sheets

To save your data to a Google Sheet, follow these steps:

## Step 1: Create the Sheet
1.  Go to [Google Sheets](https://sheets.google.com) and create a **New Blank Spreadsheet**.
2.  Name it "Taiwan Countdown Data" (or whatever you like).
3.  In the first row, add these headers:
    *   **A1**: Date
    *   **B1**: Weight
    *   **C1**: BMI

## Step 2: Add the Script
1.  In your Google Sheet, confirm you are logged in with the account you want to own the data.
2.  In the top menu, go to **Extensions** > **Apps Script**.
3.  A new tab will open with a code editor. **Delete all the code** currently in `Code.gs`.
4.  **Copy and Paste** the following code into the editor:

```javascript
function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // Parse the data sent from the website
  var data = JSON.parse(e.postData.contents);
  
  var date = data.date;
  var weight = data.weight;
  var bmi = data.bmi;
  
  // Check if this date already exists to update it, otherwise add new
  var rows = sheet.getDataRange().getValues();
  var rowIndex = -1;
  
  // Get the sheet's timezone for consistent date handling
  var timezone = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  
  // Start from row 1 (index 0 is headers)
  for (var i = 1; i < rows.length; i++) {
    var rowDate = rows[i][0];
    
    // Normalize rowDate to string YYYY-MM-DD if it's a Date object
    if (rowDate instanceof Date) {
       // Use the same method as doGet for consistency
       rowDate = Utilities.formatDate(rowDate, timezone, "yyyy-MM-dd");
    }
    
    if (rowDate == date) {
      rowIndex = i + 1; // 1-based index for API
      break;
    }
  }
  
  if (rowIndex > 0) {
    // Update existing row
    sheet.getRange(rowIndex, 2).setValue(weight);
    sheet.getRange(rowIndex, 3).setValue(bmi);
  } else {
    // Append new row
    sheet.appendRow([date, weight, bmi]);
  }
  
  return ContentService.createTextOutput(JSON.stringify({"status": "success"}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var rows = sheet.getDataRange().getValues();
  var data = {};

  // Start from row 1 to skip headers
  for (var i = 1; i < rows.length; i++) {
    var date = rows[i][0];
    
    // Handle Date objects correctly using the sheet's timezone
    if (date instanceof Date) {
       var timezone = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
       date = Utilities.formatDate(date, timezone, "yyyy-MM-dd");
    }
    
    var weight = rows[i][1];
    var bmi = rows[i][2];
    
    // Ensure we have a valid date string and weight
    if (date && weight) {
      data[date] = {
        weight: weight,
        bmi: bmi
      };
    }
  }

  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Step 3: Deploy the Script
1.  Click the blue **Deploy** button in the top right -> **New deployment**.
2.  Click the **Select type** (gear icon) -> **Web app**.
3.  Fill in the details:
    *   **Description**: "Countdown API"
    *   **Execute as**: **Me** (your email).
    *   **Who has access**: **Anyone** (This is crucial so your website can talk to it without a login popup).
4.  Click **Deploy**.
5.  **Authorize**: It will ask for permission. Click **Review permissions** -> Choose account -> **Advanced** -> **Go to (Untitled project) (unsafe)** -> **Allow**.
6.  **Copy the URL**: You will see a "Web App URL" (starts with `https://script.google.com/...`).

## Step 4: Update Your Website
1.  Open `script.js` in your VS Code.
2.  Find the line `const GOOGLE_SCRIPT_URL = 'PLACEHOLDER';`.
3.  Replace `'PLACEHOLDER'` with the **Web App URL** you just copied.
