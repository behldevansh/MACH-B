const logFileStorage = require("./build/logFileStorage.json");
const { Web3 } = require("web3"); // Destructured import for Web3 v4.x
const utils = require("./utils");
const contractABI = require("./build/logFileStorage.json").abi;
const contractAddress = "0xD9324AbcFc967945348b0eA2B9f72489b2DBD1D8"; // Use your deployed address

let web3, contract, accounts;

const initializeWeb3 = async () => {
  try {
    if (web3 && contract && accounts && accounts.length > 0) {
      console.log("Web3 already initialized");
      return;
    }
    
    console.log("Initializing Web3 connection to Ganache...");
    web3 = new Web3("http://127.0.0.1:7545"); // Ganache RPC
    
    // Check connection
    const isConnected = await web3.eth.net.isListening();
    if (!isConnected) {
      throw new Error("Failed to connect to Ganache. Make sure Ganache is running on port 7545.");
    }
    
    accounts = await web3.eth.getAccounts();
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found in Ganache. Make sure Ganache is properly set up.");
    }
    
    // Verify contract address exists
    const code = await web3.eth.getCode(contractAddress);
    if (code === '0x' || code === '') {
      throw new Error(`No contract found at address ${contractAddress}. Make sure the contract is deployed.`);
    }
    
    contract = new web3.eth.Contract(contractABI, contractAddress);
    
    console.log("Web3 initialized successfully");
    console.log("Connected to accounts:", accounts.length);
    console.log("Using account:", accounts[0]);
    console.log("Contract address:", contractAddress);
  } catch (error) {
    console.error("Failed to initialize Web3:", error);
    throw error;
  }
};

const getBlocksData = async () => {
  try {
    if (!contract) {
      throw new Error("Web3 not initialized. Call initializeWeb3() first.");
    }
    const data = await contract.methods.getter().call({ gas: "1000000" });
    return utils.processJSONforBigInt(data);
  } catch (error) {
    console.error("Error getting blocks data:", error);
    throw error;
  }
};

const addBlock = async (ipfsHash, campLocation) => {
  try {
    // Make sure Web3 is initialized
    await initializeWeb3();
    
    if (!contract || !accounts || accounts.length === 0) {
      throw new Error("Web3 not properly initialized. Check Ganache connection.");
    }

    console.log(`Adding block to blockchain - IPFS Hash: ${ipfsHash}, Camp: ${campLocation}`);
    
    // Get the current gas price
    const gasPrice = await web3.eth.getGasPrice();
    console.log('Current gas price:', gasPrice.toString());
    
    // Estimate gas for the transaction
    const gasEstimate = await contract.methods
      .setter(ipfsHash, campLocation)
      .estimateGas({ from: accounts[0] });

    console.log('Estimated gas:', gasEstimate.toString());
    
    // Add 20% buffer to the gas estimate and convert to string
    const gasLimit = (BigInt(gasEstimate) * BigInt(12) / BigInt(10)).toString();
    console.log('Gas limit with buffer:', gasLimit);

    console.log('Sending transaction to blockchain...');
    const result = await contract.methods
      .setter(ipfsHash, campLocation)
      .send({ 
        from: accounts[0],
        gas: gasLimit,
        gasPrice: gasPrice.toString()
      });
      
    console.log("Block added successfully:", result.transactionHash);
    
    // Verify the data was added by calling getter
    const currentData = await getBlocksData();
    console.log("Current blockchain data count:", currentData.length);
    
    return result;
  } catch (error) {
    console.error("Error adding block:", error);
    console.error("Error details:", error.message);
    if (error.receipt) {
      console.error("Transaction receipt:", error.receipt);
    }
    throw error;
  }
};

const getAccounts = async () => {
  try {
    if (!web3) {
      throw new Error("Web3 not initialized. Call initializeWeb3() first.");
    }
    const accounts = await web3.eth.getAccounts();
    return accounts;
  } catch (error) {
    console.error("Error getting accounts:", error);
    throw error;
  }
};

module.exports = {
  initializeWeb3,
  getBlocksData,
  addBlock,
  getAccounts,
};
