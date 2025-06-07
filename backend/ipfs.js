const pinataSDK = require('@pinata/sdk');
require('dotenv').config();

// Debug: Log the environment variables (without showing full values)
console.log('PINATA_API_KEY exists:', !!process.env.PINATA_API_KEY);
console.log('PINATA_SECRET_API_KEY exists:', !!process.env.PINATA_SECRET_API_KEY);

if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_API_KEY) {
    throw new Error('Pinata API keys are missing. Please check your .env file.');
}

const pinata = new pinataSDK(process.env.PINATA_API_KEY, process.env.PINATA_SECRET_API_KEY);

// Optional: Test Pinata Authentication on startup
pinata.testAuthentication().then((result) => {
    console.log('Pinata Authentication Success:', result);
}).catch((err) => {
    console.error('Pinata Authentication Failed:', err);
});

const addFileToIPFS = async (path, base64Content) => {
  try {
    // Convert base64 to string
    const content = Buffer.from(base64Content, 'base64').toString('utf-8');
    
    // Create the JSON object to pin
    const jsonToPin = {
      content: content,
      name: path
    };

    // Pin to IPFS
    const result = await pinata.pinJSONToIPFS(jsonToPin, {
      pinataMetadata: {
        name: path
      }
    });

    console.log('Pinata upload result:', result); // Debug log
    
    // Return just the IpfsHash in the expected format
    return [{ path: result.IpfsHash }];
  } catch (error) {
    console.error('Error adding file to IPFS with Pinata:', error);
    throw error;
  }
};

const addFilestoIPFS = async (arrayofPathandbase64content) => {
  const results = [];
  for (const file of arrayofPathandbase64content) {
    try {
      // Convert base64 to string
      const content = Buffer.from(file.content, 'base64').toString('utf-8');
      
      // Create the JSON object to pin
      const jsonToPin = {
        content: content,
        name: file.path
      };

      // Pin to IPFS
      const result = await pinata.pinJSONToIPFS(jsonToPin, {
        pinataMetadata: {
          name: file.path
        }
      });

      console.log('Pinata upload result:', result); // Debug log
      results.push({ path: result.IpfsHash });
    } catch (error) {
      console.error(`Error adding file ${file.path} to IPFS with Pinata:`, error);
    }
  }
  return results;
};

module.exports = { addFileToIPFS, addFilestoIPFS };
