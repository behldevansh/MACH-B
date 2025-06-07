const express = require("express");
var cors = require("cors");
const fs = require("fs");
const web3 = require("./web3-methods");
const app = express();
const dotenv = require("dotenv");
const { addFileToIPFS } = require("./ipfs");
const { addBlock } = require("./web3-methods");
dotenv.config({ path: "./.env" });

console.log("=== Starting Log Management System Backend ===");

// Verify environment variables are loaded
console.log("Environment variables loaded:");
console.log("- Pinata API Key:", process.env.PINATA_API_KEY ? "Yes" : "No");
console.log("- Pinata Secret Key:", process.env.PINATA_SECRET_API_KEY ? "Yes" : "No");
console.log("- Local Log Folder:", process.env.LOCAL_LOG_FOLDER);
console.log("- Central Log Folder:", process.env.CENTRAL_LOG_FOLDER);

// Create necessary directories
const ensureDirectoriesExist = () => {
  const directories = [
    process.env.LOCAL_LOG_FOLDER,
    process.env.CENTRAL_LOG_FOLDER
  ];
  
  directories.forEach(dir => {
    if (!fs.existsSync(`./${dir}`)) {
      try {
        fs.mkdirSync(`./${dir}`, { recursive: true });
        console.log(`Created directory: ${dir}`);
      } catch (err) {
        console.error(`Failed to create directory ${dir}:`, err);
      }
    } else {
      console.log(`Directory already exists: ${dir}`);
    }
  });
  
  // Create empty log files if they don't exist
  const locations = ["Delhi", "Mumbai", "Bangalore", "All"];
  locations.forEach(location => {
    directories.forEach(dir => {
      const filePath = `./${dir}/${location}.txt`;
      if (!fs.existsSync(filePath)) {
        try {
          fs.writeFileSync(filePath, "");
          console.log(`Created empty file: ${filePath}`);
        } catch (err) {
          console.error(`Failed to create file ${filePath}:`, err);
        }
      }
    });
  });
};

// Initialize directories
ensureDirectoriesExist();

app.use(cors());
app.use(express.json());

const PORT = 5001;

// Initialize Web3 connection
console.log("Initializing Web3 connection...");
web3.initializeWeb3()
  .then(() => {
    console.log("Web3 initialized successfully");
  })
  .catch(error => {
    console.error("Failed to initialize Web3:", error);
    console.error("The application will continue, but blockchain functionality may not work correctly");
  });

app.get("/", async (req, res) => {
  res.json({ 
    message: "Success",
    status: "Log Management System Backend is running"
  });
});

// Register routes
console.log("Registering API routes...");
app.use("/client", require("./routes/client"));
app.use("/admin", require("./routes/admin"));

// Direct API endpoints for testing
app.post("/add-log", async (req, res) => {
  const { logContent, campLocation } = req.body;
  try {
    console.log(`Received direct request to add log for camp: ${campLocation}`);
    
    if (!logContent || !campLocation) {
      return res.status(400).json({ 
        success: false, 
        error: "Missing required parameters: logContent and campLocation" 
      });
    }
    
    // 1. Upload log to IPFS
    console.log("Uploading log to IPFS...");
    const ipfsResult = await addFileToIPFS("log.txt", logContent);
    const ipfsHash = ipfsResult[0].path;
    console.log(`Log uploaded to IPFS with hash: ${ipfsHash}`);

    // 2. Add to blockchain (Ganache contract)
    console.log("Adding IPFS hash to blockchain...");
    const blockchainResult = await addBlock(ipfsHash, campLocation);
    console.log(`Added to blockchain with transaction hash: ${blockchainResult.transactionHash}`);

    res.json({ 
      success: true, 
      ipfsHash,
      transactionHash: blockchainResult.transactionHash
    });
  } catch (err) {
    console.error("Error in /add-log endpoint:", err);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

app.get("/all-logs", async (req, res) => {
  try {
    console.log("Fetching all logs from blockchain...");
    const logs = await web3.getBlocksData();
    console.log(`Retrieved ${logs.length} logs from blockchain`);
    res.json({ logs });
  } catch (err) {
    console.error("Error in /all-logs endpoint:", err);
    res.status(500).json({ 
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

// Start the server
const server = app.listen(PORT, (error) => {
  if (!error) {
    console.log("=== Log Management System Backend Started ===");
    console.log(`Server is running on port ${PORT}`);
    console.log(`API available at http://localhost:${PORT}`);
  } else {
    console.error("Error occurred, server can't start:", error);
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
