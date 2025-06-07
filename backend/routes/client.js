const express = require("express");
const router = express.Router();
const fs = require("fs");
const { generateRandomLogs, predictMLScore } = require("../utils");
const { addFilestoIPFS } = require("../ipfs");
const { addBlock } = require("../web3-methods");

router.post("/addLog", async (req, res) => {
  try {
    const { logData } = req.body;
    
    if (!logData || !logData.campLocation) {
      return res.status(400).json({ error: "Invalid log data. campLocation is required." });
    }
    
    console.log(`Adding log entry for camp: ${logData.campLocation}`);
    const ml_risk_score = predictMLScore(logData);
    
    // Ensure the local log folder exists
    const localLogFolder = process.env.LOCAL_LOG_FOLDER;
    if (!fs.existsSync(`./${localLogFolder}`)) {
      fs.mkdirSync(`./${localLogFolder}`, { recursive: true });
      console.log(`Created local log folder: ${localLogFolder}`);
    }
    
    // Ensure the location-specific file exists
    if (!fs.existsSync(`./${localLogFolder}/${logData.campLocation}.txt`)) {
      fs.writeFileSync(`./${localLogFolder}/${logData.campLocation}.txt`, "");
      console.log(`Created empty file: ${localLogFolder}/${logData.campLocation}.txt`);
    }
    
    // Ensure the All.txt file exists
    if (!fs.existsSync(`./${localLogFolder}/All.txt`)) {
      fs.writeFileSync(`./${localLogFolder}/All.txt`, "");
      console.log(`Created empty file: ${localLogFolder}/All.txt`);
    }
    
    // Format the log entry
    const logEntry = `${logData.campLocation},${logData.timestamp},${logData.source},${logData.destination},${logData.user},${logData.device},${logData.eventType},${logData.eventDescription},${logData.eventSeverity},${ml_risk_score}\n`;
    
    // Write to location-specific log file
    fs.appendFileSync(
      `./${localLogFolder}/${logData.campLocation}.txt`,
      logEntry
    );
    console.log(`Log added to ${logData.campLocation}.txt`);
    
    // Write to All.txt file
    fs.appendFileSync(
      `./${localLogFolder}/All.txt`,
      logEntry
    );
    console.log(`Log added to All.txt`);

    res.json({ message: "Success" });
  } catch (error) {
    console.error("Failed to add log:", error);
    console.error("Error details:", error.message);
    res.status(500).json({ 
      error: "Failed to add log", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.post("/addLogs", (req, res) => {
  try {
    const { numberoflogs, campLocation } = req.body;
    
    if (!numberoflogs || !campLocation) {
      return res.status(400).json({ 
        error: "Invalid request data", 
        details: "Both numberoflogs and campLocation are required" 
      });
    }
    
    console.log(`Generating ${numberoflogs} random logs for camp: ${campLocation}`);
    
    // Ensure the local log folder exists
    const localLogFolder = process.env.LOCAL_LOG_FOLDER;
    if (!fs.existsSync(`./${localLogFolder}`)) {
      fs.mkdirSync(`./${localLogFolder}`, { recursive: true });
      console.log(`Created local log folder: ${localLogFolder}`);
    }
    
    // Ensure the location-specific file exists
    if (!fs.existsSync(`./${localLogFolder}/${campLocation}.txt`)) {
      fs.writeFileSync(`./${localLogFolder}/${campLocation}.txt`, "");
      console.log(`Created empty file: ${localLogFolder}/${campLocation}.txt`);
    }
    
    // Ensure the All.txt file exists
    if (!fs.existsSync(`./${localLogFolder}/All.txt`)) {
      fs.writeFileSync(`./${localLogFolder}/All.txt`, "");
      console.log(`Created empty file: ${localLogFolder}/All.txt`);
    }
    
    // Generate random logs
    const logs = generateRandomLogs(numberoflogs, campLocation);
    console.log(`Generated ${logs.length} random logs`);
    
    // Format the log entries
    let content = "";
    logs.forEach(
      (logData) =>
        (content += `${campLocation},${logData.timestamp},${logData.source},${logData.destination},${logData.user},${logData.device},${logData.eventType},${logData.eventDescription},${logData.eventSeverity},${logData.mlRiskScore}\n`)
    );
    
    // Write to location-specific log file
    fs.appendFileSync(
      `./${localLogFolder}/${campLocation}.txt`,
      content
    );
    console.log(`Logs added to ${campLocation}.txt`);
    
    // Write to All.txt file
    fs.appendFileSync(
      `./${localLogFolder}/All.txt`,
      content
    );
    console.log(`Logs added to All.txt`);
    
    res.json({ message: "Success" });
  } catch (error) {
    console.error("Failed to add logs:", error);
    console.error("Error details:", error.message);
    res.status(500).json({ 
      error: "Failed to add logs", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.post("/triggerIPFSBlockChain", async (req, res) => {
  try {
    console.log("Starting IPFS and blockchain storage process...");
    
    // Ensure directories exist
    const localLogFolder = process.env.LOCAL_LOG_FOLDER;
    const centralLogFolder = process.env.CENTRAL_LOG_FOLDER;
    
    // Create directories if they don't exist
    if (!fs.existsSync(`./${localLogFolder}`)) {
      fs.mkdirSync(`./${localLogFolder}`, { recursive: true });
      console.log(`Created local log folder: ${localLogFolder}`);
    }
    
    if (!fs.existsSync(`./${centralLogFolder}`)) {
      fs.mkdirSync(`./${centralLogFolder}`, { recursive: true });
      console.log(`Created central log folder: ${centralLogFolder}`);
    }
    
    // Create empty files if they don't exist
    const locations = ["Delhi", "Mumbai", "Bangalore", "All"];
    for (const location of locations) {
      if (!fs.existsSync(`./${localLogFolder}/${location}.txt`)) {
        fs.writeFileSync(`./${localLogFolder}/${location}.txt`, "");
        console.log(`Created empty file: ${localLogFolder}/${location}.txt`);
      }
      
      if (!fs.existsSync(`./${centralLogFolder}/${location}.txt`)) {
        fs.writeFileSync(`./${centralLogFolder}/${location}.txt`, "");
        console.log(`Created empty file: ${centralLogFolder}/${location}.txt`);
      }
    }
    
    // Read file contents
    console.log("Reading log files...");
    const fileContents = {};
    for (const location of locations.filter(loc => loc !== "All")) {
      try {
        fileContents[location] = fs.readFileSync(
          `./${localLogFolder}/${location}.txt`,
          { encoding: "base64" }
        );
        console.log(`Read ${location}.txt successfully`);
      } catch (err) {
        console.error(`Error reading ${location}.txt:`, err);
        fileContents[location] = ""; // Use empty string if file can't be read
      }
    }
    
    // Only proceed with IPFS if there's content to upload
    const hasContent = Object.values(fileContents).some(content => content.length > 0);
    if (!hasContent) {
      console.log("No log content to upload to IPFS and blockchain");
      return res.json({ 
        message: "Success", 
        warning: "No log content was found to upload" 
      });
    }
    
    // Upload to IPFS
    console.log("Uploading files to IPFS...");
    const ipfsFiles = Object.entries(fileContents).map(([location, content]) => ({
      path: `${location}.txt`,
      content
    }));
    
    const response = await addFilestoIPFS(ipfsFiles);
    console.log("IPFS upload successful:", response.map(r => r.path).join(", "));
    
    // Add to blockchain
    console.log("Adding IPFS hashes to blockchain...");
    const blockchainPromises = [];
    for (let i = 0; i < response.length; i++) {
      const location = Object.keys(fileContents)[i];
      blockchainPromises.push(addBlock(response[i].path, location));
    }
    
    // Wait for all blockchain transactions to complete
    await Promise.all(blockchainPromises);
    console.log("All blockchain transactions completed successfully");
    
    // Copy to central storage
    console.log("Copying logs to central storage...");
    for (const location of locations.filter(loc => loc !== "All")) {
      try {
        const content = fs.readFileSync(`./${localLogFolder}/${location}.txt`);
        fs.appendFileSync(`./${centralLogFolder}/${location}.txt`, content);
        console.log(`Copied ${location}.txt to central storage`);
        
        // Also append to All.txt in central storage
        fs.appendFileSync(`./${centralLogFolder}/All.txt`, content);
      } catch (err) {
        console.error(`Error copying ${location}.txt to central storage:`, err);
      }
    }
    
    // Clear local files
    console.log("Clearing local log files...");
    for (const location of locations) {
      try {
        fs.writeFileSync(`./${localLogFolder}/${location}.txt`, "");
        console.log(`Cleared ${location}.txt`);
      } catch (err) {
        console.error(`Error clearing ${location}.txt:`, err);
      }
    }

    console.log("IPFS and blockchain storage process completed successfully");
    res.json({ message: "Success" });
  } catch (error) {
    console.error("Failed to trigger IPFS blockchain:", error);
    console.error("Error details:", error.message);
    res.status(500).json({ 
      error: "Failed to trigger IPFS blockchain", 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;
